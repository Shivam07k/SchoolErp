/* ============================================================
   Hostel & Residential Life — backend routes
   Mounted at /api/school before the legacy comprehensive router so the
   richer handlers below own the /hostel/* paths.
   ============================================================ */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, writeAudit } from '../school/foundation.js';

const hostelRouter = express.Router();

hostelRouter.use(verifyToken);
hostelRouter.use(async (req, _res, next) => {
  if (!req.school) {
    const pool = getPool();
    const appId = req.user?.company || DEFAULT_COMPANY_ID;
    await ensureFoundation(pool, appId);
    req.school = await loadAccess(pool, appId, req.user);
  }
  next();
});

/* ---- helpers ---- */
const num = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
const text = (v) => (v === undefined || v === null ? null : String(v).trim());
const bool = (v, fallback = false) => (v === undefined || v === null ? fallback : Boolean(v));
const dayOf = (v) => {
  if (!v) return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
};
const appIdOf = (req) => req.school?.appId || 'default';
const userOf = (req) => req.user?.userid || req.user?.id || 'system';
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const nextNo = (prefix, count) => `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => { throw new HttpError(status, message); };

function guard(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('hostel.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
function guardView(req, res, perm = 'hostel.view') {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('hostel.view') || perms.includes('hostel.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

async function withTx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

const DEFAULT_SETTINGS = {
  require_guardian_consent: true,
  require_deposit: false,
  deposit_amount: 0,
  mid_month_rule: 'daily',
  leave_require_guardian_otp: true,
  visitor_require_approval: true,
  allow_overnight_guests: false,
  rollcall_grace_minutes: 15,
  retention_gate_days: 365,
  retention_visitor_days: 365,
};

async function ensureSettings(pool, appId) {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await execQ(pool, `INSERT INTO school_hostel_setting (app_id, key, value) VALUES ($1,$2,$3::jsonb) ON CONFLICT (app_id, key) DO NOTHING`, [appId, key, JSON.stringify(value)]);
  }
}

async function getSetting(pool, appId, key, fallback) {
  const rows = await execQ(pool, 'SELECT value FROM school_hostel_setting WHERE app_id=$1 AND key=$2', [appId, key]);
  if (!rows[0]) return fallback;
  return rows[0].value === null || rows[0].value === undefined ? fallback : rows[0].value;
}

async function notify(pool, appId, data) {
  await execQ(pool, `
    INSERT INTO school_hostel_notification
      (app_id, kind, student_id, allocation_id, recipient_role, recipient, title, message, severity)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `, [appId, data.kind, data.studentId || null, data.allocationId || null, data.recipientRole || null, data.recipient || null, data.title, data.message || null, data.severity || 'info']);
}

async function refreshRoom(client, appId, roomId) {
  const occ = await client.query(`SELECT count(*)::int AS n FROM school_hostel_bed WHERE app_id=$1 AND room_id=$2 AND status='occupied' AND deleted_at IS NULL`, [appId, roomId]);
  await client.query(`
    UPDATE school_hostel_room
       SET status = CASE
         WHEN status IN ('maintenance', 'closed') THEN status
         WHEN $3::int >= capacity THEN 'full'
         WHEN $3::int > 0 THEN 'occupied'
         ELSE 'available'
       END,
       updated_at = now()
     WHERE app_id=$1 AND id=$2
  `, [appId, roomId, occ.rows[0].n]);
}

async function ensureFeeHead(client, appId, name, type) {
  const found = await client.query('SELECT id FROM school_fee_head WHERE app_id=$1 AND name=$2 AND deleted_at IS NULL ORDER BY id LIMIT 1', [appId, name]);
  if (found.rows[0]) return found.rows[0].id;
  const created = await client.query(`
    INSERT INTO school_fee_head (app_id, name, type, is_active)
    VALUES ($1,$2,$3,true) RETURNING id
  `, [appId, name, type]);
  return created.rows[0].id;
}

/* ---- date and billing helpers ---- */
const parseDay = (v) => {
  if (!v) return null;
  const s = dayOf(v);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysInclusive = (a, b) => Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
function monthSegments(start, end) {
  const out = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const s = monthStart < start ? start : monthStart;
    const e = monthEnd > end ? end : monthEnd;
    if (s <= e) out.push({ start: s, end: e, days: daysInclusive(s, e), dim: monthEnd.getDate() });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}
function monthlyForSegments(monthly, segments) {
  return round2(segments.reduce((sum, s) => sum + (Number(monthly) || 0) * (s.days / s.dim), 0));
}
function ruleMonthly(row) {
  const amount = Number(row.rule_amount) || 0;
  if (!amount) return 0;
  const freq = row.rule_frequency || 'monthly';
  if (freq === 'annual') return round2(amount / 12);
  if (freq === 'term') return round2(amount / 4);
  if (freq === 'one_time') {
    const from = row.rule_from ? dayOf(row.rule_from) : null;
    const start = dayOf(row.period_start);
    const end = dayOf(row.period_end);
    return from && from >= start && from <= end ? amount : 0;
  }
  return amount;
}

/* ============================================================
   1. Dashboard and physical layout
   ============================================================ */
hostelRouter.get('/hostel/dashboard', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  await ensureSettings(pool, appId);
  const [summary] = await execQ(pool, `
    SELECT
      (SELECT count(*)::int FROM school_hostel WHERE app_id=$1 AND deleted_at IS NULL) AS hostels,
      (SELECT count(*)::int FROM school_hostel_room WHERE app_id=$1 AND deleted_at IS NULL) AS rooms,
      (SELECT count(*)::int FROM school_hostel_bed WHERE app_id=$1 AND deleted_at IS NULL) AS beds,
      (SELECT count(*)::int FROM school_hostel_bed WHERE app_id=$1 AND status='occupied' AND deleted_at IS NULL) AS occupied,
      (SELECT count(*)::int FROM school_hostel_bed WHERE app_id=$1 AND status='vacant' AND deleted_at IS NULL) AS vacant,
      (SELECT count(*)::int FROM school_hostel_bed WHERE app_id=$1 AND status='reserved' AND deleted_at IS NULL) AS reserved,
      (SELECT count(*)::int FROM school_hostel_bed WHERE app_id=$1 AND status='maintenance' AND deleted_at IS NULL) AS maintenance,
      (SELECT count(*)::int FROM school_hostel_maintenance WHERE app_id=$1 AND status IN ('open','in_progress')) AS open_requests,
      (SELECT count(*)::int FROM school_hostel_visitor_entry WHERE app_id=$1 AND status='checked_in') AS open_visits,
      (SELECT count(*)::int FROM school_hostel_waitlist WHERE app_id=$1 AND status='waiting') AS waiting
  `, [appId]);
  res.json({ ok: true, summary });
}));

hostelRouter.get('/hostel/hostels', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT h.*, s.name AS chief_warden_name,
      (SELECT count(*)::int FROM school_hostel_room r WHERE r.app_id=h.app_id AND r.hostel_id=h.id AND r.deleted_at IS NULL) AS room_count,
      (SELECT count(*)::int FROM school_hostel_bed b JOIN school_hostel_room r ON r.id=b.room_id WHERE r.app_id=h.app_id AND r.hostel_id=h.id AND b.deleted_at IS NULL) AS bed_count,
      (SELECT count(*)::int FROM school_hostel_allocation a WHERE a.app_id=h.app_id AND a.hostel_id=h.id AND a.status='active' AND a.deleted_at IS NULL) AS resident_count
      FROM school_hostel h
      LEFT JOIN school_staff s ON s.id=h.chief_warden_staff_id
     WHERE h.app_id=$1 AND h.deleted_at IS NULL
     ORDER BY h.name
  `, [appIdOf(req)]);
  res.json({ ok: true, hostels: rows });
}));

hostelRouter.post('/hostel/hostels', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  if (!text(b.name)) fail(400, 'Hostel name is required');
  const type = ['boys', 'girls', 'coed'].includes(text(b.type)) ? text(b.type) : 'boys';
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel (app_id, name, type, campus_id, address, phone, chief_warden_staff_id, capacity, status, notes, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
  `, [appIdOf(req), text(b.name), type, num(b.campusId), text(b.address), text(b.phone), num(b.chiefWardenStaffId), num(b.capacity) || 0, text(b.status) || 'active', text(b.notes), userOf(req)]);
  await writeAudit(getPool(), req, { action: 'hostel.create', entity: 'school_hostel', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, hostel: rows[0] });
}));

hostelRouter.put('/hostel/hostels/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const before = (await execQ(getPool(), 'SELECT * FROM school_hostel WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appIdOf(req), id]))[0];
  if (!before) fail(404, 'Hostel not found');
  const rows = await execQ(getPool(), `
    UPDATE school_hostel SET name=$3, type=$4, campus_id=$5, address=$6, phone=$7,
      chief_warden_staff_id=$8, capacity=$9, status=$10, notes=$11, updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.name) || before.name, text(b.type) || before.type, num(b.campusId), text(b.address), text(b.phone), num(b.chiefWardenStaffId), num(b.capacity) ?? before.capacity, text(b.status) || before.status, text(b.notes)]);
  await writeAudit(getPool(), req, { action: 'hostel.update', entity: 'school_hostel', entityId: id, before, after: rows[0] });
  res.json({ ok: true, hostel: rows[0] });
}));

hostelRouter.delete('/hostel/hostels/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const active = await execQ(getPool(), `SELECT count(*)::int AS n FROM school_hostel_allocation WHERE app_id=$1 AND hostel_id=$2 AND status IN ('active','reserved') AND deleted_at IS NULL`, [appId, id]);
  if (active[0].n) fail(400, 'Hostel has active residents; vacate or move them first');
  const rows = await execQ(getPool(), 'UPDATE school_hostel SET deleted_at=now(), status=\'inactive\' WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appId, id]);
  if (!rows[0]) fail(404, 'Hostel not found');
  await writeAudit(getPool(), req, { action: 'hostel.delete', entity: 'school_hostel', entityId: id });
  res.json({ ok: true });
}));

hostelRouter.get('/hostel/blocks', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const hostelId = num(req.query.hostelId);
  const rows = await execQ(getPool(), `
    SELECT b.*, h.name AS hostel_name, s.name AS warden_name,
      (SELECT count(*)::int FROM school_hostel_floor f WHERE f.block_id=b.id AND f.deleted_at IS NULL) AS floor_count
      FROM school_hostel_block b
      JOIN school_hostel h ON h.id=b.hostel_id
      LEFT JOIN school_staff s ON s.id=b.warden_staff_id
     WHERE b.app_id=$1 AND b.deleted_at IS NULL AND ($2::int IS NULL OR b.hostel_id=$2)
     ORDER BY h.name, b.name
  `, [appIdOf(req), hostelId]);
  res.json({ ok: true, blocks: rows });
}));

hostelRouter.post('/hostel/blocks', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  if (!num(b.hostelId) || !text(b.name)) fail(400, 'Hostel and block name are required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_block (app_id, hostel_id, name, warden_staff_id, status, notes)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [appIdOf(req), num(b.hostelId), text(b.name), num(b.wardenStaffId), text(b.status) || 'active', text(b.notes)]);
  await writeAudit(getPool(), req, { action: 'hostel.block.create', entity: 'school_hostel_block', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, block: rows[0] });
}));

hostelRouter.put('/hostel/blocks/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const before = (await execQ(getPool(), 'SELECT * FROM school_hostel_block WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appIdOf(req), id]))[0];
  if (!before) fail(404, 'Block not found');
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_block SET name=$3, warden_staff_id=$4, status=$5, notes=$6, updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.name) || before.name, num(b.wardenStaffId), text(b.status) || before.status, text(b.notes)]);
  await writeAudit(getPool(), req, { action: 'hostel.block.update', entity: 'school_hostel_block', entityId: id, before, after: rows[0] });
  res.json({ ok: true, block: rows[0] });
}));

hostelRouter.delete('/hostel/blocks/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rooms = await execQ(getPool(), 'SELECT count(*)::int AS n FROM school_hostel_room WHERE app_id=$1 AND block_id=$2 AND deleted_at IS NULL', [appId, id]);
  if (rooms[0].n) fail(400, 'Block has rooms; delete or move them first');
  const rows = await execQ(getPool(), 'UPDATE school_hostel_block SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appId, id]);
  if (!rows[0]) fail(404, 'Block not found');
  res.json({ ok: true });
}));

hostelRouter.get('/hostel/floors', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const blockId = num(req.query.blockId);
  const rows = await execQ(getPool(), `
    SELECT f.*, b.name AS block_name, h.id AS hostel_id, h.name AS hostel_name
      FROM school_hostel_floor f
      JOIN school_hostel_block b ON b.id=f.block_id
      JOIN school_hostel h ON h.id=b.hostel_id
     WHERE f.app_id=$1 AND f.deleted_at IS NULL AND ($2::int IS NULL OR f.block_id=$2)
     ORDER BY h.name, b.name, f.level, f.name
  `, [appIdOf(req), blockId]);
  res.json({ ok: true, floors: rows });
}));

hostelRouter.post('/hostel/floors', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  if (!num(b.blockId) || !text(b.name)) fail(400, 'Block and floor name are required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_floor (app_id, block_id, name, level, status)
    VALUES ($1,$2,$3,$4,$5) RETURNING *
  `, [appIdOf(req), num(b.blockId), text(b.name), num(b.level) || 0, text(b.status) || 'active']);
  res.json({ ok: true, floor: rows[0] });
}));

hostelRouter.put('/hostel/floors/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_floor SET name=coalesce($3,name), level=coalesce($4,level), status=coalesce($5,status), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.name), num(b.level), text(b.status)]);
  if (!rows[0]) fail(404, 'Floor not found');
  res.json({ ok: true, floor: rows[0] });
}));

hostelRouter.delete('/hostel/floors/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rooms = await execQ(getPool(), 'SELECT count(*)::int AS n FROM school_hostel_room WHERE app_id=$1 AND floor_id=$2 AND deleted_at IS NULL', [appId, id]);
  if (rooms[0].n) fail(400, 'Floor has rooms; delete or move them first');
  const rows = await execQ(getPool(), 'UPDATE school_hostel_floor SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appId, id]);
  if (!rows[0]) fail(404, 'Floor not found');
  res.json({ ok: true });
}));

hostelRouter.get('/hostel/rooms', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const hostelId = num(req.query.hostelId);
  const blockId = num(req.query.blockId);
  const floorId = num(req.query.floorId);
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `
    SELECT r.*, h.name AS hostel_name, h.type AS hostel_type, b.name AS block_name, f.name AS floor_name,
      (SELECT count(*)::int FROM school_hostel_bed bd WHERE bd.room_id=r.id AND bd.deleted_at IS NULL) AS bed_count,
      (SELECT count(*)::int FROM school_hostel_bed bd WHERE bd.room_id=r.id AND bd.status='occupied' AND bd.deleted_at IS NULL) AS occupied
      FROM school_hostel_room r
      JOIN school_hostel h ON h.id=r.hostel_id
      LEFT JOIN school_hostel_block b ON b.id=r.block_id
      LEFT JOIN school_hostel_floor f ON f.id=r.floor_id
     WHERE r.app_id=$1 AND r.deleted_at IS NULL
       AND ($2::int IS NULL OR r.hostel_id=$2)
       AND ($3::int IS NULL OR r.block_id=$3)
       AND ($4::int IS NULL OR r.floor_id=$4)
       AND ($5::text IS NULL OR r.status=$5)
     ORDER BY h.name, f.level, r.number
  `, [appIdOf(req), hostelId, blockId, floorId, status]);
  res.json({ ok: true, rooms: rows });
}));

hostelRouter.post('/hostel/rooms', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  if (!num(b.hostelId) || !text(b.number)) fail(400, 'Hostel and room number are required');
  const capacity = Math.max(1, num(b.capacity) || 1);
  const result = await withTx(async (client) => {
    const room = await client.query(`
      INSERT INTO school_hostel_room (app_id, hostel_id, block_id, floor_id, number, room_type, capacity, amenities, status, fee_category, is_accessible, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9,$10,$11,$12) RETURNING *
    `, [appId, num(b.hostelId), num(b.blockId), num(b.floorId), text(b.number), text(b.roomType) || 'double', capacity,
      Array.isArray(b.amenities) ? b.amenities : [], text(b.status) || 'available', text(b.feeCategory), bool(b.isAccessible), text(b.notes)]);
    await client.query(`INSERT INTO school_hostel_bed (app_id, room_id, bed_no) SELECT $1,$2,gs::text FROM generate_series(1,$3) gs`, [appId, room.rows[0].id, capacity]);
    return room.rows[0];
  });
  await writeAudit(getPool(), req, { action: 'hostel.room.create', entity: 'school_hostel_room', entityId: result.id, after: result });
  res.json({ ok: true, room: result });
}));

hostelRouter.post('/hostel/rooms/bulk', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  const from = num(b.fromNumber);
  const to = num(b.toNumber);
  if (!num(b.hostelId) || from === null || to === null || to < from) fail(400, 'Hostel and a valid number range are required');
  if (to - from > 200) fail(400, 'Create at most 200 rooms at a time');
  const capacity = Math.max(1, num(b.capacity) || 1);
  const prefix = text(b.prefix) || '';
  const created = await withTx(async (client) => {
    const out = [];
    for (let n = from; n <= to; n += 1) {
      const number = `${prefix}${n}`;
      const room = await client.query(`
        INSERT INTO school_hostel_room (app_id, hostel_id, block_id, floor_id, number, room_type, capacity, status, fee_category)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'available',$8)
        ON CONFLICT (app_id, hostel_id, number) WHERE deleted_at IS NULL DO NOTHING RETURNING *
      `, [appId, num(b.hostelId), num(b.blockId), num(b.floorId), number, text(b.roomType) || 'double', capacity, text(b.feeCategory)]);
      if (room.rows[0]) {
        await client.query(`INSERT INTO school_hostel_bed (app_id, room_id, bed_no) SELECT $1,$2,gs::text FROM generate_series(1,$3) gs ON CONFLICT (room_id, bed_no) DO NOTHING`, [appId, room.rows[0].id, capacity]);
        out.push(room.rows[0]);
      }
    }
    return out;
  });
  await writeAudit(getPool(), req, { action: 'hostel.room.bulk', entity: 'school_hostel_room', entityId: null, after: { count: created.length } });
  res.json({ ok: true, created: created.length, rooms: created });
}));

hostelRouter.get('/hostel/rooms/:id', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const room = (await execQ(getPool(), `
    SELECT r.*, h.name AS hostel_name, h.type AS hostel_type, b.name AS block_name, f.name AS floor_name
      FROM school_hostel_room r
      JOIN school_hostel h ON h.id=r.hostel_id
      LEFT JOIN school_hostel_block b ON b.id=r.block_id
      LEFT JOIN school_hostel_floor f ON f.id=r.floor_id
     WHERE r.app_id=$1 AND r.id=$2 AND r.deleted_at IS NULL
  `, [appId, id]))[0];
  if (!room) fail(404, 'Room not found');
  const [beds, occupants, assets, inspections, maintenance] = await Promise.all([
    execQ(getPool(), 'SELECT * FROM school_hostel_bed WHERE app_id=$1 AND room_id=$2 AND deleted_at IS NULL ORDER BY bed_no', [appId, id]),
    execQ(getPool(), `SELECT a.*, s.admission_no, s.first_name, s.last_name, s.gender FROM school_hostel_allocation a JOIN school_students s ON s.id=a.student_id WHERE a.app_id=$1 AND a.room_id=$2 AND a.status IN ('active','reserved') AND a.deleted_at IS NULL ORDER BY s.first_name`, [appId, id]),
    execQ(getPool(), `SELECT ra.*, ast.tag_no, it.name AS asset_name FROM school_hostel_room_asset ra LEFT JOIN school_inv_asset ast ON ast.id=ra.asset_id LEFT JOIN school_inv_item it ON it.id=ast.item_id WHERE ra.app_id=$1 AND ra.room_id=$2 ORDER BY ra.id`, [appId, id]),
    execQ(getPool(), 'SELECT * FROM school_hostel_room_inspection WHERE app_id=$1 AND room_id=$2 ORDER BY inspection_date DESC LIMIT 20', [appId, id]),
    execQ(getPool(), 'SELECT * FROM school_hostel_maintenance WHERE app_id=$1 AND room_id=$2 ORDER BY reported_at DESC LIMIT 20', [appId, id]),
  ]);
  res.json({ ok: true, room, beds, occupants, assets, inspections, maintenance });
}));

hostelRouter.put('/hostel/rooms/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  const result = await withTx(async (client) => {
    const found = await client.query('SELECT * FROM school_hostel_room WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE', [appId, id]);
    const before = found.rows[0];
    if (!before) fail(404, 'Room not found');
    const capacity = num(b.capacity) ?? before.capacity;
    const occupied = await client.query(`SELECT count(*)::int AS n FROM school_hostel_bed WHERE app_id=$1 AND room_id=$2 AND status IN ('occupied','reserved') AND deleted_at IS NULL`, [appId, id]);
    if (capacity < occupied.rows[0].n) fail(400, `Capacity cannot be below current occupancy (${occupied.rows[0].n})`);
    const room = await client.query(`
      UPDATE school_hostel_room SET block_id=coalesce($3,block_id), floor_id=coalesce($4,floor_id), number=coalesce($5,number),
        room_type=coalesce($6,room_type), capacity=$7, amenities=coalesce($8::text[],amenities), status=coalesce($9,status),
        fee_category=coalesce($10,fee_category), is_accessible=coalesce($11,is_accessible), notes=coalesce($12,notes), updated_at=now()
       WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, id, num(b.blockId), num(b.floorId), text(b.number), text(b.roomType), capacity,
      Array.isArray(b.amenities) ? b.amenities : null, text(b.status), text(b.feeCategory),
      b.isAccessible === undefined ? null : bool(b.isAccessible), text(b.notes)]);
    if (capacity > before.capacity) {
      await client.query(`INSERT INTO school_hostel_bed (app_id, room_id, bed_no) SELECT $1,$2,gs::text FROM generate_series($3,$4) gs ON CONFLICT (room_id, bed_no) DO NOTHING`, [appId, id, before.capacity + 1, capacity]);
    } else if (capacity < before.capacity) {
      await client.query(`DELETE FROM school_hostel_bed WHERE app_id=$1 AND room_id=$2 AND status='vacant' AND bed_no ~ '^[0-9]+$' AND bed_no::int > $3`, [appId, id, capacity]);
    }
    await refreshRoom(client, appId, id);
    return { before, room: room.rows[0] };
  });
  await writeAudit(getPool(), req, { action: 'hostel.room.update', entity: 'school_hostel_room', entityId: id, before: result.before, after: result.room });
  res.json({ ok: true, room: result.room });
}));

