import express from 'express';
import { getPool } from '../db/pool.js';
import { execQ } from '../db/sp.js';
import { verifyToken } from '../middleware/auth.js';
import { DEFAULT_COMPANY_ID } from '../config/companies.js';
import { ensureFoundation, loadAccess } from '../school/foundation.js';

const invRouter = express.Router();
invRouter.use(verifyToken);
invRouter.use(async (req, _res, next) => {
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
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('inventory.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
function guardView(req, res, perm) {
  if (!req.school || !req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const perms = req.school.permissions || [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || perms.includes('inventory.view') || perms.includes('inventory.manage')) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

function genNo(prefix, rows) {
  const n = (rows && rows[0] && rows[0].n) ? rows[0].n + 1 : 1;
  return prefix + String(n).padStart(6, '0');
}

invRouter.get('/inventory/stores', route(async (req, res) => {
  if (!guardView(req, res, 'inventory.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_inv_store WHERE app_id=$1 ORDER BY name', [appIdOf(req)]);
  res.json({ ok: true, stores: rows });
}));
invRouter.post('/inventory/stores', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_inv_store (app_id,name,type,incharge_user_id,location,is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [appIdOf(req), text(b.name), text(b.type)||'central', text(b.inchargeUserId), text(b.location), b.isActive!==false]);
  res.json({ ok: true, store: rows[0] });
}));

invRouter.get('/inventory/categories', route(async (req, res) => {
  if (!guardView(req, res, 'inventory.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_inv_category WHERE app_id=$1 ORDER BY name', [appIdOf(req)]);
  res.json({ ok: true, categories: rows });
}));
invRouter.post('/inventory/categories', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_inv_category (app_id,name,parent_id,type,is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *', [appIdOf(req), text(b.name), num(b.parentId), text(b.type)||'consumable', b.isActive!==false]);
  res.json({ ok: true, category: rows[0] });
}));

invRouter.get('/inventory/items', route(async (req, res) => {
  if (!guardView(req, res, 'inventory.view')) return;
  const rows = await execQ(getPool(), 'SELECT i.*, c.name as category_name FROM school_inv_item i LEFT JOIN school_inv_category c ON c.id=i.category_id WHERE i.app_id=$1 ORDER BY i.name', [appIdOf(req)]);
  res.json({ ok: true, items: rows });
}));
invRouter.post('/inventory/items', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_inv_item (app_id,code,name,category_id,unit,tracking_type,reorder_level,reorder_qty,min_qty,batch_required,expiry_required,valuation_method,barcode,is_active,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *', [appIdOf(req), text(b.code), text(b.name), num(b.categoryId), text(b.unit)||'pcs', text(b.trackingType)||'consumable', num(b.reorderLevel)||0, num(b.reorderQty)||0, num(b.minQty)||0, b.batchRequired===true, b.expiryRequired===true, text(b.valuationMethod)||'avg', text(b.barcode), b.isActive!==false, userOf(req)]);
  res.json({ ok: true, item: rows[0] });
}));
invRouter.put('/inventory/items/:id', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'UPDATE school_inv_item SET name=$3,category_id=$4,unit=$5,tracking_type=$6,reorder_level=$7,reorder_qty=$8,min_qty=$9,batch_required=$10,expiry_required=$11,barcode=$12,is_active=$13,updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *', [appIdOf(req), num(req.params.id), text(b.name), num(b.categoryId), text(b.unit)||'pcs', text(b.trackingType)||'consumable', num(b.reorderLevel)||0, num(b.reorderQty)||0, num(b.minQty)||0, b.batchRequired===true, b.expiryRequired===true, text(b.barcode), b.isActive!==false]);
  res.json({ ok: true, item: rows[0] });
}));

invRouter.get('/inventory/vendors', route(async (req, res) => {
  if (!guardView(req, res, 'inventory.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_inv_vendor WHERE app_id=$1 ORDER BY name', [appIdOf(req)]);
  res.json({ ok: true, vendors: rows });
}));
invRouter.post('/inventory/vendors', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_inv_vendor (app_id,name,contact_person,phone,email,address,gstin,is_approved,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [appIdOf(req), text(b.name), text(b.contactPerson), text(b.phone), text(b.email), text(b.address), text(b.gstin), b.isApproved!==false, b.isActive!==false]);
  res.json({ ok: true, vendor: rows[0] });
}));

