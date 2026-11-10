import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, Empty } from '../fee/shared';

export default function TransportRoutes({ me, onNavigate }) {
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rform, setRform] = useState({ code:'', name:'', direction:'both' });
  const [sform, setSform] = useState({ name:'', landmark:'', zoneId:'' });
  const [zform, setZform] = useState({ name:'', feeAmount:'' });

  async function load(){
    setLoading(true);
    try {
      const [r,s,z] = await Promise.all([apiGet('/school/transport/routes'),apiGet('/school/transport/stops'),apiGet('/school/transport/zones')]);
      if(r?.ok)setRoutes(r.routes||[]); if(s?.ok)setStops(s.stops||[]); if(z?.ok)setZones(z.zones||[]);
    }catch(e){toast(e.message,'error');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);

  async function saveRoute(e){ e.preventDefault(); try{ const res=await apiPost('/school/transport/routes', rform); if(res?.ok){toast('Route created','success'); setRform({code:'',name:'',direction:'both'}); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}
  async function saveStop(e){ e.preventDefault(); try{ const res=await apiPost('/school/transport/stops', sform); if(res?.ok){toast('Stop created','success'); setSform({name:'',landmark:'',zoneId:''}); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}
  async function saveZone(e){ e.preventDefault(); try{ const res=await apiPost('/school/transport/zones', zform); if(res?.ok){toast('Zone created','success'); setZform({name:'',feeAmount:''}); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}

  if(loading) return <Loading/>;
  return (
    <PageShell title="Transport - Routes" icon="bi-signpost-2" subtitle="Routes, ordered stops, zones, trips" onNavigate={onNavigate}>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card mb-3"><div className="card-body"><h6>New Zone</h6>
            <form onSubmit={saveZone}><div className="mb-2"><input className="form-control form-control-sm" placeholder="Zone name" value={zform.name} onChange={e=>setZform({...zform,name:e.target.value})} required/></div><div className="mb-2"><input type="number" className="form-control form-control-sm" placeholder="Fee amount" value={zform.feeAmount} onChange={e=>setZform({...zform,feeAmount:e.target.value})}/></div><button className="btn btn-sm btn-primary">Add Zone</button></form>
          </div></div>
          <div className="card mb-3"><div className="card-body"><h6>New Stop</h6>
            <form onSubmit={saveStop}><div className="mb-2"><input className="form-control form-control-sm" placeholder="Stop name" value={sform.name} onChange={e=>setSform({...sform,name:e.target.value})} required/></div><div className="mb-2"><input className="form-control form-control-sm" placeholder="Landmark" value={sform.landmark} onChange={e=>setSform({...sform,landmark:e.target.value})}/></div><div className="mb-2"><select className="form-select form-select-sm" value={sform.zoneId} onChange={e=>setSform({...sform,zoneId:e.target.value})}><option value="">Zone</option>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></div><button className="btn btn-sm btn-primary">Add Stop</button></form>
          </div></div>
          <div className="card"><div className="card-body"><h6>New Route</h6>
            <form onSubmit={saveRoute}><div className="mb-2"><input className="form-control form-control-sm" placeholder="Code" value={rform.code} onChange={e=>setRform({...rform,code:e.target.value})} required/></div><div className="mb-2"><input className="form-control form-control-sm" placeholder="Route name" value={rform.name} onChange={e=>setRform({...rform,name:e.target.value})} required/></div><div className="mb-2"><select className="form-select form-select-sm" value={rform.direction} onChange={e=>setRform({...rform,direction:e.target.value})}><option value="both">Both</option><option value="pickup">Pickup</option><option value="drop">Drop</option></select></div><button className="btn btn-sm btn-primary">Add Route</button></form>
          </div></div>
        </div>
        <div className="col-lg-8">
          <div className="card mb-3"><div className="card-body"><h6>Routes</h6>
            {routes.length===0?<Empty icon="bi-signpost" text="No routes"/>:(<div className="table-responsive"><table className="table table-sm"><thead><tr><th>Code</th><th>Name</th><th>Direction</th></tr></thead><tbody>{routes.map(r=><tr key={r.id}><td><code>{r.code}</code></td><td>{r.name}</td><td>{r.direction}</td></tr>)}</tbody></table></div>)}
          </div></div>
          <div className="row g-3">
            <div className="col-md-6"><div className="card"><div className="card-body"><h6>Stops</h6>
              {stops.length===0?<Empty icon="bi-geo-alt" text="No stops"/>:(<div className="table-responsive"><table className="table table-sm"><thead><tr><th>Name</th><th>Zone</th></tr></thead><tbody>{stops.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.zone_name||'-'}</td></tr>)}</tbody></table></div>)}
            </div></div></div>
            <div className="col-md-6"><div className="card"><div className="card-body"><h6>Zones</h6>
              {zones.length===0?<Empty icon="bi-map" text="No zones"/>:(<div className="table-responsive"><table className="table table-sm"><thead><tr><th>Name</th><th>Fee</th></tr></thead><tbody>{zones.map(z=><tr key={z.id}><td>{z.name}</td><td>{z.fee_amount}</td></tr>)}</tbody></table></div>)}
            </div></div></div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

