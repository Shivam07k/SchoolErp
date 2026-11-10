
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
