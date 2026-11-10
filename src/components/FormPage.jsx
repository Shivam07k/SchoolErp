import React, { useState, useEffect } from 'react';
import { getLazyForm, getFormConfig } from '../formRegistry';
import { getAppId } from '../api';

export default function FormPage({ formId, mode, recordId, onNavigate }) {
  const [Component, setComponent] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const appId = getAppId();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      setComponent(null);
      try {
        const cfg = await getFormConfig(formId, appId);
        if (!alive) return;
        setConfig(cfg);

        const componentName = mode === 'list' ? ((cfg?.list || './ListPage.jsx').replace('./', '').replace('.jsx', ''))
          : mode === 'add' ? ((cfg?.add || './AddEditPage.jsx').replace('./', '').replace('.jsx', ''))
          : mode === 'print' ? ((cfg?.print || './PrintPage.jsx').replace('./', '').replace('.jsx', ''))
          : 'ListPage';

        const comp = getLazyForm(formId, componentName, appId);
        if (!alive) return;
        if (comp) setComponent(() => comp);
        else {
          if (mode === 'print' && !cfg?.print) setError('No print view defined for this form.');
          else setError(`Form not found: ${formId}/${componentName}`);
        }
      } catch (e) {
        if (alive) setError(e.message);
        console.error('Form load error:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [formId, mode, recordId, appId]);

  if (loading) return <div className="page-content text-center py-5"><div className="spinner-border"></div></div>;
  if (error) return (
    <div className="page-content animate-fade">
      <div className="empty-state">
        <i className="bi bi-exclamation-triangle"></i>
        <p>{error}</p>
        <button className="btn btn-sm btn-outline-primary mt-2" onClick={() => onNavigate('list', formId)}>Back to List</button>
      </div>
    </div>
  );
  if (!Component) return null;

  return (
    <React.Suspense fallback={<div className="page-content text-center py-5"><div className="spinner-border"></div></div>}>
      <Component formId={formId} recordId={recordId} config={config}
        onBack={() => onNavigate('list', formId)}
        onEdit={(id) => onNavigate('add', formId, id)}
        onAdd={() => onNavigate('add', formId)}
        onPrint={(id) => onNavigate('print', formId, id)}
        onNavigate={onNavigate} />
    </React.Suspense>
  );
}
