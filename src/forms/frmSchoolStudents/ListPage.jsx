import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../api';
import { toast } from '../../toast';
import HtmlCell from '../../components/HtmlCell';

function ListPage({ formId, config, onEdit, onAdd, onPrint, onNavigate }) {
  const TITLE = config?.title || 'School Students';
  const STICKY_SEARCH = config?.listConfig?.stickySearch !== false;
  const STICKY_FOOTER = config?.listConfig?.stickyFooter === true;
  const SHOW_PRINT = config?.listConfig?.showPrint !== false;
  const SHOW_DELETE = config?.listConfig?.showDelete !== false;
  const apiList = config?.api?.list || '/school/students';

  const [data, setData] = useState({ rows: [], total: 0 });
  const [filters, setFilters] = useState({ q: '', classId: '', sectionId: '', status: 'active' });
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);

  const loadClasses = useCallback(async () => {
    try {
      const d = await apiGet('/school/classes');
      if (d?.ok) setClasses(d.classes || []);
    } catch {}
  }, []);

  const searchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.q) p.set('q', filters.q);
      if (filters.classId) p.set('classId', filters.classId);
      if (filters.sectionId) p.set('sectionId', filters.sectionId);
      if (filters.status) p.set('status', filters.status);
      const res = await apiGet(`${apiList}?${p.toString()}`);
      const rows = res?.students || res?.rows || res?.data || [];
      setData({ rows, total: rows.length });
    } catch (e) {
      console.error(e);
      toast('Failed to load students', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiList, filters]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { searchData(); }, [searchData]);

  const del = async (row) => {
    if (!confirm(`Archive ${row.first_name || ''} ${row.last_name || ''} (${row.admission_no})?`)) return;
    try {
      const res = await apiDelete(`${(config?.api?.delete || '/school/students/:id').replace(':id', row.id)}`);
      if (res?.ok) { toast('Student archived', 'success'); searchData(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch { toast('Delete failed', 'error'); }
  };

  const classOptions = classes.map((c) => ({ id: c.id, name: c.name, sections: c.sections || [] }));
  const sectionOptions = classOptions.find((c) => String(c.id) === String(filters.classId))?.sections || [];

  const fullName = (s) => `${s?.first_name || ''} ${s?.last_name || ''}`.trim();

  return (
    <div className="page-content animate-fade" style={{ paddingBottom: STICKY_FOOTER ? 110 : 20 }}>
      <div className={STICKY_SEARCH ? 'filter-sticky' : ''}>
        <div className="card search-panel"><div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-3 col-lg-3">
              <label className="form-label">Search</label>
              <input type="text" className="form-control form-control-sm" placeholder="Name, admission no, guardian"
                value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && searchData()} />
            </div>
            <div className="col-6 col-md-2 col-lg-2">
              <label className="form-label">Class</label>
              <select className="form-select form-select-sm" value={filters.classId} onChange={(e) => setFilters((p) => ({ ...p, classId: e.target.value, sectionId: '' }))}>
                <option value="">All</option>
                {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-2 col-lg-2">
              <label className="form-label">Section</label>
              <select className="form-select form-select-sm" value={filters.sectionId} onChange={(e) => setFilters((p) => ({ ...p, sectionId: e.target.value }))}>
                <option value="">All</option>
                {sectionOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-2 col-lg-2">
              <label className="form-label">Status</label>
              <select className="form-select form-select-sm" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                <option value="">Any</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="graduated">Graduated</option>
              </select>
            </div>
            <div className="col-12 col-md-auto ms-auto d-flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={() => onAdd && onAdd()}><i className="bi bi-person-plus"></i> Admit</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={searchData} disabled={loading}><i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i> Refresh</button>
            </div>
          </div>
        </div></div>
      </div>

      <div className="card grid-card mt-3">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="card-title mb-0"><i className="bi bi-people me-2"></i>{TITLE} <span className="text-muted">({data.rows.length})</span></div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Admission No</th>
                <th>Student</th>
                <th>Class/Section</th>
                <th>Guardian</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-center text-muted py-3">Loading...</td></tr>}
              {!loading && data.rows.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-3">No students found</td></tr>}
              {!loading && data.rows.map((row) => (
                <tr key={row.id}>
                  <td><code>{row.admission_no}</code></td>
                  <td><strong>{fullName(row)}</strong><div className="text-muted small">{row.gender || '-'} · DOB {row.dob ? new Date(row.dob).toLocaleDateString('en-IN') : '-'}</div></td>
                  <td>{row.class_name || '-'}{row.section_name ? ` · ${row.section_name}` : ''}</td>
                  <td><div>{row.guardian_name || '-'}</div><div className="text-muted small">{row.guardian_phone || row.guardian_email || ''}</div></td>
                  <td><span className={`badge bg-${row.status === 'active' ? 'success' : row.status === 'graduated' ? 'info' : 'secondary'}`}>{row.status}</span></td>
                  <td className="text-end">
                    {onEdit && <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => onEdit(row)}><i className="bi bi-pencil"></i></button>}
                    {onPrint && <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => onPrint(row)}><i className="bi bi-printer"></i></button>}
                    {SHOW_DELETE && <button className="btn btn-sm btn-outline-danger" onClick={() => del(row)}><i className="bi bi-archive"></i></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ListPage;
