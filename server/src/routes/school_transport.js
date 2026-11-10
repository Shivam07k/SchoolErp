import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess } from '../school/foundation.js';

const transRouter = express.Router();
transRouter.use(verifyToken);
transRouter.use(async (req, _res, next) => {
  if (!req.school) {
    const pool = getPool();
    const appId = req.user?.company || DEFAULT_COMPANY_ID;
    await ensureFoundation(pool, appId);
    req.school = await loadAccess(pool, appId, req.user);
  }
  next();
});

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const text = (v) => (v === undefined || v === null ? null : String(v).trim());
const appIdOf = (req) => req.school?.appId || 'default';
const userOf = (req) => req.user?.userid || req.user?.id || 'system';
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function guard(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('transport.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
function guardView(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('transport.view') || perms.includes('transport.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

transRouter.get('/transport/routes', route(async (req, res) => {
  if (!guardView(req, res, 'transport.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_trans_route WHERE app_id=$1 ORDER BY name', [appIdOf(req)]);
  res.json({ ok: true, routes: rows });
}));
transRouter.post('/transport/routes', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_trans_route (app_id,code,name,direction,campus_id,is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [appIdOf(req), text(b.code), text(b.name), text(b.direction)||'both', num(b.campusId), b.isActive!==false]);
  res.json({ ok: true, route: rows[0] });
}));

transRouter.get('/transport/stops', route(async (req, res) => {
  if (!guardView(req, res, 'transport.view')) return;
  const rows = await execQ(getPool(), 'SELECT s.*, z.name as zone_name FROM school_trans_stop s LEFT JOIN school_trans_zone z ON z.id=s.zone_id WHERE s.app_id=$1 ORDER BY s.name', [appIdOf(req)]);
  res.json({ ok: true, stops: rows });
}));
transRouter.post('/transport/stops', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_trans_stop (app_id,name,lat,lng,landmark,zone_id,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [appIdOf(req), text(b.name), num(b.lat), num(b.lng), text(b.landmark), num(b.zoneId), b.isActive!==false]);
  res.json({ ok: true, stop: rows[0] });
}));
transRouter.get('/transport/zones', route(async (req, res) => {
  if (!guardView(req, res, 'transport.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_trans_zone WHERE app_id=$1 ORDER BY name', [appIdOf(req)]);
  res.json({ ok: true, zones: rows });
}));
transRouter.post('/transport/zones', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_trans_zone (app_id,name,fee_amount,is_active) VALUES ($1,$2,$3,$4) RETURNING *', [appIdOf(req), text(b.name), num(b.feeAmount)||0, b.isActive!==false]);
  res.json({ ok: true, zone: rows[0] });
}));

transRouter.get('/transport/vehicles', route(async (req, res) => {
  if (!guardView(req, res, 'transport.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_trans_vehicle WHERE app_id=$1 ORDER BY reg_no', [appIdOf(req)]);
  res.json({ ok: true, vehicles: rows });
}));
transRouter.post('/transport/vehicles', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_trans_vehicle (app_id,reg_no,type,make,year,capacity,ownership,gps_device_id,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [appIdOf(req), text(b.regNo), text(b.type), text(b.make), num(b.year), num(b.capacity)||0, text(b.ownership)||'own', text(b.gpsDeviceId), text(b.status)||'active']);
  res.json({ ok: true, vehicle: rows[0] });
}));

transRouter.get('/transport/drivers', route(async (req, res) => {
  if (!guardView(req, res, 'transport.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_trans_driver WHERE app_id=$1 ORDER BY name', [appIdOf(req)]);
  res.json({ ok: true, drivers: rows });
}));
transRouter.post('/transport/drivers', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_trans_driver (app_id,staff_id,name,phone,licence_no,licence_class,licence_expiry,medical_date,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [appIdOf(req), num(b.staffId), text(b.name), text(b.phone), text(b.licenceNo), text(b.licenceClass), b.licenceExpiry||null, b.medicalDate||null, text(b.status)||'active']);
  res.json({ ok: true, driver: rows[0] });
}));
transRouter.get('/transport/attendants', route(async (req, res) => {
  if (!guardView(req, res, 'transport.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_trans_attendant WHERE app_id=$1 ORDER BY name', [appIdOf(req)]);
  res.json({ ok: true, attendants: rows });
}));
transRouter.post('/transport/attendants', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_trans_attendant (app_id,staff_id,name,phone,status) VALUES ($1,$2,$3,$4,$5) RETURNING *', [appIdOf(req), num(b.staffId), text(b.name), text(b.phone), text(b.status)||'active']);
  res.json({ ok: true, attendant: rows[0] });
}));

transRouter.get('/transport/trips', route(async (req, res) => {
  if (!guardView(req, res, 'transport.view')) return;
  const rows = await execQ(getPool(), 'SELECT t.*, r.name as route_name FROM school_trans_trip t LEFT JOIN school_trans_route r ON r.id=t.route_id WHERE t.app_id=$1 ORDER BY t.id', [appIdOf(req)]);
  res.json({ ok: true, trips: rows });
}));
transRouter.post('/transport/trips', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_trans_trip (app_id,route_id,trip_type,start_time,end_time,weekdays,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [appIdOf(req), num(b.routeId), text(b.tripType)||'morning', b.startTime||null, b.endTime||null, text(b.weekdays)||'1111100', b.isActive!==false]);
  res.json({ ok: true, trip: rows[0] });
}));
transRouter.get('/transport/assignments', route(async (req, res) => {
  if (!guardView(req, res, 'transport.view')) return;
  const rows = await execQ(getPool(), 'SELECT a.*, t.trip_type, r.name as route_name, v.reg_no, d.name as driver_name, at.name as attendant_name FROM school_trans_trip_assign a LEFT JOIN school_trans_trip t ON t.id=a.trip_id LEFT JOIN school_trans_route r ON r.id=t.route_id LEFT JOIN school_trans_vehicle v ON v.id=a.vehicle_id LEFT JOIN school_trans_driver d ON d.id=a.driver_id LEFT JOIN school_trans_attendant at ON at.id=a.attendant_id ORDER BY a.id DESC', []);
  res.json({ ok: true, assignments: rows });
}));
transRouter.post('/transport/assignments', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_trans_trip_assign (trip_id,vehicle_id,driver_id,attendant_id,effective_from,effective_to,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [num(b.tripId), num(b.vehicleId), num(b.driverId), num(b.attendantId), b.effectiveFrom||new Date(), b.effectiveTo||null, text(b.status)||'active']);
  res.json({ ok: true, assignment: rows[0] });
}));

