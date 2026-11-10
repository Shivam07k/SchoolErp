import React, { useEffect, useState, useMemo } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate, moneyOrDash, downloadCsv, ReportFilters } from './shared';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';

export default function FeeReports() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [duesStatus, setDuesStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [activeTab, setActiveTab] = useState('collection');

  useEffect(() => { loadClasses(); }, []);
  useEffect(() => { loadData(); }, [classId, sectionId, duesStatus, dateFrom, dateTo]);

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
      if (duesStatus) params.set('duesStatus', duesStatus);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const d = await apiGet(`/school/reports/fees?${params.toString()}`);
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
    const headers = ['Date', 'Status', 'Count', 'Total Amount', 'Total Paid', 'Total Balance'];
    const rows = data.map(r => [fmtDate(r.invoice_date), r.status, r.count, moneyOrDash(r.total_amount), moneyOrDash(r.total_paid), moneyOrDash(r.total_balance)]);
    downloadCsv([headers, ...rows], 'fee_report.csv');
  }

  const collectionData = data;
  const statusSummary = useMemo(() => {
    const map = {};
    data.forEach(r => { const s = r.status; map[s] = { count: (map[s]?.count || 0) + (r.count || 0), amount: (map[s]?.amount || 0) + Number(r.total_amount || 0), paid: (map[s]?.paid || 0) + Number(r.total_paid || 0), balance: (map[s]?.balance || 0) + Number(r.total_balance || 0) }; });
    return Object.entries(map).map(([status, v]) => ({ status, ...v }));
  }, [data]);

  return (
    <PageShell title="Fee Reports" icon="bi-cash-coin" subtitle={`${data.length} records`}>
      <ul className="nav nav-tabs mb-3" role="tablist">
        <li className="nav-item"><button className={`nav-link ${activeTab === 'collection' ? 'active' : ''}`} onClick={() => setActiveTab('collection')}>Collection</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'status' ? 'active' : ''}`} onClick={() => setActiveTab('status')}>By Status</button></li>
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
        extraFilters={
          <div className="col-md-2">
            <label className="form-label small">Dues Status</label>
            <select className="form-select form-select-sm" value={duesStatus} onChange={e => setDuesStatus(e.target.value)}>
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="due_soon">Due Soon</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        }
      />

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead>
            <tr>
              {activeTab === 'collection' && <><th>Date</th><th>Status</th><th>Count</th><th>Total Amount</th><th>Total Paid</th><th>Total Balance</th></>}
              {activeTab === 'status' && <><th>Status</th><th>Count</th><th>Total Amount</th><th>Total Paid</th><th>Total Balance</th></>}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><Loading /></td></tr> :
            (activeTab === 'collection' ? collectionData : statusSummary).length === 0 ? <tr><td colSpan={6}><Empty text="No data" /></td></tr> :
            (activeTab === 'collection' ? collectionData : statusSummary).map((r, i) => (
              <tr key={i}>
                {activeTab === 'collection' && <><td>{fmtDate(r.invoice_date)}</td><td><Badge status={r.status}>{r.status}</Badge></td><td>{r.count}</td><td>{moneyOrDash(r.total_amount)}</td><td>{moneyOrDash(r.total_paid)}</td><td>{moneyOrDash(r.total_balance)}</td></>}
                {activeTab === 'status' && <><td><Badge status={r.status}>{r.status}</Badge></td><td>{r.count}</td><td>{moneyOrDash(r.amount)}</td><td>{moneyOrDash(r.paid)}</td><td>{moneyOrDash(r.balance)}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}