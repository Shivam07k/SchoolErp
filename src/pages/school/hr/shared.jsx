import React from 'react';
import { PageShell, Empty, Loading, ErrorBox, Badge, downloadCsv, fmtDate, moneyOrDash } from '../fee/shared';

export { PageShell, Empty, Loading, ErrorBox, Badge, downloadCsv, fmtDate, moneyOrDash };

export function canManageHR(me, permission = 'hr.manage') {
  const perms = me?.permissions || [];
  return Boolean(me?.isSuper || perms.includes('*') || perms.includes(permission));
}

export function canViewHR(me, permission = 'hr.view') {
  const perms = me?.permissions || [];
  return Boolean(me?.isSuper || perms.includes('*') || perms.includes(permission));
}

export const LEAVE_STATUS_TONE = { pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'secondary', taken: 'info' };
export const ADVANCE_STATUS_TONE = { requested: 'warning', approved: 'info', rejected: 'danger', disbursed: 'primary', recovering: 'warning', closed: 'success', written_off: 'dark' };
export const PAYROLL_STATUS_TONE = { draft: 'secondary', computed: 'info', previewed: 'primary', approved: 'warning', locked: 'success', paid: 'success', posted: 'success', cancelled: 'danger' };

export const Placeholder = ({ title, icon, subtitle }) => (
  <PageShell title={title} icon={icon} subtitle={subtitle}>
    <div className="text-center py-5">
      <i className={`bi ${icon} d-block mb-2 text-muted`} style={{ fontSize: 48 }}></i>
      <h5 className="fw-bold">{title}</h5>
      <p className="text-muted small">{subtitle}</p>
      <div className="text-muted small mt-3">Coming soon</div>
    </div>
  </PageShell>
);

export default function HRShared() { return null; }
