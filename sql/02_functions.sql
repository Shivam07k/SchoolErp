-- ============================================================
-- pg-xerp  02_functions.sql — PL/pgSQL functions (stored procs)
-- Every function is set-returning so the API can read its output
-- with a plain `SELECT * FROM fn($1,$2,...)` — parameterized,
-- fast-plan friendly, no string-built EXEC anywhere.
-- ============================================================

/* ---------------- Company list ---------------- */
CREATE OR REPLACE FUNCTION sp_company_list()
RETURNS TABLE("Id" bigint, "FranchiseeCode" text, "Company" text, "Name" text,
              "FranchiseeStatus" text, "Status" text)
LANGUAGE sql AS $fn$
  SELECT "Id", btrim(coalesce("FranchiseeCode",'')), coalesce("Company",''),
         coalesce("Name",''), coalesce("FranchiseeStatus",''), coalesce("Status",'')
  FROM "tblHO_Franchisee"
  WHERE btrim(coalesce("FranchiseeCode",'')) <> ''
  ORDER BY "FranchiseeCode";
$fn$;

/* ---------------- User-scoped menu tree ---------------- */
CREATE OR REPLACE FUNCTION sp_get_menus(p_fcode text, p_token text DEFAULT NULL)
RETURNS TABLE("MainGroup" text, "SubGroup" text, "MenuTitle" text, "WebPage" text,
              "DisplayIcon" text, "ShowStatus" boolean, "MenuOrder" integer, "FCODE" text)
LANGUAGE plpgsql AS $fn$
DECLARE
  v_uid   text;
  v_admin boolean := false;
BEGIN
  IF p_token IS NOT NULL THEN
    SELECT "UserId" INTO v_uid FROM "tblHO_User" WHERE "token" = p_token LIMIT 1;
  END IF;

  IF v_uid IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM "tblSecUserGrp" x JOIN "tblSecGroup" g ON g."GrpId"=x."GrpId"
               WHERE x."UserId"=v_uid AND g."IsAdmin")
       OR EXISTS (SELECT 1 FROM "tblHO_User" u WHERE u."UserId"=v_uid AND u."GRP" ILIKE '%ADMIN%')
       OR v_uid = 'ADMIN'
    THEN v_admin := true; END IF;
  END IF;

  RETURN QUERY
  WITH my_scopes AS (
    SELECT m."WebPage", min(CASE WHEN m."Visible" THEN 1 ELSE 0 END) AS vis_min
    FROM "tblSecMenuScope" m
    WHERE v_uid IS NULL OR (
          (m."ScopeType"='U' AND m."ScopeId"=v_uid)
       OR (m."ScopeType"='G' AND m."ScopeId" IN (SELECT * FROM my_grp_ids(v_uid)))
       OR (m."ScopeType"='D' AND m."ScopeId" IN (SELECT * FROM my_dept_ids(v_uid)))
    )
    GROUP BY m."WebPage"
  )
  SELECT m."MainGroup", m."SubGroup", m."MenuTitle", m."WebPage",
         m."DisplayIcon", m."ShowStatus", m."MenuOrder", m."FCODE"
  FROM "tblWebMenus" m
  LEFT JOIN my_scopes s ON s."WebPage" = m."WebPage"
  WHERE m."ShowStatus" AND m."FCODE" = p_fcode
    AND (NOT coalesce(m."AdminOnly", false) OR v_admin)
    AND (s.vis_min IS NULL OR s.vis_min = 1)
  ORDER BY m."MainGroup", m."SubGroup", m."MenuOrder", m."MenuTitle";
END $fn$;

/* ---------------- Dashboard stat cards ---------------- */
/* Safe on an empty schema: counts 0 when the business table does not exist yet. */
CREATE OR REPLACE FUNCTION sp_dashboard_stats()
RETURNS TABLE(key text, val bigint)
LANGUAGE plpgsql AS $fn$
DECLARE
  cards text[] := ARRAY[
    'Customers|"tblLedgerAcc"',
    'Brands|"tblBrand"',
    'HSN Codes|"tblHSN"',
    'Processes|"tblProcess"',
    'Department Sales|"tblGoodsSale"',
    'Goods Outwards|"tblGoodsOutward"',
    'Users|"tblHO_User"'
  ];
  part text;
