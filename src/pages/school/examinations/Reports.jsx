import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, fmtDateTime, canManage, downloadCsv } from './shared';

const FALLBACK_REPORTS = [
  { key: 'date-sheet', title: 'Date Sheet by Class', group: 'Schedule' },
  { key: 'teacher-duty', title: 'Teacher Duty Chart', group: 'Schedule' },
  { key: 'seating-plan', title: 'Seating Plan', group: 'Schedule' },
  { key: 'marks-entry-status', title: 'Marks Entry Status', group: 'Marks' },
  { key: 'consolidated-marks', title: 'Consolidated Mark Sheet', group: 'Marks' },
  { key: 'absentees', title: 'Absentees in Exams', group: 'Marks' },
  { key: 'class-result-sheet', title: 'Class Result Sheet', group: 'Results' },
  { key: 'subject-analysis', title: 'Subject-wise Analysis', group: 'Results' },
  { key: 'merit-list', title: 'Merit List / Toppers', group: 'Results' },
  { key: 'fail-compartment-list', title: 'Fail & Compartment List', group: 'Results' },
  { key: 'grace-marks', title: 'Grace Marks Report', group: 'Results' },
  { key: 'teacher-pass-percent', title: 'Teacher-wise Pass %', group: 'Results' },
  { key: 'term-comparison', title: 'Term Comparison', group: 'Analysis' },
  { key: 'student-performance-history', title: 'Student Performance History', group: 'Analysis' },
  { key: 're-evaluation', title: 'Re-evaluation Report', group: 'Analysis' },
  { key: 'promotion-list', title: 'Promotion List', group: 'Analysis' },
  { key: 'board-export', title: 'Board Export', group: 'Analysis' },
];

