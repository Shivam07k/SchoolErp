import React from 'react';

function PrintPage({ data, formId }) {
  const rows = data?.Grid || data?.rows || data?.students || [];
  const d = data?.DFE1?.[0] || data?.dfe1?.[0] || {};
  const info = { ...(d || {}), ...(rows[0] || {}) };
  return (
    <div className="print-page">
      <div className="print-header">
        <h4>{info.SchoolName || info.company_name || 'School ERP'}</h4>
        <div>Student Report</div>
      </div>
      <table className="print-table">
        <thead><tr><th>Admission No</th><th>Student</th><th>Class</th><th>Section</th><th>Guardian</th><th>Phone</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.admission_no || r.AdmissionNo}</td>
              <td>{[r.first_name || r.FirstName, r.last_name || r.LastName].filter(Boolean).join(' ')}</td>
              <td>{r.class_name || r.ClassName || '-'}</td>
              <td>{r.section_name || r.SectionName || '-'}</td>
              <td>{r.guardian_name || r.GuardianName || '-'}</td>
              <td>{r.guardian_phone || r.GuardianPhone || '-'}</td>
              <td>{r.status || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PrintPage;
