-- ============================================================

-- frmDeptSale3  (ported from old xErp sp_* contract)

-- table: tblfrmDeptSale3

-- ============================================================

ALTER TABLE public."tblfrmDeptSale3" ADD COLUMN IF NOT EXISTS "tDate" date;

ALTER TABLE public."tblfrmDeptSale3" ADD COLUMN IF NOT EXISTS "Remark" text;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_Grid2"(
    p_frmdeptsale3_rows integer, p_frmdeptsale3_no integer,
    p_sdate text,
    p_edate text,
    p_invno text,
    p_to text,
    p_workorderno text,
    p_frmdeptsale3_frm text, p_frmdeptsale3_fcode text, p_frmdeptsale3_auth text, p_frmdeptsale3_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "FCODE" text, "tDate" text, "InvNo" text, "To_" text, "Remark" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmDeptSale3" a
        WHERE ((COALESCE(p_sdate, '') = '' OR a."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR a."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_invno, '') = '' OR a."InvNo"::text ILIKE '%' || p_invno || '%')
          AND (COALESCE(p_to, '') = '' OR a."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_workorderno, '') = '' OR a."WorkOrderNo_"::text ILIKE '%' || p_workorderno || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmDeptSale3" t2 WHERE (COALESCE(p_sdate, '') = '' OR t2."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR t2."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_invno, '') = '' OR t2."InvNo"::text ILIKE '%' || p_invno || '%')
          AND (COALESCE(p_to, '') = '' OR t2."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_workorderno, '') = '' OR t2."WorkOrderNo_"::text ILIKE '%' || p_workorderno || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmdeptsale3_no - 1) * p_frmdeptsale3_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."FCODE",
               to_char(t."tDate", 'YYYY-MM-DD') AS "tDate",
               t."InvNo",
               t."To_",
               t."Remark",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmDeptSale3" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_sdate, '') = '' OR t."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR t."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_invno, '') = '' OR t."InvNo"::text ILIKE '%' || p_invno || '%')
          AND (COALESCE(p_to, '') = '' OR t."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_workorderno, '') = '' OR t."WorkOrderNo_"::text ILIKE '%' || p_workorderno || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmdeptsale3_rows
    )
    SELECT p."id", p."FCODE", p."tDate", p."InvNo", p."To_", p."Remark", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmdeptsale3_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_sdate, '') = ''
                     AND COALESCE(p_edate, '') = ''
                     AND COALESCE(p_invno, '') = ''
                     AND COALESCE(p_to, '') = ''
                     AND COALESCE(p_workorderno, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmDeptSale3"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmDeptSale3" t WHERE (COALESCE(p_sdate, '') = '' OR t."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR t."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_invno, '') = '' OR t."InvNo"::text ILIKE '%' || p_invno || '%')
          AND (COALESCE(p_to, '') = '' OR t."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_workorderno, '') = '' OR t."WorkOrderNo_"::text ILIKE '%' || p_workorderno || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblfrmDeptSale3_sDate_trgm" ON public."tblfrmDeptSale3" USING gin ("sDate" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmDeptSale3_eDate_trgm" ON public."tblfrmDeptSale3" USING gin ("eDate" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmDeptSale3_InvNo_trgm" ON public."tblfrmDeptSale3" USING gin ("InvNo" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmDeptSale3_To__trgm" ON public."tblfrmDeptSale3" USING gin ("To_" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmDeptSale3_WorkOrderNo__trgm" ON public."tblfrmDeptSale3" USING gin ("WorkOrderNo_" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_DFE1"(
    p_frmdeptsale3_id bigint, p_frmdeptsale3_frm text, p_frmdeptsale3_auth text, p_frmdeptsale3_unused text)
RETURNS TABLE("id" bigint, "FCODE" text, "tDate" text, "InvNo" text, "To_" text, "Remark" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."FCODE",
           to_char(t."tDate", 'YYYY-MM-DD') AS "tDate",
           t."InvNo",
           t."To_",
           t."Remark",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmDeptSale3" t
    WHERE t."Id" = p_frmdeptsale3_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_SAVE"(
    
    p_fcode text,
    p_tdate text,
    p_invno text,
    p_to text,
    p_remark text,
    p_frmdeptsale3_frm text, p_frmdeptsale3_fcode text, p_frmdeptsale3_auth text, p_frmdeptsale3_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmdeptsale3_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmdeptsale3_auth);
    INSERT INTO public."tblfrmDeptSale3" ("FCODE", "tDate", "InvNo", "To_", "Remark", "User_Id")
    VALUES (COALESCE(NULLIF(p_fcode, ''), ''),
            CASE WHEN trim(p_tdate) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN p_tdate::date ELSE NULL END,
            COALESCE(NULLIF(p_invno, ''), ''),
            COALESCE(NULLIF(p_to, ''), ''),
            COALESCE(NULLIF(p_remark, ''), ''),
            v_uid)
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_UPDATE"(
    p_frmdeptsale3_id bigint,
    p_fcode text,
    p_tdate text,
    p_invno text,
    p_to text,
    p_remark text,
    p_frmdeptsale3_frm text, p_frmdeptsale3_fcode text, p_frmdeptsale3_auth text, p_frmdeptsale3_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmDeptSale3"
    SET "FCODE" = COALESCE(NULLIF(p_fcode, ''), ''),
            "tDate" = CASE WHEN trim(p_tdate) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN p_tdate::date ELSE NULL END,
            "InvNo" = COALESCE(NULLIF(p_invno, ''), ''),
            "To_" = COALESCE(NULLIF(p_to, ''), ''),
            "Remark" = COALESCE(NULLIF(p_remark, ''), '')
    WHERE "Id" = p_frmdeptsale3_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmdeptsale3_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmdeptsale3_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_Delete1"(
    p_frmdeptsale3_id bigint, p_frmdeptsale3_frm text, p_frmdeptsale3_auth text, p_frmdeptsale3_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    DELETE FROM public."tblGoodsSaleDet" WHERE "GoodsSale_id" = p_frmdeptsale3_id;
    DELETE FROM public."tblfrmDeptSale3" WHERE "Id" = p_frmdeptsale3_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_LockUnlock1"(
    p_frmdeptsale3_id bigint, p_frmdeptsale3_frm text, p_frmdeptsale3_auth text, p_frmdeptsale3_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmdeptsale3_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmDeptSale3" WHERE "Id" = p_frmdeptsale3_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmDeptSale3"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmdeptsale3_auth)
    WHERE "Id" = p_frmdeptsale3_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_AddBlank"(
    p_frmdeptsale3_frm text, p_frmdeptsale3_auth text, p_frmdeptsale3_unused text)
RETURNS TABLE("id" bigint)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmdeptsale3_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmdeptsale3_auth);
    INSERT INTO public."tblfrmDeptSale3" ("FCODE", "tDate", "InvNo", "To_", "Remark", "User_Id")
    VALUES (''::text,
            NULL::date,
            ''::text,
            ''::text,
            ''::text,
            v_uid)
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT v_id;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'AddBlank failed: %', SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_GridCount1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_GridCount1"(
    
    p_sdate text,
    p_edate text,
    p_invno text,
    p_to text,
    p_workorderno text,
    p_frmdeptsale3_frm text, p_frmdeptsale3_fcode text, p_frmdeptsale3_auth text)