invRouter.get('/inventory/indents', route(async (req, res) => {
  if (!guardView(req, res, 'inventory.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_inv_indent WHERE app_id=$1 ORDER BY id DESC', [appIdOf(req)]);
  res.json({ ok: true, indents: rows });
}));
invRouter.post('/inventory/indents', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const pool = getPool(); const appId = appIdOf(req);
  const cnt = await execQ(pool, 'SELECT COUNT(*)::int as n FROM school_inv_indent WHERE app_id=$1', [appId]);
  const indentNo = genNo('IND', cnt);
  const b = req.body || {};
  const rows = await execQ(pool, 'INSERT INTO school_inv_indent (app_id,indent_no,requester_user_id,department,store_id,status,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [appId, indentNo, userOf(req), text(b.department), num(b.storeId), 'submitted', text(b.notes), userOf(req)]);
  const indent = rows[0];
  const lines = Array.isArray(b.lines) ? b.lines : [];
  for (const l of lines) {
    if (!num(l.itemId) || !num(l.qty)) continue;
    await execQ(pool, 'INSERT INTO school_inv_indent_line (indent_id,item_id,qty,approx_rate,reason) VALUES ($1,$2,$3,$4,$5)', [indent.id, num(l.itemId), num(l.qty), num(l.approxRate), text(l.reason)]);
  }
  res.json({ ok: true, indent });
}));
invRouter.put('/inventory/indents/:id/approve', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const rows = await execQ(getPool(), 'UPDATE school_inv_indent SET status=\'approved\', approved_by=$3, approved_at=now(), updated_at=now() WHERE app_id=$1 AND id=$2 RETURNING *', [appIdOf(req), num(req.params.id), userOf(req)]);
  res.json({ ok: true, indent: rows[0] });
}));

invRouter.get('/inventory/pos', route(async (req, res) => {
  if (!guardView(req, res, 'inventory.view')) return;
  const rows = await execQ(getPool(), 'SELECT po.*, v.name as vendor_name FROM school_inv_po po LEFT JOIN school_inv_vendor v ON v.id=po.vendor_id WHERE po.app_id=$1 ORDER BY po.id DESC', [appIdOf(req)]);
  res.json({ ok: true, pos: rows });
}));
invRouter.post('/inventory/pos', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const pool = getPool(); const appId = appIdOf(req);
  const cnt = await execQ(pool, 'SELECT COUNT(*)::int as n FROM school_inv_po WHERE app_id=$1', [appId]);
  const poNo = genNo('PO', cnt);
  const b = req.body || {};
  const subtotal = num(b.subtotal)||0, tax = num(b.tax)||0, total = num(b.total)||(subtotal+tax);
  const rows = await execQ(pool, 'INSERT INTO school_inv_po (app_id,po_no,indent_id,vendor_id,store_id,order_date,expected_date,status,terms,notes,subtotal,tax,total,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *', [appId, poNo, num(b.indentId), num(b.vendorId), num(b.storeId), b.orderDate||new Date(), b.expectedDate||null, b.status||'approved', text(b.terms), text(b.notes), subtotal, tax, total, userOf(req)]);
  const po = rows[0];
  const lines = Array.isArray(b.lines) ? b.lines : [];
  for (const l of lines) {
    if (!num(l.itemId) || !num(l.qty)) continue;
    const qty = num(l.qty), rate = num(l.rate)||0, taxr = num(l.taxRate)||0;
    const amount = qty*rate + (qty*rate*taxr/100);
    await execQ(pool, 'INSERT INTO school_inv_po_line (po_id,item_id,qty,rate,tax_rate,amount) VALUES ($1,$2,$3,$4,$5,$6)', [po.id, num(l.itemId), qty, rate, taxr, amount]);
  }
  res.json({ ok: true, po });
}));

