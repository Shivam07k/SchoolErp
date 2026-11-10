import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiUpload, openApiFile } from '../../../api';
import StudentPhoto from '../../../components/StudentPhoto';
import StudentClassPicker from '../../../components/StudentClassPicker';
import { toast } from '../../../toast';
import PrintButton from '../../../components/PrintButton';

const emptyRecords = { profile: null, events: [], observations: [], vaccinations: [] };
const emptyProfile = {
  bloodGroup: '', heightCm: '', weightKg: '', allergies: '', chronicConditions: '',
  regularMedications: '', doctorName: '', doctorContact: '', preferredHospital: '', medicalFitnessExpiry: '',
};
const emptyEvent = {
  eventDatetime: '', symptomComplaint: '', treatmentGiven: '', actionTaken: 'First aid',
  attendingStaff: '', parentInformed: false, severity: 'minor', followUpRequired: false,
};
const emptyObservation = { observationType: 'height', value: '', observedAt: '', notes: '' };
const emptyVaccination = {
  vaccineName: '', doseNumber: '', vaccinationDate: '', nextDueDate: '',
  administeredBy: '', batchNumber: '',
};
const studentClass = (student) => [student?.class_name, student?.section_name].filter(Boolean).join(' Ã‚Â· ') || 'Unassigned';
const conditionText = (conditions) => Array.isArray(conditions) ? conditions.join(', ') : typeof conditions === 'string' ? conditions : '';

