import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, Empty } from '../fee/shared';

export default function TransportVehicles({ me, onNavigate }) {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [attendants, setAttendants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vform, setVform] = useState({ regNo:'', type:'bus', make:'', year:'', capacity:'', ownership:'own', gpsDeviceId:'' });
  const [dform, setDform] = useState({ name:'', phone:'', licenceNo:'', licenceClass:'', licenceExpiry:'', medicalDate:'' });
  const [aform, setAform] = useState({ name:'', phone:'' });

  async function load(){
    setLoading(true);
    try {
      const [v,d,a] = await Promise.all([apiGet('/school/transport/vehicles'),apiGet('/school/transport/drivers'),apiGet('/school/transport/attendants')]);
      if(v?.ok)setVehicles(v.vehicles||[]); if(d?.ok)setDrivers(d.drivers||[]); if(a?.ok)setAttendants(a.attendants||[]);
    }catch(e){toast(e.message,'error');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);

  async function saveV(e){ e.preventDefault(); try{ const res=await apiPost('/school/transport/vehicles', vform); if(res?.ok){toast('Vehicle added','success'); setVform({ regNo:'', type:'bus', make:'', year:'', capacity:'', ownership:'own', gpsDeviceId:'' }); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}
  async function saveD(e){ e.preventDefault(); try{ const res=await apiPost('/school/transport/drivers', dform); if(res?.ok){toast('Driver added','success'); setDform({ name:'', phone:'', licenceNo:'', licenceClass:'', licenceExpiry:'', medicalDate:'' }); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}
  async function saveA(e){ e.preventDefault(); try{ const res=await apiPost('/school/transport/attendants', aform); if(res?.ok){toast('Attendant added','success'); setAform({ name:'', phone:'' }); load(); }else toast(res?.error||'Failed','error'); }catch(e){toast(e.message,'error');}}

  if(loading) return <Loading/>;
  return (
    <PageShell title="Transport - Vehicles" icon="bi-bus-front" subtitle="Vehicles, drivers, attendants, documents & assignments" onNavigate={onNavigate}>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card mb-3"><div className="card-body"><h6>New Vehicle</h6>
            <form onSubmit={saveV}><div className="mb-2"><input className="form-control form-control-sm" placeholder="Reg No" value={vform.regNo} onChange={e=>setVform({...vform,regNo:e.target.value})} required/></div><div className="row g-1 mb-2"><div className="col"><input className="form-control form-control-sm" placeholder="Type" value={vform.type} onChange={e=>setVform({...vform,type:e.target.value})}/></div><div className="col"><input className="form-control form-control-sm" placeholder="Make" value={vform.make} onChange={e=>setVform({...vform,make:e.target.value})}/></div></div><div className="row g-1 mb-2"><div className="col"><input type="number" className="form-control form-control-sm" placeholder="Year" value={vform.year} onChange={e=>setVform({...vform,year:e.target.value})}/></div><div className="col"><input type="number" className="form-control form-control-sm" placeholder="Capacity" value={vform.capacity} onChange={e=>setVform({...vform,capacity:e.target.value})}/></div></div><div className="mb-2"><input className="form-control form-control-sm" placeholder="GPS Device ID" value={vform.gpsDeviceId} onChange={e=>setVform({...vform,gpsDeviceId:e.target.value})}/></div><button className="btn btn-sm btn-primary">Add Vehicle</button></form>
          </div></div>
          <div className="card mb-3"><div className="card-body"><h6>New Driver</h6>
            <form onSubmit={saveD}><div className="mb-2"><input className="form-control form-control-sm" placeholder="Name" value={dform.name} onChange={e=>setDform({...dform,name:e.target.value})} required/></div><div className="mb-2"><input className="form-control form-control-sm" placeholder="Phone" value={dform.phone} onChange={e=>setDform({...dform,phone:e.target.value})}/></div><div className="mb-2"><input className="form-control form-control-sm" placeholder="Licence No" value={dform.licenceNo} onChange={e=>setDform({...dform,licenceNo:e.target.value})}/></div><div className="row g-1 mb-2"><div className="col"><input type="date" className="form-control form-control-sm" value={dform.licenceExpiry} onChange={e=>setDform({...dform,licenceExpiry:e.target.value})}/></div><div className="col"><input type="date" className="form-control form-control-sm" value={dform.medicalDate} onChange={e=>setDform({...dform,medicalDate:e.target.value})}/></div></div><button className="btn btn-sm btn-primary">Add Driver</button></form>
          </div></div>
          <div className="card"><div className="card-body"><h6>New Attendant</h6>
            <form onSubmit={saveA}><div className="mb-2"><input className="form-control form-control-sm" placeholder="Name" value={aform.name} onChange={e=>setAform({...aform,name:e.target.value})} required/></div><div className="mb-2"><input className="form-control form-control-sm" placeholder="Phone" value={aform.phone} onChange={e=>setAform({...aform,phone:e.target.value})}/></div><button className="btn btn-sm btn-primary">Add Attendant</button></form>
          </div></div>
        </div>
        <div className="col-lg-8">
          <div className="card mb-3"><div className="card-body"><h6>Vehicles</h6>
            {vehicles.length===0?<Empty icon="bi-bus-front" text="No vehicles"/>:(<div className="table-responsive"><table className="table table-sm"><thead><tr><th>Reg No</th><th>Type</th><th>Capacity</th><th>GPS</th><th>Status</th></tr></thead><tbody>{vehicles.map(v=><tr key={v.id}><td><code>{v.reg_no}</code></td><td>{v.type}</td><td>{v.capacity}</td><td>{v.gps_device_id||'-'}</td><td>{v.status}</td></tr>)}</tbody></table></div>)}
          </div></div>
          <div className="row g-3">
            <div className="col-md-6"><div className="card"><div className="card-body"><h6>Drivers</h6>
              {drivers.length===0?<Empty icon="bi-person" text="No drivers"/>:(<div className="table-responsive"><table className="table table-sm"><thead><tr><th>Name</th><th>Phone</th><th>Licence Expiry</th></tr></thead><tbody>{drivers.map(d=><tr key={d.id}><td>{d.name}</td><td>{d.phone||'-'}</td><td>{d.licence_expiry||'-'}</td></tr>)}</tbody></table></div>)}
            </div></div></div>
            <div className="col-md-6"><div className="card"><div className="card-body"><h6>Attendants</h6>
              {attendants.length===0?<Empty icon="bi-person-badge" text="No attendants"/>:(<div className="table-responsive"><table className="table table-sm"><thead><tr><th>Name</th><th>Phone</th></tr></thead><tbody>{attendants.map(a=><tr key={a.id}><td>{a.name}</td><td>{a.phone||'-'}</td></tr>)}</tbody></table></div>)}
            </div></div></div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

