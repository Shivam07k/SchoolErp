import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { getToken, clearToken, getAppId, apiGet } from './api';
import { navigate } from './utils';
import SchoolSidebar from './components/SchoolSidebar';
import LoginPage from './components/LoginPage';
import ThemeSettings from './components/ThemeSettings';
import LogsPanel from './components/LogsPanel';
import { applyTheme } from './theme';
import { toast } from './toast';
import { SCHOOL_MENU, findRoute } from './school/menu';

const SchoolPage = lazy(() => import('./components/SchoolPage'));

function PageSpinner() {
  return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary"></div>
    </div>
  );
}

function parseSchoolHash() {
  const hash = window.location.hash || '#/school/dashboard';
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] !== 'school') return { module: 'dashboard', sub: '', rest: [] };
  return { module: parts[1] || 'dashboard', sub: parts[2] || '', rest: parts.slice(3) };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [me, setMe] = useState(null);
  const [route, setRoute] = useState(parseSchoolHash);
  const [companyLabel, setCompanyLabel] = useState(getAppId());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [campusId, setCampusId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');

  useEffect(() => {
    applyTheme();
    fetch('/api/env').then((r) => r.json()).then((d) => setIsDev(!!d.dev)).catch(() => {});
    fetch('/api/auth/companies').then((r) => r.json()).then((d) => {
      const list = d.companies || [];
      const cur = list.find((c) => c.id === getAppId());
      if (cur) setCompanyLabel(cur.label || cur.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const open = () => setLogsOpen(true);
    window.addEventListener('open-logs', open);
    return () => window.removeEventListener('open-logs', open);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    apiGet('/auth/me').then((d) => {
      const u = d?.user || {};
      setUser({ userid: u.userid || 'token', name: u.name || u.userid, grp: u.grp || '' });
    }).catch(() => setUser({ userid: 'token' }));
    loadMe();
  }, []);

  useEffect(() => {
    const onHash = () => {
      const next = parseSchoolHash();
      const hash = window.location.hash || '';
      if (!hash.startsWith('#/school')) {
        navigate('#/school/dashboard');
        setRoute({ module: 'dashboard', sub: '', rest: [] });
        return;
      }
      setRoute(next);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setSidebarMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  async function loadMe() {
    try {
      const d = await apiGet('/school/me');
      if (!d?.ok) throw new Error(d?.error || 'Could not load school access');
      const profile = d.me || d;
      setMe(profile);
      const savedCampus = Number(localStorage.getItem('school_campus_id') || 0);
      const campus = (profile.campuses || []).find((c) => c.id === savedCampus) ? savedCampus : profile.defaultCampusId;
      const savedYear = Number(localStorage.getItem('school_academic_year_id') || 0);
      const year = (profile.academicYears || []).find((y) => y.id === savedYear) ? savedYear : profile.activeAcademicYearId;
      setCampusId(campus || '');
      setAcademicYearId(year || '');
    } catch (e) {
      toast(e.message || 'Could not load school access', 'error');
    }
  }

  const go = (path) => {
    if (!path) return;
    navigate(path.startsWith('#') ? path : `#${path}`);
  };

  const changeCampus = (value) => {
    setCampusId(value);
    if (value) localStorage.setItem('school_campus_id', String(value));
    else localStorage.removeItem('school_campus_id');
  };
  const changeYear = (value) => {
    setAcademicYearId(value);
    if (value) localStorage.setItem('school_academic_year_id', String(value));
    else localStorage.removeItem('school_academic_year_id');
  };

  const toggleSidebar = () => {
    if (window.innerWidth <= 768) setSidebarMobileOpen((o) => !o);
    else setSidebarOpen((o) => !o);
  };

  const title = useMemo(() => {
    const found = findRoute(route.module, route.sub);
    if (!found) return 'School ERP';
    return found.child ? `${found.module.label} / ${found.child.label}` : found.module.label;
  }, [route]);

  if (!user) {
    return (
      <LoginPage
        onLogin={(u) => {
          setUser(u);
          loadMe();
          // Redirect to dashboard after login
          navigate('#/school/dashboard');
        }}
      />
    );
  }

  return (
    <div className="app-layout">
      <div className={`sidebar-backdrop ${sidebarMobileOpen ? 'show' : ''}`} onClick={() => setSidebarMobileOpen(false)} />
      <SchoolSidebar
        me={me}
        currentModule={route.module}
        currentSub={route.sub}
        onNavigate={go}
        mobileOpen={sidebarMobileOpen}
        onCloseMobile={() => setSidebarMobileOpen(false)}
        desktopHidden={!sidebarOpen}
      />
      <div className="main-content">
        <nav className="page-header">
          <div className="d-flex align-items-center gap-2">
            <button className="app-hamburger" onClick={toggleSidebar} aria-label="Toggle menu">
              <i className="bi bi-list"></i>
            </button>
            <h1>{title}</h1>
          </div>
          <div className="header-controls">
            {!!me?.campuses?.length && (
              <select
                className="header-select"
                value={campusId}
                onChange={(e) => changeCampus(e.target.value)}
                aria-label="Campus"
                title="Campus"
              >
                {me.campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {!!me?.academicYears?.length && (
              <select
                className="header-select"
                value={academicYearId}
                onChange={(e) => changeYear(e.target.value)}
                aria-label="Academic year"
                title="Academic year"
              >
                {me.academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}{y.is_active ? ' (active)' : ''}</option>
                ))}
              </select>
            )}
            <span className="school-chip company-chip" title="Current school/college">
              <i className="bi bi-mortarboard me-1"></i>
              {companyLabel || getAppId() || 'School'}
            </span>
            <button className="btn btn-sm btn-outline-light" onClick={() => setLogsOpen(true)} title="Activity Logs">
              <i className="bi bi-journal-text"></i>
            </button>
            <ThemeSettings />
            <div className="user-chip" title={user?.userid}>
              <span className="user-chip-name">{user?.name || user?.userid || 'User'}</span>
              {user?.grp && <span className="user-chip-designation">{user.grp}</span>}
            </div>
            <button className="btn btn-sm btn-outline-light" onClick={() => { clearToken(); setUser(null); setMe(null); }} title="Logout">
              <i className="bi bi-box-arrow-right"></i>
            </button>
          </div>
        </nav>
        <main className="main-area">
          <div className="page-scroll">
            <Suspense fallback={<PageSpinner />}>
              {me ? (
                <SchoolPage
                  key={`${route.module}/${route.sub}/${(route.rest || []).join('/')}`}
                  module={route.module}
                  sub={route.sub}
                  rest={route.rest || []}
                  me={me}
                  campusId={campusId}
                  academicYearId={academicYearId}
                  onNavigate={go}
                  onRefreshMe={loadMe}
                />
              ) : <PageSpinner />}
            </Suspense>
          </div>
          <footer className="app-footer">
            <div className="app-footer-left">
              <span>School ERP &copy; 2026</span>
              <a href="#/school/dashboard">Dashboard</a>
            </div>
            <div className="app-footer-right">
              {me?.branding?.instituteName && <span className="me-2">{me.branding.instituteName}</span>}
              <span style={{ fontSize: 'calc(10px * var(--fs, 1))', color: 'var(--text-muted)' }}>v0.2.0</span>
            </div>
          </footer>
        </main>
        </div>
      <LogsPanel open={logsOpen} onClose={() => setLogsOpen(false)} />
    </div>
  );
}