invRouter.get('/inventory/grns', route(async (req, res) => {
  if (!guardView(req, res, 'inventory.view')) return;
  const rows = await execQ(getPool(), 'SELECT g.*, po.po_no, v.name as vendor_name FROM school_inv_grn g LEFT JOIN school_inv_po po ON po.id=g.po_id LEFT JOIN school_inv_vendor v ON v.id=g.vendor_id WHERE g.app_id=$1 ORDER BY g.id DESC', [appIdOf(req)]);
  res.json({ ok: true, grns: rows });
}));
invRouter.post('/inventory/grns', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const pool = getPool(); const appId = appIdOf(req);
  const cnt = await execQ(pool, 'SELECT COUNT(*)::int as n FROM school_inv_grn WHERE app_id=$1', [appId]);
  const grnNo = genNo('GRN', cnt);
  const b = req.body || {};
  const poId = num(b.poId); const vendorId = num(b.vendorId); const storeId = num(b.storeId);
  const rows = await execQ(pool, 'INSERT INTO school_inv_grn (app_id,grn_no,po_id,vendor_id,store_id,grn_date,challan_no,received_by,status,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [appId, grnNo, poId, vendorId, storeId, b.grnDate||new Date(), text(b.challanNo), userOf(req), 'received', text(b.notes), userOf(req)]);
  const grn = rows[0];
  const lines = Array.isArray(b.lines) ? b.lines : [];
  for (const l of lines) {
    if (!num(l.itemId) || !num(l.receivedQty)) continue;
    const rqty = num(l.receivedQty), aqty = num(l.acceptedQty) !== null && num(l.acceptedQty) !== undefined ? num(l.acceptedQty) : rqty, rej = num(l.rejectedQty)||0, rate = num(l.rate)||0;
    await execQ(pool, 'INSERT INTO school_inv_grn_line (grn_id,po_line_id,item_id,ordered_qty,received_qty,accepted_qty,rejected_qty,rate,batch_no,expiry_date,serial_no) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [grn.id, num(l.poLineId), num(l.itemId), num(l.orderedQty)||0, rqty, aqty, rej, rate, text(l.batchNo), b.expiryDate||null, text(l.serialNo)]);
    if (aqty > 0) {
      await execQ(pool, 'INSERT INTO school_inv_stock_ledger (app_id,item_id,store_id,type,qty_in,rate,value,batch_no,expiry_date,ref_table,ref_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [appId, num(l.itemId), storeId, 'receipt', aqty, rate, aqty*rate, text(l.batchNo), b.expiryDate||null, 'grn', grn.id, userOf(req)]);
    }
  }
  if (poId) await execQ(pool, 'UPDATE school_inv_po SET status=\'partly_received\', updated_at=now() WHERE id=$1', [poId]);
  res.json({ ok: true, grn });
}));

invRouter.get('/inventory/issues', route(async (req, res) => {
  if (!guardView(req, res, 'inventory.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_inv_issue WHERE app_id=$1 ORDER BY id DESC', [appIdOf(req)]);
  res.json({ ok: true, issues: rows });
}));
invRouter.post('/inventory/issues', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const pool = getPool(); const appId = appIdOf(req);
  const cnt = await execQ(pool, 'SELECT COUNT(*)::int as n FROM school_inv_issue WHERE app_id=$1', [appId]);
  const issueNo = genNo('ISS', cnt);
  const b = req.body || {};
  const rows = await execQ(pool, 'INSERT INTO school_inv_issue (app_id,issue_no,store_id,issued_to_type,issued_to_id,issued_to_name,issue_date,expected_return_date,status,purpose,issued_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [appId, issueNo, num(b.storeId), text(b.issuedToType), text(b.issuedToId), text(b.issuedToName), b.issueDate||new Date(), b.expectedReturnDate||null, 'issued', text(b.purpose), userOf(req)]);
  const issue = rows[0];
  const lines = Array.isArray(b.lines) ? b.lines : [];
  for (const l of lines) {
    if (!num(l.itemId) || !num(l.qty)) continue;
    await execQ(pool, 'INSERT INTO school_inv_issue_line (issue_id,item_id,qty,returnable) VALUES ($1,$2,$3,$4)', [issue.id, num(l.itemId), num(l.qty), (b.issuedToType==='staff' || b.returnable===true)]);
    await execQ(pool, 'INSERT INTO school_inv_stock_ledger (app_id,item_id,store_id,type,qty_out,rate,value,ref_table,ref_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [appId, num(l.itemId), num(b.storeId), 'issue', num(l.qty), 0, 0, 'issue', issue.id, userOf(req)]);
  }
  res.json({ ok: true, issue });
}));

invRouter.get('/inventory/returns', route(async (req, res) => {
  if (!guardView(req, res, 'inventory.view')) return;
  const rows = await execQ(getPool(), 'SELECT * FROM school_inv_return WHERE app_id=$1 ORDER BY id DESC', [appIdOf(req)]);
  res.json({ ok: true, returns: rows });
}));
invRouter.post('/inventory/returns', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const pool = getPool(); const appId = appIdOf(req);
  const cnt = await execQ(pool, 'SELECT COUNT(*)::int as n FROM school_inv_return WHERE app_id=$1', [appId]);
  const retNo = genNo('RET', cnt);
  const b = req.body || {};
  const rows = await execQ(pool, 'INSERT INTO school_inv_return (app_id,return_no,issue_id,store_id,return_date,received_by,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [appId, retNo, num(b.issueId), num(b.storeId), b.returnDate||new Date(), userOf(req), text(b.notes)]);
  const ret = rows[0];
  const lines = Array.isArray(b.lines) ? b.lines : [];
  for (const l of lines) {
    if (!num(l.itemId) || !num(l.qty)) continue;
    await execQ(pool, 'INSERT INTO school_inv_return_line (return_id,issue_line_id,item_id,qty,condition) VALUES ($1,$2,$3,$4,$5)', [ret.id, num(l.issueLineId), num(l.itemId), num(l.qty), text(l.condition)||'good']);
    await execQ(pool, 'INSERT INTO school_inv_stock_ledger (app_id,item_id,store_id,type,qty_in,rate,value,ref_table,ref_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [appId, num(l.itemId), num(b.storeId), 'return_in', num(l.qty), 0, 0, 'return', ret.id, userOf(req)]);
    if (num(l.issueLineId)) await execQ(pool, 'UPDATE school_inv_issue_line SET returned_qty = COALESCE(returned_qty,0)+$2 WHERE id=$1', [num(l.issueLineId), num(l.qty)]);
  }
  res.json({ ok: true, ret });
}));

invRouter.get('/inventory/assets', route(async (req, res) => {
  if (!guardView(req, res, 'inventory.view')) return;
  const rows = await execQ(getPool(), 'SELECT a.*, i.name as item_name, c.name as category_name FROM school_inv_asset a LEFT JOIN school_inv_item i ON i.id=a.item_id LEFT JOIN school_inv_category c ON c.id=a.category_id WHERE a.app_id=$1 ORDER BY a.id DESC', [appIdOf(req)]);
  res.json({ ok: true, assets: rows });
}));
invRouter.post('/inventory/assets', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_inv_asset (app_id,tag_no,item_id,category_id,serial_no,grn_id,grn_line_id,purchase_date,cost,vendor_id,store_id,location,room_id,custodian_user_id,department,status,condition,warranty_end,capitalisation_date,depreciation_method,life_years,rate,salvage_value,book_value) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *', [appIdOf(req), text(b.tagNo)||('AST'+Date.now()), num(b.itemId), num(b.categoryId), text(b.serialNo), num(b.grnId), num(b.grnLineId), b.purchaseDate||null, num(b.cost)||0, num(b.vendorId), num(b.storeId), text(b.location), num(b.roomId), text(b.custodianUserId), text(b.department), text(b.status)||'in_use', text(b.condition)||'good', b.warrantyEnd||null, b.capitalisationDate||b.purchaseDate||null, text(b.depreciationMethod)||'slm', num(b.lifeYears)||0, num(b.rate)||0, num(b.salvageValue)||0, num(b.cost)||0]);
  res.json({ ok: true, asset: rows[0] });
}));
invRouter.put('/inventory/assets/:id/move', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const pool = getPool(); const appId = appIdOf(req); const assetId = num(req.params.id); const b = req.body || {};
  const cur = await execQ(pool, 'SELECT * FROM school_inv_asset WHERE app_id=$1 AND id=$2', [appId, assetId]);
  const a = cur[0] || {};
  await execQ(pool, 'INSERT INTO school_inv_asset_movement (asset_id,app_id,from_location,to_location,from_custodian,to_custodian,moved_by,reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [assetId, appId, a.location, text(b.toLocation), a.custodian_user_id, text(b.toCustodian), userOf(req), text(b.reason)]);
  const rows = await execQ(pool, 'UPDATE school_inv_asset SET location=$1,custodian_user_id=$2,room_id=$3,updated_at=now() WHERE app_id=$4 AND id=$5 RETURNING *', [text(b.toLocation)||a.location, text(b.toCustodian)||a.custodian_user_id, num(b.roomId)||a.room_id, appId, assetId]);
  res.json({ ok: true, asset: rows[0] });
}));
invRouter.post('/inventory/assets/:id/maintenance', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const b = req.body || {};
  const rows = await execQ(getPool(), 'INSERT INTO school_inv_asset_maintenance (asset_id,app_id,type,task,vendor_id,scheduled_date,cost,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [num(req.params.id), appIdOf(req), text(b.type)||'preventive', text(b.task), num(b.vendorId), b.scheduledDate||null, num(b.cost)||0, text(b.notes)]);
  res.json({ ok: true, maintenance: rows[0] });
}));
invRouter.post('/inventory/assets/:id/dispose', route(async (req, res) => {
  if (!guard(req, res, 'inventory.manage')) return;
  const pool = getPool(); const appId = appIdOf(req); const assetId = num(req.params.id); const b = req.body || {};
  const rows = await execQ(pool, 'INSERT INTO school_inv_asset_disposal (asset_id,app_id,disposal_type,disposal_date,proceeds,reason,approved_by,approved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now()) RETURNING *', [assetId, appId, text(b.disposalType)||'scrap', b.disposalDate||new Date(), num(b.proceeds)||0, text(b.reason), userOf(req)]);
  await execQ(pool, 'UPDATE school_inv_asset SET status=\'disposed\', disposed_at=now(), updated_at=now() WHERE app_id=$1 AND id=$2', [appId, assetId]);
  res.json({ ok: true, disposal: rows[0] });
}));

