import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../api';
import { PageShell, Empty, Loading, ErrorBox, Badge, canManageHR, fmtDate } from './shared';

const STATUS_TONE = { approved: 'success', taken: 'info' };

export default function LeaveCalendar({ me, onNavigate }) {
  const [data, setData] = useState({ applications: [], holidays: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewDate, setViewDate] = useState(new Date());
  const manager = canManageHR(me);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const from = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString().slice(0, 10);
      const to = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).toISOString().slice(0, 10);
      const [apps, hols] = await Promise.all([
        apiGet(`/school/hr/leave/calendar?from=${from}&to=${to}`),
        apiGet('/school/hr/leave/holidays'),
      ]);
      if (apps?.ok && hols?.ok) setData({ applications: apps.applications || [], holidays: hols.holidays || [] });
      else throw new Error('Failed to load calendar');
    } catch (err) { setError(err.message || 'Failed to load calendar'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [viewDate]);

  const events = [
    ...(data.applications || []).map(a => ({
      date: a.from_date,
      endDate: a.to_date,
      title: `${a.staff_name}: ${a.type_name}`,
      type: 'leave',
      status: a.status,
    })),
    ...(data.holidays || []).map(h => ({
      date: h.date,
      title: h.name,
      type: 'holiday',
    })),
  ];

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const weeks = [];
  let day = 1;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      if (w === 0 && d < firstDay) { week.push(null); continue; }
      if (day > daysInMonth) { week.push(null); continue; }
      const dateStr = new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toISOString().slice(0, 10);
      const dayEvents = events.filter(e => {
        const start = e.date;
        const end = e.endDate || e.date;
        return dateStr >= start && dateStr <= end;
      });
      week.push({ day, dateStr, events: dayEvents });
      day++;
    }
    weeks.push(week);
    if (day > daysInMonth) break;
  }

  return (
    <PageShell title="Leave Calendar" icon="bi-calendar3" subtitle="Team calendar view showing who is on leave with substitution coverage" onNavigate={onNavigate} actions={<button className="btn btn-sm btn-outline-secondary" onClick={() => setViewDate(new Date())}><i className="bi bi-calendar-today me-1"></i>Today</button>}>
      <ErrorBox message={error} onRetry={() => setError('')} />
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button className="btn btn-sm btn-outline-secondary" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}><i className="bi bi-chevron-left"></i></button>
        <h5 className="mb-0">{viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h5>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}><i className="bi bi-chevron-right"></i></button>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered table-sm align-middle mb-0" style={{ minWidth: '100%' }}>
          <thead className="table-light">
            <tr>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <th key={d} className="text-center small">{d}</th>)}</tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi} style={{ minHeight: 80 }}>
                {week.map((day, di) => (
                  <td key={di} className="align-top" style={{ height: 100, verticalAlign: 'top' }}>
                    {day ? (
                      <>
                        <div className="d-flex justify-content-between small">
                          <span className="fw-semibold">{day.day}</span>
                          <span className="text-muted">{day.events.filter(e => e.type === 'holiday').length} holidays</span>
                        </div>
                        <div className="small">
                          {day.events.map(e => (
                            <span key={`${e.date}-${e.title}`} className={`badge me-1 mb-1 ${e.type === 'holiday' ? 'bg-warning' : STATUS_TONE[e.status] ? `bg-${STATUS_TONE[e.status]}` : 'bg-info'}`} style={{fontSize: '0.65rem'}}>
                              {e.type === 'holiday' ? e.title : `${e.title} (${e.status})`}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-muted small">Ã¢â‚¬â€</div>
                    )}
                </td>
              ))}
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
