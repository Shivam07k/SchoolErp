import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Loading, Empty } from '../fee/shared';

export default function InventoryStockReport({ me, onNavigate }) {
  const [stock, setStock] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState('');

  async function load(){
    setLoading(true);
    try {
      const q = storeId ? `?storeId=${storeId}` : '';
      const [s, st] = await Promise.all([apiGet(`/school/inventory/stock${q}`), apiGet('/school/inventory/stores')]);
      if(s?.ok)setStock(s.stock||[]); if(st?.ok)setStores(st.stores||[]);
    }catch(e){toast(e.message,'error');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[storeId]);

  if(loading) return <Loading/>;
  return (
    <PageShell title="Inventory - Stock Report" icon="bi-bar-chart" subtitle="Stock on hand by store, reorder alerts, ledger" onNavigate={onNavigate}>
      <div className="mb-3">
        <select className="form-select form-select-sm w-auto" value={storeId} onChange={e=>setStoreId(e.target.value)}>
          <option value="">All Stores</option>
          {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="card"><div className="card-body">
        <h6>Stock on Hand</h6>
        {stock.length===0?<Empty icon="bi-box-seam" text="No stock data"/>:(
          <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Item</th><th>Code</th><th>Store</th><th>Unit</th><th>Type</th><th>Reorder Level</th><th>On Hand</th></tr></thead><tbody>
            {stock.map((r,idx)=><tr key={idx}><td>{r.item_name}</td><td><code>{r.code}</code></td><td>{r.store_name}</td><td>{r.unit}</td><td>{r.tracking_type}</td><td>{r.reorder_level}</td><td className={Number(r.on_hand)<=Number(r.reorder_level)?'text-danger fw-semibold':''}>{r.on_hand}</td></tr>)}
          </tbody></table></div>
        )}
      </div></div>
    </PageShell>
  );
}

