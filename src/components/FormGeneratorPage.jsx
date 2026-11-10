import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete, getToken } from '../api';
import { navigate } from '../utils';
import { toast } from '../toast';

export default function FormGeneratorPage() {
  const [step, setStep] = useState(1);
  const [formId, setFormId] = useState('');
  const [title, setTitle] = useState('');
  const [formType, setFormType] = useState('master');
  const [headerFields, setHeaderFields] = useState([]);
  const [detailFields, setDetailFields] = useState([]);
  const [listFilters, setListFilters] = useState([]);
  const [listPrimary, setListPrimary] = useState('');
  const [listSecondary, setListSecondary] = useState('');
  const [listBadges, setListBadges] = useState('');
  const [spBoot, setSpBoot] = useState('');
  const [spSearch, setSpSearch] = useState('');
  const [spGridCount, setSpGridCount] = useState('');
  const [spSave, setSpSave] = useState('');
  const [spUpdate, setSpUpdate] = useState('');
  const [spDelete, setSpDelete] = useState('');
  const [tables, setTables] = useState([]);
  const [tableSearch, setTableSearch] = useState('');
  const [columns, setColumns] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [detailTableSearch, setDetailTableSearch] = useState('');
  const [detailColumns, setDetailColumns] = useState([]);
  const [selectedDetailTable, setSelectedDetailTable] = useState('');
  const [existing, setExisting] = useState([]);
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [stickySearch, setStickySearch] = useState(true);
  const [stickyFooter, setStickyFooter] = useState(true);
  const [showActionLabels, setShowActionLabels] = useState(false);
  const [showPrint, setShowPrint] = useState(true);
  const [showDelete, setShowDelete] = useState(true);
  const [picUpload, setPicUpload] = useState(false);
  const [picPreview, setPicPreview] = useState(false);
  const [picField, setPicField] = useState('imgurl');
  const [footerLinksText, setFooterLinksText] = useState('');

  const [reportSpName, setReportSpName] = useState('');
  const [reportSpList, setReportSpList] = useState([]);
  const [reportSpSearch, setReportSpSearch] = useState('');
  const [reportSpParams, setReportSpParams] = useState([]);

  useEffect(() => {
    apiGet('/generator/existing-schemas').then(d => setExisting(d.schemas || []));
    apiGet('/tables').then(d => setTables(d.tables || []));
  }, []);

  const loadTableColumns = async (tbl, isDetail = false) => {
    const d = await apiGet(`/columns/${encodeURIComponent(tbl)}`);
    if (isDetail) { setSelectedDetailTable(tbl); setDetailColumns(d.columns || []); }
    else { setSelectedTable(tbl); setColumns(d.columns || []); }
  };

  const searchSPs = async (q) => {
    setReportSpSearch(q);
    if (q.length < 2) { setReportSpList([]); return; }
    const d = await apiGet(`/generator/sp-list?q=${encodeURIComponent(q)}`);
    setReportSpList(d.sps || []);
  };

  const selectReportSp = async (spName) => {
    setReportSpName(spName);
    setReportSpSearch('');
    setReportSpList([]);
    try {
      const d = await apiGet(`/generator/sp-params/${encodeURIComponent(spName)}`);
      setReportSpParams((d.params || []).map(p => ({
        name: p.PARAMETER_NAME,
        type: p.DATA_TYPE === 'int' || p.DATA_TYPE === 'decimal' || p.DATA_TYPE === 'float' ? 'number'
            : p.DATA_TYPE === 'date' || p.DATA_TYPE === 'datetime' || p.DATA_TYPE === 'datetime2' ? 'date'
            : 'text',
        label: p.PARAMETER_NAME,
        source: '',
      })));
    } catch (e) { toast('Failed to load SP params', 'error'); }
  };

  const addHeaderField = (col) => {
    if (headerFields.find(f => f.name === col.COLUMN_NAME)) return;
    const typeMap = { 'int': 'number', 'decimal': 'number', 'float': 'number', 'bit': 'checkbox', 'date': 'date', 'datetime': 'date', 'datetime2': 'date', 'text': 'textarea' };
    setHeaderFields(prev => [...prev, { name: col.COLUMN_NAME, label: col.COLUMN_NAME, type: typeMap[col.DATA_TYPE] || 'text', width: '6,6,6,6', source: '', classes: '' }]);
  };

  const addDetailField = (col) => {
    if (detailFields.find(f => f.name === col.COLUMN_NAME)) return;
    const typeMap = { 'int': 'number', 'decimal': 'number', 'float': 'number', 'bit': 'checkbox', 'date': 'date' };
    setDetailFields(prev => [...prev, { name: col.COLUMN_NAME, label: col.COLUMN_NAME, type: typeMap[col.DATA_TYPE] || 'text', width: '6,6,4,4', source: '' }]);
  };

  const updateField = (list, idx, key, val) => { const arr = [...list]; arr[idx] = { ...arr[idx], [key]: val }; return arr; };
  const removeField = (list, idx) => list.filter((_, i) => i !== idx);

  const autoFillSPs = () => {
    const fId = formId || 'frmMyForm';
    if (!spBoot) setSpBoot(`sp_${fId}_boot`);
    if (!spSearch) setSpSearch(`sp_${fId}_Grid2`);
    if (!spGridCount) setSpGridCount(`sp_${fId}_GridCount1`);
    if (!spSave) setSpSave(`sp_${fId}_SAVE`);
    if (!spUpdate) setSpUpdate(`sp_${fId}_UPDATE`);
    if (!spDelete) setSpDelete(`sp_${fId}_Delete1`);
  };

  const generate = async () => {
    if (!formId) { toast('Form ID required', 'error'); return; }
    setGenerating(true);
    try {
      const body = { formId, title, formType, headerFields, detailFields,
        tableName: selectedTable, detailTable: selectedDetailTable,
        listConfig: {
          filters: listFilters,
          primaryField: listPrimary,
          secondaryFields: listSecondary.split(',').map(s => s.trim()).filter(Boolean),
          badgeFields: listBadges.split(',').map(s => s.trim()).filter(Boolean),
          pic: picUpload,
          picpreview: picPreview,
          picField,
          footerLinks: footerLinksText ? footerLinksText.split('\n').map(l => {
            const [label, formId] = l.split('|').map(s => s.trim());
            return label && formId ? { label, formId } : null;
          }).filter(Boolean) : [],
          listConfig: { stickySearch, stickyFooter, showActionLabels, showPrint, showDelete },
        },
        spMappings: { boot: spBoot, search: spSearch, gridCount: spGridCount, save: spSave, update: spUpdate, delete: spDelete },
      };

      if (formType === 'report') {
        body.listConfig.spName = reportSpName;
        body.listConfig.filters = reportSpParams.map(p => ({
          name: p.name, label: p.label, type: p.type, source: p.source || '',
          default: p.type === 'date' ? 'session_startdate' : '',
        }));
      }

      const res = await fetch('/api/generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { msg = (await res.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xgenerator-${formId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(`Downloaded xgenerator-${formId}.zip`, 'success');
      window.dispatchEvent(new Event('menu-refresh'));
      setMessage(`Bundle downloaded: xgenerator-${formId}.zip (form files + sql/sp_${formId}.sql). Unzip into src/forms/ and run the SQL script.`);
      apiGet('/generator/existing-schemas').then(d => setExisting(d.schemas || []));
    } catch (e) { toast('Generation failed: ' + e.message, 'error'); }
    finally { setGenerating(false); }
  };

  const deleteForm = async (fid) => {
    if (!confirm(`Delete ${fid}?`)) return;
    await apiDelete(`/generator/${fid}`);
    apiGet('/generator/existing-schemas').then(d => setExisting(d.schemas || []));
  };

  const isReport = formType === 'report';

  const getStepLabels = () => {
    if (isReport) return ['Info', 'Pick SP', 'Generate'];
    if (formType === 'master') return ['Info', 'Header', 'SPs', 'Generate'];
    return ['Info', 'Header', 'Detail & List', 'SPs', 'Generate'];
  };
  const stepLabels = getStepLabels();
  const totalSteps = stepLabels.length;

  return (
    <div className="page-content animate-fade">
      <h5 className="mb-3" style={{ fontWeight: 700, fontSize: 'calc(18px * var(--fs, 1))' }}><i className="bi bi-magic me-1"></i> Form Generator</h5>

      {existing.length > 0 && (
        <div className="card mb-3">
          <div className="card-header">Existing Forms ({existing.length})</div>
          <div className="card-body p-2 d-flex flex-wrap gap-2">
            {existing.map(s => (
              <div key={s.formId} className="col-chip" onClick={() => navigate(`#/form/${s.formId}`)}>
                {s.title} ({s.headerFields} fields{s.hasDetail ? ' + detail' : ''})
                <button className="btn btn-xs p-0 ms-1" style={{ fontSize: 'calc(10px * var(--fs, 1))', lineHeight: 1 }} onClick={(e) => { e.stopPropagation(); deleteForm(s.formId); }}><i className="bi bi-x"></i></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="gen-step-bar">
        {stepLabels.map((label, idx) => {
          const s = idx + 1;
          return (
            <div key={s} className={`gen-step ${step === s ? 'active' : step > s ? 'done' : ''}`}>
              <div className="gen-step-num">{step > s ? <i className="bi bi-check-lg"></i> : s}</div>
              <div className="gen-step-label">{label}</div>
              {s < totalSteps && <div className="gen-step-line"></div>}
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-body">

          {step === 1 && (
            <div className="animate-fade">
              <h6 className="section-title">Form Type</h6>
              <div className="row g-3 mb-4">
                {[
                  { type: 'master', icon: 'bi-file-earmark-text', label: 'Master', desc: 'Single table — header + save' },
                  { type: 'master-detail', icon: 'bi-files', label: 'Master-Detail', desc: 'Header + detail line items' },
                  { type: 'report', icon: 'bi-bar-chart-line', label: 'Report', desc: 'Pick SP → params = filters → data renders' },
                ].map(ft => (
                  <div key={ft.type} className="col-md-4">
                    <div className={`ftype-card ${formType === ft.type ? 'active' : ''}`} onClick={() => setFormType(ft.type)}>
                      <i className={`bi ${ft.icon}`}></i>
                      <div className="ftype-label">{ft.label}</div>
                      <div className="ftype-desc">{ft.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Form ID</label>
                  <input className="form-control" value={formId} onChange={e => setFormId(e.target.value)} placeholder="frmMyForm" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Title</label>
                  <input className="form-control" value={title} onChange={e => setTitle(e.target.value)} placeholder="My Form" />
                </div>
              </div>
              <div className="d-flex justify-content-end mt-4">
                <button className="btn btn-primary" onClick={() => {
                  setStep(2);
                  if (!isReport) autoFillSPs();
                }} disabled={!formId}>
                  {isReport ? 'Next: Pick SP' : 'Next: Header Fields'} <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          )}

          {step === 2 && isReport && (
            <div className="animate-fade">
              <h6 className="section-title">Pick Stored Procedure</h6>
              <p className="text-muted mb-3" style={{fontSize: 'calc(12px * var(--fs, 1))'}}>Search and select an SP. Its parameters will become page filters. All resultsets render as tables.</p>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Search SP in Database</label>
                  <input className="form-control" value={reportSpSearch} onChange={e => searchSPs(e.target.value)} placeholder="Type SP name to search..." autoFocus />
                  {reportSpList.length > 0 && (
                    <div className="list-group mt-1" style={{ maxHeight: 200, overflow: 'auto' }}>
                      {reportSpList.map(sp => (
                        <button key={sp} className={`list-group-item list-group-item-action py-1 ${reportSpName === sp ? 'active' : ''}`}
                          style={{ fontSize: 'calc(11px * var(--fs, 1))', fontFamily: 'var(--font-mono)' }}
                          onClick={() => selectReportSp(sp)}>{sp}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-md-6">
                  {reportSpName && (
                    <div>
                      <label className="form-label">Selected: <code>{reportSpName}</code></label>
                      {reportSpParams.length > 0 ? (
                        <div className="table-responsive">
                          <table className="erp-table">
                            <thead><tr><th>Param Name</th><th>Label</th><th>Type</th><th>Source</th></tr></thead>
                            <tbody>
                              {reportSpParams.map((p, i) => (
                                <tr key={i}>
                                  <td><code style={{fontSize: 'calc(11px * var(--fs, 1))'}}>{p.name}</code></td>
                                  <td><input className="form-control form-control-sm" value={p.label} onChange={e => {
                                    const np = [...reportSpParams]; np[i] = { ...np[i], label: e.target.value }; setReportSpParams(np);
                                  }} /></td>
                                  <td><select className="form-select form-select-sm" value={p.type} onChange={e => {
                                    const np = [...reportSpParams]; np[i] = { ...np[i], type: e.target.value }; setReportSpParams(np);
                                  }}>
                                    {['text','number','date','selectcombo'].map(t => <option key={t}>{t}</option>)}
                                  </select></td>
                                  <td><input className="form-control form-control-sm" value={p.source || ''} onChange={e => {
                                    const np = [...reportSpParams]; np[i] = { ...np[i], source: e.target.value }; setReportSpParams(np);
                                  }} placeholder={p.type === 'selectcombo' ? 'boot key e.g. State' : 'boot key (combo only)'} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-muted" style={{fontSize: 'calc(12px * var(--fs, 1))'}}>No parameters found — SP will run with no filters</div>
                      )}
                    </div>
                  )}
                  {!reportSpName && (
                    <div className="text-muted d-flex align-items-center h-100" style={{fontSize: 'calc(13px * var(--fs, 1))'}}>
                      <i className="bi bi-arrow-left me-1"></i> Search and select an SP from the left
                    </div>
                  )}
                </div>
              </div>

              <div className="d-flex justify-content-between mt-4">
                <button className="btn btn-outline-secondary" onClick={() => setStep(1)}><i className="bi bi-arrow-left me-1"></i> Back</button>
                <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!reportSpName}>
                  Generate <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          )}

          {step === 2 && !isReport && (
            <div className="animate-fade">
              <h6 className="section-title">Header Fields</h6>
              <div className="row mb-3">
                <div className="col-md-4">
                  <label className="form-label">Load from Table</label>
                  <div className="input-group input-group-sm">
                    <input className="form-control" value={tableSearch} onChange={e => setTableSearch(e.target.value)} placeholder="Search tables..." />
                    <button className="btn btn-outline-secondary" onClick={() => {
                      const t = tables.find(t => t.toLowerCase().includes(tableSearch.toLowerCase()));
                      if (t) loadTableColumns(t);
                    }}>Load</button>
                  </div>
                  {tableSearch && (
                    <div className="list-group mt-1" style={{ maxHeight: 180, overflow: 'auto' }}>
                      {tables.filter(t => t.toLowerCase().includes(tableSearch.toLowerCase())).slice(0, 12).map(t => (
                        <button key={t} className={`list-group-item list-group-item-action py-1 ${selectedTable === t ? 'active' : ''}`}
                          style={{ fontSize: 'calc(11px * var(--fs, 1))' }} onClick={() => loadTableColumns(t)}>{t}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-md-8">
                  {selectedTable && columns.length > 0 && (
                    <div>
                      <label className="form-label">Click to add as header field</label>
                      <div className="d-flex flex-wrap gap-1" style={{ maxHeight: 150, overflow: 'auto' }}>
                        {columns.map(c => (
                          <span key={c.COLUMN_NAME} className={`col-chip ${headerFields.find(f => f.name === c.COLUMN_NAME) ? 'selected' : ''}`}
                            onClick={() => addHeaderField(c)}>
                            {c.COLUMN_NAME} <small>({c.DATA_TYPE})</small>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {headerFields.length > 0 && (
                <div className="table-responsive">
                  <table className="erp-table">
                    <thead><tr><th>Field</th><th>Label</th><th>Type</th><th>Width</th><th>Source</th><th></th></tr></thead>
                    <tbody>
                      {headerFields.map((f, i) => (
                        <tr key={i}>
                          <td><input className="form-control form-control-sm" value={f.name} onChange={e => setHeaderFields(updateField(headerFields, i, 'name', e.target.value))} /></td>
                          <td><input className="form-control form-control-sm" value={f.label} onChange={e => setHeaderFields(updateField(headerFields, i, 'label', e.target.value))} /></td>
                          <td><select className="form-select form-select-sm" value={f.type} onChange={e => setHeaderFields(updateField(headerFields, i, 'type', e.target.value))}>
                            {['text','number','date','combobox','selectcombo','textarea','checkbox'].map(t => <option key={t}>{t}</option>)}
                          </select></td>
                          <td><input className="form-control form-control-sm" value={f.width} onChange={e => setHeaderFields(updateField(headerFields, i, 'width', e.target.value))} style={{ width: 100 }} /></td>
                          <td><input className="form-control form-control-sm" value={f.source} onChange={e => setHeaderFields(updateField(headerFields, i, 'source', e.target.value))} placeholder={f.type === 'selectcombo' ? 'boot key e.g. InvNo' : 'boot key / table'} /></td>
                          <td><button className="btn btn-xs btn-outline-danger" onClick={() => setHeaderFields(removeField(headerFields, i))}><i className="bi bi-x"></i></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="d-flex justify-content-between mt-4">
                <button className="btn btn-outline-secondary" onClick={() => setStep(1)}><i className="bi bi-arrow-left me-1"></i> Back</button>
                <button className="btn btn-primary" onClick={() => setStep(3)}>
                  Next: {formType === 'master-detail' ? 'Detail' : 'SPs'} <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          )}

          {step === 3 && !isReport && formType === 'master-detail' && (
            <div className="animate-fade">
              <h6 className="section-title">Detail Fields (Line Items)</h6>
              <div className="row mb-3">
                <div className="col-md-4">
                  <label className="form-label">Detail Table</label>
                  <div className="input-group input-group-sm">
                    <input className="form-control" value={detailTableSearch} onChange={e => setDetailTableSearch(e.target.value)} placeholder="Search tables..." />
                    <button className="btn btn-outline-secondary" onClick={() => {
                      const t = tables.find(t => t.toLowerCase().includes(detailTableSearch.toLowerCase()));
                      if (t) loadTableColumns(t, true);
                    }}>Load</button>
                  </div>
                  {detailTableSearch && (
                    <div className="list-group mt-1" style={{ maxHeight: 150, overflow: 'auto' }}>
                      {tables.filter(t => t.toLowerCase().includes(detailTableSearch.toLowerCase())).slice(0, 10).map(t => (
                        <button key={t} className={`list-group-item list-group-item-action py-1 ${selectedDetailTable === t ? 'active' : ''}`}
                          style={{ fontSize: 'calc(11px * var(--fs, 1))' }} onClick={() => loadTableColumns(t, true)}>{t}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-md-8">
                  {selectedDetailTable && detailColumns.length > 0 && (
                    <div>
                      <label className="form-label">Click to add as detail field</label>
                      <div className="d-flex flex-wrap gap-1" style={{ maxHeight: 150, overflow: 'auto' }}>
                        {detailColumns.map(c => (
                          <span key={c.COLUMN_NAME} className={`col-chip ${detailFields.find(f => f.name === c.COLUMN_NAME) ? 'selected' : ''}`}
                            onClick={() => addDetailField(c)}>
                            {c.COLUMN_NAME}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {detailFields.length > 0 && (
                <div className="table-responsive mb-3">
                  <table className="erp-table">
                    <thead><tr><th>Field</th><th>Label</th><th>Type</th><th>Source</th><th></th></tr></thead>
                    <tbody>
                      {detailFields.map((f, i) => (
                        <tr key={i}>
                          <td><input className="form-control form-control-sm" value={f.name} onChange={e => setDetailFields(updateField(detailFields, i, 'name', e.target.value))} /></td>
                          <td><input className="form-control form-control-sm" value={f.label} onChange={e => setDetailFields(updateField(detailFields, i, 'label', e.target.value))} /></td>
                          <td><select className="form-select form-select-sm" value={f.type} onChange={e => setDetailFields(updateField(detailFields, i, 'type', e.target.value))}>
                            {['text','number','date','combobox','selectcombo'].map(t => <option key={t}>{t}</option>)}
                          </select></td>
                          <td><input className="form-control form-control-sm" value={f.source || ''} onChange={e => setDetailFields(updateField(detailFields, i, 'source', e.target.value))} placeholder={f.type === 'selectcombo' ? 'boot key e.g. Item' : 'boot key / table'} style={{ width: 140 }} /></td>
                          <td><button className="btn btn-xs btn-outline-danger" onClick={() => setDetailFields(removeField(detailFields, i))}><i className="bi bi-x"></i></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h6 className="section-title mt-3">List Display</h6>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label">Primary Display Field</label>
                  <input className="form-control form-control-sm" value={listPrimary} onChange={e => setListPrimary(e.target.value)} placeholder="e.g. To_, BrandName" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Secondary Fields (comma sep)</label>
                  <input className="form-control form-control-sm" value={listSecondary} onChange={e => setListSecondary(e.target.value)} placeholder="e.g. Date, InvNo" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Badge Fields (comma sep)</label>
                  <input className="form-control form-control-sm" value={listBadges} onChange={e => setListBadges(e.target.value)} placeholder="e.g. InvoiceAmt" />
                </div>
              </div>

              <h6 className="section-title">Filters</h6>
              <div className="d-flex flex-wrap gap-2 mb-2">
                {listFilters.map((f, i) => (
                  <div key={i} className="col-chip selected">
                    {f.name} ({f.type})
                    <button className="btn p-0" style={{ fontSize: 'calc(10px * var(--fs, 1))', lineHeight: 1, color: 'white' }} onClick={() => setListFilters(prev => prev.filter((_, j) => j !== i))}><i className="bi bi-x"></i></button>
                  </div>
                ))}
              </div>
              <div className="input-group input-group-sm" style={{ maxWidth: 620 }}>
                <input className="form-control" id="newFilterName" placeholder="filter name" style={{ maxWidth: 150 }} />
                <select className="form-select" id="newFilterType" style={{ width: 135 }}>
                  <option value="text">Text</option>
                  <option value="date">Date</option>
                  <option value="selectcombo">SelectCombo</option>
                </select>
                <input className="form-control" id="newFilterSource" placeholder={document && document.getElementById('newFilterType') && document.getElementById('newFilterType').value === 'selectcombo' ? 'boot key e.g. InvNo' : 'boot key (combo only)'} style={{ maxWidth: 190 }} />
                <button className="btn btn-outline-primary" onClick={() => {
                  const name = document.getElementById('newFilterName').value;
                  const type = document.getElementById('newFilterType').value;
                  const source = document.getElementById('newFilterSource').value;
                  if (name) { setListFilters(prev => [...prev, { name, label: name, type, source: source || '', default: type === 'date' ? 'session_startdate' : '' }]); document.getElementById('newFilterName').value = ''; document.getElementById('newFilterSource').value = ''; }
                }}>Add</button>
              </div>

              <div className="d-flex justify-content-between mt-4">
                <button className="btn btn-outline-secondary" onClick={() => setStep(2)}><i className="bi bi-arrow-left me-1"></i> Back</button>
                <button className="btn btn-primary" onClick={() => { setStep(4); autoFillSPs(); }}>Next: SPs <i className="bi bi-arrow-right ms-1"></i></button>
              </div>
            </div>
          )}

          {step === 3 && !isReport && formType === 'master' && (
            <div className="animate-fade">
              <h6 className="section-title">List Page Options</h6>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={stickySearch} onChange={e => setStickySearch(e.target.checked)} id="stickySearch" />
                    <label className="form-check-label" htmlFor="stickySearch">Sticky Search Bar</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={stickyFooter} onChange={e => setStickyFooter(e.target.checked)} id="stickyFooter" />
                    <label className="form-check-label" htmlFor="stickyFooter">Sticky Footer (Pagination + Links)</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={showActionLabels} onChange={e => setShowActionLabels(e.target.checked)} id="showLabels" />
                    <label className="form-check-label" htmlFor="showLabels">Show Action Button Labels</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={showPrint} onChange={e => setShowPrint(e.target.checked)} id="showPrint" />
                    <label className="form-check-label" htmlFor="showPrint">Show Print Button</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={showDelete} onChange={e => setShowDelete(e.target.checked)} id="showDelete" />
                    <label className="form-check-label" htmlFor="showDelete">Show Delete Button</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={picUpload} onChange={e => setPicUpload(e.target.checked)} id="picUpload" />
                    <label className="form-check-label" htmlFor="picUpload">Pic Upload Button (row <i className="bi bi-image"></i>)</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={picPreview} onChange={e => setPicPreview(e.target.checked)} id="picPreview" />
                    <label className="form-check-label" htmlFor="picPreview">Pic Preview Column (first)</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Pic Field (master column storing path)</label>
                  <input className="form-control form-control-sm" value={picField} onChange={e => setPicField(e.target.value)} placeholder="imgurl" />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Footer Links <small className="text-muted">(one per line: Label|formId)</small></label>
                <textarea className="form-control form-control-sm" rows={3} value={footerLinksText} onChange={e => setFooterLinksText(e.target.value)}
                  placeholder={"Base Item|frmItem\nCategory|frmItemCategory\nHSN|frmhsn"} />
              </div>

              <h6 className="section-title">Stored Procedures</h6>
              <div className="row g-3">
                {[
                  { label: 'Boot SP', value: spBoot, set: setSpBoot, placeholder: `sp_${formId}_boot` },
                  { label: 'Search (Grid2)', value: spSearch, set: setSpSearch, placeholder: `sp_${formId}_Grid2` },
                  { label: 'Grid Count', value: spGridCount, set: setSpGridCount, placeholder: `sp_${formId}_GridCount1` },
                  { label: 'Save SP', value: spSave, set: setSpSave, placeholder: `sp_${formId}_SAVE` },
                  { label: 'Update SP', value: spUpdate, set: setSpUpdate, placeholder: `sp_${formId}_UPDATE` },
                  { label: 'Delete SP', value: spDelete, set: setSpDelete, placeholder: `sp_${formId}_Delete1` },
                ].map(sp => (
                  <div key={sp.label} className="col-md-6">
                    <label className="form-label">{sp.label}</label>
                    <input className="form-control form-control-sm" value={sp.value} onChange={e => sp.set(e.target.value)} placeholder={sp.placeholder} />
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <label className="form-label">Search SPs in Database</label>
                <input className="form-control form-control-sm" value={reportSpSearch} onChange={e => searchSPs(e.target.value)} placeholder="Type to search SPs..." />
                {reportSpList.length > 0 && (
                  <div className="list-group mt-1" style={{ maxHeight: 150, overflow: 'auto' }}>
                    {reportSpList.map(sp => (
                      <button key={sp} className="list-group-item list-group-item-action py-1" style={{ fontSize: 'calc(11px * var(--fs, 1))', fontFamily: 'var(--font-mono)' }}>{sp}</button>
                    ))}
                  </div>
                )}
              </div>

              {message && <div className="alert alert-success mt-3 py-2" style={{ fontSize: 'calc(12px * var(--fs, 1))' }}>{message}</div>}

              <div className="d-flex justify-content-between mt-4">
                <button className="btn btn-outline-secondary" onClick={() => setStep(2)}><i className="bi bi-arrow-left me-1"></i> Back</button>
                <button className="btn btn-success" onClick={generate} disabled={generating || !formId}>
                  {generating ? <><span className="spinner-border spinner-border-sm me-1"></span> Generating...</> : <><i className="bi bi-check-lg me-1"></i> Generate Form</>}
                </button>
              </div>
            </div>
          )}

          {step === 4 && !isReport && (
            <div className="animate-fade">
              <h6 className="section-title">List Page Options</h6>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={stickySearch} onChange={e => setStickySearch(e.target.checked)} id="stickySearch4" />
                    <label className="form-check-label" htmlFor="stickySearch4">Sticky Search Bar</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={stickyFooter} onChange={e => setStickyFooter(e.target.checked)} id="stickyFooter4" />
                    <label className="form-check-label" htmlFor="stickyFooter4">Sticky Footer</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={showActionLabels} onChange={e => setShowActionLabels(e.target.checked)} id="showLabels4" />
                    <label className="form-check-label" htmlFor="showLabels4">Show Action Labels</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={showPrint} onChange={e => setShowPrint(e.target.checked)} id="showPrint4" />
                    <label className="form-check-label" htmlFor="showPrint4">Show Print</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={showDelete} onChange={e => setShowDelete(e.target.checked)} id="showDelete4" />
                    <label className="form-check-label" htmlFor="showDelete4">Show Delete</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={picUpload} onChange={e => setPicUpload(e.target.checked)} id="picUpload4" />
                    <label className="form-check-label" htmlFor="picUpload4">Pic Upload Button</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={picPreview} onChange={e => setPicPreview(e.target.checked)} id="picPreview4" />
                    <label className="form-check-label" htmlFor="picPreview4">Pic Preview Column (first)</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Pic Field (master column storing path)</label>
                  <input className="form-control form-control-sm" value={picField} onChange={e => setPicField(e.target.value)} placeholder="imgurl" />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Footer Links <small className="text-muted">(Label|formId, one per line)</small></label>
                <textarea className="form-control form-control-sm" rows={2} value={footerLinksText} onChange={e => setFooterLinksText(e.target.value)}
                  placeholder={"Base Item|frmItem\nCategory|frmItemCategory"} />
              </div>

              <h6 className="section-title">Stored Procedures</h6>
              <div className="row g-3">
                {[
                  { label: 'Boot SP', value: spBoot, set: setSpBoot, placeholder: `sp_${formId}_boot` },
                  { label: 'Search (Grid2)', value: spSearch, set: setSpSearch, placeholder: `sp_${formId}_Grid2` },
                  { label: 'Grid Count', value: spGridCount, set: setSpGridCount, placeholder: `sp_${formId}_GridCount1` },
                  { label: 'Save SP', value: spSave, set: setSpSave, placeholder: `sp_${formId}_SAVE` },
                  { label: 'Update SP', value: spUpdate, set: setSpUpdate, placeholder: `sp_${formId}_UPDATE` },
                  { label: 'Delete SP', value: spDelete, set: setSpDelete, placeholder: `sp_${formId}_Delete1` },
                ].map(sp => (
                  <div key={sp.label} className="col-md-6">
                    <label className="form-label">{sp.label}</label>
                    <input className="form-control form-control-sm" value={sp.value} onChange={e => sp.set(e.target.value)} placeholder={sp.placeholder} />
                  </div>
                ))}
              </div>

              {message && <div className="alert alert-success mt-3 py-2" style={{ fontSize: 'calc(12px * var(--fs, 1))' }}>{message}</div>}

              <div className="d-flex justify-content-between mt-4">
                <button className="btn btn-outline-secondary" onClick={() => setStep(formType === 'master-detail' ? 3 : 3)}><i className="bi bi-arrow-left me-1"></i> Back</button>
                <button className="btn btn-success" onClick={generate} disabled={generating || !formId}>
                  {generating ? <><span className="spinner-border spinner-border-sm me-1"></span> Generating...</> : <><i className="bi bi-check-lg me-1"></i> Generate Form</>}
                </button>
              </div>
            </div>
          )}

          {step === 3 && isReport && (
            <div className="text-center">
              <div className="mb-3" style={{fontSize: 'calc(14px * var(--fs, 1))'}}>
                Ready to generate <strong>{formId}</strong> report with SP <code>{reportSpName}</code>
                {reportSpParams.length > 0 && <>, {reportSpParams.length} filter(s)</>}
              </div>
              {message && <div className="alert alert-success py-2" style={{ fontSize: 'calc(12px * var(--fs, 1))' }}>{message}</div>}
              <div className="d-flex justify-content-between mt-4">
                <button className="btn btn-outline-secondary" onClick={() => setStep(2)}><i className="bi bi-arrow-left me-1"></i> Back</button>
                <button className="btn btn-success btn-lg" onClick={generate} disabled={generating || !formId}>
                  {generating ? <><span className="spinner-border spinner-border-sm me-1"></span> Generating...</> : <><i className="bi bi-check-lg me-1"></i> Generate Report</>}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
