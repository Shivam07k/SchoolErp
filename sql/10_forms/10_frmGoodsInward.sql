-- ============================================================

-- frmGoodsInward  (ported from old xErp sp_* contract)

-- table: tblfrmGoodsInward

-- ============================================================

ALTER TABLE public."tblfrmGoodsInward" ADD COLUMN IF NOT EXISTS "ChallanNo" text;

ALTER TABLE public."tblfrmGoodsInward" ADD COLUMN IF NOT EXISTS "pChallanNo" text;

ALTER TABLE public."tblfrmGoodsInward" ADD COLUMN IF NOT EXISTS "tDate" date;

ALTER TABLE public."tblfrmGoodsInward" ADD COLUMN IF NOT EXISTS "From_" text;

ALTER TABLE public."tblfrmGoodsInward" ADD COLUMN IF NOT EXISTS "To_" text;

ALTER TABLE public."tblfrmGoodsInward" ADD COLUMN IF NOT EXISTS "Remark" text;

ALTER TABLE public."tblfrmGoodsInward" ADD COLUMN IF NOT EXISTS "ChallanTag" text;

ALTER TABLE public."tblfrmGoodsInward" ADD COLUMN IF NOT EXISTS "PmntTerm" text;

ALTER TABLE public."tblfrmGoodsInward" ADD COLUMN IF NOT EXISTS "DueDays" numeric;

ALTER TABLE public."tblfrmGoodsInward" ADD COLUMN IF NOT EXISTS "GateEntryNo" text;

ALTER TABLE public."tblfrmGoodsInward" ADD COLUMN IF NOT EXISTS "Transport" text;

