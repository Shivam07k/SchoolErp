import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, moneyOrDash } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function AlumniJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company: '', title: '', description: '', employmentType: 'full_time', experienceRequired: '', qualification: '', skills: '', location: '', salaryMin: '', salaryMax: '', deadline: '', contactEmail: '', applyUrl: '' });
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [alumni, setAlumni] = useState([]);

  useEffect(() => { loadJobs(); loadAlumni(); }, [statusFilter]);

  async function loadJobs() {
    setLoading(true);
    try {
      const d = await apiGet(`/school/alumni/jobs?${statusFilter ? `status=${statusFilter}` : ''}`);
      if (d?.ok) setJobs(d.jobs || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function loadAlumni() {
    const d = await apiGet('/school/alumni/directory?status=verified');
    if (d?.ok) setAlumni(d.alumni || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.company?.trim() || !form.title?.trim()) return toast('Company and title required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/alumni/jobs/${editingId}`, form)
        : await apiPost('/school/alumni/jobs', form);
      if (res?.ok) { toast(editingId ? 'Job updated' : 'Job posted', 'success'); setShowForm(false); setEditingId(null); setForm({ company: '', title: '', description: '', employmentType: 'full_time', experienceRequired: '', qualification: '', skills: '', location: '', salaryMin: '', salaryMax: '', deadline: '', contactEmail: '', applyUrl: '' }); loadJobs(); }
      else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editJob(j) {
    setEditingId(j.id);
    setForm({ company: j.company, title: j.title, description: j.description, employmentType: j.employment_type, experienceRequired: j.experience_required, qualification: j.qualification, skills: Array.isArray(j.skills) ? j.skills.join(', ') : j.skills || '', location: j.location, salaryMin: j.salary_min, salaryMax: j.salary_max, deadline: j.deadline ? j.deadline.slice(0,10) : '', contactEmail: j.contact_email, applyUrl: j.apply_url });
    setShowForm(true);
  }

  async function approveJob(id, status) {
    try {
      const res = await apiPost(`/school/alumni/jobs/${id}/approve`, { status });
      if (res?.ok) { toast(`Job ${status === 'active' ? 'approved' : 'rejected'}`, 'success'); loadJobs(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteJob(id) {
    if (!window.confirm('Delete this job?')) return;
    try {
      const res = await apiDelete(`/school/alumni/jobs/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadJobs(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Job Postings" icon="bi-briefcase" subtitle={`${jobs.length} jobs`}>
      <div className="d-flex gap-2 mb-3">
        <select className="form-select form-select-sm" style={{width:180}} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option><option value="pending_approval">Pending Approval</option>
          <option value="active">Active</option><option value="expired">Expired</option><option value="rejected">Rejected</option>
        </select>
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm({ company: '', title: '', description: '', employmentType: 'full_time', experienceRequired: '', qualification: '', skills: '', location: '', salaryMin: '', salaryMax: '', deadline: '', contactEmail: '', applyUrl: '' }); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Post Job
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Job' : 'Post Job'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Company *<input className="form-control form-control-sm" value={form.company} onChange={e => setForm({...form, company: e.target.value})} required /></label>
            <label>Title *<input className="form-control form-control-sm" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></label>
            <label>Employment Type<select className="form-select form-select-sm" value={form.employmentType} onChange={e => setForm({...form, employmentType: e.target.value})}>
              <option value="full_time">Full-time</option><option value="part_time">Part-time</option>
              <option value="internship">Internship</option><option value="contract">Contract</option><option value="freelance">Freelance</option>
            </select></label>
            <label>Experience<input className="form-control form-control-sm" value={form.experienceRequired} onChange={e => setForm({...form, experienceRequired: e.target.value})} /></label>
            <label>Qualification<input className="form-control form-control-sm" value={form.qualification} onChange={e => setForm({...form, qualification: e.target.value})} /></label>
            <label>Skills (comma separated)<input className="form-control form-control-sm" value={form.skills} onChange={e => setForm({...form, skills: e.target.value})} /></label>
            <label>Location<input className="form-control form-control-sm" value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></label>
            <label>Min Salary<input type="number" className="form-control form-control-sm" value={form.salaryMin} onChange={e => setForm({...form, salaryMin: e.target.value})} /></label>
            <label>Max Salary<input type="number" className="form-control form-control-sm" value={form.salaryMax} onChange={e => setForm({...form, salaryMax: e.target.value})} /></label>
            <label>Deadline<input type="date" className="form-control form-control-sm" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} /></label>
            <label>Contact Email<input type="email" className="form-control form-control-sm" value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} /></label>
            <label>Apply URL<input type="url" className="form-control form-control-sm" value={form.applyUrl} onChange={e => setForm({...form, applyUrl: e.target.value})} /></label>
            <label className="span-2">Description<textarea className="form-control form-control-sm" rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})} required /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Post'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Company</th><th>Title</th><th>Type</th><th>Location</th><th>Salary</th><th>Deadline</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="8"><Loading /></td></tr> :
            jobs.length === 0 ? <tr><td colSpan="8"><Empty text="No jobs posted" icon="bi-briefcase" /></td></tr> :
            jobs.map(j => (
              <tr key={j.id}>
                <td>{j.company}</td>
                <td><strong>{j.title}</strong></td>
                <td>{j.employment_type}</td>
                <td>{j.location || '—'}</td>
                <td>{moneyOrDash(j.salary_min)} - {moneyOrDash(j.salary_max)}</td>
                <td>{j.deadline ? fmtDate(j.deadline) : '—'}</td>
                <td><Badge status={j.status}>{j.status}</Badge></td>
                <td className="text-end no-print">
                  {j.status === 'pending_approval' && (
                    <>
                      <button className="btn btn-sm btn-success me-1" onClick={() => approveJob(j.id, 'active')}><i className="bi bi-check"></i> Approve</button>
                      <button className="btn btn-sm btn-danger me-1" onClick={() => approveJob(j.id, 'rejected')}>Reject</button>
                    </>
                  )}
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editJob(j)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteJob(j.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}