RETURNS TABLE("TotalPages" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT count(*)::bigint FROM public."tblfrmDeptSale3" t
    WHERE (COALESCE(p_sdate, '') = '' OR t."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR t."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_invno, '') = '' OR t."InvNo"::text ILIKE '%' || p_invno || '%')
          AND (COALESCE(p_to, '') = '' OR t."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_workorderno, '') = '' OR t."WorkOrderNo_"::text ILIKE '%' || p_workorderno || '%');
END
$fn$;

-- detail table: tblGoodsSaleDet (FK GoodsSale_id -> tblfrmDeptSale3.Id)

CREATE TABLE IF NOT EXISTS public."tblGoodsSaleDet" (
    "Id" bigserial PRIMARY KEY,
    "GoodsSale_id" numeric,
    "SaleAc" text,
    "ItemNo" text,
    "Hsn" text,
    "PcNo" text,
    "Qty" numeric,
    "Unit" text,
    "Rate" numeric,
    "TaxableAmt" numeric,
    "SGSTper" numeric,
    "SGSTamt" numeric,
    "CGSTper" numeric,
    "CGSTamt" numeric,
    "IGSTper" numeric,
    "IGSTamt" numeric,
    "InvoiceAmt" numeric,
    "WorkOrderNo" text,
    "FCODE" text, "User_Id" text, "Created_At" timestamptz DEFAULT now());

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "GoodsSale_id" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "SaleAc" text;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "ItemNo" text;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "Hsn" text;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "PcNo" text;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "Qty" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "Unit" text;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "Rate" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "TaxableAmt" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "SGSTper" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "SGSTamt" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "CGSTper" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "CGSTamt" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "IGSTper" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "IGSTamt" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "InvoiceAmt" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "WorkOrderNo" text;

CREATE INDEX IF NOT EXISTS "idx_tblGoodsSaleDet_GoodsSale_id" ON public."tblGoodsSaleDet" ("GoodsSale_id");

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_DFE2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_DFE2"(
    p_frmdeptsale3_id bigint, p_frmdeptsale3_frm text, p_frmdeptsale3_auth text, p_frmdeptsale3_unused text)
