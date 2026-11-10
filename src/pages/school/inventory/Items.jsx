import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, Empty } from '../fee/shared';

export default function InventoryItems({ me, onNavigate }) {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: '', name: '', categoryId: '', unit: 'pcs', trackingType: 'consumable', reorderLevel: 0, minQty: 0, batchRequired: false, expiryRequired: false });

  async function load() {
    setLoading(true);
    try {
      const [i, c] = await Promise.all([apiGet('/school/inventory/items'), apiGet('/school/inventory/categories')]);
      if (i?.ok) setItems(i.items||[]);
      if (c?.ok) setCats(c.categories||[]);
    } catch(e){ toast(e.message,'error'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{load();},[]);

  async function save(e){
    e.preventDefault();
    try {
      const res = await apiPost('/school/inventory/items', form);
      if(res?.ok){ toast('Item added','success'); setForm({ code: '', name: '', categoryId: '', unit: 'pcs', trackingType: 'consumable', reorderLevel: 0, minQty: 0, batchRequired: false, expiryRequired: false }); load(); }
      else toast(res?.error||'Failed','error');
    }catch(e){toast(e.message,'error');}
  }

  if(loading) return <Loading/>;
  return (
    <PageShell title="Inventory - Items" icon="bi-box" subtitle="Item master, categories, units, tracking type" onNavigate={onNavigate}>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card"><div className="card-body">
            <h6>Add Item</h6>
            <form onSubmit={save}>
              <div className="mb-2"><label className="form-label small">Code</label><input className="form-control form-control-sm" value={form.code} onChange={e=>setForm({...form,code:e.target.value})} required/></div>
              <div className="mb-2"><label className="form-label small">Name</label><input className="form-control form-control-sm" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
              <div className="mb-2"><label className="form-label small">Category</label><select className="form-select form-select-sm" value={form.categoryId} onChange={e=>setForm({...form,categoryId:e.target.value})}><option value="">Select</option>{cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="mb-2"><label className="form-label small">Unit</label><input className="form-control form-control-sm" value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></div>
              <div className="mb-2"><label className="form-label small">Tracking Type</label><select className="form-select form-select-sm" value={form.trackingType} onChange={e=>setForm({...form,trackingType:e.target.value})}><option value="consumable">Consumable</option><option value="returnable">Returnable</option><option value="fixed_asset">Fixed Asset</option></select></div>
              <div className="row g-2"><div className="col"><label className="form-label small">Reorder Level</label><input type="number" className="form-control form-control-sm" value={form.reorderLevel} onChange={e=>setForm({...form,reorderLevel:Number(e.target.value)})}/></div><div className="col"><label className="form-label small">Min Qty</label><input type="number" className="form-control form-control-sm" value={form.minQty} onChange={e=>setForm({...form,minQty:Number(e.target.value)})}/></div></div>
              <div className="form-check mt-2"><input className="form-check-input" type="checkbox" checked={form.batchRequired} onChange={e=>setForm({...form,batchRequired:e.target.checked})} id="b"/><label className="form-check-label small" htmlFor="b">Batch Required</label></div>
              <div className="form-check"><input className="form-check-input" type="checkbox" checked={form.expiryRequired} onChange={e=>setForm({...form,expiryRequired:e.target.checked})} id="e"/><label className="form-check-label small" htmlFor="e">Expiry Required</label></div>
              <button className="btn btn-sm btn-primary mt-2">Add Item</button>
            </form>
          </div></div>
        </div>
        <div className="col-lg-8">
          <div className="card"><div className="card-body">
            <h6>Items</h6>
            {items.length===0?<Empty icon="bi-box" text="No items"/>:(
              <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Unit</th><th>Type</th><th>Reorder</th></tr></thead><tbody>
                {items.map(i=><tr key={i.id}><td><code>{i.code}</code></td><td>{i.name}</td><td>{i.category_name||'-'}</td><td>{i.unit}</td><td>{i.tracking_type}</td><td>{i.reorder_level}</td></tr>)}
              </tbody></table></div>
            )}
          </div></div>
        </div>
      </div>
    </PageShell>
  );
}