export default function Health({ onBack }) {
  const [students, setStudents] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [records, setRecords] = useState(emptyRecords);
  const [recordsStudentId, setRecordsStudentId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileFile, setProfileFile] = useState(null);
  const [vaccinationFile, setVaccinationFile] = useState(null);
  const [prof, setProf] = useState(emptyProfile);
  const [event, setEvent] = useState(emptyEvent);
  const [observation, setObservation] = useState(emptyObservation);
  const [vaccination, setVaccination] = useState(emptyVaccination);
  const selectedStudent = students.find((item) => String(item.id) === String(selectedStudentId));

  useEffect(() => {
    let active = true;
    apiGet('/school/students').then((result) => {
      if (!result?.ok) throw new Error(result?.error || 'Could not load students');
      if (active) setStudents(Array.isArray(result.students) ? result.students : []);
    }).catch((error) => toast(error.message, 'error')).finally(() => {
      if (active) setLoadingStudents(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setRecords(emptyRecords);
    setRecordsStudentId('');
    setProfileFile(null);
    setVaccinationFile(null);
    setProf(emptyProfile);
    setEvent(emptyEvent);
    setObservation(emptyObservation);
    setVaccination(emptyVaccination);
    if (!selectedStudentId) {
      setLoadingRecords(false);
      return () => { active = false; };
    }

    const query = new URLSearchParams({ studentId: selectedStudentId });
    setLoadingRecords(true);
    Promise.all([
      apiGet(`/school/health/profiles?${query}`),
      apiGet(`/school/health/events?${query}`),
      apiGet(`/school/health/observations?${query}`),
      apiGet(`/school/health/vaccinations?${query}`),
    ]).then(([profiles, events, observations, vaccinations]) => {
      const results = [profiles, events, observations, vaccinations];
      const failed = results.find((result) => !result?.ok);
      if (failed) throw new Error(failed.error || 'Could not load health records');
      if (!active) return;
      setRecords({
        profile: Array.isArray(profiles.profiles) ? profiles.profiles[0] || null : null,
        events: Array.isArray(events.events) ? events.events : [],
        observations: Array.isArray(observations.observations) ? observations.observations : [],
        vaccinations: Array.isArray(vaccinations.vaccinations) ? vaccinations.vaccinations : [],
      });
      setRecordsStudentId(selectedStudentId);
    }).catch((error) => {
      if (active) toast(error.message, 'error');
    }).finally(() => {
      if (active) setLoadingRecords(false);
    });
    return () => { active = false; };
  }, [selectedStudentId, reloadKey]);

  useEffect(() => {
    const profile = records.profile;
    setProf({
      bloodGroup: profile?.blood_group ?? selectedStudent?.blood_group ?? '',
      heightCm: profile?.height_cm ?? selectedStudent?.height_cm ?? '',
      weightKg: profile?.weight_kg ?? selectedStudent?.weight_kg ?? '',
      allergies: profile?.allergies ?? selectedStudent?.allergies ?? '',
      chronicConditions: profile
        ? conditionText(profile.chronic_conditions)
        : conditionText(selectedStudent?.chronic_conditions) || selectedStudent?.medical_conditions || '',
      regularMedications: profile?.regular_medications ?? selectedStudent?.regular_medications ?? '',
      doctorName: profile?.doctor_name ?? selectedStudent?.doctor_name ?? '',
      doctorContact: profile?.doctor_contact ?? selectedStudent?.doctor_contact ?? '',
      preferredHospital: profile?.preferred_hospital ?? selectedStudent?.preferred_hospital ?? '',
      medicalFitnessExpiry: typeof profile?.medical_fitness_expiry === 'string'
        ? profile.medical_fitness_expiry.slice(0, 10)
        : '',
    });
  }, [records.profile, selectedStudent]);

  const refreshRecords = () => setReloadKey((value) => value + 1);

  const saveProfile = async () => {
    if (!selectedStudentId) return toast('Select a student first', 'error');
    try {
      const medicalFitness = profileFile ? await apiUpload('/school/uploads', profileFile, 'health') : null;
      const chronicConditions = typeof prof.chronicConditions === 'string'
        ? prof.chronicConditions
        : conditionText(prof.chronicConditions);
      const result = await apiPost('/school/health/profiles', {
        ...prof,
        chronicConditions: chronicConditions.split(',').map((condition) => condition.trim()).filter(Boolean),
        studentId: selectedStudentId,
        medicalFitnessUrl: medicalFitness?.upload.fileUrl || records.profile?.medical_fitness_url || '',
        medicalFitnessStorageKey: medicalFitness?.upload.storageKey,
      });
      if (!result?.ok) throw new Error(result?.error || 'Could not save health profile');
      toast('Health profile saved', 'success');
      setProfileFile(null);
      refreshRecords();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const saveEvent = async () => {
    if (!selectedStudentId || !event.symptomComplaint.trim() || !event.attendingStaff.trim()) {
      return toast('Student, complaint, and attending staff are required', 'error');
    }
    try {
      const result = await apiPost('/school/health/events', { ...event, studentId: selectedStudentId });
      if (!result?.ok) throw new Error(result?.error || 'Could not save health event');
      toast('Health event logged', 'success');
      setEvent(emptyEvent);
      refreshRecords();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const saveObservation = async () => {
    if (!selectedStudentId || !observation.value) return toast('Select a student and enter a measurement', 'error');
    try {
      const result = await apiPost('/school/health/observations', { ...observation, studentId: selectedStudentId });
      if (!result?.ok) throw new Error(result?.error || 'Could not save measurement');
      toast('Measurement recorded', 'success');
      setObservation({ ...emptyObservation, observationType: observation.observationType });
      refreshRecords();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const saveVaccination = async () => {
    if (!selectedStudentId || !vaccination.vaccineName || !vaccination.vaccinationDate) {
      return toast('Select a student, vaccine, and vaccination date', 'error');
    }
    try {
      const uploaded = vaccinationFile ? await apiUpload('/school/uploads', vaccinationFile, 'health') : null;
      const result = await apiPost('/school/health/vaccinations', {
        ...vaccination,
        studentId: selectedStudentId,
        certificateUrl: uploaded?.upload.fileUrl || '',
        storageKey: uploaded?.upload.storageKey,
      });
      if (!result?.ok) throw new Error(result?.error || 'Could not save vaccination');
      toast('Vaccination recorded', 'success');
      setVaccinationFile(null);
      setVaccination(emptyVaccination);
      refreshRecords();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const profile = records.profile;

  return (
    <div className="page-content animate-fade" id="student-health-print-target">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="card-title mb-0"><i className="bi bi-heart-pulse me-2"></i>Health Records</div>
          <div className="d-flex gap-2">
            <PrintButton targetId="student-health-print-target" label="Print student health record" />
            <button className="btn btn-sm btn-outline-secondary no-print" onClick={onBack}><i className="bi bi-arrow-left"></i> Back</button>
          </div>
        </div>
        <div className="card-body">
          <div className="student-health-selector row g-2">
            <StudentClassPicker
              id="health-record"
              students={students}
              classId={selectedClassId}
              studentId={selectedStudentId}
              disabled={loadingStudents}
              classColumnClass="col-md-4"
              studentColumnClass="col-md-8"
              onClassChange={(classId) => {
                setSelectedClassId(classId);
                setSelectedStudentId('');
              }}
              onStudentChange={(studentId) => setSelectedStudentId(studentId)}
            />
          </div>

          {!selectedStudentId && <div className="school-empty"><i className="bi bi-person-heart"></i><span>Select a student to view or add their linked health records.</span></div>}
          {selectedStudent && (
            <section className="student-health-identity">
              <StudentPhoto photoUrl={selectedStudent.photo_url} name={`${selectedStudent.first_name} ${selectedStudent.last_name}`} />
              <div><strong>{selectedStudent.first_name} {selectedStudent.middle_name || ''} {selectedStudent.last_name}</strong>
                <div className="school-muted">Admission {selectedStudent.admission_no || '-'} Ã‚Â· {studentClass(selectedStudent)}</div>
              </div>
              {(profile?.allergies || selectedStudent.allergies) && <span className="badge school-badge absent">Allergy alert: {profile?.allergies || selectedStudent.allergies}</span>}
            </section>
          )}

          {selectedStudentId && (loadingRecords || recordsStudentId !== selectedStudentId) && <div className="school-loading"><div className="spinner-border spinner-border-sm text-primary"></div> Loading this student's records...</div>}
          {selectedStudentId && !loadingRecords && recordsStudentId === selectedStudentId && (
            <>
              <h6>Health Profile</h6>
              <div className="row g-2">
                <div className="col-md-2"><label className="form-label">Blood Group</label><select className="form-select form-select-sm" value={prof.bloodGroup} onChange={(e) => setProf({ ...prof, bloodGroup: e.target.value })}><option value="">-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>O+</option><option>O-</option><option>AB+</option><option>AB-</option></select></div>
                <div className="col-md-1"><label className="form-label">Height (cm)</label><input type="number" min="0" step="0.1" className="form-control form-control-sm" value={prof.heightCm} onChange={(e) => setProf({ ...prof, heightCm: e.target.value })} /></div>
                <div className="col-md-1"><label className="form-label">Weight (kg)</label><input type="number" min="0" step="0.1" className="form-control form-control-sm" value={prof.weightKg} onChange={(e) => setProf({ ...prof, weightKg: e.target.value })} /></div>
                <div className="col-md-3"><label className="form-label">Allergies</label><input className="form-control form-control-sm" value={prof.allergies} onChange={(e) => setProf({ ...prof, allergies: e.target.value })} /></div>
                <div className="col-md-3"><label className="form-label">Chronic Conditions</label><input className="form-control form-control-sm" value={prof.chronicConditions} onChange={(e) => setProf({ ...prof, chronicConditions: e.target.value })} /></div>
                <div className="col-md-3"><label className="form-label">Regular Medications</label><input className="form-control form-control-sm" value={prof.regularMedications} onChange={(e) => setProf({ ...prof, regularMedications: e.target.value })} /></div>
                <div className="col-md-2"><label className="form-label">Doctor</label><input className="form-control form-control-sm" value={prof.doctorName} onChange={(e) => setProf({ ...prof, doctorName: e.target.value })} /></div>
                <div className="col-md-2"><label className="form-label">Doctor Contact</label><input className="form-control form-control-sm" value={prof.doctorContact} onChange={(e) => setProf({ ...prof, doctorContact: e.target.value })} /></div>
                <div className="col-md-3"><label className="form-label">Preferred Hospital</label><input className="form-control form-control-sm" value={prof.preferredHospital} onChange={(e) => setProf({ ...prof, preferredHospital: e.target.value })} /></div>
                <div className="col-md-3"><label className="form-label">Medical Fitness Certificate</label><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="form-control form-control-sm" onChange={(e) => setProfileFile(e.target.files?.[0] || null)} />{profile?.medical_fitness_url && <button className="btn btn-link btn-sm p-0" type="button" onClick={() => openApiFile(profile.medical_fitness_url).catch((error) => toast(error.message, 'error'))}>Open current certificate</button>}</div>
              </div>
              <button className="btn btn-sm btn-primary mt-2" onClick={saveProfile}>Save Profile</button>

              <h6 className="mt-4">Growth Observations</h6>
              <div className="row g-2">
                <div className="col-md-2"><select className="form-select form-select-sm" value={observation.observationType} onChange={(e) => setObservation({ ...observation, observationType: e.target.value })}><option value="height">Height (cm)</option><option value="weight">Weight (kg)</option></select></div>
                <div className="col-md-2"><input type="number" min="0.1" step="0.1" className="form-control form-control-sm" placeholder="Value" value={observation.value} onChange={(e) => setObservation({ ...observation, value: e.target.value })} /></div>
                <div className="col-md-2"><input type="date" className="form-control form-control-sm" value={observation.observedAt} onChange={(e) => setObservation({ ...observation, observedAt: e.target.value })} /></div>
                <div className="col-md-4"><input className="form-control form-control-sm" placeholder="Notes" value={observation.notes} onChange={(e) => setObservation({ ...observation, notes: e.target.value })} /></div>
                <div className="col-md-2"><button className="btn btn-sm btn-primary" onClick={saveObservation}>Add measurement</button></div>
              </div>
              <div className="table-responsive mt-2"><table className="table table-sm"><thead><tr><th>Date</th><th>Type</th><th>Value</th><th>Notes</th></tr></thead><tbody>
                {records.observations.map((item) => <tr key={item.id}><td>{item.observed_at?.slice(0, 10)}</td><td>{item.observation_type}</td><td>{item.value} {item.unit}</td><td>{item.notes || '-'}</td></tr>)}
                {!records.observations.length && <tr><td colSpan="4" className="text-muted">No growth observations for this student</td></tr>}
              </tbody></table></div>

              <h6 className="mt-4">Vaccinations</h6>
              <div className="row g-2">
                <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Vaccine *" value={vaccination.vaccineName} onChange={(e) => setVaccination({ ...vaccination, vaccineName: e.target.value })} /></div>
                <div className="col-md-1"><input className="form-control form-control-sm" placeholder="Dose" value={vaccination.doseNumber} onChange={(e) => setVaccination({ ...vaccination, doseNumber: e.target.value })} /></div>
                <div className="col-md-2"><input type="date" className="form-control form-control-sm" aria-label="Vaccination date" value={vaccination.vaccinationDate} onChange={(e) => setVaccination({ ...vaccination, vaccinationDate: e.target.value })} /></div>
                <div className="col-md-2"><input type="date" className="form-control form-control-sm" aria-label="Next due date" value={vaccination.nextDueDate} onChange={(e) => setVaccination({ ...vaccination, nextDueDate: e.target.value })} /></div>
                <div className="col-md-2"><input type="file" aria-label="Vaccination certificate" accept=".pdf,.jpg,.jpeg,.png,.webp" className="form-control form-control-sm" onChange={(e) => setVaccinationFile(e.target.files?.[0] || null)} /></div>
                <div className="col-md-2"><button className="btn btn-sm btn-primary" onClick={saveVaccination}>Add vaccination</button></div>
              </div>
              <div className="table-responsive mt-2"><table className="table table-sm"><thead><tr><th>Vaccine</th><th>Dose</th><th>Date</th><th>Next Due</th><th>Certificate</th></tr></thead><tbody>
                {records.vaccinations.map((item) => <tr key={item.id}><td>{item.vaccine_name}</td><td>{item.dose_number || '-'}</td><td>{item.vaccination_date?.slice(0, 10)}</td><td>{item.next_due_date?.slice(0, 10) || '-'}</td><td>{item.certificate_url && <a href={item.certificate_url} onClick={(e) => { e.preventDefault(); openApiFile(item.certificate_url).catch((error) => toast(error.message, 'error')); }}>Open</a>}</td></tr>)}
                {!records.vaccinations.length && <tr><td colSpan="5" className="text-muted">No vaccinations for this student</td></tr>}
              </tbody></table></div>

              <h6 className="mt-4">Health Event History</h6>
              <div className="row g-2">
                <div className="col-md-2"><label className="form-label">Date/Time</label><input type="datetime-local" className="form-control form-control-sm" value={event.eventDatetime} onChange={(e) => setEvent({ ...event, eventDatetime: e.target.value })} /></div>
                <div className="col-md-3"><label className="form-label">Symptom/Complaint *</label><input className="form-control form-control-sm" value={event.symptomComplaint} onChange={(e) => setEvent({ ...event, symptomComplaint: e.target.value })} /></div>
                <div className="col-md-2"><label className="form-label">Treatment</label><input className="form-control form-control-sm" value={event.treatmentGiven} onChange={(e) => setEvent({ ...event, treatmentGiven: e.target.value })} /></div>
                <div className="col-md-2"><label className="form-label">Action Taken</label><select className="form-select form-select-sm" value={event.actionTaken} onChange={(e) => setEvent({ ...event, actionTaken: e.target.value })}><option>First aid</option><option>Sent home</option><option>Sent to hospital</option><option>Rest</option></select></div>
                <div className="col-md-2"><label className="form-label">Attending Staff *</label><input className="form-control form-control-sm" value={event.attendingStaff} onChange={(e) => setEvent({ ...event, attendingStaff: e.target.value })} /></div>
                <div className="col-md-1"><label className="form-label">Severity</label><select className="form-select form-select-sm" value={event.severity} onChange={(e) => setEvent({ ...event, severity: e.target.value })}><option value="minor">Minor</option><option value="moderate">Moderate</option><option value="serious">Serious</option></select></div>
                <div className="col-md-2"><label className="form-check-label"><input className="form-check-input me-2" type="checkbox" checked={event.parentInformed} onChange={(e) => setEvent({ ...event, parentInformed: e.target.checked })} />Parent informed</label></div>
                <div className="col-md-2"><button className="btn btn-sm btn-primary" onClick={saveEvent}>Log event</button></div>
              </div>
              <div className="table-responsive mt-3"><table className="table table-sm"><thead><tr><th>Date</th><th>Complaint</th><th>Treatment</th><th>Action</th><th>Severity</th><th>Parent informed</th></tr></thead><tbody>
                {records.events.map((item) => <tr key={item.id}><td>{item.event_datetime?.slice(0, 16)}</td><td>{item.symptom_complaint}</td><td>{item.treatment_given || '-'}</td><td>{item.action_taken || '-'}</td><td>{item.severity}</td><td>{item.parent_informed ? 'Yes' : 'No'}</td></tr>)}
                {!records.events.length && <tr><td colSpan="6" className="text-muted">No health events for this student</td></tr>}
              </tbody></table></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

