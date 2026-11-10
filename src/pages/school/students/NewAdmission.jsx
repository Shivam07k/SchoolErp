import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';

export default function NewAdmission({ onBack }) {
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({
    inquiryDate: new Date().toISOString().slice(0,10),
    inquirySource: 'Walk-in',
    classInterested: '',
    parentContact: '',
    firstName: '', middleName: '', lastName: '', nameAsPerCertificate: '',
    dob: '', gender: '', bloodGroup: '',
    birthCertificateNo: '', birthCertificateUrl: '',
    previousSchool: '', lastClassPassed: '',
    tcUrl: '', reportCardUrl: '', addressProofUrl: '',
    parentPhotoUrl: '', parentSignatureUrl: '', declarationFormUrl: '',
    transportNeeded: false, applicationStatus: 'applied', documentsChecklist: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try { const d = await apiGet('/school/classes'); if(d?.ok) setClasses(d.classes||[]); } catch {}
    })();
  }, []);

  const change = (k,v) => setForm(f=>({...f,[k]:v}));
  const submit = async (e) => {
    e.preventDefault();
    if(!form.firstName || !form.parentContact || !form.classInterested) return toast('First name, parent contact, class required','error');
    setLoading(true);
    try {
      const res = await apiPost('/school/admissions/enhanced', {...form, applicationStatus:'applied'});
      if(res?.ok){ toast('Admission inquiry created','success'); onBack?.(); }
      else toast(res?.error||'Failed','error');
    } catch(err){ toast(err.message,'error'); }
    finally{ setLoading(false); }
  };

  return (
    <div className="page-content animate-fade">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="card-title mb-0"><i className="bi bi-person-plus me-2"></i>New Admission</div>
          <button className="btn btn-sm btn-outline-secondary" onClick={onBack}><i className="bi bi-arrow-left"></i> Back</button>
        </div>
        <form onSubmit={submit}>
          <div className="card-body">
            <h6>Inquiry Details</h6>
            <div className="row g-2">
              <div className="col-md-3"><label className="form-label">Inquiry Date</label><input type="date" className="form-control form-control-sm" value={form.inquiryDate} onChange={e=>change('inquiryDate',e.target.value)}/></div>
              <div className="col-md-3"><label className="form-label">Inquiry Source *</label><select className="form-select form-select-sm" value={form.inquirySource} onChange={e=>change('inquirySource',e.target.value)}><option>Walk-in</option><option>Phone</option><option>Website</option><option>Referral</option><option>Camp</option></select></div>
              <div className="col-md-3"><label className="form-label">Class Interested In *</label><select className="form-select form-select-sm" value={form.classInterested} onChange={e=>change('classInterested',e.target.value)}><option value="">-</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="col-md-3"><label className="form-label">Parent Contact *</label><input className="form-control form-control-sm" value={form.parentContact} onChange={e=>change('parentContact',e.target.value)} required/></div>
            </div>
            <h6 className="mt-4">Student Details</h6>
            <div className="row g-2">
              <div className="col-md-3"><label className="form-label">First Name *</label><input className="form-control form-control-sm" value={form.firstName} onChange={e=>change('firstName',e.target.value)} required/></div>
              <div className="col-md-3"><label className="form-label">Middle Name</label><input className="form-control form-control-sm" value={form.middleName} onChange={e=>change('middleName',e.target.value)}/></div>
              <div className="col-md-3"><label className="form-label">Last Name</label><input className="form-control form-control-sm" value={form.lastName} onChange={e=>change('lastName',e.target.value)}/></div>
              <div className="col-md-3"><label className="form-label">Name as per Certificate *</label><input className="form-control form-control-sm" value={form.nameAsPerCertificate} onChange={e=>change('nameAsPerCertificate',e.target.value)} required/></div>
              <div className="col-md-2"><label className="form-label">DOB *</label><input type="date" className="form-control form-control-sm" value={form.dob} onChange={e=>change('dob',e.target.value)} required/></div>
              <div className="col-md-2"><label className="form-label">Gender *</label><select className="form-select form-select-sm" value={form.gender} onChange={e=>change('gender',e.target.value)} required><option value="">-</option><option>Male</option><option>Female</option><option>Other</option></select></div>
              <div className="col-md-2"><label className="form-label">Blood Group</label><select className="form-select form-select-sm" value={form.bloodGroup} onChange={e=>change('bloodGroup',e.target.value)}><option value="">-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>O+</option><option>O-</option><option>AB+</option><option>AB-</option><option>Unknown</option></select></div>
              <div className="col-md-3"><label className="form-label">Birth Certificate No *</label><input className="form-control form-control-sm" value={form.birthCertificateNo} onChange={e=>change('birthCertificateNo',e.target.value)} required/></div>
              <div className="col-md-3"><label className="form-label">Birth Certificate (URL)</label><input className="form-control form-control-sm" value={form.birthCertificateUrl} onChange={e=>change('birthCertificateUrl',e.target.value)} placeholder="PDF/JPG link"/></div>
            </div>
            <h6 className="mt-4">Previous School</h6>
            <div className="row g-2">
              <div className="col-md-4"><label className="form-label">Previous School Name</label><input className="form-control form-control-sm" value={form.previousSchool} onChange={e=>change('previousSchool',e.target.value)}/></div>
              <div className="col-md-2"><label className="form-label">Last Class Passed</label><input className="form-control form-control-sm" value={form.lastClassPassed} onChange={e=>change('lastClassPassed',e.target.value)}/></div>
              <div className="col-md-3"><label className="form-label">TC (URL)</label><input className="form-control form-control-sm" value={form.tcUrl} onChange={e=>change('tcUrl',e.target.value)}/></div>
              <div className="col-md-3"><label className="form-label">Report Card (URL)</label><input className="form-control form-control-sm" value={form.reportCardUrl} onChange={e=>change('reportCardUrl',e.target.value)}/></div>
            </div>
            <h6 className="mt-4">Documents</h6>
            <div className="row g-2">
              <div className="col-md-3"><label className="form-label">Address Proof (URL) *</label><input className="form-control form-control-sm" value={form.addressProofUrl} onChange={e=>change('addressProofUrl',e.target.value)} required/></div>
              <div className="col-md-3"><label className="form-label">Parent Photo (URL)</label><input className="form-control form-control-sm" value={form.parentPhotoUrl} onChange={e=>change('parentPhotoUrl',e.target.value)}/></div>
              <div className="col-md-3"><label className="form-label">Parent Signature (URL) *</label><input className="form-control form-control-sm" value={form.parentSignatureUrl} onChange={e=>change('parentSignatureUrl',e.target.value)} required/></div>
              <div className="col-md-3"><label className="form-label">Declaration Form (URL) *</label><input className="form-control form-control-sm" value={form.declarationFormUrl} onChange={e=>change('declarationFormUrl',e.target.value)} required/></div>
            </div>
            <div className="form-check mt-3">
              <input className="form-check-input" type="checkbox" checked={form.transportNeeded} onChange={e=>change('transportNeeded',e.target.checked)} id="tn"/>
              <label className="form-check-label" htmlFor="tn">Transport Needed</label>
            </div>
          </div>
          <div className="card-footer d-flex gap-2">
            <button className="btn btn-sm btn-primary" disabled={loading}><i className="bi bi-check-lg"></i> {loading?'Saving...':'Save Application'}</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onBack}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

