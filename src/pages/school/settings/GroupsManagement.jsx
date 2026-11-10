import React, { useEffect, useState, useMemo } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, Badge, fmtDate, downloadCsv } from './shared';

const MODULES = [
  'students', 'fees', 'attendance', 'examinations', 'timetable',
  'staff', 'inventory', 'library', 'transport', 'hostel',
  'communication', 'reports', 'settings', 'automation',
  'admissions', 'lms', 'library', 'transport', 'hostel', 'canteen'
];

const ACTIONS = ['read', 'write', 'update', 'delete', 'export', 'import', 'promote', 'transfer', 'collect', 'refund', 'waive', 'configure', 'approve', 'schedule', 'enter_marks', 'publish_results', 'collect', 'refund', 'waive', 'issue', 'return', 'fine', 'track', 'allocate', 'visitors', 'send_sms', 'send_email', 'send_push', 'templates', 'enter_marks', 'publish_results', 'purchase', 'issue', 'stock_take', 'return', 'fine', 'track', 'allocate', 'send_sms', 'send_email', 'send_push', 'enter_marks', 'publish_results'];

const SCOPES = ['own', 'campus', 'global'];

const blankGroup = { code: '', name: '', description: '', type: 'custom', is_active: true };

export default function GroupsManagement({ me, canManage, onNavigate, campuses = [], users = [], roles = [] }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...blankGroup });
  const [groupPerms, setGroupPerms] = useState({});
  const [showPermModal, setShowPermModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  const [search, setSearch] = useState('');

  useEffect(() => { loadGroups(); }, []);

  async function loadGroups() {
    setLoading(true);
    try {
      const d = await apiGet('/school/groups');
      if (d?.ok) setGroups(d.groups || []);
      else toast(d?.error || 'Failed to load groups', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function handleGroupSubmit(e) {
    e.preventDefault();
    if (!form.name?.trim()) return toast('Name is required', 'error');
    setSaving(true);
    try {
      const res = editingId
        ? await apiPut(`/school/groups/${editingId}`, form)
        : await apiPost('/school/groups', form);
      if (res?.ok) {
        toast(editingId ? 'Group updated' : 'Group created', 'success');
        setShowForm(false);
        setEditingId(null);
        setForm({ ...blankGroup });
        loadGroups();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function loadGroupPerms(groupId) {
    const d = await apiGet(`/school/groups/${groupId}/permissions`);
    if (d?.ok) {
      const perms = {};
      (d.permissions || []).forEach(p => {
        const key = `${p.module}:${p.action}:${p.scope}`;
        perms[key] = { ...p, checked: true };
      });
      setGroupPerms(perms);
      setEditingGroupId(groupId);
      setShowPermModal(true);
    } else toast(d?.error || 'Failed to load permissions', 'error');
  }

  async function handlePermSubmit(e) {
    e.preventDefault();
    const groupId = editingGroupId;
    const perms = Object.entries(groupPerms)
      .filter(([, v]) => v.checked)
      .map(([key]) => {
        const [module, action, scope] = key.split(':');
        return { module, action, scope };
      });
    setSaving(true);
    try {
      const res = await apiPut(`/school/groups/${groupId}/permissions`, { permissions: perms });
      if (res?.ok) {
        toast('Permissions updated', 'success');
        setShowPermModal(false);
        setEditingGroupId(null);
        setGroupPerms({});
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  function editGroup(g) {
    setEditingId(g.id);
    setForm({ ...g });
    setShowForm(true);
  }

  async function deleteGroup(id) {
    if (!window.confirm('Delete this group? This will remove it from all users.')) return;
    try {
      const res = await apiDelete(`/school/groups/${id}`);
      if (res?.ok) { toast('Group deleted', 'success'); loadGroups(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function cloneGroup(g) {
    try {
      const res = await apiPost('/school/groups', { ...g, code: g.code + '_copy', name: g.name + ' (Copy)' });
      if (res?.ok) { toast('Group cloned', 'success'); loadGroups(); }
      else toast(res?.error || 'Clone failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.code.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageShell title="Groups" icon="bi-people-fill" subtitle={`${groups.length} groups`}>
      <div className="d-flex gap-2 mb-3">
        <input className="form-control form-control-sm" style={{ width: 300 }} placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} />
        {canManage && <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm({...blankGroup}); setShowForm(true); }}><i className="bi bi-plus"></i> New Group</button>}
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleGroupSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Group' : 'New Group'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); setForm({...blankGroup}); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Name *<input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></label>
            <label>Code<input className="form-control form-control-sm" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="Auto-generated if blank" disabled={editingId} /></label>
            <label>Type<select className="form-select form-select-sm" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="custom">Custom</option><option value="system">System</option>
            </select></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} /> Active</label>
            <label className="span-2">Description<textarea className="form-control form-control-sm" rows="2" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit" disabled={saving}><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm({...blankGroup}); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Name</th><th>Code</th><th>Type</th><th>Status</th><th>Permissions</th><th>Members</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8}><Loading /></td></tr> :
            filteredGroups.length === 0 ? <tr><td colSpan={8}><Empty text="No groups found" /></td></tr> :
            filteredGroups.map(g => (
              <tr key={g.id}>
                <td><strong>{g.name}</strong>{g.code && <div className="text-muted small">{g.code}</div>}</td>
                <td>{g.code || '<span className="text-muted">Auto</span>'}</td>
                <td><Badge status={g.type}>{g.type}</Badge></td>
                <td><Badge status={g.is_active ? 'active' : 'inactive'}>{g.is_active ? 'Active' : 'Inactive'}</Badge></td>
                <td>{g.permission_count || 0}</td>
                <td>{g.member_count || 0}</td>
                <td>{g.created_at ? fmtDate(g.created_at) : '—'}</td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => loadGroupPerms(g.id)}><i className="bi bi-shield-lock"></i> Permissions</button>
                  {canManage && <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editGroup(g)}><i className="bi bi-pencil"></i></button>}
                  {canManage && <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => cloneGroup(g)}><i className="bi bi-files"></i></button>}
                  {canManage && !g.is_system && <button className="btn btn-sm btn-outline-danger" onClick={() => deleteGroup(g.id)}><i className="bi bi-trash"></i></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPermModal && (
        <div className="modal-overlay" onClick={() => { setShowPermModal(false); setEditingGroupId(null); setGroupPerms({}); }}>
          <div className="modal-dialog modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header"><h6>Permissions for {groups.find(g => g.id === editingGroupId)?.name || ''}</h6><button className="btn-close" onClick={() => { setShowPermModal(false); setEditingGroupId(null); setGroupPerms({}); }}></button></div>
              <form className="modal-body" onSubmit={handlePermSubmit}>
                <div className="table-responsive" style={{ maxHeight: 500 }}>
                  <table className="table table-sm school-table">
                    <thead>
                      <tr>
                        <th style={{width: 200}}>Module</th>
                        {SCOPES.map(s => <th key={s} className="text-center" style={{width: 80}}>{s.charAt(0).toUpperCase() + s.slice(1)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map(module => (
                        <tr key={module}>
                          <td><strong>{module}</strong></td>
                          {SCOPES.map(scope => (
                            <td key={scope} className="text-center">
                              {ACTIONS.filter(a => MODULE_ACTIONS[module]?.includes(a)).map(action => {
                                const key = `${module}:${action}:${scope}`;
                                const perm = groupPerms[key];
                                return (
                                  <label key={action} className="d-block">
                                    <input type="checkbox" className="form-check-input" 
                                      checked={perm?.checked} 
                                      onChange={e => setGroupPerms({...groupPerms, [key]: {...perm, checked: e.target.checked}})} />
                                    <small>{action.charAt(0).toUpperCase() + action.slice(1)}</small>
                                  </label>
                                );
                              })}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer d-flex justify-content-end gap-2 mt-3">
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowPermModal(false); setEditingGroupId(null); setGroupPerms({}); }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}><i className="bi bi-check"></i> Save Permissions</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

// Module -> allowed actions mapping
const MODULE_ACTIONS = {
  students: ['read', 'write', 'update', 'delete', 'export', 'import', 'promote', 'transfer'],
  fees: ['read', 'write', 'update', 'delete', 'export', 'collect', 'refund', 'waive', 'configure'],
  attendance: ['read', 'write', 'update', 'delete', 'export', 'approve', 'configure'],
  examinations: ['read', 'write', 'update', 'delete', 'export', 'schedule', 'enter_marks', 'publish_results'],
  timetable: ['read', 'write', 'update', 'delete', 'export', 'configure'],
  staff: ['read', 'write', 'update', 'delete', 'export', 'approve_leave', 'payroll'],
  inventory: ['read', 'write', 'update', 'delete', 'export', 'purchase', 'issue', 'stock_take'],
  library: ['read', 'write', 'update', 'delete', 'export', 'issue', 'return', 'fine'],
  transport: ['read', 'write', 'update', 'delete', 'export', 'track', 'allocate'],
  hostel: ['read', 'write', 'update', 'delete', 'export', 'allocate', 'visitors'],
  communication: ['read', 'write', 'update', 'delete', 'send_sms', 'send_email', 'send_push', 'templates'],
  reports: ['read', 'export', 'schedule', 'configure'],
  settings: ['read', 'write', 'update', 'delete', 'configure'],
  automation: ['read', 'write', 'update', 'delete', 'export', 'configure'],
  lms: ['read', 'write', 'update', 'delete', 'export', 'configure'],
  canteen: ['read', 'write', 'update', 'delete', 'export', 'order', 'billing'],
};