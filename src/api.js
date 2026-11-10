const API_BASE = '/api';

// sessionStorage is per-tab (not shared across browser tabs/windows), so each
// window keeps its own login + company instead of clobbering the other tab's.
export function getToken() { return sessionStorage.getItem('xerp_token') || ''; }
export function setToken(t) { sessionStorage.setItem('xerp_token', t); }
export function clearToken() { sessionStorage.removeItem('xerp_token'); }
export function getAppId() { return sessionStorage.getItem('xerp_appId') || ''; }
export function setAppId(a) { sessionStorage.setItem('xerp_appId', a); }

export async function apiCall(action, formId, data = {}) {
  const body = { formId, action, token: getToken(), appId: getAppId(), ...data };
  const res = await fetch(`${API_BASE}/crud`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiGet(url) {
  const res = await fetch(`${API_BASE}${url}`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Expected JSON but got ${contentType}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error) console.warn('API warning:', url, data.error);
  return data;
}

export async function apiPost(url, data) {
  const res = await fetch(`${API_BASE}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify(data) });
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Expected JSON but got ${contentType}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.error) console.warn('API warning:', url, json.error);
  return json;
}

export async function apiPut(url, data) {
  const res = await fetch(`${API_BASE}${url}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify(data) });
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Expected JSON but got ${contentType}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.error) console.warn('API warning:', url, json.error);
  return json;
}

export async function apiDelete(url) {
  const res = await fetch(`${API_BASE}${url}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } });
  const data = await res.json();
  if (data.error) console.warn('API warning:', url, data.error);
  return data;
}

export async function apiUpload(url, file, context) {
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'X-Upload-Context': context,
    },
    body: form,
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `Upload failed: ${res.status}`);
  return data;
}

export async function openApiFile(url) {
  if (!String(url || '').startsWith('/api/school/uploads/')) {
    return window.open(url, '_blank', 'noopener,noreferrer');
  }
  const tab = window.open('about:blank', '_blank');
  if (!tab) throw new Error('Allow pop-ups to open this file');
  try {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${getToken()}` } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Could not open file: ${res.status}`);
    }
    const objectUrl = URL.createObjectURL(await res.blob());
    tab.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return tab;
  } catch (error) {
    tab.close();
    throw error;
  }
}

export async function apiLogin(userid, password, company) {
  const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userid, password, company }) });
  return res.json();
}

// Expose quick log helper: call _log() in browser console to open the log viewer.
window._log = function() {
  window.dispatchEvent(new Event('open-logs'));
};
