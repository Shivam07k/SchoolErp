import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../../api';
import PrintButton from '../../../components/PrintButton';
import {
  Badge, Empty, ErrorBox, Loading, PageShell, categoryTone, downloadCsv, fmtDate, fmtDateTime,
  sectionsFor, today,
} from './shared';

const TABS = [
  { key: 'monthly', label: 'Monthly', icon: 'bi-calendar3' },
  { key: 'defaulters', label: 'Defaulters', icon: 'bi-exclamation-triangle' },
  { key: 'absentees', label: 'Absentees', icon: 'bi-person-x' },
  { key: 'late', label: 'Late arrivals', icon: 'bi-clock' },
  { key: 'leave', label: 'Student leave', icon: 'bi-envelope-paper' },
  { key: 'missing', label: 'Missing registers', icon: 'bi-journal-x' },
  { key: 'staff', label: 'Staff summary', icon: 'bi-person-badge' },
  { key: 'payroll', label: 'Payroll source', icon: 'bi-cash-coin' },
];

const clock = (value) => {
  if (!value) return 'Ã¢â‚¬â€';
  const text = String(value);
  const match = text.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : text.slice(0, 5);
};

const percent = (row) => (
  row.sessions > 0 ? `${Math.round((row.present_equivalent / row.sessions) * 10000) / 100}%` : 'Ã¢â‚¬â€'
);

const COLUMNS = {
  monthly: [
    { label: 'Student', value: (r) => `${r.first_name} ${r.last_name || ''}`.trim() },
    { label: 'Admission', key: 'admission_no' },
    { label: 'Class', value: (r) => `${r.class_name || ''} ${r.section_name || ''}`.trim() },
    { label: 'Sessions', key: 'sessions' },
    { label: 'Marked', key: 'marked' },
    { label: 'Present', key: 'present' },
    { label: 'Absent', key: 'absent' },
    { label: 'Late', key: 'late' },
    { label: 'Excused', key: 'excused' },
    { label: 'Activity', key: 'activity' },
    { label: 'Partial', key: 'partial' },
    { label: 'Present eq.', key: 'present_equivalent' },
    { label: 'Attendance %', value: percent },
  ],
  defaulters: [
    { label: 'Student', value: (r) => `${r.first_name} ${r.last_name || ''}`.trim() },
    { label: 'Admission', key: 'admission_no' },
    { label: 'Class', value: (r) => `${r.class_name || ''} ${r.section_name || ''}`.trim() },
    { label: 'Sessions', key: 'sessions' },
    { label: 'Present eq.', key: 'present_equivalent' },
    { label: 'Attendance %', value: (r) => `${r.percent}%` },
  ],
  absentees: [
    { label: 'Student', value: (r) => `${r.first_name} ${r.last_name || ''}`.trim() },
    { label: 'Admission', key: 'admission_no' },
    { label: 'Class', value: (r) => `${r.class_name || ''} ${r.section_name || ''}`.trim() },
    { label: 'Status', key: 'status_label' },
    { label: 'Remark', key: 'remark' },
    { label: 'Marked by', key: 'marked_by' },
    { label: 'Marked at', value: (r) => (r.marked_at ? fmtDateTime(r.marked_at) : '') },
  ],
  late: [
    { label: 'Date', value: (r) => fmtDate(r.register_date) },
    { label: 'Student', value: (r) => `${r.first_name} ${r.last_name || ''}`.trim() },
    { label: 'Class', value: (r) => `${r.class_name || ''} ${r.section_name || ''}`.trim() },
    { label: 'Status', key: 'status_label' },
    { label: 'Late min', key: 'late_minutes' },
    { label: 'Partial min', key: 'partial_minutes' },
    { label: 'Remark', key: 'remark' },
  ],
  leave: [
    { label: 'Student', value: (r) => `${r.first_name} ${r.last_name || ''}`.trim() },
    { label: 'Admission', key: 'admission_no' },
    { label: 'Type', key: 'leave_type' },
    { label: 'From', value: (r) => fmtDate(r.start_date) },
    { label: 'To', value: (r) => fmtDate(r.end_date) },
    { label: 'Status', key: 'status' },
    { label: 'Reason', key: 'reason' },
    { label: 'Approved by', key: 'approved_by' },
  ],
  missing: [
    { label: 'Class', key: 'class_name' },
    { label: 'Section', key: 'section_name' },
    { label: 'Students', key: 'students' },
    { label: 'Register', value: (r) => (r.register_id ? `${r.state || 'draft'} (#${r.register_id})` : 'not started') },
  ],
  staff: [
    { label: 'Employee', key: 'employee_no' },
    { label: 'Name', value: (r) => `${r.first_name} ${r.last_name || ''}`.trim() },
    { label: 'Department', key: 'department' },
    { label: 'Designation', key: 'designation' },
    { label: 'Marked', key: 'marked' },
    { label: 'Present', key: 'present' },
    { label: 'Absent', key: 'absent' },
    { label: 'Late', key: 'late' },
    { label: 'Half day', key: 'half_day' },
    { label: 'On leave', key: 'on_leave' },
    { label: 'On duty', key: 'on_duty' },
    { label: 'Late min', key: 'late_minutes' },
    { label: 'Early min', key: 'early_minutes' },
    { label: 'Worked min', key: 'worked_minutes' },
  ],
  payroll: [
    { label: 'Employee', key: 'employee_no' },
    { label: 'Name', value: (r) => `${r.first_name} ${r.last_name || ''}`.trim() },
    { label: 'Department', key: 'department' },
    { label: 'Date', value: (r) => fmtDate(r.attendance_date) },
    { label: 'Status', key: 'status' },
    { label: 'Check-in', value: (r) => clock(r.check_in) },
    { label: 'Check-out', value: (r) => clock(r.check_out) },
    { label: 'Late min', key: 'late_minutes' },
    { label: 'Early min', key: 'early_minutes' },
    { label: 'Worked min', key: 'worked_minutes' },
    { label: 'Leave type', key: 'leave_type' },
  ],
};

