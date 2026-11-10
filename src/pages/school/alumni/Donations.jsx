import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, moneyOrDash } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function AlumniDonations() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'general', targetAmount: '', startDt: '', endDt: '' });
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadCampaigns(); }, [statusFilter]);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const d = await apiGet(`/school/alumni/donations/campaigns?${statusFilter ? `status=${statusFilter}` : ''}`);
      if (d?.ok) setCampaigns(d.campaigns || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title?.trim()) return toast('Title is required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/alumni/donations/campaigns/${editingId}`, form)
        : await apiPost('/school/alumni/donations/campaigns', form);
      if (res?.ok) { toast(editingId ? 'Campaign updated' : 'Campaign created', 'success'); setShowForm(false); setEditingId(null); setForm({ title: '', description: '', category: 'general', targetAmount: '', startDt: '', endDt: '' }); loadCampaigns(); }
      else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editCampaign(c) {
    setEditingId(c.id);
    setForm({ title: c.title, description: c.description, category: c.category, targetAmount: c.target_amount, startDt: c.start_dt ? c.start_dt.slice(0,10) : '', endDt: c.end_dt ? c.end_dt.slice(0,10) : '' });
    setShowForm(true);
  }

  async function deleteCampaign(id) {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      const res = await apiDelete(`/school/alumni/donations/campaigns/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadCampaigns(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Donation Campaigns" icon="bi-heart-fill" subtitle={`${campaigns.length} campaigns`}>
      <div className="d-flex gap-2 mb-3">
        <select className="form-select form-select-sm" style={{width:180}} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option><option value="active">Active</option>
          <option value="completed">Completed</option><option value="closed">Closed</option>
        </select>
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm({ title: '', description: '', category: 'general', targetAmount: '', startDt: '', endDt: '' }); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New Campaign
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Campaign' : 'New Campaign'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Title *<input className="form-control form-control-sm" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></label>
            <label>Category<select className="form-select form-select-sm" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              <option value="general">General</option><option value="infrastructure">Infrastructure</option>
              <option value="scholarship">Scholarship</option><option value="library">Library</option>
              <option value="sports">Sports</option><option value="custom">Custom</option>
            </select></label>
            <label>Target Amount<input type="number" step="0.01" className="form-control form-control-sm" value={form.targetAmount} onChange={e => setForm({...form, targetAmount: e.target.value})} /></label>
            <label>Start Date<input type="date" className="form-control form-control-sm" value={form.startDt} onChange={e => setForm({...form, startDt: e.target.value})} /></label>
            <label>End Date<input type="date" className="form-control form-control-sm" value={form.endDt} onChange={e => setForm({...form, endDt: e.target.value})} /></label>
            <label className="span-2">Description<textarea className="form-control form-control-sm" rows="2" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Title</th><th>Category</th><th>Target</th><th>Collected</th><th>Progress</th><th>Dates</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="8"><Loading /></td></tr> :
            campaigns.length === 0 ? <tr><td colSpan="8"><Empty text="No campaigns yet" icon="bi-heart-fill" /></td></tr> :
            campaigns.map(c => (
              <tr key={c.id}>
                <td><strong>{c.title}</strong></td>
                <td>{c.category}</td>
                <td>{moneyOrDash(c.target_amount)}</td>
                <td>{moneyOrDash(c.collected_amount)}</td>
                <td><div className="progress" style={{height:20}}><div className="progress-bar" role="progressbar" style={{width: `${c.target_amount ? (c.collected_amount / c.target_amount * 100) : 0}%`}} aria-valuenow={c.target_amount ? Math.round(c.collected_amount / c.target_amount * 100) : 0} aria-valuemin="0" aria-valuemax="100">{c.target_amount ? Math.round(c.collected_amount / c.target_amount * 100) : 0}%</div></div></td>
                <td>{fmtDate(c.start_dt)} to {c.end_dt ? fmtDate(c.end_dt) : '—'}</td>
                <td><Badge status={c.status}>{c.status}</Badge></td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editCampaign(c)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteCampaign(c.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}