hostelRouter.delete('/hostel/rooms/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const active = await execQ(getPool(), `SELECT count(*)::int AS n FROM school_hostel_allocation WHERE app_id=$1 AND room_id=$2 AND status IN ('active','reserved') AND deleted_at IS NULL`, [appId, id]);
  if (active[0].n) fail(400, 'Room has active residents; vacate or move them first');
  const rows = await execQ(getPool(), 'UPDATE school_hostel_room SET deleted_at=now(), status=\'closed\' WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appId, id]);
  if (!rows[0]) fail(404, 'Room not found');
  await execQ(getPool(), 'UPDATE school_hostel_bed SET deleted_at=now() WHERE app_id=$1 AND room_id=$2', [appId, id]);
  await writeAudit(getPool(), req, { action: 'hostel.room.delete', entity: 'school_hostel_room', entityId: id });
  res.json({ ok: true });
}));

hostelRouter.put('/hostel/rooms/:id/status', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const status = text(req.body?.status);
  if (!['available', 'occupied', 'full', 'maintenance', 'closed'].includes(status)) fail(400, 'Invalid room status');
  if (status === 'maintenance' || status === 'closed') {
    const active = await execQ(getPool(), `SELECT count(*)::int AS n FROM school_hostel_allocation WHERE app_id=$1 AND room_id=$2 AND status IN ('active','reserved') AND deleted_at IS NULL`, [appId, id]);
    if (active[0].n) fail(400, 'Move residents out before closing the room');
  }
  const rows = await execQ(getPool(), 'UPDATE school_hostel_room SET status=$3, updated_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *', [appId, id, status]);
  if (!rows[0]) fail(404, 'Room not found');
  await writeAudit(getPool(), req, { action: 'hostel.room.status', entity: 'school_hostel_room', entityId: id, after: rows[0] });
  res.json({ ok: true, room: rows[0] });
}));

hostelRouter.get('/hostel/beds', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const roomId = num(req.query.roomId);
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `
    SELECT bd.*, r.number AS room_number, r.hostel_id, h.name AS hostel_name
      FROM school_hostel_bed bd
      JOIN school_hostel_room r ON r.id=bd.room_id
      JOIN school_hostel h ON h.id=r.hostel_id
     WHERE bd.app_id=$1 AND bd.deleted_at IS NULL
       AND ($2::int IS NULL OR bd.room_id=$2)
       AND ($3::text IS NULL OR bd.status=$3)
     ORDER BY h.name, r.number, bd.bed_no
  `, [appIdOf(req), roomId, status]);
  res.json({ ok: true, beds: rows });
}));

hostelRouter.post('/hostel/beds', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  if (!num(b.roomId) || !text(b.bedNo)) fail(400, 'Room and bed number are required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_bed (app_id, room_id, bed_no, status, notes)
    VALUES ($1,$2,$3,$4,$5) RETURNING *
  `, [appIdOf(req), num(b.roomId), text(b.bedNo), text(b.status) || 'vacant', text(b.notes)]);
  res.json({ ok: true, bed: rows[0] });
}));

hostelRouter.put('/hostel/beds/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const appId = appIdOf(req);
  if (text(b.status) === 'maintenance') {
    const active = await execQ(getPool(), `SELECT count(*)::int AS n FROM school_hostel_allocation WHERE app_id=$1 AND bed_id=$2 AND status IN ('active','reserved') AND deleted_at IS NULL`, [appId, id]);
    if (active[0].n) fail(400, 'Move the resident out before marking the bed under maintenance');
  }
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_bed SET bed_no=coalesce($3,bed_no), status=coalesce($4,status), notes=coalesce($5,notes), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appId, id, text(b.bedNo), text(b.status), text(b.notes)]);
  if (!rows[0]) fail(404, 'Bed not found');
  await refreshRoom(getPool(), appId, rows[0].room_id);
  res.json({ ok: true, bed: rows[0] });
}));

hostelRouter.delete('/hostel/beds/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const active = await execQ(getPool(), `SELECT count(*)::int AS n FROM school_hostel_allocation WHERE app_id=$1 AND bed_id=$2 AND status IN ('active','reserved') AND deleted_at IS NULL`, [appId, id]);
  if (active[0].n) fail(400, 'Bed is allocated; move the resident first');
  const rows = await execQ(getPool(), 'UPDATE school_hostel_bed SET deleted_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING room_id', [appId, id]);
  if (!rows[0]) fail(404, 'Bed not found');
  res.json({ ok: true });
}));

hostelRouter.get('/hostel/layout', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const [hostels, blocks, floors, rooms, beds] = await Promise.all([
    execQ(getPool(), 'SELECT * FROM school_hostel WHERE app_id=$1 AND deleted_at IS NULL ORDER BY name', [appId]),
    execQ(getPool(), 'SELECT * FROM school_hostel_block WHERE app_id=$1 AND deleted_at IS NULL ORDER BY name', [appId]),
    execQ(getPool(), 'SELECT * FROM school_hostel_floor WHERE app_id=$1 AND deleted_at IS NULL ORDER BY level, name', [appId]),
    execQ(getPool(), 'SELECT * FROM school_hostel_room WHERE app_id=$1 AND deleted_at IS NULL ORDER BY number', [appId]),
    execQ(getPool(), 'SELECT * FROM school_hostel_bed WHERE app_id=$1 AND deleted_at IS NULL ORDER BY bed_no', [appId]),
  ]);
  const tree = hostels.map((h) => ({
    ...h,
    blocks: blocks.filter((b) => b.hostel_id === h.id).map((b) => ({
      ...b,
      floors: floors.filter((f) => f.block_id === b.id).map((f) => ({
        ...f,
        rooms: rooms.filter((r) => r.floor_id === f.id).map((r) => ({ ...r, beds: beds.filter((bd) => bd.room_id === r.id) })),
      })),
      rooms: rooms.filter((r) => r.block_id === b.id && !r.floor_id).map((r) => ({ ...r, beds: beds.filter((bd) => bd.room_id === r.id) })),
    })),
    rooms: rooms.filter((r) => r.hostel_id === h.id && !r.block_id).map((r) => ({ ...r, beds: beds.filter((bd) => bd.room_id === r.id) })),
  }));
  res.json({ ok: true, tree, hostels, blocks, floors, rooms, beds });
}));

hostelRouter.get('/hostel/inspections', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const roomId = num(req.query.roomId);
  const rows = await execQ(getPool(), `
    SELECT i.*, r.number AS room_number, h.name AS hostel_name
      FROM school_hostel_room_inspection i
      JOIN school_hostel_room r ON r.id=i.room_id
      JOIN school_hostel h ON h.id=r.hostel_id
     WHERE i.app_id=$1 AND ($2::int IS NULL OR i.room_id=$2)
     ORDER BY i.inspection_date DESC, i.id DESC LIMIT 200
  `, [appIdOf(req), roomId]);
  res.json({ ok: true, inspections: rows });
}));

hostelRouter.post('/hostel/inspections', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  if (!num(b.roomId)) fail(400, 'Room is required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_room_inspection (app_id, room_id, inspection_date, inspected_by, condition, findings, damage_amount)
    VALUES ($1,$2,coalesce($3,current_date),$4,$5,$6,$7) RETURNING *
  `, [appIdOf(req), num(b.roomId), dayOf(b.inspectionDate), text(b.inspectedBy) || userOf(req), text(b.condition) || 'good', text(b.findings), num(b.damageAmount) || 0]);
  await writeAudit(getPool(), req, { action: 'hostel.inspection.create', entity: 'school_hostel_room_inspection', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, inspection: rows[0] });
}));

hostelRouter.get('/hostel/maintenance', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `
    SELECT m.*, r.number AS room_number, h.name AS hostel_name
      FROM school_hostel_maintenance m
      JOIN school_hostel_room r ON r.id=m.room_id
      JOIN school_hostel h ON h.id=r.hostel_id
     WHERE m.app_id=$1 AND ($2::text IS NULL OR m.status=$2)
     ORDER BY m.reported_at DESC LIMIT 200
  `, [appIdOf(req), status]);
  res.json({ ok: true, requests: rows });
}));

hostelRouter.post('/hostel/maintenance', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  if (!num(b.roomId) || !text(b.issue)) fail(400, 'Room and issue are required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_maintenance (app_id, room_id, issue, reported_by, status, cost, vendor, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [appIdOf(req), num(b.roomId), text(b.issue), text(b.reportedBy) || userOf(req), text(b.status) || 'open', num(b.cost) || 0, text(b.vendor), text(b.notes)]);
  res.json({ ok: true, request: rows[0] });
}));

hostelRouter.put('/hostel/maintenance/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_maintenance SET status=coalesce($3,status), cost=coalesce($4,cost), vendor=coalesce($5,vendor),
      notes=coalesce($6,notes), resolved_at=CASE WHEN $3='resolved' THEN now() ELSE resolved_at END, updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), id, text(b.status), num(b.cost), text(b.vendor), text(b.notes)]);
  if (!rows[0]) fail(404, 'Maintenance request not found');
  await writeAudit(getPool(), req, { action: 'hostel.maintenance.update', entity: 'school_hostel_maintenance', entityId: id, after: rows[0] });
  res.json({ ok: true, request: rows[0] });
}));

hostelRouter.get('/hostel/room-assets', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const roomId = num(req.query.roomId);
  const rows = await execQ(getPool(), `
    SELECT ra.*, r.number AS room_number, h.name AS hostel_name, ast.tag_no, it.name AS asset_name
      FROM school_hostel_room_asset ra
      JOIN school_hostel_room r ON r.id=ra.room_id
      JOIN school_hostel h ON h.id=r.hostel_id
      LEFT JOIN school_inv_asset ast ON ast.id=ra.asset_id
      LEFT JOIN school_inv_item it ON it.id=ast.item_id
     WHERE ra.app_id=$1 AND ($2::int IS NULL OR ra.room_id=$2)
     ORDER BY ra.id DESC
  `, [appIdOf(req), roomId]);
  res.json({ ok: true, assets: rows });
}));

hostelRouter.post('/hostel/room-assets', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const b = req.body || {};
  if (!num(b.roomId)) fail(400, 'Room is required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_room_asset (app_id, room_id, asset_id, quantity, condition, issued_at, notes)
    VALUES ($1,$2,$3,$4,$5,coalesce($6,current_date),$7) RETURNING *
  `, [appIdOf(req), num(b.roomId), num(b.assetId), num(b.quantity) || 1, text(b.condition) || 'good', dayOf(b.issuedAt), text(b.notes)]);
  if (num(b.assetId)) await execQ(getPool(), 'UPDATE school_inv_asset SET room_id=$3 WHERE app_id=$1 AND id=$2', [appIdOf(req), num(b.assetId), num(b.roomId)]);
  res.json({ ok: true, asset: rows[0] });
}));

/* ============================================================
   2. Applications, allocation, room change, vacate and deposits
   ============================================================ */
function genderAllowed(studentGender, hostelType) {
  const g = String(studentGender || '').toLowerCase();
  if (hostelType === 'coed') return true;
  if (hostelType === 'boys') return ['male', 'm', 'boy'].includes(g);
  if (hostelType === 'girls') return ['female', 'f', 'girl'].includes(g);
  return true;
}

hostelRouter.get('/hostel/students', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const q = text(req.query.q);
  const rows = await execQ(getPool(), `
    SELECT s.id, s.admission_no, s.first_name, s.last_name, s.gender, s.status, c.name AS class_name,
      a.id AS allocation_id, a.status AS allocation_status, h.name AS hostel_name, r.number AS room_number, bd.bed_no
      FROM school_students s
      LEFT JOIN school_classes c ON c.id=s.class_id
      LEFT JOIN school_hostel_allocation a ON a.app_id=s.app_id AND a.student_id=s.id AND a.status IN ('active','reserved') AND a.deleted_at IS NULL
      LEFT JOIN school_hostel h ON h.id=a.hostel_id
      LEFT JOIN school_hostel_room r ON r.id=a.room_id
      LEFT JOIN school_hostel_bed bd ON bd.id=a.bed_id
     WHERE s.app_id=$1 AND s.deleted_at IS NULL AND s.status='active'
       AND ($2::text IS NULL OR $2='' OR s.admission_no ILIKE '%'||$2||'%' OR s.first_name ILIKE '%'||$2||'%' OR s.last_name ILIKE '%'||$2||'%' OR s.guardian_phone ILIKE '%'||$2||'%')
     ORDER BY s.first_name, s.last_name LIMIT 100
  `, [appIdOf(req), q]);
  res.json({ ok: true, students: rows });
}));

hostelRouter.get('/hostel/applications', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `
    SELECT a.*, s.admission_no, s.first_name, s.last_name, s.gender, c.name AS class_name,
      h.name AS requested_hostel_name
      FROM school_hostel_application a
      JOIN school_students s ON s.id=a.student_id
      LEFT JOIN school_classes c ON c.id=s.class_id
      LEFT JOIN school_hostel h ON h.id=a.requested_hostel_id
     WHERE a.app_id=$1 AND a.deleted_at IS NULL AND ($2::text IS NULL OR a.status=$2)
     ORDER BY a.applied_at DESC, a.id DESC LIMIT 300
  `, [appIdOf(req), status]);
  res.json({ ok: true, applications: rows });
}));

hostelRouter.post('/hostel/applications', route(async (req, res) => {
  if (!guard(req, res, 'hostel.allocate')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  if (!num(b.studentId)) fail(400, 'Student is required');
  const student = (await execQ(getPool(), 'SELECT * FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, num(b.studentId)]))[0];
  if (!student) fail(404, 'Student not found');
  if (student.status !== 'active') fail(400, 'Student is not active');
  const count = (await execQ(getPool(), 'SELECT count(*)::int AS n FROM school_hostel_application WHERE app_id=$1', [appId]))[0].n;
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_application (app_id, application_no, student_id, requested_hostel_id, requested_room_type, preferences, guardian_consent, consent_at, status, priority, applied_at, notes, created_by)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,'submitted',$9,coalesce($10,current_date),$11,$12) RETURNING *
  `, [appId, text(b.applicationNo) || nextNo('HA', count), num(b.studentId), num(b.requestedHostelId), text(b.requestedRoomType),
    JSON.stringify(b.preferences || {}), bool(b.guardianConsent), bool(b.guardianConsent) ? new Date() : null,
    num(b.priority) || 0, dayOf(b.appliedAt), text(b.notes), userOf(req)]);
  await notify(getPool(), appId, { kind: 'application.submitted', studentId: num(b.studentId), title: 'Hostel application submitted', message: `Application ${rows[0].application_no} received`, severity: 'info' });
  res.json({ ok: true, application: rows[0] });
}));

