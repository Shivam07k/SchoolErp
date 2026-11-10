import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiUpload, openApiFile } from '../../api';
import { toast } from '../../toast';
import PrintButton from '../../components/PrintButton';

const emptyInquiry = {
  inquiryDate: new Date().toISOString().slice(0, 10),
  inquirySource: 'Walk-in',
  classInterested: '',
  parentName: '',
  parentContact: '',
  studentFirstName: '',
  studentLastName: '',
  followUpDate: '',
};

const applicationFields = [
  ['studentFirstName', 'First name', 'text'],
  ['studentMiddleName', 'Middle name', 'text'],
  ['studentLastName', 'Last name', 'text'],
  ['officialName', 'Name as per certificate', 'text'],
  ['dob', 'Date of birth', 'date'],
  ['gender', 'Gender', 'select'],
  ['guardianName', 'Parent / guardian name', 'text'],
  ['guardianContact', 'Parent contact', 'tel'],
];

function toApplicationDraft(row) {
  return {
    ...row,
    classApplied: row.class_applied || row.classApplied || '',
    studentFirstName: row.student_first_name || row.studentFirstName || '',
    studentMiddleName: row.student_middle_name || row.studentMiddleName || '',
    studentLastName: row.student_last_name || row.studentLastName || '',
    officialName: row.official_name || row.officialName || '',
    bloodGroup: row.blood_group || row.bloodGroup || '',
    birthCertificateNo: row.birth_certificate_no || row.birthCertificateNo || '',
    birthCertificateUrl: row.birth_certificate_url || row.birthCertificateUrl || '',
    tcUrl: row.tc_url || row.tcUrl || '',
    reportCardUrl: row.report_card_url || row.reportCardUrl || '',
    addressProofUrl: row.address_proof_url || row.addressProofUrl || '',
    studentPhotoUrl: row.student_photo_url || row.studentPhotoUrl || '',
    parentPhotoUrl: row.parent_photo_url || row.parentPhotoUrl || '',
    parentSignatureUrl: row.parent_signature_url || row.parentSignatureUrl || '',
    declarationFormUrl: row.declaration_form_url || row.declarationFormUrl || '',
    previousSchool: row.previous_school || row.previousSchool || '',
    guardianName: row.guardian_name || row.guardianName || '',
    guardianContact: row.guardian_contact || row.phone || row.guardianContact || '',
    applicationFeeAmount: row.application_fee_amount ?? row.applicationFeeAmount ?? '',
    applicationFeePaid: row.application_fee_paid === true || row.applicationFeePaid === true,
    applicationFeeReceiptNo: row.application_fee_receipt_no || row.applicationFeeReceiptNo || '',
    applicationFeeDate: row.application_fee_date
      ? String(row.application_fee_date).slice(0, 10)
      : row.applicationFeeDate || '',
    interviewScore: row.interview_score ?? row.interviewScore ?? '',
  };
}

