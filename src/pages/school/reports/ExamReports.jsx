import React, { useEffect, useState, useMemo } from 'react';
import { PageShell, Empty, Loading, Badge, downloadCsv, ReportFilters } from './shared';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';

export default function ExamReports() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [termId, setTermId] = useState('');
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [terms, setTerms] = useState([]);
  const [activeTab, setActiveTab] = useState('results');

  useEffect(() => { loadClasses(); loadTerms(); }, []);
  useEffect(() => { loadData(); }, [classId, sectionId, termId]);

  async function loadClasses() {
    const d = await apiGet('/school/classes');
    if (d?.ok) setClasses(d.classes || []);
  }

  async function loadTerms() {
    const d = await apiGet('/school/terms');
    if (d?.ok) setTerms(d.terms || []);
  }

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (classId) params.set('classId', classId);
      if (sectionId) params.set('sectionId', sectionId);
      if (termId) params.set('termId', termId);
      const d = await apiGet(`/school/reports/exam?${params.toString()}`);
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
    const headers = ['Term', 'Class', 'Count', 'Avg Percentage'];
    const rows = data.map(r => [r.term_name, r.class_name, r.count, r.avg_percentage ? r.avg_percentage.toFixed(2) + '%' : '—']);
    downloadCsv([headers, ...rows], 'exam_report.csv');
  }

  const resultsData = data;
  const termSummary = useMemo(() => {
    const map = {};
    data.forEach(r => { const t = r.term_name; map[t] = { count: (map[t]?.count || 0) + (r.count || 0), totalPct: (map[t]?.totalPct || 0) + (r.avg_percentage * r.count || 0), totalCount: (map[t]?.totalCount || 0) + (r.count || 0) }; });
    return Object.entries(map).map(([term_name, v]) => ({ term_name, count: v.count, avg_percentage: v.totalCount ? (v.totalPct / v.totalCount).toFixed(2) : '—' }));
  }, [data]);
  const classSummary = useMemo(() => {
    const map = {};
    data.forEach(r => { const c = r.class_name; map[c] = { count: (map[c]?.count || 0) + (r.count || 0), totalPct: (map[c]?.totalPct || 0) + (r.avg_percentage * r.count || 0), totalCount: (map[c]?.totalCount || 0) + (r.count || 0) }; });
    return Object.entries(map).map(([class_name, v]) => ({ class_name, count: v.count, avg_percentage: v.totalCount ? (v.totalPct / v.totalCount).toFixed(2) : '—' }));
  }, [data]);

  return (
    <PageShell title="Exam Reports" icon="bi-journal-check" subtitle={`${data.length} records`}>
      <ul className="nav nav-tabs mb-3" role="tablist">
        <li className="nav-item"><button className={`nav-link ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>Results</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'term' ? 'active' : ''}`} onClick={() => setActiveTab('term')}>By Term</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'class' ? 'active' : ''}`} onClick={() => setActiveTab('class')}>By Class</button></li>
      </ul>

      <ReportFilters
        classOptions={classes}
        sectionOptions={sectionOptions}
        classId={classId}
        sectionId={sectionId}
        dateFrom={''}
        dateTo={''}
        onClassChange={e => { setClassId(e.target.value); setSectionId(''); }}
        onSectionChange={e => setSectionId(e.target.value)}
        onDateFromChange={() => {}}
        onDateToChange={() => {}}
        onSearch={loadData}
        onExport={handleExport}
        showFilters={true}
        extraFilters={
          <div className="col-md-2">
            <label className="form-label small">Term</label>
            <select className="form-select form-select-sm" value={termId} onChange={e => setTermId(e.target.value)}>
              <option value="">All Terms</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        }
      />

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead>
            <tr>
              {activeTab === 'results' && <><th>Term</th><th>Class</th><th>Count</th><th>Avg %</th></>}
              {activeTab === 'term' && <><th>Term</th><th>Count</th><th>Avg %</th></>}
              {activeTab === 'class' && <><th>Class</th><th>Count</th><th>Avg %</th></>}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4}><Loading /></td></tr> :
            (activeTab === 'results' ? resultsData : activeTab === 'term' ? termSummary : classSummary).length === 0 ? <tr><td colSpan={4}><Empty text="No data" /></td></tr> :
            (activeTab === 'results' ? resultsData : activeTab === 'term' ? termSummary : classSummary).map((r, i) => (
              <tr key={i}>
                {activeTab === 'results' && <><td>{r.term_name}</td><td>{r.class_name}</td><td>{r.count}</td><td>{r.avg_percentage ? r.avg_percentage + '%' : '—'}</td></>}
                {activeTab === 'term' && <><td>{r.term_name}</td><td>{r.count}</td><td>{r.avg_percentage ? r.avg_percentage + '%' : '—'}</td></>}
                {activeTab === 'class' && <><td>{r.class_name}</td><td>{r.count}</td><td>{r.avg_percentage ? r.avg_percentage + '%' : '—'}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}