hostelRouter.post('/hostel/applications/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'hostel.allocate')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_application SET status='approved', approved_by=$3, approved_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL AND status IN ('submitted','waitlisted') RETURNING *
  `, [appId, id, userOf(req)]);
  if (!rows[0]) fail(404, 'Application not found or already decided');
  await notify(getPool(), appId, { kind: 'application.approved', studentId: rows[0].student_id, title: 'Hostel application approved', message: 'Your hostel application is approved', severity: 'info' });
  await writeAudit(getPool(), req, { action: 'hostel.application.approve', entity: 'school_hostel_application', entityId: id, after: rows[0] });
  res.json({ ok: true, application: rows[0] });
}));

hostelRouter.post('/hostel/applications/:id/reject', route(async (req, res) => {
  if (!guard(req, res, 'hostel.allocate')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_application SET status='rejected', rejection_reason=$3, approved_by=$4, approved_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL AND status IN ('submitted','waitlisted') RETURNING *
  `, [appId, id, text(req.body?.reason), userOf(req)]);
  if (!rows[0]) fail(404, 'Application not found or already decided');
  await writeAudit(getPool(), req, { action: 'hostel.application.reject', entity: 'school_hostel_application', entityId: id, after: rows[0] });
  res.json({ ok: true, application: rows[0] });
}));

hostelRouter.post('/hostel/applications/:id/waitlist', route(async (req, res) => {
  if (!guard(req, res, 'hostel.allocate')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const result = await withTx(async (client) => {
    const app = await client.query(`UPDATE school_hostel_application SET status='waitlisted', updated_at=now() WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL AND status IN ('submitted','approved') RETURNING *`, [appId, id]);
    if (!app.rows[0]) fail(404, 'Application not found or already decided');
    const wait = await client.query(`
      INSERT INTO school_hostel_waitlist (app_id, application_id, student_id, priority, requested_type, status, notes)
      VALUES ($1,$2,$3,$4,$5,'waiting',$6) RETURNING *
    `, [appId, id, app.rows[0].student_id, num(req.body?.priority) || app.rows[0].priority || 0, app.rows[0].requested_room_type, text(req.body?.notes)]);
    return { application: app.rows[0], waitlist: wait.rows[0] };
  });
  await writeAudit(getPool(), req, { action: 'hostel.application.waitlist', entity: 'school_hostel_application', entityId: id, after: result });
  res.json({ ok: true, ...result });
}));

hostelRouter.get('/hostel/waitlist', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT w.*, s.admission_no, s.first_name, s.last_name, s.gender, c.name AS class_name
      FROM school_hostel_waitlist w
      JOIN school_students s ON s.id=w.student_id
      LEFT JOIN school_classes c ON c.id=s.class_id
     WHERE w.app_id=$1 AND w.status IN ('waiting','offered')
     ORDER BY w.priority DESC, w.created_at
  `, [appIdOf(req)]);
  res.json({ ok: true, waitlist: rows });
}));

hostelRouter.get('/hostel/bed-suggestions', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const hostelId = num(req.query.hostelId);
  const gender = text(req.query.gender);
  const hostelType = gender === 'female' || gender === 'f' ? 'girls' : gender === 'male' || gender === 'm' ? 'boys' : null;
  const rows = await execQ(getPool(), `
    SELECT bd.id AS bed_id, bd.bed_no, r.id AS room_id, r.number AS room_number, r.room_type, r.capacity, r.fee_category,
      h.id AS hostel_id, h.name AS hostel_name, h.type AS hostel_type,
      (SELECT count(*)::int FROM school_hostel_bed x WHERE x.room_id=r.id AND x.status='occupied' AND x.deleted_at IS NULL) AS occupied
      FROM school_hostel_bed bd
      JOIN school_hostel_room r ON r.id=bd.room_id
      JOIN school_hostel h ON h.id=r.hostel_id
     WHERE bd.app_id=$1 AND bd.deleted_at IS NULL AND r.deleted_at IS NULL
       AND bd.status='vacant' AND r.status NOT IN ('maintenance','closed')
       AND ($2::int IS NULL OR h.id=$2)
       AND ($3::text IS NULL OR h.type='coed' OR h.type=$3)
       AND NOT EXISTS (SELECT 1 FROM school_hostel_allocation a WHERE a.app_id=$1 AND a.bed_id=bd.id AND a.status IN ('active','reserved') AND a.deleted_at IS NULL)
     ORDER BY h.name, r.number, bd.bed_no
     LIMIT 500
  `, [appId, hostelId, hostelType]);
  res.json({ ok: true, beds: rows });
}));

hostelRouter.get('/hostel/allocations', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const studentId = num(req.query.studentId);
  const rows = await execQ(getPool(), `
    SELECT a.*, s.admission_no, s.first_name, s.last_name, s.gender, c.name AS class_name,
      h.name AS hostel_name, h.type AS hostel_type, r.number AS room_number, bd.bed_no,
      d.amount AS deposit_amount, d.status AS deposit_record_status
      FROM school_hostel_allocation a
      JOIN school_students s ON s.id=a.student_id
      LEFT JOIN school_classes c ON c.id=s.class_id
      JOIN school_hostel h ON h.id=a.hostel_id
      JOIN school_hostel_room r ON r.id=a.room_id
      JOIN school_hostel_bed bd ON bd.id=a.bed_id
      LEFT JOIN school_hostel_deposit d ON d.allocation_id=a.id
     WHERE a.app_id=$1 AND a.deleted_at IS NULL
       AND ($2::text IS NULL OR a.status=$2)
       AND ($3::int IS NULL OR a.student_id=$3)
     ORDER BY a.created_at DESC, a.id DESC LIMIT 500
  `, [appIdOf(req), status, studentId]);
  res.json({ ok: true, allocations: rows });
}));

hostelRouter.post('/hostel/allocations', route(async (req, res) => {
  if (!guard(req, res, 'hostel.allocate')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  const studentId = num(b.studentId);
  const bedId = num(b.bedId);
  const status = text(b.status) === 'reserved' ? 'reserved' : 'active';
  if (!studentId || !bedId) fail(400, 'Student and bed are required');

  const data = await withTx(async (client) => {
    const student = (await client.query('SELECT * FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE', [appId, studentId])).rows[0];
    if (!student) fail(404, 'Student not found');
    if (student.status !== 'active') fail(400, 'Only active students can be allocated');

    const bed = (await client.query(`
      SELECT bd.*, r.capacity, r.status AS room_status, r.fee_category, r.number AS room_number,
        r.block_id, r.floor_id, h.id AS hostel_id, h.name AS hostel_name, h.type AS hostel_type
        FROM school_hostel_bed bd
        JOIN school_hostel_room r ON r.id=bd.room_id
        JOIN school_hostel h ON h.id=r.hostel_id
       WHERE bd.app_id=$1 AND bd.id=$2 AND bd.deleted_at IS NULL AND r.deleted_at IS NULL
       FOR UPDATE
    `, [appId, bedId])).rows[0];
    if (!bed) fail(404, 'Bed not found');
    if (bed.status === 'maintenance') fail(400, 'Bed is under maintenance');
    if (bed.status === 'occupied' || bed.status === 'reserved') fail(400, 'Bed is not vacant');
    if (['maintenance', 'closed'].includes(bed.room_status)) fail(400, 'Room is not available');
    if (!genderAllowed(student.gender, bed.hostel_type)) fail(400, `${bed.hostel_name} does not accept this student's gender`);

    const existing = await client.query(`SELECT id FROM school_hostel_allocation WHERE app_id=$1 AND student_id=$2 AND status IN ('active','reserved') AND deleted_at IS NULL`, [appId, studentId]);
    if (existing.rows[0]) fail(400, 'Student already has an active or reserved bed');

    const occ = await client.query(`SELECT count(*)::int AS n FROM school_hostel_allocation WHERE app_id=$1 AND room_id=$2 AND status IN ('active','reserved') AND deleted_at IS NULL`, [appId, bed.room_id]);
    if (occ.rows[0].n >= bed.capacity) fail(400, 'Room capacity is full');

    let consent = bool(b.guardianConsent);
    if (num(b.applicationId)) {
      const app = await client.query('SELECT * FROM school_hostel_application WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, num(b.applicationId)]);
      if (!app.rows[0]) fail(404, 'Application not found');
      consent = consent || bool(app.rows[0].guardian_consent);
    }
    const requireConsent = await getSetting(client, appId, 'require_guardian_consent', true);
    if (status === 'active' && requireConsent && !consent) fail(400, 'Guardian consent is required before check-in');

    const depositPaid = num(b.depositPaid) || 0;
    const requireDeposit = await getSetting(client, appId, 'require_deposit', false);
    const depositAmount = Number(await getSetting(client, appId, 'deposit_amount', 0)) || 0;
    if (status === 'active' && requireDeposit && depositPaid < depositAmount) fail(400, `Deposit of ${depositAmount} is required before check-in`);

    const allocation = (await client.query(`
      INSERT INTO school_hostel_allocation
        (app_id, student_id, application_id, hostel_id, block_id, floor_id, room_id, bed_id, from_date, to_date, status,
         deposit_paid, deposit_status, checkin_date, guardian_consent, consent_at, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9,current_date),$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *
    `, [appId, studentId, num(b.applicationId), bed.hostel_id, bed.block_id, bed.floor_id, bed.room_id, bedId,
      dayOf(b.fromDate), dayOf(b.toDate), status, depositPaid, depositPaid > 0 ? 'held' : 'pending',
      status === 'active' ? (dayOf(b.checkinDate) || dayOf(b.fromDate) || dayOf(new Date())) : null,
      consent, consent ? new Date() : null, text(b.notes), userOf(req)])).rows[0];

    await client.query('UPDATE school_hostel_bed SET status=$3, updated_at=now() WHERE app_id=$1 AND id=$2', [appId, bedId, status === 'active' ? 'occupied' : 'reserved']);
    if (depositPaid > 0) {
      await client.query(`
        INSERT INTO school_hostel_deposit (app_id, allocation_id, student_id, amount, status, held_at)
        VALUES ($1,$2,$3,$4,'held',coalesce($5,current_date))
        ON CONFLICT (allocation_id) DO UPDATE SET amount=EXCLUDED.amount, status='held', held_at=EXCLUDED.held_at
      `, [appId, allocation.id, studentId, depositPaid, dayOf(b.depositDate)]);
    }
    if (num(b.applicationId)) {
      await client.query(`UPDATE school_hostel_application SET status='allocated', updated_at=now() WHERE app_id=$1 AND id=$2`, [appId, num(b.applicationId)]);
    }
    await refreshRoom(client, appId, bed.room_id);
    return { allocation, student, bed };
  });

  await notify(getPool(), appId, { kind: 'allocation.created', studentId, allocationId: data.allocation.id, title: 'Hostel bed allocated', message: `${data.bed.hostel_name} room ${data.bed.room_number} bed ${data.bed.bed_no}`, severity: 'info' });
  await writeAudit(getPool(), req, { action: 'hostel.allocation.create', entity: 'school_hostel_allocation', entityId: data.allocation.id, after: data.allocation });
  res.json({ ok: true, allocation: data.allocation });
}));

hostelRouter.get('/hostel/allocations/:id', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const allocation = (await execQ(getPool(), `
    SELECT a.*, s.admission_no, s.first_name, s.last_name, s.gender, s.guardian_name, s.guardian_phone,
      h.name AS hostel_name, r.number AS room_number, bd.bed_no
      FROM school_hostel_allocation a
      JOIN school_students s ON s.id=a.student_id
      JOIN school_hostel h ON h.id=a.hostel_id
      JOIN school_hostel_room r ON r.id=a.room_id
      JOIN school_hostel_bed bd ON bd.id=a.bed_id
     WHERE a.app_id=$1 AND a.id=$2 AND a.deleted_at IS NULL
  `, [appId, id]))[0];
  if (!allocation) fail(404, 'Allocation not found');
  const [deposit, changes, vacates] = await Promise.all([
    execQ(getPool(), 'SELECT * FROM school_hostel_deposit WHERE app_id=$1 AND allocation_id=$2', [appId, id]),
    execQ(getPool(), 'SELECT * FROM school_hostel_room_change WHERE app_id=$1 AND allocation_id=$2 ORDER BY id DESC', [appId, id]),
    execQ(getPool(), 'SELECT * FROM school_hostel_vacate WHERE app_id=$1 AND allocation_id=$2 ORDER BY id DESC', [appId, id]),
  ]);
  res.json({ ok: true, allocation, deposit: deposit[0] || null, changes, vacates });
}));

hostelRouter.put('/hostel/allocations/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.allocate')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_allocation SET to_date=coalesce($3,to_date), notes=coalesce($4,notes),
      guardian_consent=coalesce($5,guardian_consent), consent_at=CASE WHEN $5=true THEN now() ELSE consent_at END, updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, dayOf(b.toDate), text(b.notes), b.guardianConsent === undefined ? null : bool(b.guardianConsent)]);
  if (!rows[0]) fail(404, 'Allocation not found');
  res.json({ ok: true, allocation: rows[0] });
}));

