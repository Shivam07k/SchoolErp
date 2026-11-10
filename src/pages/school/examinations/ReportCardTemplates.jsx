import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, canManage, fmtDate } from './shared';

const BANDS = ['primary', 'middle', 'senior'];
const DEFAULT_LAYOUT = {
  showRank: true,
  showAttendance: true,
  showCoScholastic: true,
  showRemarks: true,
  showGrace: true,
  showGradePoints: false,
  header: 'School ERP',
  footerNote: '',
};

export default function ReportCardTemplates({ me, onNavigate }) {
  const [templates, setTemplates] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', classBand: 'primary', academicYearId: '', isDefault: false, layout: DEFAULT_LAYOUT });
  const manager = canManage(me, 'exam.report_setup');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [tplRes, yearRes] = await Promise.all([
        apiGet('/school/exam/report-templates'),
        apiGet('/school/academic-years'),
      ]);
      if (!tplRes?.ok) throw new Error(tplRes?.error || 'Could not load templates');
      setTemplates(tplRes.templates || []);
      if (yearRes?.ok) setYears(yearRes.academicYears || yearRes.years || []);
    } catch (err) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const activeYearId = useMemo(() => years.find((y) => y.is_active)?.id || years[0]?.id || '', [years]);

  function edit(template) {
    setForm({
      id: template.id,
      name: template.name,
      classBand: template.class_band,
      academicYearId: template.academic_year_id || '',
      isDefault: Boolean(template.is_default),
      layout: { ...DEFAULT_LAYOUT, ...(template.layout || {}) },
    });
  }

  function reset() {
    setForm({ id: '', name: '', classBand: 'primary', academicYearId: activeYearId, isDefault: false, layout: DEFAULT_LAYOUT });
  }

  async function save() {
    if (!form.name.trim()) return toast('Template name is required', 'warning');
    setBusy(true);
    try {
      const body = {
        name: form.name,
        classBand: form.classBand,
        academicYearId: form.academicYearId ? Number(form.academicYearId) : null,
        isDefault: form.isDefault,
        layout: form.layout,
      };
      const res = form.id
        ? await apiPut(`/school/exam/report-templates/${form.id}`, body)
        : await apiPost('/school/exam/report-templates', body);
      if (!res?.ok) throw new Error(res?.error || 'Could not save template');
      toast(`Template ${form.id ? 'updated' : 'created'}`, 'success');
      reset();
      load();
    } catch (err) {
      toast(err.message || 'Could not save template', 'error');
    } finally {
      setBusy(false);
    }
  }

  function setLayout(key, value) {
    setForm((prev) => ({ ...prev, layout: { ...prev.layout, [key]: value } }));
  }

  return (
    <PageShell
      title="Report Card Templates"
      icon="bi-file-earmark-richtext"
      subtitle="Layouts are versioned per academic year and class band"
      onNavigate={onNavigate}
      actions={
        <>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/examinations/report-cards')}>
            <i className="bi bi-arrow-left me-1"></i>Report Cards
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={reset}>New Template</button>
        </>
      }
    >
      <ErrorBox message={error} onRetry={load} />

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="border rounded p-3">
            <h6 className="fw-semibold small mb-3">{form.id ? `Edit template #${form.id}` : 'Create template'}</h6>
            <div className="d-grid gap-2">
              <div>
                <label className="form-label small">Name</label>
                <input className="form-control form-control-sm" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Primary Report Card" />
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label small">Class band</label>
                  <select className="form-select form-select-sm" value={form.classBand} onChange={(e) => setForm((p) => ({ ...p, classBand: e.target.value }))}>
                    {BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small">Academic year</label>
                  <select className="form-select form-select-sm" value={form.academicYearId} onChange={(e) => setForm((p) => ({ ...p, academicYearId: e.target.value }))}>
                    <option value="">Any</option>
                    {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="border rounded p-2">
                <div className="small fw-semibold mb-2">Layout</div>
                {[
                  ['showRank', 'Show rank'],
                  ['showAttendance', 'Show attendance'],
                  ['showCoScholastic', 'Show co-scholastic grades'],
                  ['showRemarks', 'Show remarks'],
                  ['showGrace', 'Show grace marks'],
                  ['showGradePoints', 'Show grade points'],
                ].map(([key, label]) => (
                  <div className="form-check" key={key}>
                    <input className="form-check-input" type="checkbox" id={`layout-${key}`} checked={Boolean(form.layout[key])} onChange={(e) => setLayout(key, e.target.checked)} />
                    <label className="form-check-label small" htmlFor={`layout-${key}`}>{label}</label>
                  </div>
                ))}
                <div className="mt-2">
                  <label className="form-label small">Header text</label>
                  <input className="form-control form-control-sm" value={form.layout.header || ''} onChange={(e) => setLayout('header', e.target.value)} />
                </div>
                <div className="mt-2">
                  <label className="form-label small">Footer note</label>
                  <input className="form-control form-control-sm" value={form.layout.footerNote || ''} onChange={(e) => setLayout('footerNote', e.target.value)} />
                </div>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="isDefault" checked={form.isDefault} onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))} />
                <label className="form-check-label small" htmlFor="isDefault">Default template for this band</label>
              </div>
              <button className="btn btn-sm btn-primary" onClick={save} disabled={!manager || busy}>{busy ? 'SavingÃ¢â‚¬Â¦' : form.id ? 'Update template' : 'Create template'}</button>
              {!manager && <div className="text-muted small">You have view-only access.</div>}
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="border rounded">
            <div className="px-3 py-2 border-bottom fw-semibold small">Templates ({templates.length})</div>
            {loading ? <Loading /> : templates.length === 0 ? <Empty icon="bi-file-earmark-richtext" text="No report card templates yet." /> : (
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle">
                  <thead><tr><th>Name</th><th>Band</th><th>Year</th><th>Default</th><th>Created</th><th className="text-end"></th></tr></thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id}>
                        <td className="small">{t.name}</td>
                        <td className="small"><span className="badge bg-secondary">{t.class_band}</span></td>
                        <td className="small">{t.academic_year_id ? (years.find((y) => y.id === t.academic_year_id)?.name || `#${t.academic_year_id}`) : 'Any'}</td>
                        <td className="small">{t.is_default ? <span className="badge bg-success">Default</span> : 'Ã¢â‚¬â€'}</td>
                        <td className="small">{fmtDate(t.created_at)}</td>
                        <td className="text-end"><button className="btn btn-sm btn-outline-primary" onClick={() => edit(t)} disabled={!manager}>Edit</button></td>
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