BEGIN
  FOREACH part IN ARRAY cards LOOP
    key := split_part(part, '|', 1);
    IF to_regclass(split_part(part, '|', 2)) IS NOT NULL THEN
      EXECUTE format('SELECT count(*)::bigint FROM %s', split_part(part, '|', 2)) INTO val;
    ELSE
      val := 0;
    END IF;
    RETURN NEXT;
  END LOOP;
END $fn$;

/* ---------------- Scope helpers: a user's group/dept ids as text ---------------- */
CREATE OR REPLACE FUNCTION my_grp_ids(v_uid text)
RETURNS SETOF text LANGUAGE sql STABLE AS $fn$
  SELECT x."GrpId"::text FROM "tblSecUserGrp" x WHERE x."UserId" = v_uid
  UNION
  SELECT btrim(w) FROM unnest(string_to_array(coalesce(
      (SELECT u."GRP" FROM "tblHO_User" u WHERE u."UserId" = v_uid), ''), ',')) AS t(w)
  WHERE btrim(w) <> '';
$fn$;

CREATE OR REPLACE FUNCTION my_dept_ids(v_uid text)
RETURNS SETOF text LANGUAGE sql STABLE AS $fn$
  SELECT ud."DeptId"::text FROM "tblSecUserDept" ud WHERE ud."UserId" = v_uid
  UNION
  SELECT btrim(w) FROM unnest(string_to_array(coalesce(
      (SELECT u."Department" FROM "tblHO_User" u WHERE u."UserId" = v_uid), ''), ',')) AS t(w)
  WHERE btrim(w) <> '';
$fn$;

/* ---------------- Dashboard quick links (structured, no HTML) ---------------- */
CREATE OR REPLACE FUNCTION sp_dashboard_links(p_admin text DEFAULT NULL, p_token text DEFAULT NULL)
RETURNS TABLE(href text, title text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_admin boolean := false;
BEGIN
  IF p_token IS NOT NULL THEN
    SELECT "UserId" INTO v_uid FROM "tblHO_User" WHERE "token"=p_token LIMIT 1;
    IF v_uid IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM "tblSecUserGrp" x JOIN "tblSecGroup" g ON g."GrpId"=x."GrpId"
                 WHERE x."UserId"=v_uid AND g."IsAdmin")
         OR EXISTS (SELECT 1 FROM "tblHO_User" u WHERE u."UserId"=v_uid AND u."GRP" ILIKE '%ADMIN%')
         OR v_uid='ADMIN'
      THEN v_admin := true; END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT replace(m."WebPage", '.aspx', ''), m."MenuTitle"
  FROM "tblWebMenus" m
  WHERE m."ShowStatus" AND NOT coalesce(m."AdminOnly", false)
    AND (v_uid IS NULL OR v_admin OR NOT EXISTS (
      SELECT 1 FROM "tblSecMenuScope" h
      WHERE h."WebPage" = m."WebPage" AND NOT h."Visible"
        AND (
          (h."ScopeType"='U' AND h."ScopeId"=v_uid)
          OR           (h."ScopeType"='G' AND h."ScopeId" IN (SELECT * FROM my_grp_ids(v_uid)))
          OR (h."ScopeType"='D' AND h."ScopeId" IN (SELECT * FROM my_dept_ids(v_uid)))
        )
    ))
  ORDER BY m."SubGroup", m."MenuOrder";
END $fn$;

/* ---------------- User grid preferences ---------------- */
CREATE OR REPLACE FUNCTION sp_UserSetting(p_uid text, p_formid text)
RETURNS TABLE("SettingKey" text, "SettingVal" text)
LANGUAGE sql AS $fn$
  SELECT "SettingKey", "SettingVal"
  FROM "tblUserSetting"
  WHERE "UserId" = p_uid AND ("FormId" = p_formid OR "FormId" = '')
  ORDER BY "FormId" DESC;
