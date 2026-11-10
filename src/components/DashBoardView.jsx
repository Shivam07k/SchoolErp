import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api';
import { navigate } from '../utils';
import DashWidget from './DashWidget';

/* Draws a resolved dashboard board as a full-fledged page. It reuses the same
   building blocks the classic dashboard page uses — the vivid gradient stat
   cards, the quick-link chips and the coloured form tiles — so it reads like a
   real dashboard, not a builder preview. A section becomes whichever of those
   its cards were built as:
     - card links carrying a colour  -> a band of big gradient stat cards
     - card links with no colour     -> a grid of colourful form tiles
     - box links                     -> a row of quick-link chips
   The page has no toolbar and no builder chrome; the only thing an
   administrator edits is the links themselves, in Customize → Boards. */

const ITEM_STYLES = ['link', 'box', 'card'];
const CHIP_NAMES = ['blue', 'green', 'amber', 'red', 'cyan'];
const TILE_COLORS = ['#4f6ef7', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
  '#8b5cf6', '#f97316', '#84cc16', '#e11d48'];

const styleOf = (item, section) => {
  const s = (item.style && item.style.itemStyle) || (section.style && section.style.itemStyle) || 'card';
  return ITEM_STYLES.includes(s) ? s : 'card';
};

const colsOf = (section) => {
  const c = Number(section.style && section.style.cols) || 4;
  return Math.max(1, Math.min(8, c));
};

const openTarget = (kind, target) => {
  if (kind === 'url') window.open(target, '_blank', 'noopener');
  else if (kind === 'form') navigate(`#/form/${target}`);
  else navigate('#/dashboard');
};

/* Restful top of the page: greeting + date, tinted by the page's own colour. */
function DasHero({ color }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const date = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="dash-hero" style={{ '--c': color || '#3b82f6' }}>
      <div className="dash-hero-txt">
        <span className="dash-hero-kicker"><i className="bi bi-grid-3x3-gap"></i>Dashboard</span>
        <h2>{greeting}</h2>
        <p>{date}</p>
      </div>
      <div className="dash-hero-orb"><i className="bi bi-stars"></i></div>
    </div>
  );
}

/* ── the three tile types, all styled by the classic dashboard ─────────── */

/* Big vivid gradient stat-card, navigates like a link. */
function GradCard({ item, fallback, index }) {
  const color = item.color || fallback || TILE_COLORS[index % TILE_COLORS.length];
  const icon = item.icon || 'bi-file-earmark-text';
  const hint = item.kind === 'url' ? (item.target || 'opened in a new tab') : 'Open this page';
  const cls = `dcard db-hero${item.kind === 'url' ? ' db-ext' : ''}`;
  const inner = (
    <>
      <span className="dcard-topline"></span>
      <span className="dcard-icon"><i className={`bi ${icon}`}></i></span>
      <span className="dcard-body">
        <span className="dcard-label">{item.label}</span>
        <span className="dcard-sub">{hint}</span>
      </span>
    </>
  );
  if (item.kind === 'url') {
    return (
      <a className={cls} style={{ '--c': color }} title={item.label}
        href={item.target || '#'} target={item.openNew === false ? undefined : '_blank'}
        rel="noreferrer noopener">{inner}</a>
    );
  }
  return (
    <div className={cls} style={{ '--c': color }} title={item.label}
      onClick={() => openTarget(item.kind, item.target)}>{inner}</div>
  );
}

/* Colourful small tile, like the "Available Forms" grid. */
function FormTile({ item, index }) {
  const color = item.color || TILE_COLORS[index % TILE_COLORS.length];
  const icon = item.icon || 'bi-file-earmark-text';
  const cls = `dform${item.kind === 'url' ? ' db-ext' : ''}`;
  const inner = (
    <>
      <div className="dform-ic"><i className={`bi ${icon}`}></i></div>
      <div className="dform-tx">{item.label}</div>
    </>
  );
  if (item.kind === 'url') {
    return (
      <a className={cls} style={{ '--c': color }} title={item.label}
        href={item.target || '#'} target={item.openNew === false ? undefined : '_blank'}
        rel="noreferrer noopener">{inner}</a>
    );
  }
  return <div className={cls} style={{ '--c': color }} title={item.label}
    onClick={() => openTarget(item.kind, item.target)}>{inner}</div>;
}

/* Quick-link chip pill. */
function QuickChip({ item, index }) {
  const tinted = item.color ? { '--c': item.color } : undefined;
  const cls = `quick-chip ${item.color ? 'qc-tint' : `chip-${CHIP_NAMES[index % CHIP_NAMES.length]}`}`;
  const inner = <><i className="bi bi-lightning-charge-fill"></i>{item.label}</>;
  if (item.kind === 'url') {
    return (
      <a className={cls} style={tinted} href={item.target || '#'} title={item.target || item.label}
        target={item.openNew === false ? undefined : '_blank'} rel="noreferrer noopener">{inner}</a>
    );
  }
  return (
    <a className={cls} style={tinted} title={item.target || item.label} href="#"
      onClick={(e) => { e.preventDefault(); openTarget(item.kind, item.target); }}>{inner}</a>
  );
}

