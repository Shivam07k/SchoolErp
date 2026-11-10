import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function Books() {
  const [titles, setTitles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', author: '', isbn: '', publisher: '', category: '', edition: '', publishedYear: '' });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadTitles();
  }, []);

  async function loadTitles() {
    setLoading(true);
    try {
      const q = search ? `&q=${encodeURIComponent(search)}` : '';
      const d = await apiGet(`/school/library/titles${q}`);
      if (d?.ok) setTitles(d.titles || []);
      else toast(d?.error || 'Failed to load titles', 'error');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title?.trim()) return toast('Title is required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/library/titles/${editingId}`, form)
        : await apiPost('/school/library/titles', form);
      if (res?.ok) {
        toast(editingId ? 'Title updated' : 'Title created', 'success');
        setShowForm(false);
        setForm({ title: '', author: '', isbn: '', publisher: '', category: '', edition: '', publishedYear: '' });
        setEditingId(null);
        loadTitles();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editTitle(t) {
    setForm({ title: t.title, author: t.author || '', isbn: t.isbn || '', publisher: t.publisher || '', category: t.category || '', edition: t.edition || '', publishedYear: t.published_year || '' });
    setEditingId(t.id);
    setShowForm(true);
  }

  async function deleteTitle(t) {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    try {
      const res = await apiDelete(`/school/library/titles/${t.id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadTitles(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  const filteredTitles = search ? titles.filter(t => 
    (t.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.author || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.isbn || '').toLowerCase().includes(search.toLowerCase())
  ) : titles;

  return (
    <PageShell title="Library Books" icon="bi-book" subtitle={`${filteredTitles.length} titles`}>
      <div className="d-flex gap-2 mb-3">
        <input className="form-control form-control-sm" style={{width:300}} placeholder="Search title, author, ISBN" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-sm btn-primary" onClick={() => { setForm({ title: '', author: '', isbn: '', publisher: '', category: '', edition: '', publishedYear: '' }); setEditingId(null); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Add Title
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Title' : 'New Title'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Title *<input className="form-control form-control-sm" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></label>
            <label>Author<input className="form-control form-control-sm" value={form.author} onChange={e => setForm({...form, author: e.target.value})} /></label>
            <label>ISBN<input className="form-control form-control-sm" value={form.isbn} onChange={e => setForm({...form, isbn: e.target.value})} /></label>
            <label>Publisher<input className="form-control form-control-sm" value={form.publisher} onChange={e => setForm({...form, publisher: e.target.value})} /></label>
            <label>Category<input className="form-control form-control-sm" value={form.category} onChange={e => setForm({...form, category: e.target.value})} /></label>
            <label>Edition<input className="form-control form-control-sm" value={form.edition} onChange={e => setForm({...form, edition: e.target.value})} /></label>
            <label>Published Year<input type="number" className="form-control form-control-sm" value={form.publishedYear} onChange={e => setForm({...form, publishedYear: e.target.value})} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Category</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="6"><Loading /></td></tr> :
            filteredTitles.length === 0 ? <tr><td colSpan="6"><Empty text="No titles found" /></td></tr> :
            filteredTitles.map(t => (
              <tr key={t.id}>
                <td><strong>{t.title}</strong></td>
                <td>{t.author || 'Ã¢â‚¬â€'}</td>
                <td><code>{t.isbn || 'Ã¢â‚¬â€'}</code></td>
                <td>{t.category || 'Ã¢â‚¬â€'}</td>
                <td><Badge status={t.status}>{t.status}</Badge></td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editTitle(t)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteTitle(t)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