ALTER TABLE public."tblfrmGoodsInward" ADD COLUMN IF NOT EXISTS "VehicleNo" text;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmGoodsInward_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmGoodsInward_Grid2"(
    p_frmgoodsinward_rows integer, p_frmgoodsinward_no integer,
    p_from text,
    p_to text,
    p_challanno text,
    p_frmgoodsinward_frm text, p_frmgoodsinward_fcode text, p_frmgoodsinward_auth text, p_frmgoodsinward_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "ChallanNo" text, "pChallanNo" text, "tDate" text, "From_" text, "To_" text, "Remark" text, "ChallanTag" text, "PmntTerm" text, "DueDays" numeric, "GateEntryNo" text, "Transport" text, "VehicleNo" text, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmGoodsInward" a
        WHERE ((COALESCE(p_from, '') = '' OR a."from_"::text ILIKE '%' || p_from || '%')
          AND (COALESCE(p_to, '') = '' OR a."to_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_challanno, '') = '' OR a."challanno"::text ILIKE '%' || p_challanno || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmGoodsInward" t2 WHERE (COALESCE(p_from, '') = '' OR t2."from_"::text ILIKE '%' || p_from || '%')
          AND (COALESCE(p_to, '') = '' OR t2."to_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_challanno, '') = '' OR t2."challanno"::text ILIKE '%' || p_challanno || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmgoodsinward_no - 1) * p_frmgoodsinward_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."ChallanNo",
               t."pChallanNo",
               to_char(t."tDate", 'YYYY-MM-DD') AS "tDate",
               t."From_",
               t."To_",
               t."Remark",
               t."ChallanTag",
               t."PmntTerm",
               t."DueDays",
               t."GateEntryNo",
               t."Transport",
               t."VehicleNo",
               t."FCODE",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmGoodsInward" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_from, '') = '' OR t."from_"::text ILIKE '%' || p_from || '%')
          AND (COALESCE(p_to, '') = '' OR t."to_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_challanno, '') = '' OR t."challanno"::text ILIKE '%' || p_challanno || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmgoodsinward_rows
    )
    SELECT p."id", p."ChallanNo", p."pChallanNo", p."tDate", p."From_", p."To_", p."Remark", p."ChallanTag", p."PmntTerm", p."DueDays", p."GateEntryNo", p."Transport", p."VehicleNo", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmgoodsinward_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_from, '') = ''
                     AND COALESCE(p_to, '') = ''
                     AND COALESCE(p_challanno, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmGoodsInward"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmGoodsInward" t WHERE (COALESCE(p_from, '') = '' OR t."from_"::text ILIKE '%' || p_from || '%')
          AND (COALESCE(p_to, '') = '' OR t."to_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_challanno, '') = '' OR t."challanno"::text ILIKE '%' || p_challanno || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblfrmGoodsInward_from__trgm" ON public."tblfrmGoodsInward" USING gin ("from_" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmGoodsInward_to__trgm" ON public."tblfrmGoodsInward" USING gin ("to_" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmGoodsInward_challanno_trgm" ON public."tblfrmGoodsInward" USING gin ("challanno" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmGoodsInward_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmGoodsInward_DFE1"(
    p_frmgoodsinward_id bigint, p_frmgoodsinward_frm text, p_frmgoodsinward_auth text, p_frmgoodsinward_unused text)
RETURNS TABLE("id" bigint, "ChallanNo" text, "pChallanNo" text, "tDate" text, "From_" text, "To_" text, "Remark" text, "ChallanTag" text, "PmntTerm" text, "DueDays" numeric, "GateEntryNo" text, "Transport" text, "VehicleNo" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."ChallanNo",
           t."pChallanNo",
           to_char(t."tDate", 'YYYY-MM-DD') AS "tDate",
           t."From_",
           t."To_",
           t."Remark",
           t."ChallanTag",
           t."PmntTerm",
           t."DueDays",
           t."GateEntryNo",
           t."Transport",
           t."VehicleNo",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmGoodsInward" t
    WHERE t."Id" = p_frmgoodsinward_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmGoodsInward_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmGoodsInward_SAVE"(
    
    p_challanno text,
    p_pchallanno text,
    p_tdate text,
    p_from text,
    p_to text,
    p_remark text,
    p_challantag text,
    p_pmntterm text,
    p_duedays text,
    p_gateentryno text,
    p_transport text,
    p_vehicleno text,
    p_frmgoodsinward_frm text, p_frmgoodsinward_fcode text, p_frmgoodsinward_auth text, p_frmgoodsinward_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmgoodsinward_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmgoodsinward_auth);
    INSERT INTO public."tblfrmGoodsInward" ("ChallanNo", "pChallanNo", "tDate", "From_", "To_", "Remark", "ChallanTag", "PmntTerm", "DueDays", "GateEntryNo", "Transport", "VehicleNo", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_challanno, ''), ''),
            COALESCE(NULLIF(p_pchallanno, ''), ''),
            CASE WHEN trim(p_tdate) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN p_tdate::date ELSE NULL END,
            COALESCE(NULLIF(p_from, ''), ''),
            COALESCE(NULLIF(p_to, ''), ''),
            COALESCE(NULLIF(p_remark, ''), ''),
            COALESCE(NULLIF(p_challantag, ''), ''),
            COALESCE(NULLIF(p_pmntterm, ''), ''),
            CASE WHEN trim(p_duedays) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_duedays::numeric ELSE 0 END,
            COALESCE(NULLIF(p_gateentryno, ''), ''),
            COALESCE(NULLIF(p_transport, ''), ''),
            COALESCE(NULLIF(p_vehicleno, ''), ''),
            v_uid,
            COALESCE(NULLIF(p_frmgoodsinward_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmGoodsInward_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmGoodsInward_UPDATE"(
    p_frmgoodsinward_id bigint,
    p_challanno text,
    p_pchallanno text,
    p_tdate text,
    p_from text,
    p_to text,
    p_remark text,
    p_challantag text,
    p_pmntterm text,
    p_duedays text,
    p_gateentryno text,
    p_transport text,
    p_vehicleno text,
    p_frmgoodsinward_frm text, p_frmgoodsinward_fcode text, p_frmgoodsinward_auth text, p_frmgoodsinward_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmGoodsInward"
    SET "ChallanNo" = COALESCE(NULLIF(p_challanno, ''), ''),
            "pChallanNo" = COALESCE(NULLIF(p_pchallanno, ''), ''),
            "tDate" = CASE WHEN trim(p_tdate) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN p_tdate::date ELSE NULL END,
            "From_" = COALESCE(NULLIF(p_from, ''), ''),
            "To_" = COALESCE(NULLIF(p_to, ''), ''),
            "Remark" = COALESCE(NULLIF(p_remark, ''), ''),
            "ChallanTag" = COALESCE(NULLIF(p_challantag, ''), ''),
            "PmntTerm" = COALESCE(NULLIF(p_pmntterm, ''), ''),
            "DueDays" = CASE WHEN trim(p_duedays) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_duedays::numeric ELSE 0 END,
            "GateEntryNo" = COALESCE(NULLIF(p_gateentryno, ''), ''),
            "Transport" = COALESCE(NULLIF(p_transport, ''), ''),
            "VehicleNo" = COALESCE(NULLIF(p_vehicleno, ''), ''),
            "FCODE" = COALESCE(NULLIF(p_frmgoodsinward_fcode, ''), "FCODE")
    WHERE "Id" = p_frmgoodsinward_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmgoodsinward_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmgoodsinward_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmGoodsInward_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmGoodsInward_Delete1"(
    p_frmgoodsinward_id bigint, p_frmgoodsinward_frm text, p_frmgoodsinward_auth text, p_frmgoodsinward_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    DELETE FROM public."tblGoodsInwardDet" WHERE "tblGoodsInward_Id" = p_frmgoodsinward_id;
    DELETE FROM public."tblfrmGoodsInward" WHERE "Id" = p_frmgoodsinward_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmGoodsInward_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmGoodsInward_LockUnlock1"(
    p_frmgoodsinward_id bigint, p_frmgoodsinward_frm text, p_frmgoodsinward_auth text, p_frmgoodsinward_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmgoodsinward_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmGoodsInward" WHERE "Id" = p_frmgoodsinward_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmGoodsInward"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmgoodsinward_auth)
    WHERE "Id" = p_frmgoodsinward_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmGoodsInward_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmGoodsInward_AddBlank"(
    p_frmgoodsinward_frm text, p_frmgoodsinward_auth text, p_frmgoodsinward_unused text)
RETURNS TABLE("id" bigint)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmgoodsinward_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmgoodsinward_auth);
    INSERT INTO public."tblfrmGoodsInward" ("ChallanNo", "pChallanNo", "tDate", "From_", "To_", "Remark", "ChallanTag", "PmntTerm", "DueDays", "GateEntryNo", "Transport", "VehicleNo", "FCODE", "User_Id")
    VALUES (''::text,
            ''::text,
            NULL::date,
            ''::text,
            ''::text,
            ''::text,
            ''::text,
            ''::text,
            0::numeric,
            ''::text,
            ''::text,
            ''::text,
            'HO',
            v_uid)
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT v_id;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'AddBlank failed: %', SQLERRM;
END
$fn$;

-- detail table: tblGoodsInwardDet (FK tblGoodsInward_Id -> tblfrmGoodsInward.Id)

CREATE TABLE IF NOT EXISTS public."tblGoodsInwardDet" (
    "Id" bigserial PRIMARY KEY,
    "tblGoodsInward_Id" numeric,
    "ItemNo" text,
    "Qty" numeric,
    "PcNo" text,
    "PassQty" numeric,
    "Rate" numeric,
    "TaxableAmt" numeric,
    "Crtns" numeric,
    "CrType" text,
    "NetWt" numeric,
    "Hsn" text,
    "FCODE" text, "User_Id" text, "Created_At" timestamptz DEFAULT now());

ALTER TABLE public."tblGoodsInwardDet" ADD COLUMN IF NOT EXISTS "tblGoodsInward_Id" numeric;

ALTER TABLE public."tblGoodsInwardDet" ADD COLUMN IF NOT EXISTS "ItemNo" text;

ALTER TABLE public."tblGoodsInwardDet" ADD COLUMN IF NOT EXISTS "Qty" numeric;

ALTER TABLE public."tblGoodsInwardDet" ADD COLUMN IF NOT EXISTS "PcNo" text;

ALTER TABLE public."tblGoodsInwardDet" ADD COLUMN IF NOT EXISTS "PassQty" numeric;

ALTER TABLE public."tblGoodsInwardDet" ADD COLUMN IF NOT EXISTS "Rate" numeric;

ALTER TABLE public."tblGoodsInwardDet" ADD COLUMN IF NOT EXISTS "TaxableAmt" numeric;

ALTER TABLE public."tblGoodsInwardDet" ADD COLUMN IF NOT EXISTS "Crtns" numeric;

ALTER TABLE public."tblGoodsInwardDet" ADD COLUMN IF NOT EXISTS "CrType" text;

ALTER TABLE public."tblGoodsInwardDet" ADD COLUMN IF NOT EXISTS "NetWt" numeric;

ALTER TABLE public."tblGoodsInwardDet" ADD COLUMN IF NOT EXISTS "Hsn" text;

CREATE INDEX IF NOT EXISTS "idx_tblGoodsInwardDet_tblGoodsInward_Id" ON public."tblGoodsInwardDet" ("tblGoodsInward_Id");

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmGoodsInward_DFE2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmGoodsInward_DFE2"(
    p_frmgoodsinward_id bigint, p_frmgoodsinward_frm text, p_frmgoodsinward_auth text, p_frmgoodsinward_unused text)
RETURNS TABLE("id" bigint, "ItemNo" text, "Qty" numeric, "PcNo" text, "PassQty" numeric, "Rate" numeric, "TaxableAmt" numeric, "Crtns" numeric, "CrType" text, "NetWt" numeric, "Hsn" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT d."Id",
           d."ItemNo" AS "ItemNo",
           d."Qty" AS "Qty",
           d."PcNo" AS "PcNo",
           d."PassQty" AS "PassQty",
           d."Rate" AS "Rate",
           d."TaxableAmt" AS "TaxableAmt",
           d."Crtns" AS "Crtns",
           d."CrType" AS "CrType",
           d."NetWt" AS "NetWt",
           d."Hsn" AS "Hsn"
    FROM public."tblGoodsInwardDet" d
    WHERE d."tblGoodsInward_Id" = p_frmgoodsinward_id
    ORDER BY d."Id";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmGoodsInward_Det_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmGoodsInward_Det_SAVE"(
    
    p_dtblgoodsinward_id text,
    p_ditemno text,
    p_dqty text,
    p_dpcno text,
    p_dpassqty text,
    p_drate text,
    p_dtaxableamt text,
    p_dcrtns text,
    p_dcrtype text,
    p_dnetwt text,
    p_dhsn text,
    p_frmgoodsinward_frm text, p_frmgoodsinward_fcode text, p_frmgoodsinward_auth text, p_frmgoodsinward_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmgoodsinward_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmgoodsinward_auth);
    IF p_frmgoodsinward_frm = 'frmLocked' THEN
        RETURN QUERY SELECT 'Error'::text, 'Record is locked'::text, NULL::bigint, 'Record is locked'::text;
        RETURN;
    END IF;
    INSERT INTO public."tblGoodsInwardDet" ("tblGoodsInward_Id", "ItemNo", "Qty", "PcNo", "PassQty", "Rate", "TaxableAmt", "Crtns", "CrType", "NetWt", "Hsn", "FCODE", "User_Id")
    VALUES (CASE WHEN trim(p_dtblgoodsinward_id) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dtblgoodsinward_id::numeric ELSE 0 END,
            COALESCE(NULLIF(p_ditemno, ''), ''),
            CASE WHEN trim(p_dqty) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dqty::numeric ELSE 0 END,
            COALESCE(NULLIF(p_dpcno, ''), ''),
            CASE WHEN trim(p_dpassqty) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dpassqty::numeric ELSE 0 END,
            CASE WHEN trim(p_drate) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_drate::numeric ELSE 0 END,
            CASE WHEN trim(p_dtaxableamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dtaxableamt::numeric ELSE 0 END,
            CASE WHEN trim(p_dcrtns) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dcrtns::numeric ELSE 0 END,
            COALESCE(NULLIF(p_dcrtype, ''), ''),
            CASE WHEN trim(p_dnetwt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dnetwt::numeric ELSE 0 END,
            COALESCE(NULLIF(p_dhsn, ''), ''),
            COALESCE(NULLIF(p_frmgoodsinward_fcode, ''), 'HO'), v_uid)
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmGoodsInward_Det_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmGoodsInward_Det_UPDATE"(
    p_frmgoodsinward_did bigint,
    p_dtblgoodsinward_id text,
    p_ditemno text,
    p_dqty text,
    p_dpcno text,
    p_dpassqty text,
    p_drate text,
    p_dtaxableamt text,
    p_dcrtns text,
    p_dcrtype text,
    p_dnetwt text,
    p_dhsn text,
    p_frmgoodsinward_frm text, p_frmgoodsinward_fcode text, p_frmgoodsinward_auth text, p_frmgoodsinward_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblGoodsInwardDet"
    SET "tblGoodsInward_Id" = CASE WHEN trim(p_dtblgoodsinward_id) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dtblgoodsinward_id::numeric ELSE 0 END,
            "ItemNo" = COALESCE(NULLIF(p_ditemno, ''), ''),
            "Qty" = CASE WHEN trim(p_dqty) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dqty::numeric ELSE 0 END,
            "PcNo" = COALESCE(NULLIF(p_dpcno, ''), ''),
            "PassQty" = CASE WHEN trim(p_dpassqty) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dpassqty::numeric ELSE 0 END,
            "Rate" = CASE WHEN trim(p_drate) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_drate::numeric ELSE 0 END,
            "TaxableAmt" = CASE WHEN trim(p_dtaxableamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dtaxableamt::numeric ELSE 0 END,
            "Crtns" = CASE WHEN trim(p_dcrtns) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dcrtns::numeric ELSE 0 END,
            "CrType" = COALESCE(NULLIF(p_dcrtype, ''), ''),
            "NetWt" = CASE WHEN trim(p_dnetwt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dnetwt::numeric ELSE 0 END,
            "Hsn" = COALESCE(NULLIF(p_dhsn, ''), '')
    WHERE "Id" = p_frmgoodsinward_did;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Row not found'::text, p_frmgoodsinward_did, 'Row not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmgoodsinward_did, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmGoodsInward_Det_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmGoodsInward_Det_Delete1"(
    p_frmgoodsinward_did bigint, p_frmgoodsinward_frm text, p_frmgoodsinward_auth text, p_frmgoodsinward_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    DELETE FROM public."tblGoodsInwardDet" WHERE "Id" = p_frmgoodsinward_did;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmGoodsInward_PRINT_ROW1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmGoodsInward_PRINT_ROW1"(
    p_frmgoodsinward_id bigint, p_frmgoodsinward_frm text, p_frmgoodsinward_auth text, p_frmgoodsinward_unused text)
RETURNS TABLE("id" bigint, "ChallanNo" text, "pChallanNo" text, "tDate" text, "From_" text, "To_" text, "Remark" text, "ChallanTag" text, "PmntTerm" text, "DueDays" numeric, "GateEntryNo" text, "Transport" text, "VehicleNo" text, "det1" jsonb)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id",
           t."ChallanNo",
           t."pChallanNo",
           to_char(t."tDate", 'YYYY-MM-DD'),
           t."From_",
           t."To_",
           t."Remark",
           t."ChallanTag",
           t."PmntTerm",
           t."DueDays",
           t."GateEntryNo",
           t."Transport",
           t."VehicleNo",
           (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d."Id"), '[]'::jsonb)
         FROM public."tblGoodsInwardDet" d WHERE d."tblGoodsInward_Id" = t."Id") AS "det1"
    FROM public."tblfrmGoodsInward" t
    WHERE t."Id" = p_frmgoodsinward_id;
END
$fn$;
