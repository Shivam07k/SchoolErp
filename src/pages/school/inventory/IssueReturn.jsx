import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, Empty } from '../fee/shared';

export default function InventoryIssueReturn({ me, onNavigate }) {
  const [issues, setIssues] = useState([]);
  const [returns, setReturns] = useState([]);
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issueForm, setIssueForm] = useState({ storeId:'', issuedToType:'staff', issuedToId:'', issuedToName:'', purpose:'', expectedReturnDate:'', lines:[{itemId:'',qty:''}]});
  const [returnForm, setReturnForm] = useState({ issueId:'', storeId:'', lines:[{issueLineId:'',itemId:'',qty:'',condition:'good'}]});

  async function load(){
    setLoading(true);
    try {
      const [iss,ret,it,s] = await Promise.all([apiGet('/school/inventory/issues'),apiGet('/school/inventory/returns'),apiGet('/school/inventory/items'),apiGet('/school/inventory/stores')]);
      if(iss?.ok)setIssues(iss.issues||[]); if(ret?.ok)setReturns(ret.returns||[]); if(it?.ok)setItems(it.items||[]); if(s?.ok)setStores(s.stores||[]);
    }catch(e){toast(e.message,'error');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);

  function addIL(){ setIssueForm({...issueForm,lines:[...issueForm.lines,{itemId:'',qty:''}]}); }
  function setIL(i,f,v){ const l=[...issueForm.lines]; l[i][f]=v; setIssueForm({...issueForm,lines:l}); }
  function addRL(){ setReturnForm({...returnForm,lines:[...returnForm.lines,{issueLineId:'',itemId:'',qty:'',condition:'good'}]}); }
  function setRL(i,f,v){ const l=[...returnForm.lines]; l[i][f]=v; setReturnForm({...returnForm,lines:l}); }

  async function createIssue(e){ e.preventDefault(); try{ const res=await apiPost('/school/inventory/issues', issueForm); if(res?.ok){toast('Issued','success'); setIssueForm({ storeId:'', issuedToType:'staff', issuedToId:'', issuedToName:'', purpose:'', expectedReturnDate:'', lines:[{itemId:'',qty:''}]}); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}
  async function createReturn(e){ e.preventDefault(); try{ const res=await apiPost('/school/inventory/returns', returnForm); if(res?.ok){toast('Returned','success'); setReturnForm({ issueId:'', storeId:'', lines:[{issueLineId:'',itemId:'',qty:'',condition:'good'}]}); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}

  if(loading) return <Loading/>;
  return (
    <PageShell title="Inventory - Issue/Return" icon="bi-arrow-left-right" subtitle="Fast issue, returnable tracking, accountability" onNavigate={onNavigate}>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card mb-3"><div className="card-body"><h6>Issue Item</h6>
            <form onSubmit={createIssue}>
              <div className="mb-2"><label className="form-label small">Store</label><select className="form-select form-select-sm" value={issueForm.storeId} onChange={e=>setIssueForm({...issueForm,storeId:e.target.value})}><option value="">Select</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="mb-2"><label className="form-label small">Issued To Type</label><select className="form-select form-select-sm" value={issueForm.issuedToType} onChange={e=>setIssueForm({...issueForm,issuedToType:e.target.value})}><option value="staff">Staff</option><option value="department">Department</option><option value="room">Room</option><option value="class">Class</option><option value="student">Student</option></select></div>
              <div className="mb-2"><label className="form-label small">Name/ID</label><input className="form-control form-control-sm" value={issueForm.issuedToName} onChange={e=>setIssueForm({...issueForm,issuedToName:e.target.value})}/></div>
              <div className="mb-2"><label className="form-label small">Expected Return</label><input type="date" className="form-control form-control-sm" value={issueForm.expectedReturnDate} onChange={e=>setIssueForm({...issueForm,expectedReturnDate:e.target.value})}/></div>
              <div className="mb-2"><label className="form-label small">Purpose</label><input className="form-control form-control-sm" value={issueForm.purpose} onChange={e=>setIssueForm({...issueForm,purpose:e.target.value})}/></div>
              <label className="form-label small">Items</label>
              {issueForm.lines.map((l,idx)=>(<div key={idx} className="border rounded p-2 mb-2"><select className="form-select form-select-sm mb-1" value={l.itemId} onChange={e=>setIL(idx,'itemId',e.target.value)}><option value="">Item</option>{items.map(it=><option key={it.id} value={it.id}>{it.name}</option>)}</select><input type="number" placeholder="Qty" className="form-control form-control-sm" value={l.qty} onChange={e=>setIL(idx,'qty',e.target.value)}/></div>))}
              <button type="button" className="btn btn-sm btn-outline-secondary mb-2" onClick={addIL}>+ Add Line</button>
              <button className="btn btn-sm btn-primary w-100">Issue</button>
            </form>
          </div></div>
          <div className="card"><div className="card-body"><h6>Return</h6>
            <form onSubmit={createReturn}>
              <div className="mb-2"><label className="form-label small">Store</label><select className="form-select form-select-sm" value={returnForm.storeId} onChange={e=>setReturnForm({...returnForm,storeId:e.target.value})}><option value="">Select</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="mb-2"><label className="form-label small">Issue ID</label><input className="form-control form-control-sm" value={returnForm.issueId} onChange={e=>setReturnForm({...returnForm,issueId:e.target.value})}/></div>
              <label className="form-label small">Lines</label>
              {returnForm.lines.map((l,idx)=>(<div key={idx} className="border rounded p-2 mb-2"><input placeholder="Issue Line ID" className="form-control form-control-sm mb-1" value={l.issueLineId} onChange={e=>setRL(idx,'issueLineId',e.target.value)}/><select className="form-select form-select-sm mb-1" value={l.itemId} onChange={e=>setRL(idx,'itemId',e.target.value)}><option value="">Item</option>{items.map(it=><option key={it.id} value={it.id}>{it.name}</option>)}</select><div className="row g-1"><div className="col"><input type="number" placeholder="Qty" className="form-control form-control-sm" value={l.qty} onChange={e=>setRL(idx,'qty',e.target.value)}/></div><div className="col"><select className="form-select form-select-sm" value={l.condition} onChange={e=>setRL(idx,'condition',e.target.value)}><option value="good">Good</option><option value="damaged">Damaged</option></select></div></div></div>))}
              <button type="button" className="btn btn-sm btn-outline-secondary mb-2" onClick={addRL}>+ Add Line</button>
              <button className="btn btn-sm btn-primary w-100">Return</button>
            </form>
          </div></div>
        </div>
        <div className="col-lg-8">
          <div className="card mb-3"><div className="card-body"><h6>Issues</h6>
            {issues.length===0?<Empty icon="bi-box-arrow-up" text="No issues"/>:(
              <div className="table-responsive"><table className="table table-sm"><thead><tr><th>No</th><th>To</th><th>Type</th><th>Date</th><th>Status</th></tr></thead><tbody>
                {issues.map(x=><tr key={x.id}><td><code>{x.issue_no}</code></td><td>{x.issued_to_name||'-'}</td><td>{x.issued_to_type}</td><td>{x.issue_date}</td><td>{x.status}</td></tr>)}
              </tbody></table></div>
            )}
          </div></div>
          <div className="card"><div className="card-body"><h6>Returns</h6>
            {returns.length===0?<Empty icon="bi-box-arrow-in-left" text="No returns"/>:(
              <div className="table-responsive"><table className="table table-sm"><thead><tr><th>No</th><th>Issue</th><th>Date</th></tr></thead><tbody>
                {returns.map(x=><tr key={x.id}><td><code>{x.return_no}</code></td><td>{x.issue_id}</td><td>{x.return_date}</td></tr>)}
              </tbody></table></div>
            )}
          </div></div>
        </div>
      </div>
    </PageShell>
  );
}

