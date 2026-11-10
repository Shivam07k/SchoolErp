import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../api';
import { toast } from '../../toast';

function ListPage({ formId, config, onEdit, onAdd }) {
  const TITLE = config?.title || 'Classes & Sections';
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classDraft, setClassDraft] = useState({ name: '', stream: '', sortOrder: '' });
  const [sectionDraft, setSectionDraft] = useState({ classId: '', name: 'A', capacity: 40, classTeacher: '' });
  const [subjectDraft, setSubjectDraft] = useState({ code: '', name: '', classId: '', maxMarks: 100 });

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiGet('/school/classes');
      if (d?.ok) { setClasses(d.classes || []); setSubjects(d.subjects || []); }
    } catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addClass = async (e) => {
    e.preventDefault();
    if (!classDraft.name?.trim()) return toast('Class name required', 'error');
    const res = await apiPost('/school/classes', { name: classDraft.name, stream: classDraft.stream, sortOrder: classDraft.sortOrder });
    if (res?.ok) { toast('Class added', 'success'); setClassDraft({ name: '', stream: '', sortOrder: '' }); load(); }
    else toast(res?.error || 'Failed', 'error');
  };

  const addSection = async (e) => {
    e.preventDefault();
    if (!sectionDraft.classId || !sectionDraft.name?.trim()) return toast('Class and section required', 'error');
    const res = await apiPost('/school/sections', { classId: sectionDraft.classId, name: sectionDraft.name, capacity: sectionDraft.capacity, classTeacher: sectionDraft.classTeacher });
    if (res?.ok) { toast('Section added', 'success'); setSectionDraft({ ...sectionDraft, name: 'A' }); load(); }
    else toast(res?.error || 'Failed', 'error');
  };

  const addSubject = async (e) => {
    e.preventDefault();
    if (!subjectDraft.name?.trim()) return toast('Subject name required', 'error');
    const res = await apiPost('/school/subjects', subjectDraft);
    if (res?.ok) { toast('Subject added', 'success'); setSubjectDraft({ code: '', name: '', classId: '', maxMarks: 100 }); load(); }
    else toast(res?.error || 'Failed', 'error');
  };

  return (
    <div className="page-content animate-fade">
      <div className="card mb-3">
        <div className="card-header"><div className="card-title mb-0"><i className="bi bi-diagram-3 me-2"></i>{TITLE}</div></div>
      </div>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header"><strong>Add Class</strong></div>
            <form onSubmit={addClass}><div className="card-body row g-2">
              <div className="col-12"><label className="form-label">Name</label><input className="form-control form-control-sm" value={classDraft.name} onChange={(e)=>setClassDraft({...classDraft,name:e.target.value})} /></div>
              <div className="col-6"><label className="form-label">Stream</label><input className="form-control form-control-sm" value={classDraft.stream} onChange={(e)=>setClassDraft({...classDraft,stream:e.target.value})} /></div>
              <div className="col-6"><label className="form-label">Sort Order</label><input className="form-control form-control-sm" type="number" value={classDraft.sortOrder} onChange={(e)=>setClassDraft({...classDraft,sortOrder:e.target.value})} /></div>
            </div><div className="card-footer"><button className="btn btn-sm btn-primary">Add Class</button></div></form>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header"><strong>Add Section</strong></div>
            <form onSubmit={addSection}><div className="card-body row g-2">
              <div className="col-12"><label className="form-label">Class</label><select className="form-select form-select-sm" value={sectionDraft.classId} onChange={(e)=>setSectionDraft({...sectionDraft,classId:e.target.value})}><option value="">Select</option>{classes.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="col-6"><label className="form-label">Section</label><input className="form-control form-control-sm" value={sectionDraft.name} onChange={(e)=>setSectionDraft({...sectionDraft,name:e.target.value})} /></div>
              <div className="col-6"><label className="form-label">Capacity</label><input className="form-control form-control-sm" type="number" value={sectionDraft.capacity} onChange={(e)=>setSectionDraft({...sectionDraft,capacity:e.target.value})} /></div>
              <div className="col-12"><label className="form-label">Class Teacher</label><input className="form-control form-control-sm" value={sectionDraft.classTeacher} onChange={(e)=>setSectionDraft({...sectionDraft,classTeacher:e.target.value})} /></div>
            </div><div className="card-footer"><button className="btn btn-sm btn-primary">Add Section</button></div></form>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header"><strong>Add Subject</strong></div>
            <form onSubmit={addSubject}><div className="card-body row g-2">
              <div className="col-6"><label className="form-label">Code</label><input className="form-control form-control-sm" value={subjectDraft.code} onChange={(e)=>setSubjectDraft({...subjectDraft,code:e.target.value})} /></div>
              <div className="col-6"><label className="form-label">Name</label><input className="form-control form-control-sm" value={subjectDraft.name} onChange={(e)=>setSubjectDraft({...subjectDraft,name:e.target.value})} /></div>
              <div className="col-6"><label className="form-label">Class (optional)</label><select className="form-select form-select-sm" value={subjectDraft.classId} onChange={(e)=>setSubjectDraft({...subjectDraft,classId:e.target.value})}><option value="">All</option>{classes.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="col-6"><label className="form-label">Max Marks</label><input className="form-control form-control-sm" type="number" value={subjectDraft.maxMarks} onChange={(e)=>setSubjectDraft({...subjectDraft,maxMarks:e.target.value})} /></div>
            </div><div className="card-footer"><button className="btn btn-sm btn-primary">Add Subject</button></div></form>
          </div>
        </div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between"><strong>Classes</strong><button className="btn btn-sm btn-outline-secondary" onClick={load} disabled={loading}><i className={`bi bi-arrow-clockwise ${loading?'spin':''}`}></i></button></div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead><tr><th>Name</th><th>Stream</th><th>Sort</th><th>Sections</th></tr></thead>
                <tbody>
                  {classes.map((c)=>(
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.stream||'-'}</td>
                      <td>{c.sort_order||'-'}</td>
                      <td>{(c.sections||[]).map((s)=>s.name).join(', ')||'-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header"><strong>Subjects</strong></div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead><tr><th>Code</th><th>Name</th><th>Class</th><th>Max</th></tr></thead>
                <tbody>
                  {subjects.map((s)=>(
                    <tr key={s.id}>
                      <td><code>{s.code||'-'}</code></td>
                      <td>{s.name}</td>
                      <td>{s.class_name||'All'}</td>
                      <td>{s.max_marks||100}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ListPage;
