export function PageShell({ title, icon, subtitle, backPath, onNavigate, actions, children }) {
  return (
    <div className="school-page animate-fade">
      <div className="school-page-header">
        <div className="d-flex align-items-center gap-3">
          <div className="school-page-icon"><i className={`bi ${icon}`}></i></div>
          <div>
            <h5 className="mb-0">{title}</h5>
            {subtitle && <small className="text-muted">{subtitle}</small>}
          </div>
        </div>
        <div className="school-page-actions">{actions}</div>
      </div>
      <div className="school-page-body">{children}</div>
    </div>
  );
}

export function Empty({ icon = 'bi-inbox', text = 'Nothing here yet' }) {
  return (
    <div className="school-empty">
      <i className={`bi ${icon}`}></i>
      <span>{text}</span>
    </div>
  );
}

export function Loading() {
  return (
    <div className="school-loading">
      <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
    </div>
  );
}

export function Badge({ status, children }) {
  const tones = {
    active: 'success', inactive: 'secondary', pending: 'warning', processing: 'info',
    sent: 'success', failed: 'danger', delivered: 'info', read: 'success',
    draft: 'secondary', published: 'success', queued: 'info', partial: 'warning',
    paid: 'success', unpaid: 'danger', overdue: 'danger', due_soon: 'warning',
    high: 'danger', urgent: 'danger', normal: 'info', low: 'secondary',
    true: 'success', false: 'secondary', running: 'info', completed: 'success',
  };
  const tone = tones[status] || 'secondary';
  return <span className={`badge bg-${tone}-subtle text-${tone}`}>{children}</span>;
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="alert alert-danger d-flex align-items-center gap-2">
      <i className="bi bi-exclamation-triangle"></i>
      <div className="flex-grow-1">{message}</div>
      {onRetry && <button className="btn btn-sm btn-outline-danger" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function downloadCsv(rows, filename) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => {
    const v = r[h];
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename || 'export.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—');
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('en-IN') : '—');
export const moneyOrDash = (v) => (v === null || v === undefined || v === '' ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(v)));
export const today = () => new Date().toISOString().slice(0, 10);

export const EVENT_TYPES = [
  { value: 'fee.due_soon', label: 'Fee Due Soon', description: 'Trigger N days before fee due date' },
  { value: 'fee.overdue', label: 'Fee Overdue', description: 'Trigger N days after fee due date' },
  { value: 'attendance.absent', label: 'Student Absent', description: 'Trigger when student marked absent' },
  { value: 'attendance.late', label: 'Student Late', description: 'Trigger when student marked late' },
  { value: 'student.birthday', label: 'Student Birthday', description: 'Trigger on student birthday' },
  { value: 'schedule.daily', label: 'Daily Schedule', description: 'Run once daily at specified time' },
  { value: 'schedule.weekly', label: 'Weekly Schedule', description: 'Run weekly on specified day/time' },
  { value: 'manual', label: 'Manual Only', description: 'Only triggered manually' },
];

export const CHANNELS = [
  { value: 'sms', label: 'SMS', icon: 'bi-chat-left-text' },
  { value: 'email', label: 'Email', icon: 'bi-envelope' },
  { value: 'push', label: 'Push', icon: 'bi-bell' },
  { value: 'in_app', label: 'In-App', icon: 'bi-app' },
  { value: 'webhook', label: 'Webhook', icon: 'bi-box-arrow-up-right' },
];