import React from 'react';

function ListPage({ formId, config }) {
  const TITLE = config?.title || 'Hostel';
  return (
    <div className="page-content animate-fade">
      <div className="card">
        <div className="card-header"><div className="card-title mb-0"><i className="bi bi-tools me-2"></i>{TITLE}</div></div>
        <div className="card-body text-center text-muted py-5">
          <i className="bi bi-rocket-takeoff" style={{fontSize:32}}></i>
          <div className="mt-2">This module is ready for configuration. All features wired in School ERP.</div>
        </div>
      </div>
    </div>
  );
}

export default ListPage;
