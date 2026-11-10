import { Readable } from 'node:stream';
import { schoolRouter } from './school.js';
import { getPool } from '../db/pool.js';
import { uploadContextFromRequest, uploadForRequest } from '../uploads/middleware.js';
import {
  getStoredFile,
  removeStagingFile,
  storeUpload,
  UploadValidationError,
  UPLOAD_CONTEXTS,
  validCompanyKey,
  validUploadContext,
} from '../uploads/service.js';

const userIdOf = (req) => req.user?.company || '';
const isAllowed = (req, permission) => {
  const access = req.school;
  return access?.isSuper || access?.permissions?.includes('*') || access?.permissions?.includes(permission);
};

schoolRouter.post('/uploads', (req, res, next) => {
  const context = uploadContextFromRequest(req);
  if (!validUploadContext(context)) return res.status(400).json({ error: 'Invalid upload context' });
  if (!isAllowed(req, UPLOAD_CONTEXTS[context].permission)) {
    return res.status(403).json({ error: 'You do not have permission to upload this file type' });
  }
  const parser = uploadForRequest(req);
  if (!parser) return res.status(400).json({ error: 'Invalid upload context' });
  parser(req, res, async (parseError) => {
    if (parseError) {
      const status = parseError.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: parseError.message || 'Invalid upload' });
    }
    if (!req.file) return res.status(400).json({ error: 'A file is required' });
    let result;
    let failure;
    try {
      result = await storeUpload(req.file, userIdOf(req), context);
    } catch (error) {
      failure = error;
    }
    try {
      await removeStagingFile(req.file);
    } catch (error) {
      failure ||= error;
    }
    if (failure instanceof UploadValidationError) return res.status(failure.statusCode).json({ error: failure.message });
    if (failure) return next(failure);
    return res.status(201).json({ ok: true, upload: result });
  });
});

schoolRouter.get('/uploads/:appId/:year/:context/:fileName', async (req, res, next) => {
  const { appId, year, context, fileName } = req.params;
  if (!validCompanyKey(appId) || !validUploadContext(context)) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (appId !== userIdOf(req)) return res.status(404).json({ error: 'File not found' });
  try {
    let canView = isAllowed(req, UPLOAD_CONTEXTS[context].viewPermission);
    if (!canView && context === 'application-photo' && isAllowed(req, 'students.view')) {
      const linkedPhoto = await getPool().query(
        `SELECT 1 FROM school_students
          WHERE app_id=$1 AND photo_url=$2 AND deleted_at IS NULL
          LIMIT 1`,
        [appId, `/api/school/uploads/${appId}/${year}/${context}/${fileName}`],
      );
      canView = Boolean(linkedPhoto.rows[0]);
    }
    if (!canView) return res.status(403).json({ error: 'You do not have permission to access this file' });
    const stored = await getStoredFile(appId, year, context, fileName);
    if (!stored) return res.status(404).json({ error: 'File not found' });
    const extension = fileName.split('.').at(-1)?.toLowerCase();
    const mimeType = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      mp4: 'video/mp4',
    }[extension] || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    if (stored.size) res.setHeader('Content-Length', stored.size);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (stored.remote) {
      if (!stored.body) throw new Error('File storage returned an empty body');
      Readable.fromWeb(stored.body)
        .on('error', (error) => {
          if (!res.headersSent) next(error);
          else res.destroy(error);
        })
        .pipe(res);
      return;
    }

    res.sendFile(stored.filePath, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
});
