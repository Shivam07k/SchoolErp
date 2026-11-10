import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../api';
import { toast } from '../../toast';

const money = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(v || 0));
const today = () => new Date().toISOString().slice(0, 10);

function ListPage({ formId, config }) {
  const TITLE = config?.title || 'Fees';
  const [data, setData] = useState({ heads: [], invoices: [], payments: [], summary: {} });
  const [loading, setLoading] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState({ studentId: '', title: 'Tuition Fee', amount: '', dueDate: today() });
  const [payDraft, setPayDraft] = useState({ invoiceId: '', amount: '', method: 'cash', reference: '' });
  const [students, setStudents] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [f, s] = await Promise.all([apiGet('/school/fees'), apiGet('/school/students?status=active')]);
      if (f?.ok) setData({ heads: f.heads || [], invoices: f.invoices || [], payments: f.payments || [], summary: f.summary || {} });
      if (s?.ok) setStudents(s.students || []);
    } catch { toast('Failed to load fees', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceDraft.studentId || !invoiceDraft.amount) return toast('Student and amount required', 'error');
    const res = await apiPost('/school/fees/invoice', invoiceDraft);
    if (res?.ok) { toast('Invoice created', 'success'); setInvoiceDraft({ studentId: '', title: 'Tuition Fee', amount: '', dueDate: today() }); load(); }
    else toast(res?.error || 'Failed', 'error');
  };

  const recordPayment = async (e) => {
    e.preventDefault();
    if (!payDraft.invoiceId || !payDraft.amount) return toast('Invoice and amount required', 'error');
    const res = await apiPost('/school/fees/payment', payDraft);
    if (res?.ok) { toast('Payment recorded', 'success'); setPayDraft({ invoiceId: '', amount: '', method: 'cash', reference: '' }); load(); }
    else toast(res?.error || 'Failed', 'error');
  };

  return (
    <div className="page-content animate-fade">
      <div className="card mb-3">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="card-title mb-0"><i className="bi bi-cash-coin me-2"></i>{TITLE}</div>
          <button className="btn btn-sm btn-outline-secondary" onClick={load} disabled={loading}><i className={`bi bi-arrow-clockwise ${loading?'spin':''}`}></i> Refresh</button>
        </div>
        <div className="card-body row g-2 text-center">
          <div className="col-md-3"><div className="border rounded p-2"><div className="text-muted small">Total Invoiced</div><strong>{money(data.summary.total)}</strong></div></div>
          <div className="col-md-3"><div className="border rounded p-2"><div className="text-muted small">Collected</div><strong className="text-success">{money(data.summary.paid)}</strong></div></div>
          <div className="col-md-3"><div className="border rounded p-2"><div className="text-muted small">Outstanding</div><strong className="text-danger">{money(data.summary.outstanding)}</strong></div></div>
          <div className="col-md-3"><div className="border rounded p-2"><div className="text-muted small">Overdue</div><strong className="text-warning">{money(data.summary.overdue)}</strong></div></div>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header"><strong>Create Invoice</strong></div>
            <form onSubmit={createInvoice}><div className="card-body row g-2">
              <div className="col-12"><label className="form-label">Student</label><select className="form-select form-select-sm" value={invoiceDraft.studentId} onChange={(e)=>setInvoiceDraft({...invoiceDraft,studentId:e.target.value})}><option value="">Select</option>{students.map((s)=><option key={s.id} value={s.id}>{s.admission_no} - {s.first_name} {s.last_name}</option>)}</select></div>
              <div className="col-8"><label className="form-label">Title</label><input className="form-control form-control-sm" value={invoiceDraft.title} onChange={(e)=>setInvoiceDraft({...invoiceDraft,title:e.target.value})} /></div>
              <div className="col-4"><label className="form-label">Amount</label><input className="form-control form-control-sm" type="number" value={invoiceDraft.amount} onChange={(e)=>setInvoiceDraft({...invoiceDraft,amount:e.target.value})} /></div>
              <div className="col-12"><label className="form-label">Due Date</label><input type="date" className="form-control form-control-sm" value={invoiceDraft.dueDate} onChange={(e)=>setInvoiceDraft({...invoiceDraft,dueDate:e.target.value})} /></div>
            </div><div className="card-footer"><button className="btn btn-sm btn-primary">Create Invoice</button></div></form>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header"><strong>Record Payment</strong></div>
            <form onSubmit={recordPayment}><div className="card-body row g-2">
              <div className="col-12"><label className="form-label">Invoice</label><select className="form-select form-select-sm" value={payDraft.invoiceId} onChange={(e)=>setPayDraft({...payDraft,invoiceId:e.target.value})}><option value="">Select</option>{data.invoices.filter((i)=>i.status!=='paid').map((i)=><option key={i.id} value={i.id}>{i.invoice_no} - {i.student_name} ({money(i.balance||i.amount)})</option>)}</select></div>
              <div className="col-6"><label className="form-label">Amount</label><input className="form-control form-control-sm" type="number" value={payDraft.amount} onChange={(e)=>setPayDraft({...payDraft,amount:e.target.value})} /></div>
              <div className="col-6"><label className="form-label">Method</label><select className="form-select form-select-sm" value={payDraft.method} onChange={(e)=>setPayDraft({...payDraft,method:e.target.value})}><option value="cash">Cash</option><option value="bank">Bank</option><option value="online">Online</option><option value="cheque">Cheque</option></select></div>
              <div className="col-12"><label className="form-label">Reference</label><input className="form-control form-control-sm" value={payDraft.reference} onChange={(e)=>setPayDraft({...payDraft,reference:e.target.value})} /></div>
            </div><div className="card-footer"><button className="btn btn-sm btn-success">Record Payment</button></div></form>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header"><strong>Recent Payments</strong></div>
            <div className="list-group list-group-flush small">
              {data.payments.slice(0,10).map((p)=>
                <div key={p.id} className="list-group-item d-flex justify-content-between">
                  <div><div>{p.first_name} {p.last_name}</div><div className="text-muted">{p.method} {p.reference||''} · {p.paid_at?new Date(p.paid_at).toLocaleDateString('en-IN'):''}</div></div>
                  <div className="text-success">{money(p.amount)}</div>
                </div>
              )}
              {data.payments.length === 0 && <div className="list-group-item text-muted">No payments</div>}
            </div>
          </div>
        </div>
      </div>
      <div className="card mt-3">
        <div className="card-header"><strong>Invoices</strong></div>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead><tr><th>Invoice</th><th>Student</th><th>Title</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {data.invoices.map((i)=>(
                <tr key={i.id}>
                  <td><code>{i.invoice_no}</code></td>
                  <td>{i.first_name} {i.last_name}</td>
                  <td>{i.title}</td>
                  <td>{money(i.amount)}</td>
                  <td>{money(i.paid_amount||0)}</td>
                  <td>{money(i.balance||0)}</td>
                  <td>{i.due_date?new Date(i.due_date).toLocaleDateString('en-IN'): '-'}</td>
                  <td><span className={`badge bg-${i.status==='paid'?'success':i.status==='overdue'?'danger':'warning'}`}>{i.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ListPage;