hostelRouter.post('/hostel/allocations/:id/change', route(async (req, res) => {
  if (!guard(req, res, 'hostel.allocate')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  const toBedId = num(b.toBedId);
  if (!toBedId) fail(400, 'New bed is required');
  const effectiveDate = dayOf(b.effectiveDate) || dayOf(new Date());

  const data = await withTx(async (client) => {
    const allocation = (await client.query(`SELECT * FROM school_hostel_allocation WHERE app_id=$1 AND id=$2 AND status IN ('active','reserved') AND deleted_at IS NULL FOR UPDATE`, [appId, id])).rows[0];
    if (!allocation) fail(404, 'Active allocation not found');
    if (allocation.bed_id === toBedId) fail(400, 'Student is already on this bed');
    const bed = (await client.query(`
      SELECT bd.*, r.capacity, r.status AS room_status, r.block_id, r.floor_id, h.id AS hostel_id, h.type AS hostel_type, h.name AS hostel_name
        FROM school_hostel_bed bd
        JOIN school_hostel_room r ON r.id=bd.room_id
        JOIN school_hostel h ON h.id=r.hostel_id
       WHERE bd.app_id=$1 AND bd.id=$2 AND bd.deleted_at IS NULL AND r.deleted_at IS NULL FOR UPDATE
    `, [appId, toBedId])).rows[0];
    if (!bed) fail(404, 'New bed not found');
    if (bed.status !== 'vacant') fail(400, 'New bed is not vacant');
    if (['maintenance', 'closed'].includes(bed.room_status)) fail(400, 'New room is not available');
    const student = (await client.query('SELECT * FROM school_students WHERE app_id=$1 AND id=$2', [appId, allocation.student_id])).rows[0];
    if (!genderAllowed(student.gender, bed.hostel_type)) fail(400, 'New hostel does not accept this student\'s gender');
    const occ = await client.query(`SELECT count(*)::int AS n FROM school_hostel_allocation WHERE app_id=$1 AND room_id=$2 AND status IN ('active','reserved') AND deleted_at IS NULL`, [appId, bed.room_id]);
    if (occ.rows[0].n >= bed.capacity) fail(400, 'New room is full');

    await client.query(`UPDATE school_hostel_allocation SET status='changed', to_date=$3, updated_at=now() WHERE app_id=$1 AND id=$2`, [appId, id, effectiveDate]);
    await client.query(`UPDATE school_hostel_bed SET status='vacant', updated_at=now() WHERE app_id=$1 AND id=$2`, [appId, allocation.bed_id]);

    const created = (await client.query(`
      INSERT INTO school_hostel_allocation
        (app_id, student_id, application_id, hostel_id, block_id, floor_id, room_id, bed_id, from_date, status,
         deposit_paid, deposit_status, checkin_date, guardian_consent, consent_at, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *
    `, [appId, allocation.student_id, allocation.application_id, bed.hostel_id, bed.block_id, bed.floor_id, bed.room_id, toBedId,
      effectiveDate, allocation.status, allocation.deposit_paid, allocation.deposit_status, allocation.checkin_date,
      allocation.guardian_consent, allocation.consent_at, text(b.reason), userOf(req)])).rows[0];

    await client.query('UPDATE school_hostel_bed SET status=$3, updated_at=now() WHERE app_id=$1 AND id=$2', [appId, toBedId, created.status === 'reserved' ? 'reserved' : 'occupied']);
    await client.query(`
      INSERT INTO school_hostel_room_change (app_id, allocation_id, from_bed_id, to_bed_id, reason, requested_by, approved_by, approved_at, effective_date, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8,'completed')
    `, [appId, id, allocation.bed_id, toBedId, text(b.reason), userOf(req), userOf(req), effectiveDate]);
    await refreshRoom(client, appId, allocation.room_id);
    await refreshRoom(client, appId, bed.room_id);
    return { allocation: created, previous: allocation, bed };
  });
  await writeAudit(getPool(), req, { action: 'hostel.allocation.change', entity: 'school_hostel_allocation', entityId: data.allocation.id, before: data.previous, after: data.allocation });
  res.json({ ok: true, allocation: data.allocation });
}));

hostelRouter.post('/hostel/allocations/:id/vacate', route(async (req, res) => {
  if (!guard(req, res, 'hostel.allocate')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  const vacateDate = dayOf(b.vacateDate) || dayOf(new Date());
  const data = await withTx(async (client) => {
    const allocation = (await client.query(`SELECT * FROM school_hostel_allocation WHERE app_id=$1 AND id=$2 AND status IN ('active','reserved') AND deleted_at IS NULL FOR UPDATE`, [appId, id])).rows[0];
    if (!allocation) fail(404, 'Active allocation not found');
    const vacate = (await client.query(`
      INSERT INTO school_hostel_vacate (app_id, allocation_id, vacate_date, reason, clearance, dues_cleared, assets_cleared, keys_returned, damage_amount, status)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,'pending') RETURNING *
    `, [appId, id, vacateDate, text(b.reason), JSON.stringify(b.clearance || {}), bool(b.duesCleared), bool(b.assetsCleared), bool(b.keysReturned), num(b.damageAmount) || 0])).rows[0];
    await client.query(`UPDATE school_hostel_allocation SET status='vacated', to_date=$3, checkout_date=$3, updated_at=now() WHERE app_id=$1 AND id=$2`, [appId, id, vacateDate]);
    await client.query(`UPDATE school_hostel_bed SET status='vacant', updated_at=now() WHERE app_id=$1 AND id=$2`, [appId, allocation.bed_id]);
    await refreshRoom(client, appId, allocation.room_id);
    return { vacate, allocation };
  });
  await notify(getPool(), appId, { kind: 'vacate.pending', studentId: data.allocation.student_id, allocationId: id, title: 'Clearance pending', message: 'Hostel vacating recorded; deposit settlement awaits clearance', severity: 'warning' });
  await writeAudit(getPool(), req, { action: 'hostel.vacate.start', entity: 'school_hostel_vacate', entityId: data.vacate.id, after: data.vacate });
  res.json({ ok: true, vacate: data.vacate });
}));

hostelRouter.post('/hostel/allocations/:id/clearance', route(async (req, res) => {
  if (!guard(req, res, 'hostel.allocate')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  const data = await withTx(async (client) => {
    const allocation = (await client.query('SELECT * FROM school_hostel_allocation WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE', [appId, id])).rows[0];
    if (!allocation) fail(404, 'Allocation not found');
    const vacate = (await client.query(`SELECT * FROM school_hostel_vacate WHERE app_id=$1 AND allocation_id=$2 AND status='pending' ORDER BY id DESC LIMIT 1 FOR UPDATE`, [appId, id])).rows[0];
    if (!vacate) fail(404, 'No pending vacate record');
    const dues = b.duesCleared === undefined ? vacate.dues_cleared : bool(b.duesCleared);
    const assets = b.assetsCleared === undefined ? vacate.assets_cleared : bool(b.assetsCleared);
    const keys = b.keysReturned === undefined ? vacate.keys_returned : bool(b.keysReturned);
    if (!dues || !assets || !keys) fail(400, 'Clearance is incomplete: dues, assets and keys must all be cleared');

    const deposit = (await client.query('SELECT * FROM school_hostel_deposit WHERE app_id=$1 AND allocation_id=$2 FOR UPDATE', [appId, id])).rows[0];
    const damage = num(b.damageAmount) ?? (Number(vacate.damage_amount) || 0);
    const depositAmount = deposit ? Number(deposit.amount) : Number(allocation.deposit_paid) || 0;
    const settlement = b.settlementAmount !== undefined ? (num(b.settlementAmount) || 0) : round2(Math.max(depositAmount - damage, 0));
    const depositStatus = ['refunded', 'adjusted', 'forfeited'].includes(text(b.depositStatus)) ? text(b.depositStatus) : 'refunded';

    const cleared = (await client.query(`
      UPDATE school_hostel_vacate SET dues_cleared=$3, assets_cleared=$4, keys_returned=$5, damage_amount=$6,
        deposit_settlement=$7, status='cleared', cleared_by=$8, cleared_at=now(), clearance=$9::jsonb, updated_at=now()
       WHERE app_id=$1 AND id=$2 RETURNING *
    `, [appId, vacate.id, dues, assets, keys, damage, settlement, userOf(req), JSON.stringify(b.clearance || {})])).rows[0];

    if (deposit) {
      await client.query(`UPDATE school_hostel_deposit SET status=$3, settled_at=coalesce($4,current_date), settlement_amount=$5, notes=coalesce($6,notes), updated_at=now() WHERE app_id=$1 AND id=$2`,
        [appId, deposit.id, depositStatus, dayOf(b.settledAt), settlement, text(b.notes)]);
    }
    await client.query(`UPDATE school_hostel_allocation SET deposit_status=$3, updated_at=now() WHERE app_id=$1 AND id=$2`, [appId, id, depositStatus]);
    return { vacate: cleared, depositStatus, settlement };
  });
  await writeAudit(getPool(), req, { action: 'hostel.vacate.clearance', entity: 'school_hostel_vacate', entityId: data.vacate.id, after: data.vacate });
  res.json({ ok: true, ...data });
}));

hostelRouter.get('/hostel/allocations/:id/deposit', route(async (req, res) => {
  if (!guardView(req, res, 'hostel.fees')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_hostel_deposit WHERE app_id=$1 AND allocation_id=$2', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, deposit: rows[0] || null });
}));

hostelRouter.put('/hostel/allocations/:id/deposit', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  const status = text(b.status) || 'held';
  if (!['pending', 'held', 'adjusted', 'refunded', 'forfeited'].includes(status)) fail(400, 'Invalid deposit status');
  if (['adjusted', 'refunded', 'forfeited'].includes(status)) {
    const cleared = await execQ(getPool(), `SELECT count(*)::int AS n FROM school_hostel_vacate WHERE app_id=$1 AND allocation_id=$2 AND status='cleared'`, [appId, id]);
    if (!cleared[0].n) fail(400, 'Deposit can only be settled after clearance');
  }
  const allocation = (await execQ(getPool(), 'SELECT * FROM school_hostel_allocation WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, id]))[0];
  if (!allocation) fail(404, 'Allocation not found');
  const amount = num(b.amount) ?? (Number(allocation.deposit_paid) || 0);
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_deposit (app_id, allocation_id, student_id, amount, status, held_at, settled_at, settlement_amount, notes)
    VALUES ($1,$2,$3,$4,$5,coalesce($6,current_date),$7,$8,$9)
    ON CONFLICT (allocation_id) DO UPDATE SET amount=EXCLUDED.amount, status=EXCLUDED.status, settled_at=EXCLUDED.settled_at,
      settlement_amount=EXCLUDED.settlement_amount, notes=EXCLUDED.notes, updated_at=now()
    RETURNING *
  `, [appId, id, allocation.student_id, amount, status, dayOf(b.heldAt), dayOf(b.settledAt), num(b.settlementAmount) || 0, text(b.notes)]);
  await execQ(getPool(), 'UPDATE school_hostel_allocation SET deposit_paid=$3, deposit_status=$4, updated_at=now() WHERE app_id=$1 AND id=$2', [appId, id, amount, status]);
  await writeAudit(getPool(), req, { action: 'hostel.deposit.update', entity: 'school_hostel_deposit', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, deposit: rows[0] });
}));

/* ============================================================
   3. Hostel fees, billing, rebates, deposits and dues
   ============================================================ */
async function loadBillingRows(pool, appId, periodStart, periodEnd, hostelId, studentId) {
  return execQ(pool, `
    SELECT a.id AS allocation_id, a.student_id, a.hostel_id, a.room_id, a.bed_id, a.from_date, a.to_date, a.status,
      s.admission_no, s.first_name, s.last_name, s.gender, c.name AS class_name,
      h.name AS hostel_name, r.number AS room_number, bd.bed_no, r.fee_category, r.room_type,
      COALESCE(fp.monthly_rent,0) AS plan_rent, COALESCE(fp.monthly_mess,0) AS plan_mess,
      fp.id AS fee_plan_id, fp.mess_plan_id,
      mp.rebate_min_days, mp.rebate_daily_rate,
      fr.amount AS rule_amount, fr.frequency AS rule_frequency, fr.effective_from AS rule_from
      FROM school_hostel_allocation a
      JOIN school_students s ON s.id=a.student_id
      LEFT JOIN school_classes c ON c.id=s.class_id
      JOIN school_hostel h ON h.id=a.hostel_id
      JOIN school_hostel_room r ON r.id=a.room_id
      JOIN school_hostel_bed bd ON bd.id=a.bed_id
      LEFT JOIN school_hostel_fee_plan fp ON fp.app_id=a.app_id AND fp.allocation_id=a.id AND fp.is_active=true
      LEFT JOIN school_hostel_mess_plan mp ON mp.id=fp.mess_plan_id
      LEFT JOIN LATERAL (
        SELECT x.* FROM school_hostel_fee_rule x
         WHERE x.app_id=a.app_id AND x.deleted_at IS NULL AND x.is_active
           AND (x.hostel_id IS NULL OR x.hostel_id=a.hostel_id)
           AND (x.room_category IS NULL OR x.room_category=r.fee_category)
           AND (x.room_type IS NULL OR x.room_type=r.room_type)
           AND x.effective_from <= $3::date
           AND (x.effective_to IS NULL OR x.effective_to >= $2::date)
         ORDER BY (x.hostel_id IS NOT NULL) DESC, (x.room_category IS NOT NULL) DESC, x.effective_from DESC
         LIMIT 1
      ) fr ON true
     WHERE a.app_id=$1 AND a.deleted_at IS NULL
       AND a.status IN ('active','changed','vacated')
       AND a.from_date <= $3::date AND (a.to_date IS NULL OR a.to_date >= $2::date)
       AND ($4::int IS NULL OR a.hostel_id=$4)
       AND ($5::int IS NULL OR a.student_id=$5)
     ORDER BY h.name, r.number, bd.bed_no
  `, [appId, periodStart, periodEnd, hostelId, studentId]);
}

async function computeBill(pool, appId, row, periodStart, periodEnd) {
  const allocStart = parseDay(row.from_date);
  const allocEnd = row.to_date ? parseDay(row.to_date) : parseDay(periodEnd);
  const start = allocStart > parseDay(periodStart) ? allocStart : parseDay(periodStart);
  const end = allocEnd < parseDay(periodEnd) ? allocEnd : parseDay(periodEnd);
  if (start > end) return { rent: 0, mess: 0, rebate: 0, total: 0, days: 0 };
  const segments = monthSegments(start, end);
  const days = segments.reduce((s, x) => s + x.days, 0);
  const rule = ruleMonthly({ ...row, period_start: periodStart, period_end: periodEnd });
  const monthlyRent = Number(row.plan_rent) > 0 ? Number(row.plan_rent) : rule;
  const rent = monthlyForSegments(monthlyRent, segments);
  const mess = monthlyForSegments(Number(row.plan_mess) || 0, segments);

  const rebates = await execQ(pool, `
    SELECT * FROM school_hostel_mess_rebate
     WHERE app_id=$1 AND allocation_id=$2 AND status='approved'
       AND from_date <= $4::date AND to_date >= $3::date
  `, [appId, row.allocation_id, dayOf(start), dayOf(end)]);
  let rebate = 0;
  for (const r of rebates) {
    const rStart = parseDay(r.from_date);
    const rEnd = parseDay(r.to_date);
    const totalDays = Math.max(daysInclusive(rStart, rEnd), 1);
    const oStart = rStart > start ? rStart : start;
    const oEnd = rEnd < end ? rEnd : end;
    const overlap = oStart <= oEnd ? daysInclusive(oStart, oEnd) : 0;
    rebate += (Number(r.amount) || 0) * (overlap / totalDays);
  }
  rebate = round2(rebate);
  const total = round2(Math.max(rent + mess - rebate, 0));
  return { rent, mess, rebate, total, days };
}

hostelRouter.get('/hostel/fee-rules', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT fr.*, h.name AS hostel_name, fh.name AS fee_head_name
      FROM school_hostel_fee_rule fr
      LEFT JOIN school_hostel h ON h.id=fr.hostel_id
      LEFT JOIN school_fee_head fh ON fh.id=fr.fee_head_id
     WHERE fr.app_id=$1 AND fr.deleted_at IS NULL
     ORDER BY fr.effective_from DESC, fr.id DESC
  `, [appIdOf(req)]);
  res.json({ ok: true, rules: rows });
}));

hostelRouter.post('/hostel/fee-rules', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const b = req.body || {};
  if (num(b.amount) === null) fail(400, 'Amount is required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_fee_rule (app_id, hostel_id, room_category, room_type, fee_head_id, amount, frequency, months_billed, effective_from, effective_to, is_active, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::int[],coalesce($9,current_date),$10,$11,$12) RETURNING *
  `, [appIdOf(req), num(b.hostelId), text(b.roomCategory), text(b.roomType), num(b.feeHeadId), num(b.amount) || 0,
    text(b.frequency) || 'monthly', Array.isArray(b.monthsBilled) ? b.monthsBilled : [1,2,3,4,5,6,7,8,9,10,11,12],
    dayOf(b.effectiveFrom), dayOf(b.effectiveTo), b.isActive !== false, text(b.notes)]);
  await writeAudit(getPool(), req, { action: 'hostel.fee_rule.create', entity: 'school_hostel_fee_rule', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, rule: rows[0] });
}));

hostelRouter.put('/hostel/fee-rules/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_fee_rule SET hostel_id=coalesce($3,hostel_id), room_category=coalesce($4,room_category), room_type=coalesce($5,room_type),
      fee_head_id=coalesce($6,fee_head_id), amount=coalesce($7,amount), frequency=coalesce($8,frequency), months_billed=coalesce($9::int[],months_billed),
      effective_from=coalesce($10,effective_from), effective_to=coalesce($11,effective_to), is_active=coalesce($12,is_active), notes=coalesce($13,notes), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.hostelId), text(b.roomCategory), text(b.roomType), num(b.feeHeadId), num(b.amount),
    text(b.frequency), Array.isArray(b.monthsBilled) ? b.monthsBilled : null, dayOf(b.effectiveFrom), dayOf(b.effectiveTo),
    b.isActive === undefined ? null : bool(b.isActive), text(b.notes)]);
  if (!rows[0]) fail(404, 'Fee rule not found');
  res.json({ ok: true, rule: rows[0] });
}));

hostelRouter.get('/hostel/mess-plans', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_hostel_mess_plan WHERE app_id=$1 AND deleted_at IS NULL ORDER BY name', [appIdOf(req)]);
  res.json({ ok: true, plans: rows });
}));

hostelRouter.post('/hostel/mess-plans', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const b = req.body || {};
  if (!text(b.name)) fail(400, 'Plan name is required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_mess_plan (app_id, name, amount_per_month, rebate_min_days, rebate_daily_rate, is_active, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [appIdOf(req), text(b.name), num(b.amountPerMonth) || 0, num(b.rebateMinDays) || 0, num(b.rebateDailyRate) || 0, b.isActive !== false, text(b.notes)]);
  res.json({ ok: true, plan: rows[0] });
}));

hostelRouter.put('/hostel/mess-plans/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_mess_plan SET name=coalesce($3,name), amount_per_month=coalesce($4,amount_per_month),
      rebate_min_days=coalesce($5,rebate_min_days), rebate_daily_rate=coalesce($6,rebate_daily_rate),
      is_active=coalesce($7,is_active), notes=coalesce($8,notes), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.name), num(b.amountPerMonth), num(b.rebateMinDays), num(b.rebateDailyRate),
    b.isActive === undefined ? null : bool(b.isActive), text(b.notes)]);
  if (!rows[0]) fail(404, 'Mess plan not found');
  res.json({ ok: true, plan: rows[0] });
}));

hostelRouter.get('/hostel/fee-plans', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const allocationId = num(req.query.allocationId);
  const rows = await execQ(getPool(), `
    SELECT fp.*, s.admission_no, s.first_name, s.last_name, mp.name AS mess_plan_name, fr.amount AS rule_amount
      FROM school_hostel_fee_plan fp
      JOIN school_hostel_allocation a ON a.id=fp.allocation_id
      JOIN school_students s ON s.id=a.student_id
      LEFT JOIN school_hostel_mess_plan mp ON mp.id=fp.mess_plan_id
      LEFT JOIN school_hostel_fee_rule fr ON fr.id=fp.fee_rule_id
     WHERE fp.app_id=$1 AND ($2::int IS NULL OR fp.allocation_id=$2)
     ORDER BY fp.is_active DESC, fp.id DESC LIMIT 300
  `, [appIdOf(req), allocationId]);
  res.json({ ok: true, plans: rows });
}));

hostelRouter.post('/hostel/fee-plans', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const b = req.body || {};
  if (!num(b.allocationId)) fail(400, 'Allocation is required');
  const result = await withTx(async (client) => {
    await client.query('UPDATE school_hostel_fee_plan SET is_active=false, effective_to=coalesce($3,current_date), updated_at=now() WHERE app_id=$1 AND allocation_id=$2 AND is_active=true', [appIdOf(req), num(b.allocationId), dayOf(b.effectiveFrom)]);
    const rows = await client.query(`
      INSERT INTO school_hostel_fee_plan (app_id, allocation_id, fee_rule_id, mess_plan_id, monthly_rent, monthly_mess, effective_from, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,coalesce($7,current_date),true) RETURNING *
    `, [appIdOf(req), num(b.allocationId), num(b.feeRuleId), num(b.messPlanId), num(b.monthlyRent) || 0, num(b.monthlyMess) || 0, dayOf(b.effectiveFrom)]);
    return rows.rows[0];
  });
  await writeAudit(getPool(), req, { action: 'hostel.fee_plan.create', entity: 'school_hostel_fee_plan', entityId: result.id, after: result });
  res.json({ ok: true, plan: result });
}));

hostelRouter.put('/hostel/fee-plans/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_fee_plan SET fee_rule_id=coalesce($3,fee_rule_id), mess_plan_id=coalesce($4,mess_plan_id),
      monthly_rent=coalesce($5,monthly_rent), monthly_mess=coalesce($6,monthly_mess), effective_to=coalesce($7,effective_to),
      is_active=coalesce($8,is_active), updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.feeRuleId), num(b.messPlanId), num(b.monthlyRent), num(b.monthlyMess),
    dayOf(b.effectiveTo), b.isActive === undefined ? null : bool(b.isActive)]);
  if (!rows[0]) fail(404, 'Fee plan not found');
  res.json({ ok: true, plan: rows[0] });
}));

hostelRouter.get('/hostel/billing/preview', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const periodStart = dayOf(req.query.periodStart) || `${new Date().toISOString().slice(0, 7)}-01`;
  const periodEnd = dayOf(req.query.periodEnd) || dayOf(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  const rows = await loadBillingRows(getPool(), appId, periodStart, periodEnd, num(req.query.hostelId), num(req.query.studentId));
  const out = [];
  for (const row of rows) {
    const calc = await computeBill(getPool(), appId, row, periodStart, periodEnd);
    out.push({ ...row, period_start: periodStart, period_end: periodEnd, ...calc });
  }
  res.json({ ok: true, preview: out, periodStart, periodEnd });
}));

hostelRouter.post('/hostel/billing/run', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  const periodStart = dayOf(b.periodStart);
  const periodEnd = dayOf(b.periodEnd);
  if (!periodStart || !periodEnd || periodStart > periodEnd) fail(400, 'A valid period is required');
  const rows = await loadBillingRows(getPool(), appId, periodStart, periodEnd, num(b.hostelId), num(b.studentId));
  const created = await withTx(async (client) => {
    const rentHead = await ensureFeeHead(client, appId, 'Hostel Rent', 'hostel');
    const messHead = await ensureFeeHead(client, appId, 'Hostel Mess', 'hostel');
    const countRow = await client.query('SELECT count(*)::int AS n FROM school_invoice WHERE app_id=$1', [appId]);
    let invoiceCount = countRow.rows[0].n;
    const bills = [];
    for (const row of rows) {
      const calc = await computeBill(client, appId, row, periodStart, periodEnd);
      if (calc.total <= 0) continue;
      const dup = await client.query('SELECT id FROM school_hostel_bill WHERE app_id=$1 AND allocation_id=$2 AND period_start=$3 AND period_end=$4', [appId, row.allocation_id, periodStart, periodEnd]);
      if (dup.rows[0]) continue;

      const netMess = Math.max(calc.mess - calc.rebate, 0);
      const remaining = Math.max(calc.rebate - calc.mess, 0);
      const netRent = Math.max(calc.rent - remaining, 0);
      const total = round2(netRent + netMess);
      if (total <= 0) continue;

      invoiceCount += 1;
      const invoice = await client.query(`
        INSERT INTO school_invoice (app_id, student_id, number, date, due_date, status, total_amount, created_by)
        VALUES ($1,$2,$3,current_date,coalesce($4,current_date),'issued',$5,$6) RETURNING *
      `, [appId, row.student_id, nextNo('INV', invoiceCount - 1), dayOf(b.dueDate), total, userOf(req)]);
      if (netRent > 0) await client.query('INSERT INTO school_invoice_line (app_id, invoice_id, head_id, amount) VALUES ($1,$2,$3,$4)', [appId, invoice.rows[0].id, rentHead, netRent]);
      if (netMess > 0) await client.query('INSERT INTO school_invoice_line (app_id, invoice_id, head_id, amount) VALUES ($1,$2,$3,$4)', [appId, invoice.rows[0].id, messHead, netMess]);

      const bill = await client.query(`
        INSERT INTO school_hostel_bill (app_id, allocation_id, student_id, period_start, period_end, rent_amount, mess_amount, extras_amount, rebate_amount, total_amount, invoice_id, status, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,'issued',$11)
        ON CONFLICT (allocation_id, period_start, period_end) DO NOTHING RETURNING *
      `, [appId, row.allocation_id, row.student_id, periodStart, periodEnd, calc.rent, calc.mess, calc.rebate, total, invoice.rows[0].id, userOf(req)]);
      if (bill.rows[0]) bills.push(bill.rows[0]);
    }
    return bills;
  });
  await writeAudit(getPool(), req, { action: 'hostel.billing.run', entity: 'school_hostel_bill', entityId: null, after: { periodStart, periodEnd, created: created.length } });
  res.json({ ok: true, created: created.length, bills: created });
}));

hostelRouter.get('/hostel/bills', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT b.*, s.admission_no, s.first_name, s.last_name, i.number AS invoice_number, i.status AS invoice_status
      FROM school_hostel_bill b
      JOIN school_students s ON s.id=b.student_id
      LEFT JOIN school_invoice i ON i.id=b.invoice_id
     WHERE b.app_id=$1
     ORDER BY b.period_start DESC, b.id DESC LIMIT 500
  `, [appIdOf(req)]);
  res.json({ ok: true, bills: rows });
}));

hostelRouter.post('/hostel/bills/:id/cancel', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const result = await withTx(async (client) => {
    const bill = (await client.query('SELECT * FROM school_hostel_bill WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id])).rows[0];
    if (!bill) fail(404, 'Bill not found');
    if (bill.status !== 'issued') fail(400, 'Only issued bills can be cancelled');
    if (bill.invoice_id) {
      const inv = (await client.query('SELECT * FROM school_invoice WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, bill.invoice_id])).rows[0];
      if (inv && Number(inv.paid_amount) > 0) fail(400, 'Invoice has receipts; reverse the receipt first');
      if (inv) await client.query(`UPDATE school_invoice SET status='cancelled', cancelled_by=$3, cancelled_at=now(), cancelled_reason=$4, updated_at=now() WHERE app_id=$1 AND id=$2`, [appId, bill.invoice_id, userOf(req), text(req.body?.reason)]);
    }
    const updated = await client.query(`UPDATE school_hostel_bill SET status='cancelled', updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *`, [appId, id]);
    return updated.rows[0];
  });
  await writeAudit(getPool(), req, { action: 'hostel.bill.cancel', entity: 'school_hostel_bill', entityId: id, after: result });
  res.json({ ok: true, bill: result });
}));

hostelRouter.get('/hostel/rebates', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT r.*, s.admission_no, s.first_name, s.last_name
      FROM school_hostel_mess_rebate r
      JOIN school_students s ON s.id=r.student_id
     WHERE r.app_id=$1
     ORDER BY r.from_date DESC, r.id DESC LIMIT 300
  `, [appIdOf(req)]);
  res.json({ ok: true, rebates: rows });
}));

hostelRouter.post('/hostel/rebates', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  if (!num(b.allocationId) || !dayOf(b.fromDate) || !dayOf(b.toDate)) fail(400, 'Allocation and date range are required');
  const allocation = (await execQ(getPool(), 'SELECT * FROM school_hostel_allocation WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, num(b.allocationId)]))[0];
  if (!allocation) fail(404, 'Allocation not found');
  const days = num(b.days) || daysInclusive(parseDay(b.fromDate), parseDay(b.toDate));
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_mess_rebate (app_id, allocation_id, student_id, from_date, to_date, days, amount, reason, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *
  `, [appId, num(b.allocationId), allocation.student_id, dayOf(b.fromDate), dayOf(b.toDate), days, num(b.amount) || 0, text(b.reason)]);
  res.json({ ok: true, rebate: rows[0] });
}));

