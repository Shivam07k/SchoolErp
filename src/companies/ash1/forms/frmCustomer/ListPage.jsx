import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiCall } from '../../../../api';
import { toast } from '../../../../toast';
import HtmlCell from '../../../../components/HtmlCell';
import PicCell from '../../../../components/PicCell';
import PicUpload from '../../../../components/PicUpload';

// frmCustomer — List Page (master)
// Styled per current generator template

function ListPage({ formId, config, onEdit, onAdd, onPrint, onNavigate }) {
  const TITLE = 'Customer Master';
  const IS_REPORT = false;
  const FOOTER_LINKS = [];
  const STICKY_SEARCH = true;
  const STICKY_FOOTER = false;
  const SHOW_LABELS = false;
  const SHOW_PRINT = true;
  const SHOW_DELETE = true;
  const PIC = false;
  const PIC_PREVIEW = false;
  const PIC_FIELD = 'imgurl';
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    LedgerCode: '',
    LedgerGroup: '',
    Country: ''
  });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const bootRef = useRef(null);

  const searchData = useCallback(async (overrides = {}) => {
    setLoading(true);
    try {
      const bootPromise = bootRef.current ? Promise.resolve(bootRef.current) : apiCall('_BOOT', formId, {}).then(b => { bootRef.current = b; return b; });
      const f = { ...filters, ...overrides };
      const params = {};
      params['LedgerCode'] = f.LedgerCode || '';
      params['LedgerGroup'] = f.LedgerGroup || '';
      params['Country'] = f.Country || '';
      const [boot, search] = await Promise.all([
        bootPromise,
        apiCall('_SEARCH_JSON', formId, { params, pagesize: 20, pageno: page, FCODE: '' }),
      ]);
      setData({ ...boot, ...search });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [formId, filters, page]);

  useEffect(() => { searchData(); }, [page]);

  const del = async (id) => {
    if (!confirm('Delete this record?')) return;
    try { await apiCall('_DELETE', formId, { id }); toast('Deleted successfully', 'success'); searchData(); }
    catch (e) { toast('Delete failed', 'error'); }
  };

  const totalPages = data?.TotalPages?.[0]?.TotalPages || 0;
  const totalPagesCalc = Math.ceil(totalPages / 20);

  return (
    <div className="page-content animate-fade" style={{ paddingBottom: STICKY_FOOTER ? 110 : 20 }}>
      <div className={STICKY_SEARCH ? 'filter-sticky' : ''}>
        <div className="card search-panel"><div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div key="LedgerCode" className="col-6 col-md-3 col-lg-2">
              <label className="form-label">Ledger Code</label>
              <input type="text" className="form-control form-control-sm"
                value={filters.LedgerCode || ''} onChange={e => setFilters(p => ({ ...p, LedgerCode: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && searchData()} />
            </div>
            <div key="LedgerGroup" className="col-6 col-md-3 col-lg-2">
              <label className="form-label">Group</label>
              <input type="text" className="form-control form-control-sm"
                value={filters.LedgerGroup || ''} onChange={e => setFilters(p => ({ ...p, LedgerGroup: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && searchData()} />
            </div>
            <div key="Country" className="col-6 col-md-3 col-lg-2">
              <label className="form-label">Country</label>
              <input type="text" className="form-control form-control-sm"
                value={filters.Country || ''} onChange={e => setFilters(p => ({ ...p, Country: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && searchData()} />
            </div>
            <div className="col-12 col-md-auto ms-md-auto">
              <div className="toolbar-actions">
                <button className="btn btn-outline-secondary" onClick={searchData} disabled={loading}>
                  <i className="bi bi-search"></i> Search
                </button>
                {!IS_REPORT && onAdd && (
                  <button className="btn btn-primary" onClick={onAdd}>
                    <i className="bi bi-plus-lg"></i> Add New
                  </button>
                )}
              </div>
            </div>
          </div>
        </div></div>
      </div>

      {loading && <div className="text-center py-4"><div className="spinner-border"></div></div>}

      {!loading && data?.grid1?.length === 0 && (
        <div className="empty-state"><i className="bi bi-inbox"></i><p>No records found</p></div>
      )}

      {!loading && data?.grid1 && data.grid1.length > 0 && (
        <div className="card content-panel">
          <div className="card-header d-flex justify-content-between">
            <span>{TITLE} — {totalPages || data.grid1.length} records</span>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="erp-table">
                <thead><tr>
                  {PIC_PREVIEW && <th style={{ width: 60 }} className="text-center">Pic</th>}
                  <th>Ledger Code</th>
                  <th>Ledger Group</th>
                  <th>Alias</th>
                  <th>Currency</th>
                  <th>Country</th>
                  <th>Address 1</th>
                  <th>Address 2</th>
                  <th>City</th>
                  <th style={{ width: 132 }} className="text-end">Actions</th>
                </tr></thead>
                <tbody>
                  {data.grid1.map((row, i) => (
                    <tr key={i}>
                      {PIC_PREVIEW && (
                        <td className="pic-col">
                          <PicCell formId={formId} rowId={row.id} config={config} src={row[PIC_FIELD]} onReload={searchData} />
                        </td>
                      )}
                      <HtmlCell value={row.LedgerCode} />
                      <HtmlCell value={row.LedgerGroup} />
                      <HtmlCell value={row.Alias} />
                      <HtmlCell value={row.Currency} />
                      <HtmlCell value={row.Country} />
                      <HtmlCell value={row.Add1} />
                      <HtmlCell value={row.Add2} />
                      <HtmlCell value={row.City} />
                      <td>
                        <div className="row-btns">
                          {PIC && <PicUpload formId={formId} rowId={row.id} onDone={searchData} showLabel={SHOW_LABELS} />}
                          {!IS_REPORT && onEdit && <button className="btn-row" title="Edit" onClick={() => onEdit(row.id)}><i className="bi bi-pencil-square"></i>{SHOW_LABELS && <span className="btn-label"> Edit</span>}</button>}
                          {SHOW_PRINT && !IS_REPORT && onPrint && <button className="btn-row print" title="Print" onClick={() => onPrint(row.id)}><i className="bi bi-printer"></i>{SHOW_LABELS && <span className="btn-label"> Print</span>}</button>}
                          {SHOW_DELETE && !IS_REPORT && <button className="btn-row danger" title="Delete" onClick={() => del(row.id)}><i className="bi bi-trash3"></i>{SHOW_LABELS && <span className="btn-label"> Delete</span>}</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {STICKY_FOOTER && (
        <div className="sticky-bottom-bar footer-panel">
          {totalPagesCalc > 1 && (
            <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
              <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><i className="bi bi-chevron-left"></i></button>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Page {page} of {totalPagesCalc}</span>
              <button className="btn btn-outline-secondary btn-sm" disabled={page >= totalPagesCalc} onClick={() => setPage(p => p + 1)}><i className="bi bi-chevron-right"></i></button>
            </div>
          )}
          {FOOTER_LINKS.length > 0 && (
            <div className="d-flex flex-wrap gap-1 justify-content-center">
              {FOOTER_LINKS.map((link, i) => (
                <button key={i} className="btn btn-outline-secondary btn-xs"
                  onClick={() => onNavigate ? onNavigate('list', link.formId) : (window.location.hash = '#/form/' + link.formId)}>
                  {link.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!STICKY_FOOTER && totalPagesCalc > 1 && (
        <div className="d-flex justify-content-center align-items-center gap-2 mt-3">
          <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><i className="bi bi-chevron-left"></i></button>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Page {page} of {totalPagesCalc}</span>
          <button className="btn btn-outline-secondary btn-sm" disabled={page >= totalPagesCalc} onClick={() => setPage(p => p + 1)}><i className="bi bi-chevron-right"></i></button>
        </div>
      )}
    </div>
  );
}

export default ListPage;