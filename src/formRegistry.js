import { lazy } from 'react';
import { getToken } from './api';

// Build-time static discovery of all form components (no runtime compilation).
// Base forms live in src/forms/<formId>/, company overrides in src/companies/<appId>/forms/<formId>/.
const baseComponents = import.meta.glob('./forms/*/*.jsx');
const companyComponents = import.meta.glob('./companies/*/forms/*/*.jsx');

export function getFormLoader(formId, componentName, appId) {
  if (appId) {
    const override = companyComponents[`./companies/${appId}/forms/${formId}/${componentName}.jsx`];
    if (override) return override;
  }
  return baseComponents[`./forms/${formId}/${componentName}.jsx`] || null;
}

export function getLazyForm(formId, componentName, appId) {
  const loader = getFormLoader(formId, componentName, appId);
  return loader ? lazy(loader) : null;
}

// Client-side cache of merged configs served by /api/form-config/:formId.
// Short TTL so edits to form.json show up without a hard reload.
const configCache = new Map();
const CONFIG_TTL = 15_000;

export function clearFormConfigCache() {
  configCache.clear();
}

export async function getFormConfig(formId, appId = '') {
  const key = `${appId}|${formId}`;
  const hit = configCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.cfg;
  const r = await fetch(`/api/form-config/${encodeURIComponent(formId)}${appId ? `?appId=${encodeURIComponent(appId)}` : ''}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!r.ok) return null;
  const body = await r.json();
  // the endpoint answers {ok, config, appliedOverride, isCommon}
  const cfg = body && body.config ? body.config : body;
  configCache.set(key, { cfg, expires: Date.now() + CONFIG_TTL });
  return cfg;
}
