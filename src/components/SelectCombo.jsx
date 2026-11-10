import React, { useEffect, useRef } from 'react';

const hasJQ = () => typeof window !== 'undefined' && !!window.$ && !!window.$.fn?.select2;

export default function SelectCombo({
  id,
  value,
  options = [],
  onChange,
  readOnly,
  className = '',
  placeholder = 'Select or type...',
  allowNew = true,
  dataField,
}) {
  const ref = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const optKey = options.join('\u0001');

  const renderOptions = () => {
    const el = ref.current;
    if (!el) return;
    el.textContent = '';
    if (placeholder) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = placeholder;
      o.selected = !valueRef.current;
      el.appendChild(o);
    }
    const all = [...options];
    if (valueRef.current && !all.includes(String(valueRef.current))) all.push(String(valueRef.current));
    all.forEach((v) => {
      const o = document.createElement('option');
      o.value = String(v);
      o.textContent = String(v);
      o.selected = String(v) === String(valueRef.current);
      el.appendChild(o);
    });
  };

  const init = () => {
    const el = ref.current;
    if (!el || !hasJQ()) return;
    const $el = window.$(el);
    if ($el.data('select2')) return;
    $el.select2({
      theme: 'bootstrap-5',
      width: '100%',
      placeholder,
      minimumResultsForSearch: 0,
      allowClear: !readOnly && !!placeholder,
      tags: allowNew,
    });
    $el.on('change', function () { onChange?.($el.val() ?? ''); });
  };

  useEffect(() => {
    const el = ref.current;
    return () => { const $el = el && window.$ && window.$(el); if ($el && $el.data && $el.data('select2')) $el.select2('destroy'); };
  }, []);

  useEffect(() => {
    renderOptions();
    init();
  }, [optKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasJQ()) return;
    const $el = window.$(el);
    if ($el.data('select2') && String($el.val() ?? '') !== String(value ?? '')) {
      $el.val(value ?? '').trigger('change');
    }
  }, [value]);

  return <select ref={ref} id={id} data-field={dataField} className={`form-select ${className}`.trim()} disabled={readOnly} />;
}