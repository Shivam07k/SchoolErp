import React, { useState, useEffect, useMemo } from 'react';
import { apiGet } from '../api';
import { navigate } from '../utils';
import DashBoardView from './DashBoardView';
import {
  getDashDesign, setDashDesign, resetDashDesign,
  DASH_PRESETS, STAT_ICONS, paletteFor,
} from '../dashboardDesign';
import DashChart, { toSeries, fmtNum } from './DashCharts';
import DashboardDesigner from './DashboardDesigner';

/* The API returns forms: [] today, so fall back to the menu tree the
   shell already loaded — no extra request, no behaviour change. */
function formsFromMenu(menu) {
  const out = [];
  const seen = new Set();
  for (const groups of Object.values(menu || {})) {
    for (const items of Object.values(groups)) {
      for (const it of items || []) {
        if (it.formId && !seen.has(it.formId)) {
          seen.add(it.formId);
          out.push({ formId: it.formId, title: it.title });
        }
      }
    }
  }
  return out.sort((a, b2) => String(a.title).localeCompare(String(b2.title)));
}

const CHIP_NAMES = ['blue', 'green', 'amber', 'red', 'cyan'];

export default function DashboardPage({ menu }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [design, setDesign] = useState(getDashDesign());
  const [designing, setDesigning] = useState(false);
  /* The board an administrator built, when one resolves for this person. It
     replaces the local design entirely; with no board the page behaves
     exactly as before. */
  const [board, setBoard] = useState(null);

  useEffect(() => {
    apiGet('/dashboard').then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  /* Which board should this person see? Re-checked whenever a builder saves,
     an assignment changes, or another tab picks a different board. */
  useEffect(() => {
    let live = true;
    const check = () => {
      apiGet('/dash/board/resolved')
        .then((r) => { if (live) setBoard(((r && r.resolved) || [])[0] || null); })
        .catch(() => { if (live) setBoard(null); });
    };
    check();
    window.addEventListener('board-refresh', check);
    return () => { live = false; window.removeEventListener('board-refresh', check); };
  }, []);

  /* Keep multiple tabs / windows in step. */
  useEffect(() => {
    const sync = (e) => {
      if (e.key === 'xerp_dash_design' || e.key === null) setDesign(getDashDesign());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const apply = (patch) => setDesign(setDashDesign(patch));
  const toggleBlock = (id) => apply({ blocks: { ...design.blocks, [id]: design.blocks[id] ? 0 : 1 } });

  const stats = data?.stats || {};
  const statEntries = Object.entries(stats);
  const series = useMemo(() => toSeries(stats), [stats]);
  const forms = data?.forms?.length ? data.forms : formsFromMenu(menu);
  const links = data?.links || [];
  const b = design.blocks;

  const isCustom = useMemo(() => {
    const p = DASH_PRESETS.find(x => x.key === design.preset);
    if (!p) return true;
    return Object.keys(p.blocks).some(k => !!p.blocks[k] !== !!b[k]);
  }, [design.preset, b]);

  const presetName = isCustom ? 'Custom' : (DASH_PRESETS.find(x => x.key === design.preset)?.name || 'Custom');
  const chartColors = paletteFor(design.palette);

  if (loading) return <div className="text-center py-5"><div className="spinner-border"></div></div>;

  /* A shared board wins over the local design. */
  if (board) return <DashBoardView board={board} />;

  const nothingOn = !b.stats && !b.charts && !b.links && !b.forms;

  return (
    <div className="page-content animate-fade">
      <div className="dash-head">
        <h5>Dashboard</h5>
        <span className="dash-preset-chip" title="Active dashboard design">
          <i className="bi bi-palette"></i>{presetName}
        </span>
        <div className="dash-head-actions">
          <button className="btn btn-sm btn-outline-primary" onClick={() => setDesigning(true)}>
            <i className="bi bi-sliders2 me-1"></i>Customize
          </button>
        </div>
      </div>

      {nothingOn && (
        <div className="dash-panel">
          <div className="dash-panel-body text-center py-5">
            <i className="bi bi-layout-text-window-reverse d-block mb-2" style={{ fontSize: 'calc(30px * var(--fs, 1))', color: 'var(--text-muted)' }}></i>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Every section is switched off</div>
            <div className="ddes-note mb-3">Turn a section back on, or pick one of the ready-made designs.</div>
            <button className="btn btn-sm btn-primary" onClick={() => setDesigning(true)}>
              <i className="bi bi-sliders2 me-1"></i>Open the designer
            </button>
          </div>
        </div>
      )}

      {b.stats ? (
        statEntries.length ? (
          <div className="dash-block">
            <div className="dash-stats" data-style={design.cardStyle} data-cols={design.columns}>
              {statEntries.map(([key, val], i) => {
                const c = chartColors[i % chartColors.length];
                return (
                  <div className="dcard" key={key} style={{ '--c': c }} title={key}>
                    <span className="dcard-topline"></span>
                    <span className="dcard-icon"><i className={`bi ${STAT_ICONS[i % STAT_ICONS.length]}`}></i></span>
                    <span className="dcard-body">
                      <span className="dcard-value">{fmtNum(val)}</span>
                      <span className="dcard-label">{key}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null
      ) : null}

      {b.charts ? (
        <div className="dash-block">
          <div className="dash-panel">
            <div className="dash-panel-head">
              <i className="bi bi-bar-chart-line"></i>Chart
              <div className="dash-panel-head-actions">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setDesigning(true)} title="Change chart design">
                  <i className="bi bi-palette"></i>
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleBlock('charts')} title="Hide this section">
                  <i className="bi bi-eye-slash"></i>
                </button>
              </div>
            </div>
            <div className="dash-panel-body">
              <DashChart type={design.chartType} data={series} palette={design.palette} showValues={!!design.showValues} />
            </div>
          </div>
        </div>
      ) : null}

      {b.links && links.length > 0 ? (
        <div className="dash-block">
          <div className="dash-panel">
            <div className="dash-panel-head">
              <i className="bi bi-lightning-charge"></i>Quick Links
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({links.length})</span>
              <div className="dash-panel-head-actions">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleBlock('links')} title="Hide this section">
                  <i className="bi bi-eye-slash"></i>
                </button>
              </div>
            </div>
            <div className="dash-panel-body">
              <div className="dash-links">
                {links.map((link, i) => (
                  <a key={i} className={`quick-chip chip-${CHIP_NAMES[i % CHIP_NAMES.length]}`}
                    href={link.url} target="_blank" rel="noreferrer">
                    <i className="bi bi-lightning-charge-fill"></i>{link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {b.forms && forms.length > 0 ? (
        <div className="dash-block">
          <div className="dash-panel">
            <div className="dash-panel-head">
              <i className="bi bi-grid"></i>Available Forms
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({forms.length})</span>
              <div className="dash-panel-head-actions">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleBlock('forms')} title="Hide this section">
                  <i className="bi bi-eye-slash"></i>
                </button>
              </div>
            </div>
            <div className="dash-panel-body">
              <div className="dash-forms" data-style="tile">
                {forms.map((f, i) => (
                  <div key={f.formId} className="dform" style={{ '--c': chartColors[i % chartColors.length] }}
                    onClick={() => navigate(`#/form/${f.formId}`)} title={f.title}>
                    <div className="dform-ic"><i className="bi bi-file-earmark-text"></i></div>
                    <div className="dform-tx">{f.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {designing && (
        <DashboardDesigner
          design={design}
          onChange={apply}
          onClose={() => setDesigning(false)}
          onReset={() => setDesign(resetDashDesign())}
        />
      )}
    </div>
  );
}
