import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiUpload, openApiFile } from '../../../api';
import { toast } from '../../../toast';
import PrintButton from '../../../components/PrintButton';
import StudentClassPicker from '../../../components/StudentClassPicker';

const departments = ['Fees', 'Library', 'Sports', 'Lab'];

export default function TransferExit({ onBack }) {
  const [students, setStudents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [signedScan, setSignedScan] = useState(null);
  const [characterCertificate, setCharacterCertificate] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [form, setForm] = useState({ studentId: '', exitType: 'Transfer', reasonLeaving: 'Relocation', destinationSchool: '', destinationCity: '', conductOnTc: 'good' });

  const load = async () => {
    try {
      const [studentResult, requestResult] = await Promise.all([
        apiGet('/school/students?status=active'),
        apiGet('/school/exit/requests'),
      ]);
      if (!studentResult?.ok || !requestResult?.ok) {
        throw new Error(studentResult?.error || requestResult?.error || 'Could not load transfer and exit records');
      }
      setStudents(studentResult.students || []);
      setRequests(requestResult.requests || []);
    } catch (error) {
      toast(error.message, 'error');
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.studentId) return toast('Select a student', 'error');
    try {
      const result = await apiPost('/school/exit/requests', form);
      if (!result?.ok) throw new Error(result?.error || 'Could not create exit request');
      toast('Exit request created', 'success');
      setForm({ ...form, studentId: '' });
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const updateClearance = async (requestId, department, status) => {
    const notes = status === 'rejected' ? window.prompt('Reason clearance was rejected') : '';
    if (status === 'rejected' && !notes?.trim()) return;
    try {
      const result = await apiPost(`/school/exit/requests/${requestId}/clearance`, { department, status, notes });
      if (!result?.ok) throw new Error(result?.error || 'Could not update clearance');
      toast(`${department} clearance updated`, 'success');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const issueTC = async (request) => {
    if (!window.confirm(`Issue a transfer certificate for ${request.first_name} ${request.last_name} (${request.admission_no})? This will close the student's active enrollment.`)) return;
    try {
      const signed = signedScan ? await apiUpload('/school/uploads', signedScan, 'document') : null;
      const character = characterCertificate ? await apiUpload('/school/uploads', characterCertificate, 'document') : null;
      const result = await apiPost(`/school/exit/requests/${request.id}/issue-tc`, {
        signedScanUrl: signed?.upload.fileUrl,
        signedScanStorageKey: signed?.upload.storageKey,
        characterCertificateUrl: character?.upload.fileUrl,
        characterCertificateStorageKey: character?.upload.storageKey,
      });
      if (!result?.ok) throw new Error(result?.error || 'Could not issue TC');
      toast(`TC ${result.certificate.tc_no} issued`, 'success');
      setSignedScan(null);
      setCharacterCertificate(null);
      load();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const closeRequest = async (requestId) => {
    try {
      const result = await apiPost(`/school/exit/requests/${requestId}/close`, {});
      if (!result?.ok) throw new Error(result?.error || 'Could not close request');
      toast('Exit request closed', 'success');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  return (
    <div className="page-content animate-fade" id="transfer-exit-print-target">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="card-title mb-0"><i className="bi bi-box-arrow-right me-2"></i>Transfer &amp; Exit</div>
          <div className="d-flex gap-2">
            <PrintButton targetId="transfer-exit-print-target" />
            <button className="btn btn-sm btn-outline-secondary no-print" onClick={onBack}><i className="bi bi-arrow-left"></i> Back</button>
          </div>
        </div>
        <div className="card-body">
          <div className="row g-2">
            <StudentClassPicker
              id="transfer-exit"
              students={students}
              classId={selectedClassId}
              studentId={form.studentId}
              onClassChange={(classId) => {
                setSelectedClassId(classId);
                setForm({ ...form, studentId: '' });
              }}
              onStudentChange={(studentId) => setForm({ ...form, studentId })}
              classColumnClass="col-md-4"
              studentColumnClass="col-md-8"
            />
          </div>
          <div className="row g-2 mt-1">
            <div className="col-md-2"><label className="form-label">Exit Type</label><select className="form-select form-select-sm" value={form.exitType} onChange={e => setForm({ ...form, exitType: e.target.value })}><option>Transfer</option><option>Dropout</option><option>Expelled</option><option>Left without TC</option></select></div>
            <div className="col-md-2"><label className="form-label">Reason</label><select className="form-select form-select-sm" value={form.reasonLeaving} onChange={e => setForm({ ...form, reasonLeaving: e.target.value })}><option>Relocation</option><option>Parent transfer</option><option>Financial</option><option>Better school</option><option>Health</option><option>Other</option></select></div>
            <div className="col-md-2"><label className="form-label">Destination School</label><input className="form-control form-control-sm" value={form.destinationSchool} onChange={e => setForm({ ...form, destinationSchool: e.target.value })} /></div>
            <div className="col-md-2"><label className="form-label">Destination City</label><input className="form-control form-control-sm" value={form.destinationCity} onChange={e => setForm({ ...form, destinationCity: e.target.value })} /></div>
            <div className="col-md-1 d-flex align-items-end"><button className="btn btn-sm btn-primary" onClick={submit}>Create</button></div>
          </div>
          <div className="row g-2 mt-2">
            <label className="col-md-3">Signed TC scan<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="form-control form-control-sm" onChange={e => setSignedScan(e.target.files?.[0] || null)} /></label>
            <label className="col-md-3">Character certificate<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="form-control form-control-sm" onChange={e => setCharacterCertificate(e.target.files?.[0] || null)} /></label>
          </div>
          <p className="small text-muted mt-2 mb-0">Department clearances are recorded by authorized staff; fee clearance is blocked while invoice balances remain.</p>
          <h6 className="mt-4">Exit Requests &amp; Clearances</h6>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead><tr><th>Request / TC</th><th>Student</th><th>Exit</th><th>Status</th><th>Clearances</th><th>Actions</th></tr></thead>
              <tbody>
                {requests.map(request => <tr key={request.id}>
                  <td>{request.request_no}<div className="text-muted small">{request.tc_no || 'TC pending'} {request.signed_scan_url && <a className="ms-1" href={request.signed_scan_url} onClick={e => { e.preventDefault(); openApiFile(request.signed_scan_url).catch(error => toast(error.message, 'error')); }}>Signed copy</a>} {request.character_cert_url && <a className="ms-1" href={request.character_cert_url} onClick={e => { e.preventDefault(); openApiFile(request.character_cert_url).catch(error => toast(error.message, 'error')); }}>Character certificate</a>}</div></td>
                  <td><strong>{request.first_name} {request.middle_name || ''} {request.last_name}</strong><div className="text-muted small">Admission: {request.admission_no || '-'}</div><div className="text-muted small">{request.class_name || 'Unassigned'}{request.section_name ? ` Ã‚Â· ${request.section_name}` : ''}</div></td>
                  <td>{request.exit_type}</td>
                  <td>{request.status}</td>
                  <td><div className="d-flex flex-column gap-1">{departments.map(department => {
                    const clearance = request.clearances?.find(item => item.department === department);
                    return <div key={department} className="d-flex align-items-center gap-1 small">
                      <span className="me-1">{department}: {clearance?.status || 'pending'}</span>
                      {request.status === 'requested' && clearance?.status !== 'cleared' && <button className="btn btn-sm btn-outline-success py-0" onClick={() => updateClearance(request.id, department, 'cleared')}>Clear</button>}
                      {request.status === 'requested' && clearance?.status === 'cleared' && <button className="btn btn-sm btn-outline-secondary py-0" onClick={() => updateClearance(request.id, department, 'pending')}>Reopen</button>}
                    </div>;
                  })}</div></td>
                  <td className="text-nowrap">
                    {request.status === 'requested' && <button className="btn btn-sm btn-outline-primary me-1" onClick={() => issueTC(request)}>Issue TC</button>}
                    {request.status === 'tc_issued' && <button className="btn btn-sm btn-outline-success" onClick={() => closeRequest(request.id)}>Close</button>}
                  </td>
                </tr>)}
                {!requests.length && <tr><td colSpan="6" className="text-muted">No exit requests</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

