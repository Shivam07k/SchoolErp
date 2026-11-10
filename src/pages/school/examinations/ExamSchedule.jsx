import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';
import { PageShell, Empty, Loading, ErrorBox, fmtDate, fmtTime, canManage } from './shared';

export default function ExamSchedule({ me, onNavigate }) {
  const [exams, setExams] = useState([]);
  const [slots, setSlots] = useState([]);
  const [halls, setHalls] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const manager = canManage(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [examRes, slotRes, hallRes] = await Promise.all([
        apiGet('/school/exams'),
        apiGet('/school/exam/schedule/slots'),
        apiGet('/school/exam/schedule/halls'),
      ]);
      if (!examRes?.ok) throw new Error(examRes?.error);
      if (!slotRes?.ok) throw new Error(slotRes?.error);
      if (!hallRes?.ok) throw new Error(hallRes?.error);
      setExams(examRes.exams || []);
      setSlots(slotRes.slots || []);
      setHalls(hallRes.halls || []);
    } catch (err) {
      setError(err.message || 'Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const examSlots = slots.filter(s => !selectedExamId || s.exam_id === Number(selectedExamId));

  return (
    <PageShell
      title="Exam Schedule"
      icon="bi-calendar3-week"
      subtitle="Manage date sheets, halls, seating, and invigilation"
      onNavigate={onNavigate}
      actions={
        <button className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/examinations/schedule/date-sheet')}>
          <i className="bi bi-calendar-plus me-1"></i>Open Date Sheet
        </button>
      }
    >
      <ErrorBox message={error} onRetry={load} />

      <div className="row g-3 mb-4">
        <div className="col-md-6"><label className="form-label small">Filter by Exam</label><select className="form-select form-select-sm" value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}><option value="">All Exams</option>{exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
        <div className="col-md-6"><button className="btn btn-primary mt-4" onClick={() => onNavigate('/school/examinations/schedule/date-sheet')}><i className="bi bi-magic me-1"></i>Auto-Fill Date Sheet</button></div>
      </div>

      {loading ? <Loading /> : (
        <div className="row g-3">
          <div className="col-lg-8">
            <div className="border rounded">
              <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                <span className="fw-semibold small">Date Sheet {exams.find(e => String(e.id) === selectedExamId) ? `Ã¢â‚¬â€ ${exams.find(e => String(e.id) === selectedExamId).name}` : ''}</span>
                <button className="btn btn-sm btn-primary" onClick={() => onNavigate('/school/examinations/schedule/date-sheet')}><i className="bi bi-pencil-square me-1"></i>Edit</button>
              </div>
              {examSlots.length === 0 ? <Empty icon="bi-calendar3" text="No slots scheduled yet." /> : (
                <div className="table-responsive">
                  <table className="table table-sm mb-0 align-middle">
                    <thead><tr><th>Date</th><th>Time</th><th>Paper</th><th>Section</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                    <tbody>
                      {examSlots.map(s => (
                        <tr key={s.id}>
                          <td>{fmtDate(s.date)}</td>
                          <td>{fmtTime(s.start_time)} Ã¢â‚¬â€œ {fmtTime(s.end_time)}</td>
                          <td className="small">{s.paper_name || s.subject_name || 'Ã¢â‚¬â€'}</td>
                          <td className="small">{s.section_name || 'All'}</td>
                          <td><span className={`badge bg-${s.status === 'published' ? 'success' : s.status === 'cancelled' ? 'danger' : 'secondary'}`}>{s.status}</span></td>
                          <td className="text-end"><div className="btn-group btn-group-sm"><button className="btn btn-outline-primary" onClick={() => onNavigate('/school/examinations/schedule/seating')}>Seating</button><button className="btn btn-outline-primary" onClick={() => onNavigate('/school/examinations/schedule/invigilation')}>Invigilation</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="col-lg-4">
            <div className="border rounded p-3 mb-3">
              <h6 className="fw-bold mb-3">Halls</h6>
              {halls.length === 0 ? <Empty icon="bi-building" text="No halls configured." /> : (
                <div className="table-responsive"><table className="table table-sm mb-0 align-middle"><thead><tr><th>Hall</th><th>Room</th><th>Capacity</th></tr></thead><tbody>{halls.map(h => <tr key={h.id}><td>{h.name || 'Ã¢â‚¬â€'}</td><td className="small">{h.room_name || 'Ã¢â‚¬â€'}</td><td>{h.capacity}</td></tr>)}</tbody></table></div>
              )}
            </div>

            <div className="border rounded p-3">
              <h6 className="fw-bold mb-3">Quick Links</h6>
              <div className="d-grid gap-2">
                <button className="btn btn-outline-primary" onClick={() => onNavigate('/school/examinations/schedule/seating')}><i className="bi bi-grid me-2"></i>Seating Plans</button>
                <button className="btn btn-outline-primary" onClick={() => onNavigate('/school/examinations/schedule/invigilation')}><i className="bi bi-people me-2"></i>Invigilation Duties</button>
                <button className="btn btn-outline-primary" onClick={() => onNavigate('/school/examinations/schedule/hall-tickets')}><i className="bi bi-card-checklist me-2"></i>Hall Tickets</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
