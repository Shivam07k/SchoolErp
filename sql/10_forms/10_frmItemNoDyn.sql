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
