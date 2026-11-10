import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../api';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManageHR, fmtDate, downloadCsv } from './shared';

const STATUS_TONE = { active: 'success', inactive: 'secondary', on_leave: 'warning', exited: 'danger' };
const TYPE_TONE = { permanent: 'success', contract: 'info', part_time: 'warning', visiting: 'info', probation: 'warning' };

export default function StaffList({ me, onNavigate }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ department: '', designation: '', type: '', status: '', q: '' });
  const manager = canManageHR(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
      const d = await apiGet(`/school/hr/staff?${params.toString()}`);
      if (d?.ok) setStaff(d.staff || []);
      else throw new Error(d?.error || 'Failed to load staff');
    } catch (err) { setError(err.message || 'Failed to load staff'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filters]);

  async function exportCsv() {
    const d = await apiGet(`/school/hr/staff/export`);
    if (d?.ok) {
      downloadCsv('staff-export.csv', [
        { label: 'Employee Code', key: 'employee_code' },
        { label: 'Name', key: 'name' },
        { label: 'Department', key: 'department' },
        { label: 'Designation', key: 'designation' },
        { label: 'Type', key: 'type' },
        { label: 'Joining Date', key: 'joining_date' },
        { label: 'Status', key: 'status' },
        { label: 'Phone', key: 'contact_phone' },
        { label: 'Email', key: 'contact_email' },
      ], d.staff);
    }
  }

  return (
    <PageShell
      title="Staff Directory"
      icon="bi-people"
      subtitle="Manage staff records, employment history, qualifications and documents"
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={load} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={exportCsv} disabled={!staff.length}>
            <i className="bi bi-download me-1"></i>CSV
          </button>
          {manager && <button className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/hr/staff/new')}>
            <i className="bi bi-plus-lg me-1"></i>Add Staff
          </button>}
        </>
      }
    >
      <ErrorBox message={error} onRetry={load} />

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Search name, code, phone, email" value={filters.q} onChange={e => setFilters({...filters, q: e.target.value})} onKeyDown={e => e.key === 'Enter' && load()} /></div>
            <div className="col-md-2"><select className="form-select form-select-sm" value={filters.department} onChange={e => setFilters({...filters, department: e.target.value})}><option value="">All Departments</option><option value="Primary">Primary</option><option value="Secondary">Secondary</option><option value="Administration">Administration</option></select></div>
            <div className="col-md-2"><select className="form-select form-select-sm" value={filters.designation} onChange={e => setFilters({...filters, designation: e.target.value})}><option value="">All Designations</option><option value="Teacher">Teacher</option><option value="Principal">Principal</option><option value="Vice Principal">Vice Principal</option><option value="Admin Staff">Admin Staff</option></select></div>
            <div className="col-md-2"><select className="form-select form-select-sm" value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})}><option value="">All Types</option><option value="permanent">Permanent</option><option value="contract">Contract</option><option value="part_time">Part-time</option><option value="visiting">Visiting</option><option value="probation">Probation</option></select></div>
            <div className="col-md-2"><select className="form-select form-select-sm" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}><option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option><option value="exited">Exited</option></select></div>
            <div className="col-md-1"><button className="btn btn-sm btn-primary w-100" onClick={load}><i className="bi bi-search me-1"></i>Filter</button></div>
          </div>
        </div>
      </div>

      {loading ? (
        <Loading text="Loading staff..." />
      ) : !staff.length ? (
        <Empty icon="bi-people" text="No staff found matching the filters." />
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Employee Code</th><th>Name</th><th>Department</th><th>Designation</th>
                  <th>Type</th><th>Joining Date</th><th>Status</th>
                  <th>Phone</th><th>Email</th><th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id}>
                    <td className="fw-semibold">{s.employee_code}</td>
                    <td>{s.name}<div className="small text-muted">{s.contact_email || ''}</div></td>
                    <td>{s.department || 'Ã¢â‚¬â€'}</td>
                    <td>{s.designation || 'Ã¢â‚¬â€'}</td>
                    <td><Badge tone={TYPE_TONE[s.type] || 'secondary'}>{s.type}</Badge></td>
                    <td>{fmtDate(s.joining_date)}</td>
                    <td><Badge tone={STATUS_TONE[s.status] || 'secondary'}>{s.status}</Badge></td>
                    <td>{s.contact_phone || 'Ã¢â‚¬â€'}</td>
                    <td>{s.contact_email || 'Ã¢â‚¬â€'}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        {manager && <button className="btn btn-outline-primary" onClick={() => onNavigate(`/school/hr/staff/${s.id}`)} title="View/Edit"><i className="bi bi-eye"></i></button>}
                        {manager && <button className="btn btn-outline-secondary" onClick={() => onNavigate(`/school/hr/staff/${s.id}/employment/new`)} title="New Employment Record"><i className="bi bi-briefcase"></i></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}
