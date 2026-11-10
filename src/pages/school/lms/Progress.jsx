import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet } from '../../../api';
import { toast } from '../../../toast';

export default function LMSProgress() {
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentFilter, setStudentFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');

  useEffect(() => {
    loadProgress();
  }, [studentFilter, courseFilter]);

  async function loadProgress() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (studentFilter) params.append('studentId', studentFilter);
      if (courseFilter) params.append('courseId', courseFilter);
      const d = await apiGet(`/school/lms/progress?${params.toString()}`);
      if (d?.ok) setProgress(d.progress || []);
      else toast(d?.error || 'Failed to load', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <PageShell title="Student Progress" icon="bi-graph-up" subtitle={`${progress.length} records`}>
      <div className="d-flex gap-2 mb-3">
        <input className="form-control form-control-sm" style={{width:200}} placeholder="Student ID" value={studentFilter} onChange={e => setStudentFilter(e.target.value)} />
        <input className="form-control form-control-sm" style={{width:200}} placeholder="Course ID" value={courseFilter} onChange={e => setCourseFilter(e.target.value)} />
      </div>

      <div className="school-table-wrap">
        <table className="table table-sm school-table">
          <thead><tr><th>Student</th><th>Course</th><th>Completion %</th><th>Assignments</th><th>Quizzes</th><th>Last Updated</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="6"><Loading /></td></tr> :
            progress.length === 0 ? <tr><td colSpan="6"><div className="text-center py-5"><i className="bi bi-graph-up" style={{fontSize:48}}></i><p className="mt-2 text-muted">No progress data</p></div></td></tr> :
            progress.map(p => (
              <tr key={p.id}>
                <td>{p.student_id}</td>
                <td>{p.course_title || `Course ${p.course_id}`}</td>
                <td><div className="progress" style={{height:20}}><div className="progress-bar" role="progressbar" style={{width: `${p.completion_percent || 0}%`}} aria-valuenow={p.completion_percent} aria-valuemin="0" aria-valuemax="100">{p.completion_percent}%</div></div></td>
                <td>{p.assignments_completed || 0}/{p.assignments_total || 0}</td>
                <td>{p.quizzes_completed || 0}/{p.quizzes_total || 0}</td>
                <td>{p.updated_at ? new Date(p.updated_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}