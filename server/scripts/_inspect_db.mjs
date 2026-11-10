import { getPoolFor } from '../src/db/pool.js';

const pool = getPoolFor(process.env.DB_ID || 'school_erp');

const tables = (await pool.query(`
  SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
`)).rows.map(r => r.tablename);

const colRows = (await pool.query(`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema='public' ORDER BY table_name, ordinal_position
`)).rows;
const colsByTable = new Map();
for (const r of colRows) {
  if (!colsByTable.has(r.table_name)) colsByTable.set(r.table_name, []);
  colsByTable.get(r.table_name).push(r.column_name);
}

const out = [];
for (const t of tables) {
  const cols = colsByTable.get(t) || [];
  let count = 0;
  let appIds = [];
  try {
    const q = cols.includes('app_id')
      ? `SELECT count(*)::int AS c FROM "${t}"`
      : `SELECT count(*)::int AS c FROM "${t}"`;
    count = (await pool.query(q)).rows[0].c;
    if (cols.includes('app_id')) {
      appIds = (await pool.query(`SELECT app_id, count(*)::int AS c FROM "${t}" GROUP BY app_id ORDER BY c DESC LIMIT 5`)).rows;
    }
  } catch (e) {
    out.push({ table: t, error: e.message, cols });
    continue;
  }
  out.push({ table: t, count, appIds, cols: cols.join(',') });
}

console.log('TABLES=' + tables.length);
for (const r of out) {
  const extra = r.error ? `ERROR ${r.error}` : r.appIds.map(a => `${a.app_id}:${a.c}`).join(' ');
  console.log(`${String(r.count ?? '-').padStart(8)}  ${r.table}${extra ? '   [' + extra + ']' : ''}`);
}

console.log('\n=== FOREIGN KEYS ===');
const fks = (await pool.query(`
  SELECT tc.table_name AS child, kcu.column_name AS child_col,
         ccu.table_name AS parent, ccu.column_name AS parent_col,
         tc.constraint_name AS name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
  ORDER BY tc.table_name, tc.constraint_name
`)).rows;
for (const f of fks) console.log(`${f.child}.${f.child_col} -> ${f.parent}.${f.parent_col}  (${f.name})`);

await pool.end();
