import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';
import { toast } from '../toast';
import GroupsManagement from '../pages/school/settings/GroupsManagement';

const SECTIONS = [
  ['institute', 'Institute Profile', 'bi-building'],
  ['campuses', 'Campuses', 'bi-geo-alt'],
  ['roles', 'Roles & Permissions', 'bi-shield-check'],
  ['groups', 'Groups', 'bi-people-fill'],
  ['audit', 'Audit Trail', 'bi-clock-history'],
  ['users', 'Users & Access', 'bi-people-gear'],
  ['approvals', 'Approvals', 'bi-check2-circle'],
  ['integrations', 'Integrations', 'bi-puzzle'],
  ['subscription', 'Subscription', 'bi-credit-card'],
];

const blankCampus = { name: '', code: '', type: 'campus', address: '', phone: '', email: '' };
const blankUser = { user_id: '', name: '', email: '', phone: '', password: '', status: 'active', roles: [], groups: [], campus_id: '' };
const blankFlow = { entity_type: '', name: '', steps: [], is_active: true };
const GROUP_PERMISSION_ACTIONS = {
  students: ['read', 'write', 'update', 'delete', 'export', 'promote', 'transfer'],
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
  canteen: ['read', 'write', 'update', 'delete', 'order', 'billing'],
};
const GROUP_PERMISSION_SCOPES = ['own', 'campus', 'global'];

const dt = (v) => (v ? new Date(v).toLocaleString('en-IN') : '-');

const INTEGRATION_CONFIG_FIELDS = {
  sms: {
    twilio: ['account_sid', 'auth_token', 'from_number'],
    msg91: ['auth_key', 'sender_id', 'route'],
  },
  email: {
    sendgrid: ['api_key', 'from_email', 'from_name'],
    smtp: ['host', 'port', 'username', 'password', 'from_email', 'from_name', 'secure'],
  },
  push: {
    fcm: ['server_key', 'project_id'],
  },
  payment: {
    razorpay: ['key_id', 'key_secret', 'webhook_secret'],
    stripe: ['secret_key', 'publishable_key', 'webhook_secret'],
  },
  sso: {
    google: ['client_id', 'client_secret', 'redirect_uri'],
    microsoft: ['client_id', 'client_secret', 'tenant_id', 'redirect_uri'],
  },
  webhook: {
    generic: ['url', 'secret', 'events'],
  },
};

