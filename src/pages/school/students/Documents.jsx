import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiUpload, openApiFile } from '../../../api';
import { toast } from '../../../toast';
import PrintButton from '../../../components/PrintButton';
import StudentClassPicker from '../../../components/StudentClassPicker';

export default function Documents({ onBack }) {
  const [students, setStudents] = useState([]);
  const [docs, setDocs] = useState([]);
  const [missing, setMissing] = useState([]);
  const [file, setFile] = useState(null);
  const [filterClassId, setFilterClassId] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({ studentId:'', documentType:'Birth Certificate', documentTitle:'', documentNumber:'', fileUrl:'', fileName:'', issueDate:'', expiryDate:'', issuingAuthority:'' });

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (filterClassId) params.set('classId', filterClassId);
    if (studentFilter) params.set('studentId', studentFilter);
    const queryString = params.toString();
    const query = queryString ? `?${queryString}` : '';
    Promise.all([
      apiGet('/school/students'),
      apiGet(`/school/documents/enhanced${query}`),
      apiGet('/school/reports/missing-documents'),
    ]).then(([studentResult, documentResult, missingResult]) => {
      const failed = [studentResult, documentResult, missingResult].find((result) => !result?.ok);
      if (failed) throw new Error(failed.error || 'Could not load student documents');
      if (!active) return;
      setStudents(Array.isArray(studentResult.students) ? studentResult.students : []);
      setDocs(Array.isArray(documentResult.documents) ? documentResult.documents : []);
      setMissing(Array.isArray(missingResult.missing) ? missingResult.missing : []);
    }).catch((error) => {
      if (active) toast(error.message, 'error');
    });
    return () => { active = false; };
  }, [filterClassId, studentFilter, reloadKey]);

  const submit = async () => {
    if(!form.studentId || !file) return toast('Student and a document file are required','error');
    try {
      const upload = await apiUpload('/school/uploads', file, 'document');
      const res = await apiPost('/school/documents/enhanced', {
        ...form,
        fileName: upload.upload.fileName,
        fileUrl: upload.upload.fileUrl,
        storageKey: upload.upload.storageKey,
        fileSize: upload.upload.fileSize,
        mimeType: upload.upload.mimeType,
      });
      if(!res?.ok) throw new Error(res?.error || 'Could not add document');
      toast('Document uploaded','success');
      setReloadKey((value) => value + 1);
      setFile(null);
      setForm({...form,fileUrl:'',fileName:'',documentNumber:''});
    } catch (error) {
      toast(error.message,'error');
    }
  };

  const verify = async (id, status) => {
    const rejectionReason = status === 'rejected' ? window.prompt('Reason for rejection') : '';
    if(status === 'rejected' && !rejectionReason?.trim()) return;
    try {
      const res = await apiPost(`/school/documents/enhanced/${id}/verify`, {status,rejectionReason});
      if(!res?.ok) throw new Error(res?.error || 'Could not update document status');
      toast('Updated','success');
      setReloadKey((value) => value + 1);
    } catch (error) {
      toast(error.message,'error');
    }
  };

  const replace = async (doc, replacement) => {
    if(!replacement) return;
    try {
      const upload = await apiUpload('/school/uploads', replacement, 'document');
      const res = await apiPost(`/school/documents/enhanced/${doc.id}/replace`, {
        fileUrl: upload.upload.fileUrl,
        storageKey: upload.upload.storageKey,
        fileName: upload.upload.fileName,
        fileSize: upload.upload.fileSize,
        mimeType: upload.upload.mimeType,
      });
      if(!res?.ok) throw new Error(res?.error || 'Could not replace document');
      toast('Document version added','success');
      setReloadKey((value) => value + 1);
    } catch (error) {
      toast(error.message,'error');
    }
  };

  return (
    <div className="page-content animate-fade" id="student-documents-print-target">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="card-title mb-0"><i className="bi bi-folder2-open me-2"></i>Student Documents</div>
          <div className="d-flex gap-2">
            <PrintButton targetId="student-documents-print-target" />
            <button className="btn btn-sm btn-outline-secondary no-print" onClick={onBack}><i className="bi bi-arrow-left"></i> Back</button>
          </div>
        </div>
        <div className="card-body">
          <div className="row g-2 mb-3">
            <StudentClassPicker
              id="documents-filter"
              students={students}
              classId={filterClassId}
              studentId={studentFilter}
              onClassChange={(classId) => {
                setFilterClassId(classId);
                setStudentFilter('');
              }}
              onStudentChange={setStudentFilter}
              classColumnClass="col-md-3"
              studentColumnClass="col-md-5"
            />
            <div className="col-md-2 d-flex align-items-end">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                setFilterClassId('');
                setStudentFilter('');
              }}>Clear filter</button>
            </div>
          </div>
          <div className="row g-2">
            <StudentClassPicker
              id="documents-upload"
              students={students}
              classId={formClassId}
              studentId={form.studentId}
              onClassChange={(classId) => {
                setFormClassId(classId);
                setForm({ ...form, studentId: '' });
              }}
              onStudentChange={(studentId) => setForm({ ...form, studentId })}
              classColumnClass="col-md-3"
              studentColumnClass="col-md-5"
            />
          </div>
          <div className="row g-2 mt-1">
            <div className="col-md-3"><label className="form-label">Document Type *</label><select className="form-select form-select-sm" value={form.documentType} onChange={e=>setForm({...form,documentType:e.target.value})}><option>Birth Certificate</option><option>TC</option><option>Report Card</option><option>Address Proof</option><option>Aadhaar</option><option>Passport</option><option>Medical Certificate</option><option>Category Certificate</option><option>Other</option></select></div>
            <div className="col-md-5"><label className="form-label">File *</label><input type="file" className="form-control form-control-sm" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></div>
            <div className="col-md-2"><label className="form-label">Document No</label><input className="form-control form-control-sm" value={form.documentNumber} onChange={e=>setForm({...form,documentNumber:e.target.value})}/></div>
            <div className="col-md-2 d-flex align-items-end"><button className="btn btn-sm btn-primary" onClick={submit}>Add</button></div>
          </div>
          <div className="table-responsive mt-3">
            <table className="table table-sm">
              <thead><tr><th>Student</th><th>Type</th><th>File</th><th>Status</th><th>Expiry</th><th>Action</th></tr></thead>
              <tbody>
                {docs.map(d=><tr key={d.id}><td><strong>{d.first_name} {d.last_name}</strong><div className="text-muted small">Admission: {d.admission_no || '-'}</div><div className="text-muted small">Class: {d.class_name || 'Unassigned'}{d.section_name ? ` Ã‚Â· ${d.section_name}` : ''}</div></td><td>{d.document_type}</td><td><a href={d.file_url} onClick={e=>{e.preventDefault();openApiFile(d.file_url).catch(error=>toast(error.message,'error'));}}>{d.file_name||d.document_type}</a><div className="text-muted small">Current version {d.current_version_id ? `#${d.current_version_id}` : '#1'}</div><input type="file" className="form-control form-control-sm mt-1" aria-label="Upload replacement version" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>replace(d,e.target.files?.[0])}/></td><td>{d.verification_status}{d.rejection_reason && <div className="text-danger small">{d.rejection_reason}</div>}</td><td>{d.expiry_date||'-'}</td><td className="d-flex gap-1"><button className="btn btn-sm btn-outline-success" onClick={()=>verify(d.id,'verified')}>Verify</button><button className="btn btn-sm btn-outline-danger" onClick={()=>verify(d.id,'rejected')}>Reject</button></td></tr>)}
                {docs.length===0 && <tr><td colSpan="6" className="text-muted">No documents</td></tr>}
              </tbody>
            </table>
          </div>
          <h6 className="mt-4">Missing required documents</h6>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead><tr><th>Student</th><th>Admission no</th><th>Class</th><th>Missing document</th></tr></thead>
              <tbody>
                {missing.map((row) => <tr key={`${row.id}-${row.document_type_id}`}><td>{row.first_name} {row.last_name}</td><td>{row.admission_no}</td><td>{row.class_name || '-'}</td><td>{row.document_type}</td></tr>)}
                {!missing.length && <tr><td colSpan="4" className="text-muted">No missing required documents</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

