import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { PRIVATE_UPLOAD_ROOT, UPLOAD_CONTEXTS, validUploadContext } from './service.js';

const staging = path.join(PRIVATE_UPLOAD_ROOT, '.staging');
mkdirSync(staging, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, staging),
  filename: (_req, _file, callback) => callback(null, `${randomUUID()}.upload`),
});

export function uploadForRequest(req) {
  const context = String(req.get('x-upload-context') || req.query.context || 'document');
  if (!validUploadContext(context)) return null;
  return multer({
    storage,
    limits: { fileSize: UPLOAD_CONTEXTS[context].maxBytes, files: 1 },
  }).single('file');
}

export function uploadContextFromRequest(req) {
  return String(req.get('x-upload-context') || req.query.context || 'document');
}