$fn$;

/* ---------------- Rights resolution ----------------
   Precedence: USER deny > USER allow > GROUP(any) > DEPT. ADMIN bypass. */
CREATE OR REPLACE FUNCTION sp_sec_rights_resolve(p_token text, p_form_id text)
RETURNS TABLE("CanSee" boolean, "ShowAll" boolean, "Del" boolean,
              "LockU" boolean, "Unl" boolean, "IsAdmin" boolean)
LANGUAGE plpgsql AS $fn$
DECLARE
  v_uid      text;
  v_admin    boolean;
  u_see int := -1; u_show int := -1; u_del int := -1; u_lock int := -1; u_unl int := -1;
  g_see int := -1; g_show int := -1; g_del int := -1; g_lock int := -1; g_unl int := -1;
  d_see int := -1; d_show int := -1; d_del int := -1; d_lock int := -1; d_unl int := -1;
  out_see boolean; out_show boolean; out_del boolean; out_lock boolean; out_unl boolean;
BEGIN
  SELECT "UserId" INTO v_uid FROM "tblHO_User" WHERE "token"=p_token LIMIT 1;
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false,false,false,false,false,false; RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM "tblSecUserGrp" x JOIN "tblSecGroup" g ON g."GrpId"=x."GrpId"
                 WHERE x."UserId"=v_uid AND g."IsAdmin")
      OR EXISTS (SELECT 1 FROM "tblHO_User" u WHERE u."UserId"=v_uid AND u."GRP" ILIKE '%ADMIN%')
      OR v_uid='ADMIN' INTO v_admin;

  IF v_admin THEN
    RETURN QUERY SELECT true,true,true,true,true,true; RETURN;
  END IF;

  /* USER scope (latest row wins) */
  SELECT CASE WHEN "Ur_V" THEN 1 ELSE 0 END,
         CASE WHEN coalesce("Ur_showAll","Ur_V") THEN 1 ELSE 0 END,
         CASE WHEN coalesce("Ur_D","Ur_V") THEN 1 ELSE 0 END,
         CASE WHEN coalesce("Ur_L","Ur_V") THEN 1 ELSE 0 END,
         CASE WHEN coalesce("Ur_UnL","Ur_V") THEN 1 ELSE 0 END
    INTO u_see, u_show, u_del, u_lock, u_unl
  FROM "tblSecPerm"
  WHERE "ScopeType"='U' AND "ScopeId"=v_uid AND "Form_Id"=p_form_id
  ORDER BY "Id" DESC LIMIT 1;

  /* GROUP scope: any of my groups grants */
  SELECT max(CASE WHEN "Ur_V" THEN 1 ELSE 0 END),
         max(CASE WHEN coalesce("Ur_showAll","Ur_V") THEN 1 ELSE 0 END),
         max(CASE WHEN coalesce("Ur_D","Ur_V") THEN 1 ELSE 0 END),
         max(CASE WHEN coalesce("Ur_L","Ur_V") THEN 1 ELSE 0 END),
         max(CASE WHEN coalesce("Ur_UnL","Ur_V") THEN 1 ELSE 0 END)
    INTO g_see, g_show, g_del, g_lock, g_unl
  FROM "tblSecPerm" p
  WHERE p."ScopeType"='G' AND p."Form_Id"=p_form_id
    AND p."ScopeId" IN (SELECT * FROM my_grp_ids(v_uid));

