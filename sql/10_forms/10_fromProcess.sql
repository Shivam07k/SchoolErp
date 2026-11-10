-- ============================================================

-- fromProcess  (ported from old xErp sp_* contract)

-- table: tblProcess

-- ============================================================

CREATE TABLE IF NOT EXISTS public."tblProcess" (
    "Id" bigserial PRIMARY KEY,
    "Item" text,
    "Process" text,
    "BatchPrefix" text,
    "Department" text,
    "WareHouse" text,
    "HSN" text,
    "CapacityUnit" text,
    "WastePer" numeric,
    "Lock" boolean DEFAULT false,
    "FCODE" text, "User_Id" text, "LOCK_User_Id" text, "Created_At" timestamptz DEFAULT now());

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "Item" text;

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "Process" text;

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "BatchPrefix" text;

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "Department" text;

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "WareHouse" text;

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "HSN" text;

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "CapacityUnit" text;

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "WastePer" numeric;

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "FCODE" text;

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "User_Id" text;

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "LOCK_User_Id" text;

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "Created_At" timestamptz;

ALTER TABLE public."tblProcess" ADD COLUMN IF NOT EXISTS "Lock" boolean;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_fromProcess_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_fromProcess_Grid2"(
    p_fromprocess_rows integer, p_fromprocess_no integer,
    p_process text,
    p_fromprocess_frm text, p_fromprocess_fcode text, p_fromprocess_auth text, p_fromprocess_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "Item" text, "Process" text, "BatchPrefix" text, "Department" text, "WareHouse" text, "HSN" text, "CapacityUnit" text, "WastePer" numeric, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblProcess" a
        WHERE ((COALESCE(p_process, '') = '' OR a."Process"::text ILIKE '%' || p_process || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblProcess" t2 WHERE (COALESCE(p_process, '') = '' OR t2."Process"::text ILIKE '%' || p_process || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_fromprocess_no - 1) * p_fromprocess_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."Item",
               t."Process",
               t."BatchPrefix",
               t."Department",
               t."WareHouse",
               t."HSN",
               t."CapacityUnit",
               t."WastePer",
               t."FCODE",
               COALESCE(t."Lock", false) <> false AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblProcess" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_process, '') = '' OR t."Process"::text ILIKE '%' || p_process || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_fromprocess_rows
    )
    SELECT p."id", p."Item", p."Process", p."BatchPrefix", p."Department", p."WareHouse", p."HSN", p."CapacityUnit", p."WastePer", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_fromprocess_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_process, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblProcess"'::regclass)
               ELSE (SELECT count(*) FROM public."tblProcess" t WHERE (COALESCE(p_process, '') = '' OR t."Process"::text ILIKE '%' || p_process || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_fromProcess_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_fromProcess_DFE1"(
    p_fromprocess_id bigint, p_fromprocess_frm text, p_fromprocess_auth text, p_fromprocess_unused text)
RETURNS TABLE("id" bigint, "Item" text, "Process" text, "BatchPrefix" text, "Department" text, "WareHouse" text, "HSN" text, "CapacityUnit" text, "WastePer" numeric, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."Item",
           t."Process",
           t."BatchPrefix",
           t."Department",
           t."WareHouse",
           t."HSN",
           t."CapacityUnit",
           t."WastePer",
           COALESCE(t."Lock", false) <> false AS "LOCK"
    FROM public."tblProcess" t
    WHERE t."Id" = p_fromprocess_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_fromProcess_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_fromProcess_SAVE"(
    
    p_item text,
    p_process text,
    p_batchprefix text,
    p_department text,
    p_warehouse text,
    p_hsn text,
    p_capacityunit text,
    p_wasteper text,
    p_fromprocess_frm text, p_fromprocess_fcode text, p_fromprocess_auth text, p_fromprocess_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_fromprocess_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_fromprocess_auth);
    INSERT INTO public."tblProcess" ("Item", "Process", "BatchPrefix", "Department", "WareHouse", "HSN", "CapacityUnit", "WastePer", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_item, ''), ''),
            COALESCE(NULLIF(p_process, ''), ''),
            COALESCE(NULLIF(p_batchprefix, ''), ''),
            COALESCE(NULLIF(p_department, ''), ''),
            COALESCE(NULLIF(p_warehouse, ''), ''),
            COALESCE(NULLIF(p_hsn, ''), ''),
            COALESCE(NULLIF(p_capacityunit, ''), ''),
            CASE WHEN trim(p_wasteper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_wasteper::numeric ELSE 0 END,
            v_uid,
            COALESCE(NULLIF(p_fromprocess_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_fromProcess_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_fromProcess_UPDATE"(
    p_fromprocess_id bigint,
    p_item text,
    p_process text,
    p_batchprefix text,
    p_department text,
    p_warehouse text,
    p_hsn text,
    p_capacityunit text,
    p_wasteper text,
    p_fromprocess_frm text, p_fromprocess_fcode text, p_fromprocess_auth text, p_fromprocess_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblProcess"
    SET "Item" = COALESCE(NULLIF(p_item, ''), ''),
            "Process" = COALESCE(NULLIF(p_process, ''), ''),
            "BatchPrefix" = COALESCE(NULLIF(p_batchprefix, ''), ''),
            "Department" = COALESCE(NULLIF(p_department, ''), ''),
            "WareHouse" = COALESCE(NULLIF(p_warehouse, ''), ''),
            "HSN" = COALESCE(NULLIF(p_hsn, ''), ''),
            "CapacityUnit" = COALESCE(NULLIF(p_capacityunit, ''), ''),
            "WastePer" = CASE WHEN trim(p_wasteper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_wasteper::numeric ELSE 0 END,
            "FCODE" = COALESCE(NULLIF(p_fromprocess_fcode, ''), "FCODE")
    WHERE "Id" = p_fromprocess_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_fromprocess_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_fromprocess_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_fromProcess_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_fromProcess_Delete1"(
    p_fromprocess_id bigint, p_fromprocess_frm text, p_fromprocess_auth text, p_fromprocess_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    
    DELETE FROM public."tblProcess" WHERE "Id" = p_fromprocess_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_fromProcess_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_fromProcess_LockUnlock1"(
    p_fromprocess_id bigint, p_fromprocess_frm text, p_fromprocess_auth text, p_fromprocess_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_fromprocess_auth;
    SELECT COALESCE("Lock", false) <> false INTO v_lock
    FROM public."tblProcess" WHERE "Id" = p_fromprocess_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblProcess"
    SET "Lock" = NOT COALESCE("Lock", false),
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_fromprocess_auth)
    WHERE "Id" = p_fromprocess_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_fromProcess_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_fromProcess_AddBlank"(
    p_fromprocess_frm text, p_fromprocess_auth text, p_fromprocess_unused text)
RETURNS TABLE("id" bigint, "Item" text, "Process" text, "BatchPrefix" text, "Department" text, "WareHouse" text, "HSN" text, "CapacityUnit" text, "WastePer" numeric, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "Item",
           NULL::text AS "Process",
           NULL::text AS "BatchPrefix",
           NULL::text AS "Department",
           NULL::text AS "WareHouse",
           NULL::text AS "HSN",
           NULL::text AS "CapacityUnit",
           NULL::numeric AS "WastePer",
           false AS "LOCK";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_fromProcess_GridCount1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_fromProcess_GridCount1"(
    
    p_process text,
    p_fromprocess_frm text, p_fromprocess_fcode text, p_fromprocess_auth text)
RETURNS TABLE("TotalPages" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT count(*)::bigint FROM public."tblProcess" t
    WHERE (COALESCE(p_process, '') = '' OR t."Process"::text ILIKE '%' || p_process || '%');
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_fromProcess_PRINT_ROW1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_fromProcess_PRINT_ROW1"(
    p_fromprocess_id bigint, p_fromprocess_frm text, p_fromprocess_auth text, p_fromprocess_unused text)
RETURNS TABLE("id" bigint, "Item" text, "Process" text, "BatchPrefix" text, "Department" text, "WareHouse" text, "HSN" text, "CapacityUnit" text, "WastePer" numeric, "det1" jsonb)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id",
           t."Item",
           t."Process",
           t."BatchPrefix",
           t."Department",
           t."WareHouse",
           t."HSN",
           t."CapacityUnit",
           t."WastePer",
           '[]'::jsonb AS "det1"
    FROM public."tblProcess" t
    WHERE t."Id" = p_fromprocess_id;
END
$fn$;
