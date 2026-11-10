import { env } from '../config/env.js';

export function safeErrorMessage(err, fallback) {
  if (env.NODE_ENV === 'production') return fallback;
  return err?.message || fallback;
}

/* Uniform error trailing middleware — API always answers JSON,
   never a thrown stack. */
export function errorHandler(err, _req, res, _next) {
  console.error('[API ERROR]', err?.stack || err);
  const status = Number.isInteger(err?.status) ? err.status : 500;
  const safeMessage = status >= 500 ? safeErrorMessage(err, 'Internal server error') : (err?.message || 'Internal error');
  res.status(status).json({ error: safeMessage });
}