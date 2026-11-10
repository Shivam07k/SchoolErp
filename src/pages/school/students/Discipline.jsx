import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiUpload, openApiFile } from '../../../api';
import { toast } from '../../../toast';
import PrintButton from '../../../components/PrintButton';
import StudentClassPicker from '../../../components/StudentClassPicker';

export default function Discipline({ onBack }) {
  const [students, setStudents] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [repeatOffenders, setRepeatOffenders] = useState([]);
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [appeal, setAppeal] = useState({ incidentId: '', appealReason: '' });
  const [review, setReview] = useState({ appealId: '', status: 'approved', reviewNotes: '' });
  const [form, setForm] = useState({ incidentDatetime:'', location:'Classroom', reportedBy:'Teacher', incidentType:'Misbehavior', severity:'Minor', description:'', participants:[{classId:'',studentId:'',role:'Offender'}], zeroTolerance:false });
  const [action, setAction] = useState({ incidentId:'', actionType:'Verbal warning', startDate:'', endDate:'', parentNotified:false, actionLetterUrl:'' });

  const load = async () => {
    try {
      const [s,i,a,r] = await Promise.all([apiGet('/school/students'), apiGet('/school/discipline/incidents'), apiGet('/school/discipline/appeals'), apiGet('/school/discipline/repeat-offenders')]);
      const failed = [s, i, a, r].find((result) => !result?.ok);
      if (failed) throw new Error(failed.error || 'Could not load discipline records');
      setStudents(s.students||[]);
      setIncidents(i.incidents||[]);
      setAppeals(a.appeals||[]);
      setRepeatOffenders(r.students||[]);
    } catch (error) {
      toast(error.message, 'error');
    }
  };
  useEffect(()=>{ load(); }, []);
  useEffect(() => {
    if (!action.incidentId) { setEvidence([]); return; }
    apiGet(`/school/discipline/incidents/${action.incidentId}/evidence`)
      .then(result => { if (result?.ok) setEvidence(result.evidence || []); })
      .catch(error => toast(error.message, 'error'));
  }, [action.incidentId]);

  const addParticipant = () => setForm((current) => ({...current, participants:[...current.participants,{classId:'',studentId:'',role:'Offender'}]}));
  const setPart = (idx,k,v) => setForm((current) => {
    const participants = [...current.participants];
    participants[idx] = { ...participants[idx], [k]: v };
    return { ...current, participants };
  });

  const create = async () => {
    if(!form.description) return toast('Description required','error');
    try {
      const res = await apiPost('/school/discipline/incidents', {
        ...form,
        participants: form.participants.map(({ studentId, role }) => ({ studentId, role })),
      });
      if (!res?.ok) throw new Error(res?.error || 'Could not create incident');
      toast('Incident created','success');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const addAction = async () => {
    if(!action.incidentId || !action.actionType) return toast('Incident and action required','error');
    try {
      const res = await apiPost(`/school/discipline/incidents/${action.incidentId}/actions`, action);
      if (!res?.ok) throw new Error(res?.error || 'Could not add incident action');
      toast('Action added','success');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const uploadEvidence = async () => {
    if (!action.incidentId || !evidenceFile) return toast('Select an incident and evidence file', 'error');
    try {
      const uploaded = await apiUpload('/school/uploads', evidenceFile, 'discipline');
      const result = await apiPost(`/school/discipline/incidents/${action.incidentId}/evidence`, uploaded.upload);
      if (!result?.ok) throw new Error(result?.error || 'Could not attach evidence');
      toast('Evidence attached', 'success');
      setEvidenceFile(null);
    } catch (error) {
      toast(error.message, 'error');
      return;
    }

    try {
      const evidenceResult = await apiGet(`/school/discipline/incidents/${action.incidentId}/evidence`);
      if (!evidenceResult?.ok) throw new Error(evidenceResult?.error || 'Evidence was saved, but the list could not be refreshed');
      setEvidence(evidenceResult.evidence || []);
      await load();
    } catch (error) {
      toast(`Evidence attached, but the list could not be refreshed: ${error.message}`, 'warning');
    }
  };

  const createAppeal = async () => {
    if (!appeal.incidentId || !appeal.appealReason.trim()) return toast('Select an incident and enter the appeal reason', 'error');
    try {
      const result = await apiPost(`/school/discipline/incidents/${appeal.incidentId}/appeals`, appeal);
      if (!result?.ok) throw new Error(result?.error || 'Could not submit appeal');
      toast('Appeal submitted', 'success');
      setAppeal({ ...appeal, appealReason: '' });
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const reviewAppeal = async () => {
    if (!review.appealId) return toast('Select an appeal', 'error');
    try {
      const result = await apiPost(`/school/discipline/appeals/${review.appealId}/review`, review);
      if (!result?.ok) throw new Error(result?.error || 'Could not review appeal');
      toast('Appeal reviewed', 'success');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  return (
    <div className="page-content animate-fade" id="student-discipline-print-target">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="card-title mb-0"><i className="bi bi-shield-exclamation me-2"></i>Discipline</div>
          <div className="d-flex gap-2">
            <PrintButton targetId="student-discipline-print-target" />
            <button className="btn btn-sm btn-outline-secondary no-print" onClick={onBack}><i className="bi bi-arrow-left"></i> Back</button>
          </div>
        </div>
        <div className="card-body">
          <h6>Report Incident</h6>
          <div className="row g-2">
            <div className="col-md-2"><label className="form-label">Date/Time</label><input type="datetime-local" className="form-control form-control-sm" onChange={e=>setForm({...form,incidentDatetime:e.target.value})}/></div>
            <div className="col-md-2"><label className="form-label">Location</label><select className="form-select form-select-sm" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}><option>Classroom</option><option>Corridor</option><option>Canteen</option><option>Playground</option><option>Bus</option><option>Lab</option><option>Online</option></select></div>
            <div className="col-md-2"><label className="form-label">Reported By</label><select className="form-select form-select-sm" value={form.reportedBy} onChange={e=>setForm({...form,reportedBy:e.target.value})}><option>Teacher</option><option>Staff</option><option>Student</option><option>Parent</option></select></div>
            <div className="col-md-2"><label className="form-label">Incident Type</label><select className="form-select form-select-sm" value={form.incidentType} onChange={e=>setForm({...form,incidentType:e.target.value})}><option>Bullying</option><option>Fighting</option><option>Cheating</option><option>Vandalism</option><option>Disobedience</option><option>Truancy</option><option>Substance</option><option>Harassment</option><option>Misbehavior</option><option>Other</option></select></div>
            <div className="col-md-1"><label className="form-label">Severity</label><select className="form-select form-select-sm" value={form.severity} onChange={e=>setForm({...form,severity:e.target.value})}><option>Minor</option><option>Moderate</option><option>Major</option></select></div>
            <div className="col-md-3"><label className="form-label">Description *</label><input className="form-control form-control-sm" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
          </div>
          <h6 className="mt-3">Students Involved</h6>
          {form.participants.map((p,idx)=><div className="row g-2 mb-1" key={idx}>
            <StudentClassPicker
              id={`discipline-participant-${idx}`}
              students={students}
              classId={p.classId}
              studentId={p.studentId}
              onClassChange={(classId) => {
                setPart(idx, 'classId', classId);
                setPart(idx, 'studentId', '');
              }}
              onStudentChange={(studentId) => setPart(idx, 'studentId', studentId)}
              classColumnClass="col-md-3"
              studentColumnClass="col-md-5"
            />
            <div className="col-md-2"><label className="form-label" htmlFor={`discipline-role-${idx}`}>Role</label><select id={`discipline-role-${idx}`} className="form-select form-select-sm" value={p.role} onChange={e=>setPart(idx,'role',e.target.value)}><option>Offender</option><option>Victim</option><option>Witness</option><option>Bystander</option></select></div>
          </div>)}
          <button className="btn btn-sm btn-outline-secondary" onClick={addParticipant}><i className="bi bi-plus"></i> Add Participant</button>
          <div className="form-check mt-2"><input className="form-check-input" type="checkbox" checked={form.zeroTolerance} onChange={e=>setForm({...form,zeroTolerance:e.target.checked})}/><label className="form-check-label">Zero-Tolerance Related</label></div>
          <button className="btn btn-sm btn-primary mt-2" onClick={create}>Create Incident</button>
          <h6 className="mt-4">Take Action</h6>
          <div className="row g-2">
            <div className="col-md-2"><label className="form-label">Incident</label><select className="form-select form-select-sm" value={action.incidentId} onChange={e=>setAction({...action,incidentId:e.target.value})}><option value="">-</option>{incidents.map(i=><option key={i.id} value={i.id}>{i.incident_no} - {i.incident_type}</option>)}</select></div>
            <div className="col-md-2"><label className="form-label">Action Type</label><select className="form-select form-select-sm" value={action.actionType} onChange={e=>setAction({...action,actionType:e.target.value})}><option>Verbal warning</option><option>Written warning</option><option>Parent called</option><option>Detention</option><option>Community service</option><option>In-school suspension</option><option>Out-of-school suspension</option><option>Expulsion</option><option>Counseling</option></select></div>
            <div className="col-md-2"><label className="form-label">Start Date</label><input type="date" className="form-control form-control-sm" value={action.startDate} onChange={e=>setAction({...action,startDate:e.target.value})}/></div>
            <div className="col-md-2"><label className="form-label">End Date</label><input type="date" className="form-control form-control-sm" value={action.endDate} onChange={e=>setAction({...action,endDate:e.target.value})}/></div>
            <div className="col-md-2"><label className="form-label">Action Letter</label><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="form-control form-control-sm" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const result=await apiUpload('/school/uploads',file,'discipline');setAction({...action,actionLetterUrl:result.upload.fileUrl});}catch(error){toast(error.message,'error');}}}/></div>
            <div className="col-md-1 d-flex align-items-end"><button className="btn btn-sm btn-primary" onClick={addAction}>Add Action</button></div>
          </div>
          <div className="row g-2 mt-2">
            <div className="col-md-4"><label className="form-label">Attach Incident Evidence</label><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="form-control form-control-sm" onChange={e=>setEvidenceFile(e.target.files?.[0]||null)}/></div>
            <div className="col-md-2 d-flex align-items-end"><button className="btn btn-sm btn-outline-primary" onClick={uploadEvidence}>Upload Evidence</button></div>
          </div>
          <div className="small mt-1">{evidence.map(item => <a key={item.id} className="me-2" href={item.file_url} onClick={e => { e.preventDefault(); openApiFile(item.file_url).catch(error => toast(error.message, 'error')); }}>{item.file_name}</a>)}</div>
          <h6 className="mt-4">Appeals</h6>
          <div className="row g-2">
            <div className="col-md-3"><select className="form-select form-select-sm" value={appeal.incidentId} onChange={e=>setAppeal({...appeal,incidentId:e.target.value})}><option value="">Incident</option>{incidents.map(i=><option key={i.id} value={i.id}>{i.incident_no} - {i.incident_type}</option>)}</select></div>
            <div className="col-md-6"><input className="form-control form-control-sm" placeholder="Appeal reason" value={appeal.appealReason} onChange={e=>setAppeal({...appeal,appealReason:e.target.value})}/></div>
            <div className="col-md-2"><button className="btn btn-sm btn-primary" onClick={createAppeal}>Submit Appeal</button></div>
          </div>
          <div className="row g-2 mt-1">
            <div className="col-md-3"><select className="form-select form-select-sm" value={review.appealId} onChange={e=>setReview({...review,appealId:e.target.value})}><option value="">Pending appeal</option>{appeals.filter(a=>a.appeal_status==='pending').map(a=><option key={a.id} value={a.id}>{a.incident_no} - {a.appeal_reason}</option>)}</select></div>
            <div className="col-md-2"><select className="form-select form-select-sm" value={review.status} onChange={e=>setReview({...review,status:e.target.value})}><option value="approved">Approve</option><option value="rejected">Reject</option></select></div>
            <div className="col-md-5"><input className="form-control form-control-sm" placeholder="Review notes" value={review.reviewNotes} onChange={e=>setReview({...review,reviewNotes:e.target.value})}/></div>
            <div className="col-md-2"><button className="btn btn-sm btn-outline-primary" onClick={reviewAppeal}>Review Appeal</button></div>
          </div>
          <div className="small text-muted mt-2">Repeat offenders: {repeatOffenders.length ? repeatOffenders.map(s=>`${s.first_name} ${s.last_name} Ã‚Â· ${s.admission_no || 'No admission number'} (${s.incident_count})`).join(', ') : 'None detected'}</div>
          <div className="table-responsive mt-2"><table className="table table-sm"><thead><tr><th>Incident</th><th>Appeal</th><th>Status</th><th>Review</th></tr></thead><tbody>{appeals.map(item=><tr key={item.id}><td>{item.incident_no}</td><td>{item.appeal_reason}</td><td>{item.appeal_status}</td><td>{item.review_notes||'-'}</td></tr>)}{!appeals.length&&<tr><td colSpan="4" className="text-muted">No appeals</td></tr>}</tbody></table></div>
          <div className="table-responsive mt-3">
            <table className="table table-sm">
              <thead><tr><th>Incident No</th><th>Type</th><th>Severity</th><th>Location</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {incidents.map(i=><tr key={i.id}><td>{i.incident_no}</td><td>{i.incident_type}</td><td>{i.severity}</td><td>{i.location}</td><td>{i.status}</td><td>{i.incident_datetime?.slice(0,10)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

