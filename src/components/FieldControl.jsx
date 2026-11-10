import React from 'react';
import SelectCombo from './SelectCombo';

function toOptionList(rows, source) {
  return (rows || []).map((item) => {
    if (item === null || typeof item !== 'object') return String(item ?? '');
    return String(item[source] ?? item.name ?? item.value ?? Object.values(item)[0] ?? '');
  });
}

export default function FieldControl({ field, value, bootData, onChange, readOnly }) {
  const className = field.classes || '';
  const ft = String(field.type || '').toLowerCase();
  const isCombo = ft === 'combobox' || ft === 'select' || ft === 'selectcombo';
  const sourceData = field.source && bootData?.[field.source] ? bootData[field.source] : null;

  if (isCombo) {
    const rows = sourceData || (!field.source ? field.options || [] : []);
    return (
      <SelectCombo
        id={`fe-${field.name}`}
        dataField={field.name}
        value={value ?? ''}
        options={toOptionList(rows, field.source)}
        allowNew={field.allowNew ?? ft !== 'select'}
        placeholder={field.placeholder || (field.source && !sourceData ? 'Loading...' : 'Select or type...')}
        readOnly={readOnly}
        onChange={onChange}
      />
    );
  }

  if (field.type === 'checkbox') return (
    <div className="form-check">
      <input type="checkbox" className={`form-check-input ${className}`} checked={!!value} disabled={readOnly}
        onChange={(e) => onChange?.(e.target.checked)} data-field={field.name} id={`chk${field.name}`} />
      {field.label && <label className="form-check-label" htmlFor={`chk${field.name}`}>{field.label}</label>}
    </div>
  );
  if (field.type === 'date') return <input type="date" className={`form-control ${className}`} value={value} disabled={readOnly} onChange={(e) => onChange?.(e.target.value)} data-field={field.name} />;
  if (field.type === 'number') return <input type="number" step="any" className={`form-control ${className}`} value={value} disabled={readOnly} onChange={(e) => onChange?.(e.target.value)} data-field={field.name} />;
  if (field.type === 'textarea') return <textarea className={`form-control ${className}`} value={value} disabled={readOnly} onChange={(e) => onChange?.(e.target.value)} rows={3} data-field={field.name} />;
  return <input type="text" className={`form-control ${className}`} value={value} readOnly={readOnly} onChange={(e) => onChange?.(e.target.value)} data-field={field.name} />;
}