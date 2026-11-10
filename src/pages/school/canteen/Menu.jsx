import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, moneyOrDash } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function Menu() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'snack', price: '', tax: 0, veg: true, allergens: '', image: '', active: true, notes: '' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { loadItems(); }, []);

  async function loadItems() {
    setLoading(true);
    const d = await apiGet('/school/canteen/menu-items');
    if (d?.ok) setItems(d.items || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name?.trim()) return toast('Item name is required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/canteen/menu-items/${editingId}`, form)
        : await apiPost('/school/canteen/menu-items', form);
      if (res?.ok) {
        toast(editingId ? 'Item updated' : 'Item created', 'success');
        setShowForm(false); setEditingId(null);
        setForm({ name: '', category: 'snack', price: '', tax: 0, veg: true, allergens: '', image: '', active: true, notes: '' });
        loadItems();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editItem(i) {
    setForm({ name: i.name, category: i.category || 'snack', price: i.price || '', tax: i.tax || 0, veg: i.veg, allergens: i.allergens || '', image: i.image || '', active: i.active, notes: i.notes || '' });
    setEditingId(i.id);
    setShowForm(true);
  }

  async function deleteItem(i) {
    if (!window.confirm(`Delete "${i.name}"?`)) return;
    try {
      const res = await apiDelete(`/school/canteen/menu-items/${i.id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadItems(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Canteen Menu" icon="bi-cup-hot" subtitle={`${items.length} items`}>
      <div className="mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setForm({ name: '', category: 'snack', price: '', tax: 0, veg: true, allergens: '', image: '', active: true, notes: '' }); setEditingId(null); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Add Item
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Item' : 'New Menu Item'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Name *<input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></label>
            <label>Category<select className="form-select form-select-sm" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              <option value="snack">Snack</option><option value="meal">Meal</option><option value="beverage">Beverage</option><option value="packed">Packed</option>
            </select></label>
            <label>Price<input type="number" step="0.01" className="form-control form-control-sm" value={form.price} onChange={e => setForm({...form, price: e.target.value})} /></label>
            <label>Tax %<input type="number" step="0.01" className="form-control form-control-sm" value={form.tax} onChange={e => setForm({...form, tax: e.target.value})} /></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.veg} onChange={e => setForm({...form, veg: e.target.checked})} /> Vegetarian</label>
            <label>Allergens<input className="form-control form-control-sm" value={form.allergens} onChange={e => setForm({...form, allergens: e.target.value})} placeholder="Comma separated" /></label>
            <label>Image URL<input className="form-control form-control-sm" value={form.image} onChange={e => setForm({...form, image: e.target.value})} /></label>
            <label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} /> Active</label>
            <label className="span-2">Notes<textarea className="form-control form-control-sm" rows="2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Tax</th><th>Veg</th><th>Allergens</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="8"><Loading /></td></tr> :
            items.length === 0 ? <tr><td colSpan="8"><Empty text="No menu items yet" /></td></tr> :
            items.map(i => (
              <tr key={i.id}>
                <td><strong>{i.name}</strong></td>
                <td>{i.category}</td>
                <td>{moneyOrDash(i.price)}</td>
                <td>{i.tax}%</td>
                <td><Badge status={i.veg ? 'active' : 'inactive'}>{i.veg ? 'Yes' : 'No'}</Badge></td>
                <td>{i.allergens || 'Ã¢â‚¬â€'}</td>
                <td><Badge status={i.active ? 'active' : 'inactive'}>{i.active ? 'Yes' : 'No'}</Badge></td>
                <td className="text-end no-print">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editItem(i)}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteItem(i)}><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
