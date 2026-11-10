import express from 'express';
import cluster from 'node:cluster';
import os from 'node:os';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, validateProductionEnv } from './config/env.js';
import { closeAllPools, ping } from './db/pool.js';
import { verifyToken } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import './middleware/async-errors.js';
import { contextMiddleware } from './logging/als.js';
import { authRouter } from './routes/auth.js';
import { menuRouter } from './routes/menu.js';
import { dashRouter } from './routes/dash.js';
import { logsRouter } from './routes/logs.js';
import { schemaRouter } from './routes/schema.js';
import { crudRouter } from './routes/crud.js';
import { securityRouter } from './routes/security.js';
import { customFieldRouter } from './routes/customfields.js';
import { schoolRouter } from './routes/school.js';
import { schoolFoundationRouter } from './routes/schoolFoundation.js';
import { schoolCompRouter } from './routes/school_comprehensive.js';
import { schoolExamRouter } from './routes/school_exam.js';
import { schoolFeeRouter } from './routes/school_fee.js';
import { schoolFeeOpsRouter } from './routes/school_fee_ops.js';
import hrStaffRouter from './routes/school_hr_staff.js';
import hrLeaveRouter from './routes/school_hr_leave.js';
import hrPayrollSetupRouter from './routes/school_hr_payroll_setup.js';
import hrPayrollRunRouter from './routes/school_hr_payroll_run.js';
import hrAdvancesRouter from './routes/school_hr_advances.js';
import hrReportsRouter from './routes/school_hr_reports.js';
import { invRouter } from './routes/school_inventory.js';
import { transRouter } from './routes/school_transport.js';
import { hostelRouter } from './routes/school_hostel.js';
import { libraryRouter } from './routes/school_library.js';
import { canteenRouter } from './routes/school_canteen.js';
import { frontofficeRouter } from './routes/school_frontoffice.js';
import { communicationRouter } from './routes/school_communication.js';
import { lmsRouter } from './routes/school_lms.js';
import { eventsRouter } from './routes/school_events.js';
import { certificatesRouter } from './routes/school_certificates.js';
import { alumniRouter } from './routes/school_alumni.js';
import { reportsRouter } from './routes/school_reports.js';
import { automationRouter } from './routes/school_automation.js';
import { importRouter } from './routes/school_import.js';
import './routes/school_students_complete.js';
import './routes/school_admissions.js';
import './routes/school_uploads.js';
import './routes/school_academics.js';
import './routes/school_more.js';
import { flushLogsSync } from './logging/sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
validateProductionEnv();
const app = express();
const isDev = env.NODE_ENV !== 'production';

if (!isDev) app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
const sharedCompression = compression();
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  sharedCompression(req, res, next);
});

const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', globalLimiter);

const loginLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
  max: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

const allowedOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/* Per-request context. MUST be mounted before the routers: verifyToken fills
   store.company from the token, and getPool() reads it to pick the company's
   database. Without this middleware als.getStore() is undefined, the company
   silently falls back to the default, and every authenticated request is
   served from the default company's database regardless of who logged in.
   It reads req.body, so it has to come after the body parsers. */
app.use(contextMiddleware);

/* Timing header. It can only be set while the headers are still open, and
   the duration is not known until the response is done -- so inject it in
   writeHead rather than on 'finish', which fires after the flush. */
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const t0 = process.hrtime.bigint();
  const writeHead = res.writeHead;
  res.writeHead = function (...args) {
    if (!res.headersSent) {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      res.setHeader('X-Server-Ms', ms.toFixed(1));
    }
    return writeHead.apply(this, args);
  };
  next();
});

