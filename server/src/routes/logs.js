import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyToken } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.join(__dirname, '../../logs');

export const logsRouter = Router();

const SAFE = /^[A-Za-z0-9_.-]+$/;
const companyPrefix = (req) => `${String(req.user?.company || '').replace(/[^A-Za-z0-9_.-]/g, '')}_`;

function isCompanyFile(req, file) {
  return SAFE.test(file) && companyPrefix(req) !== '_' && file.startsWith(companyPrefix(req));
}

logsRouter.get('/logs/list', verifyToken, (req, res) => {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    const files = fs.readdirSync(LOGS_DIR)
      .filter((f) => isCompanyFile(req, f))
      .map((f) => {
        const st = fs.statSync(path.join(LOGS_DIR, f));
        return { name: f, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json(files);
  } catch (e) {
    res.json([]);
  }
});

logsRouter.get('/logs/json', verifyToken, (req, res) => {
  const { file, tail, limit, q } = req.query;
  if (!file || !isCompanyFile(req, String(file))) return res.status(404).json({ error: 'Log not found' });
  try {
    const fp = path.join(LOGS_DIR, String(file));
    let lines = fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean);
    if (tail === '1') lines = lines.slice(-500);
    const max = Math.min(parseInt(limit || 300, 10) || 300, 2000);
    if (q) {
      const needle = String(q).toLowerCase();
      lines = lines.filter((l) => l.toLowerCase().includes(needle));
    }
    const items = lines.slice(-max).map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } });
    res.json({ items });
  } catch (e) {
    res.json({ items: [] });
  }
});
