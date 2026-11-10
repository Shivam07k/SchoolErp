-- ============================================================
-- pg-xerp port: frmItem  (tblItem)  -- single-column form
-- Dialect = live-proven sp_frmCategoryOptions_* port (grid2 fast
--   count-over + boot/dfe1/save/update/delete/lockunlock contract)
-- Proc names MUST be sp_frmItem_* so crud.js resolves them.
-- ============================================================

CREATE TABLE IF NOT EXISTS public."tblItem" (
    "Id"      bigserial PRIMARY KEY,
    "Item"    text NOT NULL DEFAULT '',
    "FCODE"   text NOT NULL DEFAULT '',
    "User_Id" text NOT NULL DEFAULT '',
    "Lock"    smallint NOT NULL DEFAULT 0,
    "LOCK_User_Id" text NOT NULL DEFAULT '',
    "Created_At" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tblItem_item
    ON public."tblItem" ("Item");

-- ------------------------------------------------------------------
-- 1) BOOT — contract: returns one blank row's searchFields json
-- ------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sp_frmItem_Boot(text, text, text, text) CASCADE;

CREATE OR REPLACE FUNCTION public.sp_frmItem_Boot(
    p_formid text, p_auth text, p_fcode text)
RETURNS TABLE("Id" bigint, "Item" text, "FCODE" text) LANGUAGE plpgsql AS $function$
BEGIN
    RETURN QUERY
    SELECT NULL::bigint, ''::text, COALESCE(p_fcode, 'HO')::text;
END $function$;

-- ------------------------------------------------------------------
-- 2) GRID — pg fast-grid dialect (proven sp_brand_grid2 shape):
--    LIMIT/OFFSET paging + count(*) OVER() single-pass total
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_frmItem_Grid2(
    p_pagesize integer, p_pageno integer, p_search text,
    p_formid text, p_fcode text, p_auth text)
RETURNS TABLE("Id" bigint, "Item" text, "rc" bigint)
LANGUAGE plpgsql AS $function$
BEGIN
    RETURN QUERY
    SELECT c."Id", c."Item", count(*) OVER() AS rc
    FROM public."tblItem" c
    WHERE (p_fcode = '' OR c."FCODE" = p_fcode)
      AND (p_search = ''
           OR c."Item" ILIKE '%' || p_search || '%')
    ORDER BY c."Id" DESC
    LIMIT p_pagesize OFFSET (p_pageno - 1) * p_pagesize;
END $function$;

-- ------------------------------------------------------------------
-- 3) GRID COUNT — total pages (sp_brand_gridcount1 dialect)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_frmItem_GridCount1(
    p_formid text, p_auth text, p_company text, p_search text)
RETURNS TABLE("rc" bigint) LANGUAGE plpgsql AS $function$
BEGIN
    RETURN QUERY
    SELECT count(*)::bigint
    FROM public."tblItem"
    WHERE (p_search = ''
           OR "Item" ILIKE '%' || p_search || '%');
END $function$;

-- ------------------------------------------------------------------
-- 4) DFE1 — one blank row (Add-Edit boot)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_frmItem_DFE1(
    p_id bigint, p_formid text, p_auth text)
RETURNS TABLE("Id" bigint, "Item" text)
LANGUAGE plpgsql AS $function$
BEGIN
    RETURN QUERY
    SELECT p_id::bigint, ''::text;
END $function$;

-- ------------------------------------------------------------------
-- 5) SAVE — insert + return new id (sp_brand_save contract)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_frmItem_SAVE(
    p_param1 text, p_formid text, p_auth text)
RETURNS TABLE("status" text, "id" bigint)
LANGUAGE plpgsql AS $function$
DECLARE v_id bigint;
BEGIN
    INSERT INTO public."tblItem" ("Item", "FCODE", "User_Id")
    VALUES (btrim(p_param1), '', p_auth)
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, v_id;
END $function$;

-- ------------------------------------------------------------------
-- 6) UPDATE — sp_brand_update contract
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_frmItem_UPDATE(
    p_id bigint, p_param1 text, p_formid text, p_auth text)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $function$
BEGIN
    UPDATE public."tblItem"
    SET "Item" = btrim(p_param1),
        "User_Id" = p_auth,
        "Created_At" = now()
    WHERE "Id" = p_id;
    RETURN QUERY SELECT 'Success'::text, ''::text;
END $function$;

-- ------------------------------------------------------------------
-- 7) DELETE — locked guard + delete (sp_brand_delete1 contract)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_frmItem_Delete1(
    p_id bigint, p_formid text, p_auth text)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $function$
BEGIN
    IF EXISTS (SELECT 1 FROM public."tblItem" WHERE "Id" = p_id AND "Lock" = 1) THEN
        RETURN QUERY SELECT 'Error'::text, 'RECORD IS LOCKED !!!'::text;
        RETURN;
    END IF;
    DELETE FROM public."tblItem" WHERE "Id" = p_id;
    RETURN QUERY SELECT 'Success'::text, ''::text;
END $function$;

-- ------------------------------------------------------------------
-- 8) LOCK/UNLOCK — toggle (sp_brand_lockunlock1 contract)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_frmItem_LockUnlock1(
    p_id bigint, p_auth text, p_formid text)
RETURNS TABLE("status" text, "message" text)
LANGUAGE plpgsql AS $function$
BEGIN
    UPDATE public."tblItem"
    SET "Lock" = CASE WHEN "Lock" = 0 THEN 1 ELSE 0 END,
        "LOCK_User_Id" = p_auth
    WHERE "Id" = p_id;
    RETURN QUERY SELECT 'Success'::text, ''::text;
END $function$;
