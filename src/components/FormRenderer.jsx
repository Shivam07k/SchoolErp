import React from 'react';
import FieldControl from './FieldControl';
import { parseWidth } from '../utils';

export default function FormRenderer({ fields, data, bootData, onChange, readOnly, hiddenFields }) {
  const hiddenSet = new Set(hiddenFields || []);
  return (
    <div className="row">
      {(fields || []).filter(f => !hiddenSet.has(f.name)).map(field => {
        if (field.hidden) return null;
        return (
          <div key={field.name} id={`dv${field.name}`} className={parseWidth(field.width)}>
            <label className="form-label">{field.label || field.name}</label>
            <FieldControl
              field={field}
              value={data?.[field.name] ?? ''}
              bootData={bootData}
              onChange={(val) => onChange?.(field.name, val)}
              readOnly={readOnly}
            />
          </div>
        );
      })}
    </div>
  );
}