/* DEPT scope: any of my depts grants */
  SELECT max(CASE WHEN "Ur_V" THEN 1 ELSE 0 END),
         max(CASE WHEN coalesce("Ur_showAll","Ur_V") THEN 1 ELSE 0 END),
         max(CASE WHEN coalesce("Ur_D","Ur_V") THEN 1 ELSE 0 END),
         max(CASE WHEN coalesce("Ur_L","Ur_V") THEN 1 ELSE 0 END),
         max(CASE WHEN coalesce("Ur_UnL","Ur_V") THEN 1 ELSE 0 END)
    INTO d_see, d_show, d_del, d_lock, d_unl
  FROM "tblSecPerm" p
  WHERE p."ScopeType"='D' AND p."Form_Id"=p_form_id
    AND p."ScopeId" IN (SELECT * FROM my_dept_ids(v_uid));

  out_see   := CASE WHEN u_see=0 THEN false
                    WHEN coalesce(NULLIF(u_see,-1),NULLIF(g_see,-1),NULLIF(d_see,-1),0)=1 THEN true
                    ELSE false END;
  out_show  := coalesce(NULLIF(u_show,0),NULLIF(g_show,0),NULLIF(d_show,0),0) = 1;
  out_del   := coalesce(NULLIF(u_del,0),NULLIF(g_del,0),NULLIF(d_del,0),0) = 1;
  out_lock  := coalesce(NULLIF(u_lock,0),NULLIF(g_lock,0),NULLIF(d_lock,0),0) = 1;
  out_unl   := coalesce(NULLIF(u_unl,0),NULLIF(g_unl,0),NULLIF(d_unl,0),0) = 1;

  RETURN QUERY SELECT out_see, out_show, out_del, out_lock, out_unl, v_admin;
END $fn$;

/* ---------------- Security: user list/get/save ---------------- */
CREATE OR REPLACE FUNCTION sp_sec_user_list()
RETURNS TABLE("UserId" text, "UserName" text, "Designation" text, "Status" text,
              "GrpsCsv" text, "DeptsCsv" text, "Depts" text, "Groups" text,
              "HasPwd" boolean, "IsAdmin" boolean)
LANGUAGE sql AS $fn$
  SELECT u."UserId", coalesce(u."UserName",''), coalesce(u."Designation",''), coalesce(u."Status",'1'),
         coalesce(u."GRP",''), coalesce(u."Department",''),
         string_agg(DISTINCT d."DeptName", ', ' ORDER BY d."DeptName"),
         string_agg(DISTINCT g."GrpName", ', ' ORDER BY g."GrpName"),
         u."PasswordHash" IS NOT NULL,
         EXISTS (SELECT 1 FROM "tblSecUserGrp" x JOIN "tblSecGroup" g2 ON g2."GrpId"=x."GrpId"
                 WHERE x."UserId"=u."UserId" AND g2."IsAdmin")
            OR u."GRP" ILIKE '%ADMIN%' OR u."UserId"='ADMIN'
  FROM "tblHO_User" u
  LEFT JOIN "tblSecUserDept" ud ON ud."UserId"=u."UserId"
  LEFT JOIN "tblSecDepartment" d ON d."DeptId"=ud."DeptId"
  LEFT JOIN "tblSecUserGrp" ug ON ug."UserId"=u."UserId"
  LEFT JOIN "tblSecGroup" g ON g."GrpId"=ug."GrpId"
  GROUP BY u."UserId", u."UserName", u."Designation", u."Status", u."GRP", u."Department", u."PasswordHash"
  ORDER BY u."UserId";
$fn$;

CREATE OR REPLACE FUNCTION sp_sec_user_save(p_actor text, p_userid text, p_username text,
                                            p_passwordhash text, p_designation text, p_status text,
                                            p_deptscsv text, p_grpscsv text)
