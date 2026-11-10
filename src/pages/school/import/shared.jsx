import React, { useState, useRef, useCallback } from 'react';

export function PageShell({ title, icon, subtitle, backPath, onNavigate, actions, children }) {
  return (
    <div className="school-page animate-fade">
      <div className="school-page-header">
        <div className="d-flex align-items-center gap-3">
          <div className="school-page-icon"><i className={`bi ${icon}`}></i></div>
          <div>
            <h5 className="mb-0">{title}</h5>
            {subtitle && <small className="text-muted">{subtitle}</small>}
          </div>
        </div>
        <div className="school-page-actions">{actions}</div>
      </div>
      <div className="school-page-body">{children}</div>
    </div>
  );
}

export function Empty({ icon = 'bi-inbox', text = 'Nothing here yet' }) {
  return (
    <div className="school-empty">
      <i className={`bi ${icon}`}></i>
      <span>{text}</span>
    </div>
  );
}

export function Loading() {
  return (
    <div className="school-loading">
      <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
    </div>
  );
}

export function Badge({ status, children }) {
  const tones = {
    active: 'success', inactive: 'secondary', pending: 'warning', processing: 'info',
    sent: 'success', failed: 'danger', delivered: 'info', read: 'success',
    draft: 'secondary', published: 'success', queued: 'info', partial: 'warning',
    valid: 'success', invalid: 'danger', warning: 'warning', committed: 'success',
  };
  const tone = tones[status] || 'secondary';
  return <span className={`badge bg-${tone}-subtle text-${tone}`}>{children}</span>;
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="alert alert-danger d-flex align-items-center gap-2">
      <i className="bi bi-exclamation-triangle"></i>
      <div className="flex-grow-1">{message}</div>
      {onRetry && <button className="btn btn-sm btn-outline-danger" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function downloadCsv(rows, filename) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => {
    const v = r[h];
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename || 'export.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—');
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('en-IN') : '—');
export const moneyOrDash = (v) => (v === null || v === undefined || v === '' ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(v)));
export const today = () => new Date().toISOString().slice(0, 10);

export function FileUploadZone({ onFile, accept = '.csv', children, maxSizeMB = 10 }) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragActive(false); };

  const handleClick = () => inputRef.current?.click();
  const handleChange = (e) => { const file = e.target.files[0]; if (file) handleFile(file); };

  const handleFile = (file) => {
    if (!file.name.endsWith('.csv')) return alert('Please select a CSV file');
    if (file.size > maxSizeMB * 1024 * 1024) return alert(`File too large (max ${maxSizeMB}MB)`);
    onFile(file);
  };

  return (
    <div className={`school-dropzone ${dragActive ? 'active' : ''}`} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={handleClick}>
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} style={{ display: 'none' }} />
      <i className="bi bi-cloud-upload d-block mb-2" style={{ fontSize: 40 }}></i>
      <div className="fw-bold mb-1">Drop CSV file here or click to browse</div>
      <div className="text-muted small">Maximum file size: {maxSizeMB}MB</div>
      {children}
    </div>
  );
}

export function ValidationResults({ results, onCommit, onDownloadErrors, committing, commitLabel = 'Commit' }) {
  if (!results?.length) return null;
  const valid = results.filter(r => r.status === 'valid').length;
  const invalid = results.filter(r => r.status === 'invalid').length;
  const warning = results.filter(r => r.status === 'warning').length;

  return (
    <div className="card mt-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h6 className="mb-0">Validation Results</h6>
        <div className="d-flex gap-2">
          <span className="badge bg-success-subtle text-success">{valid} Valid</span>
          <span className="badge bg-warning-subtle text-warning">{warning} Warnings</span>
          <span className="badge bg-danger-subtle text-danger">{invalid} Invalid</span>
        </div>
      </div>
      <div className="card-body">
        <div className="table-responsive" style={{ maxHeight: 400 }}>
          <table className="table table-sm table-hover">
            <thead><tr><th>Row</th><th>Status</th><th>Data</th><th>Errors</th><th>Warnings</th></tr></thead>
            <tbody>
              {results.slice(0, 100).map((r, i) => (
                <tr key={i} className={r.status === 'invalid' ? 'table-danger' : r.status === 'warning' ? 'table-warning' : ''}>
                  <td>{r.row_number}</td>
                  <td><Badge status={r.status}>{r.status}</Badge></td>
                  <td style={{ maxWidth: 300 }}>{JSON.stringify(r.raw_data).slice(0, 100)}</td>
                  <td>{(r.errors || []).map(e => <div key={e.field} className="text-danger small">{e.field}: {e.message}</div>)}</td>
                  <td>{(r.warnings || []).map(w => <div key={w.field} className="text-warning small">{w.field}: {w.message}</div>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length > 100 && <div className="text-muted small">Showing first 100 of {results.length} rows</div>}
        </div>
        <div className="d-flex gap-2 mt-2">
          {invalid > 0 && <button className="btn btn-outline-danger" onClick={onDownloadErrors}><i className="bi bi-download"></i> Download Error Rows</button>}
          {valid > 0 && <button className="btn btn-primary" onClick={onCommit} disabled={committing}><i className="bi bi-check"></i> {committing ? 'Committing...' : commitLabel} ({valid})</button>}
        </div>
      </div>
    </div>
  );
}

export function JobHistoryTable({ jobs, onRefresh, loading, emptyText = 'No jobs yet' }) {
  return (
    <div className="card mt-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h6 className="mb-0">Import History</h6>
        <button className="btn btn-sm btn-outline-secondary" onClick={onRefresh} disabled={loading}><i className="bi bi-arrow-clockwise"></i></button>
      </div>
      <div className="card-body">
        <div className="table-responsive">
          <table className="table table-sm school-table">
            <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Total</th><th>Valid</th><th>Errors</th><th>Committed</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9}><Loading /></td></tr> :
              jobs.length === 0 ? <tr><td colSpan={9}><Empty text={emptyText} /></td></tr> :
              jobs.map(j => (
                <tr key={j.id}>
                  <td><strong>{j.name}</strong>{j.code && <div className="text-muted small">{j.code}</div>}</td>
                  <td>{j.import_type || j.export_type}</td>
                  <td><Badge status={j.status}>{j.status}</Badge></td>
                  <td>{j.total_rows || 0}</td>
                  <td>{j.valid_rows || 0}</td>
                  <td>{j.error_rows || 0}</td>
                  <td>{j.committed_rows || 0}</td>
                  <td>{fmtDateTime(j.created_at)}</td>
                  <td className="text-end">
                    {j.status === 'failed' && j.error_summary && (
                      <button className="btn btn-sm btn-outline-danger" title={j.error_summary}><i className="bi bi-exclamation-triangle"></i></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}