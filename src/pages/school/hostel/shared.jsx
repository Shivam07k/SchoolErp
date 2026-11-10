import React from 'react';
import { today, fmtDate, fmtDateTime, fmtTime, moneyOrDash, Empty, Loading, Badge, PageShell, ErrorBox, downloadCsv } from '../fee/shared';

export { today, fmtDate, fmtDateTime, fmtTime, moneyOrDash, Empty, Loading, Badge, PageShell, ErrorBox, downloadCsv };

/* ---- permissions ---- */
export function canHostelView(me, permission = 'hostel.view') {
  const perms = me?.permissions || [];
  return Boolean(
    me?.isSuper || perms.includes('*') || perms.includes(permission)
    || perms.includes('hostel.view') || perms.includes('hostel.manage'),
  );
}

export function canHostelManage(me, permission = 'hostel.manage') {
  const perms = me?.permissions || [];
  return Boolean(me?.isSuper || perms.includes('*') || perms.includes(permission) || perms.includes('hostel.manage'));
}

/* ---- formatting ---- */
export const studentName = (row) => [row?.first_name, row?.last_name].filter(Boolean).join(' ') || row?.name || 'Ã¢â‚¬â€';

export const money = (value) => {
  if (value === null || value === undefined || value === '') return 'Ã¢â‚¬â€';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `Ã¢â€šÂ¹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

export const monthStart = (date = new Date()) => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  return d.toISOString().slice(0, 10);
};

export const monthEnd = (date = new Date()) => {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
};

export const ROOM_STATUS_TONE = {
  available: 'success', occupied: 'primary', full: 'danger', maintenance: 'warning', closed: 'secondary',
};
export const BED_STATUS_TONE = {
  vacant: 'success', occupied: 'danger', reserved: 'warning', maintenance: 'secondary',
};
export const ALLOCATION_TONE = {
  active: 'success', reserved: 'warning', changed: 'info', vacated: 'secondary', cancelled: 'secondary',
};
export const LEAVE_TONE = {
  requested: 'warning', guardian_approved: 'info', approved: 'primary', out: 'primary',
  returned: 'success', overdue: 'danger', rejected: 'danger', cancelled: 'secondary',
};
export const VISIT_TONE = {
  pre_registered: 'warning', approved: 'info', checked_in: 'primary', checked_out: 'success',
  denied: 'danger', cancelled: 'secondary',
};
export const ROLLCALL_STATUS_TONE = {
  present: 'success', absent: 'danger', on_leave: 'info', sick_bay: 'warning', late: 'warning',
};

export const statusBadge = (toneMap, value, label) => (
  <Badge tone={toneMap[value] || 'secondary'}>{label || String(value || 'Ã¢â‚¬â€').replace(/_/g, ' ')}</Badge>
);

/* ---- layout helpers ---- */
export const Tabs = ({ tabs, active, onChange }) => (
  <ul className="nav nav-pills nav-pills-sm mb-3 flex-wrap gap-1">
    {tabs.map(([key, label, icon]) => (
      <li className="nav-item" key={key}>
        <button
          type="button"
          className={`nav-link py-1 px-3 ${active === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
        >
          {icon && <i className={`bi ${icon} me-1`}></i>}{label}
        </button>
      </li>
    ))}
  </ul>
);

export const Kpi = ({ label, value, tone = 'primary', icon = 'bi-bar-chart' }) => (
  <div className="card h-100">
    <div className="card-body py-3 d-flex align-items-center gap-3">
      <span className={`bg-${tone} bg-opacity-10 text-${tone} rounded-3 d-flex align-items-center justify-content-center`} style={{ width: 40, height: 40 }}>
        <i className={`bi ${icon}`}></i>
      </span>
      <div>
        <div className="fs-5 fw-bold lh-1">{value ?? 0}</div>
        <div className="small text-muted">{label}</div>
      </div>
    </div>
  </div>
);

export const Modal = ({ title, children, onClose, footer, size = 'lg' }) => (
  <div className="modal d-block" style={{ background: 'rgba(15,23,42,.45)', zIndex: 1080 }} onMouseDown={onClose}>
    <div className={`modal-dialog modal-dialog-centered modal-${size}`} onMouseDown={(e) => e.stopPropagation()}>
      <div className="modal-content">
        <div className="modal-header py-2">
          <h6 className="modal-title">{title}</h6>
          <button type="button" className="btn-close" onClick={onClose}></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer py-2">{footer}</div>}
      </div>
    </div>
  </div>
);

export const Placeholder = ({ me, title, icon = 'bi-cone-striped', text }) => (
  <PageShell title={title} icon={icon} subtitle="Hostel & Residential Life">
    <div className="text-center py-5">
      <i className={`bi ${icon} d-block mb-2 text-muted`} style={{ fontSize: 34 }}></i>
      <h6 className="fw-bold">{title} is being prepared</h6>
      <p className="text-muted small mb-0">{text || 'This screen is part of the Hostel module and will appear here.'}</p>
    </div>
  </PageShell>
);

export function useAsync(loader, deps = []) {
  const [state, setState] = React.useState({ loading: true, error: '', data: null });
  const run = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await loader();
      setState({ loading: false, error: '', data });
    } catch (e) {
      setState({ loading: false, error: e.message || 'Failed to load', data: null });
    }
  }, deps);
  React.useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}