RETURNS TABLE(status text, message text)
LANGUAGE plpgsql AS $fn$
DECLARE v_new text := coalesce(p_passwordhash, '$2a$10$CwTycRacWVvKTLzrnEMJzuEwCKxLZqHFWGpwbsSKrTSKr3jTfjZAi');
BEGIN
  INSERT INTO "tblHO_User" ("UserId","UserName","PasswordHash","Designation","Status","GRP","Department","User_Id")
  VALUES (p_userid, coalesce(p_username,''), v_new, coalesce(p_designation,''), coalesce(p_status,'1'),
          coalesce(p_grpscsv,''), coalesce(p_deptscsv,''), p_actor)
  ON CONFLICT ("UserId") DO UPDATE SET
    "UserName"    = EXCLUDED."UserName",
    "PasswordHash" = CASE WHEN p_passwordhash IS NULL THEN "tblHO_User"."PasswordHash" ELSE EXCLUDED."PasswordHash" END,
    "Designation" = EXCLUDED."Designation",
    "Status"      = EXCLUDED."Status",
    "GRP"         = EXCLUDED."GRP",
    "Department"  = EXCLUDED."Department",
    "User_Id"     = EXCLUDED."User_Id";

  DELETE FROM "tblSecUserDept" WHERE "UserId"=p_userid;
  INSERT INTO "tblSecUserDept" ("UserId","DeptId")
  SELECT p_userid, d."DeptId"
  FROM unnest(string_to_array(coalesce(p_deptscsv,''), ',')) AS t(w)
  JOIN "tblSecDepartment" d ON lower(btrim(d."DeptName")) = lower(btrim(t.w))
  WHERE btrim(t.w) <> '';

  DELETE FROM "tblSecUserGrp" WHERE "UserId"=p_userid;
  INSERT INTO "tblSecUserGrp" ("UserId","GrpId")
  SELECT p_userid, g."GrpId"
  FROM unnest(string_to_array(coalesce(p_grpscsv,''), ',')) AS t(w)
  JOIN "tblSecGroup" g ON lower(btrim(g."GrpName")) = lower(btrim(t.w))
  WHERE btrim(t.w) <> '';

  RETURN QUERY SELECT 'Success'::text, ''::text;
EXCEPTION WHEN others THEN
  RETURN QUERY SELECT 'Error'::text, SQLERRM;
END $fn$;

/* ---------------- Perm save/get (JSON payload) ---------------- */
CREATE OR REPLACE FUNCTION sp_sec_perm_save(p_scopetype text, p_scopeid text, p_form_id text, p_json text)
RETURNS TABLE(status text, message text)
LANGUAGE plpgsql AS $fn$
DECLARE j jsonb := p_json::jsonb;
BEGIN
  DELETE FROM "tblSecPerm" WHERE "ScopeType"=p_scopetype AND "ScopeId"=p_scopeid AND "Form_Id"=p_form_id;
  INSERT INTO "tblSecPerm" ("ScopeType","ScopeId","Form_Id","Ur_S","Ur_P","Ur_D","Ur_U","Ur_V",
                            "Ur_X","Ur_M","Ur_L","Ur_UnL","Ur_Cancel","Ur_UnCancel","Ur_SMS","Ur_showAll","User_Id")
  VALUES (p_scopetype, p_scopeid, p_form_id,
          (j->>'Ur_S')::boolean, (j->>'Ur_P')::boolean, (j->>'Ur_D')::boolean, (j->>'Ur_U')::boolean,
          (j->>'Ur_V')::boolean, (j->>'Ur_X')::boolean, (j->>'Ur_M')::boolean, (j->>'Ur_L')::boolean,
          (j->>'Ur_UnL')::boolean, (j->>'Ur_Cancel')::boolean, (j->>'Ur_UnCancel')::boolean,
          (j->>'Ur_SMS')::boolean, (j->>'Ur_showAll')::boolean, coalesce(p_scopeid,''));
  RETURN QUERY SELECT 'Success'::text, ''::text;
EXCEPTION WHEN others THEN
  RETURN QUERY SELECT 'Error'::text, SQLERRM;
END $fn$;

CREATE OR REPLACE FUNCTION sp_sec_perm_get(p_scopetype text, p_scopeid text, p_form_id text)
RETURNS TABLE("Id" bigint, "ScopeType" text, "ScopeId" text, "Form_Id" text,
              "Ur_S" boolean, "Ur_P" boolean, "Ur_D" boolean, "Ur_U" boolean,
              "Ur_V" boolean, "Ur_X" boolean, "Ur_M" boolean, "Ur_L" boolean,
              "Ur_UnL" boolean, "Ur_Cancel" boolean, "Ur_UnCancel" boolean,
              "Ur_SMS" boolean, "Ur_showAll" boolean)