app.use(express.static(isDev ? path.join(__dirname, '../../public') : path.join(__dirname, '../../dist'), {
  maxAge: isDev ? 0 : '1y',
  immutable: !isDev,
  index: false,
}));
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api/crud', crudRouter);
app.use('/api/schema', schemaRouter);
app.use('/api/form-config', schemaRouter);
app.use('/api', menuRouter);
app.use('/api', dashRouter);
app.use('/api', logsRouter);
app.use('/api/security', securityRouter);
app.use('/api/customfields', customFieldRouter);
app.use('/api/school', schoolFoundationRouter);
app.use('/api/school', schoolRouter);
/* Inventory/Transport modules own these paths; mount before the legacy
   comprehensive router so their richer handlers are not shadowed. */
app.use('/api/school', invRouter);
app.use('/api/school', transRouter);
app.use('/api/school', hostelRouter);
app.use('/api/school', libraryRouter);
app.use('/api/school', canteenRouter);
app.use('/api/school', frontofficeRouter);
app.use('/api/school', communicationRouter);
app.use('/api/school', lmsRouter);
app.use('/api/school', eventsRouter);
app.use('/api/school', certificatesRouter);
app.use('/api/school', alumniRouter);
app.use('/api/school/reports', reportsRouter);
app.use('/api/school/automation', automationRouter);
app.use('/api/school/import', importRouter);
app.use('/api/school', schoolCompRouter);
app.use('/api/school', schoolExamRouter);
app.use('/api/school', schoolFeeRouter);
app.use('/api/school', schoolFeeOpsRouter);
app.use('/api/school', hrStaffRouter);
app.use('/api/school', hrLeaveRouter);
app.use('/api/school', hrPayrollSetupRouter);
app.use('/api/school', hrPayrollRunRouter);
app.use('/api/school', hrAdvancesRouter);
app.use('/api/school', hrReportsRouter);

app.get('/api/healthz', async (_req, res) => {
  try {
    await ping();
    res.json({ ok: true, db: 'up', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false, db: 'down' });
  }
});
app.get('/api/readyz', async (_req, res) => {
  try {
    await ping();
    res.json({ ok: true, ready: true });
  } catch {
    res.status(503).json({ ok: false, ready: false });
  }
});
app.get('/api/env', (_req, res) => res.json({ dev: isDev }));

/* ---------- fallback SPA + error handling ---------- */
if (!isDev) {
  app.get('*', (req, res) => {
    if (req.path.match(/\.\w{2,4}$/)) return res.status(404).send('Not found');
    res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
  });
}

app.use(errorHandler);

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err?.stack || err));
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err?.stack || err);
  process.exit(1);
});
process.on('exit', flushLogsSync);

const PORT = env.PORT;
let httpServer;
let shuttingDown = false;
const requested = parseInt(process.env.CLUSTER_WORKERS, 10);
let numWorkers = 0;
if (requested === undefined || Number.isNaN(requested)) numWorkers = 0;   // single process default is fine on LAN
else if (requested === 0) numWorkers = os.cpus().length || 1;             // 0 = max cores
else numWorkers = requested;                                              // N = fixed workers

if (numWorkers > 1 && cluster.isPrimary) {
  console.log(`pg-xerp primary starting ${numWorkers} workers on :${PORT}`);
  for (let i = 0; i < numWorkers; i++) cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    console.error(`worker ${worker.process.pid} died (${signal || code}), respawning`);
    cluster.fork();
  });
} else {
  httpServer = app.listen(PORT, () => {
    console.log(`pg-xerp server running on http://localhost:${PORT} [${isDev ? 'dev' : 'production'}]${numWorkers > 1 ? ` worker ${process.pid}` : ''}`);
    ping().then(() => console.log('PostgreSQL connected'))
      .catch((err) => console.error('DB connection failed (will retry on first request):', err.message));
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] received ${signal}`);
  const close = httpServer
    ? new Promise((resolve) => httpServer.close(resolve))
    : Promise.resolve();
  await Promise.race([
    Promise.all([close, closeAllPools()]),
    new Promise((resolve) => setTimeout(resolve, 10_000)),
  ]);
  process.exit(0);
}

process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });