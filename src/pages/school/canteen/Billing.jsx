import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, moneyOrDash } from './shared';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';

export default function Billing() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBills(); }, []);

  async function loadBills() {
    setLoading(true);
    const d = await apiGet('/school/canteen/bills');
    if (d?.ok) setBills(d.bills || []);
    setLoading(false);
  }

  return (
    <PageShell title="Canteen Billing" icon="bi-receipt" subtitle={`${bills.length} bills`}>
      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>ID</th><th>Order</th><th>Total</th><th>Tax</th><th>Discount</th><th>Payment Mode</th><th>Cashier</th><th>Created</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="8"><Loading /></td></tr> :
            bills.length === 0 ? <tr><td colSpan="8"><Empty text="No bills yet" /></td></tr> :
            bills.map(b => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>{b.order_id || 'Ã¢â‚¬â€'}</td>
                <td>{moneyOrDash(b.total)}</td>
                <td>{moneyOrDash(b.tax)}</td>
                <td>{moneyOrDash(b.discount)}</td>
                <td><Badge status={b.payment_mode}>{b.payment_mode}</Badge></td>
                <td>{b.cashier || 'Ã¢â‚¬â€'}</td>
                <td>{fmtDate(b.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
