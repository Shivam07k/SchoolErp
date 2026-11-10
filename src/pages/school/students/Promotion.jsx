import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import PrintButton from '../../../components/PrintButton';

const emptyForm = {
  fromClassId: '', fromSectionId: '', toClassId: '', toSectionId: '',
  fromAcademicYearId: '', toAcademicYearId: '',
};

export default function Promotion({ onBack, academicYears = [] }) {
  const [classes, setClasses] = useState([]);
  const [runs, setRuns] = useState([]);
  const [items, setItems] = useState([]);
  const [runId, setRunId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const sourceSections = classes.find((item) => String(item.id) === String(form.fromClassId))?.sections || [];
  const targetSections = classes.find((item) => String(item.id) === String(form.toClassId))?.sections || [];
  const selectedRun = runs.find((item) => String(item.id) === String(runId));

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet('/school/classes'),
      apiGet('/school/promotions/runs'),
    ]).then(([classResult, runResult]) => {
      const failed = [classResult, runResult].find((result) => !result?.ok);
      if (failed) throw new Error(failed.error || 'Could not load promotion data');
      if (!active) return;
      setClasses(classResult.classes || []);
      setRuns(runResult.runs || []);
    }).catch((error) => {
      if (active) toast(error.message, 'error');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setItems([]);
    if (!runId) {
      return () => { active = false; };
    }
    apiGet(`/school/promotions/runs/${runId}/items`).then((result) => {
      if (!result?.ok) throw new Error(result?.error || 'Could not load promotion items');
      if (active) setItems(result.items || []);
    }).catch((error) => {
      if (active) toast(error.message, 'error');
    });
    return () => { active = false; };
  }, [runId, reloadKey]);

  const refreshRuns = async () => {
    const result = await apiGet('/school/promotions/runs');
    if (!result?.ok) throw new Error(result?.error || 'Could not refresh promotion runs');
    setRuns(result.runs || []);
  };

  const createRun = async () => {
    if (!form.fromAcademicYearId || !form.toAcademicYearId || !form.fromClassId || !form.toClassId) {
      return toast('Source and target years and classes are required', 'error');
    }
    if (form.fromAcademicYearId === form.toAcademicYearId) return toast('Choose different source and target academic years', 'error');
    setBusy(true);
    let runCreated = false;
    try {
      const result = await apiPost('/school/promotions/runs', form);
      if (!result?.ok) throw new Error(result?.error || 'Could not create promotion run');
      runCreated = true;
      if (result.run?.id) {
        setRuns((current) => [result.run, ...current.filter((run) => run.id !== result.run.id)]);
        setRunId(String(result.run.id));
        toast('Promotion run created', 'success');
      } else {
        toast('Promotion run created, but the server did not return its ID for selection.', 'warning');
      }
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
    if (runCreated) {
      try {
        await refreshRuns();
      } catch (error) {
        toast(`Promotion run created, but the run list could not be refreshed: ${error.message}`, 'warning');
      }
    }
  };

  const generate = async () => {
    if (!runId) return toast('Select a promotion run', 'error');
    setBusy(true);
    try {
      const result = await apiPost(`/school/promotions/runs/${runId}/generate`, {});
      if (!result?.ok) throw new Error(result?.error || 'Could not generate promotion list');
      toast('Promotion list generated', 'success');
      setReloadKey((value) => value + 1);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const promoteAll = async () => {
    if (!runId || !items.length) return toast('Select a run with generated students', 'error');
    if (!window.confirm(`Apply promotion results to ${items.length} students? This updates their current enrollment.`)) return;
    setBusy(true);
    let applied = false;
    try {
      const result = await apiPost(`/school/promotions/runs/${runId}/promote`, {
        items: items.map((item) => ({
          studentId: item.student_id,
          result: item.result || (item.blocked ? 'detained' : 'promoted'),
        })),
      });
      if (!result?.ok) throw new Error(result?.error || 'Could not apply promotion results');
      toast(`Promoted ${result.promoted}; detained ${result.detained}`, 'success');
      applied = true;
      setRuns((current) => current.map((run) => (
        String(run.id) === String(runId) ? { ...run, status: 'executed' } : run
      )));
      setReloadKey((value) => value + 1);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
    if (applied) {
      try {
        await refreshRuns();
      } catch (error) {
        toast(`Promotion results were applied, but the run list could not be refreshed: ${error.message}`, 'warning');
      }
    }
  };

  const setResult = (studentId, result) => setItems((current) => current.map((item) => (
    item.student_id === studentId ? { ...item, result } : item
  )));

  const runLabel = (run) => {
    const from = classes.find((item) => String(item.id) === String(run.from_class_id))?.name || `Class ${run.from_class_id}`;
    const to = classes.find((item) => String(item.id) === String(run.to_class_id))?.name || `Class ${run.to_class_id}`;
    return `Run #${run.id} Ã‚Â· ${from} to ${to} Ã‚Â· ${run.status}`;
  };

  return (
    <div className="page-content animate-fade" id="promotion-print-target">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="card-title mb-0"><i className="bi bi-arrow-up-circle me-2"></i>Promotion</div>
          <div className="d-flex gap-2">
            <PrintButton targetId="promotion-print-target" />
            <button className="btn btn-sm btn-outline-secondary no-print" onClick={onBack}><i className="bi bi-arrow-left"></i> Back</button>
          </div>
        </div>
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-2"><label className="form-label">From Year *</label><select className="form-select form-select-sm" value={form.fromAcademicYearId} onChange={(e) => setForm({ ...form, fromAcademicYearId: e.target.value })}><option value="">Choose year</option>{academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></div>
            <div className="col-md-2"><label className="form-label">To Year *</label><select className="form-select form-select-sm" value={form.toAcademicYearId} onChange={(e) => setForm({ ...form, toAcademicYearId: e.target.value })}><option value="">Choose year</option>{academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></div>
            <div className="col-md-2"><label className="form-label">From Class *</label><select className="form-select form-select-sm" value={form.fromClassId} onChange={(e) => setForm({ ...form, fromClassId: e.target.value, fromSectionId: '' })}><option value="">Choose class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="col-md-2"><label className="form-label">From Section</label><select className="form-select form-select-sm" value={form.fromSectionId} disabled={!form.fromClassId} onChange={(e) => setForm({ ...form, fromSectionId: e.target.value })}><option value="">All sections</option>{sourceSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></div>
            <div className="col-md-2"><label className="form-label">To Class *</label><select className="form-select form-select-sm" value={form.toClassId} onChange={(e) => setForm({ ...form, toClassId: e.target.value, toSectionId: '' })}><option value="">Choose class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="col-md-2"><label className="form-label">To Section</label><select className="form-select form-select-sm" value={form.toSectionId} disabled={!form.toClassId} onChange={(e) => setForm({ ...form, toSectionId: e.target.value })}><option value="">Default section</option>{targetSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></div>
          </div>
          <button className="btn btn-sm btn-primary mt-2" onClick={createRun} disabled={busy}><i className="bi bi-plus"></i> Create Promotion Run</button>
          <div className="row g-2 mt-3">
            <div className="col-md-5"><label className="form-label">Select Run</label><select className="form-select form-select-sm" value={runId} onChange={(e) => setRunId(e.target.value)}><option value="">Choose run</option>{runs.map((run) => <option key={run.id} value={run.id}>{runLabel(run)}</option>)}</select></div>
            <div className="col-md-2 d-flex align-items-end"><button className="btn btn-sm btn-outline-primary" onClick={generate} disabled={busy || !runId || selectedRun?.status !== 'draft'}>Generate List</button></div>
            <div className="col-md-3 d-flex align-items-end"><button className="btn btn-sm btn-success" onClick={promoteAll} disabled={busy || !runId || !items.length || selectedRun?.status !== 'draft'}>Apply Promotion Results</button></div>
          </div>
          <div className="table-responsive mt-3">
            <table className="table table-sm">
              <thead><tr><th>Student</th><th>Admission No</th><th>Fee Dues</th><th>Blocked</th><th>Result</th></tr></thead>
              <tbody>
                {items.map((item) => <tr key={item.id}>
                  <td>{item.first_name} {item.last_name}</td><td>{item.admission_no}</td><td>{item.fee_dues}</td><td>{item.blocked ? item.block_reason || 'Yes' : 'No'}</td>
                  <td><select className="form-select form-select-sm" value={item.result || (item.blocked ? 'detained' : 'promoted')} onChange={(e) => setResult(item.student_id, e.target.value)}>
                    <option value="promoted" disabled={item.blocked}>Promoted</option><option value="detained">Detained</option>
                  </select></td>
                </tr>)}
                {!items.length && <tr><td colSpan="5" className="text-muted">No students in this promotion run</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

