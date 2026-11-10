import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, Empty } from '../fee/shared';

export default function TransportFees({ me, onNavigate }) {
  const [zones, setZones] = useState([]);
  const [allocs, setAllocs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load(){
    setLoading(true);
    try {
      const [z,a] = await Promise.all([apiGet('/school/transport/zones'),apiGet('/school/transport/allocations')]);
      if(z?.ok)setZones(z.zones||[]); if(a?.ok)setAllocs(a.allocations||[]);
    }catch(e){toast(e.message,'error');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);

  if(loading) return <Loading/>;
  return (
    <PageShell title="Transport - Transport Fees" icon="bi-cash" subtitle="Fee rules by zone/stop, billing via Fees module" onNavigate={onNavigate}>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card"><div className="card-body"><h6>Fee Rules by Zone</h6>
            {zones.length===0?<Empty icon="bi-cash-coin" text="No zones"/>:(<div className="table-responsive"><table className="table table-sm"><thead><tr><th>Zone</th><th>Amount</th></tr></thead><tbody>{zones.map(z=><tr key={z.id}><td>{z.name}</td><td>{z.fee_amount}</td></tr>)}</tbody></table></div>)}
            <div className="small text-muted mt-2">Transport fees post to Fees & Accounts ledger per policy.</div>
          </div></div>
        </div>
        <div className="col-lg-8">
          <div className="card"><div className="card-body"><h6>Students on Transport</h6>
            {allocs.length===0?<Empty icon="bi-people" text="No allocations"/>:(<div className="table-responsive"><table className="table table-sm"><thead><tr><th>Student</th><th>Adm No</th><th>Route</th><th>Pick Stop</th></tr></thead><tbody>{allocs.map(a=><tr key={a.id}><td>{a.first_name} {a.last_name}</td><td>{a.admission_no}</td><td>{a.route_name}</td><td>{a.pick_stop||'-'}</td></tr>)}</tbody></table></div>)}
          </div></div>
        </div>
      </div>
    </PageShell>
  );
}

