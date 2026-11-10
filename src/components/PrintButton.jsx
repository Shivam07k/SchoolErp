import React from 'react';
import { printElement } from '../utils/print';

export default function PrintButton({ targetId, label = 'Print' }) {
  return (
    <button className="btn btn-sm btn-outline-secondary no-print" type="button" onClick={() => printElement(targetId)}>
      <i className="bi bi-printer me-1"></i>{label}
    </button>
  );
}