hostelRouter.post('/hostel/rebates/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `UPDATE school_hostel_mess_rebate SET status='approved', approved_by=$3, approved_at=now(), updated_at=now() WHERE app_id=$1 AND id=$2 AND status='pending' RETURNING *`, [appId, id, userOf(req)]);
  if (!rows[0]) fail(404, 'Pending rebate not found');
  await writeAudit(getPool(), req, { action: 'hostel.rebate.approve', entity: 'school_hostel_mess_rebate', entityId: id, after: rows[0] });
  res.json({ ok: true, rebate: rows[0] });
}));

hostelRouter.get('/hostel/deposits', route(async (req, res) => {
  if (!guardView(req, res, 'hostel.fees')) return;
  const rows = await execQ(getPool(), `
    SELECT d.*, s.admission_no, s.first_name, s.last_name, a.status AS allocation_status
      FROM school_hostel_deposit d
      JOIN school_students s ON s.id=d.student_id
      JOIN school_hostel_allocation a ON a.id=d.allocation_id
     WHERE d.app_id=$1
     ORDER BY d.id DESC LIMIT 500
  `, [appIdOf(req)]);
  res.json({ ok: true, deposits: rows });
}));

hostelRouter.get('/hostel/damage', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT d.*, r.number AS room_number, s.admission_no, s.first_name, s.last_name
      FROM school_hostel_damage d
      LEFT JOIN school_hostel_room r ON r.id=d.room_id
      LEFT JOIN school_hostel_allocation a ON a.id=d.allocation_id
      LEFT JOIN school_students s ON s.id=a.student_id
     WHERE d.app_id=$1 ORDER BY d.id DESC LIMIT 300
  `, [appIdOf(req)]);
  res.json({ ok: true, damage: rows });
}));

hostelRouter.post('/hostel/damage', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  if (!text(b.description) || num(b.amount) === null) fail(400, 'Description and amount are required');
  const result = await withTx(async (client) => {
    const damage = await client.query(`
      INSERT INTO school_hostel_damage (app_id, allocation_id, room_id, description, amount, status)
      VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *
    `, [appId, num(b.allocationId), num(b.roomId), text(b.description), num(b.amount) || 0]);
    if (bool(b.chargeNow)) {
      const allocation = num(b.allocationId) ? (await client.query('SELECT * FROM school_hostel_allocation WHERE app_id=$1 AND id=$2', [appId, num(b.allocationId)])).rows[0] : null;
      if (!allocation) fail(400, 'Allocation is required to charge damage');
      const head = await ensureFeeHead(client, appId, 'Hostel Damage Recovery', 'other');
      const cnt = await client.query('SELECT count(*)::int AS n FROM school_invoice WHERE app_id=$1', [appId]);
      const invoice = await client.query(`
        INSERT INTO school_invoice (app_id, student_id, number, date, due_date, status, total_amount, created_by)
        VALUES ($1,$2,$3,current_date,coalesce($4,current_date),'issued',$5,$6) RETURNING *
      `, [appId, allocation.student_id, nextNo('INV', cnt.rows[0].n), dayOf(b.dueDate), num(b.amount) || 0, userOf(req)]);
      await client.query('INSERT INTO school_invoice_line (app_id, invoice_id, head_id, amount) VALUES ($1,$2,$3,$4)', [appId, invoice.rows[0].id, head, num(b.amount) || 0]);
      await client.query(`UPDATE school_hostel_damage SET status='charged', invoice_id=$3, updated_at=now() WHERE app_id=$1 AND id=$2`, [appId, damage.rows[0].id, invoice.rows[0].id]);
      damage.rows[0].status = 'charged';
      damage.rows[0].invoice_id = invoice.rows[0].id;
    }
    return damage.rows[0];
  });
  await writeAudit(getPool(), req, { action: 'hostel.damage.create', entity: 'school_hostel_damage', entityId: result.id, after: result });
  res.json({ ok: true, damage: result });
}));

hostelRouter.get('/hostel/dues', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT i.id, i.number, i.date, i.due_date, i.total_amount, i.paid_amount, i.balance, i.status,
      s.admission_no, s.first_name, s.last_name, c.name AS class_name,
      (SELECT sum(l.amount) FROM school_invoice_line l JOIN school_fee_head fh ON fh.id=l.head_id
        WHERE l.invoice_id=i.id AND fh.type IN ('hostel','deposit')) AS hostel_amount
      FROM school_invoice i
      JOIN school_students s ON s.id=i.student_id
      LEFT JOIN school_classes c ON c.id=s.class_id
     WHERE i.app_id=$1 AND i.deleted_at IS NULL AND i.status IN ('issued','partly_paid') AND i.balance > 0
       AND EXISTS (SELECT 1 FROM school_invoice_line l JOIN school_fee_head fh ON fh.id=l.head_id
                    WHERE l.invoice_id=i.id AND fh.type IN ('hostel','deposit'))
     ORDER BY i.due_date, i.id
  `, [appIdOf(req)]);
  res.json({ ok: true, dues: rows });
}));

hostelRouter.get('/hostel/fee-summary', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const [summary] = await execQ(getPool(), `
    SELECT
      (SELECT coalesce(sum(i.total_amount),0) FROM school_invoice i WHERE i.app_id=$1 AND i.status <> 'cancelled' AND EXISTS (SELECT 1 FROM school_invoice_line l JOIN school_fee_head fh ON fh.id=l.head_id WHERE l.invoice_id=i.id AND fh.type='hostel')) AS invoiced,
      (SELECT coalesce(sum(i.paid_amount),0) FROM school_invoice i WHERE i.app_id=$1 AND i.status <> 'cancelled' AND EXISTS (SELECT 1 FROM school_invoice_line l JOIN school_fee_head fh ON fh.id=l.head_id WHERE l.invoice_id=i.id AND fh.type='hostel')) AS collected,
      (SELECT coalesce(sum(i.balance),0) FROM school_invoice i WHERE i.app_id=$1 AND i.status IN ('issued','partly_paid') AND EXISTS (SELECT 1 FROM school_invoice_line l JOIN school_fee_head fh ON fh.id=l.head_id WHERE l.invoice_id=i.id AND fh.type='hostel')) AS outstanding,
      (SELECT coalesce(sum(amount),0) FROM school_hostel_deposit WHERE app_id=$1 AND status='held') AS deposits_held,
      (SELECT coalesce(sum(amount),0) FROM school_hostel_mess_rebate WHERE app_id=$1 AND status='approved') AS rebates,
      (SELECT count(*)::int FROM school_hostel_bill WHERE app_id=$1 AND status='issued') AS bills
  `, [appId]);
  res.json({ ok: true, summary });
}));

/* ============================================================
   4. Roll calls, leave passes, gate log, duty, incidents, complaints
   ============================================================ */
hostelRouter.get('/hostel/roll-calls', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const callDate = dayOf(req.query.date);
  const hostelId = num(req.query.hostelId);
  const rows = await execQ(getPool(), `
    SELECT rc.*, h.name AS hostel_name,
      (SELECT count(*)::int FROM school_hostel_roll_call_entry e WHERE e.roll_call_id=rc.id) AS total,
      (SELECT count(*)::int FROM school_hostel_roll_call_entry e WHERE e.roll_call_id=rc.id AND e.status='present') AS present,
      (SELECT count(*)::int FROM school_hostel_roll_call_entry e WHERE e.roll_call_id=rc.id AND e.status='absent') AS absent,
      (SELECT count(*)::int FROM school_hostel_roll_call_entry e WHERE e.roll_call_id=rc.id AND e.status='on_leave') AS on_leave
      FROM school_hostel_roll_call rc
      JOIN school_hostel h ON h.id=rc.hostel_id
     WHERE rc.app_id=$1
       AND ($2::date IS NULL OR rc.call_date=$2)
       AND ($3::int IS NULL OR rc.hostel_id=$3)
     ORDER BY rc.call_date DESC, rc.session, h.name LIMIT 200
  `, [appIdOf(req), callDate, hostelId]);
  res.json({ ok: true, rollCalls: rows });
}));

hostelRouter.post('/hostel/roll-calls', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  const hostelId = num(b.hostelId);
  const callDate = dayOf(b.date) || dayOf(new Date());
  const session = ['morning', 'evening', 'night'].includes(text(b.session)) ? text(b.session) : 'night';
  if (!hostelId) fail(400, 'Hostel is required');
  const data = await withTx(async (client) => {
    let rc = (await client.query('SELECT * FROM school_hostel_roll_call WHERE app_id=$1 AND hostel_id=$2 AND call_date=$3 AND session=$4', [appId, hostelId, callDate, session])).rows[0];
    if (!rc) {
      rc = (await client.query(`
        INSERT INTO school_hostel_roll_call (app_id, hostel_id, block_id, call_date, session, source, status, notes)
        VALUES ($1,$2,$3,$4,$5,$6,'draft',$7) RETURNING *
      `, [appId, hostelId, num(b.blockId), callDate, session, text(b.source) || 'online', text(b.notes)])).rows[0];
    }
    if (rc.status === 'draft') {
      await client.query(`
        INSERT INTO school_hostel_roll_call_entry (app_id, roll_call_id, student_id, allocation_id, status)
        SELECT $1,$2,a.student_id,a.id,
          CASE WHEN EXISTS (
            SELECT 1 FROM school_hostel_leave_pass lp
             WHERE lp.app_id=$1 AND lp.student_id=a.student_id
               AND lp.status IN ('approved','out')
               AND $3::date BETWEEN lp.from_date AND lp.to_date
          ) THEN 'on_leave' ELSE 'present' END
          FROM school_hostel_allocation a
         WHERE a.app_id=$1 AND a.hostel_id=$4 AND a.status='active' AND a.deleted_at IS NULL
        ON CONFLICT (roll_call_id, student_id) DO NOTHING
      `, [appId, rc.id, callDate, hostelId]);
    }
    const entries = await client.query(`
      SELECT e.*, s.admission_no, s.first_name, s.last_name, s.gender, r.number AS room_number, bd.bed_no
        FROM school_hostel_roll_call_entry e
        JOIN school_students s ON s.id=e.student_id
        LEFT JOIN school_hostel_allocation a ON a.id=e.allocation_id
        LEFT JOIN school_hostel_room r ON r.id=a.room_id
        LEFT JOIN school_hostel_bed bd ON bd.id=a.bed_id
       WHERE e.app_id=$1 AND e.roll_call_id=$2
       ORDER BY s.first_name, s.last_name
    `, [appId, rc.id]);
    return { rollCall: rc, entries: entries.rows };
  });
  res.json({ ok: true, ...data });
}));

hostelRouter.get('/hostel/roll-calls/:id', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rc = (await execQ(getPool(), 'SELECT rc.*, h.name AS hostel_name FROM school_hostel_roll_call rc JOIN school_hostel h ON h.id=rc.hostel_id WHERE rc.app_id=$1 AND rc.id=$2', [appId, id]))[0];
  if (!rc) fail(404, 'Roll call not found');
  const entries = await execQ(getPool(), `
    SELECT e.*, s.admission_no, s.first_name, s.last_name, s.gender, r.number AS room_number, bd.bed_no
      FROM school_hostel_roll_call_entry e
      JOIN school_students s ON s.id=e.student_id
      LEFT JOIN school_hostel_allocation a ON a.id=e.allocation_id
      LEFT JOIN school_hostel_room r ON r.id=a.room_id
      LEFT JOIN school_hostel_bed bd ON bd.id=a.bed_id
     WHERE e.app_id=$1 AND e.roll_call_id=$2
     ORDER BY s.first_name, s.last_name
  `, [appId, id]);
  res.json({ ok: true, rollCall: rc, entries });
}));

hostelRouter.put('/hostel/roll-calls/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const data = await withTx(async (client) => {
    const rc = (await client.query('SELECT * FROM school_hostel_roll_call WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id])).rows[0];
    if (!rc) fail(404, 'Roll call not found');
    if (rc.status !== 'draft') fail(400, 'Roll call is submitted or locked; use correction');
    for (const e of entries) {
      if (!num(e.studentId)) continue;
      const status = ['present', 'absent', 'on_leave', 'sick_bay', 'late'].includes(text(e.status)) ? text(e.status) : 'present';
      await client.query(`UPDATE school_hostel_roll_call_entry SET status=$4, remark=$5, updated_at=now() WHERE app_id=$1 AND roll_call_id=$2 AND student_id=$3`, [appId, id, num(e.studentId), status, text(e.remark)]);
    }
    const updated = await client.query('UPDATE school_hostel_roll_call SET updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *', [appId, id]);
    return updated.rows[0];
  });
  res.json({ ok: true, rollCall: data });
}));

