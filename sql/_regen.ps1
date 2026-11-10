$ErrorActionPreference = "Stop"
$base = "C:\Users\hp\Desktop\exp\pg-xerp"

# ---------------------------------------------------------------
# column map = the ACTUAL columns each grafted form binds on its
# own AddEditPage/ListPage (ground truth extracted from form.json).
# ---------------------------------------------------------------
$map = [ordered]@{
    "frmCustomer"        = @("Category")
    "frmDeptSale2"       = @("Category")
    "frmDeptSale3"       = @("Category")
    "frmGoodsInward"     = @("Category")
    "frmgoodsoutward"    = @("Category")
    "frmhsn"             = @("Hsn","HsnDescription")
    "frmItem"            = @("Item")
    "frmItemCategory"    = @("Category")
    "frmitemno"          = @("ItemNo","Title","Size")
    "frmItemNoDyn"       = @("ItemNo","Title","Size")
    "frmPackingCategory" = @("PackingCategory")
    "frmCategoryOptions" = @("Category","fldName")
    "frmBrand"           = @("Brand")
}

function Get-StringType($n) {
    $l = $n.ToLowerInvariant()
    if ($l -match "date|time|from|to") { return "timestamptz" }
    if ($l -match "qty|no\d|weight|rate|amt|amount|value|price|size$") { return "numeric(18,2)" }
    return "text"
}

$outFiles = New-Object System.Collections.Generic.List[string]

foreach ($k in ($map.Keys | Sort-Object)) {
    $cols   = @($map[$k])
    $tbl    = "tbl" + $k.Substring(3)
    $sp     = "sp_" + $k.ToLowerInvariant()
    $colIden = @($cols | ForEach-Object { '"' + $_ + '"' })
    $colDecl = @($cols | ForEach-Object { '"' + $_ + '" ' + (Get-StringType $_) + " NOT NULL DEFAULT ''," })
    $colBlob = ($cols | ForEach-Object { '"' + $_ + '", "User_Id"' }) -join ", "
    $colSet  = ($cols | ForEach-Object { '"' + $_ + '" = coalesce(p_params->>''' + $_ + ''', '''''')' }) -join ", "
    $colVals = ($cols | ForEach-Object { '{0}' -f ('p_params->>''' + $_ + '''') }) -join ", "

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine('-- pg-xerp port: ' + $k + '  (' + $tbl + ') -- proven sp_brand_save dialect')
    [void]$sb.AppendLine('CREATE TABLE IF NOT EXISTS public."' + $tbl + '" (')
    [void]$sb.AppendLine('  "Id"   bigserial PRIMARY KEY,')
    foreach ($d in $colDecl) { [void]$sb.AppendLine('  ' + $d) }
    [void]$sb.AppendLine('  "FCODE" text NOT NULL DEFAULT '''',')
    [void]$sb.AppendLine('  "FCODE" text NOT NULL DEFAULT '''',')
    [void]$sb.AppendLine('')
    # SIGNATURE OVERLOADS: this form's AddEditPage.contract
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_Boot(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_fcode text)')
    [void]$sb.AppendLine('RETURNS TABLE("boot" text) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN')
    [void]$sb.AppendLine('  RETURN QUERY SELECT ''{"searchFields":[]}''::text;')
    [void]$sb.AppendLine('END $function$;')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_Grid2(')
    [void]$sb.AppendLine('  p_search text, p_formid text, p_auth text, p_fcode text,')
    [void]$sb.AppendLine('  p_pagesize integer, p_pageno integer)')
    [void]$sb.AppendLine('RETURNS TABLE("Id" bigint, "det" text, "rc" bigint) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN')
    [void]$sb.AppendLine('  RETURN QUERY SELECT t."Id", to_jsonb(t)::text, count(*) OVER() FROM (')
    [void]$sb.AppendLine('    SELECT * FROM public."' + $tbl + '" WHERE (p_search=''''')
    [void]$sb.AppendLine('      OR ' + ($colIden | ForEach-Object { $_ + ' ILIKE ''%''||p_search||''%''' }) -join ' OR ') + ')')
    [void]$sb.AppendLine('    ORDER BY "Id" DESC LIMIT p_pagesize OFFSET (p_pageno-1)*p_pagesize) t;')
    [void]$sb.AppendLine('END $function$;')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_GridCount1(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_search text, p_fcode text)')
    [void]$sb.AppendLine('RETURNS TABLE("rc" bigint) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN RETURN QUERY SELECT count(*)::bigint FROM public."' + $tbl + '"; END $function$;')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_DFE1(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_fcode text, p_id bigint DEFAULT 0)')
    [void]$sb.AppendLine('RETURNS TABLE("det" text) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN RETURN QUERY SELECT ''{}''::text; END $function$;')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_SAVE(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_fcode text, p_params jsonb)')
    [void]$sb.AppendLine('RETURNS TABLE("status" text, "id" bigint) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('DECLARE v_id bigint;')
    [void]$sb.AppendLine('BEGIN')
    [void]$sb.AppendLine('  INSERT INTO public."' + $tbl + '" (' + ($colIden -join ',') + ') VALUES (' + $colVals + ') RETURNING "Id" INTO v_id;')
    [void]$sb.AppendLine('  RETURN QUERY SELECT ''Success'', v_id;')
    [void]$sb.AppendLine('END $function$;')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_UPDATE(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint, p_params jsonb)')
    [void]$sb.AppendLine('RETURNS TABLE("status" text) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN UPDATE public."' + $tbl + '" SET ' + $colSet + ' WHERE "Id"=p_id; RETURN QUERY SELECT ''Success''; END $function$;')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_Delete1(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint)')
    [void]$sb.AppendLine('RETURNS TABLE("status" text) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN DELETE FROM public."' + $tbl + '" WHERE "Id"=p_id; RETURN QUERY SELECT ''Success''; END $function$;')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('CREATE OR REPLACE FUNCTION public.' + $sp + '_LockUnlock1(')
    [void]$sb.AppendLine('  p_formid text, p_auth text, p_company text, p_id bigint)')
    [void]$sb.AppendLine('RETURNS TABLE("status" text) LANGUAGE plpgsql AS $function$')
    [void]$sb.AppendLine('BEGIN UPDATE public."' + $tbl + '" SET "Lock" = 1 - "Lock" WHERE "Id"=p_id; RETURN QUERY SELECT ''Success''; END $function$;')
    [void]$sb.AppendLine('')

    $out = Join-Path $base ("sql\port_" + $k + ".sql")
    Set-Content -LiteralPath $out -Value $sb.ToString() -Encoding UTF8
    $outFiles.Add($out)
}

"GENERATED=$($outFiles.Count)"
$outFiles | ForEach-Object { "  " + (Split-Path $_ -Leaf) }