$ErrorActionPreference = "Stop"
$formsRoot = "C:\Users\hp\Desktop\exp\pg-xerp\src\forms"
$sqlDir    = "C:\Users\hp\Desktop\exp\pg-xerp\sql"

function Get-FormColumns($json) {
    $cols = @()
    foreach ($prop in @("gridColumns", "gridJSON2", "searchFields", "formControls", "fields")) {
        $arr = @($json.$prop)
        foreach ($item in $arr) {
            if ($null -eq $item) { continue }
            if ($item.name)   { $cols += [string]$item.name }
            if ($item.fieldName) { $cols += [string]$item.fieldName }
            foreach ($pn in $item.PSObject.Properties.Name) {
                if ($pn -notmatch "^(name|fieldName|header|title|width|align|type|value|link|required|readonly|visible|hidden|lookup|combo|table|Default|Label|FCODE|Header|display)$") {
                    $cols += [string]$pn
                }
            }
        }
    }
    $cols | Where-Object { $_ -and $_.Trim() -ne "" -and $_ -notmatch "(?i)^(Id|FCODE|T_CODE)$" } | Sort-Object -Unique
}

function Get-ProcVerbs($formId) {
    # dict key -> verb suffix. crud.js fallback: sp_${formId}_${verb}
    [ordered]@{
        Boot       = "Boot"
        Grid2      = "Grid2"
        GridCount1 = "GridCount1"
        DFE1       = "DFE1"
        SAVE       = "SAVE"
        UPDATE     = "UPDATE"
        Delete1    = "Delete1"
        LockUnlock1= "LockUnlock1"
    }
}

function Identity($s) {
    if ($s -match "^[a-zA-Z_]") { return $s }
    return "_" + $s
}

