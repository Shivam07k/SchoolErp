import React from 'react';
import { toast } from '../../../toast';

export const today = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (value) => {
  if (!value) return 'Ã¢â‚¬â€';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('en-IN');
};

export const fmtTime = (value) => {
  if (!value) return 'Ã¢â‚¬â€';
  return String(value).slice(0, 5);
};

export const fmtDateTime = (value) => {
  if (!value) return 'Ã¢â‚¬â€';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export const moneyOrDash = (value) => (value === null || value === undefined || value === '' ? 'Ã¢â‚¬â€' : value);

export function canManage(me, permission = 'exam.manage') {
  return Boolean(me?.isSuper || me?.permissions?.includes('*') || me?.permissions?.includes(permission));
}

export function canView(me, permission = 'exam.view') {
  return Boolean(me?.isSuper || me?.permissions?.includes('*') || me?.permissions?.includes(permission));
}

export const examStatusTone = (status) => ({
  draft: 'secondary',
  scheduled: 'info',
  marks_entry_open: 'primary',
  marks_locked: 'warning',
  processed: 'info',
  published: 'success',
  frozen: 'dark',
}[status] || 'secondary');

export const marksSheetTone = (state) => ({
  not_started: 'secondary',
  draft: 'secondary',
  submitted: 'info',
  verified: 'primary',
  locked: 'success',
  reopened: 'warning',
}[state] || 'secondary');

export const statusCodeTone = (code) => ({
  AB: 'danger',
  EX: 'info',
  ML: 'warning',
  UFM: 'dark',
  WH: 'secondary',
}[code] || 'success');

export const outcomeTone = (outcome) => ({
  pass: 'success',
  fail: 'danger',
  compartment: 'warning',
  withheld: 'secondary',
  incomplete: 'info',
  promoted: 'success',
  detained: 'danger',
  conditional: 'warning',
}[outcome] || 'secondary');

export function PageShell({ title, icon, subtitle, backPath, onNavigate, actions, children }) {
  return (
    <div className="page-content animate-fade">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div>
            <div className="card-title mb-0"><i className={`bi ${icon} me-2`}></i>{title}</div>
            {subtitle && <div className="text-muted small mt-1">{subtitle}</div>}
          </div>
          <div className="d-flex gap-2 flex-wrap">
            {actions}
            {backPath && onNavigate && (
              <button className="btn btn-sm btn-outline-secondary no-print" type="button" onClick={() => onNavigate(backPath)}>
                <i className="bi bi-arrow-left me-1"></i>Back
              </button>
            )}
          </div>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

export const Empty = ({ icon = 'bi-inbox', text = 'No data available' }) => (
  <div className="text-center py-5">
    <i className={`bi ${icon} d-block mb-2 text-muted`} style={{ fontSize: 30 }}></i>
    <p className="text-muted mb-0">{text}</p>
  </div>
);

export const Loading = ({ text = 'LoadingÃ¢â‚¬Â¦' }) => (
  <div className="text-center py-4">
    <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
    <div className="small text-muted mt-2">{text}</div>
  </div>
);

export const ErrorBox = ({ message, onRetry }) => message ? (
  <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center">
    <div><i className="bi bi-exclamation-triangle me-2"></i>{message}</div>
    {onRetry && <button className="btn btn-sm btn-outline-danger" onClick={onRetry}>Retry</button>}
  </div>
) : null;

export const Badge = ({ tone = 'secondary', children }) => (
  <span className={`badge bg-${tone}`}>{children}</span>
);

export function downloadCsv(filename, headers, rows) {
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/"/g, '""');
    return /[",\n]/.test(text) ? `"${text}"` : text;
  };
  const body = [
    headers.map((h) => escape(h.label)).join(','),
    ...rows.map((row) => headers.map((h) => escape(typeof h.value === 'function' ? h.value(row) : row[h.key])).join(',')),
  ].join('\r\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};
