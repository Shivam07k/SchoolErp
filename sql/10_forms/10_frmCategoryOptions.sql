-- ============================================================

-- frmCategoryOptions  (ported from old xErp sp_* contract)

-- table: tblCategoryOptions

-- ============================================================

ALTER TABLE public."tblCategoryOptions" ADD COLUMN IF NOT EXISTS "fldType" text;

ALTER TABLE public."tblCategoryOptions" ADD COLUMN IF NOT EXISTS "fldDefault" text;

ALTER TABLE public."tblCategoryOptions" ADD COLUMN IF NOT EXISTS "IncludeInTitle" text;

ALTER TABLE public."tblCategoryOptions" ADD COLUMN IF NOT EXISTS "TitlePrefix" text;

ALTER TABLE public."tblCategoryOptions" ADD COLUMN IF NOT EXISTS "TitleSuffix" text;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCategoryOptions_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCategoryOptions_Grid2"(
    p_frmcategoryoptions_rows integer, p_frmcategoryoptions_no integer,
    p_category text,
    p_fldname text,
    p_frmcategoryoptions_frm text, p_frmcategoryoptions_fcode text, p_frmcategoryoptions_auth text, p_frmcategoryoptions_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "Category" text, "fldName" text, "fldType" text, "fldDefault" text, "IncludeInTitle" text, "TitlePrefix" text, "TitleSuffix" text, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblCategoryOptions" a
        WHERE ((COALESCE(p_category, '') = '' OR a."Category"::text ILIKE '%' || p_category || '%')
          AND (COALESCE(p_fldname, '') = '' OR a."fldName"::text ILIKE '%' || p_fldname || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblCategoryOptions" t2 WHERE (COALESCE(p_category, '') = '' OR t2."Category"::text ILIKE '%' || p_category || '%')
          AND (COALESCE(p_fldname, '') = '' OR t2."fldName"::text ILIKE '%' || p_fldname || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmcategoryoptions_no - 1) * p_frmcategoryoptions_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."Category",
               t."fldName",
               t."fldType",
               t."fldDefault",
               t."IncludeInTitle",
               t."TitlePrefix",
               t."TitleSuffix",
               t."FCODE",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblCategoryOptions" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_category, '') = '' OR t."Category"::text ILIKE '%' || p_category || '%')
          AND (COALESCE(p_fldname, '') = '' OR t."fldName"::text ILIKE '%' || p_fldname || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmcategoryoptions_rows
    )
    SELECT p."id", p."Category", p."fldName", p."fldType", p."fldDefault", p."IncludeInTitle", p."TitlePrefix", p."TitleSuffix", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmcategoryoptions_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_category, '') = ''
                     AND COALESCE(p_fldname, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblCategoryOptions"'::regclass)
               ELSE (SELECT count(*) FROM public."tblCategoryOptions" t WHERE (COALESCE(p_category, '') = '' OR t."Category"::text ILIKE '%' || p_category || '%')
          AND (COALESCE(p_fldname, '') = '' OR t."fldName"::text ILIKE '%' || p_fldname || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblCategoryOptions_Category_trgm" ON public."tblCategoryOptions" USING gin ("Category" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblCategoryOptions_fldName_trgm" ON public."tblCategoryOptions" USING gin ("fldName" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCategoryOptions_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCategoryOptions_DFE1"(
    p_frmcategoryoptions_id bigint, p_frmcategoryoptions_frm text, p_frmcategoryoptions_auth text, p_frmcategoryoptions_unused text)
RETURNS TABLE("id" bigint, "Category" text, "fldName" text, "fldType" text, "fldDefault" text, "IncludeInTitle" text, "TitlePrefix" text, "TitleSuffix" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."Category",
           t."fldName",
           t."fldType",
           t."fldDefault",
           t."IncludeInTitle",
           t."TitlePrefix",
           t."TitleSuffix",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblCategoryOptions" t
    WHERE t."Id" = p_frmcategoryoptions_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCategoryOptions_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCategoryOptions_SAVE"(
    
    p_category text,
    p_fldname text,
    p_fldtype text,
    p_flddefault text,
    p_includeintitle text,
    p_titleprefix text,
    p_titlesuffix text,
    p_frmcategoryoptions_frm text, p_frmcategoryoptions_fcode text, p_frmcategoryoptions_auth text, p_frmcategoryoptions_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmcategoryoptions_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmcategoryoptions_auth);
    INSERT INTO public."tblCategoryOptions" ("Category", "fldName", "fldType", "fldDefault", "IncludeInTitle", "TitlePrefix", "TitleSuffix", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_category, ''), ''),
            COALESCE(NULLIF(p_fldname, ''), ''),
            COALESCE(NULLIF(p_fldtype, ''), ''),
            COALESCE(NULLIF(p_flddefault, ''), ''),
            COALESCE(NULLIF(p_includeintitle, ''), ''),
            COALESCE(NULLIF(p_titleprefix, ''), ''),
            COALESCE(NULLIF(p_titlesuffix, ''), ''),
            v_uid,
            COALESCE(NULLIF(p_frmcategoryoptions_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCategoryOptions_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCategoryOptions_UPDATE"(
    p_frmcategoryoptions_id bigint,
    p_category text,
    p_fldname text,
    p_fldtype text,
    p_flddefault text,
    p_includeintitle text,
    p_titleprefix text,
    p_titlesuffix text,
    p_frmcategoryoptions_frm text, p_frmcategoryoptions_fcode text, p_frmcategoryoptions_auth text, p_frmcategoryoptions_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblCategoryOptions"
    SET "Category" = COALESCE(NULLIF(p_category, ''), ''),
            "fldName" = COALESCE(NULLIF(p_fldname, ''), ''),
            "fldType" = COALESCE(NULLIF(p_fldtype, ''), ''),
            "fldDefault" = COALESCE(NULLIF(p_flddefault, ''), ''),
            "IncludeInTitle" = COALESCE(NULLIF(p_includeintitle, ''), ''),
            "TitlePrefix" = COALESCE(NULLIF(p_titleprefix, ''), ''),
            "TitleSuffix" = COALESCE(NULLIF(p_titlesuffix, ''), ''),
            "FCODE" = COALESCE(NULLIF(p_frmcategoryoptions_fcode, ''), "FCODE")
    WHERE "Id" = p_frmcategoryoptions_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmcategoryoptions_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmcategoryoptions_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCategoryOptions_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCategoryOptions_Delete1"(
    p_frmcategoryoptions_id bigint, p_frmcategoryoptions_frm text, p_frmcategoryoptions_auth text, p_frmcategoryoptions_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    
    DELETE FROM public."tblCategoryOptions" WHERE "Id" = p_frmcategoryoptions_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCategoryOptions_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCategoryOptions_LockUnlock1"(
    p_frmcategoryoptions_id bigint, p_frmcategoryoptions_frm text, p_frmcategoryoptions_auth text, p_frmcategoryoptions_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmcategoryoptions_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblCategoryOptions" WHERE "Id" = p_frmcategoryoptions_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblCategoryOptions"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmcategoryoptions_auth)
    WHERE "Id" = p_frmcategoryoptions_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCategoryOptions_boot'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmCategoryOptions_boot"(
    p_frmcategoryoptions_frm text, p_frmcategoryoptions_auth text, p_frmcategoryoptions_unused text)
RETURNS TABLE("id" bigint, "Category" text, "fldName" text, "fldType" text, "fldDefault" text, "IncludeInTitle" text, "TitlePrefix" text, "TitleSuffix" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "Category",
           NULL::text AS "fldName",
           NULL::text AS "fldType",
           NULL::text AS "fldDefault",
           NULL::text AS "IncludeInTitle",
           NULL::text AS "TitlePrefix",
           NULL::text AS "TitleSuffix",
           false AS "LOCK";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCategoryOptions_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmCategoryOptions_AddBlank"(
    p_frmcategoryoptions_frm text, p_frmcategoryoptions_auth text, p_frmcategoryoptions_unused text)
RETURNS TABLE("id" bigint, "Category" text, "fldName" text, "fldType" text, "fldDefault" text, "IncludeInTitle" text, "TitlePrefix" text, "TitleSuffix" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "Category",
           NULL::text AS "fldName",
           NULL::text AS "fldType",
           NULL::text AS "fldDefault",
           NULL::text AS "IncludeInTitle",
           NULL::text AS "TitlePrefix",
           NULL::text AS "TitleSuffix",
           false AS "LOCK";
END
$fn$;