transRouter.get('/transport/allocations', route(async (req, res) => {
  if (!guardView(req, res, 'transport.view')) return;
  const rows = await execQ(getPool(), 'SELECT a.*, s.admission_no, s.first_name, s.last_name, r.name as route_name, p.name as pick_stop, d.name as drop_stop FROM school_trans_allocation a LEFT JOIN school_students s ON s.id=a.student_id LEFT JOIN school_trans_route r ON r.id=a.route_id LEFT JOIN school_trans_stop p ON p.id=a.pick_stop_id LEFT JOIN school_trans_stop d ON d.id=a.drop_stop_id WHERE a.app_id=$1 AND a.status=\'active\' ORDER BY a.id DESC', [appIdOf(req)]);
  res.json({ ok: true, allocations: rows });
}));
transRouter.post('/transport/allocations', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_trans_allocation (app_id,student_id,route_id,trip_id,pick_stop_id,drop_stop_id,seat_no,fee_zone_id,from_date,status,approved_by,approved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()) RETURNING *', [appIdOf(req), num(b.studentId), num(b.routeId), num(b.tripId), num(b.pickStopId), num(b.dropStopId), text(b.seatNo), num(b.feeZoneId), b.fromDate||new Date(), text(b.status)||'active', userOf(req)]);
  res.json({ ok: true, allocation: rows[0] });
}));
transRouter.get('/transport/requests', route(async (req, res) => {
  if (!guardView(req, res, 'transport.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_trans_allocation_req WHERE app_id=$1 ORDER BY id DESC', [appIdOf(req)]);
  res.json({ ok: true, requests: rows });
}));
transRouter.post('/transport/requests', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_trans_allocation_req (app_id,student_id,req_type,route_id,pick_stop_id,drop_stop_id,effective_date,reason,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [appIdOf(req), num(b.studentId), text(b.reqType), num(b.routeId), num(b.pickStopId), num(b.dropStopId), b.effectiveDate||new Date(), text(b.reason), 'pending']);
  res.json({ ok: true, request: rows[0] });
}));
transRouter.put('/transport/requests/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const rows = await execQ(getPool(), 'UPDATE school_trans_allocation_req SET status=\'approved\', approved_by=$3, approved_at=now() WHERE app_id=$1 AND id=$2 RETURNING *', [appIdOf(req), num(req.params.id), userOf(req)]);
  res.json({ ok: true, request: rows[0] });
}));

transRouter.get('/transport/trips/runs', route(async (req, res) => {
  if (!guardView(req, res, 'transport.view')) return;
  const rows = await execQ(getPool(), 'SELECT tr.*, t.trip_type, r.name as route_name, v.reg_no FROM school_trans_trip_run tr LEFT JOIN school_trans_trip t ON t.id=tr.trip_id LEFT JOIN school_trans_route r ON r.id=t.route_id LEFT JOIN school_trans_vehicle v ON v.id=tr.vehicle_id WHERE tr.app_id=$1 ORDER BY tr.run_date DESC, tr.id DESC', [appIdOf(req)]);
  res.json({ ok: true, runs: rows });
}));
transRouter.post('/transport/trips/runs/start', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_trans_trip_run (app_id,trip_id,run_date,vehicle_id,driver_id,attendant_id,status,started_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now()) RETURNING *', [appIdOf(req), num(b.tripId), b.runDate||new Date(), num(b.vehicleId), num(b.driverId), num(b.attendantId), 'running']);
  res.json({ ok: true, run: rows[0] });
}));
transRouter.post('/transport/trips/runs/:id/end', route(async (req, res) => {
  if (!guard(req, res, 'transport.manage')) return;
  const rows = await execQ(getPool(), 'UPDATE school_trans_trip_run SET status=\'completed\', ended_at=now() WHERE app_id=$1 AND id=$2 RETURNING *', [appIdOf(req), num(req.params.id)]);
  res.json({ ok: true, run: rows[0] });
}));
transRouter.post('/transport/ping', route(async (req, res) => {
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_trans_location_ping (app_id,trip_run_id,device_id,vehicle_id,lat,lng,speed,heading,ping_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now()) RETURNING *', [appIdOf(req), num(b.tripRunId), text(b.deviceId), num(b.vehicleId), num(b.lat), num(b.lng), num(b.speed), num(b.heading)]);
  res.json({ ok: true, ping: rows[0] });
}));
transRouter.get('/transport/alerts', route(async (req, res) => {
  if (!guardView(req, res, 'transport.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_trans_alert WHERE app_id=$1 ORDER BY alert_at DESC LIMIT 100', [appIdOf(req)]);
  res.json({ ok: true, alerts: rows });
}));

export { transRouter };
