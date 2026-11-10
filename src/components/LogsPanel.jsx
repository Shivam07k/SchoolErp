import React, { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../api';
import { toast } from '../toast';

const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B';

export default function LogsPanel({ open, onClose }) {
  const [files, setFiles] = useState([]);
  const [file, setFile] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!open) return;
    apiGet('/logs/list').then(f => {
      setFiles(f);
      setFile(prev => (f.find(x => x.name === prev) ? prev : (f[0]?.name || '')));
    }).catch(() => toast('Failed to load log list', 'error'));
  }, [open]);

  const load = useCallback(() => {
    if (!file) return;
    setLoading(true);
    apiGet(`/logs/json?file=${encodeURIComponent(file)}&tail=1&limit=300&q=${encodeURIComponent(q)}`)
      .then(r => { setItems(r.items || []); setLoading(false); })
      .catch(() => { setItems([]); setLoading(false); toast('Failed to read log', 'error'); });
  }, [file, q]);

  useEffect(() => { if (open) load(); }, [open, load]);

  if (!open) return null;

  const actionColor = a => ({ _SAVE: 'green', _UPDATE: 'blue', _DELETE: 'red', _LOCK: 'amber', _SEARCH_JSON: 'gray', _EDIT_JSON: 'cyan', _BOOT: 'gray' }[a] || 'gray');

  const copyEntry = async (it) => {
    const text = [it.action, it.formId, it.ts, it.sql].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard', 'success');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      toast('Copied to clipboard', 'success');
    }
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="logs-panel animate-slide-left">
        <div className="lp-head">
          <span><i className="bi bi-journal-text me-2"></i>Activity Logs</span>
          <div className="d-flex gap-2">
            <button className="btn-row" title="Refresh" onClick={load}><i className="bi bi-arrow-clockwise"></i></button>
            <button className="btn-row" onClick={onClose}><i className="bi bi-x-lg"></i></button>
          </div>
        </div>

        <div className="lp-controls">
          <select className="form-select form-select-sm" value={file} onChange={e => setFile(e.target.value)}>
            {files.map(f => (
              <option key={f.name} value={f.name}>{f.name} ({fmtSize(f.size)})</option>
            ))}
          </select>
          <div className="lp-search">
            <i className="bi bi-search"></i>
            <input placeholder="Filter entries…" value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') load(); }} />
            {q && <button onClick={() => { setQ(''); }}><i className="bi bi-x"></i></button>}
          </div>
        </div>

        <div className="lp-list">
          {loading && <div className="text-center py-4"><span className="spinner-border spinner-border-sm"></span></div>}
          {!loading && items.length === 0 && (
            <div className="empty-state"><i className="bi bi-inbox"></i><p>No log entries</p></div>
          )}
          {!loading && items.slice().reverse().map((it, i) => (
            <div key={i} className={`lp-entry ${expanded === i ? 'open' : ''}`} onClick={() => setExpanded(expanded === i ? null : i)}>
              <div className="lp-entry-top">
                <span className={`lp-badge b-${actionColor(it.action)}`}>{it.action}</span>
                {it.formId && <span className="lp-form">{it.formId}</span>}
                <span className="lp-ts">{(it.ts || '').replace('T', ' ').slice(0, 19)}</span>
                <button className="btn-row lp-copy" title="Copy this entry"
                  onClick={e => { e.stopPropagation(); copyEntry(it); }}><i className="bi bi-clipboard"></i></button>
              </div>
              {it.sql && <pre className={`lp-sql ${expanded === i ? 'open' : ''}`}>{it.sql}</pre>}
            </div>
          ))}
        </div>

        <div className="lp-foot">{items.length} entries{q ? ` matching "${q}"` : ''} (newest first)</div>
      </div>
    </>
  );
}
