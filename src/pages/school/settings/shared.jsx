import React from 'react';

export function PageShell({ title, icon, subtitle, backPath, onNavigate, actions, children }) {
  return (
    <div className="page-content animate-fade">
      <header className="school-head mb-3">
        <div>
          <h4 className="mb-0"><i className={`bi ${icon || 'bi-chat-dots'} me-2`}></i>{title}</h4>
          {subtitle && <p className="school-muted mb-0">{subtitle}</p>}
        </div>
        <div className="d-flex gap-2">
          {actions?.map((a, i) => (
            <button key={i} className={`btn btn-sm ${a.variant || 'btn-outline-secondary'}`} onClick={a.onClick}>
              {a.icon && <i className={`bi ${a.icon} me-1`}></i>}{a.label}
            </button>
          ))}
          {backPath && <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate?.(backPath)}>
            <i className="bi bi-arrow-left me-1"></i>Back
          </button>}
        </div>
      </header>
      {children}
    </div>
  );
}

export function Empty({ icon = 'bi-inbox', text = 'Nothing here yet' }) {
  return (
    <div className="school-empty text-center py-5">
      <i className={`bi ${icon}`} style={{ fontSize: 48 }}></i>
      <p className="mt-2 text-muted">{text}</p>
    </div>
  );
}

export function Loading() {
  return <div className="school-loading text-center py-5"><div className="spinner-border spinner-border-sm text-primary"></div> Loading…</div>;
}

export function Badge({ status, children }) {
  const tones = { active: 'success', inactive: 'secondary', pending: 'warning', approved: 'info', rejected: 'danger' };
  return <span className={`badge school-badge ${tones[status] || 'secondary'}`}>{children ?? status}</span>;
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="alert alert-danger">
      {message}
      {onRetry && <button className="btn btn-sm btn-outline-danger ms-2" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function downloadCsv(rows, filename) {
  if (!rows?.length) return;
  const header = Object.keys(rows[0]).join(',');
  const body = rows.map((r) => Object.values(r).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—');
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('en-IN') : '—');
export const moneyOrDash = (v) => (v === null || v === undefined || v === '' ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(v)));
export const today = () => new Date().toISOString().slice(0, 10);