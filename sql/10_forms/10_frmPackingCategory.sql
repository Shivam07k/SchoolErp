-- ============================================================

-- frmPackingCategory  (ported from old xErp sp_* contract)

-- table: tblfrmPackingCategory

-- ============================================================

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmPackingCategory_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmPackingCategory_Grid2"(
    p_frmpackingcategory_rows integer, p_frmpackingcategory_no integer,
    p_packingcategory text,
    p_frmpackingcategory_frm text, p_frmpackingcategory_fcode text, p_frmpackingcategory_auth text, p_frmpackingcategory_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "PackingCategory" text, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmPackingCategory" a
        WHERE ((COALESCE(p_packingcategory, '') = '' OR a."PackingCategory"::text ILIKE '%' || p_packingcategory || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmPackingCategory" t2 WHERE (COALESCE(p_packingcategory, '') = '' OR t2."PackingCategory"::text ILIKE '%' || p_packingcategory || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmpackingcategory_no - 1) * p_frmpackingcategory_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."PackingCategory",
               t."FCODE",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmPackingCategory" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_packingcategory, '') = '' OR t."PackingCategory"::text ILIKE '%' || p_packingcategory || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmpackingcategory_rows
    )
    SELECT p."id", p."PackingCategory", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmpackingcategory_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_packingcategory, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmPackingCategory"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmPackingCategory" t WHERE (COALESCE(p_packingcategory, '') = '' OR t."PackingCategory"::text ILIKE '%' || p_packingcategory || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblfrmPackingCategory_PackingCategory_trgm" ON public."tblfrmPackingCategory" USING gin ("PackingCategory" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmPackingCategory_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmPackingCategory_DFE1"(
    p_frmpackingcategory_id bigint, p_frmpackingcategory_frm text, p_frmpackingcategory_auth text, p_frmpackingcategory_unused text)
RETURNS TABLE("id" bigint, "PackingCategory" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."PackingCategory",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmPackingCategory" t
    WHERE t."Id" = p_frmpackingcategory_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmPackingCategory_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmPackingCategory_SAVE"(
    
    p_packingcategory text,
    p_frmpackingcategory_frm text, p_frmpackingcategory_fcode text, p_frmpackingcategory_auth text, p_frmpackingcategory_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmpackingcategory_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmpackingcategory_auth);
    INSERT INTO public."tblfrmPackingCategory" ("PackingCategory", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_packingcategory, ''), ''),
            v_uid,
            COALESCE(NULLIF(p_frmpackingcategory_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmPackingCategory_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmPackingCategory_UPDATE"(
    p_frmpackingcategory_id bigint,
    p_packingcategory text,
    p_frmpackingcategory_frm text, p_frmpackingcategory_fcode text, p_frmpackingcategory_auth text, p_frmpackingcategory_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmPackingCategory"
    SET "PackingCategory" = COALESCE(NULLIF(p_packingcategory, ''), ''),
            "FCODE" = COALESCE(NULLIF(p_frmpackingcategory_fcode, ''), "FCODE")
    WHERE "Id" = p_frmpackingcategory_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmpackingcategory_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmpackingcategory_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmPackingCategory_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmPackingCategory_Delete1"(
    p_frmpackingcategory_id bigint, p_frmpackingcategory_frm text, p_frmpackingcategory_auth text, p_frmpackingcategory_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    
    DELETE FROM public."tblfrmPackingCategory" WHERE "Id" = p_frmpackingcategory_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmPackingCategory_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmPackingCategory_LockUnlock1"(
    p_frmpackingcategory_id bigint, p_frmpackingcategory_frm text, p_frmpackingcategory_auth text, p_frmpackingcategory_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmpackingcategory_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmPackingCategory" WHERE "Id" = p_frmpackingcategory_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmPackingCategory"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmpackingcategory_auth)
    WHERE "Id" = p_frmpackingcategory_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmPackingCategory_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmPackingCategory_AddBlank"(
    p_frmpackingcategory_frm text, p_frmpackingcategory_auth text, p_frmpackingcategory_unused text)
RETURNS TABLE("id" bigint, "PackingCategory" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "PackingCategory",
           false AS "LOCK";
END
$fn$;
