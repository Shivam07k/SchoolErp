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

export const dayLabel = (day) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] || `Day ${day}`;
};

export const moneyOrDash = (value) => (value === null || value === undefined || value === '' ? 'Ã¢â‚¬â€' : value);

export function canManage(me, permission = 'timetable.manage') {
  return Boolean(me?.isSuper || me?.permissions?.includes('*') || me?.permissions?.includes(permission));
}

export function canView(me, permission = 'timetable.view') {
  return Boolean(me?.isSuper || me?.permissions?.includes('*') || me?.permissions?.includes(permission));
}

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
            {backPath && (
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate?.(backPath)}>
                <i className="bi bi-arrow-left me-1"></i>Timetable
              </button>
            )}
          </div>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon = 'bi-inbox', text = 'Nothing here yet' }) {
  return (
    <div className="text-center text-muted py-4">
      <i className={`bi ${icon} d-block mb-2`} style={{ fontSize: 26 }}></i>
      <span>{text}</span>
    </div>
  );
}

export function Loading({ text = 'LoadingÃ¢â‚¬Â¦' }) {
  return (
    <div className="d-flex align-items-center gap-2 text-muted py-4">
      <span className="spinner-border spinner-border-sm text-primary"></span>{text}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert alert-danger d-flex justify-content-between align-items-center py-2">
      <span><i className="bi bi-exclamation-triangle me-2"></i>{message}</span>
      {onRetry && <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Badge({ tone = 'secondary', children }) {
  return <span className={`badge bg-${tone}`}>{children}</span>;
}

export function StatusBadge({ active, labels = ['Active', 'Archived'] }) {
  return <Badge tone={active ? 'success' : 'secondary'}>{active ? labels[0] : labels[1]}</Badge>;
}

export function boolFromBody(body, key, fallback = true) {
  const value = body?.[key];
  if (value === undefined || value === null) return fallback;
  return value === true || value === 'true' || value === 1 || value === '1';
}

export async function perform(request, { success, refresh, onSuccess } = {}) {
  try {
    const result = await request();
    if (!result?.ok) throw new Error(result?.error || 'The request was rejected');
    if (success) toast(success, 'success');
    onSuccess?.(result);
    if (refresh) {
      try {
        await refresh();
      } catch (error) {
        toast(`${success || 'Saved'}, but the list could not be refreshed: ${error.message}`, 'warning');
      }
    }
    return result;
  } catch (error) {
    toast(error.message || 'Request failed', 'error');
    return null;
  }
}

export const DAYS = [
  { id: 0, label: 'Sunday' },
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
];

export const PERIOD_LABELS = [
  { id: 1, label: 'Period 1' },
  { id: 2, label: 'Period 2' },
  { id: 3, label: 'Period 3' },
  { id: 4, label: 'Period 4' },
  { id: 5, label: 'Period 5' },
  { id: 6, label: 'Period 6' },
  { id: 7, label: 'Period 7' },
  { id: 8, label: 'Period 8' },
];
