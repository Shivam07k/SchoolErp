import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, Empty } from '../fee/shared';

export default function TransportTracking({ me, onNavigate }) {
  const [runs, setRuns] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sform, setSform] = useState({ tripId:'', vehicleId:'', driverId:'', attendantId:'' });

  async function load(){
    setLoading(true);
    try {
      const [r,a,t,v] = await Promise.all([apiGet('/school/transport/trips/runs'),apiGet('/school/transport/alerts'),apiGet('/school/transport/trips'),apiGet('/school/transport/vehicles')]);
      if(r?.ok)setRuns(r.runs||[]); if(a?.ok)setAlerts(a.alerts||[]); if(t?.ok)setTrips(t.trips||[]); if(v?.ok)setVehicles(v.vehicles||[]);
    }catch(e){toast(e.message,'error');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);

  async function startRun(e){ e.preventDefault(); try{ const res=await apiPost('/school/transport/trips/runs/start', sform); if(res?.ok){toast('Trip started','success'); setSform({ tripId:'', vehicleId:'', driverId:'', attendantId:'' }); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}
  async function endRun(id){ try{ const res=await apiPost(`/school/transport/trips/runs/${id}/end`, {}); if(res?.ok){toast('Trip ended','success'); load();}else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}

  if(loading) return <Loading/>;
  return (
    <PageShell title="Transport - GPS/Tracking" icon="bi-geo" subtitle="Live tracking, trip runs, alerts, boarding events" onNavigate={onNavigate}>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card"><div className="card-body"><h6>Start Trip Run</h6>
            <form onSubmit={startRun}>
              <div className="mb-2"><select className="form-select form-select-sm" value={sform.tripId} onChange={e=>setSform({...sform,tripId:e.target.value})}><option value="">Trip</option>{trips.map(t=><option key={t.id} value={t.id}>{t.trip_type} - {t.route_name}</option>)}</select></div>
              <div className="mb-2"><select className="form-select form-select-sm" value={sform.vehicleId} onChange={e=>setSform({...sform,vehicleId:e.target.value})}><option value="">Vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.reg_no}</option>)}</select></div>
              <button className="btn btn-sm btn-primary w-100">Start Run</button>
            </form>
          </div></div>
        </div>
        <div className="col-lg-8">
          <div className="card mb-3"><div className="card-body"><h6>Trip Runs</h6>
            {runs.length===0?<Empty icon="bi-truck" text="No runs"/>:(<div className="table-responsive"><table className="table table-sm"><thead><tr><th>Date</th><th>Route/Trip</th><th>Vehicle</th><th>Status</th><th></th></tr></thead><tbody>{runs.map(r=><tr key={r.id}><td>{r.run_date}</td><td>{r.route_name} ({r.trip_type})</td><td>{r.reg_no}</td><td><span className="badge bg-info">{r.status}</span></td><td className="text-end">{r.status==='running'&&<button className="btn btn-sm btn-outline-danger" onClick={()=>endRun(r.id)}>End Trip</button>}</td></tr>)}</tbody></table></div>)}
          </div></div>
          <div className="card"><div className="card-body"><h6>Alerts</h6>
            {alerts.length===0?<Empty icon="bi-bell" text="No alerts"/>:(<div className="table-responsive"><table className="table table-sm"><thead><tr><th>Time</th><th>Type</th><th>Message</th><th>Status</th></tr></thead><tbody>{alerts.map(a=><tr key={a.id}><td>{a.alert_at}</td><td>{a.type}</td><td>{a.message}</td><td>{a.status}</td></tr>)}</tbody></table></div>)}
          </div></div>
        </div>
      </div>
    </PageShell>
  );
}

