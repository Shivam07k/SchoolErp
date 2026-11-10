import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    const d = await apiGet('/school/canteen/orders');
    if (d?.ok) setOrders(d.orders || []);
    setLoading(false);
  }

  return (
    <PageShell title="Canteen Orders" icon="bi-cart" subtitle={`${orders.length} orders`}>
      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>ID</th><th>Customer</th><th>Channel</th><th>Slot</th><th>Status</th><th>Token</th><th>Created</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7"><Loading /></td></tr> :
            orders.length === 0 ? <tr><td colSpan="7"><Empty text="No orders yet" /></td></tr> :
            orders.map(o => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.customer_name || 'Ã¢â‚¬â€'}</td>
                <td>{o.channel}</td>
                <td>{o.slot}</td>
                <td><Badge status={o.status}>{o.status}</Badge></td>
                <td>{o.token || 'Ã¢â‚¬â€'}</td>
                <td>{fmtDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
