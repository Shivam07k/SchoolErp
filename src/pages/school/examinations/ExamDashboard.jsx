import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, Badge, examStatusTone, marksSheetTone, fmtDate, canManage, downloadCsv } from './shared';

export default function ExamDashboard({ me, onNavigate }) {
  const [exams, setExams] = useState([]);
  const [stats, setStats] = useState({ total: 0, draft: 0, scheduled: 0, marks_entry_open: 0, marks_locked: 0, processed: 0, published: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const manager = canManage(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [examRes, sheetRes] = await Promise.all([
        apiGet('/school/exams'),
        apiGet('/school/marks-sheets/dashboard'),
      ]);
      if (!examRes?.ok) throw new Error(examRes?.error || 'Could not load exams');
      if (!sheetRes?.ok) throw new Error(sheetRes?.error || 'Could not load sheet stats');

      const examList = examRes.exams || [];
      setExams(examList);

      const sheetStats = sheetRes.dashboard || [];
      const agg = { total: 0, draft: 0, scheduled: 0, marks_entry_open: 0, marks_locked: 0, processed: 0, published: 0 };
      sheetStats.forEach((s) => {
        agg.total += s.count;
        if (agg[s.state] !== undefined) agg[s.state] += s.count;
      });
      setStats(agg);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function exportExams() {
    if (!exams.length) return toast('No exams to export', 'warning');
    downloadCsv('exams.csv', [
      { label: 'Name', key: 'name' },
      { label: 'Type', key: 'type' },
      { label: 'Term', key: 'term_name' },
      { label: 'Weightage %', key: 'weightage' },
      { label: 'Start', value: (r) => fmtDate(r.start_date) },
      { label: 'End', value: (r) => fmtDate(r.end_date) },
      { label: 'Status', key: 'status' },
      { label: 'Best of N', key: 'best_of_n' },
      { label: 'Created', value: (r) => fmtDate(r.created_at) },
    ], exams);
  }

  return (
    <PageShell
      title="Examinations Dashboard"
      icon="bi-journal-check"
      subtitle="Overview of exams, marks entry progress, and quick actions"
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={exportExams} disabled={!exams.length}>
            <i className="bi bi-download me-1"></i>Export CSV
          </button>
          {manager && (
            <button className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/examinations/setup')}>
              <i className="bi bi-plus-lg me-1"></i>New Exam
            </button>
          )}
        </>
      }
    >
      <ErrorBox message={error} onRetry={load} />

      {loading ? <Loading text="Loading dashboardÃ¢â‚¬Â¦" /> : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3"><div className="border rounded p-3"><div className="text-muted small">Total Exams</div><div className="fs-4 fw-bold">{exams.length}</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3"><div className="text-muted small">Marks Sheets</div><div className="fs-4 fw-bold">{stats.total}</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3"><div className="text-muted small">Pending Entry</div><div className="fs-4 fw-bold text-warning">{stats.draft + stats.marks_entry_open}</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3"><div className="text-muted small">Published Results</div><div className="fs-4 fw-bold text-success">{stats.published}</div></div></div>
          </div>

          <div className="row g-3">
            <div className="col-lg-8">
              <div className="border rounded">
                <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                  <span className="fw-semibold small">Exams</span>
                  <span className="badge bg-secondary">{exams.length}</span>
                </div>
                {exams.length === 0 ? (
                  <Empty icon="bi-journal-plus" text="No exams configured yet. Create your first exam to get started." />
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>Exam</th>
                          <th>Type</th>
                          <th>Term</th>
                          <th>Weight %</th>
                          <th>Dates</th>
                          <th>Status</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exams.map((exam) => (
                          <tr key={exam.id}>
                            <td>
                              <div className="fw-semibold">{exam.name}</div>
                              <div className="small text-muted">Best of {exam.best_of_n || 'Ã¢â‚¬â€'} of {exam.best_of_m || 'Ã¢â‚¬â€'}</div>
                            </td>
                            <td><Badge tone={exam.type === 'annual' ? 'success' : exam.type === 'half_yearly' ? 'info' : exam.type === 'unit_test' ? 'primary' : 'secondary'}>{exam.type}</Badge></td>
                            <td className="small">{exam.term_name || 'Ã¢â‚¬â€'}</td>
                            <td>{exam.weightage || 0}%</td>
                            <td className="small">{exam.start_date ? fmtDate(exam.start_date) : 'Ã¢â‚¬â€'} {exam.end_date ? 'Ã¢â‚¬â€œ ' + fmtDate(exam.end_date) : ''}</td>
                            <td><Badge tone={examStatusTone(exam.status)}>{exam.status.replace('_', ' ')}</Badge></td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <button className="btn btn-outline-primary" onClick={() => onNavigate(`/school/examinations/setup?exam=${exam.id}`)} title="Edit">Edit</button>
                                {exam.status === 'draft' && manager && (
                                  <button className="btn btn-outline-success" onClick={() => setExamStatus(exam.id, 'scheduled')} title="Schedule">Schedule</button>
                                )}
                                {exam.status === 'scheduled' && manager && (
                                  <button className="btn btn-outline-primary" onClick={() => setExamStatus(exam.id, 'marks_entry_open')} title="Open Marks Entry">Open Entry</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="col-lg-4">
              <div className="border rounded">
                <div className="px-3 py-2 border-bottom fw-semibold small">Marks Sheet Status</div>
                {stats.total === 0 ? (
                  <Empty icon="bi-table" text="No marks sheets created yet." />
                ) : (
                  <div className="p-3">
                    <div className="d-flex justify-content-between small mb-2"><span>Not Started</span><span className="fw-bold">{stats.not_started || 0}</span></div>
                    <div className="d-flex justify-content-between small mb-2"><span>Draft</span><span className="fw-bold">{stats.draft || 0}</span></div>
                    <div className="d-flex justify-content-between small mb-2"><span>Submitted</span><span className="fw-bold">{stats.submitted || 0}</span></div>
                    <div className="d-flex justify-content-between small mb-2"><span>Verified</span><span className="fw-bold">{stats.verified || 0}</span></div>
                    <div className="d-flex justify-content-between small mb-2"><span>Locked</span><span className="fw-bold">{stats.locked || 0}</span></div>
                    <div className="d-flex justify-content-between small mb-2"><span>Reopened</span><span className="fw-bold">{stats.reopened || 0}</span></div>
                    <hr />
                    <div className="d-flex justify-content-between fw-bold small"><span>Total</span><span>{stats.total}</span></div>
                  </div>
                )}
              </div>

              <div className="border rounded mt-3">
                <div className="px-3 py-2 border-bottom fw-semibold small">Quick Links</div>
                <div className="p-3 d-grid gap-2">
                  <button className="btn btn-outline-primary btn-sm" onClick={() => onNavigate('/school/examinations/terms')}>
                    <i className="bi bi-calendar3 me-2"></i>Terms
                  </button>
                  <button className="btn btn-outline-primary btn-sm" onClick={() => onNavigate('/school/examinations/grade-setup')}>
                    <i className="bi bi-award me-2"></i>Grade Setup
                  </button>
                  <button className="btn btn-outline-primary btn-sm" onClick={() => onNavigate('/school/examinations/marks')}>
                    <i className="bi bi-pencil-square me-2"></i>Marks Entry
                  </button>
                  <button className="btn btn-outline-primary btn-sm" onClick={() => onNavigate('/school/examinations/results')}>
                    <i className="bi bi-graph-up me-2"></i>Results
                  </button>
                  <button className="btn btn-outline-primary btn-sm" onClick={() => onNavigate('/school/examinations/report-cards')}>
                    <i className="bi bi-file-earmark-text me-2"></i>Report Cards
                  </button>
                  <button className="btn btn-outline-primary btn-sm" onClick={() => onNavigate('/school/examinations/schedule')}>
                    <i className="bi bi-calendar3-week me-2"></i>Exam Schedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}

async function setExamStatus(examId, status) {
  // TODO: implement status update
}
