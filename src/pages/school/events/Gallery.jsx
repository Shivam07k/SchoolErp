import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

const EMPTY_FORM = { title: '', description: '', visibility: 'private', eventId: '', classId: '', sectionId: '' };

export default function EventsGallery() {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [events, setEvents] = useState([]);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    loadAlbums();
    loadRefs();
  }, []);

  async function loadAlbums() {
    setLoading(true);
    try {
      const d = await apiGet('/school/events/gallery/albums');
      if (d?.ok) setAlbums(d.albums || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function loadRefs() {
    const [ev, cls] = await Promise.all([
      apiGet('/school/events'),
      apiGet('/school/classes')
    ]);
    if (ev?.ok) setEvents(ev.events || []);
    if (cls?.ok) setClasses(cls.classes || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title?.trim()) return toast('Title is required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/events/gallery/albums/${editingId}`, form)
        : await apiPost('/school/events/gallery/albums', form);
      if (res?.ok) { toast(editingId ? 'Album updated' : 'Album created', 'success'); setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); loadAlbums(); }
      else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editAlbum(a) {
    setEditingId(a.id);
    setForm({ title: a.title, description: a.description || '', visibility: a.visibility, eventId: a.event_id || '', classId: a.class_id || '', sectionId: a.section_id || '' });
    setShowForm(true);
  }

  async function deleteAlbum(id) {
    if (!window.confirm('Delete this album?')) return;
    try {
      const res = await apiDelete(`/school/events/gallery/albums/${id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadAlbums(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  const selectedClass = classes.find(c => String(c.id) === String(form.classId));
  const eventName = (id) => events.find(e => e.id === id)?.title || (id ? `Event ${id}` : '—');

  return (
    <PageShell title="Photo Gallery" icon="bi-images" subtitle={`${albums.length} albums`}>
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}>
          <i className="bi bi-plus"></i> New Album
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Album' : 'New Album'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Title *<input className="form-control form-control-sm" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
            <label>Visibility<select className="form-select form-select-sm" value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}>
              <option value="private">Private</option><option value="school">School</option><option value="class">Class</option><option value="public">Public</option>
            </select></label>
            <label>Event<select className="form-select form-select-sm" value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })}>
              <option value="">None</option>
              {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select></label>
            <label>Class<select className="form-select form-select-sm" value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value, sectionId: '' })}>
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
            <label>Section<select className="form-select form-select-sm" value={form.sectionId} onChange={e => setForm({ ...form, sectionId: e.target.value })} disabled={!form.classId}>
              <option value="">All sections</option>
              {(selectedClass?.sections || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <label className="span-2">Description<textarea className="form-control form-control-sm" rows="2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Title</th><th>Event</th><th>Visibility</th><th>Media</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><Loading /></td></tr> :
            albums.length === 0 ? <tr><td colSpan={6}><Empty text="No albums yet" icon="bi-images" /></td></tr> :
            albums.map(a => (
              <tr key={a.id}>
                <td><strong>{a.title}</strong>{a.description ? <div className="text-muted small">{a.description}</div> : null}</td>
                <td>{eventName(a.event_id)}</td>
                <td><Badge status={a.visibility}>{a.visibility}</Badge></td>
                <td>{a.media_count || 0}</td>
                <td>{a.created_at ? fmtDate(a.created_at) : '—'}</td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editAlbum(a)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteAlbum(a.id)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
