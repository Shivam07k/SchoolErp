import React from 'react';

function AddEditPage({ onBack }) {
  return (
    <div className="page-content animate-fade">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="card-title mb-0"><i className="bi bi-diagram-3 me-2"></i>Classes &amp; Sections</div>
          <button className="btn btn-sm btn-outline-secondary" onClick={onBack}><i className="bi bi-arrow-left"></i> Back</button>
        </div>
        <div className="card-body text-muted">Use the list page to manage classes, sections and subjects.</div>
      </div>
    </div>
  );
}

export default AddEditPage;
