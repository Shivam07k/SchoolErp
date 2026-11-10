/* ============================================================
   Canteen — backend routes
   Mounted at /api/school before the legacy comprehensive router.
   ============================================================ */
import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess, writeAudit } from '../school/foundation.js';

const canteenRouter = express.Router();

canteenRouter.use(verifyToken);
canteenRouter.use(async (req, _res, next) => {
  if (!req.school) {
    const pool = getPool();
    const appId = req.user?.company || DEFAULT_COMPANY_ID;
    await ensureFoundation(pool, appId);
    req.school = await loadAccess(pool, appId, req.user);
  }
  next();
});

const num = (v) => { if (v === undefined || v === null || v === '') return null; const n = Number(v); return Number.isNaN(n) ? null : n; };
const text = (v) => (v === undefined || v === null ? null : String(v).trim());
const bool = (v, fallback = false) => (v === undefined || v === null ? fallback : Boolean(v));
const dayOf = (v) => { if (!v) return null; if (v instanceof Date) { const y = v.getFullYear(); const m = String(v.getMonth() + 1).padStart(2, '0'); const d = String(v.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; } return String(v).slice(0, 10); };
const appIdOf = (req) => req.school?.appId || 'default';
const userOf = (req) => req.user?.userid || req.user?.id || 'system';
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

function guard(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('canteen.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
function guardView(req, res, perm = 'canteen.view') {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('canteen.view') || perms.includes('canteen.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

async function withTx(fn) {
  const client = await getPool().connect();
  try { await client.query('BEGIN'); const out = await fn(client); await client.query('COMMIT'); return out; }
  catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
  finally { client.release(); }
}

// Dashboard
canteenRouter.get('/canteen/dashboard', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const pool = getPool();
  const appId = appIdOf(req);
  const [summary] = await execQ(pool, `
    SELECT
      (SELECT count(*)::int FROM school_canteen_menu_item WHERE app_id=$1 AND deleted_at IS NULL) AS items,
      (SELECT count(*)::int FROM school_canteen_order WHERE app_id=$1 AND deleted_at IS NULL) AS orders,
      (SELECT count(*)::int FROM school_canteen_wallet WHERE app_id=$1 AND balance > 0) AS active_wallets,
      (SELECT count(*)::int FROM school_canteen_stock_item WHERE app_id=$1 AND current_qty <= reorder_level AND deleted_at IS NULL) AS low_stock
  `, [appId]);
  res.json({ ok: true, summary });
}));

// Menu items
canteenRouter.get('/canteen/menu-items', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_canteen_menu_item WHERE app_id=$1 AND deleted_at IS NULL ORDER BY name`, [appIdOf(req)]);
  res.json({ ok: true, items: rows });
}));

canteenRouter.post('/canteen/menu-items', route(async (req, res) => {
  if (!guard(req, res, 'canteen.menu')) return;
  const b = req.body || {};
  if (!text(b.name)) fail(400, 'Item name required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_canteen_menu_item
      (app_id, item_code, name, category, description, unit, price, is_active, allergen_tags, dietary_tags, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10::text[],$11) RETURNING *
  `, [appIdOf(req), text(b.itemCode) || `ITEM-${Date.now()}`, text(b.name), text(b.category), text(b.description),
    text(b.unit), num(b.price) || 0, bool(b.isActive ?? b.active, true),
    Array.isArray(b.allergenTags) ? b.allergenTags : (text(b.allergens) ? [text(b.allergens)] : []),
    Array.isArray(b.dietaryTags) ? b.dietaryTags : [], text(b.notes)]);
  await writeAudit(getPool(), req, { action: 'canteen.menu_item.create', entity: 'school_canteen_menu_item', entityId: rows[0].id, after: rows[0] });
  res.json({ ok: true, item: rows[0] });
}));

// Orders
canteenRouter.get('/canteen/orders', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `
    SELECT o.*, 
      COALESCE(s.first_name || ' ' || s.last_name, st.name) AS customer_name
    FROM school_canteen_order o
    LEFT JOIN school_students s ON s.id=o.student_id
    LEFT JOIN school_staff st ON st.id=o.student_id AND o.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM school_students WHERE id=o.student_id)
    WHERE o.app_id=$1 AND o.deleted_at IS NULL
    ORDER BY o.created_at DESC LIMIT 200
  `, [appIdOf(req)]);
  res.json({ ok: true, orders: rows });
}));

canteenRouter.post('/canteen/orders', route(async (req, res) => {
  if (!guard(req, res, 'canteen.orders')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    INSERT INTO school_canteen_order
      (app_id, order_no, student_id, order_date, order_type, status, total_amount, idempotency_key, notes, created_by)
    VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5,$6,$7,$8,$9,$10) RETURNING *
  `, [appIdOf(req), text(b.orderNo) || `ORD-${Date.now()}`, num(b.studentId),
    b.orderDate ? String(b.orderDate).slice(0, 10) : null,
    text(b.orderType) || text(b.channel) || 'pos', text(b.status) || 'placed',
    num(b.totalAmount ?? b.total) || 0, text(b.idempotencyKey) || text(b.token), text(b.notes), userOf(req)]);
  res.json({ ok: true, order: rows[0] });
}));

// Bills
canteenRouter.get('/canteen/bills', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_canteen_bill WHERE app_id=$1 ORDER BY created_at DESC LIMIT 200`, [appIdOf(req)]);
  res.json({ ok: true, bills: rows });
}));

canteenRouter.post('/canteen/bills', route(async (req, res) => {
  if (!guard(req, res, 'canteen.billing')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), `
    INSERT INTO school_canteen_bill (app_id, bill_no, order_id, bill_date, amount, payment_mode, status, notes)
    VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5,$6,$7,$8) RETURNING *
  `, [appIdOf(req), text(b.billNo) || `BILL-${Date.now()}`, num(b.orderId),
    b.billDate ? String(b.billDate).slice(0, 10) : null,
    num(b.amount ?? b.total) || 0, text(b.paymentMode) || 'wallet', text(b.status) || 'paid', text(b.notes)]);
  res.json({ ok: true, bill: rows[0] });
}));

// Inventory items
canteenRouter.get('/canteen/stock-items', route(async (req, res) => {
  if (!guardView(req, res)) return;
  const rows = await execQ(getPool(), `SELECT * FROM school_canteen_stock_item WHERE app_id=$1 AND deleted_at IS NULL ORDER BY name`, [appIdOf(req)]);
  res.json({ ok: true, items: rows });
}));

canteenRouter.post('/canteen/stock-items', route(async (req, res) => {
  if (!guard(req, res, 'canteen.inventory')) return;
  const b = req.body || {};
  if (!text(b.name)) fail(400, 'Item name required');
  const rows = await execQ(getPool(), `
    INSERT INTO school_canteen_stock_item (app_id, stock_code, name, unit, reorder_level, current_qty, is_active, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [appIdOf(req), text(b.stockCode) || text(b.code) || `STK-${Date.now()}`, text(b.name), text(b.unit) || 'pcs',
    num(b.reorderLevel) || 0, num(b.currentQty) || 0, b.isActive !== false,
    text(b.notes) || (text(b.category) ? `Category: ${text(b.category)}` : null)]);
  res.json({ ok: true, item: rows[0] });
}));

export { canteenRouter };