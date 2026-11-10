$ErrorActionPreference = 'Stop'
$root    = 'C:\Users\hp\Desktop\exp\pg-xerp'
$formsBase = Join-Path $root 'src\forms'
$sqlDir  = Join-Path $root 'sql'

$done    = @('frmBrand', 'frmCategoryOptions')
$noGrid  = @('frmSecDept','frmSecDocs','frmSecGrp','frmSecLink','frmSecMenu','frmSecPerm','frmSecUser')

function Get-ColumnNames($json) {
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($blk in @('gridColumns','gridJSON2','searchFields','formControls')) {
        $arr = @($json.$blk)
        foreach ($it in $arr) {
            if (-not $it) { continue }
            foreach ($key in @('name','fieldName','fieldsName','fldName','dataIndex','value')) {
                if ($it.PSObject.Properties[$key]) {
                    $v = [string]$it.$key
                    if ($v) { $out.Add($v) }
                    break
                }
            }
        }
    }
    # dedupe, drop system cols, sort stable
    $set = New-Object System.Collections.Generic.List[string]
    foreach ($c in $out) {
        $c = $c.Trim()
        if (-not $c) { continue }
        if ($c -in @('Id','User_Id','T_CODE','FCODE','Lock','LOCK_User_Id','LOCK_Time','Created_At')) { continue }
        if (-not $set.Contains($c)) { $set.Add($c) }
    }
    return ,@($set)
}

$summary = New-Object System.Collections.Generic.List[string]
$total = 0

