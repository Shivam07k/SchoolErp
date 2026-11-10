import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, Empty } from '../fee/shared';

export default function InventoryPurchase({ me, onNavigate }) {
  const [indents, setIndents] = useState([]);
  const [pos, setPos] = useState([]);
  const [grns, setGrns] = useState([]);
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [indentForm, setIndentForm] = useState({ department:'', storeId:'', notes:'', lines:[{itemId:'',qty:'',approxRate:'',reason:''}]});
  const [poForm, setPoForm] = useState({ indentId:'', vendorId:'', storeId:'', orderDate:'', expectedDate:'', notes:'', lines:[{itemId:'',qty:'',rate:'',taxRate:'0'}]});

  async function load(){
    setLoading(true);
    try {
      const [i,p,g,it,v,s] = await Promise.all([apiGet('/school/inventory/indents'),apiGet('/school/inventory/pos'),apiGet('/school/inventory/grns'),apiGet('/school/inventory/items'),apiGet('/school/inventory/vendors'),apiGet('/school/inventory/stores')]);
      if(i?.ok)setIndents(i.indents||[]); if(p?.ok)setPos(p.pos||[]); if(g?.ok)setGrns(g.grns||[]); if(it?.ok)setItems(it.items||[]); if(v?.ok)setVendors(v.vendors||[]); if(s?.ok)setStores(s.stores||[]);
    }catch(e){toast(e.message,'error');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);

  function addLine(){ setIndentForm({...indentForm, lines:[...indentForm.lines,{itemId:'',qty:'',approxRate:'',reason:''}]}); }
  function setLine(idx,field,val){ const l=[...indentForm.lines]; l[idx][field]=val; setIndentForm({...indentForm,lines:l}); }

  async function createIndent(e){ e.preventDefault(); try{ const res=await apiPost('/school/inventory/indents', indentForm); if(res?.ok){toast('Indent created','success'); setIndentForm({ department:'', storeId:'', notes:'', lines:[{itemId:'',qty:'',approxRate:'',reason:''}]}); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}
  async function approveIndent(id){ try{ const res=await apiPut(`/school/inventory/indents/${id}/approve`, {}); if(res?.ok){toast('Approved','success'); load();}else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}
  async function createPO(e){ e.preventDefault(); try{ const res=await apiPost('/school/inventory/pos', poForm); if(res?.ok){toast('PO created','success'); setPoForm({ indentId:'', vendorId:'', storeId:'', orderDate:'', expectedDate:'', notes:'', lines:[{itemId:'',qty:'',rate:'',taxRate:'0'}]}); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}

  if(loading) return <Loading/>;
  return (
    <PageShell title="Inventory - Purchase" icon="bi-cart" subtitle="Indents ? PO ? GRN ? Bill" onNavigate={onNavigate}>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card mb-3"><div className="card-body"><h6>New Indent</h6>
            <form onSubmit={createIndent}>
              <div className="mb-2"><label className="form-label small">Department</label><input className="form-control form-control-sm" value={indentForm.department} onChange={e=>setIndentForm({...indentForm,department:e.target.value})}/></div>
              <div className="mb-2"><label className="form-label small">Store</label><select className="form-select form-select-sm" value={indentForm.storeId} onChange={e=>setIndentForm({...indentForm,storeId:e.target.value})}><option value="">Select</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="mb-2"><label className="form-label small">Notes</label><input className="form-control form-control-sm" value={indentForm.notes} onChange={e=>setIndentForm({...indentForm,notes:e.target.value})}/></div>
              <label className="form-label small">Lines</label>
              {indentForm.lines.map((l,idx)=>(<div key={idx} className="border rounded p-2 mb-2">
                <select className="form-select form-select-sm mb-1" value={l.itemId} onChange={e=>setLine(idx,'itemId',e.target.value)}><option value="">Item</option>{items.map(it=><option key={it.id} value={it.id}>{it.name}</option>)}</select>
                <div className="row g-1"><div className="col"><input type="number" placeholder="Qty" className="form-control form-control-sm" value={l.qty} onChange={e=>setLine(idx,'qty',e.target.value)}/></div><div className="col"><input type="number" placeholder="Rate" className="form-control form-control-sm" value={l.approxRate} onChange={e=>setLine(idx,'approxRate',e.target.value)}/></div></div>
              </div>))}
              <button type="button" className="btn btn-sm btn-outline-secondary mb-2" onClick={addLine}>+ Add Line</button>
              <button className="btn btn-sm btn-primary w-100">Submit Indent</button>
            </form>
          </div></div>
          <div className="card"><div className="card-body"><h6>New PO</h6>
            <form onSubmit={createPO}>
              <div className="mb-2"><label className="form-label small">Vendor</label><select className="form-select form-select-sm" value={poForm.vendorId} onChange={e=>setPoForm({...poForm,vendorId:e.target.value})}><option value="">Select</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
              <div className="mb-2"><label className="form-label small">Store</label><select className="form-select form-select-sm" value={poForm.storeId} onChange={e=>setPoForm({...poForm,storeId:e.target.value})}><option value="">Select</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <button className="btn btn-sm btn-primary w-100">Create PO</button>
            </form>
          </div></div>
        </div>
        <div className="col-lg-8">
          <div className="card mb-3"><div className="card-body"><h6>Indents</h6>
            {indents.length===0?<Empty icon="bi-file-earmark-text" text="No indents"/>:(
              <div className="table-responsive"><table className="table table-sm"><thead><tr><th>No</th><th>Dept</th><th>Status</th><th></th></tr></thead><tbody>
                {indents.map(x=><tr key={x.id}><td><code>{x.indent_no}</code></td><td>{x.department||'-'}</td><td><span className="badge bg-info">{x.status}</span></td><td className="text-end">{x.status==='submitted'&&<button className="btn btn-sm btn-outline-success" onClick={()=>approveIndent(x.id)}>Approve</button>}</td></tr>)}
              </tbody></table></div>
            )}
          </div></div>
          <div className="card mb-3"><div className="card-body"><h6>Purchase Orders</h6>
            {pos.length===0?<Empty icon="bi-receipt" text="No POs"/>:(
              <div className="table-responsive"><table className="table table-sm"><thead><tr><th>No</th><th>Vendor</th><th>Status</th><th>Total</th></tr></thead><tbody>
                {pos.map(x=><tr key={x.id}><td><code>{x.po_no}</code></td><td>{x.vendor_name||'-'}</td><td>{x.status}</td><td>{x.total}</td></tr>)}
              </tbody></table></div>
            )}
          </div></div>
          <div className="card"><div className="card-body"><h6>GRNs</h6>
            {grns.length===0?<Empty icon="bi-box-arrow-in-down" text="No GRNs"/>:(
              <div className="table-responsive"><table className="table table-sm"><thead><tr><th>No</th><th>PO</th><th>Date</th></tr></thead><tbody>
                {grns.map(x=><tr key={x.id}><td><code>{x.grn_no}</code></td><td>{x.po_no||'-'}</td><td>{x.grn_date}</td></tr>)}
              </tbody></table></div>
            )}
          </div></div>
        </div>
      </div>
    </PageShell>
  );
}

