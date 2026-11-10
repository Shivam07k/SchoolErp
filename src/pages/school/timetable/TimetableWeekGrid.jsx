import React, { useMemo } from 'react';
import { PERIOD_LABELS, dayLabel } from './shared';

/* Read-only weekly timetable grid shared by the Teacher and Student views.
   The pages own loading/empty/error states; this component only renders rows. */
export default function TimetableWeekGrid({ entries = [], substitutions = [], weekStart, resolveTeacher }) {
  const subMap = useMemo(() => {
    const map = new Map();
    substitutions.forEach((s) => {
      if (s.status === 'assigned' && s.sub_date) {
        const date = String(s.sub_date).slice(0, 10);
        const key = `${s.timetable_id}:${date}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(s);
      }
    });
    return map;
  }, [substitutions]);

  const days = useMemo(() => {
    const dayMap = {};
    entries.forEach((e) => {
      const day = Number(e.day_of_week);
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(e);
    });
    return dayMap;
  }, [entries]);

  const weekDays = useMemo(() => {
    const start = new Date(`${weekStart}T00:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return {
        date: d.toISOString().slice(0, 10),
        dayOfWeek: d.getDay(),
        label: dayLabel(d.getDay()),
      };
    });
  }, [weekStart]);

  const teacherName = (id) => (resolveTeacher ? resolveTeacher(id) : null) || id || 'Ã¢â‚¬â€';

  function renderPeriodCell(wd, p) {
    const periodEntries = (days[wd.dayOfWeek] || []).filter((e) => Number(e.period_no) === p.id);
    if (periodEntries.length === 0) {
      return <td key={wd.dayOfWeek} style={{ minWidth: 140 }}><span className="text-muted small">Ã¢â‚¬â€</span></td>;
    }
    return (
      <td key={wd.dayOfWeek} style={{ minWidth: 140 }}>
        {periodEntries.map((e) => {
          const sub = subMap.get(`${e.id}:${wd.date}`)?.[0];
          const displayTeacher = sub
            ? (sub.substitute_teacher_display || teacherName(sub.substitute_teacher_id))
            : (e.teacher_display || teacherName(e.teacher_id));
          return (
            <div key={e.id} className={`border rounded p-2 mb-1 ${sub ? 'bg-warning bg-opacity-25' : 'bg-light'}`} style={{ fontSize: '0.75rem' }}>
              <div className="fw-semibold small">{e.class_name} {e.section_name}</div>
              <div className="small text-muted">{e.subject_name}</div>
              <div className="small text-muted">{e.room_code} Ã¢â‚¬â€œ {e.room_name}</div>
              <div className={`small ${sub ? 'text-primary' : 'text-muted'}`}>
                {sub ? 'Sub: ' : ''}{displayTeacher}
              </div>
            </div>
          );
        })}
      </td>
    );
  }

  return (
    <div className="table-responsive border rounded">
      <table className="table table-sm mb-0 align-middle">
        <thead>
          <tr>
            <th style={{ width: '10%' }}>Period</th>
            {weekDays.map((wd) => (
              <th key={wd.dayOfWeek} className="text-center">
                {wd.label}<br /><small className="text-muted">{fmtShortDate(wd.date)}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIOD_LABELS.map((p) => (
            <tr key={p.id}>
              <td className="fw-semibold text-nowrap">{p.label}</td>
              {weekDays.map((wd) => renderPeriodCell(wd, p))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtShortDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

