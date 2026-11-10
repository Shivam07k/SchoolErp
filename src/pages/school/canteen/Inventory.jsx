import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, moneyOrDash } from './shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', unit: 'pcs', category: 'raw', reorderLevel: 0, currentQty: 0 });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { loadItems(); }, []);

  async function loadItems() {
    setLoading(true);
    const d = await apiGet('/school/canteen/stock-items');
    if (d?.ok) setItems(d.items || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name?.trim()) return toast('Item name is required', 'error');
    try {
      const res = editingId
        ? await apiPut(`/school/canteen/stock-items/${editingId}`, form)
        : await apiPost('/school/canteen/stock-items', form);
      if (res?.ok) {
        toast(editingId ? 'Item updated' : 'Item created', 'success');
        setShowForm(false); setEditingId(null);
        setForm({ name: '', unit: 'pcs', category: 'raw', reorderLevel: 0, currentQty: 0 });
        loadItems();
      } else toast(res?.error || 'Save failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  function editItem(i) {
    setForm({ name: i.name, unit: i.unit || 'pcs', category: i.category || 'raw', reorderLevel: i.reorder_level || 0, currentQty: i.current_qty || 0 });
    setEditingId(i.id);
    setShowForm(true);
  }

  async function deleteItem(i) {
    if (!window.confirm(`Delete "${i.name}"?`)) return;
    try {
      const res = await apiDelete(`/school/canteen/stock-items/${i.id}`);
      if (res?.ok) { toast('Deleted', 'success'); loadItems(); }
      else toast(res?.error || 'Delete failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <PageShell title="Canteen Inventory" icon="bi-box-seam" subtitle={`${items.length} items`}>
      <div className="mb-3">
        <button className="btn btn-sm btn-primary" onClick={() => { setForm({ name: '', unit: 'pcs', category: 'raw', reorderLevel: 0, currentQty: 0 }); setEditingId(null); setShowForm(true); }}>
          <i className="bi bi-plus"></i> Add Stock Item
        </button>
      </div>

      {showForm && (
        <form className="school-form-card mb-3" onSubmit={handleSubmit}>
          <div className="school-form-head">
            <h6>{editingId ? 'Edit Stock Item' : 'New Stock Item'}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
          <div className="school-form-grid">
            <label>Name *<input className="form-control form-control-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></label>
            <label>Unit<input className="form-control form-control-sm" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} /></label>
            <label>Category<select className="form-select form-select-sm" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              <option value="raw">Raw</option><option value="packed">Packed</option>
            </select></label>
            <label>Reorder Level<input type="number" className="form-control form-control-sm" value={form.reorderLevel} onChange={e => setForm({...form, reorderLevel: e.target.value})} /></label>
            <label>Current Qty<input type="number" step="0.01" className="form-control form-control-sm" value={form.currentQty} onChange={e => setForm({...form, currentQty: e.target.value})} /></label>
            <div className="span-2 d-flex gap-2">
              <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-check"></i> {editingId ? 'Save' : 'Create'}</button>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Name</th><th>Unit</th><th>Category</th><th>Reorder Level</th><th>Current Qty</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7"><Loading /></td></tr> :
            items.length === 0 ? <tr><td colSpan="7"><Empty text="No stock items yet" /></td></tr> :
            items.map(i => (
              <tr key={i.id}>
                <td><strong>{i.name}</strong></td>
                <td>{i.unit}</td>
                <td>{i.category}</td>
                <td>{i.reorder_level}</td>
                <td>{i.current_qty}</td>
                <td>
                  <Badge status={i.current_qty <= i.reorder_level ? 'inactive' : 'active'}>
                    {i.current_qty <= i.reorder_level ? 'Low Stock' : 'OK'}
                  </Badge>
                </td>
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