/* Plain link list. */
function PlainLink({ item, index }) {
  const color = item.color || TILE_COLORS[index % TILE_COLORS.length];
  const icon = item.icon || 'bi-file-earmark-text';
  const cls = `db-linkrow${item.kind === 'url' ? ' db-ext' : ''}`;
  const inner = <><i className={`bi ${icon}`}></i><span>{item.label}</span></>;
  if (item.kind === 'url') {
    return (
      <a className={cls} style={{ '--c': color }} href={item.target || '#'} title={item.label}
        target={item.openNew === false ? undefined : '_blank'} rel="noreferrer noopener">{inner}</a>
    );
  }
  return <div className={cls} style={{ '--c': color }} title={item.label}
    onClick={() => openTarget(item.kind, item.target)}>{inner}</div>;
}

/* A KPI/report card: the shared widget, wrapped so it matches a stat card. */
function KpiCard({ item, fallback, index }) {
  const color = item.color || fallback || TILE_COLORS[index % TILE_COLORS.length];
  const icon = item.icon || 'bi-graph-up';
  return (
    <div className="dcard db-kpic" style={{ '--c': color }}>
      <span className="dcard-topline"></span>
      <span className="dcard-icon"><i className={`bi ${icon}`}></i></span>
      <span className="dcard-body db-kpic-body">
        <DashWidget widget={{
          name: item.label || '…',
          chartType: item.chartType || 'kpi',
          query: item.query || {},
          style: item.style || {},
        }} />
      </span>
    </div>
  );
}

/* One band of the dashboard; sections fade in one after another. */
function BoardSection({ section, kids, index }) {
  const cols = colsOf(section);
  const is = styleOf({}, section);
  const secColor = section.color || '';

  const kpiRows = kids.filter((k) => k.kind === 'kpi');
  const linkRows = kids.filter((k) => k.kind !== 'kpi');
  const cardWithColour = is === 'card' && linkRows.length > 0 &&
    linkRows.every((k) => !!k.color);

  const tile = (it, i) => {
    if (it.kind === 'kpi') return <KpiCard key={it.id} item={it} fallback={secColor} index={i} />;
    if (is === 'box') return <QuickChip key={it.id} item={it} index={i} />;
    if (is === 'link') return <PlainLink key={it.id} item={it} index={i} />;
    return cardWithColour
      ? <GradCard key={it.id} item={it} fallback={secColor} index={i} />
      : <FormTile key={it.id} item={it} index={i} />;
  };

  return (
    <div className="dash-board-sec" style={secColor ? { '--sec-c': secColor, animationDelay: `${index * 55}ms` } : { animationDelay: `${index * 55}ms` }}>
      <div className="dash-board-sec-h">
        <i className={`bi ${section.icon || 'bi-folder'}`}></i>
        <span>{section.label}</span>
      </div>
      {is === 'box' ? (
        <div className="dash-links">
          {kids.map(tile)}
        </div>
      ) : is === 'link' ? (
        <div className="db-linklist">
          {kids.map(tile)}
        </div>
      ) : (
        <div className="dash-stats" data-style="gradient" data-cols={cols}>
          {kids.map(tile)}
        </div>
      )}
    </div>
  );
}

/* Placeholder the parent shows while nothing has resolved yet. */
export function BoardLoading() {
  return <div className="cz-empty sm py-4"><span className="spinner-border spinner-border-sm"></span></div>;
}

export default function DashBoardView({ board }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let live = true;
    setItems(null);
    if (!board) { setItems([]); return undefined; }
    apiGet(`/dash/board-items/${board.boardId}`)
      .then((r) => { if (live) setItems(r.items || []); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [board]);

  const sections = useMemo(() => {
    const rows = items || [];
    if (!rows.length) return [];
    const byId = new Map(rows.map((it) => [String(it.id), { it, kids: [] }]));
    const secs = [];
    for (const { it, kids } of byId.values()) {
      if (it.kind === 'section') secs.push({ it, kids });
    }
    for (const { it, kids } of byId.values()) {
      if (it.kind === 'section' || it.parentId == null) continue;
      const parent = byId.get(String(it.parentId));
      const list = parent && parent.it.kind === 'section' ? parent.kids : (secs[0]?.kids || []);
      list.push(it);
    }
    return secs
      .map(({ it, kids }) => ({ it, kids: kids.filter((k) => k.visible !== false) }))
      .filter(({ it }) => it.visible !== false);
  }, [items]);

  const heroColor = sections[0]?.it.color || '';

  return (
    <div className="page-content animate-fade">
      {!items && <BoardLoading />}
      {items && sections.length === 0 && (
        <div className="dash-panel">
          <div className="dash-panel-body text-center py-5">
            <i className="bi bi-grid-3x3-gap d-block mb-2" style={{ fontSize: 'calc(30px * var(--fs, 1))', color: 'var(--text-muted)' }}></i>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>This dashboard is empty</div>
            <div className="ddes-note mb-3">An administrator can add sections and links for it.</div>
          </div>
        </div>
      )}
      {items && sections.length > 0 && (
        <>
          <DasHero color={heroColor} />
          {sections.map(({ it: sec, kids }, i) => (
            <BoardSection key={sec.id} section={sec} kids={kids} index={i} />
          ))}
        </>
      )}
    </div>
  );
}