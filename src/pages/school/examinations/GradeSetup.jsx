import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, canManage, downloadCsv } from './shared';

const CLASS_BANDS = ['primary', 'middle', 'senior', 'custom'];
const ROUNDING_RULES = ['none', 'nearest', 'up'];
const TIE_RULES = ['same_rank', 'fractional', 'competition'];

export default function GradeSetup({ me, onNavigate }) {
  const [scales, setScales] = useState([]);
  const [bands, setBands] = useState([]);
  const [rules, setRules] = useState([]);
  const [years, setYears] = useState([]);
  const [activeScaleId, setActiveScaleId] = useState('');
  const [activeRuleId, setActiveRuleId] = useState('');
  const [scaleForm, setScaleForm] = useState({ academicYearId: '', name: '', description: '', version: 1 });
  const [bandForm, setBandForm] = useState({ scaleId: '', classBand: 'primary', minPercent: '', maxPercent: '', grade: '', gradePoints: '', remark: '', sortOrder: 0 });
  const [ruleForm, setRuleForm] = useState({
    academicYearId: '', classBand: 'primary', version: 1,
    weightageScheme: { unit_test: 10, half_yearly: 40, annual: 50 },
    bestOfRule: { enabled: true, n: 2, of: 3, examTypes: ['unit_test'] },
    passRule: { perSubject: 33, aggregate: 33, bothRequired: true },
    graceRule: { enabled: true, maxPerSubject: 5, maxTotal: 15, onlyIfClose: true, closeThreshold: 5 },
    compartmentRule: { enabled: true, maxFailedSubjects: 2 },
    roundingRule: 'nearest',
    rankRule: { enabled: true, tie: 'same_rank', scope: 'section' },
    optionalSubjectRule: { countInTotal: false, gradeOnly: true },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('scales');
  const manager = canManage(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [scaleRes, bandRes, ruleRes, yearRes] = await Promise.all([
        apiGet('/school/grade-scales'),
        apiGet('/school/exam/grade-scales'), // bands are nested
        apiGet('/school/exam/result-rules'),
        apiGet('/school/academic-years'),
      ]);
      if (!scaleRes?.ok) throw new Error(scaleRes?.error || 'Could not load grade scales');
      if (!ruleRes?.ok) throw new Error(ruleRes?.error || 'Could not load result rules');
      if (!yearRes?.ok) throw new Error(yearRes?.error || 'Could not load academic years');

      setScales(scaleRes.gradeScales || []);
      setRules(ruleRes.resultRules || []);
      setYears(yearRes.academicYears || []);

      // Load bands for first scale
      if (scaleRes.gradeScales?.[0]) {
        setActiveScaleId(String(scaleRes.gradeScales[0].id));
        await loadBands(scaleRes.gradeScales[0].id);
      }
      if (ruleRes.resultRules?.[0]) setActiveRuleId(String(ruleRes.resultRules[0].id));
    } catch (err) {
      setError(err.message || 'Failed to load grade setup');
    } finally {
      setLoading(false);
    }
  }

  async function loadBands(scaleId) {
    const res = await apiGet(`/school/exam/grade-scales/${scaleId}/bands`);
    if (res?.ok) setBands(res.bands || []);
  }

  useEffect(() => { load(); }, []);

  function resetScaleForm() { setScaleForm({ academicYearId: '', name: '', description: '', version: 1 }); }
  function resetBandForm() { setBandForm({ scaleId: activeScaleId, classBand: 'primary', minPercent: '', maxPercent: '', grade: '', gradePoints: '', remark: '', sortOrder: bands.length }); }

  async function submitScale(e) {
    e.preventDefault();
    try {
      await apiPost('/school/exam/grade-scales', scaleForm);
      toast('Grade scale created', 'success');
      resetScaleForm();
      load();
    } catch (err) { toast(err.message || 'Failed to create scale', 'error'); }
  }

  async function submitBand(e) {
    e.preventDefault();
    try {
      await apiPost(`/school/exam/grade-scales/${activeScaleId}/bands`, bandForm);
      toast('Grade band created', 'success');
      resetBandForm();
      loadBands(activeScaleId);
    } catch (err) { toast(err.message || 'Failed to create band', 'error'); }
  }

  async function submitRule(e) {
    e.preventDefault();
    try {
      await apiPost('/school/exam/result-rules', ruleForm);
      toast('Result rule created', 'success');
      load();
    } catch (err) { toast(err.message || 'Failed to create rule', 'error'); }
  }

  return (
    <PageShell
      title="Grade Setup"
      icon="bi-award"
      subtitle="Grade scales, bands, and result calculation rules per academic year"
      onNavigate={onNavigate}
      actions={
        <button className="btn btn-sm btn-primary" onClick={() => setActiveTab('scales')}>Scales</button>
      }
    >
      <ErrorBox message={error} onRetry={load} />
      {loading ? <Loading /> : (
        <ul className="nav nav-pills nav-sm mb-3">
          {['scales', 'rules'].map((t) => (
            <li className="nav-item" key={t}><button className={`nav-link py-1 px-3 ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>{t === 'scales' ? 'Grade Scales & Bands' : 'Result Rules'}</button></li>
          ))}
        </ul>
      )}

      {activeTab === 'scales' && (
        <div className="row g-3">
          <div className="col-lg-4">
            <div className="border rounded p-3">
              <h6 className="fw-bold mb-3">Grade Scales</h6>
              <div className="mb-3">
                <select className="form-select form-select-sm" value={activeScaleId} onChange={(e) => { setActiveScaleId(e.target.value); loadBands(e.target.value); }}>
                  {scales.map((s) => <option key={s.id} value={s.id}>{s.name} (v{s.version})</option>)}
                </select>
              </div>
              <form onSubmit={submitScale}>
                <div className="mb-2"><label className="form-label small">Academic Year</label><select className="form-select form-select-sm" value={scaleForm.academicYearId} onChange={(e) => setScaleForm({ ...scaleForm, academicYearId: e.target.value })}><option value="">Select year</option>{years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></div>
                <div className="mb-2"><label className="form-label small">Name</label><input className="form-control form-control-sm" value={scaleForm.name} onChange={(e) => setScaleForm({ ...scaleForm, name: e.target.value })} placeholder="e.g. CBSE 2026" required /></div>
                <div className="mb-2"><label className="form-label small">Description</label><textarea className="form-control form-control-sm" rows={2} value={scaleForm.description} onChange={(e) => setScaleForm({ ...scaleForm, description: e.target.value })} /></div>
                <div className="mb-2"><label className="form-label small">Version</label><input type="number" className="form-control form-control-sm" value={scaleForm.version} onChange={(e) => setScaleForm({ ...scaleForm, version: Number(e.target.value) })} /></div>
                <button type="submit" className="btn btn-sm btn-primary">Create Scale</button>
              </form>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="border rounded">
              <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                <span className="fw-semibold small">Grade Bands {scales.find(s => String(s.id) === activeScaleId) ? `for ${scales.find(s => String(s.id) === activeScaleId).name}` : ''}</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadCsv('grade-bands.csv', [
                  { label: 'Class Band', key: 'class_band' },
                  { label: 'Min %', key: 'min_percent' },
                  { label: 'Max %', key: 'max_percent' },
                  { label: 'Grade', key: 'grade' },
                  { label: 'Grade Points', key: 'grade_points' },
                  { label: 'Remark', key: 'remark' },
                  { label: 'Sort', key: 'sort_order' },
                ], bands)} disabled={!bands.length}>
                  <i className="bi bi-download me-1"></i>CSV
                </button>
              </div>
              {bands.length === 0 ? <div className="p-3 text-center text-muted">No bands for this scale. Add bands below.</div> : (
                <div className="table-responsive">
                  <table className="table table-sm mb-0 align-middle"><thead><tr><th>Band</th><th>Range</th><th>Grade</th><th>Points</th><th>Remark</th><th>Sort</th><th className="text-end">Actions</th></tr></thead><tbody>
                    {bands.map((b) => <tr key={b.id}><td>{b.class_band}</td><td>{b.min_percent}% Ã¢â‚¬â€œ {b.max_percent}%</td><td><strong>{b.grade}</strong></td><td>{b.grade_points || 'Ã¢â‚¬â€'}</td><td className="small">{b.remark || 'Ã¢â‚¬â€'}</td><td>{b.sort_order}</td><td className="text-end"><button className="btn btn-sm btn-outline-danger" onClick={() => {}}>Delete</button></td></tr>)}
                  </tbody></table>
                </div>
              )}

              <div className="p-3 border-top">
                <h6 className="fw-bold mb-3">Add Band</h6>
                <form onSubmit={submitBand}>
                  <input type="hidden" name="scaleId" value={activeScaleId} />
                  <div className="row g-2 mb-2">
                    <div className="col-3"><label className="form-label small">Class Band</label><select className="form-select form-select-sm" value={bandForm.classBand} onChange={(e) => setBandForm({ ...bandForm, classBand: e.target.value })}>{CLASS_BANDS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="col-2"><label className="form-label small">Min %</label><input type="number" step="0.01" className="form-control form-control-sm" value={bandForm.minPercent} onChange={(e) => setBandForm({ ...bandForm, minPercent: e.target.value })} required /></div>
                    <div className="col-2"><label className="form-label small">Max %</label><input type="number" step="0.01" className="form-control form-control-sm" value={bandForm.maxPercent} onChange={(e) => setBandForm({ ...bandForm, maxPercent: e.target.value })} required /></div>
                    <div className="col-2"><label className="form-label small">Grade</label><input className="form-control form-control-sm" value={bandForm.grade} onChange={(e) => setBandForm({ ...bandForm, grade: e.target.value })} required /></div>
                    <div className="col-3"><label className="form-label small">Grade Points</label><input type="number" step="0.1" className="form-control form-control-sm" value={bandForm.gradePoints} onChange={(e) => setBandForm({ ...bandForm, gradePoints: e.target.value })} /></div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6"><label className="form-label small">Remark</label><input className="form-control form-control-sm" value={bandForm.remark} onChange={(e) => setBandForm({ ...bandForm, remark: e.target.value })} /></div>
                    <div className="col-2"><label className="form-label small">Sort</label><input type="number" className="form-control form-control-sm" value={bandForm.sortOrder} onChange={(e) => setBandForm({ ...bandForm, sortOrder: Number(e.target.value) })} /></div>
                    <div className="col-4 d-flex align-items-end"><button type="submit" className="btn btn-sm btn-primary">Add Band</button></div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="row g-3">
          <div className="col-lg-6">
            <div className="border rounded p-3">
              <h6 className="fw-bold mb-3">Result Rules</h6>
              <div className="mb-3">
                <select className="form-select form-select-sm" value={activeRuleId || ''} onChange={(e) => { setActiveRuleId(e.target.value); const r = rules.find(x => String(x.id) === e.target.value); if (r) setRuleForm(r); }}>
                  <option value="">Select rule to edit</option>
                  {rules.map((r) => <option key={r.id} value={r.id}>{r.class_band} (v{r.version})</option>)}
                </select>
              </div>
              <form onSubmit={submitRule}>
                <div className="row g-2 mb-2">
                  <div className="col-6"><label className="form-label small">Academic Year</label><select className="form-select form-select-sm" value={ruleForm.academicYearId} onChange={(e) => setRuleForm({ ...ruleForm, academicYearId: e.target.value })}>{years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></div>
                  <div className="col-3"><label className="form-label small">Class Band</label><select className="form-select form-select-sm" value={ruleForm.classBand} onChange={(e) => setRuleForm({ ...ruleForm, classBand: e.target.value })}>{CLASS_BANDS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="col-3"><label className="form-label small">Version</label><input type="number" className="form-control form-control-sm" value={ruleForm.version} onChange={(e) => setRuleForm({ ...ruleForm, version: Number(e.target.value) })} /></div>
                </div>
                <div className="mb-2"><label className="form-label small">Weightage Scheme (JSON)</label><textarea className="form-control form-control-sm font-monospace small" rows={3} value={JSON.stringify(ruleForm.weightageScheme, null, 2)} onChange={(e) => { try { setRuleForm({ ...ruleForm, weightageScheme: JSON.parse(e.target.value) }); } catch { } }} /></div>
                <div className="mb-2"><label className="form-label small">Best-of Rule (JSON)</label><textarea className="form-control form-control-sm font-monospace small" rows={2} value={JSON.stringify(ruleForm.bestOfRule, null, 2)} onChange={(e) => { try { setRuleForm({ ...ruleForm, bestOfRule: JSON.parse(e.target.value) }); } catch { } }} /></div>
                <div className="mb-2"><label className="form-label small">Pass Rule (JSON)</label><textarea className="form-control form-control-sm font-monospace small" rows={2} value={JSON.stringify(ruleForm.passRule, null, 2)} onChange={(e) => { try { setRuleForm({ ...ruleForm, passRule: JSON.parse(e.target.value) }); } catch { } }} /></div>
                <div className="mb-2"><label className="form-label small">Grace Rule (JSON)</label><textarea className="form-control form-control-sm font-monospace small" rows={2} value={JSON.stringify(ruleForm.graceRule, null, 2)} onChange={(e) => { try { setRuleForm({ ...ruleForm, graceRule: JSON.parse(e.target.value) }); } catch { } }} /></div>
                <div className="mb-2"><label className="form-label small">Rounding</label><select className="form-select form-select-sm" value={ruleForm.roundingRule} onChange={(e) => setRuleForm({ ...ruleForm, roundingRule: e.target.value })}>{ROUNDING_RULES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                <div className="row g-2 mb-2">
                  <div className="col-4"><label className="form-label small">Rank Enabled</label><select className="form-select form-select-sm" value={ruleForm.rankRule?.enabled ? 'true' : 'false'} onChange={(e) => setRuleForm({ ...ruleForm, rankRule: { ...ruleForm.rankRule, enabled: e.target.value === 'true' } })}><option value="true">Yes</option><option value="false">No</option></select></div>
                  <div className="col-4"><label className="form-label small">Tie Rule</label><select className="form-select form-select-sm" value={ruleForm.rankRule?.tie} onChange={(e) => setRuleForm({ ...ruleForm, rankRule: { ...ruleForm.rankRule, tie: e.target.value } })}>{TIE_RULES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div className="col-4"><label className="form-label small">Scope</label><select className="form-select form-select-sm" value={ruleForm.rankRule?.scope} onChange={(e) => setRuleForm({ ...ruleForm, rankRule: { ...ruleForm.rankRule, scope: e.target.value } })}><option value="section">Section</option><option value="class">Class</option><option value="school">School</option></select></div>
                </div>
                <button type="submit" className="btn btn-sm btn-primary">Save Rule</button>
              </form>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="border rounded p-3">
              <h6 className="fw-bold mb-3">Preview Calculator</h6>
              <div className="alert alert-info small">Enter sample marks to preview calculation result.</div>
              <div className="row g-2 mb-2">
                <div className="col-6"><input type="number" step="0.01" className="form-control form-control-sm" placeholder="Unit Test 1" /></div>
                <div className="col-6"><input type="number" step="0.01" className="form-control form-control-sm" placeholder="Unit Test 2" /></div>
                <div className="col-6"><input type="number" step="0.01" className="form-control form-control-sm" placeholder="Unit Test 3" /></div>
                <div className="col-6"><input type="number" step="0.01" className="form-control form-control-sm" placeholder="Half Yearly" /></div>
                <div className="col-6"><input type="number" step="0.01" className="form-control form-control-sm" placeholder="Annual" /></div>
              </div>
              <button className="btn btn-sm btn-outline-primary" disabled>Preview (Not Implemented)</button>
              <div className="small text-muted mt-2">Connects to backend /school/exam/result-rules/preview</div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
