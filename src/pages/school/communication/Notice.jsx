import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_FORM = { title: '', description: '', audience: 'all', classId: '', sectionId: '', priority: 'normal', isPublished: true, isPinned: false, publishAt: '', expireAt: '' };
const AUDIENCES = [
  { value: 'all', label: 'All' },
  { value: 'students', label: 'Students' },
  { value: 'parents', label: 'Parents' },
  { value: 'staff', label: 'Staff' },
  { value: 'class', label: 'Specific class' },
  { value: 'section', label: 'Specific section' }
];

export default function CommunicationNotice() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadNotices();
    loadClasses();
  }, [statusFilter]);

  async function loadNotices() {
    setLoading(true);
    try {
      const d = await apiGet(`/school/communication/notices${statusFilter ? `?status=${statusFilter}` : ''}`);
      if (d?.ok) setNotices(d.notices || []);
      else toast(d?.error || 'Failed to load notices', 'error');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadClasses() {
    const d = await apiGet('/school/classes');
    if (d?.ok) setClasses(d.classes || []);
  }

  function targetIdFor(source) {
    if (source.audience === 'class') return source.classId;
    if (source.audience === 'section') return source.sectionId;
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title?.trim()) return toast('Title is required', 'error');
    if (form.audience === 'class' && !form.classId) return toast('Select a class', 'error');
    if (form.audience === 'section' && !form.sectionId) return toast('Select a section', 'error');
    const payload = { ...form, targetId: targetIdFor(form) };
    try {
      const res = editingId
        ? await apiPut(`/school/communication/notices/${editingId}`, payload)
        : await apiPost('/school/communication/notices', payload);
      if (res?.ok) {
        toast(editingId ? 'Notice updated' : 'Notice created', 'success');
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        loadNotices();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function editNotice(n) {
    const audience = n.audience || 'all';
    const target = Array.isArray(n.target_ids) ? n.target_ids[0] : '';
    setEditingId(n.id);
    setForm({
      title: n.title || '',
      description: n.body_html || n.description || '',
      audience,
      classId: audience === 'class' ? String(target || '') : '',
      sectionId: audience === 'section' ? String(target || '') : '',
      priority: n.priority || 'normal',
      isPublished: Boolean(n.is_published),
      isPinned: Boolean(n.is_pinned),
      publishAt: n.publish_at ? String(n.publish_at).slice(0, 10) : '',
      expireAt: n.expire_at ? String(n.expire_at).slice(0, 10) : ''
    });
    setShowForm(true);
  }

  async function deleteNotice(id) {
    if (!window.confirm('Delete this notice?')) return;
    try {
      const res = await apiDelete(`/school/communication/notices/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadNotices(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  const selectedClass = classes.find(c => String(c.id) === String(form.classId));
  const audienceLabel = (n) => {
    const a = n.audience || 'all';
    const target = Array.isArray(n.target_ids) ? n.target_ids[0] : null;
    if (a === 'class') {
      const cls = classes.find(c => c.id === target);
      return `Class: ${cls?.name || target || '—'}`;
    }
    if (a === 'section') {
      for (const c of classes) {
        const s = (c.sections || []).find(sec => sec.id === target);
        if (s) return `${c.name} / ${s.name}`;
      }
      return `Section ${target || '—'}`;
    }
    return a.charAt(0).toUpperCase() + a.slice(1);
  };

  return (
    <PageShell title="Notice Board" icon="bi-megaphone" subtitle={`${notices.length} notices`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New Notice
        </button>
        <select className="form-select form-select-sm" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Notice' : 'New Notice'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label className="span-2">Title *<input className="form-control form-control-sm" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
            <label>Audience<select className="form-select form-select-sm" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value, classId: '', sectionId: '' })}>
              {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select></label>
            {(form.audience === 'class' || form.audience === 'section') && (
              <label>Class *<select className="form-select form-select-sm" value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value, sectionId: '' })} required>
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
            )}
            {form.audience === 'section' && (
              <label>Section *<select className="form-select form-select-sm" value={form.sectionId} onChange={e => setForm({ ...form, sectionId: e.target.value })} required disabled={!form.classId}>
                <option value="">Select section</option>
                {(selectedClass?.sections || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></label>
            )}
            <label>Priority<select className="form-select form-select-sm" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select></label>
            <label>Publish Date<input type="date" className="form-control form-control-sm" value={form.publishAt} onChange={e => setForm({ ...form, publishAt: e.target.value })} /></label>
            <label>Expiry Date<input type="date" className="form-control form-control-sm" value={form.expireAt} onChange={e => setForm({ ...form, expireAt: e.target.value })} /></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.isPublished} onChange={e => setForm({ ...form, isPublished: e.target.checked })} /> Published</label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.isPinned} onChange={e => setForm({ ...form, isPinned: e.target.checked })} /> Pinned</label>
            <label className="span-2">Description<textarea className="form-control form-control-sm" rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Title</th><th>Audience</th><th>Priority</th><th>Status</th><th>Publish</th><th>Expiry</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Loading /></td></tr> :
            notices.length === 0 ? <tr><td colSpan={7}><Empty text="No notices yet" icon="bi-megaphone" /></td></tr> :
            notices.map(n => (
              <tr key={n.id}>
                <td>
                  <strong>{n.title}</strong>
                  {n.is_pinned ? <i className="bi bi-pin-angle ms-2 text-warning" title="Pinned"></i> : null}
                  {n.body_html ? <div className="text-muted small" style={{ maxWidth: 360, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(n.body_html).replace(/<[^>]*>/g, ' ')}</div> : null}
                </td>
                <td>{audienceLabel(n)}</td>
                <td><Badge status={n.priority}>{n.priority}</Badge></td>
                <td><Badge status={n.is_published ? 'published' : 'draft'}>{n.is_published ? 'published' : 'draft'}</Badge></td>
                <td>{n.publish_at ? fmtDate(n.publish_at) : '—'}</td>
                <td>{n.expire_at ? fmtDate(n.expire_at) : '—'}</td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editNotice(n)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteNotice(n.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