invRouter.get('/inventory/stock', route(async (req, res) => {
  if (!guardView(req, res, 'inventory.view')) return;
  const pool = getPool(); const appId = appIdOf(req);
  const storeId = num(req.query.storeId);
  const where = ['l.app_id=$1'];
  const vals = [appId];
  if (storeId) { vals.push(storeId); where.push('l.store_id=$'+vals.length); }
  const sql = 'SELECT l.item_id, l.store_id, s.name as store_name, i.code, i.name as item_name, i.unit, i.tracking_type, i.reorder_level, COALESCE(SUM(l.qty_in),0)-COALESCE(SUM(l.qty_out),0) as on_hand FROM school_inv_stock_ledger l LEFT JOIN school_inv_store s ON s.id=l.store_id LEFT JOIN school_inv_item i ON i.id=l.item_id WHERE '+where.join(' AND ')+' GROUP BY l.item_id,l.store_id,s.name,i.code,i.name,i.unit,i.tracking_type,i.reorder_level ORDER BY i.name';
  const rows = await execQ(pool, sql, vals);
  res.json({ ok: true, stock: rows });
}));

invRouter.get('/inventory/ledger', route(async (req, res) => {
  if (!guardView(req, res, 'inventory.view')) return;
  const pool = getPool(); const appId = appIdOf(req);
  const itemId = num(req.query.itemId); const storeId = num(req.query.storeId);
  const where = ['l.app_id=$1'];
  const vals = [appId];
  if (itemId) { vals.push(itemId); where.push('l.item_id=$'+vals.length); }
  if (storeId) { vals.push(storeId); where.push('l.store_id=$'+vals.length); }
  const sql = 'SELECT l.*, i.code, i.name as item_name, s.name as store_name FROM school_inv_stock_ledger l LEFT JOIN school_inv_item i ON i.id=l.item_id LEFT JOIN school_inv_store s ON s.id=l.store_id WHERE '+where.join(' AND ')+' ORDER BY l.id DESC LIMIT 200';
  const rows = await execQ(pool, sql, vals);
  res.json({ ok: true, ledger: rows });
}));

export { invRouter };
