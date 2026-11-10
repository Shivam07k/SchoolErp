import React from 'react';

/* Attendance screens reuse the same shell and primitives as the rest of the
   school module so navigation, loading and error states stay consistent. */
export {
  Badge,
  Empty,
  ErrorBox,
  Loading,
  PageShell,
  StatusBadge,
  canManage,
  canView,
  fmtDate,
  fmtTime,
  perform,
  today,
} from '../timetable/shared';

export const canMark = (me) => Boolean(
  me?.isSuper || me?.permissions?.includes('*') || me?.permissions?.includes('attendance.manage'),
);

export const fmtDateTime = (value) => {
  if (!value) return 'Ã¢â‚¬â€';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export const timeOf = (value) => {
  if (!value) return 'Ã¢â‚¬â€';
  const raw = String(value);
  if (raw.includes('T')) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  }
  return raw.slice(0, 5);
};

export const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const categoryTone = (category) => ({
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'info',
  activity: 'primary',
  partial: 'secondary',
}[category] || 'secondary');

export const stateTone = (state) => ({
  draft: 'secondary',
  submitted: 'info',
  finalized: 'success',
  reopened: 'warning',
  cancelled: 'danger',
}[state] || 'secondary');

export const decisionTone = (decision) => ({
  approved: 'success',
  rejected: 'danger',
  pending: 'warning',
}[decision] || 'secondary');

export const sectionsFor = (classes, classId) => (
  classes.find((c) => String(c.id) === String(classId))?.sections || []
);

export const activePolicies = (policies) => (policies || []).filter((p) => p.is_active !== false);

export function policyByCode(policies, code) {
  return (policies || []).find((p) => p.code === code);
}

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

