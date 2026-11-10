import React, { useEffect, useState } from 'react';
import { apiLogin, setToken, getAppId, setAppId } from '../api';

export default function LoginPage({ onLogin }) {
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState('');
  const [ready, setReady] = useState(false);
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/companies')
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        const list = d.companies || [];
        setCompanies(list);
        const saved = getAppId();
        const remembered = list.some(c => c.id === saved);
        if (!remembered) setAppId('');
        setCompany(remembered ? saved : (list.length ? list[0].id : ''));
      })
      .catch(() => {})
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const current = companies.find(c => c.id === company);

  const choose = (id) => {
    setAppId(id);
    setCompany(id);
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await apiLogin(userid, password, company);
      if (r.ok) { setToken(r.token); onLogin(r.user); }
      else setError(r.error || 'Login failed');
    } catch (err) { setError('Connection error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-brand-side">
        <div className="brand-icon">x</div>
        <h2>xErp</h2>
        <p>Enterprise Resource Planning System</p>
      </div>
      <div className="login-form-side">
        {!ready ? (
          <div className="login-card animate-scale text-center py-5">
            <span className="spinner-border text-primary"></span>
          </div>
        ) : !company || !current ? (
          <div className="login-card animate-scale">
            <h4>Select company</h4>
            <p className="subtitle">Choose the company database to sign in to</p>
            <div className="company-list">
              {companies.map(c => (
                <button key={c.id} type="button" className="company-option" onClick={() => choose(c.id)}>
                  <i className={`bi ${c.id === 'mahajan' ? 'bi-building' : 'bi-database'} company-option-icon`}></i>
                  <span className="company-option-name">{c.label || c.id}</span>
                  <span className="company-option-id">{c.id}</span>
                </button>
              ))}
            </div>
            {companies.length === 0 && <div className="alert alert-warning py-2" style={{ fontSize: 'calc(12px * var(--fs, 1))' }}>No companies configured on the server.</div>}
          </div>
        ) : (
          <div className="login-card animate-scale">
            <div className="company-chip" title="Selected company">
              <i className="bi bi-database me-1"></i>
              {current.label || current.id}
              <button type="button" className="company-switch" title="Switch company" onClick={() => { setAppId(''); setCompany(''); setError(''); }}>
                <i className="bi bi-arrow-left-right"></i>
              </button>
            </div>
            <h4>Welcome back</h4>
            <p className="subtitle">Sign in to {current.label || current.id}</p>
            {error && <div className="alert alert-danger py-2" style={{ fontSize: 'calc(12px * var(--fs, 1))' }}>{error}</div>}
            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label">User ID</label>
                <input type="text" className="form-control" value={userid} onChange={e => setUserid(e.target.value)} autoFocus placeholder="Enter user ID" />
              </div>
              <div className="mb-3">
                <label className="form-label">Password</label>
                <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading || !company}>
                {loading ? <><span className="spinner-border spinner-border-sm me-1"></span> Signing in...</> : <><i className="bi bi-arrow-right"></i> Sign in</>}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}