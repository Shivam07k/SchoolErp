import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManageHR, fmtDate } from './shared';

export default function ApplyLeave({ me, onNavigate }) {
  const [staffId, setStaffId] = useState(me?.userId || '');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [halfDay, setHalfDay] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState('forenoon');
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [balance, setBalance] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const myId = me?.userId || '';
  const isManager = me?.permissions?.includes('hr.leave_approve') || me?.permissions?.includes('hr.manage');

  useEffect(() => {
    apiGet('/school/hr/leave/types').then(d => d?.ok && setLeaveTypes(d.types || []));
  }, []);

  useEffect(() => {
    if (staffId && leaveTypeId) {
      apiGet(`/school/hr/leave/balances?staff_id=${staffId}&leave_type_id=${leaveTypeId}`).then(d => d?.ok && setBalance(d.balances?.[0] || null));
    } else {
      setBalance(null);
    }
  }, [staffId, leaveTypeId]);

  const canSubmit = staffId && leaveTypeId && fromDate && toDate && new Date(fromDate) <= new Date(toDate);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await apiPost('/school/hr/leave/applications', {
        staff_id: staffId,
        leave_type_id: leaveTypeId,
        from_date: fromDate,
        to_date: toDate,
        half_day: halfDay,
        half_day_session: halfDay ? halfDaySession : null,
        reason,
      });
      if (res?.ok) {
        toast('Leave application submitted', 'success');
        setFromDate(''); setToDate(''); setHalfDay(false); setReason('');
      } else throw new Error(res?.error || 'Failed to submit');
    } catch (err) { toast(err.message, 'error'); }
    finally { setSubmitting(false); }
  }

  return (
    <PageShell title="Apply Leave" icon="bi-calendar-plus" subtitle="Submit leave applications with balance checks and period coverage preview" onNavigate={onNavigate}>
      <div className="row g-3">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header"><h6 className="mb-0">Leave Application</h6></div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                {isManager && (
                  <div className="mb-3"><label className="form-label small">Staff</label>
                    <select className="form-select form-select-sm" value={staffId} onChange={e => setStaffId(e.target.value)} required>
                      <option value="">Select Staff</option>
                      <option value="1">Rajesh Kumar (EMP001)</option>
                      <option value="2">Priya Sharma (EMP002)</option>
                      <option value="3">Amit Patel (EMP003)</option>
                    </select>
                  </div>
                )}

                <div className="mb-3"><label className="form-label small">Leave Type *</label>
                  <select className="form-select form-select-sm" value={leaveTypeId} onChange={e => setLeaveTypeId(e.target.value)} required>
                    <option value="">Select Leave Type</option>
                    <option value="1">Casual Leave (CL)</option>
                    <option value="2">Sick Leave (SL)</option>
                    <option value="3">Earned Leave (EL)</option>
                  </select>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6"><label className="form-label small">From Date *</label><input type="date" className="form-control form-control-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} required min={new Date().toISOString().slice(0,10)} /></div>
                  <div className="col-md-6"><label className="form-label small">To Date *</label><input type="date" className="form-control form-control-sm" value={toDate} onChange={e => setToDate(e.target.value)} required min={fromDate} /></div>
                </div>

                <div className="mb-3">
                  <div className="form-check"><input type="checkbox" className="form-check-input" id="halfDay" checked={halfDay} onChange={e => setHalfDay(e.target.checked)} /><label className="form-check-label small" htmlFor="halfDay">Half Day</label></div>
                  {halfDay && (
                    <div className="mb-3"><label className="form-label small">Session</label>
                      <select className="form-select form-select-sm" value={halfDaySession} onChange={e => setHalfDaySession(e.target.value)}>
                        <option value="forenoon">Forenoon</option>
                        <option value="afternoon">Afternoon</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="mb-3"><label className="form-label small">Reason *</label>
                  <textarea className="form-control form-control-sm" rows={3} value={reason} onChange={e => setReason(e.target.value)} required placeholder="Reason for leave..." /></div>

                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary" disabled={!canSubmit || submitting}>{submitting ? 'Submitting...' : 'Submit Application'}</button>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => { setFromDate(''); setToDate(''); setReason(''); setHalfDay(false); }}>Clear</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header"><h6 className="mb-0">Balance Preview</h6></div>
            <div className="card-body">
              {!leaveTypes.length ? <p className="text-muted small">No leave types configured.</p> : (
                <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Leave Type</th><th>Code</th><th className="text-end">Balance</th></tr></thead><tbody>
                  {leaveTypes.map(lt => <tr key={lt.id}><td>{lt.name}</td><td><Badge tone="info">{lt.code}</Badge></td><td className="text-end">{0}</td></tr>)}
                </tbody></table></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