hostelRouter.post('/hostel/roll-calls/:id/submit', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_roll_call SET status='submitted', taken_by=$3, taken_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='draft' RETURNING *
  `, [appId, id, userOf(req)]);
  if (!rows[0]) fail(400, 'Roll call is already submitted or locked');
  const absents = await execQ(getPool(), `
    SELECT e.student_id, s.first_name, s.last_name, s.guardian_phone
      FROM school_hostel_roll_call_entry e JOIN school_students s ON s.id=e.student_id
     WHERE e.app_id=$1 AND e.roll_call_id=$2 AND e.status='absent'
  `, [appId, id]);
  for (const a of absents) {
    await notify(getPool(), appId, { kind: 'rollcall.absent', studentId: a.student_id, title: 'Unexplained hostel absence', message: `${a.first_name} ${a.last_name} was marked absent`, severity: 'warning', recipient: a.guardian_phone, recipientRole: 'guardian' });
  }
  await writeAudit(getPool(), req, { action: 'hostel.rollcall.submit', entity: 'school_hostel_roll_call', entityId: id, after: rows[0] });
  res.json({ ok: true, rollCall: rows[0], absentAlerts: absents.length });
}));

hostelRouter.post('/hostel/roll-calls/:id/correct', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const b = req.body || {};
  if (!text(b.reason)) fail(400, 'A reason is required for correction');
  const entries = Array.isArray(b.entries) ? b.entries : [];
  const data = await withTx(async (client) => {
    const rc = (await client.query('SELECT * FROM school_hostel_roll_call WHERE app_id=$1 AND id=$2 FOR UPDATE', [appId, id])).rows[0];
    if (!rc) fail(404, 'Roll call not found');
    if (rc.status === 'draft') fail(400, 'Use save on a draft roll call');
    for (const e of entries) {
      if (!num(e.studentId)) continue;
      const status = ['present', 'absent', 'on_leave', 'sick_bay', 'late'].includes(text(e.status)) ? text(e.status) : 'present';
      await client.query(`
        UPDATE school_hostel_roll_call_entry SET status=$4, remark=coalesce($5,remark), corrected_by=$6, corrected_at=now(), correction_reason=$7, updated_at=now()
         WHERE app_id=$1 AND roll_call_id=$2 AND student_id=$3
      `, [appId, id, num(e.studentId), status, text(e.remark), userOf(req), text(b.reason)]);
    }
    return rc;
  });
  await writeAudit(getPool(), req, { action: 'hostel.rollcall.correct', entity: 'school_hostel_roll_call', entityId: id, after: { reason: b.reason, entries } });
  res.json({ ok: true, rollCall: data });
}));

hostelRouter.get('/hostel/leave-passes', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const rows = await execQ(getPool(), `
    SELECT lp.*, s.admission_no, s.first_name, s.last_name, s.guardian_name, s.guardian_phone, h.name AS hostel_name, r.number AS room_number
      FROM school_hostel_leave_pass lp
      JOIN school_students s ON s.id=lp.student_id
      LEFT JOIN school_hostel_allocation a ON a.id=lp.allocation_id
      LEFT JOIN school_hostel h ON h.id=a.hostel_id
      LEFT JOIN school_hostel_room r ON r.id=a.room_id
     WHERE lp.app_id=$1 AND ($2::text IS NULL OR lp.status=$2)
     ORDER BY lp.created_at DESC LIMIT 300
  `, [appIdOf(req), status]);
  res.json({ ok: true, passes: rows });
}));

hostelRouter.post('/hostel/leave-passes', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  if (!num(b.studentId) || !dayOf(b.fromDate) || !dayOf(b.toDate)) fail(400, 'Student and date range are required');
  const type = ['outpass', 'home_leave', 'medical', 'vacation'].includes(text(b.type)) ? text(b.type) : 'outpass';
  const allocation = num(b.allocationId)
    ? (await execQ(getPool(), 'SELECT * FROM school_hostel_allocation WHERE app_id=$1 AND id=$2', [appId, num(b.allocationId)]))[0]
    : (await execQ(getPool(), `SELECT * FROM school_hostel_allocation WHERE app_id=$1 AND student_id=$2 AND status='active' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`, [appId, num(b.studentId)]))[0];
  const count = (await execQ(getPool(), 'SELECT count(*)::int AS n FROM school_hostel_leave_pass WHERE app_id=$1', [appId]))[0].n;
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_leave_pass (app_id, pass_no, student_id, allocation_id, type, from_date, to_date, from_time, to_time, destination, reason, requested_by, status, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,nullif($8,'')::time,nullif($9,'')::time,$10,$11,$12,'requested',$13) RETURNING *
  `, [appId, text(b.passNo) || nextNo('LP', count), num(b.studentId), allocation?.id || null, type, dayOf(b.fromDate), dayOf(b.toDate),
    text(b.fromTime), text(b.toTime), text(b.destination), text(b.reason), userOf(req), text(b.notes)]);
  await notify(getPool(), appId, { kind: 'leave.requested', studentId: num(b.studentId), allocationId: allocation?.id || null, title: 'Leave pass requested', message: `${type.replace('_', ' ')} from ${dayOf(b.fromDate)} to ${dayOf(b.toDate)}`, severity: 'info', recipientRole: 'guardian' });
  res.json({ ok: true, pass: rows[0] });
}));

hostelRouter.post('/hostel/leave-passes/:id/guardian-otp', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const otp = text(req.body?.otp);
  if (!otp) fail(400, 'Guardian OTP is required');
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_leave_pass SET guardian_otp=$3, guardian_approved_at=now(), status='guardian_approved', updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='requested' RETURNING *
  `, [appIdOf(req), num(req.params.id), otp]);
  if (!rows[0]) fail(400, 'Leave pass is not awaiting guardian approval');
  await writeAudit(getPool(), req, { action: 'hostel.leave.guardian_otp', entity: 'school_hostel_leave_pass', entityId: rows[0].id, after: { guardianApproved: true } });
  res.json({ ok: true, pass: rows[0] });
}));

hostelRouter.post('/hostel/leave-passes/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'hostel.leave_approve')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const pass = (await execQ(getPool(), 'SELECT * FROM school_hostel_leave_pass WHERE app_id=$1 AND id=$2', [appId, id]))[0];
  if (!pass) fail(404, 'Leave pass not found');
  if (['approved', 'out', 'returned'].includes(pass.status)) fail(400, 'Leave pass is already approved');
  if (pass.requested_by && pass.requested_by === userOf(req)) fail(400, 'You cannot approve your own leave request');
  const requireOtp = await getSetting(getPool(), appId, 'leave_require_guardian_otp', true);
  if (requireOtp && !pass.guardian_approved_at) fail(400, 'Guardian OTP approval is required first');
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_leave_pass SET status='approved', approved_by=$3, approved_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status IN ('requested','guardian_approved') RETURNING *
  `, [appId, id, userOf(req)]);
  if (!rows[0]) fail(400, 'Leave pass cannot be approved in its current state');
  await notify(getPool(), appId, { kind: 'leave.approved', studentId: pass.student_id, allocationId: pass.allocation_id, title: 'Leave pass approved', message: 'Warden approved the leave pass', severity: 'info' });
  await writeAudit(getPool(), req, { action: 'hostel.leave.approve', entity: 'school_hostel_leave_pass', entityId: id, after: rows[0] });
  res.json({ ok: true, pass: rows[0] });
}));

hostelRouter.post('/hostel/leave-passes/:id/reject', route(async (req, res) => {
  if (!guard(req, res, 'hostel.leave_approve')) return;
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_leave_pass SET status='rejected', rejection_reason=$3, approved_by=$4, approved_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status IN ('requested','guardian_approved') RETURNING *
  `, [appIdOf(req), num(req.params.id), text(req.body?.reason), userOf(req)]);
  if (!rows[0]) fail(400, 'Leave pass cannot be rejected in its current state');
  await writeAudit(getPool(), req, { action: 'hostel.leave.reject', entity: 'school_hostel_leave_pass', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, pass: rows[0] });
}));

hostelRouter.post('/hostel/leave-passes/:id/gate-out', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const data = await withTx(async (client) => {
    const pass = (await client.query(`SELECT * FROM school_hostel_leave_pass WHERE app_id=$1 AND id=$2 AND status='approved' FOR UPDATE`, [appId, id])).rows[0];
    if (!pass) fail(400, 'Only an approved leave pass can be gated out');
    const updated = (await client.query(`UPDATE school_hostel_leave_pass SET status='out', actual_out=now(), gate_out_by=$3, updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *`, [appId, id, userOf(req)])).rows[0];
    await client.query(`INSERT INTO school_hostel_gate_log (app_id, student_id, allocation_id, leave_pass_id, direction, log_time, source, guard_user, vehicle_no, notes) VALUES ($1,$2,$3,$4,'out',now(),$5,$6,$7,$8)`,
      [appId, pass.student_id, pass.allocation_id, id, text(req.body?.source) || 'manual', userOf(req), text(req.body?.vehicleNo), text(req.body?.notes)]);
    return updated;
  });
  await notify(getPool(), appId, { kind: 'student.out', studentId: data.student_id, allocationId: data.allocation_id, title: 'Student left hostel', message: 'Student has been gated out', severity: 'info' });
  res.json({ ok: true, pass: data });
}));

hostelRouter.post('/hostel/leave-passes/:id/gate-in', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const data = await withTx(async (client) => {
    const pass = (await client.query(`SELECT * FROM school_hostel_leave_pass WHERE app_id=$1 AND id=$2 AND status IN ('out','overdue') FOR UPDATE`, [appId, id])).rows[0];
    if (!pass) fail(400, 'Only an out or overdue pass can be gated in');
    const updated = (await client.query(`UPDATE school_hostel_leave_pass SET status='returned', actual_in=now(), gate_in_by=$3, updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *`, [appId, id, userOf(req)])).rows[0];
    await client.query(`INSERT INTO school_hostel_gate_log (app_id, student_id, allocation_id, leave_pass_id, direction, log_time, source, guard_user, vehicle_no, notes) VALUES ($1,$2,$3,$4,'in',now(),$5,$6,$7,$8)`,
      [appId, pass.student_id, pass.allocation_id, id, text(req.body?.source) || 'manual', userOf(req), text(req.body?.vehicleNo), text(req.body?.notes)]);
    return updated;
  });
  await notify(getPool(), appId, { kind: 'student.returned', studentId: data.student_id, allocationId: data.allocation_id, title: 'Student returned to hostel', message: 'Student has been gated in', severity: 'info' });
  res.json({ ok: true, pass: data });
}));

hostelRouter.get('/hostel/gate-log', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const from = dayOf(req.query.from) || dayOf(new Date(Date.now() - 7 * 86400000));
  const to = dayOf(req.query.to) || dayOf(new Date());
  const rows = await execQ(getPool(), `
    SELECT g.*, s.admission_no, s.first_name, s.last_name, h.name AS hostel_name
      FROM school_hostel_gate_log g
      JOIN school_students s ON s.id=g.student_id
      LEFT JOIN school_hostel_allocation a ON a.id=g.allocation_id
      LEFT JOIN school_hostel h ON h.id=a.hostel_id
     WHERE g.app_id=$1 AND g.log_time::date BETWEEN $2::date AND $3::date
     ORDER BY g.log_time DESC LIMIT 500
  `, [appIdOf(req), from, to]);
  res.json({ ok: true, gateLog: rows });
}));

hostelRouter.post('/hostel/gate-log', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const b = req.body || {};
  if (!num(b.studentId) || !['out', 'in'].includes(text(b.direction))) fail(400, 'Student and direction are required');
  const allocation = (await execQ(getPool(), `SELECT * FROM school_hostel_allocation WHERE app_id=$1 AND student_id=$2 AND status='active' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`, [appIdOf(req), num(b.studentId)]))[0];
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_gate_log (app_id, student_id, allocation_id, leave_pass_id, direction, log_time, source, guard_user, vehicle_no, notes)
    VALUES ($1,$2,$3,$4,$5,coalesce($6,now()),$7,$8,$9,$10) RETURNING *
  `, [appIdOf(req), num(b.studentId), allocation?.id || null, num(b.leavePassId), text(b.direction), b.logTime || null, text(b.source) || 'manual', userOf(req), text(b.vehicleNo), text(b.notes)]);
  res.json({ ok: true, entry: rows[0] });
}));

hostelRouter.get('/hostel/duty', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const from = dayOf(req.query.from) || dayOf(new Date(Date.now() - 7 * 86400000));
  const to = dayOf(req.query.to) || dayOf(new Date(Date.now() + 14 * 86400000));
  const rows = await execQ(getPool(), `
    SELECT d.*, h.name AS hostel_name, s.name AS staff_name, sub.name AS substitute_name
      FROM school_hostel_duty d
      JOIN school_hostel h ON h.id=d.hostel_id
      JOIN school_staff s ON s.id=d.staff_id
      LEFT JOIN school_staff sub ON sub.id=d.substitute_staff_id
     WHERE d.app_id=$1 AND d.duty_date BETWEEN $2::date AND $3::date
     ORDER BY d.duty_date, d.shift
  `, [appIdOf(req), from, to]);
  res.json({ ok: true, duty: rows });
}));

hostelRouter.post('/hostel/duty', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const b = req.body || {};
  if (!num(b.hostelId) || !num(b.staffId)) fail(400, 'Hostel and staff are required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_duty (app_id, hostel_id, staff_id, duty_date, shift, substitute_staff_id, status, notes)
    VALUES ($1,$2,$3,coalesce($4,current_date),$5,$6,$7,$8)
    ON CONFLICT (app_id, hostel_id, duty_date, shift) DO UPDATE SET staff_id=EXCLUDED.staff_id, substitute_staff_id=EXCLUDED.substitute_staff_id, status=EXCLUDED.status, notes=EXCLUDED.notes, updated_at=now()
    RETURNING *
  `, [appIdOf(req), num(b.hostelId), num(b.staffId), dayOf(b.dutyDate), text(b.shift) || 'night', num(b.substituteStaffId), text(b.status) || 'scheduled', text(b.notes)]);
  res.json({ ok: true, duty: rows[0] });
}));

hostelRouter.put('/hostel/duty/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_duty SET staff_id=coalesce($3,staff_id), shift=coalesce($4,shift), substitute_staff_id=coalesce($5,substitute_staff_id),
      status=coalesce($6,status), notes=coalesce($7,notes), updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), num(b.staffId), text(b.shift), num(b.substituteStaffId), text(b.status), text(b.notes)]);
  if (!rows[0]) fail(404, 'Duty not found');
  res.json({ ok: true, duty: rows[0] });
}));

hostelRouter.get('/hostel/incidents', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT i.*, s.admission_no, s.first_name, s.last_name, r.number AS room_number
      FROM school_hostel_incident i
      LEFT JOIN school_students s ON s.id=i.student_id
      LEFT JOIN school_hostel_room r ON r.id=i.room_id
     WHERE i.app_id=$1 ORDER BY i.incident_date DESC, i.id DESC LIMIT 300
  `, [appIdOf(req)]);
  res.json({ ok: true, incidents: rows });
}));

hostelRouter.post('/hostel/incidents', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const b = req.body || {};
  if (!text(b.type) || !text(b.description)) fail(400, 'Type and description are required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_incident (app_id, student_id, room_id, incident_date, type, description, action_taken, severity, reported_by, visibility, status)
    VALUES ($1,$2,$3,coalesce($4,current_date),$5,$6,$7,$8,$9,$10,$11) RETURNING *
  `, [appIdOf(req), num(b.studentId), num(b.roomId), dayOf(b.incidentDate), text(b.type), text(b.description), text(b.actionTaken),
    text(b.severity) || 'low', text(b.reportedBy) || userOf(req), text(b.visibility) || 'internal', text(b.status) || 'open']);
  if (['high', 'critical'].includes(rows[0].severity)) {
    await notify(getPool(), appIdOf(req), { kind: 'incident.high', studentId: rows[0].student_id, title: 'Serious hostel incident', message: rows[0].type, severity: 'critical', recipientRole: 'principal' });
  }
  await writeAudit(getPool(), req, { action: 'hostel.incident.create', entity: 'school_hostel_incident', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, incident: rows[0] });
}));

hostelRouter.put('/hostel/incidents/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_incident SET action_taken=coalesce($3,action_taken), severity=coalesce($4,severity), status=coalesce($5,status),
      visibility=coalesce($6,visibility), updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.actionTaken), text(b.severity), text(b.status), text(b.visibility)]);
  if (!rows[0]) fail(404, 'Incident not found');
  res.json({ ok: true, incident: rows[0] });
}));

hostelRouter.get('/hostel/complaints', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT c.*, s.admission_no, s.first_name, s.last_name
      FROM school_hostel_complaint c
      LEFT JOIN school_students s ON s.id=c.student_id
     WHERE c.app_id=$1 ORDER BY c.created_at DESC LIMIT 300
  `, [appIdOf(req)]);
  res.json({ ok: true, complaints: rows });
}));

hostelRouter.post('/hostel/complaints', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const b = req.body || {};
  if (!text(b.description)) fail(400, 'Description is required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_complaint (app_id, student_id, raised_by, category, description, status)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [appIdOf(req), num(b.studentId), text(b.raisedBy) || userOf(req), text(b.category) || 'general', text(b.description), text(b.status) || 'open']);
  res.json({ ok: true, complaint: rows[0] });
}));

hostelRouter.put('/hostel/complaints/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.rollcall')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_complaint SET status=coalesce($3,status), escalated_to=coalesce($4,escalated_to), resolution=coalesce($5,resolution),
      resolved_at=CASE WHEN $3 IN ('resolved','closed') THEN now() ELSE resolved_at END, updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), text(b.status), text(b.escalatedTo), text(b.resolution)]);
  if (!rows[0]) fail(404, 'Complaint not found');
  res.json({ ok: true, complaint: rows[0] });
}));