RETURNS TABLE("id" bigint, "SaleAc" text, "ItemNo" text, "Qty" numeric, "Rate" numeric, "TaxableAmt" numeric, "InvoiceAmt" numeric)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT d."Id",
           d."SaleAc" AS "SaleAc",
           d."ItemNo" AS "ItemNo",
           d."Qty" AS "Qty",
           d."Rate" AS "Rate",
           d."TaxableAmt" AS "TaxableAmt",
           d."InvoiceAmt" AS "InvoiceAmt"
    FROM public."tblGoodsSaleDet" d
    WHERE d."GoodsSale_id" = p_frmdeptsale3_id
    ORDER BY d."Id";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_DeptSaledet_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_DeptSaledet_SAVE"(
    
    p_dgoodssale_id text,
    p_dsaleac text,
    p_ditemno text,
    p_dhsn text,
    p_dpcno text,
    p_dqty text,
    p_dunit text,
    p_drate text,
    p_dtaxableamt text,
    p_dsgstper text,
    p_dsgstamt text,
    p_dcgstper text,
    p_dcgstamt text,
    p_digstper text,
    p_digstamt text,
    p_dinvoiceamt text,
    p_dworkorderno text,
    p_frmdeptsale3_frm text, p_frmdeptsale3_fcode text, p_frmdeptsale3_auth text, p_frmdeptsale3_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmdeptsale3_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmdeptsale3_auth);
    IF p_frmdeptsale3_frm = 'frmLocked' THEN
        RETURN QUERY SELECT 'Error'::text, 'Record is locked'::text, NULL::bigint, 'Record is locked'::text;
        RETURN;
    END IF;
    INSERT INTO public."tblGoodsSaleDet" ("GoodsSale_id", "SaleAc", "ItemNo", "Hsn", "PcNo", "Qty", "Unit", "Rate", "TaxableAmt", "SGSTper", "SGSTamt", "CGSTper", "CGSTamt", "IGSTper", "IGSTamt", "InvoiceAmt", "WorkOrderNo", "FCODE", "User_Id")
    VALUES (CASE WHEN trim(p_dgoodssale_id) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dgoodssale_id::numeric ELSE 0 END,
            COALESCE(NULLIF(p_dsaleac, ''), ''),
            COALESCE(NULLIF(p_ditemno, ''), ''),
            COALESCE(NULLIF(p_dhsn, ''), ''),
            COALESCE(NULLIF(p_dpcno, ''), ''),
            CASE WHEN trim(p_dqty) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dqty::numeric ELSE 0 END,
            COALESCE(NULLIF(p_dunit, ''), ''),
            CASE WHEN trim(p_drate) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_drate::numeric ELSE 0 END,
            CASE WHEN trim(p_dtaxableamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dtaxableamt::numeric ELSE 0 END,
            CASE WHEN trim(p_dsgstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dsgstper::numeric ELSE 0 END,
            CASE WHEN trim(p_dsgstamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dsgstamt::numeric ELSE 0 END,
            CASE WHEN trim(p_dcgstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dcgstper::numeric ELSE 0 END,
            CASE WHEN trim(p_dcgstamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dcgstamt::numeric ELSE 0 END,
            CASE WHEN trim(p_digstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_digstper::numeric ELSE 0 END,
            CASE WHEN trim(p_digstamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_digstamt::numeric ELSE 0 END,
            CASE WHEN trim(p_dinvoiceamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dinvoiceamt::numeric ELSE 0 END,
            COALESCE(NULLIF(p_dworkorderno, ''), ''),
            COALESCE(NULLIF(p_frmdeptsale3_fcode, ''), 'HO'), v_uid)
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_DeptSaledet_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_DeptSaledet_UPDATE"(
    p_frmdeptsale3_did bigint,
    p_dgoodssale_id text,
    p_dsaleac text,
    p_ditemno text,
    p_dhsn text,
    p_dpcno text,
    p_dqty text,
    p_dunit text,
    p_drate text,
    p_dtaxableamt text,
    p_dsgstper text,
    p_dsgstamt text,
    p_dcgstper text,
    p_dcgstamt text,
    p_digstper text,
    p_digstamt text,
    p_dinvoiceamt text,
    p_dworkorderno text,
    p_frmdeptsale3_frm text, p_frmdeptsale3_fcode text, p_frmdeptsale3_auth text, p_frmdeptsale3_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblGoodsSaleDet"
    SET "GoodsSale_id" = CASE WHEN trim(p_dgoodssale_id) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dgoodssale_id::numeric ELSE 0 END,
            "SaleAc" = COALESCE(NULLIF(p_dsaleac, ''), ''),
            "ItemNo" = COALESCE(NULLIF(p_ditemno, ''), ''),
            "Hsn" = COALESCE(NULLIF(p_dhsn, ''), ''),
            "PcNo" = COALESCE(NULLIF(p_dpcno, ''), ''),
            "Qty" = CASE WHEN trim(p_dqty) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dqty::numeric ELSE 0 END,
            "Unit" = COALESCE(NULLIF(p_dunit, ''), ''),
            "Rate" = CASE WHEN trim(p_drate) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_drate::numeric ELSE 0 END,
            "TaxableAmt" = CASE WHEN trim(p_dtaxableamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dtaxableamt::numeric ELSE 0 END,
            "SGSTper" = CASE WHEN trim(p_dsgstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dsgstper::numeric ELSE 0 END,
            "SGSTamt" = CASE WHEN trim(p_dsgstamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dsgstamt::numeric ELSE 0 END,
            "CGSTper" = CASE WHEN trim(p_dcgstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dcgstper::numeric ELSE 0 END,
            "CGSTamt" = CASE WHEN trim(p_dcgstamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dcgstamt::numeric ELSE 0 END,
            "IGSTper" = CASE WHEN trim(p_digstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_digstper::numeric ELSE 0 END,
            "IGSTamt" = CASE WHEN trim(p_digstamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_digstamt::numeric ELSE 0 END,
            "InvoiceAmt" = CASE WHEN trim(p_dinvoiceamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dinvoiceamt::numeric ELSE 0 END,
            "WorkOrderNo" = COALESCE(NULLIF(p_dworkorderno, ''), '')
    WHERE "Id" = p_frmdeptsale3_did;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Row not found'::text, p_frmdeptsale3_did, 'Row not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmdeptsale3_did, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_DeptSaledet_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_DeptSaledet_Delete1"(
    p_frmdeptsale3_did bigint, p_frmdeptsale3_frm text, p_frmdeptsale3_auth text, p_frmdeptsale3_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    DELETE FROM public."tblGoodsSaleDet" WHERE "Id" = p_frmdeptsale3_did;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Row not found'::text, 'Row not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale3_PRINT_ROW1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale3_PRINT_ROW1"(
    p_frmdeptsale3_id bigint, p_frmdeptsale3_frm text, p_frmdeptsale3_auth text, p_frmdeptsale3_unused text)
RETURNS TABLE("id" bigint, "FCODE" text, "tDate" text, "InvNo" text, "To_" text, "Remark" text, "det1" jsonb)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id",
           t."FCODE",
           to_char(t."tDate", 'YYYY-MM-DD'),
           t."InvNo",
           t."To_",
           t."Remark",
           (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d."Id"), '[]'::jsonb)
         FROM public."tblGoodsSaleDet" d WHERE d."GoodsSale_id" = t."Id") AS "det1"
    FROM public."tblfrmDeptSale3" t
    WHERE t."Id" = p_frmdeptsale3_id;
END
$fn$;
