import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { env } from '../config/env.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
export const PRIVATE_UPLOAD_ROOT = path.resolve(directory, '../../uploads/private');

/* Local disk works for development and for a Render instance with a persistent
   disk. Render's default filesystem is ephemeral, so production can instead
   store uploads in a private Supabase Storage bucket. */
const storage = env.STORAGE;
export const storageEnabled = Boolean(storage.url && storage.serviceKey && storage.bucket);
const storageObjectUrl = (key) => `${storage.url}/storage/v1/object/${storage.bucket}/${key}`;
const storageHeaders = () => ({ Authorization: `Bearer ${storage.serviceKey}` });

export class UploadValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UploadValidationError';
    this.statusCode = 400;
  }
}

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const documentTypes = ['application/pdf', ...imageTypes];
export const UPLOAD_CONTEXTS = {
  photo: { maxBytes: 2 * 1024 * 1024, types: imageTypes, permission: 'students.manage', viewPermission: 'students.view' },
  signature: { maxBytes: 1024 * 1024, types: imageTypes, permission: 'students.manage', viewPermission: 'students.view' },
  application: { maxBytes: 5 * 1024 * 1024, types: documentTypes, permission: 'admission.manage', viewPermission: 'admission.view' },
  'application-photo': { maxBytes: 2 * 1024 * 1024, types: imageTypes, permission: 'admission.manage', viewPermission: 'admission.view' },
  'application-signature': { maxBytes: 1024 * 1024, types: imageTypes, permission: 'admission.manage', viewPermission: 'admission.view' },
  document: { maxBytes: 20 * 1024 * 1024, types: documentTypes, permission: 'students.manage', viewPermission: 'students.view' },
  health: { maxBytes: 20 * 1024 * 1024, types: documentTypes, permission: 'health.manage', viewPermission: 'health.view' },
  discipline: { maxBytes: 20 * 1024 * 1024, types: documentTypes, permission: 'discipline.manage', viewPermission: 'discipline.view' },
  video: { maxBytes: 50 * 1024 * 1024, types: ['video/mp4'], permission: 'discipline.manage', viewPermission: 'discipline.view' },
};

const extensionFor = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['video/mp4', 'mp4'],
]);

export function validUploadContext(context) {
  return Object.hasOwn(UPLOAD_CONTEXTS, context);
}

export function validCompanyKey(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

export async function storeUpload(file, appId, context) {
  if (!file?.path || !validCompanyKey(appId) || !validUploadContext(context)) {
    throw new UploadValidationError('Invalid upload request');
  }
  const policy = UPLOAD_CONTEXTS[context];
  if (file.size > policy.maxBytes) throw new UploadValidationError('File exceeds the upload limit for this context');

  const source = await readFile(file.path);
  const detected = await fileTypeFromBuffer(source);
  if (!detected || !policy.types.includes(detected.mime) || detected.mime !== file.mimetype) {
    throw new UploadValidationError('File content does not match an allowed file type');
  }

  let content = source;
  let mimeType = detected.mime;
  if (detected.mime.startsWith('image/')) {
    try {
      content = await sharp(source, { limitInputPixels: 40_000_000 })
        .rotate()
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
    } catch (error) {
      throw new UploadValidationError(`Image could not be processed: ${error.message}`);
    }
    mimeType = 'image/jpeg';
  }

  const year = String(new Date().getFullYear());
  const fileName = `${randomUUID()}.${extensionFor.get(mimeType)}`;
  const key = `${appId}/${year}/${context}/${fileName}`;

  if (storageEnabled) {
    const response = await fetch(storageObjectUrl(key), {
      method: 'POST',
      headers: {
        ...storageHeaders(),
        'Content-Type': mimeType,
        'x-upsert': 'false',
      },
      body: content,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new UploadValidationError(`File storage failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ''}`);
    }
    return {
      storageKey: key,
      fileUrl: `/api/school/uploads/${key}`,
      fileName: path.basename(file.originalname || 'upload'),
      mimeType,
      fileSize: content.length,
      remote: true,
    };
  }

  const destination = path.resolve(PRIVATE_UPLOAD_ROOT, appId, year, context, fileName);
  if (!destination.startsWith(`${PRIVATE_UPLOAD_ROOT}${path.sep}`)) {
    throw new UploadValidationError('Invalid upload destination');
  }

  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp`;
  try {
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch((cleanupError) => {
      if (cleanupError.code !== 'ENOENT') throw cleanupError;
    });
    throw error;
  }

  const stored = await stat(destination);
  return {
    storageKey: key,
    fileUrl: `/api/school/uploads/${key}`,
    fileName: path.basename(file.originalname || 'upload'),
    mimeType,
    fileSize: stored.size,
  };
}

export async function removeStagingFile(file) {
  if (!file?.path) return;
  await unlink(file.path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

function validStoredKey(appId, year, context, fileName) {
  if (!validCompanyKey(appId) || !/^\d{4}$/.test(year) || !validUploadContext(context)) return false;
  return /^[0-9a-f-]{36}\.(pdf|jpg|png|webp|mp4)$/i.test(fileName);
}

export function resolveStoredPath(appId, year, context, fileName) {
  if (!validStoredKey(appId, year, context, fileName)) return null;
  const filePath = path.resolve(PRIVATE_UPLOAD_ROOT, appId, year, context, fileName);
  if (!filePath.startsWith(`${PRIVATE_UPLOAD_ROOT}${path.sep}`)) return null;
  return filePath;
}

export async function getStoredFile(appId, year, context, fileName) {
  if (!validStoredKey(appId, year, context, fileName)) return null;

  if (storageEnabled) {
    const key = `${appId}/${year}/${context}/${fileName}`;
    const response = await fetch(storageObjectUrl(key), { headers: storageHeaders() });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`File storage download failed (${response.status})`);
    return {
      remote: true,
      body: response.body,
      size: Number(response.headers.get('content-length') || 0),
    };
  }

  const filePath = resolveStoredPath(appId, year, context, fileName);
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return null;
    return { filePath, size: fileStat.size };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
