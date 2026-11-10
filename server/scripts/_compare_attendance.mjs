import fs from "node:fs";
const get = (f) => {
  const src = fs.readFileSync(`server/src/routes/${f}`,"utf8");
  const re = /\b(?:[A-Za-z_$][\w$]*)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
  const out=[]; let m; while((m=re.exec(src))) out.push(m[1].toUpperCase()+" "+m[2]); return new Set(out);
};
const a=get("school.js"), b=get("school_attendance.js");
const only=[...b].filter(x=>!a.has(x));
const dup=[...b].filter(x=>a.has(x));
console.log("attendance routes:",b.size,"unique vs school.js:",only.length,"duplicates:",dup.length);
console.log("\nUNIQUE:\n"+only.join("\n"));
console.log("\nDUPLICATES:\n"+dup.join("\n"));
