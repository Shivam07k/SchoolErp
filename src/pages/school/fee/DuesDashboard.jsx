import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManage, fmtDate, downloadCsv } from './shared';

const inr = (v) => `Ã¢â€šÂ¹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const OUTCOME_TONE = { promised: 'info', partial_paid: 'success', no_response: 'secondary', disputed: 'warning', escalated: 'danger' };

export default function DuesDashboard({ me, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('defaulters');
  const [follow, setFollow] = useState({ studentId: '', mode: 'call', note: '', promiseDate: '', promiseAmount: '', outcome: 'promised' });
  const [reminder, setReminder] = useState({ studentId: '', channel: 'sms' });
  const [busy, setBusy] = useState(false);
  const manager = canManage(me) || me?.permissions?.includes('fees.manage');

  async function load() {
    setLoading(true); setError('');
    try {
      const d = await apiGet('/school/fee/dues');
      if (d?.ok) setData(d); else throw new Error(d?.error || 'Failed to load dues');
    } catch (err) { setError(err.message || 'Failed to load dues'); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function logFollowUp(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiPost('/school/fee/follow-ups', follow);
      if (!res?.ok) throw new Error(res?.error || 'Failed to save follow-up');
      toast('Follow-up recorded', 'success');
      setFollow({ studentId: '', mode: 'call', note: '', promiseDate: '', promiseAmount: '', outcome: 'promised' });
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function sendReminder(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiPost('/school/fee/reminders', reminder);
      if (!res?.ok) throw new Error(res?.error || 'Failed to send reminder');
      toast('Reminder queued', 'success');
      setReminder({ studentId: '', channel: 'sms' });
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  const summary = data?.summary || {};
  const ageing = data?.ageing || {};
  const defaulters = data?.defaulters || [];

  return (
    <PageShell
      title="Dues & Follow-up"
      icon="bi-graph-up-arrow"
      subtitle="Ageing analysis, defaulters, reminders and collection follow-ups"
      onNavigate={onNavigate}
      actions={<button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>}
    >
      <ErrorBox message={error} onRetry={load} />
      {loading ? <Loading /> : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Total outstanding</div><div className="fs-5 fw-bold">{inr(summary.outstanding)}</div><div className="small text-muted">{summary.students_with_dues || 0} students</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Overdue</div><div className="fs-5 fw-bold text-danger">{inr(summary.overdue)}</div><div className="small text-muted">{summary.overdue_invoices || 0} invoices</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Avg days overdue</div><div className="fs-5 fw-bold">{summary.avg_days_overdue || 0}</div><div className="small text-muted">Across overdue invoices</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Open follow-ups</div><div className="fs-5 fw-bold">{data?.followUps?.length || 0}</div><div className="small text-muted">{data?.reminderRules?.length || 0} reminder rules</div></div></div>
          </div>

          <div className="row g-3 mb-4">
            {[['0Ã¢â‚¬â€œ30 days', ageing.d0_30, 'success'], ['31Ã¢â‚¬â€œ60 days', ageing.d31_60, 'warning'], ['61Ã¢â‚¬â€œ90 days', ageing.d61_90, 'orange'], ['90+ days', ageing.d90_plus, 'danger']].map(([label, val, tone]) => (
              <div className="col-6 col-md-3" key={label}><div className={`border rounded p-3 h-100 border-${tone === 'orange' ? 'warning' : tone}`}><div className="text-muted small">{label}</div><div className={`fs-5 fw-bold text-${tone === 'orange' ? 'warning' : tone}`}>{inr(val)}</div></div></div>
            ))}
          </div>

          {manager && (
            <div className="row g-3 mb-4">
              <div className="col-lg-7">
                <div className="border rounded p-3 h-100">
                  <h6 className="fw-bold mb-3"><i className="bi bi-chat-dots me-1"></i>Log a follow-up</h6>
                  <form className="row g-2" onSubmit={logFollowUp}>
                    <div className="col-md-4"><label className="form-label small">Student *</label><select className="form-select form-select-sm" value={follow.studentId} onChange={(e) => setFollow({ ...follow, studentId: e.target.value })} required><option value="">Select defaulter</option>{defaulters.map((s) => <option key={s.student_id} value={s.student_id}>{s.admission_no} Ã¢â‚¬â€ {s.first_name} {s.last_name} ({inr(s.total_due)})</option>)}</select></div>
                    <div className="col-md-3"><label className="form-label small">Mode</label><select className="form-select form-select-sm" value={follow.mode} onChange={(e) => setFollow({ ...follow, mode: e.target.value })}>{['call', 'meeting', 'letter', 'email', 'whatsapp', 'visit'].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div className="col-md-3"><label className="form-label small">Outcome</label><select className="form-select form-select-sm" value={follow.outcome} onChange={(e) => setFollow({ ...follow, outcome: e.target.value })}>{['promised', 'partial_paid', 'no_response', 'disputed', 'escalated'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}</select></div>
                    <div className="col-md-2"><label className="form-label small">Promise date</label><input type="date" className="form-control form-control-sm" value={follow.promiseDate} onChange={(e) => setFollow({ ...follow, promiseDate: e.target.value })} /></div>
                    <div className="col-md-3"><label className="form-label small">Promise amount</label><input type="number" min="0" step="0.01" className="form-control form-control-sm" value={follow.promiseAmount} onChange={(e) => setFollow({ ...follow, promiseAmount: e.target.value })} /></div>
                    <div className="col-md-9"><label className="form-label small">Note</label><input className="form-control form-control-sm" value={follow.note} onChange={(e) => setFollow({ ...follow, note: e.target.value })} placeholder="What was discussed?" /></div>
                    <div className="col-12"><button className="btn btn-sm btn-primary" disabled={busy}>{busy ? 'SavingÃ¢â‚¬Â¦' : 'Save follow-up'}</button></div>
                  </form>
                </div>
              </div>
              <div className="col-lg-5">
                <div className="border rounded p-3 h-100">
                  <h6 className="fw-bold mb-3"><i className="bi bi-bell me-1"></i>Send reminder</h6>
                  <form className="row g-2" onSubmit={sendReminder}>
                    <div className="col-12"><label className="form-label small">Student *</label><select className="form-select form-select-sm" value={reminder.studentId} onChange={(e) => setReminder({ ...reminder, studentId: e.target.value })} required><option value="">Select defaulter</option>{defaulters.map((s) => <option key={s.student_id} value={s.student_id}>{s.admission_no} Ã¢â‚¬â€ {s.first_name} {s.last_name}</option>)}</select></div>
                    <div className="col-12"><label className="form-label small">Channel</label><select className="form-select form-select-sm" value={reminder.channel} onChange={(e) => setReminder({ ...reminder, channel: e.target.value })}>{['sms', 'whatsapp', 'email', 'app', 'letter'].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div className="col-12"><button className="btn btn-sm btn-outline-primary" disabled={busy}>Queue reminder</button></div>
                  </form>
                </div>
              </div>
            </div>
          )}

          <ul className="nav nav-tabs mb-3">
            {[['defaulters', `Defaulters (${defaulters.length})`], ['follow-ups', `Follow-ups (${data?.followUps?.length || 0})`], ['plans', `Payment plans (${data?.plans?.length || 0})`], ['rules', `Reminder rules (${data?.reminderRules?.length || 0})`]].map(([k, label]) => (
              <li className="nav-item" key={k}><button className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button></li>
            ))}
          </ul>

          {tab === 'defaulters' && (!defaulters.length ? <Empty icon="bi-person-check" text="No outstanding dues recorded." /> : (
            <>
              <div className="d-flex justify-content-end mb-2"><button className="btn btn-sm btn-outline-secondary" onClick={() => downloadCsv('defaulters.csv', [{ label: 'Admission', key: 'admission_no' }, { label: 'Student', value: (r) => `${r.first_name} ${r.last_name || ''}`.trim() }, { label: 'Class', key: 'class_name' }, { label: 'Invoices', key: 'invoice_count' }, { label: 'Total due', key: 'total_due' }, { label: 'Days overdue', key: 'days_overdue' }, { label: 'Guardian phone', key: 'guardian_phone' }], defaulters)}><i className="bi bi-download me-1"></i>CSV</button></div>
              <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Student</th><th>Class</th><th>Guardian</th><th className="text-end">Invoices</th><th className="text-end">Total due</th><th>Oldest due</th><th className="text-end">Days</th></tr></thead><tbody>
                {defaulters.map((s) => <tr key={s.student_id}><td><span className="fw-semibold">{s.first_name} {s.last_name}</span><div className="small text-muted">{s.admission_no}</div></td><td>{s.class_name || 'Ã¢â‚¬â€'}{s.section_name ? ` / ${s.section_name}` : ''}</td><td>{s.guardian_name || 'Ã¢â‚¬â€'}<div className="small text-muted">{s.guardian_phone || ''}</div></td><td className="text-end">{s.invoice_count}</td><td className="text-end fw-semibold text-danger">{inr(s.total_due)}</td><td>{fmtDate(s.oldest_due)}</td><td className="text-end">{s.days_overdue}</td></tr>)}
              </tbody></table></div>
            </>
          ))}

          {tab === 'follow-ups' && (!(data?.followUps || []).length ? <Empty icon="bi-chat-dots" text="No follow-ups recorded yet." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Date</th><th>Student</th><th>Mode</th><th>Outcome</th><th>Promise</th><th>Note</th><th>By</th></tr></thead><tbody>
              {data.followUps.map((f) => <tr key={f.id}><td>{fmtDate(f.date)}</td><td>{f.first_name ? `${f.first_name} ${f.last_name || ''}` : 'Ã¢â‚¬â€'}<div className="small text-muted">{f.admission_no}</div></td><td><span className="badge bg-info">{f.mode || 'Ã¢â‚¬â€'}</span></td><td>{f.outcome ? <Badge tone={OUTCOME_TONE[f.outcome] || 'secondary'}>{f.outcome.replace('_', ' ')}</Badge> : 'Ã¢â‚¬â€'}</td><td>{f.promise_date ? `${fmtDate(f.promise_date)}${f.promise_amount ? ` Ã‚Â· ${inr(f.promise_amount)}` : ''}` : 'Ã¢â‚¬â€'}</td><td className="small">{f.note || 'Ã¢â‚¬â€'}</td><td className="small text-muted">{f.by_user}</td></tr>)}
            </tbody></table></div>
          ))}

          {tab === 'plans' && (!(data?.plans || []).length ? <Empty icon="bi-calendar-check" text="No payment plans created yet." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Student</th><th className="text-end">Total</th><th className="text-end">Installments</th><th className="text-end">Per installment</th><th>Start</th><th>Frequency</th><th>Status</th></tr></thead><tbody>
              {data.plans.map((p) => <tr key={p.id}><td>{p.first_name ? `${p.first_name} ${p.last_name || ''}` : 'Ã¢â‚¬â€'}<div className="small text-muted">{p.admission_no}</div></td><td className="text-end">{inr(p.total_amount)}</td><td className="text-end">{p.installments}</td><td className="text-end">{inr(p.amount_per_installment)}</td><td>{fmtDate(p.start_date)}</td><td>{p.frequency}</td><td><Badge tone={p.status === 'active' ? 'success' : 'secondary'}>{p.status}</Badge></td></tr>)}
            </tbody></table></div>
          ))}

          {tab === 'rules' && (!(data?.reminderRules || []).length ? <Empty icon="bi-bell" text="No reminder rules configured." /> : (
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Name</th><th>Trigger</th><th className="text-end">Days</th><th>Channel</th><th>Active</th><th>Template</th></tr></thead><tbody>
              {data.reminderRules.map((r) => <tr key={r.id}><td className="fw-semibold">{r.name}</td><td>{r.trigger_type.replace('_', ' ')}</td><td className="text-end">{r.days}</td><td><span className="badge bg-info">{r.channel}</span></td><td>{r.is_active ? <span className="badge bg-success">Yes</span> : <span className="badge bg-secondary">No</span>}</td><td className="small">{r.template || 'Ã¢â‚¬â€'}</td></tr>)}
            </tbody></table></div>
          ))}
        </>
      )}
    </PageShell>
  );
}

