import fs from "node:fs";
import path from "node:path";
const dir = "server/src/routes";
const out = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".js")) continue;
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  const re = /\b(?:[A-Za-z_$][\w$]*)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
  let m;
  while ((m = re.exec(src))) out.push({ file: f, method: m[1].toUpperCase(), path: m[2] });
}
const byModule = {};
for (const r of out) (byModule[r.file] ||= []).push(r);
for (const k of Object.keys(byModule).sort()) {
  console.log(`\n### ${k}`);
  for (const r of byModule[k]) console.log(`${r.method} ${r.path}`);
}
console.log(`\nTOTAL ${out.length}`);
