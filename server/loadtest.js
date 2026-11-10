/* pg-xerp load test — autocannon scenarios
   Usage: node loadtest.js            (health + login + menu + dashboard)
          node loadtest.js grid       (+ 100 req of the 100k-row brand grid) */
import http from 'node:http';
import autocannon from 'autocannon';

// Bind explicitly to IPv4. The API listens on IPv4 in the test environment,
// while `localhost` may resolve to ::1 first on Windows.
const HOST = '127.0.0.1';
const BASE = `http://${HOST}:${process.env.PORT || 3100}`;
const DEFAULT_CONNECTIONS = Number(process.env.LOADTEST_CONNECTIONS || 20);
const DEFAULT_DURATION = Number(process.env.LOADTEST_DURATION || 5);

function raw(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ host: HOST, port: process.env.PORT || 3100, path, method, headers: { 'Content-Type': 'application/json', 'Content-Length': data ? Buffer.byteLength(data) : 0 } }, (res) => {
      let out = '';
      res.on('data', (c) => (out += c));
      res.on('end', () => resolve(JSON.parse(out || '{}')));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function run(name, opts) {
  return new Promise((resolve) => {
    const { path = '/', ...options } = opts;
    const inst = autocannon({
      url: `${BASE}${path}`,
      ...options,
      connections: opts.connections || DEFAULT_CONNECTIONS,
      duration: opts.duration || DEFAULT_DURATION,
      title: name,
    });
    autocannon.track(inst, { renderProgressBar: true, renderResultsTable: true });
    inst.on('done', resolve);
  });
}

const isGrid = process.argv.includes('grid');

const login = await raw('POST', '/api/auth/login', { userid: 'LOADTEST', password: 'test123', company: 'xerp' });
const token = login.token;
if (!token) { console.error('login failed', login); process.exit(1); }
console.log('login OK ->', login.user?.userid, '@', login.company);

const auth = { Authorization: `Bearer ${token}`, appid: 'xerp' };

await run('GET /api/healthz', { method: 'GET', path: '/api/healthz', headers: auth });

await run('GET /api/menu', { method: 'GET', path: '/api/menu', headers: auth });
await run('GET /api/dashboard', { method: 'GET', path: '/api/dashboard', headers: auth });

if (isGrid) {
  await run('POST /api/crud grid (100k rows)', {
    method: 'POST',
    path: '/api/crud',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ formId: 'frmBrand', action: '_SEARCH_JSON', pagesize: 20, pageno: 1, params: { search: '' } }),
  });
}

console.log('done.');