export default function SchoolSettings({ me, sub, onNavigate, onRefreshMe }) {
  const section = SECTIONS.some(([id]) => id === sub) ? sub : 'institute';
  const canManage = me?.isSuper || me?.permissions?.includes('*') || me?.permissions?.includes('settings.manage');

  const [branding, setBranding] = useState({
    instituteName: '', shortName: '', tagline: '', address: '', phone: '', email: '',
    timezone: 'Asia/Kolkata', currency: 'INR', logoUrl: '',
  });
  const [campuses, setCampuses] = useState([]);
  const [campusDraft, setCampusDraft] = useState({ name: '', code: '', type: 'campus', address: '', phone: '', email: '' });
  const [roles, setRoles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [modules, setModules] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [rolePerms, setRolePerms] = useState([]);
  const [groupPerms, setGroupPerms] = useState([]);
  const [audit, setAudit] = useState([]);
  const [users, setUsers] = useState([]);
  const [approvals, setApprovals] = useState({ flows: [], requests: [] });
  const [integrations, setIntegrations] = useState([]);
  const [subscription, setSubscription] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Users modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ ...blankUser });
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Approvals modal state
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [flowForm, setFlowForm] = useState({ ...blankFlow, steps: [{ role: '', label: '' }] });

  // Integration modal state
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [integrationForm, setIntegrationForm] = useState({ type: '', name: '', provider: '', config: {}, isActive: false, isTestMode: false });

  useEffect(() => {
    setBranding({
      instituteName: me?.branding?.instituteName || '',
      shortName: me?.branding?.shortName || '',
      tagline: me?.branding?.tagline || '',
      address: me?.branding?.address || '',
      phone: me?.branding?.phone || '',
      email: me?.branding?.email || '',
      timezone: me?.branding?.timezone || 'Asia/Kolkata',
      currency: me?.branding?.currency || 'INR',
      logoUrl: me?.branding?.logoUrl || '',
    });
  }, [me?.branding]);

  async function loadCampuses() {
    const d = await apiGet('/school/campuses');
    if (d?.ok) setCampuses(d.campuses || []);
  }
  async function loadRoles() {
    const [d, groupData] = await Promise.all([
      apiGet('/school/roles'),
      apiGet('/school/groups'),
    ]);
    if (d?.ok) {
      setRoles(d.roles || []);
      setCatalogue(d.catalogue || []);
      setModules(d.modules || []);
      setSelectedRole((prev) => prev || d.roles?.[0] || null);
    }
    if (groupData?.ok) setGroups(groupData.groups || []);
  }
  async function loadAudit() {
    const d = await apiGet('/school/audit?limit=200');
    if (d?.ok) setAudit(d.audit || []);
  }
  async function loadUsers() {
    const [userResult, groupResult, roleResult] = await Promise.allSettled([
      apiGet('/school/users'),
      apiGet('/school/groups'),
      apiGet('/school/roles'),
    ]);
    if (userResult.status === 'fulfilled' && userResult.value?.ok) {
      setUsers(userResult.value.users || []);
    } else if (userResult.status === 'rejected') {
      toast(userResult.reason?.message || 'Could not load users', 'error');
    }
    if (groupResult.status === 'fulfilled' && groupResult.value?.ok) {
      setGroups(groupResult.value.groups || []);
    } else if (groupResult.status === 'rejected') {
      toast(groupResult.reason?.message || 'Could not load groups', 'error');
    }
    if (roleResult.status === 'fulfilled' && roleResult.value?.ok) {
      setRoles(roleResult.value.roles || []);
    } else if (roleResult.status === 'rejected') {
      toast(roleResult.reason?.message || 'Could not load roles', 'error');
    }
  }
  async function loadApprovals() {
    const [flows, requests] = await Promise.all([
      apiGet('/school/approval-flows'),
      apiGet('/school/approval-requests?limit=100'),
    ]);
    if (flows?.ok) setApprovals({ flows: flows.flows || [], requests: requests?.requests || [] });
  }
  async function loadIntegrations() {
    const d = await apiGet('/school/integrations');
    if (d?.ok) setIntegrations(d.integrations || []);
  }
  async function loadSubscription() {
    const d = await apiGet('/school/subscription');
    if (d?.ok) setSubscription(d.subscription || {});
  }

  useEffect(() => {
    setLoading(true);
    const run = async () => {
      try {
        if (section === 'campuses') await loadCampuses();
        else if (section === 'roles') await loadRoles();
        else if (section === 'audit') await loadAudit();
        else if (section === 'users') await loadUsers();
        else if (section === 'approvals') await loadApprovals();
        else if (section === 'integrations') await loadIntegrations();
        else if (section === 'subscription') await loadSubscription();
      } catch (e) {
        toast(e.message || 'Could not load settings', 'error');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [section]);

  useEffect(() => {
    if (selectedRole) setRolePerms(selectedRole.permissions || []);
  }, [selectedRole]);

  const catalogueByModule = useMemo(() => {
    const map = new Map();
    for (const p of catalogue) {
      if (!map.has(p.module)) map.set(p.module, []);
      map.get(p.module).push(p);
    }
    return map;
  }, [catalogue]);

  const moduleLabel = (key) => modules.find((m) => m.key === key)?.label || key;

  async function saveBranding(e) {
    e.preventDefault();
    if (!canManage) return toast('You cannot edit institute settings', 'error');
    setSaving(true);
    try {
      const res = await apiPut('/school/settings/branding', { value: branding });
      if (!res?.ok) throw new Error(res?.error || 'Could not save');
      toast('Institute profile saved', 'success');
      await onRefreshMe?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  async function addCampus(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiPost('/school/campuses', campusDraft);
      if (!res?.ok) throw new Error(res?.error || 'Could not add campus');
      toast('Campus added', 'success');
      setCampusDraft(blankCampus);
      await Promise.all([loadCampuses(), onRefreshMe?.()]);
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  function togglePerm(key) {
    setRolePerms((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function selectRole(role) {
    setSelectedGroup(null);
    setSelectedRole(role);
  }

  async function selectGroup(group) {
    setSelectedRole(null);
    setSelectedGroup(group);
    try {
      const d = await apiGet(`/school/groups/${group.id}/permissions`);
      if (!d?.ok) throw new Error(d?.error || 'Could not load group permissions');
      setGroupPerms((d.permissions || []).map((p) => `${p.module}:${p.action}:${p.scope}`));
    } catch (err) {
      setGroupPerms([]);
      toast(err.message, 'error');
    }
  }

  function toggleGroupPerm(key) {
    setGroupPerms((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  }

  async function saveRole() {
    if (!selectedRole && !selectedGroup) return;
    setSaving(true);
    try {
      const res = selectedGroup
        ? await apiPut(`/school/groups/${selectedGroup.id}/permissions`, {
          permissions: groupPerms.map((key) => {
            const [module, action, scope] = key.split(':');
            return { module, action, scope };
          }),
        })
        : await apiPut(`/school/roles/${selectedRole.id}/permissions`, { permissions: rolePerms });
      if (!res?.ok) throw new Error(res?.error || 'Could not save permissions');
      toast(`Permissions saved for ${selectedGroup?.name || selectedRole.name}`, 'success');
      if (selectedGroup) await selectGroup(selectedGroup);
      else await loadRoles();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  // Users CRUD
  function openUserModal(user = null) {
    if (user) {
      setEditingUser(user);
      setUserForm({
        user_id: user.user_id || '',
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        password: '',
        status: user.status || 'active',
        roles: user.role_ids || [],
        groups: user.group_ids || [],
        campus_id: user.campus_id || '',
      });
    } else {
      setEditingUser(null);
      setUserForm({ ...blankUser });
    }
    setNewGroupName('');
    setShowUserModal(true);
  }

  async function createGroupForUser() {
    const name = newGroupName.trim();
    if (!name) return toast('Group name is required', 'error');
    setCreatingGroup(true);
    try {
      const res = await apiPost('/school/groups', { name });
      if (!res?.ok) throw new Error(res?.error || 'Could not create group');
      const group = res.group;
      setGroups((current) => [...current.filter((item) => item.id !== group.id), group]);
      setUserForm((current) => ({ ...current, groups: [...new Set([...(current.groups || []), group.id])] }));
      setNewGroupName('');
      toast('Group created and selected', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally { setCreatingGroup(false); }
  }

  async function handleUserSubmit(e) {
    e.preventDefault();
    if (!userForm.name?.trim() || !userForm.user_id?.trim()) return toast('Name and User ID required', 'error');
    if (editingUser && !userForm.password) {
      // Don't send password if not changing
    }
    setSaving(true);
    try {
      const payload = { ...userForm };
      if (editingUser) {
        if (!payload.password) delete payload.password;
        const res = await apiPut(`/school/users/${editingUser.id}`, payload);
        if (!res?.ok) throw new Error(res?.error || 'Update failed');
        toast('User updated', 'success');
      } else {
        const res = await apiPost('/school/users', payload);
        if (!res?.ok) throw new Error(res?.error || 'Create failed');
        toast('User created', 'success');
      }
      setShowUserModal(false);
      setEditingUser(null);
      setUserForm(blankUser);
      await loadUsers();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Delete user ${user.name}?`)) return;
    try {
      const res = await apiDelete(`/school/users/${user.id}`);
      if (res?.ok) { toast('User deleted', 'success'); loadUsers(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function toggleUserStatus(user) {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await apiPut(`/school/users/${user.id}`, { status: newStatus });
      if (res?.ok) { toast(`User ${newStatus}`, 'success'); loadUsers(); }
      else toast(res?.error || 'Failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  // Approvals CRUD
  function openFlowModal(flow = null) {
    if (flow) {
      setEditingFlow(flow);
      setFlowForm({
        entity_type: flow.entity_type,
        name: flow.name || '',
        steps: flow.steps || [{ role: '', label: '' }],
        is_active: flow.is_active,
      });
    } else {
      setEditingFlow(null);
      setFlowForm({ ...blankFlow, steps: [{ role: '', label: '' }] });
    }
    setShowFlowModal(true);
  }

  function addFlowStep() {
    setFlowForm({ ...flowForm, steps: [...flowForm.steps, { role: '', label: '' }] });
  }
  function removeFlowStep(index) {
    if (flowForm.steps.length <= 1) return;
    setFlowForm({ ...flowForm, steps: flowForm.steps.filter((_, i) => i !== index) });
  }

  async function handleFlowSubmit(e) {
    e.preventDefault();
    if (!flowForm.entity_type || !flowForm.name?.trim()) return toast('Entity type and name required', 'error');
    if (!flowForm.steps.some(s => s.role?.trim())) return toast('At least one step with role required', 'error');
    setSaving(true);
    try {
      const res = editingFlow
        ? await apiPut(`/school/approval-flows/${editingFlow.id}`, flowForm)
        : await apiPost('/school/approval-flows', flowForm);
      if (!res?.ok) throw new Error(res?.error || 'Save failed');
      toast(editingFlow ? 'Flow updated' : 'Flow created', 'success');
      setShowFlowModal(false);
      setEditingFlow(null);
      setFlowForm({ ...blankFlow, steps: [{ role: '', label: '' }] });
      loadApprovals();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function deleteFlow(flow) {
    if (!window.confirm(`Delete approval flow ${flow.name}?`)) return;
    try {
      const res = await apiDelete(`/school/approval-flows/${flow.id}`);
      if (res?.ok) { toast('Flow deleted', 'success'); loadApprovals(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleApprovalAction(requestId, action) {
    try {
      const res = await apiPost(`/school/approval-requests/${requestId}/${action}`);
      if (res?.ok) { toast(`Request ${action}d`, 'success'); loadApprovals(); }
      else toast(res?.error || 'Action failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  // Integrations CRUD
  function openIntegrationModal(integration = null) {
    if (integration) {
      setEditingIntegration(integration);
      setIntegrationForm({
        type: integration.type,
        name: integration.name,
        provider: integration.provider || '',
        config: integration.config || {},
        isActive: integration.is_active,
        isTestMode: integration.is_test_mode,
      });
    } else {
      setEditingIntegration(null);
      setIntegrationForm({ type: '', name: '', provider: '', config: {}, isActive: false, isTestMode: false });
    }
    setShowIntegrationModal(true);
  }

  function getConfigFields(type, provider) {
    return INTEGRATION_CONFIG_FIELDS[type]?.[provider] || [];
  }

  async function handleIntegrationSubmit(e) {
    e.preventDefault();
    if (!integrationForm.type || !integrationForm.name || !integrationForm.provider) return toast('Type, name and provider required', 'error');
    setSaving(true);
    try {
      const payload = { ...integrationForm };
      const res = editingIntegration
        ? await apiPut(`/school/integrations/${editingIntegration.id}`, payload)
        : await apiPost('/school/integrations', payload);
      if (!res?.ok) throw new Error(res?.error || 'Save failed');
      toast(editingIntegration ? 'Integration updated' : 'Integration created', 'success');
      setShowIntegrationModal(false);
      setEditingIntegration(null);
      setIntegrationForm({ type: '', name: '', provider: '', config: {}, isActive: false, isTestMode: false });
      loadIntegrations();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function testIntegration(integration) {
    try {
      const res = await apiPost(`/school/integrations/${integration.id}/test`);
      if (res?.ok) toast('Test sent', 'success');
      else toast(res?.error || 'Test failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteIntegration(integration) {
    if (!window.confirm(`Delete integration ${integration.name}?`)) return;
    try {
      const res = await apiDelete(`/school/integrations/${integration.id}`);
      if (res?.ok) { toast('Integration deleted', 'success'); loadIntegrations(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  // Subscription actions
  async function upgradePlan(planCode) {
    try {
      const res = await apiPost('/school/subscription/upgrade', { plan_code: planCode });
      if (res?.ok) { toast('Plan upgraded', 'success'); loadSubscription(); }
      else toast(res?.error || 'Upgrade failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function cancelSubscription() {
    if (!window.confirm('Cancel subscription? This will stop billing.')) return;
    try {
      const res = await apiPost('/school/subscription/cancel');
      if (res?.ok) { toast('Subscription cancelled', 'success'); loadSubscription(); }
      else toast(res?.error || 'Cancel failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function saveBranding(e) {
    e.preventDefault();
    if (!canManage) return toast('You cannot edit institute settings', 'error');
    setSaving(true);
    try {
      const res = await apiPut('/school/settings/branding', { value: branding });
      if (!res?.ok) throw new Error(res?.error || 'Could not save');
      toast('Institute profile saved', 'success');
      await onRefreshMe?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  async function addCampus(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiPost('/school/campuses', campusDraft);
      if (!res?.ok) throw new Error(res?.error || 'Could not add campus');
      toast('Campus added', 'success');
      setCampusDraft(blankCampus);
      await Promise.all([loadCampuses(), onRefreshMe?.()]);
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  function togglePerm(key) {
    setRolePerms((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function saveRole() {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const res = await apiPut(`/school/roles/${selectedRole.id}/permissions`, { permissions: rolePerms });
      if (!res?.ok) throw new Error(res?.error || 'Could not save permissions');
      toast(`Permissions saved for ${selectedRole.name}`, 'success');
      await loadRoles();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className="school-page">
      <div className="school-head">
        <div>
          <h4><i className="bi bi-gear me-2"></i>Settings & Administration</h4>
          <p>Institution identity, campuses, role permissions and a complete audit trail.</p>
        </div>
        <span className={`badge school-badge ${canManage ? 'present' : 'late'}`}>
          {canManage ? 'Admin access' : 'Read only'}
        </span>
      </div>

      <div className="school-tabs">
        {SECTIONS.map(([id, label, icon]) => (
          <button key={id} className={`school-tab ${section === id ? 'active' : ''}`} onClick={() => onNavigate(`/school/settings/${id}`)}>
            <i className={`bi ${icon}`}></i><span>{label}</span>
          </button>
        ))}
      </div>

      {loading && <div className="school-loading"><div className="spinner-border spinner-border-sm text-primary"></div> Loading...</div>}

      {/* ========== INSTITUTE PROFILE ========== */}
      {section === 'institute' && (
        <form className="school-card" onSubmit={saveBranding}>
          <header><h6>Institute profile</h6><span className="school-muted">Shown across the app, receipts and portals.</span></header>
          <div className="school-form-grid">
            <label>Institute name<input className="form-control form-control-sm" value={branding.instituteName} disabled={!canManage} onChange={(e) => setBranding({ ...branding, instituteName: e.target.value })} /></label>
            <label>Short name<input className="form-control form-control-sm" value={branding.shortName} disabled={!canManage} onChange={(e) => setBranding({ ...branding, shortName: e.target.value })} /></label>
            <label className="span-2">Tagline<input className="form-control form-control-sm" value={branding.tagline} disabled={!canManage} onChange={(e) => setBranding({ ...branding, tagline: e.target.value })} /></label>
            <label className="span-2">Address<textarea className="form-control form-control-sm" rows="2" value={branding.address} disabled={!canManage} onChange={(e) => setBranding({ ...branding, address: e.target.value })} /></label>
            <label>Phone<input className="form-control form-control-sm" value={branding.phone} disabled={!canManage} onChange={(e) => setBranding({ ...branding, phone: e.target.value })} /></label>
            <label>Email<input type="email" className="form-control form-control-sm" value={branding.email} disabled={!canManage} onChange={(e) => setBranding({ ...branding, email: e.target.value })} /></label>
            <label>Timezone<select className="form-select form-select-sm" value={branding.timezone} disabled={!canManage} onChange={(e) => setBranding({ ...branding, timezone: e.target.value })}>
              <option>Asia/Kolkata</option><option>Asia/Dubai</option><option>Asia/Singapore</option><option>Europe/London</option><option>America/New_York</option>
            </select></label>
            <label>Currency<select className="form-select form-select-sm" value={branding.currency} disabled={!canManage} onChange={(e) => setBranding({ ...branding, currency: e.target.value })}>
              <option>INR</option><option>AED</option><option>USD</option><option>GBP</option><option>SGD</option>
            </select></label>
            <label className="span-2">Logo URL<input className="form-control form-control-sm" value={branding.logoUrl} disabled={!canManage} placeholder="https://..." onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })} /></label>
          </div>
          {canManage && (
            <div className="school-form-actions">
              <button className="btn btn-sm btn-primary" type="submit" disabled={saving}><i className="bi bi-check2"></i> Save profile</button>
            </div>
          )}
        </form>
      )}

      {/* ========== CAMPUSES ========== */}
      {section === 'campuses' && (
        <div className="school-grid-2">
          <section className="school-card">
            <header><h6>Campuses</h6><span className="school-muted">{campuses.length} location(s)</span></header>
            <div className="campus-list">
              {campuses.length === 0 && <div className="school-muted">No campuses yet.</div>}
              {campuses.map((c) => (
                <div className="campus-row" key={c.id}>
                  <div className="campus-icon"><i className="bi bi-geo-alt"></i></div>
                  <div className="campus-main">
                    <strong>{c.name}</strong>
                    <span>{c.code} · {c.type} · {c.students} students</span>
                    <div className="school-muted">{c.address || 'No address'} {c.phone ? `· ${c.phone}` : ''}</div>
                  </div>
                  <span className={`badge school-badge ${c.status === 'active' ? 'present' : 'late'}`}>{c.status}</span>
                </div>
              ))}
            </div>
          </section>
          <form className="school-card" onSubmit={addCampus}>
            <header><h6>Add campus</h6></header>
            <div className="school-form-grid">
              <label>Name *<input className="form-control form-control-sm" value={campusDraft.name} required disabled={!canManage} onChange={(e) => setCampusDraft({ ...campusDraft, name: e.target.value })} /></label>
              <label>Code<input className="form-control form-control-sm" value={campusDraft.code} disabled={!canManage} placeholder="Auto" onChange={(e) => setCampusDraft({ ...campusDraft, code: e.target.value })} /></label>
              <label>Type<select className="form-select form-select-sm" value={campusDraft.type} disabled={!canManage} onChange={(e) => setCampusDraft({ ...campusDraft, type: e.target.value })}>
                <option value="campus">Campus</option><option value="branch">Branch</option><option value="wing">Wing</option><option value="hostel">Hostel</option>
              </select></label>
              <label>Phone<input className="form-control form-control-sm" value={campusDraft.phone} disabled={!canManage} onChange={(e) => setCampusDraft({ ...campusDraft, phone: e.target.value })} /></label>
              <label className="span-2">Email<input type="email" className="form-control form-control-sm" value={campusDraft.email} disabled={!canManage} onChange={(e) => setCampusDraft({ ...campusDraft, email: e.target.value })} /></label>
              <label className="span-2">Address<textarea className="form-control form-control-sm" rows="2" value={campusDraft.address} disabled={!canManage} onChange={(e) => setCampusDraft({ ...campusDraft, address: e.target.value })} /></label>
            </div>
            {canManage && <div className="school-form-actions"><button className="btn btn-sm btn-primary" type="submit" disabled={saving}><i className="bi bi-plus-lg"></i> Add campus</button></div>}
          </form>
        </div>
      )}

      {/* ========== ROLES & PERMISSIONS ========== */}
      {section === 'roles' && (
        <div className="school-grid-2 role-layout">
          <section className="school-card">
            <header><h6>Roles & Groups</h6><span className="school-muted">{roles.length} role(s), {groups.length} group(s)</span></header>
            <div className="role-list">
              {roles.map((r) => (
                <button key={`role-${r.id}`} className={`role-row ${selectedRole?.id === r.id ? 'active' : ''}`} onClick={() => selectRole(r)}>
                  <div>
                    <strong>{r.name}</strong>
                    <span>{r.code} · {r.users} user(s)</span>
                  </div>
                  <span className="role-count">{(r.permissions || []).length}</span>
                </button>
              ))}
              {groups.length > 0 && <div className="school-muted px-2 py-2 border-top">Groups</div>}
              {groups.map((group) => (
                <button key={`group-${group.id}`} className={`role-row ${selectedGroup?.id === group.id ? 'active' : ''}`} onClick={() => selectGroup(group)}>
                  <div>
                    <strong>{group.name}</strong>
                    <span>{group.code} · {group.member_count || 0} user(s)</span>
                  </div>
                  <span className="role-count">{group.permission_count || 0}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="school-card">
            <header>
              <h6>{selectedGroup ? `${selectedGroup.name} group permissions` : selectedRole ? `${selectedRole.name} permissions` : 'Select a role or group'}</h6>
              {(selectedRole || selectedGroup) && (
                <button className="btn btn-sm btn-primary" onClick={saveRole} disabled={saving || !canManage || selectedRole?.code === 'SUPER_ADMIN'}>
                  <i className="bi bi-check2"></i> Save
                </button>
              )}
            </header>
            {selectedRole?.code === 'SUPER_ADMIN' && (
              <div className="school-alert-note"><i className="bi bi-shield-lock"></i> Super Admin always holds every permission and cannot be restricted.</div>
            )}
            {selectedRole && selectedRole.code !== 'SUPER_ADMIN' && (
              <div className="perm-grid">
                {[...catalogueByModule.entries()].map(([mod, perms]) => (
                  <div className="perm-module" key={mod}>
                    <strong>{moduleLabel(mod)}</strong>
                    {perms.map((p) => (
                      <label className="perm-check" key={p.key}>
                        <input type="checkbox" className="form-check-input" disabled={!canManage} checked={rolePerms.includes(p.key)} onChange={() => togglePerm(p.key)} />
                        <span>{p.description}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {selectedGroup && (
              <div className="perm-grid">
                {Object.entries(GROUP_PERMISSION_ACTIONS).map(([mod, actions]) => (
                  <div className="perm-module" key={mod}>
                    <strong>{moduleLabel(mod)}</strong>
                    {actions.flatMap((action) => GROUP_PERMISSION_SCOPES.map((scope) => {
                      const key = `${mod}:${action}:${scope}`;
                      return (
                        <label className="perm-check" key={key}>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            disabled={!canManage}
                            checked={groupPerms.includes(key)}
                            onChange={() => toggleGroupPerm(key)}
                          />
                          <span>{action.replaceAll('_', ' ')} ({scope})</span>
                        </label>
                      );
                    }))}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========== GROUPS ========== */}
      {section === 'groups' && (
        <GroupsManagement 
          me={me} 
          canManage={canManage} 
          onNavigate={onNavigate}
          campuses={campuses}
          users={users}
          roles={roles}
        />
      )}

      {/* ========== AUDIT TRAIL ========== */}
      {section === 'audit' && (
        <section className="school-card">
          <header><h6>Audit trail</h6><span className="school-muted">latest 200 events</span></header>
          <div className="school-table-wrap">
            <table className="table table-sm school-table">
              <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Record</th><th>Device</th></tr></thead>
              <tbody>
                {audit.length === 0 && <tr><td colSpan="6" className="school-muted">No audit events recorded.</td></tr>}
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>{dt(a.created_at)}</td>
                    <td>{a.user_id || 'system'}</td>
                    <td><code>{a.action}</code></td>
                    <td>{a.entity}</td>
                    <td>{a.entity_id || '-'}</td>
                    <td className="school-muted audit-device">{a.device || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========== USERS & ACCESS ========== */}
      {section === 'users' && (
        <section className="school-card">
          <header className="d-flex justify-content-between align-items-center">
            <h6>Users & Access</h6>
            {canManage && <button className="btn btn-sm btn-primary" onClick={() => openUserModal()}><i className="bi bi-plus-lg"></i> Add User</button>}
          </header>
          {showUserModal && (
            <div className="modal-overlay" onClick={() => { setShowUserModal(false); setEditingUser(null); setUserForm(blankUser); }}>
              <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="modal-content">
                  <div className="modal-header"><h6>{editingUser ? 'Edit User' : 'Add User'}</h6><button className="btn-close" onClick={() => { setShowUserModal(false); setEditingUser(null); setUserForm(blankUser); }}></button></div>
                  <form className="modal-body" onSubmit={handleUserSubmit}>
                    <div className="row g-2">
                      <div className="col-md-6"><label className="form-label small">User ID *</label><input className="form-control form-control-sm" value={userForm.user_id} onChange={e => setUserForm({...userForm, user_id: e.target.value})} disabled={editingUser} required /></div>
                      <div className="col-md-6"><label className="form-label small">Name *</label><input className="form-control form-control-sm" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} required /></div>
                      <div className="col-md-6"><label className="form-label small">Email</label><input type="email" className="form-control form-control-sm" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} /></div>
                      <div className="col-md-6"><label className="form-label small">Phone</label><input className="form-control form-control-sm" value={userForm.phone} onChange={e => setUserForm({...userForm, phone: e.target.value})} /></div>
                      <div className="col-md-6"><label className="form-label small">{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</label><input type="password" className="form-control form-control-sm" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} required={!editingUser} /></div>
                      <div className="col-md-6"><label className="form-label small">Status</label><select className="form-select form-select-sm" value={userForm.status} onChange={e => setUserForm({...userForm, status: e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></div>
                      <div className="col-md-6"><label className="form-label small">Campus</label><select className="form-select form-select-sm" value={userForm.campus_id} onChange={e => setUserForm({...userForm, campus_id: e.target.value})}><option value="">None</option>{campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                      <div className="col-md-12">
                        <label className="form-label small" htmlFor="user-groups">Groups</label>
                        <select
                          id="user-groups"
                          className="form-select form-select-sm"
                          multiple
                          size={Math.min(Math.max(groups.length, 3), 8)}
                          value={(userForm.groups || []).map(String)}
                          onChange={(e) => setUserForm((current) => ({
                            ...current,
                            groups: [...e.target.selectedOptions].map((option) => Number(option.value)),
                          }))}
                        >
                          {groups.length
                            ? groups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}{group.is_active ? '' : ' (Inactive)'}
                              </option>
                            ))
                            : <option value="" disabled>No groups available</option>}
                        </select>
                        <div className="form-text">
                          {groups.length} group(s) available. Hold Ctrl (Windows) or Command (Mac) to select multiple groups; scroll inside the box to see more.
                        </div>
                        {canManage && (
                          <div className="input-group input-group-sm mt-2">
                            <input
                              className="form-control"
                              value={newGroupName}
                              onChange={(e) => setNewGroupName(e.target.value)}
                              placeholder="Create a group"
                              aria-label="New group name"
                            />
                            <button type="button" className="btn btn-outline-primary" onClick={createGroupForUser} disabled={creatingGroup}>
                              {creatingGroup ? 'Creating...' : 'Create & select'}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="col-md-12"><label className="form-label small">Roles</label><div className="row g-2">{roles.map(r => { const checked = (userForm.roles || []).includes(r.id); return <div key={r.id} className="col-md-4"><label className="form-check"><input type="checkbox" className="form-check-input" checked={checked} onChange={e => setUserForm({...userForm, roles: e.target.checked ? [...(userForm.roles||[]), r.id] : (userForm.roles||[]).filter(id => id !== r.id)})} /> <span className="form-check-label">{r.name}</span></label></div>; })}</div></div>
                    </div>
                    <div className="modal-footer d-flex justify-content-end gap-2 mt-3">
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowUserModal(false); setEditingUser(null); setUserForm(blankUser); }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={saving}><i className="bi bi-check"></i> {editingUser ? 'Update' : 'Create'}</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
          <div className="school-table-wrap">
            <table className="table table-sm school-table">
              <thead><tr><th>Name</th><th>User ID</th><th>Email</th><th>Phone</th><th>Roles</th><th>Groups</th><th>Status</th><th>Last Login</th><th></th></tr></thead>
              <tbody>
                {users.length === 0 && <tr><td colSpan="9" className="school-muted">No users found. Click "Add User" to create one.</td></tr>}
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name || u.user_name}</td>
                    <td>{u.user_id}</td>
                    <td>{u.email || '-'}</td>
                    <td>{u.phone || '-'}</td>
                    <td>{(u.roles || []).join(', ') || '-'}</td>
                    <td>{(u.group_names || []).join(', ') || '-'}</td>
                    <td><span className={`badge school-badge ${u.status === 'active' ? 'present' : u.status === 'inactive' ? 'late' : 'warning'}`}>{u.status || 'active'}</span></td>
                    <td>{dt(u.last_login)}</td>
                    <td className="text-end">
                      {canManage && (
                        <>
                          <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openUserModal(u)}><i className="bi bi-pencil"></i></button>
                          <button className="btn btn-sm btn-outline-warning me-1" onClick={() => toggleUserStatus(u)}><i className={u.status === 'active' ? 'bi bi-pause' : 'bi bi-play'}></i></button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => deleteUser(u)}><i className="bi bi-trash"></i></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========== APPROVALS ========== */}
      {section === 'approvals' && (
        <div className="school-grid-2">
          <section className="school-card">
            <header className="d-flex justify-content-between align-items-center">
              <h6>Approval Flows</h6>
              {canManage && <button className="btn btn-sm btn-primary" onClick={() => openFlowModal()}><i className="bi bi-plus-lg"></i> New Flow</button>}
            </header>
            {showFlowModal && (
              <div className="modal-overlay" onClick={() => { setShowFlowModal(false); setEditingFlow(null); setFlowForm({...blankFlow, steps: [{role:'',label:''}]}); }}>
                <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-content">
                    <div className="modal-header"><h6>{editingFlow ? 'Edit Flow' : 'New Approval Flow'}</h6><button className="btn-close" onClick={() => { setShowFlowModal(false); setEditingFlow(null); setFlowForm({...blankFlow, steps: [{role:'',label:''}]}); }}></button></div>
                    <form className="modal-body" onSubmit={handleFlowSubmit}>
                      <div className="row g-2 mb-2">
                        <div className="col-md-6"><label className="form-label small">Entity Type *</label><select className="form-select form-select-sm" value={flowForm.entity_type} onChange={e => setFlowForm({...flowForm, entity_type: e.target.value})} required><option value="">Select...</option><option value="fee_refund">Fee Refund</option><option value="expense">Expense</option><option value="leave">Leave</option><option value="admission">Admission</option><option value="purchase">Purchase</option><option value="custom">Custom</option></select></div>
                        <div className="col-md-6"><label className="form-label small">Flow Name *</label><input className="form-control form-control-sm" value={flowForm.name} onChange={e => setFlowForm({...flowForm, name: e.target.value})} required /></div>
                      </div>
                      <label className="form-label small">Steps (in order)</label>
                      {flowForm.steps.map((step, index) => (
                        <div key={index} className="row g-2 mb-2 align-items-end">
                          <div className="col-md-5"><label className="form-label small">Role *</label><select className="form-select form-select-sm" value={step.role} onChange={e => setFlowForm({...flowForm, steps: flowForm.steps.map((s,i)=>i===index?{...s,role:e.target.value}:s)})} required><option value="">Select role...</option>{roles.map(r=> <option key={r.id} value={r.code}>{r.name}</option>)}</select></div>
                          <div className="col-md-5"><label className="form-label small">Label</label><input className="form-control form-control-sm" value={step.label} onChange={e => setFlowForm({...flowForm, steps: flowForm.steps.map((s,i)=>i===index?{...s,label:e.target.value}:s)})} placeholder="e.g., Budget check" /></div>
                          <div className="col-md-2"><button type="button" className="btn btn-outline-danger w-100" onClick={() => removeFlowStep(index)} disabled={flowForm.steps.length <= 1}><i className="bi bi-trash"></i></button></div>
                        </div>
                      ))}
                      <div className="d-flex gap-2 mb-2"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={addFlowStep}><i className="bi bi-plus"></i> Add Step</button></div>
                      <div className="form-check mb-2"><input className="form-check-input" type="checkbox" checked={flowForm.is_active} onChange={e => setFlowForm({...flowForm, is_active: e.target.checked})} /><label className="form-check-label">Active</label></div>
                      <div className="modal-footer d-flex justify-content-end gap-2 mt-3">
                        <button type="button" className="btn btn-secondary" onClick={() => { setShowFlowModal(false); setEditingFlow(null); setFlowForm({...blankFlow, steps: [{role:'',label:''}]}); }}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}><i className="bi bi-check"></i> {editingFlow ? 'Update' : 'Create'}</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
            <div className="school-table-wrap">
              <table className="table table-sm school-table">
                <thead><tr><th>Entity Type</th><th>Name</th><th>Steps</th><th>Active</th><th></th></tr></thead>
                <tbody>
                  {(approvals.flows || []).length === 0 && <tr><td colSpan="5" className="school-muted">No approval flows configured. Click "New Flow" to create one.</td></tr>}
                  {(approvals.flows || []).map((f) => (
                    <tr key={f.id}>
                      <td>{f.entity_type}</td>
                      <td>{f.name}</td>
                      <td>{f.steps?.length || 0}</td>
                      <td><span className={`badge school-badge ${f.is_active ? 'present' : 'late'}`}>{f.is_active ? 'Yes' : 'No'}</span></td>
                      <td className="text-end">
                        {canManage && (
                          <>
                            <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openFlowModal(f)}><i className="bi bi-pencil"></i></button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => deleteFlow(f)}><i className="bi bi-trash"></i></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="school-card">
            <header><h6>Recent Requests</h6><span className="school-muted">{approvals.requests?.length || 0} request(s)</span></header>
            <div className="school-table-wrap">
              <table className="table table-sm school-table">
                <thead><tr><th>Entity</th><th>Record</th><th>Current Level</th><th>Status</th><th>Requested</th><th></th></tr></thead>
                <tbody>
                  {(approvals.requests || []).length === 0 && <tr><td colSpan="6" className="school-muted">No pending requests.</td></tr>}
                  {(approvals.requests || []).map((r) => (
                    <tr key={r.id}>
                      <td>{r.entity_type}</td>
                      <td>{r.entity_id}</td>
                      <td>Level {r.current_level}</td>
                      <td><span className={`badge school-badge ${r.status === 'pending' ? 'warning' : r.status === 'approved' ? 'present' : 'late'}`}>{r.status}</span></td>
                      <td>{dt(r.created_at)}</td>
                      <td className="text-end">
                        {canManage && r.status === 'pending' && (
                          <>
                            <button className="btn btn-sm btn-outline-success me-1" onClick={() => handleApprovalAction(r.id, 'approve')}>Approve</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleApprovalAction(r.id, 'reject')}>Reject</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========== INTEGRATIONS ========== */}
      {section === 'integrations' && (
        <section className="school-card">
          <header className="d-flex justify-content-between align-items-center">
            <h6>Integrations</h6>
            {canManage && <button className="btn btn-sm btn-primary" onClick={() => openIntegrationModal()}><i className="bi bi-plus-lg"></i> Add Integration</button>}
          </header>
          {showIntegrationModal && (
            <div className="modal-overlay" onClick={() => { setShowIntegrationModal(false); setEditingIntegration(null); setIntegrationForm({type:'',name:'',provider:'',config:{},isActive:false,isTestMode:false}); }}>
              <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
                <div className="modal-content">
                  <div className="modal-header"><h6>{editingIntegration ? 'Edit Integration' : 'New Integration'}</h6><button className="btn-close" onClick={() => { setShowIntegrationModal(false); setEditingIntegration(null); setIntegrationForm({type:'',name:'',provider:'',config:{},isActive:false,isTestMode:false}); }}></button></div>
                  <form className="modal-body" onSubmit={handleIntegrationSubmit}>
                    <div className="row g-2 mb-2">
                      <div className="col-md-4"><label className="form-label small">Type *</label><select className="form-select form-select-sm" value={integrationForm.type} onChange={e => setIntegrationForm({...integrationForm, type: e.target.value, provider: '', config: {}})} required><option value="">Select...</option><option value="sms">SMS</option><option value="email">Email</option><option value="push">Push</option><option value="payment">Payment</option><option value="sso">SSO</option><option value="webhook">Webhook</option></select></div>
                      <div className="col-md-4"><label className="form-label small">Provider *</label><select className="form-select form-select-sm" value={integrationForm.provider} onChange={e => setIntegrationForm({...integrationForm, provider: e.target.value, config: {}})} required disabled={!integrationForm.type}><option value="">Select type first</option>{integrationForm.type && INTEGRATION_CONFIG_FIELDS[integrationForm.type] && Object.keys(INTEGRATION_CONFIG_FIELDS[integrationForm.type]).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}</select></div>
                      <div className="col-md-4"><label className="form-label small">Name *</label><input className="form-control form-control-sm" value={integrationForm.name} onChange={e => setIntegrationForm({...integrationForm, name: e.target.value})} required /></div>
                    </div>
                    <div className="row g-2 mb-2">
                      <div className="col-12">
                        <label className="form-label small">Configuration</label>
                        {getConfigFields(integrationForm.type, integrationForm.provider).map((field, i) => (
                          <div key={i} className="row g-2 mb-2">
                            <div className="col-md-6"><label className="form-label small">{field.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</label><input className="form-control form-control-sm" value={integrationForm.config?.[field] || ''} onChange={e => setIntegrationForm({...integrationForm, config: {...integrationForm.config, [field]: e.target.value}})} /></div>
                          </div>
                        ))}
                        {!getConfigFields(integrationForm.type, integrationForm.provider).length && integrationForm.type && integrationForm.provider && <div className="text-muted small">No specific config fields for this provider.</div>}
                      </div>
                    </div>
                    <div className="row g-2 mb-2">
                      <div className="col-md-4"><div className="form-check mt-4"><input className="form-check-input" type="checkbox" checked={integrationForm.isActive} onChange={e => setIntegrationForm({...integrationForm, isActive: e.target.checked})} /><label className="form-check-label">Active</label></div></div>
                      <div className="col-md-4"><div className="form-check mt-4"><input className="form-check-input" type="checkbox" checked={integrationForm.isTestMode} onChange={e => setIntegrationForm({...integrationForm, isTestMode: e.target.checked})} /><label className="form-check-label">Test Mode</label></div></div>
                    </div>
                    <div className="modal-footer d-flex justify-content-end gap-2 mt-3">
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowIntegrationModal(false); setEditingIntegration(null); setIntegrationForm({type:'',name:'',provider:'',config:{},isActive:false,isTestMode:false}); }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={saving}><i className="bi bi-check"></i> {editingIntegration ? 'Update' : 'Create'}</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
          <div className="school-grid-3">
            {integrations.length === 0 ? (
              <div className="col-12 text-center py-4">
                <div className="text-muted">No integrations configured.</div>
                {canManage && <button className="btn btn-primary mt-2" onClick={() => openIntegrationModal()}><i className="bi bi-plus-lg"></i> Add Integration</button>}
              </div>
            ) : (
              integrations.map((int) => (
                <div className="col-md-4" key={int.id}>
                  <div className="school-card integration-card">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <div className="integration-icon"><i className={`bi ${int.type === 'sms' ? 'bi-chat-left-text' : int.type === 'email' ? 'bi-envelope' : int.type === 'push' ? 'bi-bell' : int.type === 'payment' ? 'bi-credit-card' : int.type === 'sso' ? 'bi-person-badge' : 'bi-box-arrow-up-right'}`}></i></div>
                        <strong>{int.name}</strong>
                        <div className="text-muted small">{int.provider}</div>
                      </div>
                      <span className={`badge school-badge ${int.is_active ? 'present' : 'late'}`}>{int.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="school-muted small mb-2">{JSON.stringify(int.config).slice(0,80)}...</div>
                    <div className="d-flex gap-2">
                      {canManage && <button className="btn btn-sm btn-outline-primary flex-grow-1" onClick={() => openIntegrationModal(int)}><i className="bi bi-gear"></i> Configure</button>}
                      {canManage && <button className="btn btn-sm btn-outline-danger" onClick={() => deleteIntegration(int)}><i className="bi bi-trash"></i></button>}
                      {int.is_active && <button className="btn btn-sm btn-outline-info" onClick={() => testIntegration(int)}><i className="bi bi-flask"></i> Test</button>}
                    </div>
                  </div>
                </div>
              )))}
          </div>
        </section>
      )}

      {/* ========== SUBSCRIPTION ========== */}
      {section === 'subscription' && (
        <section className="school-card">
          <header><h6>Subscription & Billing</h6></header>
          <div className="row g-3">
            <div className="col-md-6">
              <div className="school-card p-3">
                <h6>Current Plan</h6>
                <p className="fw-bold text-primary">{subscription.plan_name || 'Free Trial'}</p>
                <p className="school-muted">Status: <span className={`badge school-badge ${subscription.status === 'active' ? 'present' : 'late'}`}>{subscription.status || 'Active'}</span></p>
                <p className="school-muted">Billing: {subscription.billing_cycle || 'monthly'}</p>
                <p className="school-muted">Renews: {subscription.renewal_date ? dt(subscription.renewal_date) : 'N/A'}</p>
                {canManage && (
                  <div className="d-flex gap-2 mt-2">
                    <button className="btn btn-sm btn-primary" onClick={() => upgradePlan('pro')}>Upgrade to Pro</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => upgradePlan('enterprise')}>Enterprise</button>
                    {subscription.status === 'active' && <button className="btn btn-sm btn-outline-danger" onClick={cancelSubscription}>Cancel</button>}
                  </div>
                )}
              </div>
            </div>
            <div className="col-md-6">
              <div className="school-card p-3">
                <h6>Usage</h6>
                <div className="row g-2 text-center">
                  <div className="col-4"><div className="fw-bold">{subscription.students_count || 0}</div><div className="school-muted small">Students</div></div>
                  <div className="col-4"><div className="fw-bold">{subscription.staff_count || 0}</div><div className="school-muted small">Staff</div></div>
                  <div className="col-4"><div className="fw-bold">{subscription.campuses_count || 0}</div><div className="school-muted small">Campuses</div></div>
                </div>
              </div>
            </div>
            <div className="col-12">
              <div className="school-card p-3">
                <h6>Billing History</h6>
                <div className="school-table-wrap">
                  <table className="table table-sm school-table">
                    <thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th><th>Invoice</th></tr></thead>
                    <tbody>
                      <tr><td colSpan="5" className="school-muted">No billing history available.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="col-12">
              <div className="school-card p-3">
                <h6>Payment Methods</h6>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary" disabled><i className="bi bi-credit-card"></i> Add Payment Method</button>
                  <span className="text-muted small align-self-center">Configure in integration settings</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}