function Build-One($formId, $cols) {
    $base      = "sp_$formId"
    $tbl       = "tbl_$formId"   # unique, no clash with tblBrand etc.
    $colList   = ($cols | ForEach-Object { '"{0}"' -f (Identity $_) }) -join ", "
    $colsText  = ($cols | ForEach-Object { ('"{0}" TEXT' -f (Identity $_)) }) -join ", " + ""
    $colsText  = $colsText.TrimEnd(", ")
    $insCols   = ($cols | ForEach-Object { '"{0}"' -f (Identity $_) }) -join ", "
    $insVals   = ($cols | ForEach-Object { 'p_{0}' -f (Identity $_) }) -join ", "
    $updSet    = ($cols | ForEach-Object { '"{0}" = p_{0}' -f (Identity $_) }) -join ", "

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine("CREATE TABLE IF NOT EXISTS $tbl (")
    [void]$sb.AppendLine("  Id BIGSERIAL PRIMARY KEY,")
    if ($colsText) { [void]$sb.AppendLine("  $colsText,") }
    [void]$sb.AppendLine("  User_Id TEXT,")
    [void]$sb.AppendLine("  FOLDER_ID TEXT,")
    [void]$sb.AppendLine("  T_CODE TEXT,")
    [void]$sb.AppendLine("  Created_At TIMESTAMPTZ NOT NULL DEFAULT now(),")
    [void]$sb.AppendLine("  Lock CHAR(1) NOT NULL DEFAULT '0',")
    [void]$sb.AppendLine("  Lock_User_Id TEXT,")
    [void]$sb.AppendLine("  Lock_Time TIMESTAMPTZ")
    [void]$sb.AppendLine(");")
    [void]$sb.AppendLine()

    # ---- Boot: returns searchFields contract ----
    [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${base}_Boot(")
    [void]$sb.AppendLine("  p_formid TEXT, p_auth TEXT, p_company TEXT)")
    [void]$sb.AppendLine("RETURNS TABLE (det1 TEXT) LANGUAGE plpgsql AS `$f1`")
    [void]$sb.AppendLine("BEGIN")
    [void]$sb.AppendLine("  RETURN QUERY SELECT json_build_object(")
    $fs = @()
    foreach ($c in $cols) {
        $fs += ('"{0}", "0,""{0}""' -f (Identity $c))
    }
    [void]$sb.AppendLine("    " + ($fs -join ", `n    "))
    [void]$sb.AppendLine("  )::text;")
    [void]$sb.AppendLine("END `$f1`;")
    [void]$sb.AppendLine()

    # ---- Grid2: fast LIMIT/OFFSET + count(*) OVER() ----
    [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${base}_Grid2(")
    [void]$sb.AppendLine("  p_formid TEXT, p_page BIGINT, p_pagesize BIGINT, p_company TEXT,")
    [void]$sb.AppendLine("  p_auth TEXT, p_search JSONB DEFAULT NULL, p_order VARCHAR DEFAULT 'Id DESC')")
    [void]$sb.AppendLine("RETURNS TABLE (Id BIGINT, rc BIGINT, j JSONB) LANGUAGE plpgsql AS `$f2`")
    [void]$sb.AppendLine("BEGIN")
    [void]$sb.AppendLine("  RETURN QUERY EXECUTE format('")
    [void]$sb.AppendLine("    SELECT Id, count(*) OVER() AS rc, row_to_json(t) AS j")
    [void]$sb.AppendLine("    FROM (SELECT a.`"Id`", $colList FROM $tbl a ORDER BY %s) t")
    [void]$sb.AppendLine("    LIMIT %s OFFSET (%s::bigint - 1) * %s::bigint',")
    [void]$sb.AppendLine("    COALESCE(p_order, 'Id DESC'), p_pagesize, p_page, p_pagesize)")
    [void]$sb.AppendLine("    USING ($colList);")
    [void]$sb.AppendLine("END `$f2`;")
    [void]$sb.AppendLine()

    # ---- GridCount1 ----
    [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${base}_GridCount1(")
    [void]$sb.AppendLine("  p_formid TEXT, p_search JSONB DEFAULT NULL, p_company TEXT)")
    [void]$sb.AppendLine("RETURNS TABLE (rc BIGINT) LANGUAGE plpgsql AS `$f3`")
    [void]$sb.AppendLine("BEGIN")
    [void]$sb.AppendLine("  RETURN QUERY SELECT count(*)::bigint FROM $tbl;")
    [void]$sb.AppendLine("END `$f3`;")
    [void]$sb.AppendLine()

    # ---- DFE1: blank row for AddEdit ----
    [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${base}_DFE1(")
    [void]$sb.AppendLine("  p_formid TEXT, p_auth TEXT, p_company TEXT, p_id BIGINT DEFAULT NULL)")
    [void]$sb.AppendLine("RETURNS TABLE (det1 TEXT) LANGUAGE plpgsql AS `$f4`")
    [void]$sb.AppendLine("BEGIN")
    [void]$sb.AppendLine("  IF p_id IS NULL THEN")
    [void]$sb.AppendLine("    RETURN QUERY SELECT json_build_object(" + ($fs -join ", `n      ") + ")::text;")
    [void]$sb.AppendLine("  ELSE")
    [void]$sb.AppendLine("    RETURN QUERY SELECT json_build_object(" + ($fs -join ", `n      ") + ")::text")
    [void]$sb.AppendLine("      FROM $tbl WHERE Id = p_id;")
    [void]$sb.AppendLine("  END IF;")
    [void]$sb.AppendLine("END `$f4`;")
    [void]$sb.AppendLine()

    # ---- SAVE ----
    [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${base}_SAVE(")
    [void]$sb.AppendLine("  p_formid TEXT, p_auth TEXT, p_company TEXT,")
    [void]$sb.AppendLine("  p_data JSONB, p_userid TEXT DEFAULT 'ADMIN')")
    [void]$sb.AppendLine("RETURNS TABLE (det1 TEXT) LANGUAGE plpgsql AS `$f5`")
    [void]$sb.AppendLine("DECLARE new_id BIGINT;")
    [void]$sb.AppendLine("BEGIN")
    [void]$sb.AppendLine("  INSERT INTO $tbl ($insCols")
    [void]$sb.AppendLine("    VALUES ($insVals)")
    [void]$sb.AppendLine("    RETURNING Id INTO new_id;")
    [void]$sb.AppendLine("  RETURN QUERY SELECT json_build_object(")
    [void]$sb.AppendLine("    'status', 'Success', 'id', new_id, 'message', 'Saved')::text;")
    [void]$sb.AppendLine("END `$f5`;")
    [void]$sb.AppendLine()

    # ---- UPDATE ----
    [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${base}_UPDATE(")
    [void]$sb.AppendLine("  p_formid TEXT, p_auth TEXT, p_company TEXT, p_id BIGINT, p_data JSONB,")
    [void]$sb.AppendLine("  p_userid TEXT DEFAULT 'ADMIN')")
    [void]$sb.AppendLine("RETURNS TABLE (det1 TEXT) LANGUAGE plpgsql AS `$f6`")
    [void]$sb.AppendLine("BEGIN")
    [void]$sb.AppendLine("  UPDATE $tbl SET $updSet WHERE Id = p_id;")
    [void]$sb.AppendLine("  RETURN QUERY SELECT json_build_object(")
    [void]$sb.AppendLine("    'status', 'Success', 'id', p_id, 'message', 'Updated')::text;")
    [void]$sb.AppendLine("END `$f6`;")
    [void]$sb.AppendLine()

    # ---- Delete1 ----
    [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${base}_Delete1(")
    [void]$sb.AppendLine("  p_formid TEXT, p_auth TEXT, p_company TEXT, p_id BIGINT)")
    [void]$sb.AppendLine("RETURNS TABLE (det1 TEXT) LANGUAGE plpgsql AS `$f7`")
    [void]$sb.AppendLine("BEGIN")
    [void]$sb.AppendLine("  DELETE FROM $tbl WHERE Id = p_id;")
    [void]$sb.AppendLine("  RETURN QUERY SELECT json_build_object(")
    [void]$sb.AppendLine("    'status', 'Success', 'message', 'Deleted')::text;")
    [void]$sb.AppendLine("END `$f7`;")
    [void]$sb.AppendLine()

    # ---- LockUnlock1 ----
    [void]$sb.AppendLine("CREATE OR REPLACE FUNCTION public.${base}_LockUnlock1(")
    [void]$sb.AppendLine("  p_formid TEXT, p_auth TEXT, p_company TEXT, p_id BIGINT,")
    [void]$sb.AppendLine("  p_lockcd CHAR DEFAULT 'L')")
    [void]$sb.AppendLine("RETURNS TABLE (det1 TEXT) LANGUAGE plpgsql AS `$f8`")
    [void]$sb.AppendLine("BEGIN")
    [void]$sb.AppendLine("  UPDATE $tbl SET Lock = p_lockcd, Lock_User_Id = p_auth, Lock_Time = now() WHERE Id = p_id;")
    [void]$sb.AppendLine("  RETURN QUERY SELECT json_build_object('status','Success','message','Locked')::text;")
    [void]$sb.AppendLine("END `$f8`;")
    [void]$sb.AppendLine()
    return $sb.ToString()
}

$summary = @()
$generated = 0
foreach ($d in (Get-ChildItem $formsRoot -Directory | Sort-Object Name)) {
    $formId = $d.Name
    $fj = Join-Path $d.FullName "form.json"
    if (-not (Test-Path $fj)) { continue }
    $json = Get-Content $fj -Raw | ConvertFrom-Json
    $cols = @(Get-FormColumns $json)
    if ($cols.Count -lt 1) {
        $summary += "SKIP(no-cols): $formId"
        continue
    }
    $sql = Build-One $formId $cols
    $out = Join-Path $sqlDir ("port_" + $formId + ".sql")
    Set-Content -LiteralPath $out -Value $sql -Encoding UTF8
    $summary += "GEN $formId :: cols=$($cols.Count) :: $($cols -join ',') :: -> $(Split-Path $out -Leaf)"
    $generated++
}
Write-Output ("GENERATED=$generated")
Write-Output ("-----")
$summary | ForEach-Object { Write-Output $_ }
