import React, { useEffect, useState, useMemo } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, downloadCsv, ReportFilters } from './shared';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';

export default function StudentReports() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [activeTab, setActiveTab] = useState('enrollment');

  useEffect(() => { loadClasses(); }, []);
  useEffect(() => { loadData(); }, [classId, sectionId, dateFrom, dateTo]);

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
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const d = await apiGet(`/school/reports/student?${params.toString()}`);
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
    const headers = ['Class', 'Section', 'Gender', 'Category', 'Status', 'Count'];
    const rows = data.map(r => [r.class_name, r.section_name || '—', r.gender || '—', r.category || '—', r.status || '—', r.count]);
    downloadCsv(rows.map((r, i) => (i === 0 ? headers : r)), 'student_enrollment_report.csv');
  }

  const enrollmentData = data;
  const genderData = useMemo(() => {
    const map = {};
    data.forEach(r => { const g = r.gender || '—'; map[g] = (map[g] || 0) + (r.count || 0); });
    return Object.entries(map).map(([gender, count]) => ({ gender, count }));
  }, [data]);
  const categoryData = useMemo(() => {
    const map = {};
    data.forEach(r => { const c = r.category || '—'; map[c] = (map[c] || 0) + (r.count || 0); });
    return Object.entries(map).map(([category, count]) => ({ category, count }));
  }, [data]);
  const statusData = useMemo(() => {
    const map = {};
    data.forEach(r => { const s = r.status || '—'; map[s] = (map[s] || 0) + (r.count || 0); });
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [data]);

  return (
    <PageShell title="Student Reports" icon="bi-people" subtitle={`${data.length} records`}>
      <ul className="nav nav-tabs mb-3" role="tablist">
        <li className="nav-item"><button className={`nav-link ${activeTab === 'enrollment' ? 'active' : ''}`} onClick={() => setActiveTab('enrollment')}>Enrollment</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'gender' ? 'active' : ''}`} onClick={() => setActiveTab('gender')}>Gender Distribution</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'category' ? 'active' : ''}`} onClick={() => setActiveTab('category')}>Category</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'status' ? 'active' : ''}`} onClick={() => setActiveTab('status')}>Status</button></li>
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
      />

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead>
            <tr>
              {activeTab === 'enrollment' && <><th>Class</th><th>Section</th><th>Gender</th><th>Category</th><th>Status</th><th>Count</th></>}
              {activeTab === 'gender' && <><th>Gender</th><th>Count</th></>}
              {activeTab === 'category' && <><th>Category</th><th>Count</th></>}
              {activeTab === 'status' && <><th>Status</th><th>Count</th></>}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><Loading /></td></tr> :
            (activeTab === 'enrollment' ? enrollmentData : activeTab === 'gender' ? genderData : activeTab === 'category' ? categoryData : statusData).length === 0 ? <tr><td colSpan={6}><Empty text="No data" /></td></tr> :
            (activeTab === 'enrollment' ? enrollmentData : activeTab === 'gender' ? genderData : activeTab === 'category' ? categoryData : statusData).map((r, i) => (
              <tr key={i}>
                {activeTab === 'enrollment' && <><td>{r.class_name}</td><td>{r.section_name || '—'}</td><td>{r.gender || '—'}</td><td>{r.category || '—'}</td><td><Badge status={r.status}>{r.status}</Badge></td><td>{r.count}</td></>}
                {activeTab === 'gender' && <><td>{r.gender}</td><td>{r.count}</td></>}
                {activeTab === 'category' && <><td>{r.category}</td><td>{r.count}</td></>}
                {activeTab === 'status' && <><td><Badge status={r.status}>{r.status}</Badge></td><td>{r.count}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}