export default function Reports({ me, onNavigate }) {
  const [tab, setTab] = useState('monthly');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [date, setDate] = useState(today());
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [threshold, setThreshold] = useState('75');
  const [department, setDepartment] = useState('');
  const [leaveStatus, setLeaveStatus] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sections = useMemo(() => sectionsFor(classes, classId), [classes, classId]);

  const rows = useMemo(() => {
    if (!data) return [];
    if (tab === 'monthly') return data.students || [];
    if (tab === 'defaulters') return data.defaulters || [];
    if (tab === 'absentees') return data.absentees || [];
    if (tab === 'late') return data.late || [];
    if (tab === 'leave') return data.leave || [];
    if (tab === 'missing') return data.missing || [];
    if (tab === 'staff') return data.staff || [];
    if (tab === 'payroll') return data.rows || [];
    return [];
  }, [data, tab]);

  const columns = COLUMNS[tab] || [];

  async function run() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      let endpoint = '';
      if (tab === 'absentees' || tab === 'missing') {
        params.set('date', date);
        if (tab === 'absentees' && sectionId) params.set('sectionId', sectionId);
      } else {
        params.set('month', month);
        if (['monthly', 'defaulters', 'late'].includes(tab) && sectionId) params.set('sectionId', sectionId);
        if (tab === 'defaulters' && threshold) params.set('threshold', threshold);
        if (tab === 'leave' && leaveStatus) params.set('status', leaveStatus);
        if ((tab === 'staff' || tab === 'payroll') && department) params.set('department', department);
      }
      endpoint = `/school/attendance/reports/${tab === 'payroll' ? 'staff-payroll' : tab}`;
      const result = await apiGet(`${endpoint}?${params.toString()}`);
      if (!result?.ok) throw new Error(result?.error || 'Could not run the report');
      setData(result);
    } catch (err) {
      setError(err.message || 'Could not run the report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    apiGet('/school/classes')
      .then((result) => { if (result?.ok) setClasses(result.classes || []); })
      .catch((err) => setError(err.message || 'Could not load classes'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function exportCsv() {
    if (!rows.length) return;
    downloadCsv(`attendance-${tab}-${tab === 'absentees' || tab === 'missing' ? date : month}.csv`, columns, rows);
  }

  return (
    <PageShell
      title="Attendance Reports"
      icon="bi-bar-chart"
      subtitle="Reports count only submitted and finalized registers. Every export keeps the same audited source rows."
      onNavigate={onNavigate}
      actions={(
        <>
          <PrintButton targetId="attendance-report-print" label="Print" />
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={exportCsv} disabled={!rows.length}>
            <i className="bi bi-download me-1"></i>CSV
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={run} disabled={loading}>
            <i className="bi bi-play me-1"></i>Run
          </button>
        </>
      )}
    >
      <ul className="nav nav-pills nav-sm flex-wrap mb-3">
        {TABS.map((item) => (
          <li className="nav-item" key={item.key}>
            <button type="button" className={`nav-link py-1 px-3 ${tab === item.key ? 'active' : ''}`} onClick={() => setTab(item.key)}>
              <i className={`bi ${item.icon} me-1`}></i>{item.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="row g-2 mb-3">
        {(tab === 'absentees' || tab === 'missing') ? (
          <div className="col-6 col-md-3">
            <label className="form-label small mb-1">Date</label>
            <input type="date" className="form-control form-control-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        ) : (
          <div className="col-6 col-md-3">
            <label className="form-label small mb-1">Month</label>
            <input type="month" className="form-control form-control-sm" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        )}

        {['monthly', 'defaulters', 'absentees', 'late'].includes(tab) && (
          <>
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Class</label>
              <select className="form-select form-select-sm" value={classId} onChange={(e) => {
                const next = e.target.value;
                setClassId(next);
                setSectionId(String((sectionsFor(classes, next)[0] || {}).id || ''));
              }}>
                <option value="">All classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Section</label>
              <select className="form-select form-select-sm" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                <option value="">All sections</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </>
        )}

        {tab === 'defaulters' && (
          <div className="col-6 col-md-2">
            <label className="form-label small mb-1">Threshold %</label>
            <input type="number" min="0" max="100" className="form-control form-control-sm" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
        )}

        {tab === 'leave' && (
          <div className="col-6 col-md-3">
            <label className="form-label small mb-1">Status</label>
            <select className="form-select form-select-sm" value={leaveStatus} onChange={(e) => setLeaveStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        )}

        {(tab === 'staff' || tab === 'payroll') && (
          <div className="col-6 col-md-3">
            <label className="form-label small mb-1">Department</label>
            <input className="form-control form-control-sm" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="All departments" />
          </div>
        )}
      </div>

      <ErrorBox message={error} onRetry={() => { setError(''); run(); }} />

      {loading ? <Loading text="Running reportÃ¢â‚¬Â¦" /> : (
        <div id="attendance-report-print">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <div>
              <div className="fw-bold">{TABS.find((t) => t.key === tab)?.label} attendance</div>
              <div className="small text-muted">
                {data?.month ? `Month ${data.month}` : data?.from ? `${fmtDate(data.from)} Ã¢â‚¬â€œ ${fmtDate(data.to)}` : ''}
                {tab === 'absentees' ? ` Ã‚Â· ${fmtDate(data?.date || date)}` : ''}
                {tab === 'missing' ? ` Ã‚Â· ${fmtDate(data?.date || date)}` : ''}
                {' Ã‚Â· '}{rows.length} row{rows.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {tab === 'defaulters' && <Badge tone="warning">Below {data?.threshold ?? threshold}%</Badge>}
              {tab === 'payroll' && <Badge tone="info">Source only Ã‚Â· payroll is owned by HR</Badge>}
              {['monthly', 'defaulters', 'absentees', 'late'].includes(tab) && <Badge tone="secondary">submitted + finalized registers</Badge>}
            </div>
          </div>

          {rows.length === 0 ? (
            <Empty icon="bi-bar-chart" text="No rows match this report and filter." />
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm mb-0 align-middle">
                <thead>
                  <tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${tab}-${row.id || row.employee_no || index}-${index}`}>
                      {columns.map((column) => {
                        const value = typeof column.value === 'function' ? column.value(row) : row[column.key];
                        if (column.label === 'Status' && value) {
                          return <td key={column.label}><Badge tone={categoryTone(String(value).toLowerCase())}>{value}</Badge></td>;
                        }
                        return <td key={column.label} className="small">{value === null || value === undefined || value === '' ? 'Ã¢â‚¬â€' : value}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="small text-muted mt-2">
            {tab === 'monthly' && 'Attendance % uses present-equivalent entries (present + excused/activity statuses marked as counting present) divided by sessions.'}
            {tab === 'defaulters' && 'Defaulters are students whose present-equivalent attendance is below the threshold. Sessions come from submitted or finalized registers only.'}
            {tab === 'absentees' && 'Only absent-category entries from submitted or finalized registers are listed.'}
            {tab === 'late' && 'Late entries include records whose status is late or whose late minutes are greater than zero.'}
            {tab === 'leave' && 'Student leave requests overlapping the selected month. Approval creates corrections for already-submitted registers.'}
            {tab === 'missing' && 'Sections with no register or only a draft register for the selected date.'}
            {tab === 'staff' && 'Staff attendance summary for the selected month. Staff attendance is separate from student attendance.'}
            {tab === 'payroll' && 'This is a source report only. Payroll calculation and disbursement remain owned by HR.'}
          </div>
        </div>
      )}
    </PageShell>
  );
}

