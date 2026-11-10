import React, { useEffect, useState, useMemo } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDateTime, downloadCsv, EVENT_TYPES, CHANNELS } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_RULE = {
  name: '', code: '', description: '', event_type: 'manual', event_config: {},
  conditions: {}, channels: [], templates: {}, schedule_cron: '', schedule_timezone: 'Asia/Kolkata', is_active: true
};

const EVENT_CONFIG_FIELDS = {
  'fee.due_soon': ['days_before'],
  'fee.overdue': ['days_after'],
  'attendance.absent': ['consecutive_days'],
  'attendance.late': ['times_in_period', 'period_days'],
  'student.birthday': [],
  'schedule.daily': ['run_time'],
  'schedule.weekly': ['run_day', 'run_time'],
  'manual': [],
};

export default function AutomationRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_RULE);
  const [activeTab, setActiveTab] = useState('rules');

  useEffect(() => { loadRules(); loadRuns(); }, []);

  async function loadRules() {
    try {
      const d = await apiGet('/school/automation/rules');
      if (d?.ok) setRules(d.rules || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadRuns() {
    try {
      const d = await apiGet('/school/automation/runs?limit=20');
      if (d?.ok) setRuns(d.runs || []);
    } catch (e) { console.error(e); }
  }

  const [runs, setRuns] = useState([]);

  function eventConfigFields() {
    return EVENT_CONFIG_FIELDS[form.event_type] || [];
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name?.trim()) return toast('Name is required', 'error');
    if (!form.event_type) return toast('Event type is required', 'error');
    if (!form.channels?.length) return toast('At least one channel required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/automation/rules/${editingId}`, form)
        : await apiPost('/school/automation/rules', form);
      if (res?.ok) {
        toast(editingId ? 'Rule updated' : 'Rule created', 'success');
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_RULE);
        loadRules();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editRule(r) {
    setEditingId(r.id);
    setForm({ ...r, event_config: r.event_config || {}, conditions: r.conditions || {}, templates: r.templates || {} });
    setShowForm(true);
  }

  async function toggleRule(r) {
    try {
      const res = await apiPost(`/school/automation/rules/${r.id}/toggle`);
      if (res?.ok) loadRules();
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteRule(id) {
    if (!window.confirm('Delete this rule?')) return;
    try {
      const res = await apiDelete(`/school/automation/rules/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadRules(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function testRule(r) {
    try {
      const res = await apiPost(`/school/automation/rules/${r.id}/test`, {});
      if (res?.ok) toast('Test queued', 'success');
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Automation Center" icon="bi-lightning-charge" subtitle={`${rules.length} rules, ${runs.length} recent runs`}>
      <ul className="nav nav-tabs mb-3" role="tablist">
        <li className="nav-item"><button className={`nav-link ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>Rules & Runs</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>Message Templates</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'providers' ? 'active' : ''}`} onClick={() => setActiveTab('providers')}>Channel Providers</button></li>
      </ul>

      {activeTab === 'rules' && (
        <>
          <div className="d-flex gap-2 mb-3">
            <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm(EMPTY_RULE); setShowForm(true); }}><i className="bi bi-plus"></i> New Rule</button>
            <button className="btn btn-outline-secondary" onClick={() => loadRules()}><i className="bi bi-arrow-clockwise"></i> Refresh</button>
          </div>

          {showForm && (
            <form className="school-form-card mb-3" onSubmit={handleSubmit}>
              <div className="school-form-head">
                <h6>{editingId ? 'Edit Rule' : 'New Automation Rule'}</h6>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
              </div>
              <div className="school-form-grid">
                <label className="span-2">Name *<input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></label>
                <label>Code<input className="form-control form-control-sm" value={form.code} onChange={e => setForm({...form, code: e.target.value})} disabled={Boolean(editingId)} placeholder="Auto-generated" /></label>
                <label className="span-2">Description<textarea className="form-control form-control-sm" rows="2" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></label>
                <label>Event Type *<select className="form-select form-select-sm" value={form.event_type} onChange={e => setForm({...form, event_type: e.target.value, event_config: {}})} required>
                  {EVENT_TYPES.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
                </select></label>
                {eventConfigFields().map(field => (
                  <label key={field} className="span-2">
                    {field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    <input className="form-control form-control-sm" type={field.includes('time') ? 'time' : 'number'} min="0"
                      value={form.event_config?.[field] || ''} onChange={e => setForm({...form, event_config: {...form.event_config, [field]: e.target.value}})} />
                  </label>
                ))}
                <label className="span-2">Conditions (JSON)<textarea className="form-control form-control-sm" rows="2" value={JSON.stringify(form.conditions || {}, null, 2)} onChange={e => { try { setForm({...form, conditions: JSON.parse(e.target.value)}); } catch {} }} placeholder="{}" /></label>
                <label className="span-2">Channels *<div className="d-flex flex-wrap gap-2">
                  {CHANNELS.map(c => (
                    <label key={c.value} className="d-flex align-items-center gap-1 border rounded p-2 cursor-pointer" style={{ minWidth: 100 }}>
                      <input type="checkbox" checked={form.channels?.includes(c.value)} onChange={e => setForm({...form, channels: e.target.checked ? [...(form.channels||[]), c.value] : (form.channels||[]).filter(v => v !== c.value)})} />
                      <i className={`bi ${c.icon}`}></i> {c.label}
                    </label>
                  ))}
                </div></label>
                <label className="span-2">Templates (JSON per channel)<textarea className="form-control form-control-sm" rows="2" value={JSON.stringify(form.templates || {}, null, 2)} onChange={e => { try { setForm({...form, templates: JSON.parse(e.target.value)}); } catch {} }} placeholder='{"sms": 1, "email": 2}' /></label>
                <label>Schedule Cron<input className="form-control form-control-sm" value={form.schedule_cron} onChange={e => setForm({...form, schedule_cron: e.target.value})} placeholder="0 8 * * 1 (optional)" /></label>
                <label>Timezone<input className="form-control form-control-sm" value={form.schedule_timezone} onChange={e => setForm({...form, schedule_timezone: e.target.value})} /></label>
                <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} /> Active</label>
                <div className="span-2 d-flex gap-2">
                  <button className="btn btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
                  <button className="btn btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
                </div>
              </div>
            </form>
          )}

          <div className="school-table-wrap">
            <table className="table table-sm school-table">
              <thead><tr><th>Name</th><th>Event</th><th>Channels</th><th>Schedule</th><th>Status</th><th>Last Run</th><th>Next Run</th><th></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8}><Loading /></td></tr> :
                rules.length === 0 ? <tr><td colSpan={8}><Empty text="No rules yet" /></td></tr> :
                rules.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong>{r.code && <div className="text-muted small">{r.code}</div>}</td>
                    <td>{EVENT_TYPES.find(et => et.value === r.event_type)?.label || r.event_type}</td>
                    <td>{(r.channels || []).map(c => CHANNELS.find(x => x.value === c)?.label || c).join(', ')}</td>
                    <td>{r.schedule_cron ? <code className="small">{r.schedule_cron}</code> : '—'}</td>
                    <td><Badge status={r.is_active ? 'active' : 'inactive'}>{r.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td>{r.last_run_at ? fmtDateTime(r.last_run_at) : '—'}</td>
                    <td>{r.next_run_at ? fmtDateTime(r.next_run_at) : '—'}</td>
                    <td className="text-end no-print">
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editRule(r)}><i className="bi bi-pencil"></i></button>
                      <button className="btn btn-sm btn-outline-primary me-1" onClick={() => toggleRule(r)}><i className={r.is_active ? 'bi bi-pause' : 'bi bi-play'}></i></button>
                      <button className="btn btn-sm btn-outline-info me-1" onClick={() => testRule(r)}><i className="bi bi-flask"></i></button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteRule(r.id)}><i className="bi bi-trash"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <hr className="my-3" />
          <h6>Recent Runs</h6>
          <div className="school-table-wrap">
            <table className="table table-sm school-table">
              <thead><tr><th>Rule</th><th>Trigger</th><th>Status</th><th>Actions</th><th>Started</th><th>Completed</th></tr></thead>
              <tbody>
                {runs.length === 0 ? <tr><td colSpan={6}><Empty text="No runs yet" /></td></tr> :
                runs.map(r => (
                  <tr key={r.id}>
                    <td>{r.rule_name || `Rule #${r.rule_id}`}</td>
                    <td>{r.trigger_type}</td>
                    <td><Badge status={r.status}>{r.status}</Badge></td>
                    <td>{r.success_actions}/{r.total_actions} ok</td>
                    <td>{r.started_at ? fmtDateTime(r.started_at) : '—'}</td>
                    <td>{r.completed_at ? fmtDateTime(r.completed_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'templates' && (
        <div className="text-center py-4 text-muted">
          <i className="bi bi-file-earmark-text d-block mb-2" style={{ fontSize: 40 }}></i>
          <p>Message Templates screen - see separate component</p>
          <button className="btn btn-primary" onClick={() => setActiveTab('templates')}>Switch to Templates tab</button>
        </div>
      )}

      {activeTab === 'providers' && (
        <div className="text-center py-4 text-muted">
          <i className="bi bi-box-arrow-up-right d-block mb-2" style={{ fontSize: 40 }}></i>
          <p>Channel Providers screen - see separate component</p>
          <button className="btn btn-primary" onClick={() => setActiveTab('providers')}>Switch to Providers tab</button>
        </div>
      )}
    </PageShell>
  );
}