import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, Empty } from '../fee/shared';

export default function InventoryAssets({ me, onNavigate }) {
  const [assets, setAssets] = useState([]);
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ tagNo:'', itemId:'', categoryId:'', serialNo:'', cost:'', location:'', custodianUserId:'', purchaseDate:'', status:'in_use'});

  async function load(){
    setLoading(true);
    try {
      const [a,i,c] = await Promise.all([apiGet('/school/inventory/assets'),apiGet('/school/inventory/items'),apiGet('/school/inventory/categories')]);
      if(a?.ok)setAssets(a.assets||[]); if(i?.ok)setItems(i.items||[]); if(c?.ok)setCats(c.categories||[]);
    }catch(e){toast(e.message,'error');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);

  async function save(e){ e.preventDefault(); try{ const res=await apiPost('/school/inventory/assets', form); if(res?.ok){toast('Asset added','success'); setForm({ tagNo:'', itemId:'', categoryId:'', serialNo:'', cost:'', location:'', custodianUserId:'', purchaseDate:'', status:'in_use' }); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}

  if(loading) return <Loading/>;
  return (
    <PageShell title="Inventory - Assets" icon="bi-hdd-stack" subtitle="Asset register, tags, location, custodian, lifecycle" onNavigate={onNavigate}>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card"><div className="card-body"><h6>Add Asset</h6>
            <form onSubmit={save}>
              <div className="mb-2"><label className="form-label small">Tag No</label><input className="form-control form-control-sm" value={form.tagNo} onChange={e=>setForm({...form,tagNo:e.target.value})} required/></div>
              <div className="mb-2"><label className="form-label small">Item</label><select className="form-select form-select-sm" value={form.itemId} onChange={e=>setForm({...form,itemId:e.target.value})}><option value="">Select</option>{items.map(it=><option key={it.id} value={it.id}>{it.name}</option>)}</select></div>
              <div className="mb-2"><label className="form-label small">Category</label><select className="form-select form-select-sm" value={form.categoryId} onChange={e=>setForm({...form,categoryId:e.target.value})}><option value="">Select</option>{cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="mb-2"><label className="form-label small">Serial No</label><input className="form-control form-control-sm" value={form.serialNo} onChange={e=>setForm({...form,serialNo:e.target.value})}/></div>
              <div className="row g-2"><div className="col"><label className="form-label small">Cost</label><input type="number" className="form-control form-control-sm" value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})}/></div><div className="col"><label className="form-label small">Purchase Date</label><input type="date" className="form-control form-control-sm" value={form.purchaseDate} onChange={e=>setForm({...form,purchaseDate:e.target.value})}/></div></div>
              <div className="mb-2"><label className="form-label small">Location</label><input className="form-control form-control-sm" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></div>
              <div className="mb-2"><label className="form-label small">Custodian User ID</label><input className="form-control form-control-sm" value={form.custodianUserId} onChange={e=>setForm({...form,custodianUserId:e.target.value})}/></div>
              <button className="btn btn-sm btn-primary mt-2">Add Asset</button>
            </form>
          </div></div>
        </div>
        <div className="col-lg-8">
          <div className="card"><div className="card-body"><h6>Asset Register</h6>
            {assets.length===0?<Empty icon="bi-hdd-stack" text="No assets"/>:(
              <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Tag</th><th>Item</th><th>Category</th><th>Location</th><th>Custodian</th><th>Status</th><th>Cost</th></tr></thead><tbody>
                {assets.map(a=><tr key={a.id}><td><code>{a.tag_no}</code></td><td>{a.item_name||'-'}</td><td>{a.category_name||'-'}</td><td>{a.location||'-'}</td><td>{a.custodian_user_id||'-'}</td><td>{a.status}</td><td>{a.cost}</td></tr>)}
              </tbody></table></div>
            )}
          </div></div>
        </div>
      </div>
    </PageShell>
  );
}

