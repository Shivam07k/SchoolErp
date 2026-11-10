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


-- ============================================================

-- frmCustomer  (ported from old xErp sp_* contract)

-- table: tblfrmCustomer

-- ============================================================

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "Alias" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "Currency" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "Add1" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "Add2" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "City" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "State" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "PinCode" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "ContactDescription" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "Phone" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "Email" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "WhatsAppNo" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "CustomerGroup" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "CrLimit" numeric;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "PmntTerm" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "PmntMethod" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "DeliveryTerm" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "DeliveryMode" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "GstIn" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "PAN" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "BankaName" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "BankAc" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "IFSC" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "Transport" text;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "IsCustomer" boolean;

ALTER TABLE public."tblfrmCustomer" ADD COLUMN IF NOT EXISTS "IsSupplier" boolean;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCustomer_Grid2"(
    p_frmcustomer_rows integer, p_frmcustomer_no integer,
    p_ledgercode text,
    p_ledgergroup text,
    p_country text,
    p_frmcustomer_frm text, p_frmcustomer_fcode text, p_frmcustomer_auth text, p_frmcustomer_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "LedgerCode" text, "LedgerGroup" text, "Alias" text, "Currency" text, "Country" text, "Add1" text, "Add2" text, "City" text, "State" text, "PinCode" text, "ContactDescription" text, "Phone" text, "Email" text, "WhatsAppNo" text, "CustomerGroup" text, "CrLimit" numeric, "PmntTerm" text, "PmntMethod" text, "DeliveryTerm" text, "DeliveryMode" text, "GstIn" text, "PAN" text, "BankaName" text, "BankAc" text, "IFSC" text, "Transport" text, "IsCustomer" boolean, "IsSupplier" boolean, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmCustomer" a
        WHERE ((COALESCE(p_ledgercode, '') = '' OR a."LedgerCode"::text ILIKE '%' || p_ledgercode || '%')
          AND (COALESCE(p_ledgergroup, '') = '' OR a."LedgerGroup"::text ILIKE '%' || p_ledgergroup || '%')
          AND (COALESCE(p_country, '') = '' OR a."Country"::text ILIKE '%' || p_country || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmCustomer" t2 WHERE (COALESCE(p_ledgercode, '') = '' OR t2."LedgerCode"::text ILIKE '%' || p_ledgercode || '%')
          AND (COALESCE(p_ledgergroup, '') = '' OR t2."LedgerGroup"::text ILIKE '%' || p_ledgergroup || '%')
          AND (COALESCE(p_country, '') = '' OR t2."Country"::text ILIKE '%' || p_country || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmcustomer_no - 1) * p_frmcustomer_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."LedgerCode",
               t."LedgerGroup",
               t."Alias",
               t."Currency",
               t."Country",
               t."Add1",
               t."Add2",
               t."City",
               t."State",
               t."PinCode",
               t."ContactDescription",
               t."Phone",
               t."Email",
               t."WhatsAppNo",
               t."CustomerGroup",
               t."CrLimit",
               t."PmntTerm",
               t."PmntMethod",
               t."DeliveryTerm",
               t."DeliveryMode",
               t."GstIn",
               t."PAN",
               t."BankaName",
               t."BankAc",
               t."IFSC",
               t."Transport",
               t."IsCustomer",
               t."IsSupplier",
               t."FCODE",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmCustomer" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_ledgercode, '') = '' OR t."LedgerCode"::text ILIKE '%' || p_ledgercode || '%')
          AND (COALESCE(p_ledgergroup, '') = '' OR t."LedgerGroup"::text ILIKE '%' || p_ledgergroup || '%')
          AND (COALESCE(p_country, '') = '' OR t."Country"::text ILIKE '%' || p_country || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmcustomer_rows
    )
    SELECT p."id", p."LedgerCode", p."LedgerGroup", p."Alias", p."Currency", p."Country", p."Add1", p."Add2", p."City", p."State", p."PinCode", p."ContactDescription", p."Phone", p."Email", p."WhatsAppNo", p."CustomerGroup", p."CrLimit", p."PmntTerm", p."PmntMethod", p."DeliveryTerm", p."DeliveryMode", p."GstIn", p."PAN", p."BankaName", p."BankAc", p."IFSC", p."Transport", p."IsCustomer", p."IsSupplier", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmcustomer_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_ledgercode, '') = ''
                     AND COALESCE(p_ledgergroup, '') = ''
                     AND COALESCE(p_country, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmCustomer"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmCustomer" t WHERE (COALESCE(p_ledgercode, '') = '' OR t."LedgerCode"::text ILIKE '%' || p_ledgercode || '%')
          AND (COALESCE(p_ledgergroup, '') = '' OR t."LedgerGroup"::text ILIKE '%' || p_ledgergroup || '%')
          AND (COALESCE(p_country, '') = '' OR t."Country"::text ILIKE '%' || p_country || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblfrmCustomer_LedgerCode_trgm" ON public."tblfrmCustomer" USING gin ("LedgerCode" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmCustomer_LedgerGroup_trgm" ON public."tblfrmCustomer" USING gin ("LedgerGroup" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmCustomer_Country_trgm" ON public."tblfrmCustomer" USING gin ("Country" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCustomer_DFE1"(
    p_frmcustomer_id bigint, p_frmcustomer_frm text, p_frmcustomer_auth text, p_frmcustomer_unused text)
RETURNS TABLE("id" bigint, "LedgerCode" text, "LedgerGroup" text, "Alias" text, "Currency" text, "Country" text, "Add1" text, "Add2" text, "City" text, "State" text, "PinCode" text, "ContactDescription" text, "Phone" text, "Email" text, "WhatsAppNo" text, "CustomerGroup" text, "CrLimit" numeric, "PmntTerm" text, "PmntMethod" text, "DeliveryTerm" text, "DeliveryMode" text, "GstIn" text, "PAN" text, "BankaName" text, "BankAc" text, "IFSC" text, "Transport" text, "IsCustomer" boolean, "IsSupplier" boolean, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."LedgerCode",
           t."LedgerGroup",
           t."Alias",
           t."Currency",
           t."Country",
           t."Add1",
           t."Add2",
           t."City",
           t."State",
           t."PinCode",
           t."ContactDescription",
           t."Phone",
           t."Email",
           t."WhatsAppNo",
           t."CustomerGroup",
           t."CrLimit",
           t."PmntTerm",
           t."PmntMethod",
           t."DeliveryTerm",
           t."DeliveryMode",
           t."GstIn",
           t."PAN",
           t."BankaName",
           t."BankAc",
           t."IFSC",
           t."Transport",
           t."IsCustomer",
           t."IsSupplier",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmCustomer" t
    WHERE t."Id" = p_frmcustomer_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCustomer_SAVE"(
    
    p_ledgercode text,
    p_ledgergroup text,
    p_alias text,
    p_currency text,
    p_country text,
    p_add1 text,
    p_add2 text,
    p_city text,
    p_state text,
    p_pincode text,
    p_contactdescription text,
    p_phone text,
    p_email text,
    p_whatsappno text,
    p_customergroup text,
    p_crlimit text,
    p_pmntterm text,
    p_pmntmethod text,
    p_deliveryterm text,
    p_deliverymode text,
    p_gstin text,
    p_pan text,
    p_bankaname text,
    p_bankac text,
    p_ifsc text,
    p_transport text,
    p_iscustomer text,
    p_issupplier text,
    p_frmcustomer_frm text, p_frmcustomer_fcode text, p_frmcustomer_auth text, p_frmcustomer_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmcustomer_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmcustomer_auth);
    INSERT INTO public."tblfrmCustomer" ("LedgerCode", "LedgerGroup", "Alias", "Currency", "Country", "Add1", "Add2", "City", "State", "PinCode", "ContactDescription", "Phone", "Email", "WhatsAppNo", "CustomerGroup", "CrLimit", "PmntTerm", "PmntMethod", "DeliveryTerm", "DeliveryMode", "GstIn", "PAN", "BankaName", "BankAc", "IFSC", "Transport", "IsCustomer", "IsSupplier", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_ledgercode, ''), ''),
            COALESCE(NULLIF(p_ledgergroup, ''), ''),
            COALESCE(NULLIF(p_alias, ''), ''),
            COALESCE(NULLIF(p_currency, ''), ''),
            COALESCE(NULLIF(p_country, ''), ''),
            COALESCE(NULLIF(p_add1, ''), ''),
            COALESCE(NULLIF(p_add2, ''), ''),
            COALESCE(NULLIF(p_city, ''), ''),
            COALESCE(NULLIF(p_state, ''), ''),
            COALESCE(NULLIF(p_pincode, ''), ''),
            COALESCE(NULLIF(p_contactdescription, ''), ''),
            COALESCE(NULLIF(p_phone, ''), ''),
            COALESCE(NULLIF(p_email, ''), ''),
            COALESCE(NULLIF(p_whatsappno, ''), ''),
            COALESCE(NULLIF(p_customergroup, ''), ''),
            CASE WHEN trim(p_crlimit) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_crlimit::numeric ELSE 0 END,
            COALESCE(NULLIF(p_pmntterm, ''), ''),
            COALESCE(NULLIF(p_pmntmethod, ''), ''),
            COALESCE(NULLIF(p_deliveryterm, ''), ''),
            COALESCE(NULLIF(p_deliverymode, ''), ''),
            COALESCE(NULLIF(p_gstin, ''), ''),
            COALESCE(NULLIF(p_pan, ''), ''),
            COALESCE(NULLIF(p_bankaname, ''), ''),
            COALESCE(NULLIF(p_bankac, ''), ''),
            COALESCE(NULLIF(p_ifsc, ''), ''),
            COALESCE(NULLIF(p_transport, ''), ''),
            CASE WHEN lower(trim(p_iscustomer)) IN ('true','1','t','y','yes','on') THEN true ELSE false END,
            CASE WHEN lower(trim(p_issupplier)) IN ('true','1','t','y','yes','on') THEN true ELSE false END,
            v_uid,
            COALESCE(NULLIF(p_frmcustomer_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCustomer_UPDATE"(
    p_frmcustomer_id bigint,
    p_ledgercode text,
    p_ledgergroup text,
    p_alias text,
    p_currency text,
    p_country text,
    p_add1 text,
    p_add2 text,
    p_city text,
    p_state text,
    p_pincode text,
    p_contactdescription text,
    p_phone text,
    p_email text,
    p_whatsappno text,
    p_customergroup text,
    p_crlimit text,
    p_pmntterm text,
    p_pmntmethod text,
    p_deliveryterm text,
    p_deliverymode text,
    p_gstin text,
    p_pan text,
    p_bankaname text,
    p_bankac text,
    p_ifsc text,
    p_transport text,
    p_iscustomer text,
    p_issupplier text,
    p_frmcustomer_frm text, p_frmcustomer_fcode text, p_frmcustomer_auth text, p_frmcustomer_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmCustomer"
    SET "LedgerCode" = COALESCE(NULLIF(p_ledgercode, ''), ''),
            "LedgerGroup" = COALESCE(NULLIF(p_ledgergroup, ''), ''),
            "Alias" = COALESCE(NULLIF(p_alias, ''), ''),
            "Currency" = COALESCE(NULLIF(p_currency, ''), ''),
            "Country" = COALESCE(NULLIF(p_country, ''), ''),
            "Add1" = COALESCE(NULLIF(p_add1, ''), ''),
            "Add2" = COALESCE(NULLIF(p_add2, ''), ''),
            "City" = COALESCE(NULLIF(p_city, ''), ''),
            "State" = COALESCE(NULLIF(p_state, ''), ''),
            "PinCode" = COALESCE(NULLIF(p_pincode, ''), ''),
            "ContactDescription" = COALESCE(NULLIF(p_contactdescription, ''), ''),
            "Phone" = COALESCE(NULLIF(p_phone, ''), ''),
            "Email" = COALESCE(NULLIF(p_email, ''), ''),
            "WhatsAppNo" = COALESCE(NULLIF(p_whatsappno, ''), ''),
            "CustomerGroup" = COALESCE(NULLIF(p_customergroup, ''), ''),
            "CrLimit" = CASE WHEN trim(p_crlimit) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_crlimit::numeric ELSE 0 END,
            "PmntTerm" = COALESCE(NULLIF(p_pmntterm, ''), ''),
            "PmntMethod" = COALESCE(NULLIF(p_pmntmethod, ''), ''),
            "DeliveryTerm" = COALESCE(NULLIF(p_deliveryterm, ''), ''),
            "DeliveryMode" = COALESCE(NULLIF(p_deliverymode, ''), ''),
            "GstIn" = COALESCE(NULLIF(p_gstin, ''), ''),
            "PAN" = COALESCE(NULLIF(p_pan, ''), ''),
            "BankaName" = COALESCE(NULLIF(p_bankaname, ''), ''),
            "BankAc" = COALESCE(NULLIF(p_bankac, ''), ''),
            "IFSC" = COALESCE(NULLIF(p_ifsc, ''), ''),
            "Transport" = COALESCE(NULLIF(p_transport, ''), ''),
            "IsCustomer" = CASE WHEN lower(trim(p_iscustomer)) IN ('true','1','t','y','yes','on') THEN true ELSE false END,
            "IsSupplier" = CASE WHEN lower(trim(p_issupplier)) IN ('true','1','t','y','yes','on') THEN true ELSE false END,
            "FCODE" = COALESCE(NULLIF(p_frmcustomer_fcode, ''), "FCODE")
    WHERE "Id" = p_frmcustomer_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmcustomer_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmcustomer_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCustomer_Delete1"(
    p_frmcustomer_id bigint, p_frmcustomer_frm text, p_frmcustomer_auth text, p_frmcustomer_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    
    DELETE FROM public."tblfrmCustomer" WHERE "Id" = p_frmcustomer_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCustomer_LockUnlock1"(
    p_frmcustomer_id bigint, p_frmcustomer_frm text, p_frmcustomer_auth text, p_frmcustomer_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmcustomer_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmCustomer" WHERE "Id" = p_frmcustomer_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmCustomer"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmcustomer_auth)
    WHERE "Id" = p_frmcustomer_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmCustomer_AddBlank"(
    p_frmcustomer_frm text, p_frmcustomer_auth text, p_frmcustomer_unused text)
RETURNS TABLE("id" bigint, "LedgerCode" text, "LedgerGroup" text, "Alias" text, "Currency" text, "Country" text, "Add1" text, "Add2" text, "City" text, "State" text, "PinCode" text, "ContactDescription" text, "Phone" text, "Email" text, "WhatsAppNo" text, "CustomerGroup" text, "CrLimit" numeric, "PmntTerm" text, "PmntMethod" text, "DeliveryTerm" text, "DeliveryMode" text, "GstIn" text, "PAN" text, "BankaName" text, "BankAc" text, "IFSC" text, "Transport" text, "IsCustomer" boolean, "IsSupplier" boolean, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "LedgerCode",
           NULL::text AS "LedgerGroup",
           NULL::text AS "Alias",
           NULL::text AS "Currency",
           NULL::text AS "Country",
           NULL::text AS "Add1",
           NULL::text AS "Add2",
           NULL::text AS "City",
           NULL::text AS "State",
           NULL::text AS "PinCode",
           NULL::text AS "ContactDescription",
           NULL::text AS "Phone",
           NULL::text AS "Email",
           NULL::text AS "WhatsAppNo",
           NULL::text AS "CustomerGroup",
           NULL::numeric AS "CrLimit",
           NULL::text AS "PmntTerm",
           NULL::text AS "PmntMethod",
           NULL::text AS "DeliveryTerm",
           NULL::text AS "DeliveryMode",
           NULL::text AS "GstIn",
           NULL::text AS "PAN",
           NULL::text AS "BankaName",
           NULL::text AS "BankAc",
           NULL::text AS "IFSC",
           NULL::text AS "Transport",
           NULL::boolean AS "IsCustomer",
           NULL::boolean AS "IsSupplier",
           false AS "LOCK";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_GridCount1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCustomer_GridCount1"(
    
    p_ledgercode text,
    p_ledgergroup text,
    p_country text,
    p_frmcustomer_frm text, p_frmcustomer_fcode text, p_frmcustomer_auth text)
RETURNS TABLE("TotalPages" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT count(*)::bigint FROM public."tblfrmCustomer" t
    WHERE (COALESCE(p_ledgercode, '') = '' OR t."LedgerCode"::text ILIKE '%' || p_ledgercode || '%')
          AND (COALESCE(p_ledgergroup, '') = '' OR t."LedgerGroup"::text ILIKE '%' || p_ledgergroup || '%')
          AND (COALESCE(p_country, '') = '' OR t."Country"::text ILIKE '%' || p_country || '%');
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_PRINT_ROW1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCustomer_PRINT_ROW1"(
    p_frmcustomer_id bigint, p_frmcustomer_frm text, p_frmcustomer_auth text, p_frmcustomer_unused text)
RETURNS TABLE("id" bigint, "LedgerCode" text, "LedgerGroup" text, "Alias" text, "Currency" text, "Country" text, "Add1" text, "Add2" text, "City" text, "State" text, "PinCode" text, "ContactDescription" text, "Phone" text, "Email" text, "WhatsAppNo" text, "CustomerGroup" text, "CrLimit" numeric, "PmntTerm" text, "PmntMethod" text, "DeliveryTerm" text, "DeliveryMode" text, "GstIn" text, "PAN" text, "BankaName" text, "BankAc" text, "IFSC" text, "Transport" text, "IsCustomer" boolean, "IsSupplier" boolean, "det1" jsonb)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id",
           t."LedgerCode",
           t."LedgerGroup",
           t."Alias",
           t."Currency",
           t."Country",
           t."Add1",
           t."Add2",
           t."City",
           t."State",
           t."PinCode",
           t."ContactDescription",
           t."Phone",
           t."Email",
           t."WhatsAppNo",
           t."CustomerGroup",
           t."CrLimit",
           t."PmntTerm",
           t."PmntMethod",
           t."DeliveryTerm",
           t."DeliveryMode",
           t."GstIn",
           t."PAN",
           t."BankaName",
           t."BankAc",
           t."IFSC",
           t."Transport",
           t."IsCustomer",
           t."IsSupplier",
           '[]'::jsonb AS "det1"
    FROM public."tblfrmCustomer" t
    WHERE t."Id" = p_frmcustomer_id;
END
$fn$;


-- ============================================================

-- frmDeptSale2  (ported from old xErp sp_* contract)

-- table: tblfrmDeptSale2

-- ============================================================

ALTER TABLE public."tblfrmDeptSale2" ADD COLUMN IF NOT EXISTS "tDate" date;

ALTER TABLE public."tblfrmDeptSale2" ADD COLUMN IF NOT EXISTS "From_" text;

ALTER TABLE public."tblfrmDeptSale2" ADD COLUMN IF NOT EXISTS "PoNo_" text;

ALTER TABLE public."tblfrmDeptSale2" ADD COLUMN IF NOT EXISTS "Remark" text;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_Grid2"(
    p_frmdeptsale2_rows integer, p_frmdeptsale2_no integer,
    p_sdate text,
    p_edate text,
    p_invno text,
    p_to text,
    p_workorderno text,
    p_frmdeptsale2_frm text, p_frmdeptsale2_fcode text, p_frmdeptsale2_auth text, p_frmdeptsale2_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "InvNo" text, "tDate" text, "From_" text, "To_" text, "WorkOrderNo_" text, "PoNo_" text, "Remark" text, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmDeptSale2" a
        WHERE ((COALESCE(p_sdate, '') = '' OR a."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR a."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_invno, '') = '' OR a."InvNo"::text ILIKE '%' || p_invno || '%')
          AND (COALESCE(p_to, '') = '' OR a."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_workorderno, '') = '' OR a."WorkOrderNo_"::text ILIKE '%' || p_workorderno || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmDeptSale2" t2 WHERE (COALESCE(p_sdate, '') = '' OR t2."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR t2."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_invno, '') = '' OR t2."InvNo"::text ILIKE '%' || p_invno || '%')
          AND (COALESCE(p_to, '') = '' OR t2."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_workorderno, '') = '' OR t2."WorkOrderNo_"::text ILIKE '%' || p_workorderno || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmdeptsale2_no - 1) * p_frmdeptsale2_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."InvNo",
               to_char(t."tDate", 'YYYY-MM-DD') AS "tDate",
               t."From_",
               t."To_",
               t."WorkOrderNo_",
               t."PoNo_",
               t."Remark",
               t."FCODE",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmDeptSale2" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_sdate, '') = '' OR t."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR t."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_invno, '') = '' OR t."InvNo"::text ILIKE '%' || p_invno || '%')
          AND (COALESCE(p_to, '') = '' OR t."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_workorderno, '') = '' OR t."WorkOrderNo_"::text ILIKE '%' || p_workorderno || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmdeptsale2_rows
    )
    SELECT p."id", p."InvNo", p."tDate", p."From_", p."To_", p."WorkOrderNo_", p."PoNo_", p."Remark", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmdeptsale2_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_sdate, '') = ''
                     AND COALESCE(p_edate, '') = ''
                     AND COALESCE(p_invno, '') = ''
                     AND COALESCE(p_to, '') = ''
                     AND COALESCE(p_workorderno, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmDeptSale2"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmDeptSale2" t WHERE (COALESCE(p_sdate, '') = '' OR t."sDate"::text ILIKE '%' || p_sdate || '%')
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

      CREATE INDEX IF NOT EXISTS "idx_tblfrmDeptSale2_sDate_trgm" ON public."tblfrmDeptSale2" USING gin ("sDate" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmDeptSale2_eDate_trgm" ON public."tblfrmDeptSale2" USING gin ("eDate" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmDeptSale2_InvNo_trgm" ON public."tblfrmDeptSale2" USING gin ("InvNo" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmDeptSale2_To__trgm" ON public."tblfrmDeptSale2" USING gin ("To_" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmDeptSale2_WorkOrderNo__trgm" ON public."tblfrmDeptSale2" USING gin ("WorkOrderNo_" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_DFE1"(
    p_frmdeptsale2_id bigint, p_frmdeptsale2_frm text, p_frmdeptsale2_auth text, p_frmdeptsale2_unused text)
RETURNS TABLE("id" bigint, "InvNo" text, "tDate" text, "From_" text, "To_" text, "WorkOrderNo_" text, "PoNo_" text, "Remark" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."InvNo",
           to_char(t."tDate", 'YYYY-MM-DD') AS "tDate",
           t."From_",
           t."To_",
           t."WorkOrderNo_",
           t."PoNo_",
           t."Remark",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmDeptSale2" t
    WHERE t."Id" = p_frmdeptsale2_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_SAVE"(
    
    p_invno text,
    p_tdate text,
    p_from text,
    p_to text,
    p_workorderno text,
    p_pono text,
    p_remark text,
    p_frmdeptsale2_frm text, p_frmdeptsale2_fcode text, p_frmdeptsale2_auth text, p_frmdeptsale2_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmdeptsale2_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmdeptsale2_auth);
    INSERT INTO public."tblfrmDeptSale2" ("InvNo", "tDate", "From_", "To_", "WorkOrderNo_", "PoNo_", "Remark", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_invno, ''), ''),
            CASE WHEN trim(p_tdate) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN p_tdate::date ELSE NULL END,
            COALESCE(NULLIF(p_from, ''), ''),
            COALESCE(NULLIF(p_to, ''), ''),
            COALESCE(NULLIF(p_workorderno, ''), ''),
            COALESCE(NULLIF(p_pono, ''), ''),
            COALESCE(NULLIF(p_remark, ''), ''),
            v_uid,
            COALESCE(NULLIF(p_frmdeptsale2_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_UPDATE"(
    p_frmdeptsale2_id bigint,
    p_invno text,
    p_tdate text,
    p_from text,
    p_to text,
    p_workorderno text,
    p_pono text,
    p_remark text,
    p_frmdeptsale2_frm text, p_frmdeptsale2_fcode text, p_frmdeptsale2_auth text, p_frmdeptsale2_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmDeptSale2"
    SET "InvNo" = COALESCE(NULLIF(p_invno, ''), ''),
            "tDate" = CASE WHEN trim(p_tdate) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN p_tdate::date ELSE NULL END,
            "From_" = COALESCE(NULLIF(p_from, ''), ''),
            "To_" = COALESCE(NULLIF(p_to, ''), ''),
            "WorkOrderNo_" = COALESCE(NULLIF(p_workorderno, ''), ''),
            "PoNo_" = COALESCE(NULLIF(p_pono, ''), ''),
            "Remark" = COALESCE(NULLIF(p_remark, ''), ''),
            "FCODE" = COALESCE(NULLIF(p_frmdeptsale2_fcode, ''), "FCODE")
    WHERE "Id" = p_frmdeptsale2_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmdeptsale2_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmdeptsale2_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_Delete1"(
    p_frmdeptsale2_id bigint, p_frmdeptsale2_frm text, p_frmdeptsale2_auth text, p_frmdeptsale2_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    DELETE FROM public."tblGoodsSaleDet" WHERE "GoodsSale_id" = p_frmdeptsale2_id;
    DELETE FROM public."tblfrmDeptSale2" WHERE "Id" = p_frmdeptsale2_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_LockUnlock1"(
    p_frmdeptsale2_id bigint, p_frmdeptsale2_frm text, p_frmdeptsale2_auth text, p_frmdeptsale2_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmdeptsale2_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmDeptSale2" WHERE "Id" = p_frmdeptsale2_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmDeptSale2"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmdeptsale2_auth)
    WHERE "Id" = p_frmdeptsale2_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_AddBlank"(
    p_frmdeptsale2_frm text, p_frmdeptsale2_auth text, p_frmdeptsale2_unused text)
RETURNS TABLE("id" bigint)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmdeptsale2_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmdeptsale2_auth);
    INSERT INTO public."tblfrmDeptSale2" ("InvNo", "tDate", "From_", "To_", "WorkOrderNo_", "PoNo_", "Remark", "FCODE", "User_Id")
    VALUES (''::text,
            NULL::date,
            ''::text,
            ''::text,
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

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_GridCount1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_GridCount1"(
    
    p_sdate text,
    p_edate text,
    p_invno text,
    p_to text,
    p_workorderno text,
    p_frmdeptsale2_frm text, p_frmdeptsale2_fcode text, p_frmdeptsale2_auth text)
RETURNS TABLE("TotalPages" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT count(*)::bigint FROM public."tblfrmDeptSale2" t
    WHERE (COALESCE(p_sdate, '') = '' OR t."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR t."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_invno, '') = '' OR t."InvNo"::text ILIKE '%' || p_invno || '%')
          AND (COALESCE(p_to, '') = '' OR t."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_workorderno, '') = '' OR t."WorkOrderNo_"::text ILIKE '%' || p_workorderno || '%');
END
$fn$;

-- detail table: tblGoodsSaleDet (FK GoodsSale_id -> tblfrmDeptSale2.Id)

CREATE TABLE IF NOT EXISTS public."tblGoodsSaleDet" (
    "Id" bigserial PRIMARY KEY,
    "GoodsSale_id" numeric,
    "ItemNo" text,
    "remark" text,
    "Qty" numeric,
    "Rate" numeric,
    "taxableAmt" numeric,
    "Sgstper" numeric,
    "sgstamt" numeric,
    "Cgstper" numeric,
    "Cgstamt" numeric,
    "Igstper" numeric,
    "igstamt" numeric,
    "invoiceamt" numeric,
    "workorderno" text,
    "hsn" text,
    "unit" text,
    "DiscPer" numeric,
    "DiscAmt" numeric,
    "FCODE" text, "User_Id" text, "Created_At" timestamptz DEFAULT now());

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "GoodsSale_id" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "ItemNo" text;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "remark" text;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "Qty" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "Rate" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "taxableAmt" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "Sgstper" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "sgstamt" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "Cgstper" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "Cgstamt" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "Igstper" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "igstamt" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "invoiceamt" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "workorderno" text;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "hsn" text;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "unit" text;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "DiscPer" numeric;

ALTER TABLE public."tblGoodsSaleDet" ADD COLUMN IF NOT EXISTS "DiscAmt" numeric;

CREATE INDEX IF NOT EXISTS "idx_tblGoodsSaleDet_GoodsSale_id" ON public."tblGoodsSaleDet" ("GoodsSale_id");

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_DFE2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_DFE2"(
    p_frmdeptsale2_id bigint, p_frmdeptsale2_frm text, p_frmdeptsale2_auth text, p_frmdeptsale2_unused text)
RETURNS TABLE("id" bigint, "ItemNo" text, "Qty" numeric, "Rate" numeric, "TaxableAmt" numeric)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT d."Id",
           d."ItemNo" AS "ItemNo",
           d."Qty" AS "Qty",
           d."Rate" AS "Rate",
           d."taxableAmt" AS "TaxableAmt"
    FROM public."tblGoodsSaleDet" d
    WHERE d."GoodsSale_id" = p_frmdeptsale2_id
    ORDER BY d."Id";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_DeptSaledet_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_DeptSaledet_SAVE"(
    
    p_dgoodssale_id text,
    p_ditemno text,
    p_dremark text,
    p_dqty text,
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
    p_dhsn text,
    p_dunit text,
    p_ddiscper text,
    p_ddiscamt text,
    p_frmdeptsale2_frm text, p_frmdeptsale2_fcode text, p_frmdeptsale2_auth text, p_frmdeptsale2_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmdeptsale2_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmdeptsale2_auth);
    IF p_frmdeptsale2_frm = 'frmLocked' THEN
        RETURN QUERY SELECT 'Error'::text, 'Record is locked'::text, NULL::bigint, 'Record is locked'::text;
        RETURN;
    END IF;
    INSERT INTO public."tblGoodsSaleDet" ("GoodsSale_id", "ItemNo", "remark", "Qty", "Rate", "taxableAmt", "Sgstper", "sgstamt", "Cgstper", "Cgstamt", "Igstper", "igstamt", "invoiceamt", "workorderno", "hsn", "unit", "DiscPer", "DiscAmt", "FCODE", "User_Id")
    VALUES (CASE WHEN trim(p_dgoodssale_id) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dgoodssale_id::numeric ELSE 0 END,
            COALESCE(NULLIF(p_ditemno, ''), ''),
            COALESCE(NULLIF(p_dremark, ''), ''),
            CASE WHEN trim(p_dqty) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dqty::numeric ELSE 0 END,
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
            COALESCE(NULLIF(p_dhsn, ''), ''),
            COALESCE(NULLIF(p_dunit, ''), ''),
            CASE WHEN trim(p_ddiscper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_ddiscper::numeric ELSE 0 END,
            CASE WHEN trim(p_ddiscamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_ddiscamt::numeric ELSE 0 END,
            COALESCE(NULLIF(p_frmdeptsale2_fcode, ''), 'HO'), v_uid)
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_DeptSaledet_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_DeptSaledet_UPDATE"(
    p_frmdeptsale2_did bigint,
    p_dgoodssale_id text,
    p_ditemno text,
    p_dremark text,
    p_dqty text,
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
    p_dhsn text,
    p_dunit text,
    p_ddiscper text,
    p_ddiscamt text,
    p_frmdeptsale2_frm text, p_frmdeptsale2_fcode text, p_frmdeptsale2_auth text, p_frmdeptsale2_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblGoodsSaleDet"
    SET "GoodsSale_id" = CASE WHEN trim(p_dgoodssale_id) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dgoodssale_id::numeric ELSE 0 END,
            "ItemNo" = COALESCE(NULLIF(p_ditemno, ''), ''),
            "remark" = COALESCE(NULLIF(p_dremark, ''), ''),
            "Qty" = CASE WHEN trim(p_dqty) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dqty::numeric ELSE 0 END,
            "Rate" = CASE WHEN trim(p_drate) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_drate::numeric ELSE 0 END,
            "taxableAmt" = CASE WHEN trim(p_dtaxableamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dtaxableamt::numeric ELSE 0 END,
            "Sgstper" = CASE WHEN trim(p_dsgstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dsgstper::numeric ELSE 0 END,
            "sgstamt" = CASE WHEN trim(p_dsgstamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dsgstamt::numeric ELSE 0 END,
            "Cgstper" = CASE WHEN trim(p_dcgstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dcgstper::numeric ELSE 0 END,
            "Cgstamt" = CASE WHEN trim(p_dcgstamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dcgstamt::numeric ELSE 0 END,
            "Igstper" = CASE WHEN trim(p_digstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_digstper::numeric ELSE 0 END,
            "igstamt" = CASE WHEN trim(p_digstamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_digstamt::numeric ELSE 0 END,
            "invoiceamt" = CASE WHEN trim(p_dinvoiceamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_dinvoiceamt::numeric ELSE 0 END,
            "workorderno" = COALESCE(NULLIF(p_dworkorderno, ''), ''),
            "hsn" = COALESCE(NULLIF(p_dhsn, ''), ''),
            "unit" = COALESCE(NULLIF(p_dunit, ''), ''),
            "DiscPer" = CASE WHEN trim(p_ddiscper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_ddiscper::numeric ELSE 0 END,
            "DiscAmt" = CASE WHEN trim(p_ddiscamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_ddiscamt::numeric ELSE 0 END
    WHERE "Id" = p_frmdeptsale2_did;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Row not found'::text, p_frmdeptsale2_did, 'Row not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmdeptsale2_did, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_DeptSaledet_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_DeptSaledet_Delete1"(
    p_frmdeptsale2_did bigint, p_frmdeptsale2_frm text, p_frmdeptsale2_auth text, p_frmdeptsale2_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    DELETE FROM public."tblGoodsSaleDet" WHERE "Id" = p_frmdeptsale2_did;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmDeptSale2_PRINT_ROW1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmDeptSale2_PRINT_ROW1"(
    p_frmdeptsale2_id bigint, p_frmdeptsale2_frm text, p_frmdeptsale2_auth text, p_frmdeptsale2_unused text)
RETURNS TABLE("id" bigint, "InvNo" text, "tDate" text, "From_" text, "To_" text, "WorkOrderNo_" text, "PoNo_" text, "Remark" text, "det1" jsonb)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id",
           t."InvNo",
           to_char(t."tDate", 'YYYY-MM-DD'),
           t."From_",
           t."To_",
           t."WorkOrderNo_",
           t."PoNo_",
           t."Remark",
           (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d."Id"), '[]'::jsonb)
         FROM public."tblGoodsSaleDet" d WHERE d."GoodsSale_id" = t."Id") AS "det1"
    FROM public."tblfrmDeptSale2" t
    WHERE t."Id" = p_frmdeptsale2_id;
END
$fn$;


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


-- ============================================================

-- frmgoodsoutward  (ported from old xErp sp_* contract)

-- table: tblfrmgoodsoutward

-- ============================================================

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "tDate" date;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "PmntTerm" text;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "DueDays" numeric;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "GateEntryNo" text;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "Remark" text;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "Transport" text;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "VehicleNo" text;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "LrNo" text;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "Courier" text;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "CourierNo" text;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "EwayBillNo" text;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "DispatchMode" text;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "Distance" numeric;

ALTER TABLE public."tblfrmgoodsoutward" ADD COLUMN IF NOT EXISTS "ShippedOn" date;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmgoodsoutward_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmgoodsoutward_Grid2"(
    p_frmgoodsoutward_rows integer, p_frmgoodsoutward_no integer,
    p_sdate text,
    p_edate text,
    p_challanno text,
    p_pchallanno text,
    p_from text,
    p_to text,
    p_pono text,
    p_workorderno text,
    p_challantag text,
    p_frmgoodsoutward_frm text, p_frmgoodsoutward_fcode text, p_frmgoodsoutward_auth text, p_frmgoodsoutward_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "ChallanNo" text, "pChallanNo" text, "tDate" text, "From_" text, "To_" text, "ChallanTag" text, "PmntTerm" text, "DueDays" numeric, "GateEntryNo" text, "Remark" text, "Transport" text, "VehicleNo" text, "LrNo" text, "Courier" text, "CourierNo" text, "EwayBillNo" text, "DispatchMode" text, "Distance" numeric, "ShippedOn" text, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmgoodsoutward" a
        WHERE ((COALESCE(p_sdate, '') = '' OR a."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR a."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_challanno, '') = '' OR a."ChallanNo"::text ILIKE '%' || p_challanno || '%')
          AND (COALESCE(p_pchallanno, '') = '' OR a."pChallanNo"::text ILIKE '%' || p_pchallanno || '%')
          AND (COALESCE(p_from, '') = '' OR a."From_"::text ILIKE '%' || p_from || '%')
          AND (COALESCE(p_to, '') = '' OR a."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_pono, '') = '' OR a."PoNo"::text ILIKE '%' || p_pono || '%')
          AND (COALESCE(p_workorderno, '') = '' OR a."WorkOrderNo"::text ILIKE '%' || p_workorderno || '%')
          AND (COALESCE(p_challantag, '') = '' OR a."ChallanTag"::text ILIKE '%' || p_challantag || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmgoodsoutward" t2 WHERE (COALESCE(p_sdate, '') = '' OR t2."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR t2."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_challanno, '') = '' OR t2."ChallanNo"::text ILIKE '%' || p_challanno || '%')
          AND (COALESCE(p_pchallanno, '') = '' OR t2."pChallanNo"::text ILIKE '%' || p_pchallanno || '%')
          AND (COALESCE(p_from, '') = '' OR t2."From_"::text ILIKE '%' || p_from || '%')
          AND (COALESCE(p_to, '') = '' OR t2."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_pono, '') = '' OR t2."PoNo"::text ILIKE '%' || p_pono || '%')
          AND (COALESCE(p_workorderno, '') = '' OR t2."WorkOrderNo"::text ILIKE '%' || p_workorderno || '%')
          AND (COALESCE(p_challantag, '') = '' OR t2."ChallanTag"::text ILIKE '%' || p_challantag || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmgoodsoutward_no - 1) * p_frmgoodsoutward_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."ChallanNo",
               t."pChallanNo",
               to_char(t."tDate", 'YYYY-MM-DD') AS "tDate",
               t."From_",
               t."To_",
               t."ChallanTag",
               t."PmntTerm",
               t."DueDays",
               t."GateEntryNo",
               t."Remark",
               t."Transport",
               t."VehicleNo",
               t."LrNo",
               t."Courier",
               t."CourierNo",
               t."EwayBillNo",
               t."DispatchMode",
               t."Distance",
               to_char(t."ShippedOn", 'YYYY-MM-DD') AS "ShippedOn",
               t."FCODE",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmgoodsoutward" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_sdate, '') = '' OR t."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR t."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_challanno, '') = '' OR t."ChallanNo"::text ILIKE '%' || p_challanno || '%')
          AND (COALESCE(p_pchallanno, '') = '' OR t."pChallanNo"::text ILIKE '%' || p_pchallanno || '%')
          AND (COALESCE(p_from, '') = '' OR t."From_"::text ILIKE '%' || p_from || '%')
          AND (COALESCE(p_to, '') = '' OR t."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_pono, '') = '' OR t."PoNo"::text ILIKE '%' || p_pono || '%')
          AND (COALESCE(p_workorderno, '') = '' OR t."WorkOrderNo"::text ILIKE '%' || p_workorderno || '%')
          AND (COALESCE(p_challantag, '') = '' OR t."ChallanTag"::text ILIKE '%' || p_challantag || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmgoodsoutward_rows
    )
    SELECT p."id", p."ChallanNo", p."pChallanNo", p."tDate", p."From_", p."To_", p."ChallanTag", p."PmntTerm", p."DueDays", p."GateEntryNo", p."Remark", p."Transport", p."VehicleNo", p."LrNo", p."Courier", p."CourierNo", p."EwayBillNo", p."DispatchMode", p."Distance", p."ShippedOn", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmgoodsoutward_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_sdate, '') = ''
                     AND COALESCE(p_edate, '') = ''
                     AND COALESCE(p_challanno, '') = ''
                     AND COALESCE(p_pchallanno, '') = ''
                     AND COALESCE(p_from, '') = ''
                     AND COALESCE(p_to, '') = ''
                     AND COALESCE(p_pono, '') = ''
                     AND COALESCE(p_workorderno, '') = ''
                     AND COALESCE(p_challantag, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmgoodsoutward"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmgoodsoutward" t WHERE (COALESCE(p_sdate, '') = '' OR t."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR t."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_challanno, '') = '' OR t."ChallanNo"::text ILIKE '%' || p_challanno || '%')
          AND (COALESCE(p_pchallanno, '') = '' OR t."pChallanNo"::text ILIKE '%' || p_pchallanno || '%')
          AND (COALESCE(p_from, '') = '' OR t."From_"::text ILIKE '%' || p_from || '%')
          AND (COALESCE(p_to, '') = '' OR t."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_pono, '') = '' OR t."PoNo"::text ILIKE '%' || p_pono || '%')
          AND (COALESCE(p_workorderno, '') = '' OR t."WorkOrderNo"::text ILIKE '%' || p_workorderno || '%')
          AND (COALESCE(p_challantag, '') = '' OR t."ChallanTag"::text ILIKE '%' || p_challantag || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblfrmgoodsoutward_sDate_trgm" ON public."tblfrmgoodsoutward" USING gin ("sDate" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmgoodsoutward_eDate_trgm" ON public."tblfrmgoodsoutward" USING gin ("eDate" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmgoodsoutward_ChallanNo_trgm" ON public."tblfrmgoodsoutward" USING gin ("ChallanNo" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmgoodsoutward_pChallanNo_trgm" ON public."tblfrmgoodsoutward" USING gin ("pChallanNo" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmgoodsoutward_From__trgm" ON public."tblfrmgoodsoutward" USING gin ("From_" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmgoodsoutward_To__trgm" ON public."tblfrmgoodsoutward" USING gin ("To_" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmgoodsoutward_PoNo_trgm" ON public."tblfrmgoodsoutward" USING gin ("PoNo" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmgoodsoutward_WorkOrderNo_trgm" ON public."tblfrmgoodsoutward" USING gin ("WorkOrderNo" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmgoodsoutward_ChallanTag_trgm" ON public."tblfrmgoodsoutward" USING gin ("ChallanTag" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmgoodsoutward_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmgoodsoutward_DFE1"(
    p_frmgoodsoutward_id bigint, p_frmgoodsoutward_frm text, p_frmgoodsoutward_auth text, p_frmgoodsoutward_unused text)
RETURNS TABLE("id" bigint, "ChallanNo" text, "pChallanNo" text, "tDate" text, "From_" text, "To_" text, "ChallanTag" text, "PmntTerm" text, "DueDays" numeric, "GateEntryNo" text, "Remark" text, "Transport" text, "VehicleNo" text, "LrNo" text, "Courier" text, "CourierNo" text, "EwayBillNo" text, "DispatchMode" text, "Distance" numeric, "ShippedOn" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."ChallanNo",
           t."pChallanNo",
           to_char(t."tDate", 'YYYY-MM-DD') AS "tDate",
           t."From_",
           t."To_",
           t."ChallanTag",
           t."PmntTerm",
           t."DueDays",
           t."GateEntryNo",
           t."Remark",
           t."Transport",
           t."VehicleNo",
           t."LrNo",
           t."Courier",
           t."CourierNo",
           t."EwayBillNo",
           t."DispatchMode",
           t."Distance",
           to_char(t."ShippedOn", 'YYYY-MM-DD') AS "ShippedOn",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmgoodsoutward" t
    WHERE t."Id" = p_frmgoodsoutward_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmgoodsoutward_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmgoodsoutward_SAVE"(
    
    p_challanno text,
    p_pchallanno text,
    p_tdate text,
    p_from text,
    p_to text,
    p_challantag text,
    p_pmntterm text,
    p_duedays text,
    p_gateentryno text,
    p_remark text,
    p_transport text,
    p_vehicleno text,
    p_lrno text,
    p_courier text,
    p_courierno text,
    p_ewaybillno text,
    p_dispatchmode text,
    p_distance text,
    p_shippedon text,
    p_frmgoodsoutward_frm text, p_frmgoodsoutward_fcode text, p_frmgoodsoutward_auth text, p_frmgoodsoutward_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmgoodsoutward_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmgoodsoutward_auth);
    INSERT INTO public."tblfrmgoodsoutward" ("ChallanNo", "pChallanNo", "tDate", "From_", "To_", "ChallanTag", "PmntTerm", "DueDays", "GateEntryNo", "Remark", "Transport", "VehicleNo", "LrNo", "Courier", "CourierNo", "EwayBillNo", "DispatchMode", "Distance", "ShippedOn", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_challanno, ''), ''),
            COALESCE(NULLIF(p_pchallanno, ''), ''),
            CASE WHEN trim(p_tdate) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN p_tdate::date ELSE NULL END,
            COALESCE(NULLIF(p_from, ''), ''),
            COALESCE(NULLIF(p_to, ''), ''),
            COALESCE(NULLIF(p_challantag, ''), ''),
            COALESCE(NULLIF(p_pmntterm, ''), ''),
            CASE WHEN trim(p_duedays) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_duedays::numeric ELSE 0 END,
            COALESCE(NULLIF(p_gateentryno, ''), ''),
            COALESCE(NULLIF(p_remark, ''), ''),
            COALESCE(NULLIF(p_transport, ''), ''),
            COALESCE(NULLIF(p_vehicleno, ''), ''),
            COALESCE(NULLIF(p_lrno, ''), ''),
            COALESCE(NULLIF(p_courier, ''), ''),
            COALESCE(NULLIF(p_courierno, ''), ''),
            COALESCE(NULLIF(p_ewaybillno, ''), ''),
            COALESCE(NULLIF(p_dispatchmode, ''), ''),
            CASE WHEN trim(p_distance) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_distance::numeric ELSE 0 END,
            CASE WHEN trim(p_shippedon) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN p_shippedon::date ELSE NULL END,
            v_uid,
            COALESCE(NULLIF(p_frmgoodsoutward_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmgoodsoutward_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmgoodsoutward_UPDATE"(
    p_frmgoodsoutward_id bigint,
    p_challanno text,
    p_pchallanno text,
    p_tdate text,
    p_from text,
    p_to text,
    p_challantag text,
    p_pmntterm text,
    p_duedays text,
    p_gateentryno text,
    p_remark text,
    p_transport text,
    p_vehicleno text,
    p_lrno text,
    p_courier text,
    p_courierno text,
    p_ewaybillno text,
    p_dispatchmode text,
    p_distance text,
    p_shippedon text,
    p_frmgoodsoutward_frm text, p_frmgoodsoutward_fcode text, p_frmgoodsoutward_auth text, p_frmgoodsoutward_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmgoodsoutward"
    SET "ChallanNo" = COALESCE(NULLIF(p_challanno, ''), ''),
            "pChallanNo" = COALESCE(NULLIF(p_pchallanno, ''), ''),
            "tDate" = CASE WHEN trim(p_tdate) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN p_tdate::date ELSE NULL END,
            "From_" = COALESCE(NULLIF(p_from, ''), ''),
            "To_" = COALESCE(NULLIF(p_to, ''), ''),
            "ChallanTag" = COALESCE(NULLIF(p_challantag, ''), ''),
            "PmntTerm" = COALESCE(NULLIF(p_pmntterm, ''), ''),
            "DueDays" = CASE WHEN trim(p_duedays) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_duedays::numeric ELSE 0 END,
            "GateEntryNo" = COALESCE(NULLIF(p_gateentryno, ''), ''),
            "Remark" = COALESCE(NULLIF(p_remark, ''), ''),
            "Transport" = COALESCE(NULLIF(p_transport, ''), ''),
            "VehicleNo" = COALESCE(NULLIF(p_vehicleno, ''), ''),
            "LrNo" = COALESCE(NULLIF(p_lrno, ''), ''),
            "Courier" = COALESCE(NULLIF(p_courier, ''), ''),
            "CourierNo" = COALESCE(NULLIF(p_courierno, ''), ''),
            "EwayBillNo" = COALESCE(NULLIF(p_ewaybillno, ''), ''),
            "DispatchMode" = COALESCE(NULLIF(p_dispatchmode, ''), ''),
            "Distance" = CASE WHEN trim(p_distance) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_distance::numeric ELSE 0 END,
            "ShippedOn" = CASE WHEN trim(p_shippedon) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN p_shippedon::date ELSE NULL END,
            "FCODE" = COALESCE(NULLIF(p_frmgoodsoutward_fcode, ''), "FCODE")
    WHERE "Id" = p_frmgoodsoutward_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmgoodsoutward_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmgoodsoutward_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmgoodsoutward_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmgoodsoutward_Delete1"(
    p_frmgoodsoutward_id bigint, p_frmgoodsoutward_frm text, p_frmgoodsoutward_auth text, p_frmgoodsoutward_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    DELETE FROM public."tblGoodsOutwardDet" WHERE "GoodsOutward_ID" = p_frmgoodsoutward_id;
    DELETE FROM public."tblfrmgoodsoutward" WHERE "Id" = p_frmgoodsoutward_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmgoodsoutward_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmgoodsoutward_LockUnlock1"(
    p_frmgoodsoutward_id bigint, p_frmgoodsoutward_frm text, p_frmgoodsoutward_auth text, p_frmgoodsoutward_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmgoodsoutward_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmgoodsoutward" WHERE "Id" = p_frmgoodsoutward_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmgoodsoutward"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmgoodsoutward_auth)
    WHERE "Id" = p_frmgoodsoutward_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmgoodsoutward_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmgoodsoutward_AddBlank"(
    p_frmgoodsoutward_frm text, p_frmgoodsoutward_auth text, p_frmgoodsoutward_unused text)
RETURNS TABLE("id" bigint, "ChallanNo" text, "pChallanNo" text, "tDate" date, "From_" text, "To_" text, "ChallanTag" text, "PmntTerm" text, "DueDays" numeric, "GateEntryNo" text, "Remark" text, "Transport" text, "VehicleNo" text, "LrNo" text, "Courier" text, "CourierNo" text, "EwayBillNo" text, "DispatchMode" text, "Distance" numeric, "ShippedOn" date, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "ChallanNo",
           NULL::text AS "pChallanNo",
           NULL::date AS "tDate",
           NULL::text AS "From_",
           NULL::text AS "To_",
           NULL::text AS "ChallanTag",
           NULL::text AS "PmntTerm",
           NULL::numeric AS "DueDays",
           NULL::text AS "GateEntryNo",
           NULL::text AS "Remark",
           NULL::text AS "Transport",
           NULL::text AS "VehicleNo",
           NULL::text AS "LrNo",
           NULL::text AS "Courier",
           NULL::text AS "CourierNo",
           NULL::text AS "EwayBillNo",
           NULL::text AS "DispatchMode",
           NULL::numeric AS "Distance",
           NULL::date AS "ShippedOn",
           false AS "LOCK";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmgoodsoutward_GridCount1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmgoodsoutward_GridCount1"(
    
    p_sdate text,
    p_edate text,
    p_challanno text,
    p_pchallanno text,
    p_from text,
    p_to text,
    p_pono text,
    p_workorderno text,
    p_challantag text,
    p_frmgoodsoutward_frm text, p_frmgoodsoutward_fcode text, p_frmgoodsoutward_auth text)
RETURNS TABLE("TotalPages" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT count(*)::bigint FROM public."tblfrmgoodsoutward" t
    WHERE (COALESCE(p_sdate, '') = '' OR t."sDate"::text ILIKE '%' || p_sdate || '%')
          AND (COALESCE(p_edate, '') = '' OR t."eDate"::text ILIKE '%' || p_edate || '%')
          AND (COALESCE(p_challanno, '') = '' OR t."ChallanNo"::text ILIKE '%' || p_challanno || '%')
          AND (COALESCE(p_pchallanno, '') = '' OR t."pChallanNo"::text ILIKE '%' || p_pchallanno || '%')
          AND (COALESCE(p_from, '') = '' OR t."From_"::text ILIKE '%' || p_from || '%')
          AND (COALESCE(p_to, '') = '' OR t."To_"::text ILIKE '%' || p_to || '%')
          AND (COALESCE(p_pono, '') = '' OR t."PoNo"::text ILIKE '%' || p_pono || '%')
          AND (COALESCE(p_workorderno, '') = '' OR t."WorkOrderNo"::text ILIKE '%' || p_workorderno || '%')
          AND (COALESCE(p_challantag, '') = '' OR t."ChallanTag"::text ILIKE '%' || p_challantag || '%');
END
$fn$;

-- detail table: tblGoodsOutwardDet (FK GoodsOutward_ID -> tblfrmgoodsoutward.Id)

CREATE TABLE IF NOT EXISTS public."tblGoodsOutwardDet" (
    "Id" bigserial PRIMARY KEY,
    "GoodsOutward_ID" numeric,
    "ItemStage" text,
    "ItemNo" text,
    "Qty" numeric,
    "Rate" numeric,
    "TaxableAmt" numeric,
    "WorkOrderNo" text,
    "PoNo" text,
    "NetWt" numeric,
    "HSN" text,
    "FCODE" text, "User_Id" text, "Created_At" timestamptz DEFAULT now());

ALTER TABLE public."tblGoodsOutwardDet" ADD COLUMN IF NOT EXISTS "GoodsOutward_ID" numeric;

ALTER TABLE public."tblGoodsOutwardDet" ADD COLUMN IF NOT EXISTS "ItemStage" text;

ALTER TABLE public."tblGoodsOutwardDet" ADD COLUMN IF NOT EXISTS "ItemNo" text;

ALTER TABLE public."tblGoodsOutwardDet" ADD COLUMN IF NOT EXISTS "Qty" numeric;

ALTER TABLE public."tblGoodsOutwardDet" ADD COLUMN IF NOT EXISTS "Rate" numeric;

ALTER TABLE public."tblGoodsOutwardDet" ADD COLUMN IF NOT EXISTS "TaxableAmt" numeric;

ALTER TABLE public."tblGoodsOutwardDet" ADD COLUMN IF NOT EXISTS "WorkOrderNo" text;

ALTER TABLE public."tblGoodsOutwardDet" ADD COLUMN IF NOT EXISTS "PoNo" text;

ALTER TABLE public."tblGoodsOutwardDet" ADD COLUMN IF NOT EXISTS "NetWt" numeric;

ALTER TABLE public."tblGoodsOutwardDet" ADD COLUMN IF NOT EXISTS "HSN" text;

CREATE INDEX IF NOT EXISTS "idx_tblGoodsOutwardDet_GoodsOutward_ID" ON public."tblGoodsOutwardDet" ("GoodsOutward_ID");

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmgoodsoutward_DFE2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmgoodsoutward_DFE2"(
    p_frmgoodsoutward_id bigint, p_frmgoodsoutward_frm text, p_frmgoodsoutward_auth text, p_frmgoodsoutward_unused text)
RETURNS TABLE("id" bigint, "ItemStage" text, "ItemNo" text, "Qty" numeric, "Rate" numeric, "TaxableAmt" numeric, "WorkOrderNo" text, "PoNo" text, "NetWt" numeric, "HSN" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT d."Id",
           d."ItemStage" AS "ItemStage",
           d."ItemNo" AS "ItemNo",
           d."Qty" AS "Qty",
           d."Rate" AS "Rate",
           d."TaxableAmt" AS "TaxableAmt",
           d."WorkOrderNo" AS "WorkOrderNo",
           d."PoNo" AS "PoNo",
           d."NetWt" AS "NetWt",
           d."HSN" AS "HSN"
    FROM public."tblGoodsOutwardDet" d
    WHERE d."GoodsOutward_ID" = p_frmgoodsoutward_id
    ORDER BY d."Id";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmgoodsoutward_PRINT_ROW1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmgoodsoutward_PRINT_ROW1"(
    p_frmgoodsoutward_id bigint, p_frmgoodsoutward_frm text, p_frmgoodsoutward_auth text, p_frmgoodsoutward_unused text)
RETURNS TABLE("id" bigint, "ChallanNo" text, "pChallanNo" text, "tDate" text, "From_" text, "To_" text, "ChallanTag" text, "PmntTerm" text, "DueDays" numeric, "GateEntryNo" text, "Remark" text, "Transport" text, "VehicleNo" text, "LrNo" text, "Courier" text, "CourierNo" text, "EwayBillNo" text, "DispatchMode" text, "Distance" numeric, "ShippedOn" text, "det1" jsonb)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id",
           t."ChallanNo",
           t."pChallanNo",
           to_char(t."tDate", 'YYYY-MM-DD'),
           t."From_",
           t."To_",
           t."ChallanTag",
           t."PmntTerm",
           t."DueDays",
           t."GateEntryNo",
           t."Remark",
           t."Transport",
           t."VehicleNo",
           t."LrNo",
           t."Courier",
           t."CourierNo",
           t."EwayBillNo",
           t."DispatchMode",
           t."Distance",
           to_char(t."ShippedOn", 'YYYY-MM-DD'),
           (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d."Id"), '[]'::jsonb)
         FROM public."tblGoodsOutwardDet" d WHERE d."GoodsOutward_ID" = t."Id") AS "det1"
    FROM public."tblfrmgoodsoutward" t
    WHERE t."Id" = p_frmgoodsoutward_id;
END
$fn$;


-- ============================================================

-- frmhsn  (ported from old xErp sp_* contract)

-- table: tblfrmhsn

-- ============================================================

ALTER TABLE public."tblfrmhsn" ADD COLUMN IF NOT EXISTS "GSTper" numeric;

ALTER TABLE public."tblfrmhsn" ADD COLUMN IF NOT EXISTS "MinAmt" numeric;

ALTER TABLE public."tblfrmhsn" ADD COLUMN IF NOT EXISTS "MaxAmt" numeric;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_Grid2"(
    p_frmhsn_rows integer, p_frmhsn_no integer,
    p_hsn text,
    p_hsndescription text,
    p_frmhsn_frm text, p_frmhsn_fcode text, p_frmhsn_auth text, p_frmhsn_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "Hsn" text, "HsnDescription" text, "GSTper" numeric, "MinAmt" numeric, "MaxAmt" numeric, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmhsn" a
        WHERE ((COALESCE(p_hsn, '') = '' OR a."Hsn"::text ILIKE '%' || p_hsn || '%')
          AND (COALESCE(p_hsndescription, '') = '' OR a."HsnDescription"::text ILIKE '%' || p_hsndescription || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmhsn" t2 WHERE (COALESCE(p_hsn, '') = '' OR t2."Hsn"::text ILIKE '%' || p_hsn || '%')
          AND (COALESCE(p_hsndescription, '') = '' OR t2."HsnDescription"::text ILIKE '%' || p_hsndescription || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmhsn_no - 1) * p_frmhsn_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."Hsn",
               t."HsnDescription",
               t."GSTper",
               t."MinAmt",
               t."MaxAmt",
               t."FCODE",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmhsn" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_hsn, '') = '' OR t."Hsn"::text ILIKE '%' || p_hsn || '%')
          AND (COALESCE(p_hsndescription, '') = '' OR t."HsnDescription"::text ILIKE '%' || p_hsndescription || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmhsn_rows
    )
    SELECT p."id", p."Hsn", p."HsnDescription", p."GSTper", p."MinAmt", p."MaxAmt", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmhsn_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_hsn, '') = ''
                     AND COALESCE(p_hsndescription, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmhsn"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmhsn" t WHERE (COALESCE(p_hsn, '') = '' OR t."Hsn"::text ILIKE '%' || p_hsn || '%')
          AND (COALESCE(p_hsndescription, '') = '' OR t."HsnDescription"::text ILIKE '%' || p_hsndescription || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblfrmhsn_Hsn_trgm" ON public."tblfrmhsn" USING gin ("Hsn" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmhsn_HsnDescription_trgm" ON public."tblfrmhsn" USING gin ("HsnDescription" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_DFE1"(
    p_frmhsn_id bigint, p_frmhsn_frm text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("id" bigint, "Hsn" text, "HsnDescription" text, "GSTper" numeric, "MinAmt" numeric, "MaxAmt" numeric, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."Hsn",
           t."HsnDescription",
           t."GSTper",
           t."MinAmt",
           t."MaxAmt",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmhsn" t
    WHERE t."Id" = p_frmhsn_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_SAVE"(
    
    p_hsn text,
    p_hsndescription text,
    p_gstper text,
    p_minamt text,
    p_maxamt text,
    p_frmhsn_frm text, p_frmhsn_fcode text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmhsn_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmhsn_auth);
    INSERT INTO public."tblfrmhsn" ("Hsn", "HsnDescription", "GSTper", "MinAmt", "MaxAmt", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_hsn, ''), ''),
            COALESCE(NULLIF(p_hsndescription, ''), ''),
            CASE WHEN trim(p_gstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_gstper::numeric ELSE 0 END,
            CASE WHEN trim(p_minamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_minamt::numeric ELSE 0 END,
            CASE WHEN trim(p_maxamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_maxamt::numeric ELSE 0 END,
            v_uid,
            COALESCE(NULLIF(p_frmhsn_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_UPDATE"(
    p_frmhsn_id bigint,
    p_hsn text,
    p_hsndescription text,
    p_gstper text,
    p_minamt text,
    p_maxamt text,
    p_frmhsn_frm text, p_frmhsn_fcode text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmhsn"
    SET "Hsn" = COALESCE(NULLIF(p_hsn, ''), ''),
            "HsnDescription" = COALESCE(NULLIF(p_hsndescription, ''), ''),
            "GSTper" = CASE WHEN trim(p_gstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_gstper::numeric ELSE 0 END,
            "MinAmt" = CASE WHEN trim(p_minamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_minamt::numeric ELSE 0 END,
            "MaxAmt" = CASE WHEN trim(p_maxamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_maxamt::numeric ELSE 0 END,
            "FCODE" = COALESCE(NULLIF(p_frmhsn_fcode, ''), "FCODE")
    WHERE "Id" = p_frmhsn_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmhsn_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmhsn_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_Delete1"(
    p_frmhsn_id bigint, p_frmhsn_frm text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    
    DELETE FROM public."tblfrmhsn" WHERE "Id" = p_frmhsn_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_LockUnlock1"(
    p_frmhsn_id bigint, p_frmhsn_frm text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmhsn_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmhsn" WHERE "Id" = p_frmhsn_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmhsn"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmhsn_auth)
    WHERE "Id" = p_frmhsn_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmhsn_AddBlank"(
    p_frmhsn_frm text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("id" bigint, "Hsn" text, "HsnDescription" text, "GSTper" numeric, "MinAmt" numeric, "MaxAmt" numeric, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "Hsn",
           NULL::text AS "HsnDescription",
           NULL::numeric AS "GSTper",
           NULL::numeric AS "MinAmt",
           NULL::numeric AS "MaxAmt",
           false AS "LOCK";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_GridCount1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_GridCount1"(
    
    p_hsn text,
    p_hsndescription text,
    p_frmhsn_frm text, p_frmhsn_fcode text, p_frmhsn_auth text)
RETURNS TABLE("TotalPages" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT count(*)::bigint FROM public."tblfrmhsn" t
    WHERE (COALESCE(p_hsn, '') = '' OR t."Hsn"::text ILIKE '%' || p_hsn || '%')
          AND (COALESCE(p_hsndescription, '') = '' OR t."HsnDescription"::text ILIKE '%' || p_hsndescription || '%');
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_PRINT_ROW1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_PRINT_ROW1"(
    p_frmhsn_id bigint, p_frmhsn_frm text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("id" bigint, "Hsn" text, "HsnDescription" text, "GSTper" numeric, "MinAmt" numeric, "MaxAmt" numeric, "det1" jsonb)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id",
           t."Hsn",
           t."HsnDescription",
           t."GSTper",
           t."MinAmt",
           t."MaxAmt",
           '[]'::jsonb AS "det1"
    FROM public."tblfrmhsn" t
    WHERE t."Id" = p_frmhsn_id;
END
$fn$;


-- ============================================================

-- frmItem  (ported from old xErp sp_* contract)

-- table: tblfrmItem

-- ============================================================

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItem_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItem_Grid2"(
    p_frmitem_rows integer, p_frmitem_no integer,
    p_item text,
    p_frmitem_frm text, p_frmitem_fcode text, p_frmitem_auth text, p_frmitem_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "Item" text, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmItem" a
        WHERE ((COALESCE(p_item, '') = '' OR a."Item"::text ILIKE '%' || p_item || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmItem" t2 WHERE (COALESCE(p_item, '') = '' OR t2."Item"::text ILIKE '%' || p_item || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmitem_no - 1) * p_frmitem_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."Item",
               t."FCODE",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmItem" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_item, '') = '' OR t."Item"::text ILIKE '%' || p_item || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmitem_rows
    )
    SELECT p."id", p."Item", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmitem_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_item, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmItem"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmItem" t WHERE (COALESCE(p_item, '') = '' OR t."Item"::text ILIKE '%' || p_item || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblfrmItem_Item_trgm" ON public."tblfrmItem" USING gin ("Item" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItem_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItem_DFE1"(
    p_frmitem_id bigint, p_frmitem_frm text, p_frmitem_auth text, p_frmitem_unused text)
RETURNS TABLE("id" bigint, "Item" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."Item",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmItem" t
    WHERE t."Id" = p_frmitem_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItem_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItem_SAVE"(
    
    p_item text,
    p_frmitem_frm text, p_frmitem_fcode text, p_frmitem_auth text, p_frmitem_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmitem_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmitem_auth);
    INSERT INTO public."tblfrmItem" ("Item", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_item, ''), ''),
            v_uid,
            COALESCE(NULLIF(p_frmitem_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItem_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItem_UPDATE"(
    p_frmitem_id bigint,
    p_item text,
    p_frmitem_frm text, p_frmitem_fcode text, p_frmitem_auth text, p_frmitem_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmItem"
    SET "Item" = COALESCE(NULLIF(p_item, ''), ''),
            "FCODE" = COALESCE(NULLIF(p_frmitem_fcode, ''), "FCODE")
    WHERE "Id" = p_frmitem_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmitem_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmitem_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItem_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItem_Delete1"(
    p_frmitem_id bigint, p_frmitem_frm text, p_frmitem_auth text, p_frmitem_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    
    DELETE FROM public."tblfrmItem" WHERE "Id" = p_frmitem_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItem_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItem_LockUnlock1"(
    p_frmitem_id bigint, p_frmitem_frm text, p_frmitem_auth text, p_frmitem_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmitem_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmItem" WHERE "Id" = p_frmitem_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmItem"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmitem_auth)
    WHERE "Id" = p_frmitem_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItem_boot'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmItem_boot"(
    p_frmitem_frm text, p_frmitem_auth text, p_frmitem_unused text)
RETURNS TABLE("id" bigint, "Item" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "Item",
           false AS "LOCK";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItem_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmItem_AddBlank"(
    p_frmitem_frm text, p_frmitem_auth text, p_frmitem_unused text)
RETURNS TABLE("id" bigint, "Item" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "Item",
           false AS "LOCK";
END
$fn$;


-- ============================================================

-- frmItemCategory  (ported from old xErp sp_* contract)

-- table: tblfrmItemCategory

-- ============================================================

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemCategory_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemCategory_Grid2"(
    p_frmitemcategory_rows integer, p_frmitemcategory_no integer,
    p_category text,
    p_frmitemcategory_frm text, p_frmitemcategory_fcode text, p_frmitemcategory_auth text, p_frmitemcategory_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "Category" text, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmItemCategory" a
        WHERE ((COALESCE(p_category, '') = '' OR a."Category"::text ILIKE '%' || p_category || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmItemCategory" t2 WHERE (COALESCE(p_category, '') = '' OR t2."Category"::text ILIKE '%' || p_category || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmitemcategory_no - 1) * p_frmitemcategory_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."Category",
               t."FCODE",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmItemCategory" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_category, '') = '' OR t."Category"::text ILIKE '%' || p_category || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmitemcategory_rows
    )
    SELECT p."id", p."Category", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmitemcategory_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_category, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmItemCategory"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmItemCategory" t WHERE (COALESCE(p_category, '') = '' OR t."Category"::text ILIKE '%' || p_category || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblfrmItemCategory_Category_trgm" ON public."tblfrmItemCategory" USING gin ("Category" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemCategory_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemCategory_DFE1"(
    p_frmitemcategory_id bigint, p_frmitemcategory_frm text, p_frmitemcategory_auth text, p_frmitemcategory_unused text)
RETURNS TABLE("id" bigint, "Category" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."Category",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmItemCategory" t
    WHERE t."Id" = p_frmitemcategory_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemCategory_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemCategory_SAVE"(
    
    p_category text,
    p_frmitemcategory_frm text, p_frmitemcategory_fcode text, p_frmitemcategory_auth text, p_frmitemcategory_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmitemcategory_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmitemcategory_auth);
    INSERT INTO public."tblfrmItemCategory" ("Category", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_category, ''), ''),
            v_uid,
            COALESCE(NULLIF(p_frmitemcategory_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemCategory_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemCategory_UPDATE"(
    p_frmitemcategory_id bigint,
    p_category text,
    p_frmitemcategory_frm text, p_frmitemcategory_fcode text, p_frmitemcategory_auth text, p_frmitemcategory_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmItemCategory"
    SET "Category" = COALESCE(NULLIF(p_category, ''), ''),
            "FCODE" = COALESCE(NULLIF(p_frmitemcategory_fcode, ''), "FCODE")
    WHERE "Id" = p_frmitemcategory_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmitemcategory_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmitemcategory_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemCategory_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemCategory_Delete1"(
    p_frmitemcategory_id bigint, p_frmitemcategory_frm text, p_frmitemcategory_auth text, p_frmitemcategory_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    
    DELETE FROM public."tblfrmItemCategory" WHERE "Id" = p_frmitemcategory_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemCategory_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemCategory_LockUnlock1"(
    p_frmitemcategory_id bigint, p_frmitemcategory_frm text, p_frmitemcategory_auth text, p_frmitemcategory_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmitemcategory_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmItemCategory" WHERE "Id" = p_frmitemcategory_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmItemCategory"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmitemcategory_auth)
    WHERE "Id" = p_frmitemcategory_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemCategory_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmItemCategory_AddBlank"(
    p_frmitemcategory_frm text, p_frmitemcategory_auth text, p_frmitemcategory_unused text)
RETURNS TABLE("id" bigint, "Category" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "Category",
           false AS "LOCK";
END
$fn$;


-- ============================================================

-- frmitemno  (ported from old xErp sp_* contract)

-- table: tblfrmitemno

-- ============================================================

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "Style" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "Color" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "description" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "Unit" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "Category" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "MRP" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "Rate" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "GSM" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "HSN" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "GstPer" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "NetWt" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "GrWt" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "SqFt" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "SqMtr" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "RateSqFt" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "RateSqMtr" numeric;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_Grid2"(
    p_frmitemno_rows integer, p_frmitemno_no integer,
    p_itemno text,
    p_title text,
    p_size text,
    p_frmitemno_frm text, p_frmitemno_fcode text, p_frmitemno_auth text, p_frmitemno_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "ItemNo" text, "Style" text, "Size" text, "Color" text, "description" text, "Unit" text, "Category" text, "Title" text, "MRP" numeric, "Rate" numeric, "GSM" text, "HSN" text, "GstPer" numeric, "NetWt" numeric, "GrWt" numeric, "SqFt" numeric, "SqMtr" numeric, "RateSqFt" numeric, "RateSqMtr" numeric, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmitemno" a
        WHERE ((COALESCE(p_itemno, '') = '' OR a."ItemNo"::text ILIKE '%' || p_itemno || '%')
          AND (COALESCE(p_title, '') = '' OR a."Title"::text ILIKE '%' || p_title || '%')
          AND (COALESCE(p_size, '') = '' OR a."Size"::text ILIKE '%' || p_size || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmitemno" t2 WHERE (COALESCE(p_itemno, '') = '' OR t2."ItemNo"::text ILIKE '%' || p_itemno || '%')
          AND (COALESCE(p_title, '') = '' OR t2."Title"::text ILIKE '%' || p_title || '%')
          AND (COALESCE(p_size, '') = '' OR t2."Size"::text ILIKE '%' || p_size || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmitemno_no - 1) * p_frmitemno_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."ItemNo",
               t."Style",
               t."Size",
               t."Color",
               t."description",
               t."Unit",
               t."Category",
               t."Title",
               t."MRP",
               t."Rate",
               t."GSM",
               t."HSN",
               t."GstPer",
               t."NetWt",
               t."GrWt",
               t."SqFt",
               t."SqMtr",
               t."RateSqFt",
               t."RateSqMtr",
               t."FCODE",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmitemno" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_itemno, '') = '' OR t."ItemNo"::text ILIKE '%' || p_itemno || '%')
          AND (COALESCE(p_title, '') = '' OR t."Title"::text ILIKE '%' || p_title || '%')
          AND (COALESCE(p_size, '') = '' OR t."Size"::text ILIKE '%' || p_size || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmitemno_rows
    )
    SELECT p."id", p."ItemNo", p."Style", p."Size", p."Color", p."description", p."Unit", p."Category", p."Title", p."MRP", p."Rate", p."GSM", p."HSN", p."GstPer", p."NetWt", p."GrWt", p."SqFt", p."SqMtr", p."RateSqFt", p."RateSqMtr", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmitemno_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_itemno, '') = ''
                     AND COALESCE(p_title, '') = ''
                     AND COALESCE(p_size, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmitemno"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmitemno" t WHERE (COALESCE(p_itemno, '') = '' OR t."ItemNo"::text ILIKE '%' || p_itemno || '%')
          AND (COALESCE(p_title, '') = '' OR t."Title"::text ILIKE '%' || p_title || '%')
          AND (COALESCE(p_size, '') = '' OR t."Size"::text ILIKE '%' || p_size || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblfrmitemno_ItemNo_trgm" ON public."tblfrmitemno" USING gin ("ItemNo" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmitemno_Title_trgm" ON public."tblfrmitemno" USING gin ("Title" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmitemno_Size_trgm" ON public."tblfrmitemno" USING gin ("Size" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_DFE1"(
    p_frmitemno_id bigint, p_frmitemno_frm text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("id" bigint, "ItemNo" text, "Style" text, "Size" text, "Color" text, "description" text, "Unit" text, "Category" text, "Title" text, "MRP" numeric, "Rate" numeric, "GSM" text, "HSN" text, "GstPer" numeric, "NetWt" numeric, "GrWt" numeric, "SqFt" numeric, "SqMtr" numeric, "RateSqFt" numeric, "RateSqMtr" numeric, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."ItemNo",
           t."Style",
           t."Size",
           t."Color",
           t."description",
           t."Unit",
           t."Category",
           t."Title",
           t."MRP",
           t."Rate",
           t."GSM",
           t."HSN",
           t."GstPer",
           t."NetWt",
           t."GrWt",
           t."SqFt",
           t."SqMtr",
           t."RateSqFt",
           t."RateSqMtr",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmitemno" t
    WHERE t."Id" = p_frmitemno_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_SAVE"(
    
    p_itemno text,
    p_style text,
    p_size text,
    p_color text,
    p_description text,
    p_unit text,
    p_category text,
    p_title text,
    p_mrp text,
    p_rate text,
    p_gsm text,
    p_hsn text,
    p_gstper text,
    p_netwt text,
    p_grwt text,
    p_sqft text,
    p_sqmtr text,
    p_ratesqft text,
    p_ratesqmtr text,
    p_frmitemno_frm text, p_frmitemno_fcode text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmitemno_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmitemno_auth);
    INSERT INTO public."tblfrmitemno" ("ItemNo", "Style", "Size", "Color", "description", "Unit", "Category", "Title", "MRP", "Rate", "GSM", "HSN", "GstPer", "NetWt", "GrWt", "SqFt", "SqMtr", "RateSqFt", "RateSqMtr", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_itemno, ''), ''),
            COALESCE(NULLIF(p_style, ''), ''),
            COALESCE(NULLIF(p_size, ''), ''),
            COALESCE(NULLIF(p_color, ''), ''),
            COALESCE(NULLIF(p_description, ''), ''),
            COALESCE(NULLIF(p_unit, ''), ''),
            COALESCE(NULLIF(p_category, ''), ''),
            COALESCE(NULLIF(p_title, ''), ''),
            CASE WHEN trim(p_mrp) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_mrp::numeric ELSE 0 END,
            CASE WHEN trim(p_rate) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_rate::numeric ELSE 0 END,
            COALESCE(NULLIF(p_gsm, ''), ''),
            COALESCE(NULLIF(p_hsn, ''), ''),
            CASE WHEN trim(p_gstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_gstper::numeric ELSE 0 END,
            CASE WHEN trim(p_netwt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_netwt::numeric ELSE 0 END,
            CASE WHEN trim(p_grwt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_grwt::numeric ELSE 0 END,
            CASE WHEN trim(p_sqft) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_sqft::numeric ELSE 0 END,
            CASE WHEN trim(p_sqmtr) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_sqmtr::numeric ELSE 0 END,
            CASE WHEN trim(p_ratesqft) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_ratesqft::numeric ELSE 0 END,
            CASE WHEN trim(p_ratesqmtr) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_ratesqmtr::numeric ELSE 0 END,
            v_uid,
            COALESCE(NULLIF(p_frmitemno_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_UPDATE"(
    p_frmitemno_id bigint,
    p_itemno text,
    p_style text,
    p_size text,
    p_color text,
    p_description text,
    p_unit text,
    p_category text,
    p_title text,
    p_mrp text,
    p_rate text,
    p_gsm text,
    p_hsn text,
    p_gstper text,
    p_netwt text,
    p_grwt text,
    p_sqft text,
    p_sqmtr text,
    p_ratesqft text,
    p_ratesqmtr text,
    p_frmitemno_frm text, p_frmitemno_fcode text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmitemno"
    SET "ItemNo" = COALESCE(NULLIF(p_itemno, ''), ''),
            "Style" = COALESCE(NULLIF(p_style, ''), ''),
            "Size" = COALESCE(NULLIF(p_size, ''), ''),
            "Color" = COALESCE(NULLIF(p_color, ''), ''),
            "description" = COALESCE(NULLIF(p_description, ''), ''),
            "Unit" = COALESCE(NULLIF(p_unit, ''), ''),
            "Category" = COALESCE(NULLIF(p_category, ''), ''),
            "Title" = COALESCE(NULLIF(p_title, ''), ''),
            "MRP" = CASE WHEN trim(p_mrp) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_mrp::numeric ELSE 0 END,
            "Rate" = CASE WHEN trim(p_rate) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_rate::numeric ELSE 0 END,
            "GSM" = COALESCE(NULLIF(p_gsm, ''), ''),
            "HSN" = COALESCE(NULLIF(p_hsn, ''), ''),
            "GstPer" = CASE WHEN trim(p_gstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_gstper::numeric ELSE 0 END,
            "NetWt" = CASE WHEN trim(p_netwt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_netwt::numeric ELSE 0 END,
            "GrWt" = CASE WHEN trim(p_grwt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_grwt::numeric ELSE 0 END,
            "SqFt" = CASE WHEN trim(p_sqft) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_sqft::numeric ELSE 0 END,
            "SqMtr" = CASE WHEN trim(p_sqmtr) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_sqmtr::numeric ELSE 0 END,
            "RateSqFt" = CASE WHEN trim(p_ratesqft) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_ratesqft::numeric ELSE 0 END,
            "RateSqMtr" = CASE WHEN trim(p_ratesqmtr) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_ratesqmtr::numeric ELSE 0 END,
            "FCODE" = COALESCE(NULLIF(p_frmitemno_fcode, ''), "FCODE")
    WHERE "Id" = p_frmitemno_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmitemno_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmitemno_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_Delete1"(
    p_frmitemno_id bigint, p_frmitemno_frm text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    
    DELETE FROM public."tblfrmitemno" WHERE "Id" = p_frmitemno_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_LockUnlock1"(
    p_frmitemno_id bigint, p_frmitemno_frm text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmitemno_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmitemno" WHERE "Id" = p_frmitemno_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmitemno"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmitemno_auth)
    WHERE "Id" = p_frmitemno_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmitemno_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmitemno_AddBlank"(
    p_frmitemno_frm text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("id" bigint, "ItemNo" text, "Style" text, "Size" text, "Color" text, "description" text, "Unit" text, "Category" text, "Title" text, "MRP" numeric, "Rate" numeric, "GSM" text, "HSN" text, "GstPer" numeric, "NetWt" numeric, "GrWt" numeric, "SqFt" numeric, "SqMtr" numeric, "RateSqFt" numeric, "RateSqMtr" numeric, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "ItemNo",
           NULL::text AS "Style",
           NULL::text AS "Size",
           NULL::text AS "Color",
           NULL::text AS "description",
           NULL::text AS "Unit",
           NULL::text AS "Category",
           NULL::text AS "Title",
           NULL::numeric AS "MRP",
           NULL::numeric AS "Rate",
           NULL::text AS "GSM",
           NULL::text AS "HSN",
           NULL::numeric AS "GstPer",
           NULL::numeric AS "NetWt",
           NULL::numeric AS "GrWt",
           NULL::numeric AS "SqFt",
           NULL::numeric AS "SqMtr",
           NULL::numeric AS "RateSqFt",
           NULL::numeric AS "RateSqMtr",
           false AS "LOCK";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_PRINT_ROW1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_PRINT_ROW1"(
    p_frmitemno_id bigint, p_frmitemno_frm text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("id" bigint, "ItemNo" text, "Style" text, "Size" text, "Color" text, "description" text, "Unit" text, "Category" text, "Title" text, "MRP" numeric, "Rate" numeric, "GSM" text, "HSN" text, "GstPer" numeric, "NetWt" numeric, "GrWt" numeric, "SqFt" numeric, "SqMtr" numeric, "RateSqFt" numeric, "RateSqMtr" numeric, "det1" jsonb)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id",
           t."ItemNo",
           t."Style",
           t."Size",
           t."Color",
           t."description",
           t."Unit",
           t."Category",
           t."Title",
           t."MRP",
           t."Rate",
           t."GSM",
           t."HSN",
           t."GstPer",
           t."NetWt",
           t."GrWt",
           t."SqFt",
           t."SqMtr",
           t."RateSqFt",
           t."RateSqMtr",
           '[]'::jsonb AS "det1"
    FROM public."tblfrmitemno" t
    WHERE t."Id" = p_frmitemno_id;
END
$fn$;


-- ============================================================

-- frmItemNoDyn  (ported from old xErp sp_* contract)

-- table: tblfrmItemNoDyn

-- ============================================================

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "SubCategory" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "Quality" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "InspectionHead" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "Style" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "SizeType" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "W" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "L" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "H" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "SizeUnit" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "Unit" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "NetWt" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "GrWt" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "WtUnit" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "SqFt" numeric;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "SqMtr" numeric;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "CBM" numeric;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "Options" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "HSN" text;

ALTER TABLE public."tblfrmItemNoDyn" ADD COLUMN IF NOT EXISTS "PackingCategory" text;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNoDyn_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNoDyn_Grid2"(
    p_frmitemnodyn_rows integer, p_frmitemnodyn_no integer,
    p_item text,
    p_category text,
    p_itemno text,
    p_title text,
    p_olditemno text,
    p_color text,
    p_size text,
    p_frmitemnodyn_frm text, p_frmitemnodyn_fcode text, p_frmitemnodyn_auth text, p_frmitemnodyn_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "FCODE" text, "Item" text, "Category" text, "SubCategory" text, "Quality" text, "ItemNo" text, "OldItemNo" text, "InspectionHead" text, "Style" text, "SizeType" text, "W" text, "L" text, "H" text, "Size" text, "SizeUnit" text, "Color" text, "Unit" text, "NetWt" text, "GrWt" text, "WtUnit" text, "SqFt" numeric, "SqMtr" numeric, "CBM" numeric, "Title" text, "Options" text, "HSN" text, "PackingCategory" text, "btnBom" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmItemNoDyn" a
        WHERE ((COALESCE(p_item, '') = '' OR a."Item"::text ILIKE '%' || p_item || '%')
          AND (COALESCE(p_category, '') = '' OR a."Category"::text ILIKE '%' || p_category || '%')
          AND (COALESCE(p_itemno, '') = '' OR a."ItemNo"::text ILIKE '%' || p_itemno || '%')
          AND (COALESCE(p_title, '') = '' OR a."Title"::text ILIKE '%' || p_title || '%')
          AND (COALESCE(p_olditemno, '') = '' OR a."OldItemNo"::text ILIKE '%' || p_olditemno || '%')
          AND (COALESCE(p_color, '') = '' OR a."Color"::text ILIKE '%' || p_color || '%')
          AND (COALESCE(p_size, '') = '' OR a."Size"::text ILIKE '%' || p_size || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmItemNoDyn" t2 WHERE (COALESCE(p_item, '') = '' OR t2."Item"::text ILIKE '%' || p_item || '%')
          AND (COALESCE(p_category, '') = '' OR t2."Category"::text ILIKE '%' || p_category || '%')
          AND (COALESCE(p_itemno, '') = '' OR t2."ItemNo"::text ILIKE '%' || p_itemno || '%')
          AND (COALESCE(p_title, '') = '' OR t2."Title"::text ILIKE '%' || p_title || '%')
          AND (COALESCE(p_olditemno, '') = '' OR t2."OldItemNo"::text ILIKE '%' || p_olditemno || '%')
          AND (COALESCE(p_color, '') = '' OR t2."Color"::text ILIKE '%' || p_color || '%')
          AND (COALESCE(p_size, '') = '' OR t2."Size"::text ILIKE '%' || p_size || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmitemnodyn_no - 1) * p_frmitemnodyn_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."FCODE",
               t."Item",
               t."Category",
               t."SubCategory",
               t."Quality",
               t."ItemNo",
               t."OldItemNo",
               t."InspectionHead",
               t."Style",
               t."SizeType",
               t."W",
               t."L",
               t."H",
               t."Size",
               t."SizeUnit",
               t."Color",
               t."Unit",
               t."NetWt",
               t."GrWt",
               t."WtUnit",
               t."SqFt",
               t."SqMtr",
               t."CBM",
               t."Title",
               t."Options",
               t."HSN",
               t."PackingCategory",
               NULL::text AS "btnBom",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmItemNoDyn" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_item, '') = '' OR t."Item"::text ILIKE '%' || p_item || '%')
          AND (COALESCE(p_category, '') = '' OR t."Category"::text ILIKE '%' || p_category || '%')
          AND (COALESCE(p_itemno, '') = '' OR t."ItemNo"::text ILIKE '%' || p_itemno || '%')
          AND (COALESCE(p_title, '') = '' OR t."Title"::text ILIKE '%' || p_title || '%')
          AND (COALESCE(p_olditemno, '') = '' OR t."OldItemNo"::text ILIKE '%' || p_olditemno || '%')
          AND (COALESCE(p_color, '') = '' OR t."Color"::text ILIKE '%' || p_color || '%')
          AND (COALESCE(p_size, '') = '' OR t."Size"::text ILIKE '%' || p_size || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmitemnodyn_rows
    )
    SELECT p."id", p."FCODE", p."Item", p."Category", p."SubCategory", p."Quality", p."ItemNo", p."OldItemNo", p."InspectionHead", p."Style", p."SizeType", p."W", p."L", p."H", p."Size", p."SizeUnit", p."Color", p."Unit", p."NetWt", p."GrWt", p."WtUnit", p."SqFt", p."SqMtr", p."CBM", p."Title", p."Options", p."HSN", p."PackingCategory", p."btnBom", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmitemnodyn_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_item, '') = ''
                     AND COALESCE(p_category, '') = ''
                     AND COALESCE(p_itemno, '') = ''
                     AND COALESCE(p_title, '') = ''
                     AND COALESCE(p_olditemno, '') = ''
                     AND COALESCE(p_color, '') = ''
                     AND COALESCE(p_size, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmItemNoDyn"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmItemNoDyn" t WHERE (COALESCE(p_item, '') = '' OR t."Item"::text ILIKE '%' || p_item || '%')
          AND (COALESCE(p_category, '') = '' OR t."Category"::text ILIKE '%' || p_category || '%')
          AND (COALESCE(p_itemno, '') = '' OR t."ItemNo"::text ILIKE '%' || p_itemno || '%')
          AND (COALESCE(p_title, '') = '' OR t."Title"::text ILIKE '%' || p_title || '%')
          AND (COALESCE(p_olditemno, '') = '' OR t."OldItemNo"::text ILIKE '%' || p_olditemno || '%')
          AND (COALESCE(p_color, '') = '' OR t."Color"::text ILIKE '%' || p_color || '%')
          AND (COALESCE(p_size, '') = '' OR t."Size"::text ILIKE '%' || p_size || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblfrmItemNoDyn_Item_trgm" ON public."tblfrmItemNoDyn" USING gin ("Item" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmItemNoDyn_Category_trgm" ON public."tblfrmItemNoDyn" USING gin ("Category" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmItemNoDyn_ItemNo_trgm" ON public."tblfrmItemNoDyn" USING gin ("ItemNo" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmItemNoDyn_Title_trgm" ON public."tblfrmItemNoDyn" USING gin ("Title" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmItemNoDyn_OldItemNo_trgm" ON public."tblfrmItemNoDyn" USING gin ("OldItemNo" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmItemNoDyn_Color_trgm" ON public."tblfrmItemNoDyn" USING gin ("Color" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmItemNoDyn_Size_trgm" ON public."tblfrmItemNoDyn" USING gin ("Size" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNoDyn_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNoDyn_DFE1"(
    p_frmitemnodyn_id bigint, p_frmitemnodyn_frm text, p_frmitemnodyn_auth text, p_frmitemnodyn_unused text)
RETURNS TABLE("id" bigint, "FCODE" text, "Item" text, "Category" text, "SubCategory" text, "Quality" text, "ItemNo" text, "OldItemNo" text, "InspectionHead" text, "Style" text, "SizeType" text, "W" text, "L" text, "H" text, "Size" text, "SizeUnit" text, "Color" text, "Unit" text, "NetWt" text, "GrWt" text, "WtUnit" text, "SqFt" numeric, "SqMtr" numeric, "CBM" numeric, "Title" text, "Options" text, "HSN" text, "PackingCategory" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."FCODE",
           t."Item",
           t."Category",
           t."SubCategory",
           t."Quality",
           t."ItemNo",
           t."OldItemNo",
           t."InspectionHead",
           t."Style",
           t."SizeType",
           t."W",
           t."L",
           t."H",
           t."Size",
           t."SizeUnit",
           t."Color",
           t."Unit",
           t."NetWt",
           t."GrWt",
           t."WtUnit",
           t."SqFt",
           t."SqMtr",
           t."CBM",
           t."Title",
           t."Options",
           t."HSN",
           t."PackingCategory",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmItemNoDyn" t
    WHERE t."Id" = p_frmitemnodyn_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNoDyn_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNoDyn_SAVE"(
    
    p_fcode text,
    p_item text,
    p_category text,
    p_subcategory text,
    p_quality text,
    p_itemno text,
    p_olditemno text,
    p_inspectionhead text,
    p_style text,
    p_sizetype text,
    p_w text,
    p_l text,
    p_h text,
    p_size text,
    p_sizeunit text,
    p_color text,
    p_unit text,
    p_netwt text,
    p_grwt text,
    p_wtunit text,
    p_sqft text,
    p_sqmtr text,
    p_cbm text,
    p_title text,
    p_options text,
    p_hsn text,
    p_packingcategory text,
    p_frmitemnodyn_frm text, p_frmitemnodyn_fcode text, p_frmitemnodyn_auth text, p_frmitemnodyn_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmitemnodyn_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmitemnodyn_auth);
    INSERT INTO public."tblfrmItemNoDyn" ("FCODE", "Item", "Category", "SubCategory", "Quality", "ItemNo", "OldItemNo", "InspectionHead", "Style", "SizeType", "W", "L", "H", "Size", "SizeUnit", "Color", "Unit", "NetWt", "GrWt", "WtUnit", "SqFt", "SqMtr", "CBM", "Title", "Options", "HSN", "PackingCategory", "User_Id")
    VALUES (COALESCE(NULLIF(p_fcode, ''), ''),
            COALESCE(NULLIF(p_item, ''), ''),
            COALESCE(NULLIF(p_category, ''), ''),
            COALESCE(NULLIF(p_subcategory, ''), ''),
            COALESCE(NULLIF(p_quality, ''), ''),
            COALESCE(NULLIF(p_itemno, ''), ''),
            COALESCE(NULLIF(p_olditemno, ''), ''),
            COALESCE(NULLIF(p_inspectionhead, ''), ''),
            COALESCE(NULLIF(p_style, ''), ''),
            COALESCE(NULLIF(p_sizetype, ''), ''),
            COALESCE(NULLIF(p_w, ''), ''),
            COALESCE(NULLIF(p_l, ''), ''),
            COALESCE(NULLIF(p_h, ''), ''),
            COALESCE(NULLIF(p_size, ''), ''),
            COALESCE(NULLIF(p_sizeunit, ''), ''),
            COALESCE(NULLIF(p_color, ''), ''),
            COALESCE(NULLIF(p_unit, ''), ''),
            COALESCE(NULLIF(p_netwt, ''), ''),
            COALESCE(NULLIF(p_grwt, ''), ''),
            COALESCE(NULLIF(p_wtunit, ''), ''),
            CASE WHEN trim(p_sqft) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_sqft::numeric ELSE 0 END,
            CASE WHEN trim(p_sqmtr) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_sqmtr::numeric ELSE 0 END,
            CASE WHEN trim(p_cbm) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_cbm::numeric ELSE 0 END,
            COALESCE(NULLIF(p_title, ''), ''),
            COALESCE(NULLIF(p_options, ''), ''),
            COALESCE(NULLIF(p_hsn, ''), ''),
            COALESCE(NULLIF(p_packingcategory, ''), ''),
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNoDyn_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNoDyn_UPDATE"(
    p_frmitemnodyn_id bigint,
    p_fcode text,
    p_item text,
    p_category text,
    p_subcategory text,
    p_quality text,
    p_itemno text,
    p_olditemno text,
    p_inspectionhead text,
    p_style text,
    p_sizetype text,
    p_w text,
    p_l text,
    p_h text,
    p_size text,
    p_sizeunit text,
    p_color text,
    p_unit text,
    p_netwt text,
    p_grwt text,
    p_wtunit text,
    p_sqft text,
    p_sqmtr text,
    p_cbm text,
    p_title text,
    p_options text,
    p_hsn text,
    p_packingcategory text,
    p_frmitemnodyn_frm text, p_frmitemnodyn_fcode text, p_frmitemnodyn_auth text, p_frmitemnodyn_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmItemNoDyn"
    SET "FCODE" = COALESCE(NULLIF(p_fcode, ''), ''),
            "Item" = COALESCE(NULLIF(p_item, ''), ''),
            "Category" = COALESCE(NULLIF(p_category, ''), ''),
            "SubCategory" = COALESCE(NULLIF(p_subcategory, ''), ''),
            "Quality" = COALESCE(NULLIF(p_quality, ''), ''),
            "ItemNo" = COALESCE(NULLIF(p_itemno, ''), ''),
            "OldItemNo" = COALESCE(NULLIF(p_olditemno, ''), ''),
            "InspectionHead" = COALESCE(NULLIF(p_inspectionhead, ''), ''),
            "Style" = COALESCE(NULLIF(p_style, ''), ''),
            "SizeType" = COALESCE(NULLIF(p_sizetype, ''), ''),
            "W" = COALESCE(NULLIF(p_w, ''), ''),
            "L" = COALESCE(NULLIF(p_l, ''), ''),
            "H" = COALESCE(NULLIF(p_h, ''), ''),
            "Size" = COALESCE(NULLIF(p_size, ''), ''),
            "SizeUnit" = COALESCE(NULLIF(p_sizeunit, ''), ''),
            "Color" = COALESCE(NULLIF(p_color, ''), ''),
            "Unit" = COALESCE(NULLIF(p_unit, ''), ''),
            "NetWt" = COALESCE(NULLIF(p_netwt, ''), ''),
            "GrWt" = COALESCE(NULLIF(p_grwt, ''), ''),
            "WtUnit" = COALESCE(NULLIF(p_wtunit, ''), ''),
            "SqFt" = CASE WHEN trim(p_sqft) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_sqft::numeric ELSE 0 END,
            "SqMtr" = CASE WHEN trim(p_sqmtr) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_sqmtr::numeric ELSE 0 END,
            "CBM" = CASE WHEN trim(p_cbm) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_cbm::numeric ELSE 0 END,
            "Title" = COALESCE(NULLIF(p_title, ''), ''),
            "Options" = COALESCE(NULLIF(p_options, ''), ''),
            "HSN" = COALESCE(NULLIF(p_hsn, ''), ''),
            "PackingCategory" = COALESCE(NULLIF(p_packingcategory, ''), '')
    WHERE "Id" = p_frmitemnodyn_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmitemnodyn_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmitemnodyn_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNoDyn_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNoDyn_Delete1"(
    p_frmitemnodyn_id bigint, p_frmitemnodyn_frm text, p_frmitemnodyn_auth text, p_frmitemnodyn_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    
    DELETE FROM public."tblfrmItemNoDyn" WHERE "Id" = p_frmitemnodyn_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNoDyn_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNoDyn_LockUnlock1"(
    p_frmitemnodyn_id bigint, p_frmitemnodyn_frm text, p_frmitemnodyn_auth text, p_frmitemnodyn_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmitemnodyn_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmItemNoDyn" WHERE "Id" = p_frmitemnodyn_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmItemNoDyn"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmitemnodyn_auth)
    WHERE "Id" = p_frmitemnodyn_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNoDyn_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmItemNoDyn_AddBlank"(
    p_frmitemnodyn_frm text, p_frmitemnodyn_auth text, p_frmitemnodyn_unused text)
RETURNS TABLE("id" bigint, "FCODE" text, "Item" text, "Category" text, "SubCategory" text, "Quality" text, "ItemNo" text, "OldItemNo" text, "InspectionHead" text, "Style" text, "SizeType" text, "W" text, "L" text, "H" text, "Size" text, "SizeUnit" text, "Color" text, "Unit" text, "NetWt" text, "GrWt" text, "WtUnit" text, "SqFt" numeric, "SqMtr" numeric, "CBM" numeric, "Title" text, "Options" text, "HSN" text, "PackingCategory" text, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "FCODE",
           NULL::text AS "Item",
           NULL::text AS "Category",
           NULL::text AS "SubCategory",
           NULL::text AS "Quality",
           NULL::text AS "ItemNo",
           NULL::text AS "OldItemNo",
           NULL::text AS "InspectionHead",
           NULL::text AS "Style",
           NULL::text AS "SizeType",
           NULL::text AS "W",
           NULL::text AS "L",
           NULL::text AS "H",
           NULL::text AS "Size",
           NULL::text AS "SizeUnit",
           NULL::text AS "Color",
           NULL::text AS "Unit",
           NULL::text AS "NetWt",
           NULL::text AS "GrWt",
           NULL::text AS "WtUnit",
           NULL::numeric AS "SqFt",
           NULL::numeric AS "SqMtr",
           NULL::numeric AS "CBM",
           NULL::text AS "Title",
           NULL::text AS "Options",
           NULL::text AS "HSN",
           NULL::text AS "PackingCategory",
           false AS "LOCK";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNoDyn_PRINT_ROW1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNoDyn_PRINT_ROW1"(
    p_frmitemnodyn_id bigint, p_frmitemnodyn_frm text, p_frmitemnodyn_auth text, p_frmitemnodyn_unused text)
RETURNS TABLE("id" bigint, "FCODE" text, "Item" text, "Category" text, "SubCategory" text, "Quality" text, "ItemNo" text, "OldItemNo" text, "InspectionHead" text, "Style" text, "SizeType" text, "W" text, "L" text, "H" text, "Size" text, "SizeUnit" text, "Color" text, "Unit" text, "NetWt" text, "GrWt" text, "WtUnit" text, "SqFt" numeric, "SqMtr" numeric, "CBM" numeric, "Title" text, "Options" text, "HSN" text, "PackingCategory" text, "det1" jsonb)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id",
           t."FCODE",
           t."Item",
           t."Category",
           t."SubCategory",
           t."Quality",
           t."ItemNo",
           t."OldItemNo",
           t."InspectionHead",
           t."Style",
           t."SizeType",
           t."W",
           t."L",
           t."H",
           t."Size",
           t."SizeUnit",
           t."Color",
           t."Unit",
           t."NetWt",
           t."GrWt",
           t."WtUnit",
           t."SqFt",
           t."SqMtr",
           t."CBM",
           t."Title",
           t."Options",
           t."HSN",
           t."PackingCategory",
           '[]'::jsonb AS "det1"
    FROM public."tblfrmItemNoDyn" t
    WHERE t."Id" = p_frmitemnodyn_id;
END
$fn$;


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

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_GetCategoryOptions'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_GetCategoryOptions"(cat text, fid text, auth text)
RETURNS TABLE("id" bigint, "fldName" text, "fldType" text, "fldDefault" text,
              "IncludeInTitle" text, "TitlePrefix" text, "TitleSuffix" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT c."Id", c."fldName", c."fldType", c."fldDefault",
           c."IncludeInTitle", c."TitlePrefix", c."TitleSuffix"
    FROM public."tblCategoryOptions" c
    WHERE COALESCE(NULLIF(trim(cat), ''), c."Category") = c."Category"
    ORDER BY c."Id";
END
$fn$;