LANGUAGE sql AS $fn$
  SELECT p."Id", p."ScopeType", p."ScopeId", p."Form_Id",
         p."Ur_S", p."Ur_P", p."Ur_D", p."Ur_U", p."Ur_V", p."Ur_X", p."Ur_M", p."Ur_L",
         p."Ur_UnL", p."Ur_Cancel", p."Ur_UnCancel", p."Ur_SMS", p."Ur_showAll"
  FROM "tblSecPerm" p
  WHERE p."ScopeType"=p_scopetype AND p."ScopeId"=p_scopeid AND p."Form_Id"=p_form_id
  ORDER BY p."Id" DESC LIMIT 1;
$fn$;

/* ============================================================
   Sample form: frmBrand — proves the fast-grid List pattern.
   One function returns rows + rc (total) in a single pass.
   ============================================================ */
CREATE OR REPLACE FUNCTION sp_Brand_Grid2(p_pagesize int, p_pageno int, p_search text,
                                          p_formid text, p_fcode text, p_auth text)
RETURNS TABLE("Id" bigint, "BrandName" text, rc bigint)
LANGUAGE sql AS $fn$
  SELECT b."Id", b."BrandName", count(*) OVER () AS rc
  FROM "tblBrand" b
  WHERE p_fcode = '' OR b."FCODE" = p_fcode
    AND (p_search = '' OR b."BrandName" ILIKE '%' || p_search || '%')
  ORDER BY b."Id" DESC
  LIMIT p_pagesize OFFSET (p_pageno - 1) * p_pagesize;
$fn$;

CREATE OR REPLACE FUNCTION sp_Brand_SAVE(p_brandname text, p_formid text, p_fcode text, p_auth text)
RETURNS TABLE(status text, message text, id bigint)
LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint;
BEGIN
  IF btrim(coalesce(p_brandname,'')) = '' THEN
    RETURN QUERY SELECT 'Error'::text, 'Brand name required'::text, 0::bigint; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM "tblBrand"
             WHERE lower(btrim("BrandName")) = lower(btrim(p_brandname)) AND "FCODE"=p_fcode) THEN
    RETURN QUERY SELECT 'Error'::text, 'Brand already exists'::text, 0::bigint; RETURN;
  END IF;
  INSERT INTO "tblBrand" ("BrandName", "FCODE", "User_Id")
  VALUES (btrim(p_brandname), p_fcode, p_auth)
  RETURNING "Id" INTO v_id;
  RETURN QUERY SELECT 'Success'::text, v_id::text, v_id;
EXCEPTION WHEN unique_violation THEN
  RETURN QUERY SELECT 'Error'::text, 'Brand already exists'::text, 0::bigint;
END $fn$;

CREATE OR REPLACE FUNCTION sp_Brand_UPDATE(p_id bigint, p_brandname text, p_formid text,
                                           p_fcode text, p_auth text)
RETURNS TABLE(status text, message text)
LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE "tblBrand" SET "BrandName"=btrim(p_brandname), "User_Id"=p_auth WHERE "Id"=p_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'Error'::text, 'Brand not found'::text; RETURN;
  END IF;
  RETURN QUERY SELECT 'Success'::text, ''::text;
END $fn$;

CREATE OR REPLACE FUNCTION sp_Brand_Delete1(p_id bigint, p_formid text, p_auth text)
RETURNS TABLE(status text, message text)
LANGUAGE plpgsql AS $fn$
BEGIN
  DELETE FROM "tblBrand" WHERE "Id"=p_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'Error'::text, 'Brand not found'::text; RETURN;
  END IF;
  RETURN QUERY SELECT 'Success'::text, ''::text;
END $fn$;

DROP FUNCTION IF EXISTS sp_Brand_DFE1(bigint, text, text) CASCADE;

CREATE OR REPLACE FUNCTION sp_Brand_DFE1(p_id bigint, p_formid text, p_auth text, p_fcode text)
RETURNS TABLE("Id" bigint, "Detail" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT b."Id", json_build_object('BrandName', b."BrandName")::text
    FROM "tblBrand" b
    WHERE b."Id" = p_id;
END
$fn$;