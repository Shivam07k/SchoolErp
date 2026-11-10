-- ash1: company-specific field on Customer Master
--
-- Proves the company-folder mechanism end to end: ash1 gets a column, a save
-- path and a read path that xerp does not have, and the form in
-- src/companies/ash1/forms/frmCustomer/ is the one that exposes it.
--
-- "TestField" is the 29th header field, which is where
-- src/companies/ash1/fieldOrder.json puts it ("header.append"). The sp_* procs
-- are called positionally as
--   (<fields...>, formId, FCODE, auth, '')
-- so the new parameter has to sit immediately before those four trailing
-- system params - that is the whole reason the order file exists.
--
-- Apply with:  node server/_migrate.mjs ash1
--
-- Rolling this back (ash1 only):
--   DROP FUNCTION sp_frmCustomer_SAVE;    -- and UPDATE / DFE1
--   ALTER TABLE "tblfrmCustomer" DROP COLUMN "TestField";

-- ---------------------------------------------------------------- column ----
ALTER TABLE public."tblfrmCustomer"
  ADD COLUMN IF NOT EXISTS "TestField" text NOT NULL DEFAULT '';

-- ------------------------------------------------------------------ SAVE ----
-- One extra p_testfield before the system params; the column is written on
-- insert like every other header field.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_SAVE'
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCustomer_SAVE"(
  p_ledgercode text, p_ledgergroup text, p_alias text, p_currency text,
  p_country text, p_add1 text, p_add2 text, p_city text, p_state text,
  p_pincode text, p_contactdescription text, p_phone text, p_email text,
  p_whatsappno text, p_customergroup text, p_crlimit text, p_pmntterm text,
  p_pmntmethod text, p_deliveryterm text, p_deliverymode text, p_gstin text,
  p_pan text, p_bankaname text, p_bankac text, p_ifsc text, p_transport text,
  p_iscustomer text, p_issupplier text,
  p_testfield text,
  p_frmcustomer_frm text, p_frmcustomer_fcode text, p_frmcustomer_auth text,
  p_frmcustomer_unused text)
 RETURNS TABLE(status text, message text, id bigint, "Error" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmcustomer_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmcustomer_auth);
    INSERT INTO public."tblfrmCustomer" ("LedgerCode", "LedgerGroup", "Alias", "Currency", "Country", "Add1", "Add2", "City", "State", "PinCode", "ContactDescription", "Phone", "Email", "WhatsAppNo", "CustomerGroup", "CrLimit", "PmntTerm", "PmntMethod", "DeliveryTerm", "DeliveryMode", "GstIn", "PAN", "BankaName", "BankAc", "IFSC", "Transport", "IsCustomer", "IsSupplier", "TestField", "User_Id", "FCODE")
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
            COALESCE(NULLIF(p_testfield, ''), ''),
            v_uid,
            COALESCE(NULLIF(p_frmcustomer_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$function$;

-- ---------------------------------------------------------------- UPDATE ----
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_UPDATE'
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCustomer_UPDATE"(
  p_frmcustomer_id bigint,
  p_ledgercode text, p_ledgergroup text, p_alias text, p_currency text,
  p_country text, p_add1 text, p_add2 text, p_city text, p_state text,
  p_pincode text, p_contactdescription text, p_phone text, p_email text,
  p_whatsappno text, p_customergroup text, p_crlimit text, p_pmntterm text,
  p_pmntmethod text, p_deliveryterm text, p_deliverymode text, p_gstin text,
  p_pan text, p_bankaname text, p_bankac text, p_ifsc text, p_transport text,
  p_iscustomer text, p_issupplier text,
  p_testfield text,
  p_frmcustomer_frm text, p_frmcustomer_fcode text, p_frmcustomer_auth text,
  p_frmcustomer_unused text)
 RETURNS TABLE(status text, message text, id bigint, "Error" text)
 LANGUAGE plpgsql
AS $function$
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
        "TestField" = COALESCE(NULLIF(p_testfield, ''), ''),
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
$function$;

-- ----------------------------------------------------------------- DFE1 ----
-- The read side needs the column too: DFE1 declares an explicit RETURNS TABLE
-- and selects each column by name, so without this override the value would
-- save fine and then come back blank. Appended last so the existing 30
-- columns keep their positions.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_DFE1'
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCustomer_DFE1"(p_frmcustomer_id bigint, p_frmcustomer_frm text, p_frmcustomer_auth text, p_frmcustomer_unused text)
 RETURNS TABLE(id bigint, "LedgerCode" text, "LedgerGroup" text, "Alias" text, "Currency" text, "Country" text, "Add1" text, "Add2" text, "City" text, "State" text, "PinCode" text, "ContactDescription" text, "Phone" text, "Email" text, "WhatsAppNo" text, "CustomerGroup" text, "CrLimit" numeric, "PmntTerm" text, "PmntMethod" text, "DeliveryTerm" text, "DeliveryMode" text, "GstIn" text, "PAN" text, "BankaName" text, "BankAc" text, "IFSC" text, "Transport" text, "IsCustomer" boolean, "IsSupplier" boolean, "LOCK" boolean, "TestField" text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."LedgerCode", t."LedgerGroup", t."Alias", t."Currency", t."Country",
           t."Add1", t."Add2", t."City", t."State", t."PinCode",
           t."ContactDescription", t."Phone", t."Email", t."WhatsAppNo",
           t."CustomerGroup", t."CrLimit", t."PmntTerm", t."PmntMethod",
           t."DeliveryTerm", t."DeliveryMode", t."GstIn", t."PAN",
           t."BankaName", t."BankAc", t."IFSC", t."Transport",
           t."IsCustomer", t."IsSupplier",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK",
           t."TestField"
    FROM public."tblfrmCustomer" t
    WHERE t."Id" = p_frmcustomer_id;
END
$function$;
