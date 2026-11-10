-- ============================================================

-- frmBrand  (ported from old xErp sp_* contract)

-- table: tblBrand

-- ============================================================

ALTER TABLE public."tblBrand" ADD COLUMN IF NOT EXISTS "LOCK_User_Id" text;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_Brand_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_Brand_Grid2"(
    p_frmbrand_rows integer, p_frmbrand_no integer,
    p_brand text,
    p_frmbrand_frm text, p_frmbrand_fcode text, p_frmbrand_auth text, p_frmbrand_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "Brand" text, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblBrand" a
        WHERE ((COALESCE(p_brand, '') = '' OR a."BrandName"::text ILIKE '%' || p_brand || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblBrand" t2 WHERE (COALESCE(p_brand, '') = '' OR t2."BrandName"::text ILIKE '%' || p_brand || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmbrand_no - 1) * p_frmbrand_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."BrandName" AS "Brand",
               t."FCODE",
               COALESCE(t."LOCK", false) <> false AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblBrand" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_brand, '') = '' OR t."BrandName"::text ILIKE '%' || p_brand || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmbrand_rows
    )
    SELECT p."id", p."Brand", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmbrand_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_brand, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblBrand"'::regclass)
               ELSE (SELECT count(*) FROM public."tblBrand" t WHERE (COALESCE(p_brand, '') = '' OR t."BrandName"::text ILIKE '%' || p_brand || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblBrand_BrandName_trgm" ON public."tblBrand" USING gin ("BrandName" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_Brand_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_Brand_DFE1"(
    p_frmbrand_id bigint, p_frmbrand_frm text, p_frmbrand_auth text, p_frmbrand_unused text)
RETURNS TABLE("id" bigint, "Brand" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."BrandName" AS "Brand",
           COALESCE(t."LOCK", false) <> false AS "LOCK"
    FROM public."tblBrand" t
    WHERE t."Id" = p_frmbrand_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_Brand_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_Brand_SAVE"(
    
    p_brand text,
    p_frmbrand_frm text, p_frmbrand_fcode text, p_frmbrand_auth text, p_frmbrand_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmbrand_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmbrand_auth);
    INSERT INTO public."tblBrand" ("BrandName", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_brand, ''), ''),
            v_uid,
            COALESCE(NULLIF(p_frmbrand_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_Brand_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_Brand_UPDATE"(
    p_frmbrand_id bigint,
    p_brand text,
    p_frmbrand_frm text, p_frmbrand_fcode text, p_frmbrand_auth text, p_frmbrand_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblBrand"
    SET "BrandName" = COALESCE(NULLIF(p_brand, ''), ''),
            "FCODE" = COALESCE(NULLIF(p_frmbrand_fcode, ''), "FCODE")
    WHERE "Id" = p_frmbrand_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmbrand_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmbrand_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_Brand_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_Brand_Delete1"(
    p_frmbrand_id bigint, p_frmbrand_frm text, p_frmbrand_auth text, p_frmbrand_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    
    DELETE FROM public."tblBrand" WHERE "Id" = p_frmbrand_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_Brand_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_Brand_LockUnlock1"(
    p_frmbrand_id bigint, p_frmbrand_frm text, p_frmbrand_auth text, p_frmbrand_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmbrand_auth;
    SELECT COALESCE("LOCK", false) <> false INTO v_lock
    FROM public."tblBrand" WHERE "Id" = p_frmbrand_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblBrand"
    SET "LOCK" = NOT COALESCE("LOCK", false),
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmbrand_auth)
    WHERE "Id" = p_frmbrand_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmBrand_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmBrand_AddBlank"(
    p_frmbrand_frm text, p_frmbrand_auth text, p_frmbrand_unused text)
RETURNS TABLE("id" bigint, "Brand" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "Brand",
           false AS "LOCK";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_Brand_GridCount1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_Brand_GridCount1"(
    
    p_brand text,
    p_frmbrand_frm text, p_frmbrand_fcode text, p_frmbrand_auth text)
RETURNS TABLE("TotalPages" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT count(*)::bigint FROM public."tblBrand" t
    WHERE (COALESCE(p_brand, '') = '' OR t."BrandName"::text ILIKE '%' || p_brand || '%');
END
$fn$;