export default function Reports({ me, onNavigate }) {
  const [catalog, setCatalog] = useState(FALLBACK_REPORTS);
  const [reportType, setReportType] = useState('marks-entry-status');
  const [exams, setExams] = useState([]);
  const [versions, setVersions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filters, setFilters] = useState({ examId: '', versionId: '', classId: '', sectionId: '', fromDate: '', toDate: '', studentId: '' });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState('');
  const manager = canManage(me);
  const current = useMemo(() => catalog.find((r) => r.key === reportType), [catalog, reportType]);

  async function boot() {
    setBootLoading(true);
    setError('');
    try {
      const [catRes, examRes, versionRes, classRes] = await Promise.all([
        apiGet('/school/exam/reports'),
        apiGet('/school/exams'),
        apiGet('/school/exam/result-versions'),
        apiGet('/school/classes'),
      ]);
      if (catRes?.ok && Array.isArray(catRes.reportTypes)) setCatalog(catRes.reportTypes);
      if (examRes?.ok) setExams(examRes.exams || []);
      if (versionRes?.ok) setVersions(versionRes.versions || []);
      if (classRes?.ok) setClasses(classRes.classes || []);
    } catch (err) {
      setError(err.message || 'Failed to load report filters');
    } finally {
      setBootLoading(false);
    }
  }

  useEffect(() => { boot(); }, []);

  const sections = useMemo(() => {
    if (!filters.classId) return classes.flatMap((c) => (c.sections || []).map((s) => ({ ...s, class_name: c.name })));
    const cls = classes.find((c) => String(c.id) === String(filters.classId));
    return (cls?.sections || []).map((s) => ({ ...s, class_name: cls.name }));
  }, [classes, filters.classId]);

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value, ...(key === 'classId' ? { sectionId: '' } : {}) }));
  }

  async function run() {
    setLoading(true);
    setError('');
    try {
      const query = Object.entries(filters)
        .filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
      const res = await apiGet(`/school/exam/reports/${reportType}${query ? `?${query}` : ''}`);
      if (!res?.ok) throw new Error(res?.error || 'Could not run report');
      setReport(res);
      if (!(res.rows || []).length) toast('Report ran, but no rows matched the filters', 'info');
    } catch (err) {
      setError(err.message || 'Failed to run report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!report?.rows?.length) return toast('Run a report with rows first', 'warning');
    const columns = report.columns || [];
    downloadCsv(`${reportType}.csv`, columns.map((c) => ({ label: c.label, value: (row) => row[c.key] })), report.rows);
  }

  return (
    <PageShell
      title="Examination Reports"
      icon="bi-file-earmark-bar-graph"
      subtitle="Analysis, schedules, marks status and result reports Ã¢â‚¬â€ preview and export"
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={boot} disabled={bootLoading}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={exportCsv} disabled={!report?.rows?.length}>
            <i className="bi bi-download me-1"></i>CSV
          </button>
          <button className="btn btn-sm btn-primary" onClick={run} disabled={loading}>
            <i className="bi bi-play me-1"></i>{loading ? 'RunningÃ¢â‚¬Â¦' : 'Run Report'}
          </button>
        </>
      }
    >
      <ErrorBox message={error} onRetry={boot} />

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label small">Report</label>
          <select className="form-select form-select-sm" value={reportType} onChange={(e) => { setReportType(e.target.value); setReport(null); }}>
            {Array.from(new Set(catalog.map((r) => r.group))).map((group) => (
              <optgroup key={group} label={group}>
                {catalog.filter((r) => r.group === group).map((r) => <option key={r.key} value={r.key}>{r.title}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label small">Exam</label>
          <select className="form-select form-select-sm" value={filters.examId} onChange={(e) => setFilter('examId', e.target.value)}>
            <option value="">All exams</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label small">Result Version</label>
          <select className="form-select form-select-sm" value={filters.versionId} onChange={(e) => setFilter('versionId', e.target.value)}>
            <option value="">All versions</option>
            {versions.map((v) => <option key={v.id} value={v.id}>{v.exam_name || v.term_name || `Version ${v.id}`} Ã‚Â· v{v.version_no} ({v.status})</option>)}
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label small">Class</label>
          <select className="form-select form-select-sm" value={filters.classId} onChange={(e) => setFilter('classId', e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label small">Section</label>
          <select className="form-select form-select-sm" value={filters.sectionId} onChange={(e) => setFilter('sectionId', e.target.value)}>
            <option value="">All sections</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.class_name ? `${s.class_name} / ` : ''}{s.name}</option>)}
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label small">From date</label>
          <input type="date" className="form-control form-control-sm" value={filters.fromDate} onChange={(e) => setFilter('fromDate', e.target.value)} />
        </div>
        <div className="col-md-3">
          <label className="form-label small">To date</label>
          <input type="date" className="form-control form-control-sm" value={filters.toDate} onChange={(e) => setFilter('toDate', e.target.value)} />
        </div>
      </div>

      <div className="border rounded">
        <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <div className="fw-semibold small">{current?.title || 'Report'}</div>
            {report?.meta && (
              <div className="text-muted" style={{ fontSize: 12 }}>
                {report.rows?.length || 0} row(s) Ã‚Â· generated {fmtDateTime(report.meta.generatedAt)}
              </div>
            )}
          </div>
          {report?.meta?.filters && Object.keys(report.meta.filters).length > 0 && (
            <div className="text-muted small">{Object.entries(report.meta.filters).map(([k, v]) => `${k}: ${v}`).join(' Ã‚Â· ')}</div>
          )}
        </div>
        {loading || bootLoading ? <Loading text={bootLoading ? 'Loading filtersÃ¢â‚¬Â¦' : 'Running reportÃ¢â‚¬Â¦'} /> : !report ? (
          <Empty icon="bi-file-earmark-bar-graph" text="Choose a report and filters, then click Run Report." />
        ) : !(report.rows || []).length ? (
          <Empty icon="bi-inbox" text="No rows matched this report and filter combination." />
        ) : (
          <div className="table-responsive" style={{ maxHeight: '62vh' }}>
            <table className="table table-sm table-striped mb-0 align-middle">
              <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>{(report.columns || []).map((c) => <th key={c.key} className="small text-nowrap">{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr key={row.id ?? index}>
                    {(report.columns || []).map((c) => <td key={c.key} className="small">{row[c.key] === null || row[c.key] === undefined || row[c.key] === '' ? 'Ã¢â‚¬â€' : String(row[c.key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-muted small mt-2">
        <i className="bi bi-info-circle me-1"></i>
        {manager ? 'Reports read from saved marks and result snapshots; nothing is changed by running a report.' : 'You have view access. Export is limited to the rows shown.'}
      </div>
    </PageShell>
  );
}

