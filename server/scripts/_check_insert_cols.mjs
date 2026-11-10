import fs from 'node:fs';
import { getPool } from '../src/db/pool.js';

const files = process.argv.slice(2);
const pool = getPool();
const schema = new Map();
const { rows } = await pool.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'`);
for (const r of rows) {
  if (!schema.has(r.table_name)) schema.set(r.table_name, new Set());
  schema.get(r.table_name).add(r.column_name);
}
let issues = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /INSERT\s+INTO\s+([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/gi;
  let m;
  while ((m = re.exec(src))) {
    const table = m[1];
    const cols = m[2].split(',').map((s) => s.trim()).filter(Boolean);
    const known = schema.get(table);
    if (!known) { console.log(`${f}: TABLE MISSING ${table}`); issues++; continue; }
    const bad = cols.filter((c) => !known.has(c));
    if (bad.length) {
      const line = src.slice(0, m.index).split('\n').length;
      console.log(`${f}:${line}: ${table} -> unknown columns: ${bad.join(', ')}`);
      issues++;
    }
  }
}
console.log(`issues=${issues}`);
await pool.end();