export default function Admissions({ mode = 'inquiries', onBack, onNavigate }) {
  const [classes, setClasses] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [applications, setApplications] = useState([]);
  const [inquiry, setInquiry] = useState(emptyInquiry);
  const [application, setApplication] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [classData, inquiryData, applicationData] = await Promise.all([
        apiGet('/school/classes'),
        apiGet('/school/admissions/inquiries'),
        apiGet('/school/admissions/applications'),
      ]);
      if (classData?.ok) setClasses(classData.classes || []);
      if (inquiryData?.ok) setInquiries(inquiryData.inquiries || []);
      if (applicationData?.ok) setApplications(applicationData.applications || []);
    } catch (error) {
      toast(error.message || 'Could not load admissions', 'error');
    }
  }

  useEffect(() => { load(); }, []);

  async function createInquiry(event) {
    event.preventDefault();
    if (!inquiry.parentContact.trim() || !inquiry.classInterested) {
      toast('Parent contact and class are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await apiPost('/school/admissions/inquiries', inquiry);
      if (!result?.ok) throw new Error(result?.error || 'Could not create inquiry');
      toast('Inquiry recorded', 'success');
      setInquiry(emptyInquiry);
      await load();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function startApplication(row) {
    setSaving(true);
    try {
      const result = await apiPost('/school/admissions/applications', { inquiryId: row.id });
      if (!result?.ok) throw new Error(result?.error || 'Could not create application');
      setApplication(toApplicationDraft(result.application));
      toast('Application draft created', 'success');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function uploadApplicationFile(field, file) {
    if (!file) return;
    try {
      const context = ['studentPhotoUrl', 'parentPhotoUrl'].includes(field) ? 'application-photo'
        : field === 'parentSignatureUrl' ? 'application-signature' : 'application';
      const result = await apiUpload('/school/uploads', file, context);
      setApplication((current) => ({ ...current, [field]: result.upload.fileUrl }));
      toast('Application file uploaded', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function updateInquiryStatus(row, status) {
    let lostReason = '';
    if (status === 'lost') {
      lostReason = window.prompt('Reason this inquiry was lost') || '';
      if (!lostReason.trim()) return;
    }
    setSaving(true);
    try {
      const result = await apiPut(`/school/admissions/inquiries/${row.id}`, {
        status,
        lostReason,
        followUpDate: row.follow_up_date,
        assignedTo: row.assigned_to,
        remarks: row.remarks,
      });
      if (!result?.ok) throw new Error(result?.error || 'Could not update inquiry');
      toast('Inquiry updated', 'success');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveApplication(event, submit = false) {
    event?.preventDefault();
    if (!application) return;
    setSaving(true);
    try {
      const saved = await apiPut(`/school/admissions/applications/${application.id}`, application);
      if (!saved?.ok) throw new Error(saved?.error || 'Could not save application');
      if (submit) {
        const result = await apiPost(`/school/admissions/applications/${application.id}/submit`, {});
        if (!result?.ok) throw new Error(result?.error || 'Could not submit application');
        toast('Application submitted for review', 'success');
        setApplication(null);
      } else {
        toast('Application saved', 'success');
        setApplication(toApplicationDraft(saved.application));
      }
      await load();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function reviewApplication(row, action) {
    let payload = {};
    if (action === 'reject') {
      const reason = window.prompt('Reason for rejection');
      if (!reason?.trim()) return;
      payload = { reason: reason.trim() };
    }

    if (action === 'approve' && !window.confirm(`Approve ${row.application_no} and create the student record?`)) return;
    setSaving(true);
    try {
      const result = await apiPost(`/school/admissions/applications/${row.id}/${action}`, payload);
      if (!result?.ok) throw new Error(result?.error || `Could not ${action} application`);
      toast(action === 'approve' ? `Student ${result.student?.admission_no || ''} admitted` : `Application ${action === 'waitlist' ? 'waitlisted' : 'rejected'}`, 'success');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const classSelect = (value, onChange, required = false) => (
    <select className="form-select form-select-sm" value={value || ''} onChange={onChange} required={required}>
      <option value="">Choose class</option>
      {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  );

  return (
    <div className="page-content animate-fade" id="admissions-print-target">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center gap-2">
          <div className="card-title mb-0"><i className="bi bi-person-plus me-2"></i>Admissions</div>
          <div className="d-flex gap-2">
            {onNavigate && (
              <>
                <button className={`btn btn-sm ${mode === 'inquiries' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => onNavigate('/school/admission/leads')}>Inquiries</button>
                <button className={`btn btn-sm ${mode === 'applications' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => onNavigate('/school/admission/applications')}>Applications</button>
              </>
            )}
            {onBack && <button className="btn btn-sm btn-outline-secondary" onClick={onBack}><i className="bi bi-arrow-left"></i> Back</button>}
            <PrintButton targetId="admissions-print-target" label="Print" />
          </div>
        </div>
        <div className="card-body">
          {mode === 'inquiries' && (
            <>
              <form onSubmit={createInquiry}>
                <h6>Record an inquiry</h6>
                <div className="row g-2">
                  <label className="col-md-2">Date<input type="date" className="form-control form-control-sm" value={inquiry.inquiryDate} onChange={(e) => setInquiry({ ...inquiry, inquiryDate: e.target.value })} /></label>
                  <label className="col-md-2">Source<select className="form-select form-select-sm" value={inquiry.inquirySource} onChange={(e) => setInquiry({ ...inquiry, inquirySource: e.target.value })}><option>Walk-in</option><option>Phone</option><option>Website</option><option>Referral</option><option>Camp</option></select></label>
                  <label className="col-md-2">Class interested in{classSelect(inquiry.classInterested, (e) => setInquiry({ ...inquiry, classInterested: e.target.value }), true)}</label>
                  <label className="col-md-2">Parent name<input className="form-control form-control-sm" value={inquiry.parentName} onChange={(e) => setInquiry({ ...inquiry, parentName: e.target.value })} /></label>
                  <label className="col-md-2">Parent contact *<input className="form-control form-control-sm" value={inquiry.parentContact} onChange={(e) => setInquiry({ ...inquiry, parentContact: e.target.value })} required /></label>
                  <label className="col-md-2">Follow-up<input type="date" className="form-control form-control-sm" value={inquiry.followUpDate} onChange={(e) => setInquiry({ ...inquiry, followUpDate: e.target.value })} /></label>
                  <label className="col-md-2">Student first name<input className="form-control form-control-sm" value={inquiry.studentFirstName} onChange={(e) => setInquiry({ ...inquiry, studentFirstName: e.target.value })} /></label>
                  <label className="col-md-2">Student last name<input className="form-control form-control-sm" value={inquiry.studentLastName} onChange={(e) => setInquiry({ ...inquiry, studentLastName: e.target.value })} /></label>
                  <div className="col-md-2 d-flex align-items-end"><button className="btn btn-sm btn-primary" disabled={saving}>Save inquiry</button></div>
                </div>
              </form>
              <h6 className="mt-4">Inquiry pipeline</h6>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead><tr><th>Inquiry</th><th>Date</th><th>Student / Parent</th><th>Class</th><th>Contact</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {inquiries.map((row) => (
                      <tr key={row.id}>
                        <td>{row.inquiry_no}</td><td>{String(row.inquiry_date || '').slice(0, 10)}</td>
                        <td>{[row.student_first_name, row.student_last_name].filter(Boolean).join(' ') || row.parent_name || '-'}</td>
                        <td>{row.class_name || '-'}</td><td>{row.parent_contact}</td><td>{row.inquiry_status}</td>
                        <td className="no-print">
                          {!['lost', 'closed', 'application'].includes(row.inquiry_status) && <>
                            <select className="form-select form-select-sm d-inline-block w-auto me-1" value={row.inquiry_status}
                              disabled={saving} onChange={(event) => updateInquiryStatus(row, event.target.value)}>
                              <option value="new">New</option><option value="contacted">Contacted</option><option value="lost">Lost</option><option value="closed">Closed</option>
                            </select>
                            <button className="btn btn-sm btn-outline-primary" disabled={saving} onClick={() => startApplication(row)}>Start application</button>
                          </>}
                        </td>
                      </tr>
                    ))}
                    {!inquiries.length && <tr><td colSpan="7" className="text-muted">No inquiries recorded</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {application && (
            <form className="border rounded p-3 mb-4" onSubmit={(event) => saveApplication(event, true)}>
              <div className="d-flex justify-content-between align-items-center">
                <h6>Application {application.application_no}</h6>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setApplication(null)}>Close</button>
              </div>
              <div className="row g-2">
                <label className="col-md-3">Class applied for{classSelect(application.classApplied || application.class_applied, (e) => setApplication({ ...application, classApplied: e.target.value }), true)}</label>
                {applicationFields.map(([key, label, type]) => (
                  <label className="col-md-3" key={key}>{label}{type === 'select' ? (
                    <select className="form-select form-select-sm" value={application[key] || ''} onChange={(e) => setApplication({ ...application, [key]: e.target.value })} required>
                      <option value="">Choose</option><option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  ) : (
                    <input type={type} className="form-control form-control-sm" value={application[key] || ''} onChange={(e) => setApplication({ ...application, [key]: e.target.value })} required={['studentFirstName', 'studentLastName', 'officialName', 'dob', 'guardianName', 'guardianContact'].includes(key)} />
                  )}</label>
                ))}
                <label className="col-md-3">Birth certificate no<input className="form-control form-control-sm" value={application.birthCertificateNo || ''} onChange={(e) => setApplication({ ...application, birthCertificateNo: e.target.value })} /></label>
                <label className="col-md-3">Previous school<input className="form-control form-control-sm" value={application.previousSchool || ''} onChange={(e) => setApplication({ ...application, previousSchool: e.target.value })} /></label>
                {[['birthCertificateUrl', 'Birth certificate', '.pdf,.jpg,.jpeg,.png,.webp'], ['tcUrl', 'Transfer certificate', '.pdf,.jpg,.jpeg,.png,.webp'], ['reportCardUrl', 'Report card', '.pdf,.jpg,.jpeg,.png,.webp'], ['addressProofUrl', 'Address proof', '.pdf,.jpg,.jpeg,.png,.webp'], ['studentPhotoUrl', 'Student photo', '.jpg,.jpeg,.png,.webp'], ['parentPhotoUrl', 'Parent photo', '.jpg,.jpeg,.png,.webp'], ['parentSignatureUrl', 'Parent signature', '.jpg,.jpeg,.png,.webp'], ['declarationFormUrl', 'Declaration form', '.pdf,.jpg,.jpeg,.png,.webp']].map(([field, label, accept]) => (
                  <label className="col-md-3" key={field}>{label}<input type="file" accept={accept} className="form-control form-control-sm" onChange={(e) => uploadApplicationFile(field, e.target.files?.[0])} />
                    {application[field] && <a href={application[field]} onClick={(e) => { e.preventDefault(); openApiFile(application[field]).catch((error) => toast(error.message, 'error')); }}>Open uploaded file</a>}
                  </label>
                ))}
              </div>
              <h6 className="mt-3">Application fee and interview</h6>
              <div className="row g-2">
                <label className="col-md-3">Application fee amount
                  <input type="number" min="0" step="0.01" className="form-control form-control-sm"
                    value={application.applicationFeeAmount ?? ''}
                    onChange={(e) => setApplication({ ...application, applicationFeeAmount: e.target.value })} />
                </label>
                <label className="col-md-3">Fee receipt number
                  <input className="form-control form-control-sm" value={application.applicationFeeReceiptNo || ''}
                    onChange={(e) => setApplication({ ...application, applicationFeeReceiptNo: e.target.value })} />
                </label>
                <label className="col-md-3">Fee payment date
                  <input type="date" className="form-control form-control-sm" value={application.applicationFeeDate || ''}
                    onChange={(e) => setApplication({ ...application, applicationFeeDate: e.target.value })} />
                </label>
                <label className="col-md-3">Interview score
                  <input type="number" min="0" step="0.01" className="form-control form-control-sm"
                    value={application.interviewScore ?? ''}
                    onChange={(e) => setApplication({ ...application, interviewScore: e.target.value })} />
                </label>
                <label className="col-md-3 form-check ms-2">
                  <input type="checkbox" className="form-check-input" checked={application.applicationFeePaid === true}
                    onChange={(e) => setApplication({ ...application, applicationFeePaid: e.target.checked })} />
                  <span className="form-check-label">Application fee paid</span>
                </label>
              </div>
              <div className="d-flex gap-2 mt-3">
                <button type="button" className="btn btn-sm btn-outline-primary" disabled={saving} onClick={() => saveApplication(null, false)}>Save draft</button>
                <button className="btn btn-sm btn-primary" disabled={saving}>Submit for review</button>
              </div>
            </form>
          )}

          {mode === 'applications' && (
            <>
              <h6>Applications for review</h6>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead><tr><th>Application</th><th>Inquiry</th><th>Student</th><th>Class</th><th>Status</th><th>Application fee</th><th>Review</th></tr></thead>
                  <tbody>
                    {applications.map((row) => (
                      <tr key={row.id}>
                        <td>{row.application_no}</td><td>{row.inquiry_no || '-'}</td>
                        <td>{[row.student_first_name, row.student_last_name].filter(Boolean).join(' ') || row.first_name}</td>
                        <td>{classes.find((item) => String(item.id) === String(row.class_applied))?.name || '-'}</td>
                        <td>{row.application_status}</td>
                        <td>{row.application_fee_paid ? 'Paid' : 'Unpaid'}
                          {row.application_fee_amount != null && <div className="text-muted small">{row.application_fee_amount}</div>}
                          {row.application_fee_receipt_no && <div className="text-muted small">Receipt {row.application_fee_receipt_no}</div>}
                        </td>
                        <td className="d-flex gap-1">
                          {row.application_status === 'draft' && <button className="btn btn-sm btn-outline-secondary" onClick={() => setApplication(toApplicationDraft(row))}>Edit</button>}
                          {row.application_status === 'submitted' && <>
                            <button className="btn btn-sm btn-outline-success" disabled={saving} onClick={() => reviewApplication(row, 'approve')}>Approve</button>
                            <button className="btn btn-sm btn-outline-warning" disabled={saving} onClick={() => reviewApplication(row, 'waitlist')}>Waitlist</button>
                            <button className="btn btn-sm btn-outline-danger" disabled={saving} onClick={() => reviewApplication(row, 'reject')}>Reject</button>
                          </>}
                        </td>
                      </tr>
                    ))}
                    {!applications.length && <tr><td colSpan="7" className="text-muted">No applications</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
