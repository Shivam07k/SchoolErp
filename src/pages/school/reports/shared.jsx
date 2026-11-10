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
    male: 'primary', female: 'danger', other: 'secondary',
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

export function ReportFilters({ onSearch, onExport, classOptions = [], sectionOptions = [], dateFrom, dateTo, onDateFromChange, onDateToChange, classId, sectionId, onClassChange, onSectionChange, showFilters = true }) {
  if (!showFilters) return null;
  return (
    <div className="card mb-3">
      <div className="card-body">
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label small">Class</label>
            <select className="form-select form-select-sm" value={classId || ''} onChange={onClassChange}>
              <option value="">All Classes</option>
              {classOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small">Section</label>
            <select className="form-select form-select-sm" value={sectionId || ''} onChange={onSectionChange} disabled={!sectionOptions.length}>
              <option value="">All Sections</option>
              {sectionOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small">From Date</label>
            <input type="date" className="form-control form-control-sm" value={dateFrom || ''} onChange={onDateFromChange} />
          </div>
          <div className="col-md-2">
            <label className="form-label small">To Date</label>
            <input type="date" className="form-control form-control-sm" value={dateTo || ''} onChange={onDateToChange} />
          </div>
          <div className="col-md-2">
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={() => onSearch?.()}><i className="bi bi-search"></i> Search</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={onExport}><i className="bi bi-download"></i> Export</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}