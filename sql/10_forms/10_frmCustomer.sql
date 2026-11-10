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
