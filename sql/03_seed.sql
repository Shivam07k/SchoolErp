-- ============================================================
-- pg-xerp  03_seed.sql — platform seed data (idempotent)
-- Admin/LOADTEST hashes are set by server/setup.mjs (bcrypt).
-- ============================================================
BEGIN;

/* ---------- Companies (FCODE) ---------- */
INSERT INTO "tblHO_Franchisee" ("FranchiseeCode", "Company", "Name", "Status")
SELECT 'HO', 'XERP DEMO PVT LTD', 'Head Office', '1'
WHERE NOT EXISTS (SELECT 1 FROM "tblHO_Franchisee" WHERE btrim("FranchiseeCode") = 'HO');

/* ---------- Groups ---------- */
INSERT INTO "tblSecGroup" ("GrpName", "IsAdmin") VALUES
    ('ADMIN', true), ('SALES', false), ('ACCOUNTS', false), ('PURCHASE', false), ('OPERATOR', false)
ON CONFLICT ("GrpName") DO NOTHING;

/* ---------- Departments ---------- */
INSERT INTO "tblSecDepartment" ("DeptName") VALUES
    ('HO'), ('PACKING'), ('EXPORT'), ('STORES')
ON CONFLICT ("DeptName") DO NOTHING;

/* ---------- Users (hash filled by setup.mjs) ---------- */
INSERT INTO "tblHO_User" ("UserId", "UserName", "Designation", "GRP", "Status")
SELECT 'ADMIN', 'Administrator', 'System Admin', 'ADMIN', '1'
WHERE NOT EXISTS (SELECT 1 FROM "tblHO_User" WHERE "UserId" = 'ADMIN');

INSERT INTO "tblHO_User" ("UserId", "UserName", "Designation", "GRP", "Status")
SELECT 'LOADTEST', 'Load Test User', 'Tester', 'OPERATOR', '1'
WHERE NOT EXISTS (SELECT 1 FROM "tblHO_User" WHERE "UserId" = 'LOADTEST');

INSERT INTO "tblSecUserGrp" ("UserId", "GrpId")
SELECT 'ADMIN', "GrpId" FROM "tblSecGroup" WHERE "GrpName" = 'ADMIN'
ON CONFLICT DO NOTHING;
INSERT INTO "tblSecUserGrp" ("UserId", "GrpId")
SELECT 'LOADTEST', "GrpId" FROM "tblSecGroup" WHERE "GrpName" = 'OPERATOR'
ON CONFLICT DO NOTHING;

/* ---------- Menus (mirror xErp 09_dynamic_menus) ---------- */
INSERT INTO "tblWebMenus" ("MainGroup","SubGroup","MenuTitle","WebPage","DisplayIcon","ShowStatus","MenuOrder","FCODE","AdminOnly")
SELECT * FROM (VALUES
    ('MAIN', '01.) Masters',       'Brand Master',         'frmBrand.aspx',            'bi-tag',             true,  1, 'HO', false),
    ('MAIN', '01.) Masters',       'Customer Master',      'frmCustomer.aspx',         'bi-people',          true,  2, 'HO', false),
    ('MAIN', '01.) Masters',       'HSN Master',           'frmhsn.aspx',              'bi-upc-scan',        true,  3, 'HO', false),
    ('MAIN', '01.) Masters',       'Process Master',       'fromProcess.aspx',         'bi-gear',            true,  4, 'HO', false),
    ('MAIN', '02.) Transactions',  'Department Sale',      'frmDeptSale2.aspx',        'bi-cart',            true,  1, 'HO', false),
    ('MAIN', '02.) Transactions',  'Goods Sale',           'frmDeptSale3.aspx',        'bi-cart-check',      true,  2, 'HO', false),
    ('MAIN', '02.) Transactions',  'Goods Outward',        'frmgoodsoutward.aspx',     'bi-arrow-left-right',true,  3, 'HO', false),
    ('MAIN', '03.) Reports',       'Stock Summary Report', 'rptStockSummary.aspx',     'bi-box-seam',        true,  1, 'HO', false)
) AS v("MainGroup","SubGroup","MenuTitle","WebPage","DisplayIcon","ShowStatus","MenuOrder","FCODE","AdminOnly")
WHERE NOT EXISTS (SELECT 1 FROM "tblWebMenus" m WHERE m."WebPage" = v."WebPage" AND m."FCODE" = v."FCODE");

/* ---------- Menus: remaining entry forms + system/security ---------- */
INSERT INTO "tblWebMenus" ("MainGroup","SubGroup","MenuTitle","WebPage","DisplayIcon","ShowStatus","MenuOrder","FCODE","AdminOnly")
SELECT * FROM (VALUES
    ('MAIN', '01.) Masters',    'Item Master',         'frmItem.aspx',             'bi-box',             true,  5, 'HO', false),
    ('MAIN', '01.) Masters',    'Goods Inward',        'frmGoodsInward.aspx',      'bi-arrow-left-right',true,  6, 'HO', false),
    ('MAIN', '01.) Masters',    'Item Category',       'frmItemCategory.aspx',     'bi-tags',            true,  7, 'HO', false),
    ('MAIN', '01.) Masters',    'Item No',             'frmitemno.aspx',           'bi-upc-scan',        true,  8, 'HO', false),
    ('MAIN', '01.) Masters',    'Item No (Dynamic)',   'frmItemNoDyn.aspx',        'bi-diagram-3',       true,  9, 'HO', false),
    ('MAIN', '01.) Masters',    'Packing Category',    'frmPackingCategory.aspx',  'bi-boxes',           true, 10, 'HO', false),
    ('MAIN', '04.) Security',   'User Master',         'frmSecUser.aspx',          'bi-person-gear',     true,  1, 'HO', true),
    ('MAIN', '04.) Security',   'Group Master',        'frmSecGrp.aspx',           'bi-people',          true,  2, 'HO', true),
    ('MAIN', '04.) Security',   'Permissions',         'frmSecPerm.aspx',          'bi-shield-check',    true,  3, 'HO', true),
    ('MAIN', '04.) Security',   'Departments',         'frmSecDept.aspx',          'bi-diagram-2',       true,  4, 'HO', true),
    ('MAIN', '04.) Security',   'Menu Master',         'frmSecMenu.aspx',          'bi-list',            true,  5, 'HO', true),
    ('MAIN', '04.) Security',   'Company Master',      'frmCompany.aspx',          'bi-building',        true,  6, 'HO', true)
) AS v("MainGroup","SubGroup","MenuTitle","WebPage","DisplayIcon","ShowStatus","MenuOrder","FCODE","AdminOnly")
WHERE NOT EXISTS (SELECT 1 FROM "tblWebMenus" m WHERE m."WebPage" = v."WebPage" AND m."FCODE" = v."FCODE");

/* ---------- Sample demo user settings ---------- */
INSERT INTO "tblUserSetting" ("UserId", "FormId", "SettingKey", "SettingVal")
SELECT 'ADMIN', 'frmBrand', 'pgsize', '20'
WHERE NOT EXISTS (SELECT 1 FROM "tblUserSetting" WHERE "UserId"='ADMIN' AND "FormId"='frmBrand' AND "SettingKey"='pgsize');

COMMIT;