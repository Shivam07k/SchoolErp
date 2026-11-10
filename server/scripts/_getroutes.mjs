import fs from "node:fs";
const txt = fs.readFileSync(process.env.LOCALAPPDATA + "/Temp/opencode/routes.txt", "utf8");
let file = null;
const rows = [];
for (const line of txt.split(/\r?\n/)) {
  if (line.startsWith("### ")) file = line.slice(4);
  else if (/^(GET|POST|PUT|PATCH|DELETE) /.test(line)) {
    const [method, ...rest] = line.split(" ");
    rows.push({ file, method, path: rest.join(" ") });
  }
}
const pref = (f) => f === "school_reports.js" ? "/api/school/reports" : f === "school_automation.js" ? "/api/school/automation" : f === "school_import.js" ? "/api/school/import" : f === "auth.js" ? "/api/auth" : f.startsWith("school") ? "/api/school" : "/api";
let n = 0;
for (const r of rows) {
  if (r.method !== "GET") continue;
  if (r.path.includes(":")) continue;
  n++;
  console.log(`${pref(r.file).padEnd(20)} ${r.path.padEnd(46)} ${r.file}`);
}
console.error("TOTAL GET(no params)=" + n);
