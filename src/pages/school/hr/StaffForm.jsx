import React, { useState } from 'react';
import { apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, canManageHR } from './shared';

const EMPTY = {
  employee_code: '',
  name: '',
  date_of_birth: '',
  gender: '',
  contact_phone: '',
  contact_email: '',
  address: '',
  designation: 'Teacher',
  department: '',
  type: 'permanent',
  joining_date: '',
  user_id: '',
};

/* Create a Staff Directory record.

   The API mirrors the record into school_hr_employees (the table Timetable,
   Attendance and Exams read), so a teacher added here is immediately
   selectable in those modules. */
export default function StaffForm({ me, onNavigate }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    joining_date: new Date().toISOString().slice(0, 10),
  }));
  const [saving, setSaving] = useState(false);
  const manager = canManageHR(me);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.employee_code.trim() || !form.name.trim()) {
      toast('Employee code and name are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost('/school/hr/staff', form);
      if (!res?.ok) throw new Error(res?.error || 'Failed to create staff record');
      toast('Staff record created and linked to Timetable', 'success');
      onNavigate(`/school/hr/staff/${res.staff.id}`);
    } catch (err) {
      toast(err.message || 'Failed to create staff record', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      title="Add Staff"
      icon="bi-person-plus"
      subtitle="Create a staff record; teachers are linked to Timetable, Attendance and Exams automatically"
      onNavigate={onNavigate}
      backPath="/school/hr/staff"
    >
      {!manager ? (
        <div className="alert alert-warning mb-0">You do not have permission to add staff records.</div>
      ) : (
        <form onSubmit={submit} className="card">
          <div className="card-header"><h6 className="mb-0">Personal Details</h6></div>
          <div className="card-body row g-3">
            <div className="col-md-4">
              <label className="form-label small">Employee Code *</label>
              <input className="form-control form-control-sm" value={form.employee_code} onChange={set('employee_code')} required maxLength={40} />
            </div>
            <div className="col-md-8">
              <label className="form-label small">Full Name *</label>
              <input className="form-control form-control-sm" value={form.name} onChange={set('name')} required maxLength={200} />
            </div>
            <div className="col-md-3">
              <label className="form-label small">Date of Birth</label>
              <input type="date" className="form-control form-control-sm" value={form.date_of_birth} onChange={set('date_of_birth')} />
            </div>
            <div className="col-md-3">
              <label className="form-label small">Gender</label>
              <select className="form-select form-select-sm" value={form.gender} onChange={set('gender')}>
                <option value="">Ã¢â‚¬â€</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small">Phone</label>
              <input className="form-control form-control-sm" value={form.contact_phone} onChange={set('contact_phone')} maxLength={30} />
            </div>
            <div className="col-md-3">
              <label className="form-label small">Email</label>
              <input type="email" className="form-control form-control-sm" value={form.contact_email} onChange={set('contact_email')} maxLength={120} />
            </div>
            <div className="col-12">
              <label className="form-label small">Address</label>
              <input className="form-control form-control-sm" value={form.address} onChange={set('address')} maxLength={300} />
            </div>
          </div>

          <div className="card-header border-top"><h6 className="mb-0">Employment</h6></div>
          <div className="card-body row g-3">
            <div className="col-md-4">
              <label className="form-label small">Designation</label>
              <input className="form-control form-control-sm" value={form.designation} onChange={set('designation')} maxLength={80} />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Department</label>
              <input className="form-control form-control-sm" value={form.department} onChange={set('department')} placeholder="e.g. Science" maxLength={80} />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Employment Type</label>
              <select className="form-select form-select-sm" value={form.type} onChange={set('type')}>
                <option value="permanent">Permanent</option>
                <option value="contract">Contract</option>
                <option value="part_time">Part time</option>
                <option value="visiting">Visiting</option>
                <option value="probation">Probation</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small">Joining Date</label>
              <input type="date" className="form-control form-control-sm" value={form.joining_date} onChange={set('joining_date')} />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Login User (optional)</label>
              <input className="form-control form-control-sm" value={form.user_id} onChange={set('user_id')} placeholder="e.g. ADMIN" maxLength={40} />
              <div className="form-text">Links this staff member to a sign-in account for self-service.</div>
            </div>
          </div>

          <div className="card-body border-top d-flex gap-2">
            <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
              <i className="bi bi-check-lg me-1"></i>{saving ? 'SavingÃ¢â‚¬Â¦' : 'Create Staff'}
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNavigate('/school/hr/staff')} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </PageShell>
  );
}

