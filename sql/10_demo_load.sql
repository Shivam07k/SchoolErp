-- ============================================================
-- pg-xerp  10_demo_load.sql — (optional) bulk-load 100,000 brand
-- rows to prove the fast-grid: one INSERT, then every list page is
-- a single query returning 20 rows + rc total.
-- Run manually: psql ... -f 10_demo_load.sql
-- ============================================================
BEGIN;
INSERT INTO "tblBrand" ("BrandName", "FCODE", "User_Id")
SELECT 'BRAND ' || lpad(i::text, 6, '0'),
       'HO',
       'ADMIN'
FROM generate_series(1, 100000) AS i
ON CONFLICT DO NOTHING;
ANALYZE "tblBrand";
COMMIT;
SELECT count(*) AS brand_count FROM "tblBrand";