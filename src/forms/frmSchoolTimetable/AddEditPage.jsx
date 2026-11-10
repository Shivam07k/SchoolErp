import React from 'react';

function AddEditPage({ onBack }) {
  return (
    <div className="page-content animate-fade">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="card-title mb-0"><i className="bi bi-tools me-2"></i>Module Setup</div>
          <button className="btn btn-sm btn-outline-secondary" onClick={onBack}><i className="bi bi-arrow-left"></i> Back</button>
        </div>
        <div className="card-body text-muted">Module scaffolding complete. Configure via School Settings or extend API as needed.</div>
      </div>
    </div>
  );
}

export default AddEditPage;