hostelRouter.get('/hostel/alerts', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  await execQ(getPool(), `
    UPDATE school_hostel_leave_pass SET status='overdue', updated_at=now()
     WHERE app_id=$1 AND status='out'
       AND (to_date < current_date OR (to_date=current_date AND to_time IS NOT NULL AND current_time > to_time))
  `, [appId]);
  const [overdue, absences, missing, openVisits] = await Promise.all([
    execQ(getPool(), `
      SELECT lp.*, s.admission_no, s.first_name, s.last_name, s.guardian_phone
        FROM school_hostel_leave_pass lp JOIN school_students s ON s.id=lp.student_id
       WHERE lp.app_id=$1 AND lp.status='overdue' ORDER BY lp.to_date, lp.to_time
    `, [appId]),
    execQ(getPool(), `
      SELECT e.*, rc.call_date, rc.session, s.admission_no, s.first_name, s.last_name, s.guardian_phone
        FROM school_hostel_roll_call_entry e
        JOIN school_hostel_roll_call rc ON rc.id=e.roll_call_id
        JOIN school_students s ON s.id=e.student_id
       WHERE e.app_id=$1 AND e.status='absent' AND rc.call_date >= current_date - 7
         AND NOT EXISTS (SELECT 1 FROM school_hostel_leave_pass lp WHERE lp.app_id=$1 AND lp.student_id=e.student_id AND lp.status IN ('approved','out','returned') AND rc.call_date BETWEEN lp.from_date AND lp.to_date)
       ORDER BY rc.call_date DESC LIMIT 100
    `, [appId]),
    execQ(getPool(), `
      SELECT h.id, h.name FROM school_hostel h
       WHERE h.app_id=$1 AND h.deleted_at IS NULL AND h.status='active'
         AND NOT EXISTS (SELECT 1 FROM school_hostel_roll_call rc WHERE rc.app_id=$1 AND rc.hostel_id=h.id AND rc.call_date=current_date AND rc.session='night')
    `, [appId]),
    execQ(getPool(), `
      SELECT ve.*, v.name AS visitor_name, v.phone, s.admission_no, s.first_name, s.last_name
        FROM school_hostel_visitor_entry ve
        JOIN school_hostel_visitor v ON v.id=ve.visitor_id
        JOIN school_students s ON s.id=ve.student_id
       WHERE ve.app_id=$1 AND ve.status='checked_in' ORDER BY ve.in_time
    `, [appId]),
  ]);
  res.json({ ok: true, overduePasses: overdue, absences, missingNightRollCalls: missing, openVisits });
}));

hostelRouter.get('/hostel/night-compliance', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT h.id AS hostel_id, h.name AS hostel_name,
      count(rc.id) FILTER (WHERE rc.status IN ('submitted','locked'))::int AS taken,
      count(d.day)::int AS expected,
      round((count(rc.id) FILTER (WHERE rc.status IN ('submitted','locked'))::numeric / greatest(count(d.day),1)) * 100, 1) AS compliance_pct
      FROM school_hostel h
      CROSS JOIN generate_series(current_date - 6, current_date, interval '1 day') AS d(day)
      LEFT JOIN school_hostel_roll_call rc ON rc.hostel_id=h.id AND rc.call_date=d.day::date AND rc.session='night' AND rc.app_id=h.app_id
     WHERE h.app_id=$1 AND h.deleted_at IS NULL AND h.status='active'
     GROUP BY h.id, h.name ORDER BY h.name
  `, [appIdOf(req)]);
  res.json({ ok: true, compliance: rows });
}));

hostelRouter.post('/hostel/mess-rebates/auto', route(async (req, res) => {
  if (!guard(req, res, 'hostel.fees')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  const from = parseDay(b.fromDate) || new Date(Date.now() - 30 * 86400000);
  const to = parseDay(b.toDate) || new Date();
  const allocations = await execQ(getPool(), `
    SELECT a.*, fp.monthly_mess, mp.rebate_min_days, mp.rebate_daily_rate
      FROM school_hostel_allocation a
      JOIN school_hostel_fee_plan fp ON fp.allocation_id=a.id AND fp.is_active=true
      LEFT JOIN school_hostel_mess_plan mp ON mp.id=fp.mess_plan_id
     WHERE a.app_id=$1 AND a.deleted_at IS NULL AND a.status IN ('active','vacated')
       AND a.from_date <= $3::date AND (a.to_date IS NULL OR a.to_date >= $2::date)
  `, [appId, dayOf(from), dayOf(to)]);
  const created = [];
  for (const a of allocations) {
    const passes = await execQ(getPool(), `
      SELECT from_date, to_date FROM school_hostel_leave_pass
       WHERE app_id=$1 AND student_id=$2 AND status IN ('approved','out','returned')
         AND from_date <= $4::date AND to_date >= $3::date
    `, [appId, a.student_id, dayOf(from), dayOf(to)]);
    const awayDays = new Set();
    for (const p of passes) {
      let d = parseDay(p.from_date);
      const end = parseDay(p.to_date);
      while (d <= end) {
        if (d >= from && d <= to) awayDays.add(dayOf(d));
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }
    }
    const minDays = Number(a.rebate_min_days) || 0;
    if (awayDays.size <= minDays) continue;
    const rate = Number(a.rebate_daily_rate) > 0 ? Number(a.rebate_daily_rate) : round2((Number(a.monthly_mess) || 0) / 30);
    if (rate <= 0) continue;
    const existing = await execQ(getPool(), `
      SELECT id FROM school_hostel_mess_rebate
       WHERE app_id=$1 AND allocation_id=$2 AND status IN ('pending','approved')
         AND from_date <= $4::date AND to_date >= $3::date
    `, [appId, a.id, dayOf(from), dayOf(to)]);
    if (existing[0]) continue;
    const amount = round2((awayDays.size - minDays) * rate);
    const rebate = (await execQ(getPool(), `
      INSERT INTO school_hostel_mess_rebate (app_id, allocation_id, student_id, from_date, to_date, days, amount, reason, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'Auto rebate from approved leave','pending') RETURNING *
    `, [appId, a.id, a.student_id, dayOf(from), dayOf(to), awayDays.size - minDays, amount]))[0];
    created.push(rebate);
  }
  await writeAudit(getPool(), req, { action: 'hostel.rebate.auto', entity: 'school_hostel_mess_rebate', entityId: null, after: { created: created.length, from: dayOf(from), to: dayOf(to) } });
  res.json({ ok: true, created: created.length, rebates: created });
}));

/* ============================================================
   5. Visitors — master, authorised list, visit rules, entries,
      check-in / check-out, blacklist
   ============================================================ */
const maskId = (value) => {
  const s = String(value || '');
  if (s.length <= 4) return s ? '****' : null;
  return `${'*'.repeat(Math.max(s.length - 4, 0))}${s.slice(-4)}`;
};

hostelRouter.get('/hostel/visitors', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const q = text(req.query.q);
  const rows = await execQ(getPool(), `
    SELECT v.*,
      CASE WHEN $2::text IS NULL THEN v.id_number ELSE null END AS id_number_full
      FROM school_hostel_visitor v
     WHERE v.app_id=$1 AND v.deleted_at IS NULL
       AND ($2::text IS NULL OR $2='' OR v.name ILIKE '%'||$2||'%' OR v.phone ILIKE '%'||$2||'%')
     ORDER BY v.name LIMIT 200
  `, [appIdOf(req), q]);
  const masked = rows.map((v) => ({ ...v, id_number: maskId(v.id_number) }));
  res.json({ ok: true, visitors: masked });
}));

hostelRouter.post('/hostel/visitors', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const b = req.body || {};
  if (!text(b.name)) fail(400, 'Visitor name is required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_visitor (app_id, name, phone, id_type, id_number, photo_url, relation, address, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [appIdOf(req), text(b.name), text(b.phone), text(b.idType), text(b.idNumber), text(b.photoUrl), text(b.relation), text(b.address), b.isActive !== false]);
  await writeAudit(getPool(), req, { action: 'hostel.visitor.create', entity: 'school_hostel_visitor', entityId: rows[0].id, after: { ...rows[0], id_number: maskId(rows[0].id_number) } });
  res.json({ ok: true, visitor: rows[0] });
}));

hostelRouter.put('/hostel/visitors/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_visitor SET name=coalesce($3,name), phone=coalesce($4,phone), id_type=coalesce($5,id_type),
      id_number=coalesce($6,id_number), photo_url=coalesce($7,photo_url), relation=coalesce($8,relation),
      address=coalesce($9,address), is_active=coalesce($10,is_active), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *
  `, [appIdOf(req), id, text(b.name), text(b.phone), text(b.idType), text(b.idNumber), text(b.photoUrl),
    text(b.relation), text(b.address), b.isActive === undefined ? null : bool(b.isActive)]);
  if (!rows[0]) fail(404, 'Visitor not found');
  res.json({ ok: true, visitor: rows[0] });
}));

hostelRouter.delete('/hostel/visitors/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const rows = await execQ(getPool(), 'UPDATE school_hostel_visitor SET deleted_at=now(), is_active=false WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id', [appIdOf(req), num(req.params.id)]);
  if (!rows[0]) fail(404, 'Visitor not found');
  res.json({ ok: true });
}));

hostelRouter.get('/hostel/authorised-visitors', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const studentId = num(req.query.studentId);
  const rows = await execQ(getPool(), `
    SELECT av.*, v.name AS visitor_name, v.phone, v.relation AS visitor_relation,
      s.admission_no, s.first_name, s.last_name
      FROM school_hostel_authorised_visitor av
      JOIN school_hostel_visitor v ON v.id=av.visitor_id
      JOIN school_students s ON s.id=av.student_id
     WHERE av.app_id=$1 AND av.is_active=true
       AND ($2::int IS NULL OR av.student_id=$2)
     ORDER BY s.first_name, v.name
  `, [appIdOf(req), studentId]);
  res.json({ ok: true, authorised: rows });
}));

hostelRouter.post('/hostel/authorised-visitors', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const b = req.body || {};
  if (!num(b.studentId) || !num(b.visitorId)) fail(400, 'Student and visitor are required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_authorised_visitor (app_id, student_id, visitor_id, relation, allowed_days, valid_till, approved_by)
    VALUES ($1,$2,$3,$4,$5::text[],$6,$7)
    ON CONFLICT (app_id, student_id, visitor_id) WHERE is_active=true DO UPDATE
      SET relation=EXCLUDED.relation, allowed_days=EXCLUDED.allowed_days, valid_till=EXCLUDED.valid_till,
          approved_by=EXCLUDED.approved_by, updated_at=now()
    RETURNING *
  `, [appIdOf(req), num(b.studentId), num(b.visitorId), text(b.relation),
    Array.isArray(b.allowedDays) ? b.allowedDays.map(String) : ['0','1','2','3','4','5','6'],
    dayOf(b.validTill), userOf(req)]);
  await writeAudit(getPool(), req, { action: 'hostel.authorised_visitor.create', entity: 'school_hostel_authorised_visitor', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, authorised: rows[0] });
}));

hostelRouter.delete('/hostel/authorised-visitors/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const rows = await execQ(getPool(), 'UPDATE school_hostel_authorised_visitor SET is_active=false, updated_at=now() WHERE app_id=$1 AND id=$2 AND is_active=true RETURNING id', [appIdOf(req), num(req.params.id)]);
  if (!rows[0]) fail(404, 'Authorised visitor not found');
  res.json({ ok: true });
}));

hostelRouter.get('/hostel/visit-rules', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT vr.*, h.name AS hostel_name
      FROM school_hostel_visit_rule vr
      JOIN school_hostel h ON h.id=vr.hostel_id
     WHERE vr.app_id=$1 ORDER BY h.name
  `, [appIdOf(req)]);
  res.json({ ok: true, rules: rows });
}));

hostelRouter.post('/hostel/visit-rules', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const b = req.body || {};
  if (!num(b.hostelId)) fail(400, 'Hostel is required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_visit_rule (app_id, hostel_id, days, start_time, end_time, max_duration_min, max_visitors, areas, id_required, allow_overnight, notes, is_active)
    VALUES ($1,$2,$3::text[],coalesce(nullif($4,'')::time,'09:00'::time),coalesce(nullif($5,'')::time,'18:00'::time),$6,$7,$8::text[],$9,$10,$11,$12)
    ON CONFLICT (app_id, hostel_id) DO UPDATE SET days=EXCLUDED.days, start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time,
      max_duration_min=EXCLUDED.max_duration_min, max_visitors=EXCLUDED.max_visitors, areas=EXCLUDED.areas,
      id_required=EXCLUDED.id_required, allow_overnight=EXCLUDED.allow_overnight, notes=EXCLUDED.notes,
      is_active=EXCLUDED.is_active, updated_at=now()
    RETURNING *
  `, [appIdOf(req), num(b.hostelId),
    Array.isArray(b.days) ? b.days.map(String) : ['0','1','2','3','4','5','6'],
    text(b.startTime), text(b.endTime), num(b.maxDurationMin) || 60, num(b.maxVisitors) || 3,
    Array.isArray(b.areas) ? b.areas : ['visiting_area'], b.idRequired !== false, bool(b.allowOvernight), text(b.notes), b.isActive !== false]);
  res.json({ ok: true, rule: rows[0] });
}));

hostelRouter.put('/hostel/visit-rules/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_visit_rule SET days=coalesce($3::text[],days), start_time=coalesce(nullif($4,'')::time,start_time), end_time=coalesce(nullif($5,'')::time,end_time),
      max_duration_min=coalesce($6,max_duration_min), max_visitors=coalesce($7,max_visitors), areas=coalesce($8::text[],areas),
      id_required=coalesce($9,id_required), allow_overnight=coalesce($10,allow_overnight), notes=coalesce($11,notes),
      is_active=coalesce($12,is_active), updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), num(req.params.id), Array.isArray(b.days) ? b.days.map(String) : null,
    text(b.startTime), text(b.endTime), num(b.maxDurationMin), num(b.maxVisitors),
    Array.isArray(b.areas) ? b.areas : null, b.idRequired === undefined ? null : bool(b.idRequired),
    b.allowOvernight === undefined ? null : bool(b.allowOvernight), text(b.notes),
    b.isActive === undefined ? null : bool(b.isActive)]);
  if (!rows[0]) fail(404, 'Visit rule not found');
  res.json({ ok: true, rule: rows[0] });
}));

hostelRouter.get('/hostel/visitor-entries', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const status = text(req.query.status);
  const from = dayOf(req.query.from) || dayOf(new Date(Date.now() - 30 * 86400000));
  const to = dayOf(req.query.to) || dayOf(new Date());
  const rows = await execQ(getPool(), `
    SELECT ve.*, v.name AS visitor_name, v.phone, v.relation AS visitor_relation,
      s.admission_no, s.first_name, s.last_name, h.name AS hostel_name
      FROM school_hostel_visitor_entry ve
      JOIN school_hostel_visitor v ON v.id=ve.visitor_id
      JOIN school_students s ON s.id=ve.student_id
      LEFT JOIN school_hostel h ON h.id=ve.hostel_id
     WHERE ve.app_id=$1
       AND ($2::text IS NULL OR ve.status=$2)
       AND ve.created_at::date BETWEEN $3::date AND $4::date
     ORDER BY ve.created_at DESC LIMIT 500
  `, [appIdOf(req), status, from, to]);
  res.json({ ok: true, entries: rows });
}));

hostelRouter.post('/hostel/visitor-entries', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const b = req.body || {};
  const appId = appIdOf(req);
  if (!num(b.studentId)) fail(400, 'Student is required');
  if (!num(b.visitorId) && !text(b.visitorName)) fail(400, 'Visitor is required');
  const student = (await execQ(getPool(), 'SELECT * FROM school_students WHERE app_id=$1 AND id=$2 AND deleted_at IS NULL', [appId, num(b.studentId)]))[0];
  if (!student) fail(404, 'Student not found');
  const allocation = (await execQ(getPool(), `SELECT * FROM school_hostel_allocation WHERE app_id=$1 AND student_id=$2 AND status='active' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`, [appId, num(b.studentId)]))[0];
  const hostelId = num(b.hostelId) || allocation?.hostel_id || null;

  let visitorId = num(b.visitorId);
  if (!visitorId) {
    const created = await execQ(getPool(), `
      INSERT INTO school_hostel_visitor (app_id, name, phone, id_type, id_number, relation)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [appId, text(b.visitorName), text(b.visitorPhone), text(b.idType), text(b.idNumber), text(b.relation)]);
    visitorId = created[0].id;
  }

  const blacklisted = await execQ(getPool(), 'SELECT id, reason FROM school_hostel_blacklist WHERE app_id=$1 AND visitor_id=$2 AND is_active=true', [appId, visitorId]);
  if (blacklisted[0]) fail(400, `Visitor is blacklisted: ${blacklisted[0].reason}`);

  const authorised = await execQ(getPool(), `
    SELECT id FROM school_hostel_authorised_visitor
     WHERE app_id=$1 AND student_id=$2 AND visitor_id=$3 AND is_active=true
       AND (valid_till IS NULL OR valid_till >= current_date)
  `, [appId, num(b.studentId), visitorId]);

  let rule = null;
  if (hostelId) {
    rule = (await execQ(getPool(), 'SELECT * FROM school_hostel_visit_rule WHERE app_id=$1 AND hostel_id=$2 AND is_active=true', [appId, hostelId]))[0] || null;
  }
  const outsideHours = rule ? !rule.days.includes(String(new Date().getDay()))
    || String(b.arrivalTime || new Date().toTimeString().slice(0, 5)) < String(rule.start_time).slice(0, 5)
    || String(b.arrivalTime || new Date().toTimeString().slice(0, 5)) > String(rule.end_time).slice(0, 5) : false;
  const overnight = bool(b.overnight);
  if (overnight && !(rule?.allow_overnight)) fail(400, 'Overnight guests are not allowed by the visiting policy');
  if (rule && rule.id_required && !text(b.idNumber) && !num(b.visitorId)) fail(400, 'Visitor ID is required by the visiting policy');

  const requireApproval = await getSetting(getPool(), appId, 'visitor_require_approval', true);
  const needsApproval = !authorised[0] || outsideHours || requireApproval;
  const status = needsApproval ? 'pre_registered' : 'approved';
  const purpose = text(b.purpose) || (overnight ? 'overnight' : 'visit');

  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_visitor_entry
      (app_id, visitor_id, student_id, hostel_id, purpose, pre_registered_by, approved_by, approved_at,
       badge_no, items_carried, area, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
  `, [appId, visitorId, num(b.studentId), hostelId, purpose, userOf(req),
    needsApproval ? null : userOf(req), needsApproval ? null : new Date(),
    text(b.badgeNo), text(b.itemsCarried), text(b.area) || (rule?.areas?.[0] || 'visiting_area'), status, userOf(req)]);

  if (needsApproval) {
    await notify(getPool(), appId, { kind: 'visitor.pre_registered', studentId: num(b.studentId), title: 'Visitor awaiting approval', message: `${text(b.visitorName) || 'A visitor'} for ${student.first_name} ${student.last_name}`, severity: outsideHours ? 'warning' : 'info', recipientRole: 'warden' });
  }
  await writeAudit(getPool(), req, { action: 'hostel.visitor_entry.create', entity: 'school_hostel_visitor_entry', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, entry: rows[0], authorised: Boolean(authorised[0]), outsideHours, needsApproval });
}));

hostelRouter.post('/hostel/visitor-entries/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_visitor_entry SET status='approved', approved_by=$3, approved_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='pre_registered' RETURNING *
  `, [appIdOf(req), num(req.params.id), userOf(req)]);
  if (!rows[0]) fail(400, 'Visitor entry is not awaiting approval');
  await writeAudit(getPool(), req, { action: 'hostel.visitor_entry.approve', entity: 'school_hostel_visitor_entry', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, entry: rows[0] });
}));

