import React, { useEffect, useState, useMemo } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, downloadCsv, ReportFilters } from './shared';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';

export default function AttendanceReports() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusCategory, setStatusCategory] = useState('');
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [activeTab, setActiveTab] = useState('daily');

  useEffect(() => { loadClasses(); }, []);
  useEffect(() => { loadData(); }, [classId, sectionId, dateFrom, dateTo, statusCategory]);

  async function loadClasses() {
    const d = await apiGet('/school/classes');
    if (d?.ok) setClasses(d.classes || []);
  }

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (classId) params.set('classId', classId);
      if (sectionId) params.set('sectionId', sectionId);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (statusCategory) params.set('status_category', statusCategory);
      const d = await apiGet(`/school/reports/attendance?${params.toString()}`);
      if (d?.ok) setData(d.data || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  const sectionOptions = useMemo(() => {
    const cls = classes.find(c => String(c.id) === String(classId));
    return cls?.sections || [];
  }, [classes, classId]);

  function handleExport() {
    const headers = ['Date', 'Class', 'Section', 'Status', 'Count'];
    const rows = data.map(r => [fmtDate(r.date), r.class_name, r.section_name, r.status_category, r.count]);
    downloadCsv([headers, ...rows], 'attendance_report.csv');
  }

  const dailyData = data;
  const statusSummary = useMemo(() => {
    const map = {};
    data.forEach(r => { const s = r.status_category; map[s] = (map[s] || 0) + (r.count || 0); });
    return Object.entries(map).map(([status_category, count]) => ({ status_category, count }));
  }, [data]);
  const classSummary = useMemo(() => {
    const map = {};
    data.forEach(r => { const c = r.class_name; map[c] = (map[c] || 0) + (r.count || 0); });
    return Object.entries(map).map(([class_name, count]) => ({ class_name, count }));
  }, [data]);

  return (
    <PageShell title="Attendance Reports" icon="bi-calendar-check" subtitle={`${data.length} records`}>
      <ul className="nav nav-tabs mb-3" role="tablist">
        <li className="nav-item"><button className={`nav-link ${activeTab === 'daily' ? 'active' : ''}`} onClick={() => setActiveTab('daily')}>Daily Summary</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'status' ? 'active' : ''}`} onClick={() => setActiveTab('status')}>By Status</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'class' ? 'active' : ''}`} onClick={() => setActiveTab('class')}>By Class</button></li>
      </ul>

      <ReportFilters
        classOptions={classes}
        sectionOptions={sectionOptions}
        classId={classId}
        sectionId={sectionId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onClassChange={e => { setClassId(e.target.value); setSectionId(''); }}
        onSectionChange={e => setSectionId(e.target.value)}
        onDateFromChange={e => setDateFrom(e.target.value)}
        onDateToChange={e => setDateTo(e.target.value)}
        onSearch={loadData}
        onExport={handleExport}
        showFilters={true}
      />

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead>
            <tr>
              {activeTab === 'daily' && <><th>Date</th><th>Class</th><th>Section</th><th>Status</th><th>Count</th></>}
              {activeTab === 'status' && <><th>Status</th><th>Total Count</th></>}
              {activeTab === 'class' && <><th>Class</th><th>Total Count</th></>}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5}><Loading /></td></tr> :
            (activeTab === 'daily' ? dailyData : activeTab === 'status' ? statusSummary : classSummary).length === 0 ? <tr><td colSpan={5}><Empty text="No data" /></td></tr> :
            (activeTab === 'daily' ? dailyData : activeTab === 'status' ? statusSummary : classSummary).map((r, i) => (
              <tr key={i}>
                {activeTab === 'daily' && <><td>{fmtDate(r.date)}</td><td>{r.class_name}</td><td>{r.section_name}</td><td><Badge status={r.status_category}>{r.status_category}</Badge></td><td>{r.count}</td></>}
                {activeTab === 'status' && <><td><Badge status={r.status_category}>{r.status_category}</Badge></td><td>{r.count}</td></>}
                {activeTab === 'class' && <><td>{r.class_name}</td><td>{r.count}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}