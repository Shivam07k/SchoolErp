import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function AlumniDirectory() {
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');

  useEffect(() => {
    loadAlumni();
  }, [statusFilter, batchFilter]);

  async function loadAlumni() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (batchFilter) params.append('batch', batchFilter);
      const d = await apiGet(`/school/alumni/directory?${params.toString()}`);
      if (d?.ok) setAlumni(d.alumni || []);
      else toast(d?.error || 'Failed to load alumni', 'error');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell title="Alumni Directory" icon="bi-people" subtitle={`${alumni.length} alumni`}>
      <div className="d-flex gap-2 mb-3">
        <input className="form-control form-control-sm" style={{width:300}} placeholder="Search name, company, location..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select form-select-sm" style={{width:150}} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option><option value="verified">Verified</option><option value="active">Active</option><option value="pending_registration">Pending</option><option value="inactive">Inactive</option>
        </select>
        <select className="form-select form-select-sm" style={{width:150}} value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
          <option value="">All Batches</option>
          {[2020,2021,2022,2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Name</th><th>Batch</th><th>Company</th><th>Designation</th><th>Location</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7"><Loading /></td></tr> :
            alumni.length === 0 ? <tr><td colSpan="7"><Empty text="No alumni found" icon="bi-people" /></td></tr> :
            alumni.filter(a => !search || 
              (a.first_name && a.first_name.toLowerCase().includes(search.toLowerCase())) ||
              (a.last_name && a.last_name.toLowerCase().includes(search.toLowerCase())) ||
              (a.company && a.company.toLowerCase().includes(search.toLowerCase())) ||
              (a.location && a.location.toLowerCase().includes(search.toLowerCase()))
            ).map(a => (
              <tr key={a.id}>
                <td><strong>{a.first_name} {a.last_name}</strong><br/><small className="text-muted">Adm: {a.admission_no}</small></td>
                <td>{a.passing_year}</td>
                <td>{a.company || '—'}</td>
                <td>{a.designation || '—'}</td>
                <td>{a.location || '—'}</td>
                <td><Badge status={a.status}>{a.status}</Badge></td>
                <td className="text-end no-print">
                  <a className="btn btn-sm btn-outline-secondary" href={`#/school/alumni/profile/${a.id}`}><i className="bi bi-eye"></i></a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}