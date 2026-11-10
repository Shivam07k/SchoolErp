import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, Empty } from '../fee/shared';

export default function TransportAllocation({ me, onNavigate }) {
  const [allocs, setAllocs] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [trips, setTrips] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ studentId:'', routeId:'', tripId:'', pickStopId:'', dropStopId:'', seatNo:'', fromDate:'' });
  const [rform, setRform] = useState({ studentId:'', reqType:'new', routeId:'', pickStopId:'', dropStopId:'', effectiveDate:'', reason:'' });

  async function load(){
    setLoading(true);
    try {
      const [a,req,r,s,t,st] = await Promise.all([apiGet('/school/transport/allocations'),apiGet('/school/transport/requests'),apiGet('/school/transport/routes'),apiGet('/school/transport/stops'),apiGet('/school/transport/trips'),apiGet('/school/students?limit=100')]);
      if(a?.ok)setAllocs(a.allocations||[]); if(req?.ok)setReqs(req.requests||[]); if(r?.ok)setRoutes(r.routes||[]); if(s?.ok)setStops(s.stops||[]); if(t?.ok)setTrips(t.trips||[]); if(st?.ok)setStudents(st.students||[]);
    }catch(e){toast(e.message,'error');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);

  async function saveAlloc(e){ e.preventDefault(); try{ const res=await apiPost('/school/transport/allocations', form); if(res?.ok){toast('Allocated','success'); setForm({ studentId:'', routeId:'', tripId:'', pickStopId:'', dropStopId:'', seatNo:'', fromDate:'' }); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}
  async function saveReq(e){ e.preventDefault(); try{ const res=await apiPost('/school/transport/requests', rform); if(res?.ok){toast('Request submitted','success'); setRform({ studentId:'', reqType:'new', routeId:'', pickStopId:'', dropStopId:'', effectiveDate:'', reason:'' }); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}
  async function approveReq(id){ try{ const res=await apiPut(`/school/transport/requests/${id}/approve`, {}); if(res?.ok){toast('Approved','success'); load();}else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}

  if(loading) return <Loading/>;
  return (
    <PageShell title="Transport - Student Allocation" icon="bi-people" subtitle="Allocate students to stops/trips, requests, approvals" onNavigate={onNavigate}>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card mb-3"><div className="card-body"><h6>New Allocation</h6>
            <form onSubmit={saveAlloc}>
              <div className="mb-2"><select className="form-select form-select-sm" value={form.studentId} onChange={e=>setForm({...form,studentId:e.target.value})}><option value="">Student</option>{students.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_no})</option>)}</select></div>
              <div className="mb-2"><select className="form-select form-select-sm" value={form.routeId} onChange={e=>setForm({...form,routeId:e.target.value})}><option value="">Route</option>{routes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div className="mb-2"><select className="form-select form-select-sm" value={form.tripId} onChange={e=>setForm({...form,tripId:e.target.value})}><option value="">Trip</option>{trips.map(t=><option key={t.id} value={t.id}>{t.trip_type}</option>)}</select></div>
              <div className="row g-1 mb-2"><div className="col"><select className="form-select form-select-sm" value={form.pickStopId} onChange={e=>setForm({...form,pickStopId:e.target.value})}><option value="">Pick Stop</option>{stops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="col"><select className="form-select form-select-sm" value={form.dropStopId} onChange={e=>setForm({...form,dropStopId:e.target.value})}><option value="">Drop Stop</option>{stops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div>
              <div className="row g-1 mb-2"><div className="col"><input className="form-control form-control-sm" placeholder="Seat" value={form.seatNo} onChange={e=>setForm({...form,seatNo:e.target.value})}/></div><div className="col"><input type="date" className="form-control form-control-sm" value={form.fromDate} onChange={e=>setForm({...form,fromDate:e.target.value})}/></div></div>
              <button className="btn btn-sm btn-primary w-100">Allocate</button>
            </form>
          </div></div>
          <div className="card"><div className="card-body"><h6>Request (Change/New/Cancel)</h6>
            <form onSubmit={saveReq}>
              <div className="mb-2"><select className="form-select form-select-sm" value={rform.studentId} onChange={e=>setRform({...rform,studentId:e.target.value})}><option value="">Student</option>{students.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select></div>
              <div className="mb-2"><select className="form-select form-select-sm" value={rform.reqType} onChange={e=>setRform({...rform,reqType:e.target.value})}><option value="new">New</option><option value="change">Change</option><option value="cancel">Cancel</option></select></div>
              <div className="mb-2"><input type="date" className="form-control form-control-sm" value={rform.effectiveDate} onChange={e=>setRform({...rform,effectiveDate:e.target.value})}/></div>
              <div className="mb-2"><input className="form-control form-control-sm" placeholder="Reason" value={rform.reason} onChange={e=>setRform({...rform,reason:e.target.value})}/></div>
              <button className="btn btn-sm btn-primary w-100">Submit Request</button>
            </form>
          </div></div>
        </div>
        <div className="col-lg-8">
          <div className="card mb-3"><div className="card-body"><h6>Active Allocations</h6>
            {allocs.length===0?<Empty icon="bi-people" text="No allocations"/>:(<div className="table-responsive"><table className="table table-sm"><thead><tr><th>Student</th><th>Adm No</th><th>Route</th><th>Pick</th><th>Drop</th><th>Seat</th></tr></thead><tbody>{allocs.map(a=><tr key={a.id}><td>{a.first_name} {a.last_name}</td><td>{a.admission_no}</td><td>{a.route_name}</td><td>{a.pick_stop||'-'}</td><td>{a.drop_stop||'-'}</td><td>{a.seat_no||'-'}</td></tr>)}</tbody></table></div>)}
          </div></div>
          <div className="card"><div className="card-body"><h6>Allocation Requests</h6>
            {reqs.length===0?<Empty icon="bi-inbox" text="No requests"/>:(<div className="table-responsive"><table className="table table-sm"><thead><tr><th>Student</th><th>Type</th><th>Effective</th><th>Status</th><th></th></tr></thead><tbody>{reqs.map(r=><tr key={r.id}><td>{r.student_id}</td><td>{r.req_type}</td><td>{r.effective_date}</td><td><span className="badge bg-info">{r.status}</span></td><td className="text-end">{r.status==='pending'&&<button className="btn btn-sm btn-outline-success" onClick={()=>approveReq(r.id)}>Approve</button>}</td></tr>)}</tbody></table></div>)}
          </div></div>
        </div>
      </div>
    </PageShell>
  );
}

