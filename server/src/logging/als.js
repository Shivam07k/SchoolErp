import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

export const als = new AsyncLocalStorage();

export function contextMiddleware(req, res, next) {
  const requestId = crypto.randomUUID();
  const store = {
    requestId,
    appId: req.headers['appid'] || (req.body && req.body.appId) || '',
    company: '',
    userId: '',
  };
  req.requestId = requestId;
  als.run(store, () => next());
}