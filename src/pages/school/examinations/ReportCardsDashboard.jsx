import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, getToken } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, canManage, fmtDateTime } from './shared';

async function openAuthorized(url) {
  const tab = window.open('about:blank', '_blank');
  if (!tab) return toast('Allow pop-ups to open the report card', 'warning');
  try {
    const res = await fetch(`/api${url}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error(`Could not open report card: ${res.status}`);
    const objectUrl = URL.createObjectURL(await res.blob());
    tab.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (err) {
    tab.close();
    toast(err.message, 'error');
  }
}

export default function ReportCardsDashboard({ me, onNavigate }) {
  const [versions, setVersions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [copyNo, setCopyNo] = useState(1);
  const [withholdFees, setWithholdFees] = useState(false);
  const [withholdAttendance, setWithholdAttendance] = useState(false);
  const [cards, setCards] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const manager = canManage(me, 'exam.reportcards.generate');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [verRes, tmplRes, secRes] = await Promise.all([
        apiGet('/school/exam/result-versions'),
        apiGet('/school/exam/report-templates'),
        apiGet('/school/classes'),
      ]);
      if (!verRes?.ok) throw new Error(verRes?.error || 'Could not load result versions');
      if (!tmplRes?.ok) throw new Error(tmplRes?.error || 'Could not load templates');
      if (!secRes?.ok) throw new Error(secRes?.error || 'Could not load classes');
      setVersions(verRes.versions || []);
      setTemplates(tmplRes.templates || []);
      const allSections = (secRes.classes || []).flatMap((c) => (c.sections || []).map((s) => ({ ...s, class_name: c.name })));
      setSections(allSections);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function loadCards() {
    if (!selectedVersionId) { setCards([]); return; }
    try {
      const params = new URLSearchParams({ versionId: selectedVersionId, copyNo: String(copyNo) });
      if (selectedSectionId) params.set('sectionId', selectedSectionId);
      const res = await apiGet(`/school/exam/report-cards?${params.toString()}`);
      if (res?.ok) setCards(res.reportCards || []);
    } catch (err) {
      toast(err.message || 'Could not load report cards', 'error');
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { loadCards(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedVersionId, selectedSectionId, copyNo]);

  const selectedVersion = useMemo(() => versions.find((v) => String(v.id) === String(selectedVersionId)), [versions, selectedVersionId]);
  const stats = useMemo(() => {
    const agg = { total: cards.length, generated: 0, published: 0, withheld: 0 };
    cards.forEach((c) => {
      if (agg[c.status] !== undefined) agg[c.status]++;
    });
    return agg;
  }, [cards]);

  async function generate() {
    if (!selectedVersionId) return toast('Select a result version', 'warning');
    if (!selectedTemplateId) return toast('Select a template', 'warning');
    if (!selectedSectionId) return toast('Select a section', 'warning');
    if (selectedVersion?.status !== 'published') return toast('Only published result versions can produce report cards', 'warning');
    setBusy(true);
    setError('');
    try {
      const res = await apiPost('/school/exam/report-cards/generate', {
        versionId: Number(selectedVersionId),
        templateId: Number(selectedTemplateId),
        sectionId: Number(selectedSectionId),
        copyNo: Number(copyNo) || 1,
        withholdFees,
        withholdAttendance,
      });
      if (!res?.ok) throw new Error(res?.error || 'Could not generate report cards');
      setLastRun(res);
      toast(`Generated ${res.generated || 0}, withheld ${res.withheld || 0}, skipped ${res.skipped || 0}`, res.withheld || res.skipped ? 'warning' : 'success');
      await loadCards();
    } catch (err) {
      setError(err.message || 'Failed to generate report cards');
      toast(err.message || 'Failed to generate report cards', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!selectedVersionId) return toast('Select a result version', 'warning');
    if (!window.confirm('Publish all generated report cards for this version and section?')) return;
    setBusy(true);
    try {
      const res = await apiPost('/school/exam/report-cards/publish', {
        versionId: Number(selectedVersionId),
        sectionId: selectedSectionId ? Number(selectedSectionId) : null,
      });
      if (!res?.ok) throw new Error(res?.error || 'Could not publish report cards');
      toast(`Published ${res.published} report card(s)`, 'success');
      await loadCards();
    } catch (err) {
      toast(err.message || 'Could not publish report cards', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function withhold(card) {
    const reason = window.prompt('Reason for withholding this report card (audited):', card.withheld_reason || '');
    if (!reason) return;
    setBusy(true);
    try {
      const res = await apiPost('/school/exam/report-cards/withhold', {
        studentId: card.student_id,
        versionId: card.version_id,
        reason,
      });
      if (!res?.ok) throw new Error(res?.error || 'Could not withhold report card');
      toast('Report card withheld', 'success');
      await loadCards();
    } catch (err) {
      toast(err.message || 'Could not withhold report card', 'error');
    } finally {
      setBusy(false);
    }
  }

  function preview(card) {
    openAuthorized(`/school/exam/report-cards/preview/${card.student_id}/${card.version_id}?copy=${card.copy_no || copyNo}`);
  }

  const filteredTemplates = useMemo(() => {
    if (!selectedVersion?.class_band) return templates;
    const banded = templates.filter((t) => t.class_band === selectedVersion.class_band);
    return banded.length ? banded : templates;
  }, [templates, selectedVersion]);

  return (
    <PageShell
      title="Report Cards"
      icon="bi-file-earmark-text"
      subtitle="Generate, review, withhold and publish report cards from a published result snapshot"
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/report-cards/templates')}>
            <i className="bi bi-gear me-1"></i>Manage Templates
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/results')}>
            <i className="bi bi-graph-up me-1"></i>Results
          </button>
        </>
      }
    >
      <ErrorBox message={error} onRetry={load} />

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label small">Result Version</label>
          <select className="form-select form-select-sm" value={selectedVersionId} onChange={(e) => setSelectedVersionId(e.target.value)}>
            <option value="">Select version</option>
            {versions.map((v) => <option key={v.id} value={v.id}>{v.exam_name || v.term_name} Ã‚Â· {v.class_band} Ã‚Â· v{v.version_no} ({v.status})</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label small">Template</label>
          <select className="form-select form-select-sm" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
            <option value="">Select template</option>
            {filteredTemplates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.class_band})</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label small">Section</label>
          <select className="form-select form-select-sm" value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)}>
            <option value="">All sections of the version</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.class_name} / {s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-2">
          <label className="form-label small">Copy No.</label>
          <input type="number" min="1" className="form-control form-control-sm" value={copyNo} onChange={(e) => setCopyNo(Number(e.target.value) || 1)} />
        </div>
        <div className="col-md-10 d-flex flex-wrap gap-3 align-items-end">
          <div className="form-check">
            <input type="checkbox" className="form-check-input" id="withholdFees" checked={withholdFees} onChange={(e) => setWithholdFees(e.target.checked)} />
            <label className="form-check-label small" htmlFor="withholdFees">Withhold for fee dues</label>
          </div>
          <div className="form-check">
            <input type="checkbox" className="form-check-input" id="withholdAttendance" checked={withholdAttendance} onChange={(e) => setWithholdAttendance(e.target.checked)} />
            <label className="form-check-label small" htmlFor="withholdAttendance">Withhold for attendance below 75%</label>
          </div>
          <div className="ms-auto d-flex gap-2">
            <button className="btn btn-sm btn-primary" onClick={generate} disabled={!manager || busy || !selectedVersionId || !selectedTemplateId || !selectedSectionId}>
              {busy ? 'WorkingÃ¢â‚¬Â¦' : 'Generate Report Cards'}
            </button>
            <button className="btn btn-sm btn-success" onClick={publish} disabled={!manager || busy || !selectedVersionId}>
              Publish Generated
            </button>
          </div>
        </div>
      </div>

      {selectedVersion && selectedVersion.status !== 'published' && (
        <div className="alert alert-warning py-2 small">
          This version is <strong>{selectedVersion.status}</strong>. Publish it from the Results screen before generating report cards.
        </div>
      )}

      {lastRun && (
        <div className="alert alert-light border py-2 small d-flex flex-wrap gap-3">
          <span>Last run: <strong>{lastRun.total}</strong> student(s)</span>
          <span className="text-success">Generated: <strong>{lastRun.generated || 0}</strong></span>
          <span className="text-danger">Withheld: <strong>{lastRun.withheld || 0}</strong></span>
          <span className="text-muted">Skipped: <strong>{lastRun.skipped || 0}</strong></span>
          {lastRun.skipped > 0 && <span className="text-muted">Skipped students have no result snapshot in this version.</span>}
        </div>
      )}

      <div className="row g-3">
        <div className="col-12">
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3"><div className="border rounded p-3"><div className="text-muted small">Cards</div><div className="fs-4 fw-bold">{stats.total}</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3"><div className="text-muted small">Generated</div><div className="fs-4 fw-bold text-primary">{stats.generated}</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3"><div className="text-muted small">Published</div><div className="fs-4 fw-bold text-success">{stats.published}</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded p-3"><div className="text-muted small">Withheld</div><div className="fs-4 fw-bold text-danger">{stats.withheld}</div></div></div>
          </div>

          <div className="border rounded">
            <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
              <span className="fw-semibold small">Report Cards {selectedVersion ? `Ã¢â‚¬â€ v${selectedVersion.version_no}` : ''}</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={loadCards} disabled={!selectedVersionId}><i className="bi bi-arrow-clockwise"></i></button>
            </div>
            {loading ? <Loading /> : !selectedVersionId ? <Empty icon="bi-file-earmark-text" text="Select a result version to see generated report cards." /> : !cards.length ? <Empty icon="bi-file-earmark-text" text="No report cards generated for this version yet." /> : (
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle">
                  <thead><tr><th>Student</th><th>Admission</th><th>Class / Section</th><th>Copy</th><th>Status</th><th>Reason</th><th>Generated</th><th className="text-end"></th></tr></thead>
                  <tbody>
                    {cards.map((card) => (
                      <tr key={card.id}>
                        <td className="small fw-semibold">{card.student}</td>
                        <td className="small">{card.admission_no}</td>
                        <td className="small">{card.class_name} / {card.section_name}</td>
                        <td className="small">{card.copy_no}</td>
                        <td><span className={`badge bg-${card.status === 'published' ? 'success' : card.status === 'withheld' ? 'danger' : 'secondary'}`}>{card.status}</span></td>
                        <td className="small text-muted">{card.withheld_reason || 'Ã¢â‚¬â€'}</td>
                        <td className="small">{card.generated_at ? fmtDateTime(card.generated_at) : 'Ã¢â‚¬â€'}</td>
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-primary" onClick={() => preview(card)}><i className="bi bi-eye me-1"></i>Preview</button>
                            {manager && card.status !== 'withheld' && <button className="btn btn-outline-danger" onClick={() => withhold(card)}>Withhold</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

