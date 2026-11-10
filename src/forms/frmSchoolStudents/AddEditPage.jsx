import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../api';
import { toast } from '../../toast';

function AddEditPage({ formId, config, id, onBack, onSaved }) {
  const apiSave = config?.api?.save || '/school/students';
  const apiUpdate = (config?.api?.update || '/school/students/:id').replace(':id', id || '');
  const [form, setForm] = useState({
    admissionNo: '', firstName: '', middleName: '', lastName: '', gender: '', dob: '',
    classId: '', sectionId: '', rollNo: '', admissionDate: new Date().toISOString().slice(0,10), status: 'active',
    guardianName: '', guardianPhone: '', guardianEmail: '', address: '',
    bloodGroup: '', nationality: '', category: '', previousSchool: '', nationalId: '', house: '', campusId: ''
  });
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await apiGet('/school/classes');
        if (d?.ok) setClasses(d.classes || []);
      } catch {}
      if (id) {
        try {
          const r = await apiGet(`/school/students/${id}`);
          const s = r?.student;
          if (s) {
            setForm({
              admissionNo: s.admission_no || '', firstName: s.first_name || '', middleName: s.middle_name || '', lastName: s.last_name || '',
              gender: s.gender || '', dob: s.dob ? String(s.dob).slice(0,10) : '',
              classId: s.class_id || '', sectionId: s.section_id || '', rollNo: s.roll_no || '',
              admissionDate: s.admission_date ? String(s.admission_date).slice(0,10) : new Date().toISOString().slice(0,10), status: s.status || 'active',
              guardianName: s.guardian_name || '', guardianPhone: s.guardian_phone || '', guardianEmail: s.guardian_email || '', address: s.address || '',
              bloodGroup: s.blood_group || '', nationality: s.nationality || '', category: s.category || '', previousSchool: s.previous_school || '',
              nationalId: s.national_id || '', house: s.house || '', campusId: s.campus_id || ''
            });
          }
        } catch {}
      }
    })();
  }, [id]);

  const classOptions = classes.map((c) => ({ id: c.id, name: c.name, sections: c.sections || [] }));
  const sectionOptions = classOptions.find((c) => String(c.id) === String(form.classId))?.sections || [];

  const submit = async (e) => {
    e.preventDefault();
    if (!form.firstName?.trim()) return toast('First name is required', 'error');
    setLoading(true);
    try {
      const body = { ...form };
      if (!body.classId) body.classId = null;
      if (!body.sectionId) body.sectionId = null;
      const res = id ? await apiPut(apiUpdate, body) : await apiPost(apiSave, body);
      if (res?.ok) { toast(id ? 'Student updated' : 'Student admitted', 'success'); onSaved ? onSaved(res) : onBack(); }
      else toast(res?.error || 'Could not save', 'error');
    } catch (err) { toast(err.message || 'Could not save', 'error'); }
    finally { setLoading(false); }
  };

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="page-content animate-fade">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="card-title mb-0"><i className="bi bi-person-plus me-2"></i>{id ? 'Edit Student' : 'New Admission'}</div>
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-outline-secondary" onClick={onBack}><i className="bi bi-arrow-left"></i> Back</button>
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="card-body">
            <h6 className="mb-3">Student Details</h6>
            <div className="row g-2">
              <div className="col-md-3"><label className="form-label">Admission No</label><input className="form-control form-control-sm" value={form.admissionNo} onChange={(e)=>change('admissionNo',e.target.value)} placeholder="Auto if blank" /></div>
              <div className="col-md-3"><label className="form-label">First Name *</label><input className="form-control form-control-sm" value={form.firstName} onChange={(e)=>change('firstName',e.target.value)} required /></div>
              <div className="col-md-3"><label className="form-label">Middle Name</label><input className="form-control form-control-sm" value={form.middleName} onChange={(e)=>change('middleName',e.target.value)} /></div>
              <div className="col-md-3"><label className="form-label">Last Name</label><input className="form-control form-control-sm" value={form.lastName} onChange={(e)=>change('lastName',e.target.value)} /></div>
              <div className="col-md-2"><label className="form-label">Gender</label><select className="form-select form-select-sm" value={form.gender} onChange={(e)=>change('gender',e.target.value)}><option value="">-</option><option>Male</option><option>Female</option><option>Other</option></select></div>
              <div className="col-md-2"><label className="form-label">DOB</label><input type="date" className="form-control form-control-sm" value={form.dob} onChange={(e)=>change('dob',e.target.value)} /></div>
              <div className="col-md-2"><label className="form-label">Blood Group</label><input className="form-control form-control-sm" value={form.bloodGroup} onChange={(e)=>change('bloodGroup',e.target.value)} /></div>
              <div className="col-md-2"><label className="form-label">Nationality</label><input className="form-control form-control-sm" value={form.nationality} onChange={(e)=>change('nationality',e.target.value)} /></div>
              <div className="col-md-2"><label className="form-label">Category</label><input className="form-control form-control-sm" value={form.category} onChange={(e)=>change('category',e.target.value)} /></div>
              <div className="col-md-2"><label className="form-label">House</label><input className="form-control form-control-sm" value={form.house} onChange={(e)=>change('house',e.target.value)} /></div>
              <div className="col-md-3"><label className="form-label">National ID</label><input className="form-control form-control-sm" value={form.nationalId} onChange={(e)=>change('nationalId',e.target.value)} /></div>
              <div className="col-md-3"><label className="form-label">Previous School</label><input className="form-control form-control-sm" value={form.previousSchool} onChange={(e)=>change('previousSchool',e.target.value)} /></div>
            </div>
            <h6 className="mt-4 mb-3">Academic</h6>
            <div className="row g-2">
              <div className="col-md-3"><label className="form-label">Class</label><select className="form-select form-select-sm" value={form.classId} onChange={(e)=>change('classId',e.target.value)}><option value="">Unassigned</option>{classOptions.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="col-md-3"><label className="form-label">Section</label><select className="form-select form-select-sm" value={form.sectionId} onChange={(e)=>change('sectionId',e.target.value)}><option value="">-</option>{sectionOptions.map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="col-md-2"><label className="form-label">Roll No</label><input className="form-control form-control-sm" value={form.rollNo} onChange={(e)=>change('rollNo',e.target.value)} /></div>
              <div className="col-md-2"><label className="form-label">Admission Date</label><input type="date" className="form-control form-control-sm" value={form.admissionDate} onChange={(e)=>change('admissionDate',e.target.value)} /></div>
              <div className="col-md-2"><label className="form-label">Status</label><select className="form-select form-select-sm" value={form.status} onChange={(e)=>change('status',e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="graduated">Graduated</option></select></div>
            </div>
            <h6 className="mt-4 mb-3">Guardian</h6>
            <div className="row g-2">
              <div className="col-md-4"><label className="form-label">Guardian Name</label><input className="form-control form-control-sm" value={form.guardianName} onChange={(e)=>change('guardianName',e.target.value)} /></div>
              <div className="col-md-4"><label className="form-label">Guardian Phone</label><input className="form-control form-control-sm" value={form.guardianPhone} onChange={(e)=>change('guardianPhone',e.target.value)} /></div>
              <div className="col-md-4"><label className="form-label">Guardian Email</label><input type="email" className="form-control form-control-sm" value={form.guardianEmail} onChange={(e)=>change('guardianEmail',e.target.value)} /></div>
              <div className="col-12"><label className="form-label">Address</label><textarea className="form-control form-control-sm" rows={2} value={form.address} onChange={(e)=>change('address',e.target.value)} /></div>
            </div>
          </div>
          <div className="card-footer d-flex gap-2">
            <button className="btn btn-sm btn-primary" disabled={loading}><i className="bi bi-check-lg"></i> {loading ? 'Saving...' : 'Save'}</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onBack}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEditPage;
