/* Demo timetable seed.
   Creates a few subject allocations + timetable slots for the active academic
   year so the Master, Teacher and Student timetable screens can be compared.
   Idempotent: existing allocations and slots are skipped.
   Run: node scripts/seed-timetable-demo.mjs
*/
const API = process.env.API_URL || 'http://localhost:3100/api';
const LOGIN = {
  userid: process.env.SEED_USERID || 'admin',
  password: process.env.SEED_PASSWORD || process.env.ADMIN_PASSWORD || 'change-me-local',
  company: process.env.SEED_COMPANY || 'school_erp',
};

let token = '';

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok || body.ok === false) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status}: ${body.error || text}`);
  }
  return body;
}

/* Period 1-3 of the main campus (see school_periods). */
const PERIODS = {
  1: { startTime: '08:00', endTime: '08:45' },
  2: { startTime: '08:50', endTime: '09:35' },
  3: { startTime: '09:40', endTime: '10:25' },
};

/* classId/sectionId: Class 1-A and Class 2-A. Teachers are HR employees. */
const ALLOCATIONS = [
  { key: '1a-eng', classId: 4, sectionId: 7, subjectId: 1, teacherId: '472', teacherName: 'Anita Desai' },
  { key: '1a-mat', classId: 4, sectionId: 7, subjectId: 2, teacherId: '473', teacherName: 'Ravi Menon' },
  { key: '1a-sci', classId: 4, sectionId: 7, subjectId: 3, teacherId: '474', teacherName: 'Sunita Rao' },
  { key: '1a-hin', classId: 4, sectionId: 7, subjectId: 4, teacherId: '472', teacherName: 'Anita Desai' },
  { key: '1a-soc', classId: 4, sectionId: 7, subjectId: 5, teacherId: '473', teacherName: 'Ravi Menon' },
  { key: '2a-eng', classId: 5, sectionId: 9, subjectId: 1, teacherId: '473', teacherName: 'Ravi Menon' },
  { key: '2a-mat', classId: 5, sectionId: 9, subjectId: 2, teacherId: '474', teacherName: 'Sunita Rao' },
  { key: '2a-sci', classId: 5, sectionId: 9, subjectId: 3, teacherId: '474', teacherName: 'Sunita Rao' },
];

/* dayOfWeek: 1=Mon ... 5=Fri. Rooms: 48/49 (TT Room), 28 (ZZ Room One). */
const SLOTS = [
  { allocation: '1a-eng', dayOfWeek: 1, periodNo: 1, roomId: 48 },
  { allocation: '1a-mat', dayOfWeek: 1, periodNo: 2, roomId: 48 },
  { allocation: '2a-eng', dayOfWeek: 1, periodNo: 3, roomId: 28 },

  { allocation: '1a-sci', dayOfWeek: 2, periodNo: 1, roomId: 49 },
  { allocation: '1a-eng', dayOfWeek: 2, periodNo: 2, roomId: 49 },
  { allocation: '2a-mat', dayOfWeek: 2, periodNo: 2, roomId: 28 },

  { allocation: '1a-mat', dayOfWeek: 3, periodNo: 1, roomId: 48 },
  { allocation: '2a-eng', dayOfWeek: 3, periodNo: 2, roomId: 49 },
  { allocation: '1a-hin', dayOfWeek: 3, periodNo: 3, roomId: 28 },

  { allocation: '1a-eng', dayOfWeek: 4, periodNo: 1, roomId: 48 },
  { allocation: '1a-sci', dayOfWeek: 4, periodNo: 2, roomId: 49 },
  { allocation: '2a-mat', dayOfWeek: 4, periodNo: 3, roomId: 28 },

  { allocation: '1a-soc', dayOfWeek: 5, periodNo: 1, roomId: 48 },
  { allocation: '1a-hin', dayOfWeek: 5, periodNo: 2, roomId: 49 },
  { allocation: '2a-sci', dayOfWeek: 5, periodNo: 3, roomId: 28 },
];

async function main() {
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify(LOGIN) });
  token = login.token;
  if (!token) throw new Error('Login did not return a token');

  const me = await api('/school/me');
  const yearId = me.activeAcademicYearId
    || (me.academicYears || []).find((y) => y.is_active)?.id;
  if (!yearId) throw new Error('No active academic year');

  const versionsRes = await api('/school/timetable/versions');
  const version = (versionsRes.versions || []).find(
    (v) => Number(v.academic_year_id) === Number(yearId) && v.status !== 'archived',
  );
  if (!version) throw new Error(`No editable timetable version for academic year ${yearId}`);
  console.log(`Using version ${version.id} "${version.name}" (${version.status})`);

  const allocRes = await api('/school/subject-allocations?includeInactive=true');
  const existingAllocations = allocRes.allocations || [];
  const allocationIds = {};

  for (const def of ALLOCATIONS) {
    const found = existingAllocations.find((a) => (
      Number(a.academic_year_id) === Number(yearId)
      && Number(a.class_id) === def.classId
      && Number(a.section_id) === def.sectionId
      && Number(a.subject_id) === def.subjectId
      && String(a.teacher_id) === def.teacherId
      && a.is_active
    ));
    if (found) {
      allocationIds[def.key] = found.id;
      console.log(`  allocation ${def.key}: exists (#${found.id})`);
      continue;
    }
    const created = await api('/school/subject-allocations', {
      method: 'POST',
      body: JSON.stringify({
        academicYearId: yearId,
        classId: def.classId,
        sectionId: def.sectionId,
        subjectId: def.subjectId,
        teacherId: def.teacherId,
        teacherName: def.teacherName,
        effectiveFrom: '2026-04-01',
        isActive: true,
      }),
    });
    allocationIds[def.key] = created.allocation.id;
    console.log(`  allocation ${def.key}: created (#${created.allocation.id})`);
  }

  const ttRes = await api('/school/timetable');
  const existingSlots = ttRes.timetable || [];

  let created = 0;
  for (const slot of SLOTS) {
    const def = ALLOCATIONS.find((a) => a.key === slot.allocation);
    const allocationId = allocationIds[slot.allocation];
    if (!allocationId) throw new Error(`Missing allocation id for ${slot.allocation}`);
    const duplicate = existingSlots.find((s) => (
      Number(s.version_id) === Number(version.id)
      && Number(s.class_id) === def.classId
      && Number(s.section_id) === def.sectionId
      && Number(s.day_of_week) === slot.dayOfWeek
      && Number(s.period_no) === slot.periodNo
    ));
    if (duplicate) {
      console.log(`  slot ${slot.allocation} day ${slot.dayOfWeek} P${slot.periodNo}: exists`);
      continue;
    }
    const times = PERIODS[slot.periodNo];
    await api('/school/timetable', {
      method: 'POST',
      body: JSON.stringify({
        versionId: version.id,
        classId: def.classId,
        sectionId: def.sectionId,
        allocationId,
        roomId: slot.roomId,
        dayOfWeek: slot.dayOfWeek,
        periodNo: slot.periodNo,
        startTime: times.startTime,
        endTime: times.endTime,
      }),
    });
    created += 1;
    console.log(`  slot ${slot.allocation} day ${slot.dayOfWeek} P${slot.periodNo}: created`);
  }

  if (version.status === 'draft') {
    await api(`/school/timetable/versions/${version.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'published' }),
    });
    console.log(`Version ${version.id} published so teachers/students can see it.`);
  }

  console.log(`Done. ${created} slot(s) created.`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
});
