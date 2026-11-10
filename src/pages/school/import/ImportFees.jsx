import React, { useState, useCallback } from 'react';
import { PageShell, Empty, Loading, Badge, downloadCsv, FileUploadZone, ValidationResults, JobHistoryTable, fmtDateTime } from './shared';
import { apiGet, apiPost, getToken } from '../../../api';
import { toast } from '../../../toast';

const parseCSV = (text) => {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return { headers, rows: lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  })};
};

const downloadTemplate = async (endpoint, filename) => {
  const token = getToken();
  const res = await fetch(endpoint, { headers: { 'Authorization': 'Bearer ' + token } });
  if (!res.ok) { toast('Failed to download template', 'error'); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function ImportFees() {
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [results, setResults] = useState(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const handleFile = useCallback((f) => {
    setFile(f);
    setResults(null);
    setParsedData(null);
    setStep('preview');
  }, []);

  const handlePreview = async () => {
    if (!file) return;
    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      setParsedData({ headers, rows: rows.slice(0, 50), totalRows: rows.length });
      setStep('validate');
    } catch (e) { toast('Failed to parse CSV: ' + e.message, 'error'); }
  };

  const handleValidate = async () => {
    if (!parsedData) return;
    setValidating(true);
    try {
      const res = await apiPost('/school/import/fees/validate', { rows: parsedData.rows });
      if (res?.ok) setResults(res.results);
      else toast(res?.error || 'Validation failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setValidating(false); }
  };

  const handleCommit = async () => {
    if (!results) return;
    setCommitting(true);
    try {
      const res = await apiPost('/school/import/fees/commit', { jobId: 0, rows: results });
      if (res?.ok) {
        toast('Import committed successfully', 'success');
        setResults(null);
        setParsedData(null);
        setFile(null);
        setStep('history');
        loadJobs();
      } else toast(res?.error || 'Commit failed', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setCommitting(false); }
  };

  const handleDownloadErrors = () => {
    if (!results) return;
    const errors = results.filter(r => r.status === 'invalid');
    if (!errors.length) return;
    const headers = ['row_number', 'status', 'raw_data', 'errors'];
    const rows = errors.map(r => [r.row_number, r.status, JSON.stringify(r.raw_data), JSON.stringify(r.errors)]);
    downloadCsv([headers, ...rows], 'fee_import_errors.csv');
  };

  const loadJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await apiGet('/school/import/fees/history');
      if (res?.ok) setJobs(res.jobs || []);
    } catch (e) { console.error(e); }
    finally { setLoadingJobs(false); }
  };

  return (
    <PageShell title="Import Fees" icon="bi-cash-coin" subtitle={step === 'history' ? `${jobs.length} import jobs` : ''}>
      <div className="d-flex gap-2 mb-3">
        <button className={`btn ${step === 'upload' || step === 'preview' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => { setStep('upload'); setFile(null); setResults(null); setParsedData(null); }}>
          <i className="bi bi-upload"></i> Upload
        </button>
        <button className={`btn ${step === 'history' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => { setStep('history'); loadJobs(); }}>
          <i className="bi bi-clock-history"></i> History
        </button>
        {step === 'upload' && (
          <button className="btn btn-outline-info" onClick={() => downloadTemplate('/api/school/import/fees/template', 'fee_import_template.csv')}>
            <i className="bi bi-download"></i> Download Template
          </button>
        )}
      </div>

      {step === 'upload' && (
        <div className="card">
          <div className="card-body">
            <h6>Fee Import</h6>
            <p className="text-muted small">Upload a CSV file with fee invoice data. Requires existing students and fee heads.</p>
            <FileUploadZone onFile={handleFile} accept=".csv" maxSizeMB={5} />
          </div>
        </div>
      )}

      {step === 'preview' && parsedData && (
        <div className="card mb-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Preview: {parsedData.totalRows} rows ({file?.name})</h6>
            <div className="d-flex gap-2">
              <button className="btn btn-primary" onClick={handlePreview}><i className="bi bi-search"></i> Validate</button>
              <button className="btn btn-outline-secondary" onClick={() => { setStep('upload'); setFile(null); setParsedData(null); }}>
                <i className="bi bi-x"></i> Cancel
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="table-responsive" style={{ maxHeight: 400 }}>
              <table className="table table-sm table-hover">
                <thead><tr>{parsedData.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {parsedData.rows.map((r, i) => (
                    <tr key={i}>{parsedData.headers.map(h => <td key={h}>{r[h] || ''}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {parsedData.totalRows > 50 && <div className="text-muted small mt-2">Showing first 50 of {parsedData.totalRows} rows</div>}
            </div>
          </div>
        </div>
      )}

      {step === 'validate' && (
        <>
          {parsedData && (
            <div className="card mb-3">
              <div className="card-body">
                <h6>File: {file?.name} ({Math.round(file.size / 1024)} KB) — {parsedData.totalRows} rows</h6>
                <div className="d-flex gap-2 mt-2">
                  <button className="btn btn-primary" onClick={handleValidate} disabled={validating}>
                    <i className="bi bi-search"></i> {validating ? 'Validating...' : 'Validate'}
                  </button>
                  <button className="btn btn-outline-secondary" onClick={() => setStep('preview')}>
                    <i className="bi bi-arrow-left"></i> Back
                  </button>
                </div>
              </div>
            </div>
          )}
          <ValidationResults
            results={results}
            onCommit={handleCommit}
            onDownloadErrors={handleDownloadErrors}
            committing={committing}
          />
        </>
      )}

      {step === 'history' && (
        <JobHistoryTable jobs={jobs} onRefresh={loadJobs} loading={loadingJobs} emptyText="No fee imports yet" />
      )}
    </PageShell>
  );
}