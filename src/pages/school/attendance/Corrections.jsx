import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, activePolicies, decisionTone, fmtDate,
  fmtDateTime, sectionsFor, today,
} from './shared';

export default function Corrections({ me, onNavigate }) {
  const [date, setDate] = useState(today());
  const [classes, setClasses] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [register, setRegister] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [newPolicyId, setNewPolicyId] = useState('');
  const [reason, setReason] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [newLateMinutes, setNewLateMinutes] = useState('');
  const [newPartialMinutes, setNewPartialMinutes] = useState('');

  const [bulkPolicyId, setBulkPolicyId] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkSelected, setBulkSelected] = useState({});
  const [bulkPreview, setBulkPreview] = useState(null);

  const [corrections, setCorrections] = useState([]);
  const [decisionFilter, setDecisionFilter] = useState('pending');
  const [decisions, setDecisions] = useState({});

  const sections = useMemo(() => sectionsFor(classes, classId), [classes, classId]);
  const markedEntries = useMemo(() => entries.filter((e) => e.id && e.status_code), [entries]);
  const selectedBulkIds = Object.keys(bulkSelected).filter((id) => bulkSelected[id]);
  const isDraft = register?.state === 'draft';

  async function loadReferences() {
    const [classResult, policyResult] = await Promise.all([
      apiGet('/school/classes'),
      apiGet('/school/attendance/policies'),
    ]);
    if (!classResult?.ok) throw new Error(classResult?.error || 'Could not load classes');
    setClasses(classResult.classes || []);
    if (policyResult?.ok) setPolicies(activePolicies(policyResult.policies));
  }

  async function loadRegister() {
    if (!sectionId) { setRegister(null); setEntries([]); return; }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ date, sectionId });
      const list = await apiGet(`/school/attendance/registers?${params.toString()}`);
      if (!list?.ok) throw new Error(list?.error || 'Could not load the register');
      const found = (list.registers || [])[0];
      if (!found) {
        setRegister(null);
        setEntries([]);
        return;
      }
      const detail = await apiGet(`/school/attendance/registers/${found.id}`);
      if (!detail?.ok) throw new Error(detail?.error || 'Could not load the register');
      setRegister(detail.register);
      setEntries(detail.entries || []);
      setBulkSelected({});
      setBulkPreview(null);
      setSelectedEntryId('');
    } catch (err) {
      setError(err.message || 'Could not load the register');
    } finally {
      setLoading(false);
    }
  }

  async function loadCorrections() {
    const params = new URLSearchParams();
    /* Pending rows have decision NULL, so the server cannot filter on the
       literal string "pending". Fetch all and filter here. */
    if (decisionFilter && decisionFilter !== 'pending') params.set('decision', decisionFilter);
    const result = await apiGet(`/school/attendance/corrections${params.toString() ? `?${params}` : ''}`);
    if (!result?.ok) throw new Error(result?.error || 'Could not load corrections');
    const rows = result.corrections || [];
    setCorrections(decisionFilter === 'pending' ? rows.filter((c) => !c.decision) : rows);
  }

  useEffect(() => {
    loadReferences()
      .catch((err) => setError(err.message || 'Could not load attendance settings'));
    loadCorrections().catch((err) => setError(err.message || 'Could not load corrections'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (classId || !classes.length) return;
    const first = classes.find((c) => (c.sections || []).length > 0) || classes[0];
    setClassId(String(first.id));
    setSectionId(String((first.sections || [])[0]?.id || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes]);

  useEffect(() => {
    loadRegister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, sectionId]);

  useEffect(() => {
    loadCorrections().catch((err) => setError(err.message || 'Could not load corrections'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionFilter]);

  async function submitCorrection(event) {
    event.preventDefault();
    if (!register || !selectedEntryId || !newPolicyId || !reason.trim()) {
      return toast('Pick an entry, a new status and a reason', 'warning');
    }
    const entry = markedEntries.find((e) => String(e.id) === String(selectedEntryId));
    if (!entry) return toast('The selected entry is no longer available', 'error');
    const body = {
      entryId: entry.id,
      registerId: register.id,
      studentId: entry.student_id,
      newPolicyId: Number(newPolicyId),
      reason: reason.trim(),
    };
    if (newRemark.trim()) body.newRemark = newRemark.trim();
    if (newLateMinutes !== '') body.newLateMinutes = Number(newLateMinutes);
    if (newPartialMinutes !== '') body.newPartialMinutes = Number(newPartialMinutes);
    setBusy(true);
    try {
      const result = await apiPost('/school/attendance/corrections', body);
      if (!result?.ok) return toast(result?.error || 'Could not request the correction', 'error');
      toast(result.afterCutoff
        ? 'Correction requested. It is after the reporting cutoff and needs an authorised reviewer.'
        : 'Correction requested', result.afterCutoff ? 'warning' : 'success');
      setSelectedEntryId('');
      setNewPolicyId('');
      setReason('');
      setNewRemark('');
      setNewLateMinutes('');
      setNewPartialMinutes('');
      await Promise.all([loadRegister(), loadCorrections()]);
    } catch (err) {
      toast(err.message || 'Could not request the correction', 'error');
    } finally {
      setBusy(false);
    }
  }

  function toggleBulk(id) {
    setBulkSelected((current) => ({ ...current, [id]: !current[id] }));
    setBulkPreview(null);
  }

  function toggleAllBulk() {
    const allSelected = markedEntries.length > 0 && markedEntries.every((e) => bulkSelected[e.id]);
    const next = {};
    if (!allSelected) markedEntries.forEach((e) => { next[e.id] = true; });
    setBulkSelected(next);
    setBulkPreview(null);
  }

  async function runBulk(preview) {
    if (!register || selectedBulkIds.length === 0 || !bulkPolicyId || !bulkReason.trim()) {
      return toast('Select entries, a new status and a reason', 'warning');
    }
    setBusy(true);
    try {
      const result = await apiPost('/school/attendance/corrections/bulk', {
        registerId: register.id,
        entryIds: selectedBulkIds.map(Number),
        newPolicyId: Number(bulkPolicyId),
        reason: bulkReason.trim(),
        preview,
      });
      if (!result?.ok) return toast(result?.error || 'Could not process the bulk correction', 'error');
      if (preview) {
        setBulkPreview(result);
        toast(`${result.wouldChange} entr${result.wouldChange === 1 ? 'y' : 'ies'} would change`, 'info');
      } else {
        toast(result.changed
          ? `${result.changed} correction request(s) created in batch ${String(result.batchId).slice(0, 8)}`
          : 'No entries needed changing', result.changed ? 'success' : 'info');
        setBulkPreview(null);
        setBulkSelected({});
        setBulkReason('');
        await Promise.all([loadRegister(), loadCorrections()]);
      }
    } catch (err) {
      toast(err.message || 'Could not process the bulk correction', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function decide(correction, decision) {
    const draft = decisions[correction.id] || {};
    if (decision === 'rejected' && !String(draft.reason || '').trim()) {
      return toast('A rejection reason is required', 'warning');
    }
    setBusy(true);
    try {
      const result = await apiPut(`/school/attendance/corrections/${correction.id}`, {
        decision,
        decisionReason: String(draft.reason || '').trim(),
        override: draft.override === true,
      });
      if (!result?.ok) return toast(result?.error || 'Could not record the decision', 'error');
      toast(`Correction ${decision}`, 'success');
      setDecisions((current) => ({ ...current, [correction.id]: { reason: '', override: false } }));
      await Promise.all([loadCorrections(), loadRegister()]);
    } catch (err) {
      toast(err.message || 'Could not record the decision', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Attendance Corrections"
      icon="bi-pencil-square"
      subtitle="Every change keeps the old value, new value, reason, requester and reviewer. Draft registers are edited directly; submitted and finalized ones are corrected here."
      onNavigate={onNavigate}
      actions={(
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { loadRegister(); loadCorrections().catch((err) => setError(err.message)); }} disabled={busy || loading}>
          <i className="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      )}
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1">Register date</label>
          <input type="date" className="form-control form-control-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1">Class</label>
          <select className="form-select form-select-sm" value={classId} onChange={(e) => {
            const next = e.target.value;
            setClassId(next);
            setSectionId(String((sectionsFor(classes, next)[0] || {}).id || ''));
          }}>
            <option value="">Choose class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1">Section</label>
          <select className="form-select form-select-sm" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">Choose section</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1">Decision</label>
          <select className="form-select form-select-sm" value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)}>
            <option value="">All decisions</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); loadRegister(); loadCorrections(); }} />
      {notice && <div className="alert alert-info py-2">{notice}</div>}

      {loading ? <Loading text="Loading registerÃ¢â‚¬Â¦" /> : !register ? (
        <div className="alert alert-secondary py-2 small">No register exists for the selected date and section. Mark attendance first.</div>
      ) : (
        <>
          {isDraft && (
            <div className="alert alert-warning py-2 small">
              This register is still a draft. Edit it directly in Mark Attendance; correction requests are for submitted or finalized registers.
            </div>
          )}
          <div className="d-flex flex-wrap gap-2 align-items-center mb-3 small text-muted">
            <span className="fw-semibold text-body">{register.class_name} {register.section_name}</span>
            <span>{fmtDate(register.register_date)}</span>
            <Badge tone={isDraft ? 'secondary' : 'info'}>{register.state}</Badge>
            <span>{markedEntries.length} marked entr{markedEntries.length === 1 ? 'y' : 'ies'}</span>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-lg-6">
              <div className="border rounded p-3 h-100">
                <h6 className="fw-bold">Request a correction</h6>
                <form onSubmit={submitCorrection}>
                  <label className="form-label small">Entry *</label>
                  <select className="form-select form-select-sm mb-2" value={selectedEntryId} onChange={(e) => setSelectedEntryId(e.target.value)} disabled={isDraft || busy}>
                    <option value="">Choose a marked student</option>
                    {markedEntries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.roll_no ? `${entry.roll_no} Ã‚Â· ` : ''}{entry.first_name} {entry.last_name || ''} Ã¢â‚¬â€ {entry.status_label || entry.status_code}
                      </option>
                    ))}
                  </select>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small">New status *</label>
                      <select className="form-select form-select-sm mb-2" value={newPolicyId} onChange={(e) => setNewPolicyId(e.target.value)} disabled={isDraft || busy}>
                        <option value="">Choose status</option>
                        {policies.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.code})</option>)}
                      </select>
                    </div>
                    <div className="col-3">
                      <label className="form-label small">Late min</label>
                      <input type="number" min="0" className="form-control form-control-sm mb-2" value={newLateMinutes} onChange={(e) => setNewLateMinutes(e.target.value)} disabled={isDraft || busy} />
                    </div>
                    <div className="col-3">
                      <label className="form-label small">Partial min</label>
                      <input type="number" min="0" className="form-control form-control-sm mb-2" value={newPartialMinutes} onChange={(e) => setNewPartialMinutes(e.target.value)} disabled={isDraft || busy} />
                    </div>
                  </div>
                  <label className="form-label small">New remark</label>
                  <input className="form-control form-control-sm mb-2" value={newRemark} onChange={(e) => setNewRemark(e.target.value)} disabled={isDraft || busy} />
                  <label className="form-label small">Reason *</label>
                  <input className="form-control form-control-sm mb-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is the original entry wrong?" disabled={isDraft || busy} />
                  <button type="submit" className="btn btn-sm btn-primary" disabled={isDraft || busy}>
                    <i className="bi bi-send me-1"></i>Request correction
                  </button>
                </form>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="border rounded p-3 h-100">
                <h6 className="fw-bold">Bulk correction</h6>
                <p className="small text-muted">Each selected entry becomes its own attributable correction record in one batch.</p>
                <div className="table-responsive border rounded mb-2" style={{ maxHeight: 190 }}>
                  <table className="table table-sm mb-0 align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>
                          <input type="checkbox" checked={markedEntries.length > 0 && markedEntries.every((e) => bulkSelected[e.id])} onChange={toggleAllBulk} disabled={isDraft || busy} aria-label="Select all" />
                        </th>
                        <th>Student</th>
                        <th>Current</th>
                      </tr>
                    </thead>
                    <tbody>
                      {markedEntries.length === 0 && <tr><td colSpan="3" className="text-muted small">No marked entries.</td></tr>}
                      {markedEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td><input type="checkbox" checked={Boolean(bulkSelected[entry.id])} onChange={() => toggleBulk(entry.id)} disabled={isDraft || busy} aria-label={`Select ${entry.first_name}`} /></td>
                          <td className="small">{entry.first_name} {entry.last_name || ''}</td>
                          <td className="small">{entry.status_label || entry.status_code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="row g-2">
                  <div className="col-6">
                    <select className="form-select form-select-sm mb-2" value={bulkPolicyId} onChange={(e) => { setBulkPolicyId(e.target.value); setBulkPreview(null); }} disabled={isDraft || busy}>
                      <option value="">New status *</option>
                      {policies.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.code})</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <input className="form-control form-control-sm mb-2" value={bulkReason} onChange={(e) => { setBulkReason(e.target.value); setBulkPreview(null); }} placeholder="Reason *" disabled={isDraft || busy} />
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => runBulk(true)} disabled={isDraft || busy || selectedBulkIds.length === 0}>
                    Preview ({selectedBulkIds.length})
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => runBulk(false)} disabled={isDraft || busy || selectedBulkIds.length === 0 || !bulkPreview}>
                    Apply batch
                  </button>
                </div>
                {bulkPreview && (
                  <div className="small mt-2">
                    <div className="text-muted">Would change {bulkPreview.wouldChange} entr{bulkPreview.wouldChange === 1 ? 'y' : 'ies'} to <strong>{bulkPreview.newPolicy?.label}</strong>.</div>
                    <ul className="mb-0 mt-1 ps-3">
                      {bulkPreview.entries.slice(0, 8).map((e) => (
                        <li key={e.entry_id}>{e.first_name} {e.last_name || ''}: {e.current_label || e.current_code} Ã¢â€ â€™ {bulkPreview.newPolicy?.label}</li>
                      ))}
                      {bulkPreview.entries.length > 8 && <li>Ã¢â‚¬Â¦and {bulkPreview.entries.length - 8} more</li>}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="border rounded">
        <div className="px-3 py-2 border-bottom d-flex align-items-center gap-2">
          <span className="fw-semibold small">Correction requests</span>
          <span className="badge bg-secondary">{corrections.length}</span>
        </div>
        {corrections.length === 0 ? (
          <Empty icon="bi-pencil-square" text="No corrections match this filter." />
        ) : (
          <div className="table-responsive">
            <table className="table table-sm mb-0 align-middle">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Change</th>
                  <th>Reason / decision</th>
                  <th>Source</th>
                  <th>Requested</th>
                  <th>Decision</th>
                  <th className="text-end">Review</th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((correction) => {
                  const draft = decisions[correction.id] || {};
                  const pending = !correction.decision;
                  return (
                    <tr key={correction.id}>
                      <td className="text-nowrap small">{correction.register_date ? fmtDate(correction.register_date) : 'Ã¢â‚¬â€'}</td>
                      <td className="small">
                        <div className="fw-semibold">{correction.first_name} {correction.last_name || ''}</div>
                        <div className="text-muted">{correction.admission_no}</div>
                      </td>
                      <td className="small">
                        <span className="text-muted">{correction.old_label || correction.old_code || 'Ã¢â‚¬â€'}</span>
                        <i className="bi bi-arrow-right mx-1"></i>
                        <strong>{correction.new_label || correction.new_code || 'Ã¢â‚¬â€'}</strong>
                        {correction.new_remark ? <div className="text-muted">Ã¢â‚¬Å“{correction.new_remark}Ã¢â‚¬Â</div> : null}
                        {correction.after_cutoff ? <div><Badge tone="danger">after cutoff</Badge></div> : null}
                      </td>
                      <td className="small" style={{ maxWidth: 240 }}>
                        <div>{correction.reason}</div>
                        {correction.decision_reason ? <div className="text-muted">Review: {correction.decision_reason}</div> : null}
                      </td>
                      <td className="small">
                        {correction.source || 'manual'}
                        {correction.batch_id ? <div className="text-muted" title={correction.batch_id}>batch {String(correction.batch_id).slice(0, 8)}</div> : null}
                      </td>
                      <td className="small">
                        {correction.requested_by || 'Ã¢â‚¬â€'}
                        <div className="text-muted">{correction.requested_at ? fmtDateTime(correction.requested_at) : ''}</div>
                      </td>
                      <td>
                        <Badge tone={decisionTone(correction.decision || 'pending')}>{correction.decision || 'pending'}</Badge>
                        {correction.reviewed_by ? <div className="small text-muted">{correction.reviewed_by}</div> : null}
                      </td>
                      <td className="text-end" style={{ minWidth: 220 }}>
                        {pending ? (
                          <div className="d-flex flex-column gap-1 align-items-end">
                            <input
                              className="form-control form-control-sm"
                              value={draft.reason || ''}
                              onChange={(e) => setDecisions((current) => ({ ...current, [correction.id]: { ...draft, reason: e.target.value } }))}
                              placeholder="Decision reason (required to reject)"
                              disabled={busy}
                            />
                            {me?.isSuper && (
                              <label className="small text-muted d-flex align-items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={draft.override === true}
                                  onChange={(e) => setDecisions((current) => ({ ...current, [correction.id]: { ...draft, override: e.target.checked } }))}
                                  disabled={busy}
                                />
                                Admin override
                              </label>
                            )}
                            <div className="d-flex gap-1">
                              <button type="button" className="btn btn-sm btn-success" onClick={() => decide(correction, 'approved')} disabled={busy}>Approve</button>
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => decide(correction, 'rejected')} disabled={busy}>Reject</button>
                            </div>
                          </div>
                        ) : (
                          <span className="small text-muted">{correction.processed_at ? fmtDateTime(correction.processed_at) : 'Ã¢â‚¬â€'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="small text-muted mt-2">
        Draft registers are edited directly. Submitted and finalized registers only change through corrections, each keeping the old and new value plus who requested, who reviewed and why.
      </div>
    </PageShell>
  );
}
