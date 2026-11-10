import React from 'react';

const unassignedClass = 'unassigned';

function classKey(student) {
  return student.class_id === null || student.class_id === undefined
    ? unassignedClass
    : String(student.class_id);
}

function displayName(student) {
  return [
    student.first_name,
    student.middle_name,
    student.last_name,
  ].filter(Boolean).join(' ');
}

export default function StudentClassPicker({
  students,
  classId,
  studentId,
  onClassChange,
  onStudentChange,
  id,
  classColumnClass = 'col-md-4',
  studentColumnClass = 'col-md-8',
  disabled = false,
}) {
  const classesById = new Map();
  for (const student of Array.isArray(students) ? students : []) {
    const key = classKey(student);
    if (!classesById.has(key)) {
      classesById.set(key, {
        id: key,
        name: student.class_name || (key === unassignedClass ? 'Unassigned' : `Class ${key}`),
      });
    }
  }
  const classes = [...classesById.values()].sort((a, b) => a.name.localeCompare(b.name));
  const classStudents = classId
    ? (Array.isArray(students) ? students : []).filter((student) => classKey(student) === classId)
    : [];

  return (
    <>
      <label className={classColumnClass} htmlFor={`${id}-class`}>
        Class *
        <select
          id={`${id}-class`}
          className="form-select form-select-sm"
          value={classId}
          disabled={disabled || classes.length === 0}
          onChange={(event) => onClassChange(event.target.value)}
        >
          <option value="">Choose class first</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className={studentColumnClass} htmlFor={`${id}-student`}>
        Student *
        <select
          id={`${id}-student`}
          className="form-select form-select-sm"
          value={studentId}
          disabled={disabled || !classId}
          onChange={(event) => onStudentChange(event.target.value)}
        >
          <option value="">{classId ? 'Choose student' : 'Choose class first'}</option>
          {classStudents.map((student) => (
            <option key={student.id} value={student.id}>
              {displayName(student)} · {student.admission_no || 'No admission number'}
              {student.section_name ? ` · ${student.section_name}` : ''}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
