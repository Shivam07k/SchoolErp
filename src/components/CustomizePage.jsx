import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { toast } from '../toast';
import WidgetBuilder from './WidgetBuilder';
import DashWidget from './DashWidget';
import MenuBuilder from './MenuBuilder';
import DashboardBuilder from './DashboardBuilder';
import { toSpec, fromSpec, defaultWidget, parseSpec } from '../widgetSpec';

const TABS = [
  { key: 'sidebar', icon: 'bi-layout-sidebar', label: 'Sidebar' },
  { key: 'dashboard', icon: 'bi-grid-1x2', label: 'Dashboard' },
  { key: 'boards', icon: 'bi-grid-3x3-gap', label: 'Boards' },
  { key: 'pages', icon: 'bi-file-earmark-code', label: 'Dynamic Pages' },
];

const blank = (o = {}) => ({ id: null, ...o });

function Row({ children, className = '' }) {
  return <div className={`cz-row ${className}`}>{children}</div>;
}

function Field({ label, children, hint }) {
  return (
    <div className="cz-field">
      <label>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export default function CustomizePage({ onClose }) {
  const [tab, setTab] = useState('sidebar');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      setData(await apiGet('/dash/bootstrap'));
    } catch (e) {
      setErr(e.message || 'Could not load');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* The sidebar is held in the app, so anything that changes who sees which
     menu has to be pushed out to it rather than waiting for a reload. */
  const onMenuChanged = useCallback(() => {
    window.dispatchEvent(new Event('menu-refresh'));
  }, []);

  /* Same idea for the dashboard boards: the open dashboard re-resolves. */
  const onBoardChanged = useCallback(() => {
    window.dispatchEvent(new Event('board-refresh'));
  }, []);

  /* Returns the response on success and null on failure, so a caller can tell
     whether it is safe to clear the form. Never rejects, because these are
     click handlers and an unhandled rejection would only spam the console. */
  const act = async (fn, msg) => {
    setBusy(true);
    try {
      const r = await fn();
      /* apiPost/apiDelete resolve with {error} instead of throwing, so a
         refused save would otherwise be reported as a success. */
      if (r && r.error) {
        toast(r.error, 'error');
        return null;
      }
      toast(r?.message || msg || 'Done');
      await load();
      return r;
    } catch (e) {
      toast(e.message || 'Failed', 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (err) {
    return (
      <div className="page-content animate-fade">
        <div className="cz-empty">
          <i className="bi bi-exclamation-triangle"></i>
          <div>{err}</div>
          <button className="btn btn-sm btn-outline-primary" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-content animate-fade">
        <div className="cz-empty"><div className="spinner-border spinner-border-sm"></div></div>
      </div>
    );
  }

  return (
    <div className="page-content animate-fade cz">
      <div className="cz-head">
        <div>
          <h5>Customize</h5>
          <small className="cz-sub">Sidebar, dashboard and dynamic pages, shared with everyone in this company</small>
        </div>
        <div className="cz-head-actions">
          {busy && <span className="spinner-border spinner-border-sm"></span>}
          <button className="btn btn-sm btn-outline-secondary" onClick={load} disabled={busy}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
          <button className="btn btn-sm btn-outline-primary" onClick={onClose}>
            <i className="bi bi-x-lg me-1"></i>Close
          </button>
        </div>
      </div>

      <div className="cz-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`cz-tab ${tab === t.key ? 'on' : ''}`}
            onClick={() => setTab(t.key)}>
            <i className={`bi ${t.icon}`}></i><span>{t.label}</span>
            <em>{tabCount(t.key, data)}</em>
          </button>
        ))}
      </div>

      {tab === 'sidebar' && <MenuBuilder data={data} act={act} me={data.me} busy={busy} onChanged={onMenuChanged} />}
      {tab === 'dashboard' && <DashboardTab data={data} act={act} busy={busy} />}
      {tab === 'boards' && <DashboardBuilder data={data} act={act} me={data.me} busy={busy} onChanged={onBoardChanged} />}
      {tab === 'pages' && <PagesTab data={data} act={act} busy={busy} />}    </div>
  );
}

function tabCount(key, d) {
  if (key === 'sidebar') return (d.menuSets || []).length;
  if (key === 'dashboard') return (d.pages || []).length;
  if (key === 'boards') return (d.boards || []).length;
  return (d.dynPages || []).length;
}

/* ------------------------------ Dashboard tab ------------------------------ */

function DashboardTab({ data, act, busy }) {
  const pages = data.pages || [];
  const [slug, setSlug] = useState(pages[0]?.slug || '');
  const [editing, setEditing] = useState('');       /* original slug, '' = new */
  const [pEdit, setPEdit] = useState(blank({ title: '', slug: '', description: '', kind: 'dashboard', isHome: false, sort: 0 }));
  const [wEdit, setWEdit] = useState(blank({ name: '', chartType: 'kpi', query: '', sort: 0 }));

  const widgets = useMemo(
    () => (data.widgets || []).filter(w => w.pageSlug === slug),
    [data.widgets, slug]);

  const page = useMemo(
    () => (data.pages || []).find(p => p.slug === slug) || null,
    [data.pages, slug]);

  const clearPage = () => {
    setEditing('');
    setPEdit(blank({ title: '', slug: '', description: '', kind: 'dashboard', isHome: false, sort: 0 }));
  };

  /* sp_dash_page_list carries no numeric id: the slug is the identity. */
  const editPage = (p) => {
    setEditing(p.slug);
    setSlug(p.slug);
    setPEdit(blank({
      title: p.title || '', slug: p.slug, description: p.description || '',
      kind: p.kind || 'dashboard', isHome: !!p.isHome, sort: p.sortOrder ?? 0,
      layout: p.layout, style: p.style,
    }));
  };

  /* A spec holds no appearance at all: chart type lives on the widget row and
     the palette in its style, because a kpi that is also split by a column has
     to be stored as a bar for the SQL to group correctly. So the row is the
     only place the display type survives, and it wins. */
  const toWidgetEdit = (w) => {
    const spec = parseSpec(w.query);
    const type = w.chartType || 'bar';
    const style = w.style || {};
    setWEdit(blank({
      name: w.name || '', chartType: type, sort: w.sortOrder ?? 0,
      layout: w.layout, style,
      build: {
        ...(spec && spec.mode === 'builder' ? fromSpec(spec) : defaultWidget()),
        chartType: type,
        palette: style.palette || 'accent',
        showValues: style.showValues !== false,
      },
    }));
  };
  const clearWidget = () => setWEdit(blank({
    name: '', chartType: 'bar', sort: 0, build: defaultWidget(),
  }));

  const savePage = async () => {
    const r = await act(() => apiPost('/dash/page/save', pEdit), 'Page saved');
    if (r) clearPage();
  };

  /* The widget form keeps its settings in a builder object; the database wants
     the spec that object turns into. The form is only cleared once the save is
     actually accepted, so a refusal does not throw away the work. */
  const saveWidget = async () => {
    const b = wEdit.build || defaultWidget();
    const r = await act(() => apiPost('/dash/widget/save', {
      id: wEdit.id || null,
      pageSlug: slug,
      name: wEdit.name,
      chartType: b.chartType,
      query: JSON.stringify(toSpec(b)),
      layout: wEdit.layout,
      style: { palette: b.palette, showValues: b.showValues !== false, ...(wEdit.style || {}) },
      sort: wEdit.sort ?? 0,
    }), 'Widget saved');
    if (r) clearWidget();
  };

  return (
    <div className="cz-grid-2">
      <div className="cz-card">
        <h6><i className="bi bi-window me-1"></i>Pages</h6>
        <div className="cz-list">
          {pages.length === 0 && <div className="cz-empty sm">No page yet.</div>}
          {pages.map(p => (
            <div key={p.slug} className={`cz-item ${p.slug === slug ? 'on' : ''}`}
              onClick={() => setSlug(p.slug)}>
              <div className="cz-item-main">
                <strong>{p.title}</strong>
                <small>{p.slug} · {p.widgets ?? 0} widget{p.widgets === 1 ? '' : 's'}</small>
              </div>
              <div className="cz-flags">
                {p.isHome ? <span className="badge text-bg-success">Home</span> : null}
                <button className="cz-mini" title="Edit"
                  onClick={e => { e.stopPropagation(); editPage(p); }}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button className="cz-mini danger" title="Delete"
                  onClick={e => {
                    e.stopPropagation();
                    if (!window.confirm(`Delete "${p.title}" and its widgets?`)) return;
                    if (slug === p.slug) setSlug('');
                    act(() => apiDelete(`/dash/page/${p.slug}`), 'Deleted');
                  }}>
                  <i className="bi bi-trash3"></i>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="cz-form">
          <h6 className="cz-form-h">{editing ? 'Edit page' : 'New page'}</h6>
          <Row>
            <Field label="Title">
              <input className="form-control form-control-sm" value={pEdit.title || ''}
                onChange={e => setPEdit({ ...pEdit, title: e.target.value })} />
            </Field>
            <Field label="Slug" hint="Letters, numbers, dash, underscore">
              <input className="form-control form-control-sm" value={pEdit.slug || ''}
                disabled={!!editing}
                onChange={e => setPEdit({ ...pEdit, slug: e.target.value })} />
            </Field>
          </Row>
          <Row>
            <Field label="Kind">
              <select className="form-select form-select-sm" value={pEdit.kind || 'dashboard'}
                onChange={e => setPEdit({ ...pEdit, kind: e.target.value })}>
                <option value="dashboard">Dashboard</option>
                <option value="page">Page</option>
              </select>
            </Field>
            <Field label="Description">
              <input className="form-control form-control-sm" value={pEdit.description || ''}
                onChange={e => setPEdit({ ...pEdit, description: e.target.value })} />
            </Field>
            <Field label="Order">
              <input type="number" className="form-control form-control-sm" value={pEdit.sort ?? 0}
                onChange={e => setPEdit({ ...pEdit, sort: Number(e.target.value) })} />
            </Field>
          </Row>
          <Field label="Home page">
            <div className="form-check">
              <input className="form-check-input" type="checkbox" id="czPageHome"
                checked={!!pEdit.isHome}
                onChange={e => setPEdit({ ...pEdit, isHome: e.target.checked })} />
              <label className="form-check-label" htmlFor="czPageHome">Show at start</label>
            </div>
          </Field>
          <div className="cz-actions">
            <button className="btn btn-sm btn-primary" disabled={!pEdit.title?.trim() || busy}
              onClick={savePage}>
              {editing ? 'Save changes' : 'Create page'}
            </button>
            {editing && (
              <button className="btn btn-sm btn-outline-secondary" onClick={clearPage}>Cancel</button>
            )}
          </div>
        </div>
      </div>

      <div className="cz-card">
        <h6><i className="bi bi-bar-chart me-1"></i>Widgets{slug ? ` — ${slug}` : ''}</h6>
        {!slug ? <div className="cz-empty sm">Pick a page on the left.</div> : (
          <>
            <div className="cz-list">
              {widgets.length === 0 && <div className="cz-empty sm">No widget on this page.</div>}
              {widgets.map(w => (
                <div key={w.id} className="cz-item">
                  <div className="cz-item-main">
                    <strong>{w.name}</strong>
                    <small>{w.chartType}</small>
                  </div>
                  <div className="cz-flags">
                    <button className="cz-mini" title="Edit" onClick={() => toWidgetEdit(w)}>
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button className="cz-mini danger" title="Delete"
                      onClick={() => act(() => apiDelete(`/dash/widget/${w.id}`), 'Deleted')}>
                      <i className="bi bi-trash3"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cz-form">
              <h6 className="cz-form-h">{wEdit.id ? 'Edit widget' : 'Add widget'}</h6>
              <Row>
                <Field label="Name">
                  <input className="form-control form-control-sm" value={wEdit.name || ''}
                    onChange={e => setWEdit({ ...wEdit, name: e.target.value })} />
                </Field>
                <Field label="Order">
                  <input type="number" className="form-control form-control-sm" value={wEdit.sort ?? 0}
                    onChange={e => setWEdit({ ...wEdit, sort: Number(e.target.value) })} />
                </Field>
              </Row>
              <WidgetBuilder value={wEdit.build} onChange={(b) => setWEdit({ ...wEdit, build: b })} />
              <div className="cz-actions">
                <button className="btn btn-sm btn-primary"
                  disabled={!wEdit.name?.trim() || !wEdit.build?.table || busy}
                  onClick={saveWidget}>
                  {wEdit.id ? 'Save changes' : 'Add widget'}
                </button>
                {wEdit.id && (
                  <button className="btn btn-sm btn-outline-secondary" onClick={clearWidget}>Cancel</button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="cz-card cz-wide">
        <h6>
          <i className="bi bi-eye me-1"></i>Page preview
          {page ? ` — ${page.title}` : ''}
        </h6>
        {!page ? <div className="cz-empty sm">Pick a page to see it as everyone else will.</div> : (
          <>
            {widgets.length === 0
              ? <div className="cz-empty sm">This page has no widgets yet.</div>
              : (
                <div className="cz-prev-grid">
                  {widgets.map(w => (
                    <DashWidget key={w.id} widget={w}
                      className={String(wEdit.id) === String(w.id) ? 'editing' : ''} />
                  ))}
                </div>
              )}
            {wEdit.id && (
              <div className="cz-note mt-2">
                The widget you are editing is outlined. It is not on the page until you save it.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Dynamic Pages tab ---------------------------- */

function PagesTab({ data, act, busy }) {
  const pages = data.dynPages || [];
  const [editing, setEditing] = useState('');
  const [edit, setEdit] = useState(blank({
    title: '', slug: '', description: '', icon: '', mode: 'builder', config: '{}', sort: 0,
  }));

  /* config is jsonb in the table, so the textarea always holds JSON text. */
  const toEdit = (p) => {
    setEditing(p.slug);
    setEdit(blank({
      title: p.title || '', slug: p.slug, description: p.description || '',
      icon: p.icon || '', mode: p.mode || 'builder',
      config: JSON.stringify(p.config || {}, null, 2), sort: p.sortOrder ?? 0,
      style: p.style,
    }));
  };
  const clear = () => {
    setEditing('');
    setEdit(blank({ title: '', slug: '', description: '', icon: '', mode: 'builder', config: '{}', sort: 0 }));
  };

  return (
    <div className="cz-grid-1">
      <div className="cz-card">
        <h6><i className="bi bi-file-earmark-code me-1"></i>Dynamic pages</h6>
        <p className="cz-note">
          A page is made of sections you build from tables, or a read-only SQL query.
          Give it a slug and it can be placed in a menu.
        </p>
        <div className="cz-list">
          {pages.length === 0 && <div className="cz-empty sm">No dynamic page yet.</div>}
          {pages.map(p => (
            <div key={p.slug} className="cz-item">
              <i className={`bi ${p.icon || 'bi-file-earmark'} cz-ic`}></i>
              <div className="cz-item-main">
                <strong>{p.title}</strong>
                <small>{p.slug} · {p.mode}</small>
              </div>
              <div className="cz-flags">
                <button className="cz-mini" title="Edit" onClick={() => toEdit(p)}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button className="cz-mini danger" title="Delete"
                  onClick={() => {
                    if (!window.confirm(`Delete "${p.title}"?`)) return;
                    act(() => apiDelete(`/dash/dyn/${p.slug}`), 'Deleted');
                  }}>
                  <i className="bi bi-trash3"></i>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="cz-form">
          <h6 className="cz-form-h">{editing ? 'Edit page' : 'New dynamic page'}</h6>
          <Row>
            <Field label="Title">
              <input className="form-control form-control-sm" value={edit.title || ''}
                onChange={e => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            <Field label="Slug" hint="Used in the menu">
              <input className="form-control form-control-sm" value={edit.slug || ''}
                disabled={!!editing}
                onChange={e => setEdit({ ...edit, slug: e.target.value })} />
            </Field>
            <Field label="Icon">
              <input className="form-control form-control-sm" value={edit.icon || ''}
                onChange={e => setEdit({ ...edit, icon: e.target.value })} placeholder="bi-graph-up" />
            </Field>
          </Row>
          <Row>
            <Field label="Mode">
              <select className="form-select form-select-sm" value={edit.mode || 'builder'}
                onChange={e => setEdit({ ...edit, mode: e.target.value })}>
                <option value="builder">Builder</option>
                <option value="sql">SQL</option>
              </select>
            </Field>
            <Field label="Order">
              <input type="number" className="form-control form-control-sm" value={edit.sort ?? 0}
                onChange={e => setEdit({ ...edit, sort: Number(e.target.value) })} />
            </Field>
          </Row>
          <Field label="Description">
            <input className="form-control form-control-sm" value={edit.description || ''}
              onChange={e => setEdit({ ...edit, description: e.target.value })} />
          </Field>
          <Field label="Configuration" hint="JSON">
            <textarea className="form-control form-control-sm cz-code" rows={8}
              value={edit.config || '{}'}
              onChange={e => setEdit({ ...edit, config: e.target.value })} />
          </Field>
          <div className="cz-actions">
            <button className="btn btn-sm btn-primary" disabled={!edit.title?.trim() || busy}
              onClick={async () => {
                await act(() => apiPost('/dash/dyn/save', edit), 'Page saved');
                clear();
              }}>
              {editing ? 'Save changes' : 'Create page'}
            </button>
            {editing && (
              <button className="btn btn-sm btn-outline-secondary" onClick={clear}>Cancel</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