hostelRouter.post('/hostel/visitor-entries/:id/check-in', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const appId = appIdOf(req);
  const id = num(req.params.id);
  const entry = (await execQ(getPool(), 'SELECT * FROM school_hostel_visitor_entry WHERE app_id=$1 AND id=$2', [appId, id]))[0];
  if (!entry) fail(404, 'Visitor entry not found');
  if (!['pre_registered', 'approved'].includes(entry.status)) fail(400, 'Visitor entry cannot be checked in');
  const blacklisted = await execQ(getPool(), 'SELECT id, reason FROM school_hostel_blacklist WHERE app_id=$1 AND visitor_id=$2 AND is_active=true', [appId, entry.visitor_id]);
  if (blacklisted[0]) fail(400, `Visitor is blacklisted: ${blacklisted[0].reason}`);
  const requireApproval = await getSetting(getPool(), appId, 'visitor_require_approval', true);
  if (entry.status === 'pre_registered' && requireApproval) fail(400, 'Visitor entry needs approval before check-in');

  const open = await execQ(getPool(), `SELECT count(*)::int AS n FROM school_hostel_visitor_entry WHERE app_id=$1 AND visitor_id=$2 AND status='checked_in'`, [appId, entry.visitor_id]);
  if (open[0].n > 0) fail(400, 'Visitor already has an open visit');

  const badge = text(req.body?.badgeNo) || entry.badge_no || `V-${String(id).padStart(4, '0')}`;
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_visitor_entry SET status='checked_in', in_time=now(), badge_no=$3, host_notified_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appId, id, badge]);
  await notify(getPool(), appId, { kind: 'visitor.arrived', studentId: entry.student_id, title: 'Visitor has arrived', message: `Badge ${badge}`, severity: 'info' });
  await writeAudit(getPool(), req, { action: 'hostel.visitor_entry.checkin', entity: 'school_hostel_visitor_entry', entityId: id, after: rows[0] });
  res.json({ ok: true, entry: rows[0] });
}));

hostelRouter.post('/hostel/visitor-entries/:id/check-out', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_visitor_entry SET status='checked_out', out_time=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status='checked_in' RETURNING *
  `, [appIdOf(req), num(req.params.id)]);
  if (!rows[0]) fail(400, 'Visitor is not checked in');
  await writeAudit(getPool(), req, { action: 'hostel.visitor_entry.checkout', entity: 'school_hostel_visitor_entry', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, entry: rows[0] });
}));

hostelRouter.post('/hostel/visitor-entries/:id/deny', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  if (!text(req.body?.reason)) fail(400, 'A denial reason is required');
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_visitor_entry SET status='denied', denial_reason=$3, approved_by=$4, approved_at=now(), updated_at=now()
     WHERE app_id=$1 AND id=$2 AND status IN ('pre_registered','approved') RETURNING *
  `, [appIdOf(req), num(req.params.id), text(req.body?.reason), userOf(req)]);
  if (!rows[0]) fail(400, 'Visitor entry cannot be denied');
  await writeAudit(getPool(), req, { action: 'hostel.visitor_entry.deny', entity: 'school_hostel_visitor_entry', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, entry: rows[0] });
}));

hostelRouter.get('/hostel/open-visits', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT ve.*, v.name AS visitor_name, v.phone, v.relation AS visitor_relation,
      s.admission_no, s.first_name, s.last_name, h.name AS hostel_name
      FROM school_hostel_visitor_entry ve
      JOIN school_hostel_visitor v ON v.id=ve.visitor_id
      JOIN school_students s ON s.id=ve.student_id
      LEFT JOIN school_hostel h ON h.id=ve.hostel_id
     WHERE ve.app_id=$1 AND ve.status='checked_in'
     ORDER BY ve.in_time
  `, [appIdOf(req)]);
  res.json({ ok: true, visits: rows });
}));

hostelRouter.get('/hostel/blacklist', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT bl.*, v.name AS visitor_name, v.phone, v.relation
      FROM school_hostel_blacklist bl
      JOIN school_hostel_visitor v ON v.id=bl.visitor_id
     WHERE bl.app_id=$1 ORDER BY bl.is_active DESC, bl.blacklisted_at DESC
  `, [appIdOf(req)]);
  res.json({ ok: true, blacklist: rows });
}));

hostelRouter.post('/hostel/blacklist', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const b = req.body || {};
  if (!num(b.visitorId) || !text(b.reason)) fail(400, 'Visitor and reason are required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_hostel_blacklist (app_id, visitor_id, reason, blacklisted_by, notes)
    VALUES ($1,$2,$3,$4,$5) RETURNING *
  `, [appIdOf(req), num(b.visitorId), text(b.reason), userOf(req), text(b.notes)]);
  await writeAudit(getPool(), req, { action: 'hostel.blacklist.create', entity: 'school_hostel_blacklist', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, blacklist: rows[0] });
}));

hostelRouter.put('/hostel/blacklist/:id', route(async (req, res) => {
  if (!guard(req, res, 'hostel.visitor')) return;
  const b = req.body || {};
  const id = num(req.params.id);
  if (b.isActive === false) {
    const rows = await execQ(getPool(), `
      UPDATE school_hostel_blacklist SET is_active=false, lifted_at=now(), lifted_by=$3, notes=coalesce($4,notes)
       WHERE app_id=$1 AND id=$2 AND is_active=true RETURNING *
    `, [appIdOf(req), id, userOf(req), text(b.notes)]);
    if (!rows[0]) fail(404, 'Active blacklist entry not found');
    await writeAudit(getPool(), req, { action: 'hostel.blacklist.lift', entity: 'school_hostel_blacklist', entityId: id, after: rows[0] });
    return res.json({ ok: true, blacklist: rows[0] });
  }
  const rows = await execQ(getPool(), `
    UPDATE school_hostel_blacklist SET reason=coalesce($3,reason), notes=coalesce($4,notes)
     WHERE app_id=$1 AND id=$2 RETURNING *
  `, [appIdOf(req), id, text(b.reason), text(b.notes)]);
  if (!rows[0]) fail(404, 'Blacklist entry not found');
  res.json({ ok: true, blacklist: rows[0] });
}));

/* ============================================================
   6. Reports and settings
   ============================================================ */
hostelRouter.get('/hostel/reports/occupancy', route(async (req, res) => {
  if (!guardView(req, res, 'hostel.reports')) return;
  const appId = appIdOf(req);
  const [byHostel, byBlock, byRoom, vacancy, waiting] = await Promise.all([
    execQ(getPool(), `
      SELECT h.id, h.name AS hostel_name, h.type,
        (SELECT count(*)::int FROM school_hostel_room r WHERE r.hostel_id=h.id AND r.deleted_at IS NULL) AS rooms,
        (SELECT count(*)::int FROM school_hostel_bed b JOIN school_hostel_room r ON r.id=b.room_id WHERE r.hostel_id=h.id AND b.deleted_at IS NULL) AS beds,
        (SELECT count(*)::int FROM school_hostel_allocation a WHERE a.hostel_id=h.id AND a.status='active' AND a.deleted_at IS NULL) AS residents
        FROM school_hostel h WHERE h.app_id=$1 AND h.deleted_at IS NULL ORDER BY h.name
    `, [appId]),
    execQ(getPool(), `
      SELECT b.id, b.name AS block_name, h.name AS hostel_name,
        (SELECT count(*)::int FROM school_hostel_room r WHERE r.block_id=b.id AND r.deleted_at IS NULL) AS rooms,
        (SELECT count(*)::int FROM school_hostel_allocation a WHERE a.block_id=b.id AND a.status='active' AND a.deleted_at IS NULL) AS residents
        FROM school_hostel_block b JOIN school_hostel h ON h.id=b.hostel_id
       WHERE b.app_id=$1 AND b.deleted_at IS NULL ORDER BY h.name, b.name
    `, [appId]),
    execQ(getPool(), `
      SELECT r.id, r.number AS room_number, h.name AS hostel_name, r.capacity, r.status,
        (SELECT count(*)::int FROM school_hostel_bed b WHERE b.room_id=r.id AND b.status='occupied' AND b.deleted_at IS NULL) AS occupied
        FROM school_hostel_room r JOIN school_hostel h ON h.id=r.hostel_id
       WHERE r.app_id=$1 AND r.deleted_at IS NULL ORDER BY h.name, r.number
    `, [appId]),
    execQ(getPool(), `
      SELECT h.name AS hostel_name, r.number AS room_number, b.bed_no, r.room_type
        FROM school_hostel_bed b JOIN school_hostel_room r ON r.id=b.room_id JOIN school_hostel h ON h.id=r.hostel_id
       WHERE b.app_id=$1 AND b.status='vacant' AND b.deleted_at IS NULL AND r.deleted_at IS NULL
       ORDER BY h.name, r.number, b.bed_no LIMIT 500
    `, [appId]),
    execQ(getPool(), `
      SELECT w.*, s.admission_no, s.first_name, s.last_name
        FROM school_hostel_waitlist w JOIN school_students s ON s.id=w.student_id
       WHERE w.app_id=$1 AND w.status='waiting' ORDER BY w.priority DESC, w.created_at
    `, [appId]),
  ]);
  res.json({ ok: true, byHostel, byBlock, byRoom, vacancy, waiting });
}));

hostelRouter.get('/hostel/reports/attendance', route(async (req, res) => {
  if (!guardView(req, res, 'hostel.reports')) return;
  const from = dayOf(req.query.from) || dayOf(new Date(Date.now() - 30 * 86400000));
  const to = dayOf(req.query.to) || dayOf(new Date());
  const rows = await execQ(getPool(), `
    SELECT rc.call_date, rc.session, h.name AS hostel_name, rc.status,
      count(e.id)::int AS total,
      count(e.id) FILTER (WHERE e.status='present')::int AS present,
      count(e.id) FILTER (WHERE e.status='absent')::int AS absent,
      count(e.id) FILTER (WHERE e.status='on_leave')::int AS on_leave,
      count(e.id) FILTER (WHERE e.status='sick_bay')::int AS sick_bay,
      count(e.id) FILTER (WHERE e.status='late')::int AS late
      FROM school_hostel_roll_call rc
      JOIN school_hostel h ON h.id=rc.hostel_id
      LEFT JOIN school_hostel_roll_call_entry e ON e.roll_call_id=rc.id
     WHERE rc.app_id=$1 AND rc.call_date BETWEEN $2::date AND $3::date
     GROUP BY rc.id, rc.call_date, rc.session, h.name, rc.status
     ORDER BY rc.call_date DESC, rc.session, h.name
  `, [appIdOf(req), from, to]);
  res.json({ ok: true, attendance: rows });
}));

hostelRouter.get('/hostel/reports/visitors', route(async (req, res) => {
  if (!guardView(req, res, 'hostel.reports')) return;
  const from = dayOf(req.query.from) || dayOf(new Date(Date.now() - 30 * 86400000));
  const to = dayOf(req.query.to) || dayOf(new Date());
  const [entries, open, blacklist] = await Promise.all([
    execQ(getPool(), `
      SELECT ve.*, v.name AS visitor_name, v.phone, s.admission_no, s.first_name, s.last_name
        FROM school_hostel_visitor_entry ve
        JOIN school_hostel_visitor v ON v.id=ve.visitor_id
        JOIN school_students s ON s.id=ve.student_id
       WHERE ve.app_id=$1 AND ve.created_at::date BETWEEN $2::date AND $3::date
       ORDER BY ve.created_at DESC LIMIT 1000
    `, [appIdOf(req), from, to]),
    execQ(getPool(), `
      SELECT ve.*, v.name AS visitor_name, s.admission_no, s.first_name, s.last_name
        FROM school_hostel_visitor_entry ve
        JOIN school_hostel_visitor v ON v.id=ve.visitor_id
        JOIN school_students s ON s.id=ve.student_id
       WHERE ve.app_id=$1 AND ve.status='checked_in' ORDER BY ve.in_time
    `, [appIdOf(req)]),
    execQ(getPool(), `
      SELECT bl.*, v.name AS visitor_name FROM school_hostel_blacklist bl
        JOIN school_hostel_visitor v ON v.id=bl.visitor_id
       WHERE bl.app_id=$1 AND bl.is_active=true ORDER BY bl.blacklisted_at DESC
    `, [appIdOf(req)]),
  ]);
  res.json({ ok: true, entries, open, blacklist });
}));

hostelRouter.get('/hostel/reports/fees', route(async (req, res) => {
  if (!guardView(req, res, 'hostel.reports')) return;
  const appId = appIdOf(req);
  const [summary, bills, deposits, rebates, dues] = await Promise.all([
    execQ(getPool(), `
      SELECT
        (SELECT coalesce(sum(total_amount),0) FROM school_hostel_bill WHERE app_id=$1 AND status='issued') AS billed,
        (SELECT coalesce(sum(total_amount),0) FROM school_hostel_bill WHERE app_id=$1 AND status='cancelled') AS cancelled,
        (SELECT coalesce(sum(amount),0) FROM school_hostel_deposit WHERE app_id=$1 AND status='held') AS deposits_held,
        (SELECT coalesce(sum(amount),0) FROM school_hostel_mess_rebate WHERE app_id=$1 AND status='approved') AS rebates
    `, [appId]),
    execQ(getPool(), `
      SELECT b.*, s.admission_no, s.first_name, s.last_name, i.number AS invoice_number, i.status AS invoice_status
        FROM school_hostel_bill b JOIN school_students s ON s.id=b.student_id
        LEFT JOIN school_invoice i ON i.id=b.invoice_id
       WHERE b.app_id=$1 ORDER BY b.period_start DESC, b.id DESC LIMIT 500
    `, [appId]),
    execQ(getPool(), `
      SELECT d.*, s.admission_no, s.first_name, s.last_name FROM school_hostel_deposit d
        JOIN school_students s ON s.id=d.student_id
       WHERE d.app_id=$1 ORDER BY d.id DESC LIMIT 500
    `, [appId]),
    execQ(getPool(), `
      SELECT r.*, s.admission_no, s.first_name, s.last_name FROM school_hostel_mess_rebate r
        JOIN school_students s ON s.id=r.student_id
       WHERE r.app_id=$1 ORDER BY r.from_date DESC LIMIT 500
    `, [appId]),
    execQ(getPool(), `
      SELECT i.id, i.number, i.date, i.due_date, i.total_amount, i.paid_amount, i.balance, i.status,
        s.admission_no, s.first_name, s.last_name
        FROM school_invoice i JOIN school_students s ON s.id=i.student_id
       WHERE i.app_id=$1 AND i.deleted_at IS NULL AND i.balance > 0 AND i.status IN ('issued','partly_paid')
         AND EXISTS (SELECT 1 FROM school_invoice_line l JOIN school_fee_head fh ON fh.id=l.head_id WHERE l.invoice_id=i.id AND fh.type IN ('hostel','deposit'))
       ORDER BY i.due_date
    `, [appId]),
  ]);
  res.json({ ok: true, summary: summary[0], bills, deposits, rebates, dues });
}));

hostelRouter.get('/hostel/reports/audit', route(async (req, res) => {
  if (!guardView(req, res, 'hostel.audit')) return;
  const from = dayOf(req.query.from) || dayOf(new Date(Date.now() - 90 * 86400000));
  const to = dayOf(req.query.to) || dayOf(new Date());
  const rows = await execQ(getPool(), `
    SELECT * FROM school_audit_log
     WHERE app_id=$1 AND entity LIKE 'school_hostel%' AND created_at::date BETWEEN $2::date AND $3::date
     ORDER BY created_at DESC LIMIT 1000
  `, [appIdOf(req), from, to]);
  res.json({ ok: true, audit: rows });
}));

hostelRouter.get('/hostel/settings', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const appId = appIdOf(req);
  await ensureSettings(getPool(), appId);
  const rows = await execQ(getPool(), 'SELECT key, value, updated_at FROM school_hostel_setting WHERE app_id=$1 ORDER BY key', [appId]);
  const settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) settings[r.key] = r.value;
  res.json({ ok: true, settings, rows });
}));

hostelRouter.put('/hostel/settings', route(async (req, res) => {
  if (!guard(req, res, 'hostel.manage')) return;
  const appId = appIdOf(req);
  const b = req.body || {};
  const incoming = b.settings && typeof b.settings === 'object' ? b.settings : b;
  const allowed = Object.keys(DEFAULT_SETTINGS);
  await withTx(async (client) => {
    for (const key of allowed) {
      if (!(key in incoming)) continue;
      await client.query(`
        INSERT INTO school_hostel_setting (app_id, key, value, updated_by, updated_at)
        VALUES ($1,$2,$3::jsonb,$4,now())
        ON CONFLICT (app_id, key) DO UPDATE SET value=EXCLUDED.value, updated_by=EXCLUDED.updated_by, updated_at=now()
      `, [appId, key, JSON.stringify(incoming[key]), userOf(req)]);
    }
  });
  await writeAudit(getPool(), req, { action: 'hostel.settings.update', entity: 'school_hostel_setting', entityId: null, after: incoming });
  const rows = await execQ(getPool(), 'SELECT key, value FROM school_hostel_setting WHERE app_id=$1 ORDER BY key', [appId]);
  const settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) settings[r.key] = r.value;
  res.json({ ok: true, settings });
}));

/* ---- router error middleware ---- */
hostelRouter.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[hostel]', err);
  res.status(status).json({ error: err.message || 'Hostel request failed' });
});

export { hostelRouter };