foreach ($dir in (Get-ChildItem $formsBase -Directory | Sort-Object Name)) {
    $formId = $dir.Name
    if ($formId -in $done -or $formId -in $noGrid) { continue }
    $fj = Join-Path $dir.FullName 'form.json'
    if (-not (Test-Path $fj)) { continue }
    $json = Get-Content $fj -Raw | ConvertFrom-Json
    $cols = @(Get-ColumnNames $json)
    if ($cols.Count -lt 1) {
        $summary.Add(('SKIP(nocols): ' + $formId))
        continue
    }

    $sp   = 'sp_' + $formId
    $tbl  = 'tbl' + ($formId -replace '^frm', '')   # tblItem, tblHsn, ...
    $q    = 'SELECT 1::bigint, '
    $q   += ($cols | ForEach-Object { 'json_build_object(' + ($_ -replace "'", "''").Replace('X', '') + ')::text' } | Out-String)
    $q    = 'SELECT 1::bigint'

    # ---- TABLE ----
    $colDecl = ($cols | ForEach-Object { '"' + $_ + '" TEXT' }) -join ",`n  "
    $colUpd  = ($cols | ForEach-Object { '"' + $_ + '" = ' + 'p.' + $_ }) -join ",`n   "
    $colIns  = ($cols -join '", "')
    $colVals = ($cols | ForEach-Object { 'p-jsonval(' + $_ + ')' }) -join ', '
    $colSel  = '"' + ($cols -join '", "') + '"'
    $colNull = ($cols | ForEach-Object { 'null AS "' + $_ + '"' }) -join ",`n      "

    $body = New-Object System.Text.StringBuilder
    [void]$body.AppendLine('-- ====================================================================')
    [void]$body.AppendLine('-- pg-xerp auto-port: ' + $formId + '  (recipe: proven frmCategoryOptions)')
    [void]$body.AppendLine('-- ====================================================================')
    [void]$body.AppendLine('CREATE TABLE IF NOT EXISTS public.' + $tbl + ' (')
    [void]$body.AppendLine('  "Id" BIGSERIAL PRIMARY KEY,')
    [void]$body.AppendLine('  ' + $colDecl + ',')
    [void]$body.AppendLine('  "User_Id" TEXT NOT NULL DEFAULT '''' ,')
    [void]$body.AppendLine('  "T_CODE" TEXT NOT NULL DEFAULT '''' ,')
    [void]$body.AppendLine('  "FCODE" TEXT NOT NULL DEFAULT '''' ,')
    [void]$body.AppendLine('  "Lock" SMALLINT NOT NULL DEFAULT 0,')
    [void]$body.AppendLine('  "LOCK_User_Id" TEXT NOT NULL DEFAULT '''' ,')
    [void]$body.AppendLine('  "LOCK_Time" TIMESTAMPTZ,')
    [void]$body.AppendLine('  "Created_At" TIMESTAMPTZ NOT NULL DEFAULT now()')
    [void]$body.AppendLine(');')
    [void]$body.AppendLine('')

    # ---- Boot ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_Boot(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_fcode text)')
    [void]$body.AppendLine('RETURNS TABLE("rc" bigint, "searchFields" text) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  RETURN QUERY SELECT 1::bigint, ')
    [void]$body.AppendLine('    json_build_object(' + ($cols | ForEach-Object { "'" + $_ + "'" }) -join ', ' + ')::text;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    # ---- Grid2 (fast dialect: count(*) OVER + LIMIT/OFFSET) ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_Grid2(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text,')
    [void]$body.AppendLine('  p_search text, p_fromdate text, p_todate text,')
    [void]$body.AppendLine('  p_pagesize bigint, p_pageno bigint, p_order text DEFAULT ''Id DESC'')')
    [void]$body.AppendLine('RETURNS TABLE("Id" bigint, "j" jsonb, "rc" bigint) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  RETURN QUERY')
    [void]$body.AppendLine('  SELECT t."Id", jsonb_build_object(' + ($cols | ForEach-Object { "'" + $_ + '", t."' + $_ + '"' }) -join ', ' + '), ')
    [void]$body.AppendLine('    count(*) OVER() AS rc')
    [void]$body.AppendLine('  FROM (SELECT ' + $colSel + ' FROM public.' + $tbl)
    [void]$body.AppendLine('        WHERE p_search = '''' OR ' + ($cols | ForEach-Object { '"' + $_ + '" ILIKE ''%'' || p_search || ''%''' }) -join ' OR ')
    [void]$body.AppendLine('        ORDER BY ' + ($cols[0]) + ' DESC')
    [void]$body.AppendLine('        LIMIT p_pagesize OFFSET (p_pageno - 1) * p_pagesize) t;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    # ---- GridCount ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_GridCount1(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_search text)')
    [void]$body.AppendLine('RETURNS TABLE("rc" bigint) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  RETURN QUERY SELECT count(*)::bigint FROM public.' + $tbl + ';')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    # ---- DFE1 (blank edit row) ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_DFE1(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint DEFAULT 0)')
    [void]$body.AppendLine('RETURNS TABLE("j" jsonb) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  RETURN QUERY SELECT jsonb_build_object(' + ($cols | ForEach-Object { "'" + $_ + '", '''' ' }) -join ', ' + ');')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    # ---- SAVE ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_SAVE(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_userid text,')
    [void]$body.AppendLine('  p_det jsonb)')
    [void]$body.AppendLine('RETURNS TABLE("status" text, "message" text, "id" bigint) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('DECLARE v_id bigint;')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  INSERT INTO public.' + $tbl + ' (' + $colIns + ', "User_Id")')
    [void]$body.AppendLine('  VALUES (' + ($cols | ForEach-Object { '(p_det->>''' + $_ + ''')::text' }) -join ', ' + ', p_userid)')
    [void]$body.AppendLine('  RETURNING "Id" INTO v_id;')
    [void]$body.AppendLine('  RETURN QUERY SELECT ''Success''::text, ''''::text, v_id;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    # ---- UPDATE ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_UPDATE(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_userid text, p_id bigint,')
    [void]$body.AppendLine('  p_det jsonb)')
    [void]$body.AppendLine('RETURNS TABLE("status" text, "message" text) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  UPDATE public.' + $tbl + ' SET')
    [void]$body.AppendLine('  ' + ($cols | ForEach-Object { '"' + $_ + '" = (p_det->>''' + $_ + ''')::text' }) -join ',')
    [void]$body.AppendLine('  , "User_Id" = p_userid')
    [void]$body.AppendLine('  WHERE "Id" = p_id;')
    [void]$body.AppendLine('  RETURN QUERY SELECT ''Success''::text, ''''::text;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    # ---- Delete1 ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_Delete1(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint)')
    [void]$body.AppendLine('RETURNS TABLE("status" text, "message" text) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  DELETE FROM public.' + $tbl + ' WHERE "Id" = p_id;')
    [void]$body.AppendLine('  RETURN QUERY SELECT ''Success''::text, ''''::text;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    # ---- LockUnlock1 ----
    [void]$body.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_LockUnlock1(')
    [void]$body.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint)')
    [void]$body.AppendLine('RETURNS TABLE("status" text, "message" text) LANGUAGE plpgsql AS $function$')
    [void]$body.AppendLine('BEGIN')
    [void]$body.AppendLine('  UPDATE public.' + $tbl + ' SET "Lock" = CASE WHEN "Lock" = 0 THEN 1 ELSE 0 END,')
    [void]$body.AppendLine('    "LOCK_User_Id" = p_auth, "LOCK_Time" = now()')
    [void]$body.AppendLine('  WHERE "Id" = p_id;')
    [void]$body.AppendLine('  RETURN QUERY SELECT ''Success''::text, ''''::text;')
    [void]$body.AppendLine('END $function$;')
    [void]$body.AppendLine('')

    $out = Join-Path $sqlDir ('port_' + $formId + '.sql')
    [IO.File]::WriteAllText($out, $body.ToString(), (New-Object System.Text.UTF8Encoding($false)))
    $total++
    $summary.Add(('GEN   ' + $formId + '  cols=[' + ($cols -join ', ') + ']'))
}

Write-Output ('GENERATED_FILES=' + $total)
Write-Output ('---')
foreach ($s in $summary) { Write-Output $s }
