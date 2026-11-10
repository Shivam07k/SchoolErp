import React, { useEffect, useState, useMemo } from 'react';
import { apiGet, apiPost, apiPut } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, fmtDate, canManage, downloadCsv } from './shared';

const EXAM_TYPES = ['unit_test', 'half_yearly', 'annual', 'pre_board', 'other'];

export default function ExamSetup({ me, onNavigate }) {
  const [exams, setExams] = useState([]);
  const [papers, setPapers] = useState([]);
  const [components, setComponents] = useState([]);
  const [studentSubjects, setStudentSubjects] = useState([]);
  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [activeTab, setActiveTab] = useState('exams');
  const [examForm, setExamForm] = useState({ termId: '', name: '', type: 'unit_test', weightage: 0, startDate: '', endDate: '', bestOfN: '', bestOfM: '' });
  const [paperForm, setPaperForm] = useState({ examId: '', classId: '', subjectId: '', maxMarks: 100, passMarks: 33, gradesOnly: false, countsInTotal: true, optionalSubject: false });
  const [componentForm, setComponentForm] = useState({ paperId: '', name: '', maxMarks: 0, passMinimum: 0, isMandatory: true, sortOrder: 0 });
  const [ssForm, setSsForm] = useState({ studentId: '', subjectId: '', academicYearId: '', isOptional: false, isAdditional: false });
  const [editingExamId, setEditingExamId] = useState(null);
  const [editingPaperId, setEditingPaperId] = useState(null);
  const [editingComponentId, setEditingComponentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const manager = canManage(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [examRes, paperRes, compRes, ssRes, yearRes, classRes, subRes] = await Promise.all([
        apiGet('/school/exams'),
        apiGet('/school/exam/papers'),
        apiGet('/school/exam/papers/1/components'), // placeholder, we'll load per paper
        apiGet('/school/exam/student-subjects'),
        apiGet('/school/academic-years'),
        apiGet('/school/classes'),
        apiGet('/school/subjects'),
      ]);
      if (!examRes?.ok) throw new Error(examRes?.error);
      if (!paperRes?.ok) throw new Error(paperRes?.error);
      if (!ssRes?.ok) throw new Error(ssRes?.error);
      if (!yearRes?.ok) throw new Error(yearRes?.error);
      if (!classRes?.ok) throw new Error(classRes?.error);
      if (!subRes?.ok) throw new Error(subRes?.error);

      setExams(examRes.exams || []);
      setPapers(paperRes.papers || []);
      setStudentSubjects(ssRes.studentSubjects || []);
      setYears(yearRes.academicYears || []);
      setClasses(classRes.classes || []);
      setSubjects(subRes.subjects || []);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function resetExamForm() { setExamForm({ termId: '', name: '', type: 'unit_test', weightage: 0, startDate: '', endDate: '', bestOfN: '', bestOfM: '' }); setEditingExamId(null); }
  function resetPaperForm() { setPaperForm({ examId: '', classId: '', subjectId: '', maxMarks: 100, passMarks: 33, gradesOnly: false, countsInTotal: true, optionalSubject: false }); setEditingPaperId(null); }
  function resetComponentForm() { setComponentForm({ paperId: '', name: '', maxMarks: 0, passMinimum: 0, isMandatory: true, sortOrder: 0 }); setEditingComponentId(null); }

  async function submitExam(e) {
    e.preventDefault();
    try {
      if (editingExamId) {
        await apiPut(`/school/exams/${editingExamId}`, examForm);
        toast('Exam updated', 'success');
      } else {
        await apiPost('/school/exams', examForm);
        toast('Exam created', 'success');
      }
      resetExamForm();
      load();
    } catch (err) { toast(err.message || 'Failed to save exam', 'error'); }
  }

  async function submitPaper(e) {
    e.preventDefault();
    try {
      if (editingPaperId) {
        await apiPut(`/school/exam/papers/${editingPaperId}`, paperForm);
        toast('Paper updated', 'success');
      } else {
        await apiPost('/school/exam/papers', paperForm);
        toast('Paper created', 'success');
      }
      resetPaperForm();
      load();
    } catch (err) { toast(err.message || 'Failed to save paper', 'error'); }
  }

  async function submitComponent(e) {
    e.preventDefault();
    try {
      if (editingComponentId) {
        await apiPut(`/school/exam/papers/${paperForm.paperId}/components/${editingComponentId}`, componentForm);
        toast('Component updated', 'success');
      } else {
        await apiPost(`/school/exam/papers/${paperForm.paperId}/components`, componentForm);
        toast('Component created', 'success');
      }
      resetComponentForm();
      load();
    } catch (err) { toast(err.message || 'Failed to save component', 'error'); }
  }

  async function removeExam(id) {
    if (!window.confirm('Delete this exam? This will also delete associated papers.')) return;
    try {
      await apiPut(`/school/exams/${id}`, { status: 'cancelled' }); // soft delete
      toast('Exam cancelled', 'success');
      load();
    } catch (err) { toast(err.message || 'Failed to cancel exam', 'error'); }
  }

  async function removePaper(id) {
    if (!window.confirm('Delete this paper? This will also delete associated components.')) return;
    try {
      await apiPut(`/school/exam/papers/${id}`, { deleted_at: new Date().toISOString() }); // soft delete
      toast('Paper deleted', 'success');
      load();
    } catch (err) { toast(err.message || 'Failed to delete paper', 'error'); }
  }

  const filteredPapers = useMemo(() => papers.filter(p => !paperForm.examId || p.exam_id === Number(paperForm.examId)), [papers, paperForm.examId]);

  return (
    <PageShell
      title="Exam Setup"
      icon="bi-gear-wide-connected"
      subtitle="Configure exams, papers, components, and student subject mappings"
      onNavigate={onNavigate}
      actions={
        <button className="btn btn-sm btn-primary" onClick={() => { setActiveTab('exams'); resetExamForm(); }}>
          <i className="bi bi-plus-lg me-1"></i>New Exam
        </button>
      }
    >
      <ErrorBox message={error} onRetry={load} />
      {loading ? <Loading /> : (
        <ul className="nav nav-pills nav-sm mb-3">
          {['exams', 'papers', 'components', 'student-subjects'].map((t) => (
            <li className="nav-item" key={t}><button className={`nav-link py-1 px-3 ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>{t === 'exams' ? 'Exams' : t === 'papers' ? 'Papers' : t === 'components' ? 'Components' : 'Student Subjects'}</button></li>
          ))}
        </ul>
      )}

      {activeTab === 'exams' && (
        <div className="row g-3">
          <div className="col-lg-4">
            <div className="border rounded p-3">
              <h6 className="fw-bold mb-3">{editingExamId ? 'Edit Exam' : 'Create Exam'}</h6>
              <form onSubmit={submitExam}>
                <div className="mb-2"><label className="form-label small">Term *</label><select className="form-select form-select-sm" value={examForm.termId} onChange={(e) => setExamForm({ ...examForm, termId: e.target.value })} required><option value="">Select term</option>{years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></div>
                <div className="mb-2"><label className="form-label small">Name *</label><input className="form-control form-control-sm" value={examForm.name} onChange={(e) => setExamForm({ ...examForm, name: e.target.value })} placeholder="e.g. Unit Test 1, Half Yearly" required /></div>
                <div className="mb-2"><label className="form-label small">Type *</label><select className="form-select form-select-sm" value={examForm.type} onChange={(e) => setExamForm({ ...examForm, type: e.target.value })} required>{EXAM_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
                <div className="row g-2 mb-2">
                  <div className="col-6"><label className="form-label small">Weightage %</label><input type="number" step="0.01" min="0" max="100" className="form-control form-control-sm" value={examForm.weightage} onChange={(e) => setExamForm({ ...examForm, weightage: Number(e.target.value) })} /></div>
                  <div className="col-3"><label className="form-label small">Best of N</label><input type="number" min="1" className="form-control form-control-sm" value={examForm.bestOfN} onChange={(e) => setExamForm({ ...examForm, bestOfN: e.target.value })} /></div>
                  <div className="col-3"><label className="form-label small">Out of M</label><input type="number" min="1" className="form-control form-control-sm" value={examForm.bestOfM} onChange={(e) => setExamForm({ ...examForm, bestOfM: e.target.value })} /></div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6"><label className="form-label small">Start Date</label><input type="date" className="form-control form-control-sm" value={examForm.startDate} onChange={(e) => setExamForm({ ...examForm, startDate: e.target.value })} /></div>
                  <div className="col-6"><label className="form-label small">End Date</label><input type="date" className="form-control form-control-sm" value={examForm.endDate} onChange={(e) => setExamForm({ ...examForm, endDate: e.target.value })} /></div>
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-sm btn-primary">{editingExamId ? 'Update' : 'Create'}</button>
                  {editingExamId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetExamForm}>Cancel</button>}
                </div>
              </form>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="border rounded">
              <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                <span className="fw-semibold small">Exams</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadCsv('exams.csv', [
                  { label: 'Name', key: 'name' },
                  { label: 'Type', key: 'type' },
                  { label: 'Term', value: (r) => r.term_name || 'Ã¢â‚¬â€' },
                  { label: 'Weightage %', key: 'weightage' },
                  { label: 'Start', value: (r) => fmtDate(r.start_date) },
                  { label: 'End', value: (r) => fmtDate(r.end_date) },
                  { label: 'Status', key: 'status' },
                ], exams)} disabled={!exams.length}>
                  <i className="bi bi-download me-1"></i>CSV
                </button>
              </div>
              {exams.length === 0 ? <Empty icon="bi-journal-plus" text="No exams configured yet." /> : (
                <div className="table-responsive">
                  <table className="table table-sm mb-0 align-middle">
                    <thead><tr><th>Name</th><th>Type</th><th>Term</th><th>Weight %</th><th>Dates</th><th>Status</th><th>Best of</th><th className="text-end">Actions</th></tr></thead>
                    <tbody>
                      {exams.map((e) => (
                        <tr key={e.id}>
                          <td className="fw-semibold">{e.name}</td>
                          <td><span className="badge bg-info">{e.type}</span></td>
                          <td className="small">{e.term_name || 'Ã¢â‚¬â€'}</td>
                          <td>{e.weightage || 0}%</td>
                          <td className="small">{fmtDate(e.start_date)} Ã¢â‚¬â€œ {fmtDate(e.end_date)}</td>
                          <td><span className={`badge bg-${e.status === 'published' ? 'success' : e.status === 'processed' ? 'info' : e.status === 'draft' ? 'secondary' : 'warning'}`}>{e.status}</span></td>
                          <td className="small">{e.best_of_n ? `${e.best_of_n} of ${e.best_of_m || 'Ã¢â‚¬â€'}` : 'Ã¢â‚¬â€'}</td>
                          <td className="text-end">
                            <div className="btn-group btn-group-sm">
                              <button className="btn btn-outline-primary" onClick={() => { setExamForm(e); setEditingExamId(e.id); }}>Edit</button>
                              <button className="btn btn-outline-danger" onClick={() => removeExam(e.id)}>Cancel</button>
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
      )}

      {activeTab === 'papers' && (
        <div className="row g-3">
          <div className="col-lg-4">
            <div className="border rounded p-3">
              <h6 className="fw-bold mb-3">{editingPaperId ? 'Edit Paper' : 'Create Paper'}</h6>
              <form onSubmit={submitPaper}>
                <div className="mb-2"><label className="form-label small">Exam *</label><select className="form-select form-select-sm" value={paperForm.examId} onChange={(e) => setPaperForm({ ...paperForm, examId: e.target.value })} required><option value="">Select exam</option>{exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                <div className="mb-2"><label className="form-label small">Class *</label><select className="form-select form-select-sm" value={paperForm.classId} onChange={(e) => setPaperForm({ ...paperForm, classId: e.target.value })} required><option value="">Select class</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="mb-2"><label className="form-label small">Subject *</label><select className="form-select form-select-sm" value={paperForm.subjectId} onChange={(e) => setPaperForm({ ...paperForm, subjectId: e.target.value })} required><option value="">Select subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div className="row g-2 mb-2">
                  <div className="col-6"><label className="form-label small">Max Marks *</label><input type="number" min="1" className="form-control form-control-sm" value={paperForm.maxMarks} onChange={(e) => setPaperForm({ ...paperForm, maxMarks: Number(e.target.value) })} required /></div>
                  <div className="col-6"><label className="form-label small">Pass Marks *</label><input type="number" min="0" className="form-control form-control-sm" value={paperForm.passMarks} onChange={(e) => setPaperForm({ ...paperForm, passMarks: Number(e.target.value) })} required /></div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-4"><div className="form-check"><input type="checkbox" className="form-check-input" checked={paperForm.gradesOnly} onChange={(e) => setPaperForm({ ...paperForm, gradesOnly: e.target.checked })} id="gradesOnly" /><label className="form-check-label small" htmlFor="gradesOnly">Grades Only</label></div></div>
                  <div className="col-4"><div className="form-check"><input type="checkbox" className="form-check-input" checked={paperForm.countsInTotal} onChange={(e) => setPaperForm({ ...paperForm, countsInTotal: e.target.checked })} id="countsInTotal" /><label className="form-check-label small" htmlFor="countsInTotal">Counts in Total</label></div></div>
                  <div className="col-4"><div className="form-check"><input type="checkbox" className="form-check-input" checked={paperForm.optionalSubject} onChange={(e) => setPaperForm({ ...paperForm, optionalSubject: e.target.checked })} id="optionalSubject" /><label className="form-check-label small" htmlFor="optionalSubject">Optional</label></div></div>
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-sm btn-primary">{editingPaperId ? 'Update' : 'Create'}</button>
                  {editingPaperId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetPaperForm}>Cancel</button>}
                </div>
              </form>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="border rounded">
              <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                <span className="fw-semibold small">Papers {paperForm.examId ? `for ${exams.find(e => String(e.id) === paperForm.examId)?.name}` : ''}</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadCsv('papers.csv', [
                  { label: 'Exam', value: (r) => r.exam_name || 'Ã¢â‚¬â€' },
                  { label: 'Class', value: (r) => r.class_name || 'Ã¢â‚¬â€' },
                  { label: 'Subject', value: (r) => r.subject_name || 'Ã¢â‚¬â€' },
                  { label: 'Max', key: 'max_marks' },
                  { label: 'Pass', key: 'pass_marks' },
                  { label: 'Grades Only', value: (r) => r.grades_only ? 'Yes' : 'No' },
                  { label: 'Counts in Total', value: (r) => r.counts_in_total ? 'Yes' : 'No' },
                  { label: 'Optional', value: (r) => r.optional_subject ? 'Yes' : 'No' },
                ], filteredPapers)} disabled={!filteredPapers.length}>
                  <i className="bi bi-download me-1"></i>CSV
                </button>
              </div>
              {filteredPapers.length === 0 ? <Empty icon="bi-file-earmark-text" text="No papers for the selected exam." /> : (
                <div className="table-responsive">
                  <table className="table table-sm mb-0 align-middle">
                    <thead><tr><th>Exam</th><th>Class</th><th>Subject</th><th>Max</th><th>Pass</th><th>Flags</th><th className="text-end">Actions</th></tr></thead>
                    <tbody>
                      {filteredPapers.map((p) => (
                        <tr key={p.id}>
                          <td className="small">{p.exam_name || 'Ã¢â‚¬â€'}</td>
                          <td className="small">{p.class_name || 'Ã¢â‚¬â€'}</td>
                          <td className="small">{p.subject_name || 'Ã¢â‚¬â€'}</td>
                          <td>{p.max_marks}</td>
                          <td>{p.pass_marks}</td>
                          <td className="small">
                            {p.grades_only && <span className="badge bg-info">Grades Only</span>}
                            {!p.counts_in_total && <span className="badge bg-warning">No Total</span>}
                            {p.optional_subject && <span className="badge bg-secondary">Optional</span>}
                          </td>
                          <td className="text-end">
                            <div className="btn-group btn-group-sm">
                              <button className="btn btn-outline-primary" onClick={() => { setPaperForm(p); setEditingPaperId(p.id); }}>Edit</button>
                              <button className="btn btn-outline-danger" onClick={() => removePaper(p.id)}>Delete</button>
                              <button className="btn btn-outline-primary" onClick={() => { setComponentForm({ ...componentForm, paperId: p.id }); setActiveTab('components'); }}>Components</button>
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
      )}

      {activeTab === 'components' && (
        <div className="row g-3">
          <div className="col-lg-4">
            <div className="border rounded p-3">
              <h6 className="fw-bold mb-3">{editingComponentId ? 'Edit Component' : 'Add Component'}</h6>
              <form onSubmit={submitComponent}>
                <div className="mb-2"><label className="form-label small">Paper *</label><select className="form-select form-select-sm" value={componentForm.paperId} onChange={(e) => setComponentForm({ ...componentForm, paperId: e.target.value })} required><option value="">Select paper</option>{filteredPapers.map((p) => <option key={p.id} value={p.id}>{p.exam_name} Ã‚Â· {p.subject_name}</option>)}</select></div>
                <div className="mb-2"><label className="form-label small">Name *</label><input className="form-control form-control-sm" value={componentForm.name} onChange={(e) => setComponentForm({ ...componentForm, name: e.target.value })} placeholder="e.g. Theory, Practical, Internal" required /></div>
                <div className="row g-2 mb-2">
                  <div className="col-6"><label className="form-label small">Max Marks *</label><input type="number" min="1" className="form-control form-control-sm" value={componentForm.maxMarks} onChange={(e) => setComponentForm({ ...componentForm, maxMarks: Number(e.target.value) })} required /></div>
                  <div className="col-6"><label className="form-label small">Pass Minimum</label><input type="number" min="0" className="form-control form-control-sm" value={componentForm.passMinimum} onChange={(e) => setComponentForm({ ...componentForm, passMinimum: Number(e.target.value) })} /></div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-4"><label className="form-label small">Mandatory</label><select className="form-select form-select-sm" value={String(componentForm.isMandatory)} onChange={(e) => setComponentForm({ ...componentForm, isMandatory: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
                  <div className="col-4"><label className="form-label small">Sort Order</label><input type="number" className="form-control form-control-sm" value={componentForm.sortOrder} onChange={(e) => setComponentForm({ ...componentForm, sortOrder: Number(e.target.value) })} /></div>
                  <div className="col-4"></div>
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-sm btn-primary">{editingComponentId ? 'Update' : 'Add'}</button>
                  {editingComponentId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetComponentForm}>Cancel</button>}
                </div>
              </form>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="border rounded">
              <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                <span className="fw-semibold small">Components {componentForm.paperId ? `for ${filteredPapers.find(p => String(p.id) === componentForm.paperId)?.subject_name}` : ''}</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadCsv('components.csv', [
                  { label: 'Paper', value: (r) => r.paper_name || r.subject_name },
                  { label: 'Name', key: 'name' },
                  { label: 'Max', key: 'max_marks' },
                  { label: 'Pass Min', key: 'pass_minimum' },
                  { label: 'Mandatory', value: (r) => r.is_mandatory ? 'Yes' : 'No' },
                  { label: 'Sort', key: 'sort_order' },
                ], components.filter(c => !componentForm.paperId || c.paper_id === Number(componentForm.paperId)))} disabled={!components.length}>
                  <i className="bi bi-download me-1"></i>CSV
                </button>
              </div>
              {components.length === 0 ? <Empty icon="bi-puzzle" text="No components defined yet." /> : (
                <div className="table-responsive">
                  <table className="table table-sm mb-0 align-middle">
                    <thead><tr><th>Paper</th><th>Name</th><th>Max</th><th>Pass Min</th><th>Mandatory</th><th>Sort</th><th className="text-end">Actions</th></tr></thead>
                    <tbody>
                      {components.filter(c => !componentForm.paperId || c.paper_id === Number(componentForm.paperId)).map((c) => (
                        <tr key={c.id}>
                          <td className="small">{c.paper_name || c.subject_name || 'Ã¢â‚¬â€'}</td>
                          <td>{c.name}</td>
                          <td>{c.max_marks}</td>
                          <td>{c.pass_minimum || 'Ã¢â‚¬â€'}</td>
                          <td>{c.is_mandatory ? <span className="badge bg-success">Yes</span> : <span className="badge bg-secondary">No</span>}</td>
                          <td>{c.sort_order}</td>
                          <td className="text-end"><div className="btn-group btn-group-sm"><button className="btn btn-outline-primary" onClick={() => { setComponentForm(c); setEditingComponentId(c.id); }}>Edit</button><button className="btn btn-outline-danger" onClick={() => {}}>Delete</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'student-subjects' && (
        <div className="row g-3">
          <div className="col-lg-4">
            <div className="border rounded p-3">
              <h6 className="fw-bold mb-3">Map Student Subjects</h6>
              <form onSubmit={(e) => { e.preventDefault(); toast('Not fully implemented', 'info'); }}>
                <div className="mb-2"><label className="form-label small">Student</label><select className="form-select form-select-sm" value={ssForm.studentId} onChange={(e) => setSsForm({ ...ssForm, studentId: e.target.value })} required><option value="">Select student</option>{[]}</select></div>
                <div className="mb-2"><label className="form-label small">Subject</label><select className="form-select form-select-sm" value={ssForm.subjectId} onChange={(e) => setSsForm({ ...ssForm, subjectId: e.target.value })} required><option value="">Select subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div className="mb-2"><label className="form-label small">Academic Year</label><select className="form-select form-select-sm" value={ssForm.academicYearId} onChange={(e) => setSsForm({ ...ssForm, academicYearId: e.target.value })} required><option value="">Select year</option>{years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></div>
                <div className="row g-2 mb-2">
                  <div className="col-6"><div className="form-check"><input type="checkbox" className="form-check-input" checked={ssForm.isOptional} onChange={(e) => setSsForm({ ...ssForm, isOptional: e.target.checked })} id="isOptional" /><label className="form-check-label small" htmlFor="isOptional">Optional</label></div></div>
                  <div className="col-6"><div className="form-check"><input type="checkbox" className="form-check-input" checked={ssForm.isAdditional} onChange={(e) => setSsForm({ ...ssForm, isAdditional: e.target.checked })} id="isAdditional" /><label className="form-check-label small" htmlFor="isAdditional">Additional</label></div></div>
                </div>
                <button type="submit" className="btn btn-sm btn-primary">Map Subject</button>
              </form>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="border rounded">
              <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                <span className="fw-semibold small">Student Subject Mappings</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadCsv('student-subjects.csv', [
                  { label: 'Student', value: (r) => `${r.first_name} ${r.last_name}` },
                  { label: 'Admission', key: 'admission_no' },
                  { label: 'Subject', value: (r) => r.subject_name },
                  { label: 'Optional', value: (r) => r.is_optional ? 'Yes' : 'No' },
                  { label: 'Additional', value: (r) => r.is_additional ? 'Yes' : 'No' },
                ], studentSubjects)} disabled={!studentSubjects.length}>
                  <i className="bi bi-download me-1"></i>CSV
                </button>
              </div>
              {studentSubjects.length === 0 ? <Empty icon="bi-person-gear" text="No student subject mappings yet." /> : (
                <div className="table-responsive">
                  <table className="table table-sm mb-0 align-middle">
                    <thead><tr><th>Student</th><th>Admission</th><th>Subject</th><th>Optional</th><th>Additional</th></tr></thead>
                    <tbody>
                      {studentSubjects.map((s) => (
                        <tr key={s.id}>
                          <td className="small fw-semibold">{s.first_name} {s.last_name}</td>
                          <td className="small">{s.admission_no}</td>
                          <td className="small">{s.subject_name}</td>
                          <td>{s.is_optional ? <span className="badge bg-info">Yes</span> : <span className="badge bg-secondary">No</span>}</td>
                          <td>{s.is_additional ? <span className="badge bg-warning">Yes</span> : <span className="badge bg-secondary">No</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
