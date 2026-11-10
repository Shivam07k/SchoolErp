import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, outcomeTone, fmtDateTime, canManage, downloadCsv } from './shared';

const OUTCOMES = ['pass', 'fail', 'compartment', 'withheld', 'incomplete', 'promoted', 'detained'];

export default function ResultsDashboard({ me, onNavigate }) {
  const [versions, setVersions] = useState([]);
  const [exams, setExams] = useState([]);
  const [createExamId, setCreateExamId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [students, setStudents] = useState([]);
  const [checks, setChecks] = useState([]);
  const [subjectResults, setSubjectResults] = useState({});
  const [openStudentId, setOpenStudentId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [filterOutcome, setFilterOutcome] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const manager = canManage(me);

  async function loadVersions() {
    setError('');
    try {
      const [verRes, examRes] = await Promise.all([
        apiGet('/school/exam/result-versions'),
        apiGet('/school/exams'),
      ]);
      if (!verRes?.ok) throw new Error(verRes?.error || 'Could not load result versions');
      setVersions(verRes.versions || []);
      if (examRes?.ok) setExams(examRes.exams || []);
    } catch (err) {
      setError(err.message || 'Failed to load versions');
    }
  }

  async function loadChecks(versionId) {
    try {
      const res = await apiGet(`/school/exam/result-versions/${versionId}/checks`);
      if (res?.ok) setChecks(res.checks || []);
    } catch {
      setChecks([]);
    }
  }

  async function loadVersion(versionId) {
    setLoading(true);
    setError('');
    setOpenStudentId(null);
    setSubjectResults({});
    setSummary(null);
    try {
      const [verRes, stuRes] = await Promise.all([
        apiGet(`/school/exam/result-versions/${versionId}`),
        apiGet(`/school/exam/result-versions/${versionId}/students`),
      ]);
      if (!verRes?.ok) throw new Error(verRes?.error || 'Could not load version');
      if (!stuRes?.ok) throw new Error(stuRes?.error || 'Could not load students');
      setSelectedVersion(verRes.version);
      setStudents(stuRes.students || []);
      loadChecks(versionId);
    } catch (err) {
      setError(err.message || 'Failed to load version details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadVersions(); }, []);

  const stats = useMemo(() => {
    const agg = { total: 0, pass: 0, fail: 0, compartment: 0, withheld: 0, incomplete: 0, promoted: 0, detained: 0 };
    students.forEach((s) => {
      agg.total++;
      if (agg[s.outcome] !== undefined) agg[s.outcome]++;
    });
    return agg;
  }, [students]);

  const filtered = useMemo(() => students.filter((s) => !filterOutcome || s.outcome === filterOutcome), [students, filterOutcome]);

  async function createVersion() {
    if (!createExamId) return toast('Select an exam first', 'warning');
    setBusy(true);
    try {
      const res = await apiPost('/school/exam/result-versions', { examId: Number(createExamId) });
      if (!res?.ok) throw new Error(res?.error || 'Failed to create version');
      toast(`Result version v${res.version.version_no} created`, 'success');
      setCreateExamId('');
      await loadVersions();
      loadVersion(res.version.id);
    } catch (err) { toast(err.message || 'Failed to create version', 'error'); }
    finally { setBusy(false); }
  }

  async function processVersion(versionId) {
    if (!window.confirm('Process results for this version? This recalculates totals, grades and ranks from locked marks sheets.')) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiPost(`/school/exam/result-versions/${versionId}/process`);
      if (!res?.ok) {
        if (Array.isArray(res?.checks)) setChecks(res.checks);
        throw new Error(res?.error || 'Failed to process results');
      }
      setSummary(res.summary || null);
      setChecks(res.checks || []);
      toast(`Processed ${res.processed} student result(s)`, 'success');
      await loadVersion(versionId);
    } catch (err) {
      setError(err.message || 'Failed to process results');
      toast(err.message || 'Failed to process results', 'error');
    } finally { setBusy(false); }
  }

  async function publishVersion(versionId) {
    if (!window.confirm('Publish this result version? This notifies parents and students and makes report cards generatable.')) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiPost(`/school/exam/result-versions/${versionId}/publish`);
      if (!res?.ok) {
        if (Array.isArray(res?.checks)) setChecks(res.checks);
        throw new Error(res?.error || 'Failed to publish');
      }
      toast(res.alreadyPublished ? 'Version was already published' : 'Results published', 'success');
      await loadVersions();
      await loadVersion(versionId);
    } catch (err) {
      setError(err.message || 'Failed to publish');
      toast(err.message || 'Failed to publish', 'error');
    } finally { setBusy(false); }
  }

  async function toggleSubjects(student) {
    if (openStudentId === student.student_id) { setOpenStudentId(null); return; }
    setOpenStudentId(student.student_id);
    if (subjectResults[student.student_id]) return;
    try {
      const res = await apiGet(`/school/exam/result-versions/${selectedVersion.id}/subject-results?studentId=${student.student_id}`);
      if (!res?.ok) throw new Error(res?.error || 'Could not load subject results');
      setSubjectResults((prev) => ({ ...prev, [student.student_id]: res.subjectResults || [] }));
    } catch (err) {
      toast(err.message || 'Could not load subject results', 'error');
    }
  }

  function exportCsv() {
    if (!filtered.length) return;
    downloadCsv(`results-${selectedVersion?.id || 'version'}.csv`, [
      { label: 'Student', value: (r) => `${r.first_name} ${r.last_name}` },
      { label: 'Admission', key: 'admission_no' },
      { label: 'Total', key: 'total_marks' },
      { label: 'Max', key: 'max_total_marks' },
      { label: 'Percentage', key: 'percentage' },
      { label: 'Grade', key: 'grade' },
      { label: 'Rank', key: 'rank' },
      { label: 'Outcome', key: 'outcome' },
    ], filtered);
  }

  const errorChecks = checks.filter((c) => c.severity === 'error');
  const warningChecks = checks.filter((c) => c.severity !== 'error');

  return (
    <PageShell
      title="Results"
      icon="bi-graph-up"
      subtitle="Process locked marks, run pre-publish checks, and publish versioned results"
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={loadVersions} disabled={busy}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/reports')}><i className="bi bi-file-earmark-bar-graph me-1"></i>Reports</button>
        </>
      }
    >
      <ErrorBox message={error} onRetry={loadVersions} />

      <div className="row g-3">
        <div className="col-lg-4">
          {manager && (
            <div className="border rounded p-3 mb-3">
              <h6 className="fw-semibold small mb-2">New result version</h6>
              <div className="d-flex gap-2">
                <select className="form-select form-select-sm" value={createExamId} onChange={(e) => setCreateExamId(e.target.value)}>
                  <option value="">Select exam</option>
                  {exams.map((e) => <option key={e.id} value={e.id}>{e.name}{e.term_name ? ` Ã‚Â· ${e.term_name}` : ''}</option>)}
                </select>
                <button className="btn btn-sm btn-primary text-nowrap" onClick={createVersion} disabled={busy || !createExamId}>Create</button>
              </div>
              <div className="text-muted mt-2" style={{ fontSize: 12 }}>The class band and active result rule are derived from the exam's papers.</div>
            </div>
          )}

          <div className="border rounded">
            <div className="px-3 py-2 border-bottom fw-semibold small">Result Versions ({versions.length})</div>
            {versions.length === 0 ? <Empty icon="bi-journal-plus" text="No result versions yet. Create one from an exam with locked marks sheets." /> : (
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle">
                  <thead><tr><th>Exam</th><th>Band</th><th>Ver</th><th>Status</th><th>Published</th></tr></thead>
                  <tbody>
                    {versions.map((v) => (
                      <tr key={v.id} onClick={() => loadVersion(v.id)} style={{ cursor: 'pointer', background: selectedVersion?.id === v.id ? '#e7f5ff' : '' }}>
                        <td className="small">{v.exam_name || v.term_name || 'Ã¢â‚¬â€'}</td>
                        <td className="small">{v.class_band}</td>
                        <td>{v.version_no}</td>
                        <td><span className={`badge bg-${v.status === 'published' ? 'success' : v.status === 'processed' ? 'info' : v.status === 'draft' ? 'secondary' : 'warning'}`}>{v.status}</span></td>
                        <td className="small">{v.published_at ? fmtDateTime(v.published_at) : 'Ã¢â‚¬â€'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-8">
          {loading ? <Loading text="Loading result versionÃ¢â‚¬Â¦" /> : selectedVersion ? (
            <>
              <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                <span className={`badge bg-${selectedVersion.status === 'published' ? 'success' : selectedVersion.status === 'processed' ? 'info' : 'secondary'}`}>{selectedVersion.status}</span>
                <span className="small text-muted">{selectedVersion.exam_name || 'Ã¢â‚¬â€'} Ã‚Â· {selectedVersion.class_band} Ã‚Â· v{selectedVersion.version_no}</span>
                <div className="ms-auto d-flex gap-2">
                  {selectedVersion.status !== 'published' && selectedVersion.status !== 'frozen' && (
                    <button className="btn btn-sm btn-primary" onClick={() => processVersion(selectedVersion.id)} disabled={busy}>
                      <i className="bi bi-play me-1"></i>Process
                    </button>
                  )}
                  {selectedVersion.status === 'processed' && (
                    <button className="btn btn-sm btn-success" onClick={() => publishVersion(selectedVersion.id)} disabled={busy}>
                      <i className="bi bi-send me-1"></i>Publish
                    </button>
                  )}
                  {selectedVersion.status === 'published' && (
                    <button className="btn btn-sm btn-outline-success" onClick={() => onNavigate('/school/examinations/report-cards')}>
                      <i className="bi bi-file-earmark-text me-1"></i>Report Cards
                    </button>
                  )}
                </div>
              </div>

              <div className="border rounded mb-3">
                <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                  <span className="fw-semibold small">Pre-publish checks</span>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => loadChecks(selectedVersion.id)}><i className="bi bi-arrow-clockwise"></i></button>
                </div>
                <div className="p-3">
                  {!checks.length ? (
                    <div className="small text-success"><i className="bi bi-check-circle me-1"></i>No blocking checks reported.</div>
                  ) : (
                    <div className="d-grid gap-2">
                      {errorChecks.length > 0 && errorChecks.map((c, i) => (
                        <div key={`e${i}`} className="alert alert-danger py-2 mb-0 small">
                          <strong>{c.message}</strong>
                          {c.items?.length ? <div className="mt-1 text-muted">{c.items.slice(0, 8).join(' Ã‚Â· ')}{c.items.length > 8 ? ' Ã¢â‚¬Â¦' : ''}</div> : null}
                        </div>
                      ))}
                      {warningChecks.map((c, i) => (
                        <div key={`w${i}`} className="alert alert-warning py-2 mb-0 small">
                          <strong>{c.message}</strong>
                          {c.items?.length ? <div className="mt-1 text-muted">{c.items.slice(0, 8).join(' Ã‚Â· ')}{c.items.length > 8 ? ' Ã¢â‚¬Â¦' : ''}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                  {summary && (
                    <div className="mt-2 small text-muted">
                      Last run: {summary.processed ?? summary.total ?? 0} student(s){summary.fail != null ? ` Ã‚Â· pass ${summary.pass ?? 0}, fail ${summary.fail ?? 0}` : ''}
                    </div>
                  )}
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6 col-md-3"><div className="border rounded p-3"><div className="text-muted small">Students</div><div className="fs-4 fw-bold">{stats.total}</div></div></div>
                <div className="col-6 col-md-3"><div className="border rounded p-3"><div className="text-muted small">Pass</div><div className="fs-4 fw-bold text-success">{stats.pass}</div></div></div>
                <div className="col-6 col-md-3"><div className="border rounded p-3"><div className="text-muted small">Fail</div><div className="fs-4 fw-bold text-danger">{stats.fail}</div></div></div>
                <div className="col-6 col-md-3"><div className="border rounded p-3"><div className="text-muted small">Compartment</div><div className="fs-4 fw-bold text-warning">{stats.compartment}</div></div></div>
              </div>

              <div className="border rounded">
                <div className="px-3 py-2 border-bottom d-flex flex-wrap gap-2 justify-content-between align-items-center">
                  <span className="fw-semibold small">Student Results {selectedVersion.exam_name ? `Ã¢â‚¬â€ ${selectedVersion.exam_name}` : ''}</span>
                  <div className="d-flex gap-2">
                    <select className="form-select form-select-sm" style={{ width: 'auto' }} value={filterOutcome} onChange={(e) => setFilterOutcome(e.target.value)}>
                      <option value="">All outcomes</option>
                      {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <button className="btn btn-sm btn-outline-secondary" onClick={exportCsv} disabled={!filtered.length}><i className="bi bi-download me-1"></i>CSV</button>
                  </div>
                </div>
                {!students.length ? <Empty icon="bi-people" text="No student results yet. Process this version once all marks sheets are locked." /> : !filtered.length ? <Empty icon="bi-funnel" text="No students match the current filter." /> : (
                  <div className="table-responsive">
                    <table className="table table-sm mb-0 align-middle">
                      <thead><tr><th>Student</th><th>Admission</th><th>Total / Max</th><th>%</th><th>Grade</th><th>Rank</th><th>Outcome</th><th className="text-end"></th></tr></thead>
                      <tbody>
                        {filtered.map((s) => (
                          <React.Fragment key={s.id}>
                            <tr>
                              <td className="small fw-semibold">{s.first_name} {s.last_name}</td>
                              <td className="small">{s.admission_no}</td>
                              <td className="small">{s.total_marks} / {s.max_total_marks}</td>
                              <td className="small">{s.percentage}%</td>
                              <td><span className="badge bg-success">{s.grade || 'Ã¢â‚¬â€'}</span></td>
                              <td>{s.rank || 'Ã¢â‚¬â€'}</td>
                              <td><span className={`badge bg-${outcomeTone(s.outcome)}`}>{s.outcome || 'Ã¢â‚¬â€'}</span></td>
                              <td className="text-end">
                                <button className="btn btn-sm btn-outline-primary" onClick={() => toggleSubjects(s)}>
                                  {openStudentId === s.student_id ? 'Hide' : 'Subjects'}
                                </button>
                              </td>
                            </tr>
                            {openStudentId === s.student_id && (
                              <tr>
                                <td colSpan={8} className="bg-light p-0">
                                  {!subjectResults[s.student_id] ? (
                                    <div className="p-3 small text-muted">Loading subject resultsÃ¢â‚¬Â¦</div>
                                  ) : subjectResults[s.student_id].length === 0 ? (
                                    <div className="p-3 small text-muted">No subject results recorded.</div>
                                  ) : (
                                    <table className="table table-sm mb-0">
                                      <thead><tr><th>Subject</th><th>Marks</th><th>Max</th><th>%</th><th>Grade</th><th>Grace</th><th>Outcome</th></tr></thead>
                                      <tbody>
                                        {subjectResults[s.student_id].map((sub) => (
                                          <tr key={sub.id}>
                                            <td className="small">{sub.subject_name || 'Ã¢â‚¬â€'}</td>
                                            <td className="small">{sub.marks_obtained ?? 'Ã¢â‚¬â€'}</td>
                                            <td className="small">{sub.max_marks ?? 'Ã¢â‚¬â€'}</td>
                                            <td className="small">{sub.percentage != null ? `${sub.percentage}%` : 'Ã¢â‚¬â€'}</td>
                                            <td className="small">{sub.grade || 'Ã¢â‚¬â€'}</td>
                                            <td className="small">{Number(sub.grace_marks || 0) || 'Ã¢â‚¬â€'}</td>
                                            <td className="small"><span className={`badge bg-${outcomeTone(sub.outcome)}`}>{sub.outcome || 'Ã¢â‚¬â€'}</span></td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="border rounded p-5 text-center">
              <i className="bi bi-graph-up d-block mb-2 text-muted" style={{ fontSize: 40 }}></i>
              <h6 className="fw-bold">Select a result version</h6>
              <p className="text-muted small mb-0">Process locked marks sheets into results, review the checks, then publish.</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

