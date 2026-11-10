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
