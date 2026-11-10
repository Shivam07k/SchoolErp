import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { SECTION_COLORS } from '../theme';
import { detach, patchKey, afterKey, removeNode, isSection } from '../menuTree';
import WidgetBuilder from './WidgetBuilder';
import { toSpec, fromSpec, parseSpec, defaultWidget } from '../widgetSpec';

/* The dashboard builder: named boards on the left, sections and the links /
   KPI cards inside them in the middle, every link the company has on the
   right — the same drag-and-drop shape as the sidebar menu builder, but for
   the dashboard. A KPI card is a widget built with the same query builder
   that powers dashboard pages, and how cards look (simple link, box or card)
   is chosen per section and can be overridden per item. Nothing writes until
   Save is pressed. */

let seq = 0;
const nextKey = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

const newSection = () => ({
  key: nextKey(), id: null, kind: 'section', label: 'New section', icon: 'bi-folder',
  color: '', chartType: 'kpi', query: {}, target: '', openNew: false,
  style: { cols: 4, itemStyle: 'card' }, visible: true, children: [],
});

/* Rows from the server become the shape the draft uses. */
const toNode = (it) => ({
  key: nextKey(), id: it.id, kind: it.kind || 'link', label: it.label || '',
  icon: it.icon || '', color: it.color || '', chartType: it.chartType || 'kpi',
  query: it.query || {}, target: it.target || '', openNew: it.openNew !== false,
  style: it.style || {}, visible: it.visible !== false, children: [],
});

/* Sections are the only top-level rows; everything else hangs under one. */
function nest(items) {
  const byId = new Map();
  for (const it of items) {
    const n = toNode(it);
    n.parentId = it.parentId ?? null;
    byId.set(String(it.id), n);
  }
  const secs = [...byId.values()].filter((n) => n.kind === 'section' && n.parentId == null);
  for (const n of byId.values()) {
    if (n.kind === 'section' || n.parentId == null) continue;
    const parent = byId.get(String(n.parentId));
    if (parent && parent.kind === 'section') parent.children.push(n);
    else if (secs[0]) secs[0].children.push(n);   // orphaned: keep, don't lose
  }
  secs[0]?.children.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  secs.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  return secs;
}

/* The draft back to the flat ordered list the server replaces from. An item
   that somehow ended up at the top level is moved under the first section
   rather than saved where nobody would see it. */
function flatten(nodes, parent = null, out = [], firstSection = null) {
  nodes.forEach((n, i) => {
    const belongs = parent || (n.kind === 'section' ? null : firstSection);
    out.push({
      key: n.key, parent: belongs, kind: n.kind, label: n.label, icon: n.icon,
      color: n.color, chartType: n.chartType, query: n.query, target: n.target,
      openNew: n.openNew, style: n.style, visible: n.visible, sort: out.length,
    });
    void i;
    if (n.kind === 'section') flatten(n.children, n.key, out, firstSection);
  });
  return out;
}

/* ----------------------- right-hand link catalog ------------------------ */

function CatalogBox({ links, loading, onAdd }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return links;
    return links.filter((l) => (l.title || '').toLowerCase().includes(needle)
      || (l.target || '').toLowerCase().includes(needle));
  }, [links, q]);

  const grouped = useMemo(() => {
    const g = new Map();
    for (const l of shown) {
      const name = l.group || 'Other';
      if (!g.has(name)) g.set(name, []);
      g.get(name).push(l);
    }
    return [...g.entries()];
  }, [shown]);

  return (
    <div className="mb-catalog">
      <div className="mb-catalog-head">
        <i className="bi bi-grip-vertical"></i>
        <span>All links</span>
        <em>{shown.length}</em>
      </div>
      <input className="form-control form-control-sm mb-search" placeholder="Find a form…"
        value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mb-catalog-list">
        {loading && <div className="cz-empty sm"><span className="spinner-border spinner-border-sm"></span></div>}
        {!loading && shown.length === 0 && (
          <div className="cz-empty sm">{links.length ? 'Nothing matches.' : 'No links found.'}</div>
        )}
        {grouped.map(([group, list]) => (
          <div key={group} className="mb-catalog-group">
            <div className="mb-catalog-group-h">{group}</div>
            {list.map((l, i) => (
              <div key={`${l.kind}:${l.target}:${i}`} className="mb-chip" title={`${l.title} → ${l.target}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/mb-catalog', JSON.stringify({
                    kind: l.kind, target: l.target, label: l.title, icon: l.icon,
                    openNew: l.kind === 'url',
                  }));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onDoubleClick={() => onAdd(l)}>
                <i className={`bi ${l.icon || 'bi-file-earmark-text'}`}></i>
                <span>{l.title}</span>
                <em className="mb-chip-kind">{l.kind === 'form' ? '' : l.kind}</em>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mb-hint">
        Drag a link into a section, or double-click it. Double-click lands in
        the section you have selected, otherwise in the last section.
      </div>
    </div>
  );
}

/* --------------------------- the canvas itself --------------------------- */

function CanvasNode({ node, depth, dragKey, selected, onDragStart, onDropAt,
  onDropInto, onSelect, onEditKpi, onEdit, onToggleDelete }) {
  const [over, setOver] = useState(null);
  const isSec = isSection(node);
  const kind = node.kind;
  const icon = node.icon || (isSec ? 'bi-folder' : kind === 'kpi' ? 'bi-123' : 'bi-link-45deg');
  const hasKids = node.children.length > 0;
  const cols = Number(node.style?.cols) || 4;
  const look = node.style?.itemStyle || 'card';

  const inner = (
    <div
      className={`mb-row ${isSec ? 'is-sec' : 'is-link'} ${selected ? 'on' : ''} ${dragKey === node.key ? 'dragging' : ''} ${over ? 'over-' + over : ''}`}
      style={{ '--mb-d': depth }}
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart(node.key, e); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver('in'); }}
      onDragLeave={() => setOver(null)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(null); onDropInto(node, e); }}
    >
      <i className="bi bi-grip-vertical mb-grip" onMouseDown={(e) => e.stopPropagation()}></i>
      <i className={`bi ${icon} mb-ic`}></i>
      <span className="mb-label" onClick={() => onSelect(node)}>{node.label || 'Untitled'}</span>
      {isSec && <em className="mb-num">{node.children.length}</em>}
      {kind === 'kpi' && <em className="mb-num">{node.style?.palette || ''}</em>}
      <span className="mb-acts">
        <em className={`db-look db-look-${look}`} title={`Shown as a ${look}`}>{look}</em>
        {isSec && (
          <>
            <button className="cz-mini" title="Add a link to this section" onMouseDown={(e) => e.stopPropagation()} onClick={() => onEdit(node, 'addLink')}>
              <i className="bi bi-link-45deg"></i>
            </button>
            <button className="cz-mini" title="Add a KPI card to this section" onMouseDown={(e) => e.stopPropagation()} onClick={() => onEditKpi(node)}>
              <i className="bi bi-123"></i>
            </button>
          </>
        )}
        <button className="cz-mini" title={kind === 'kpi' ? 'Edit card' : 'Edit'} onMouseDown={(e) => e.stopPropagation()}
          onClick={() => (kind === 'kpi' ? onEditKpi(node, 'edit') : onEdit(node))}>
          <i className="bi bi-pencil"></i>
        </button>
        <button className="cz-mini danger" title="Remove" onMouseDown={(e) => e.stopPropagation()} onClick={() => onToggleDelete(node.key)}>
          <i className="bi bi-trash3"></i>
        </button>
      </span>
      {isSec && (
        <span className="mb-sec-opts" title="Per-section look">
          <em>{cols} per row</em>
        </span>
      )}
    </div>
  );

  if (!isSec) return inner;

  return (
    <div className="mb-node" data-depth={depth}>
      {inner}
      <div className={`mb-kids ${hasKids ? '' : 'mb-kids-empty'}`}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropAt(node, node.children.length, e); }}>
        {node.children.map((c, i) => (
          <div key={c.key} className="mb-slot" onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropAt(node, i, e); }}>
            <CanvasNode node={c} depth={depth + 1} dragKey={dragKey} selected={selected}
              onDragStart={onDragStart} onDropAt={onDropAt} onDropInto={onDropInto}
              onSelect={onSelect} onEditKpi={onEditKpi} onEdit={onEdit}
              onToggleDelete={onToggleDelete} />
          </div>
        ))}
        <div className="mb-slot mb-slot-end" onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropAt(node, node.children.length, e); }}>
          {!hasKids && !dragKey && (
            <div className="mb-slot-hint">
              <i className="bi bi-arrow-down-circle"></i> drop links and cards here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ add a link ------------------------------ */

function LinkDialog({ value, onChange, onClose, onSave }) {
  const [url, setUrl] = useState(value?.target || '');
  const [label, setLabel] = useState(value?.label || '');
  const [err, setErr] = useState('');

  const save = () => {
    const t = url.trim();
    if (!t) return setErr('Enter a link');
    const full = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
    let host = '';
    try { host = new URL(full).hostname; } catch { return setErr('That does not look like a link'); }
    if (!host.includes('.')) return setErr('That does not look like a link');
    onSave({
      label: label.trim() || host, kind: 'url', target: full,
      icon: 'bi-box-arrow-up-right', openNew: true, style: { itemStyle: 'card' },
    });
  };

  return (
    <div className="mb-modal" onClick={onClose}>
      <div className="mb-modal-box" onClick={(e) => e.stopPropagation()}>
        <h6><i className="bi bi-link-45deg me-1"></i>Add a link</h6>
        <div className="cz-field">
          <label>Web address</label>
          <input className="form-control form-control-sm" autoFocus value={url}
            placeholder="www.google.com" onChange={(e) => { setUrl(e.target.value); setErr(''); }}
            onKeyDown={(e) => e.key === 'Enter' && save()} />
          <small>https:// is added for you if you leave it out.</small>
        </div>
        <div className="cz-field">
          <label>Text shown on the dashboard</label>
          <input className="form-control form-control-sm" value={label}
            placeholder="Google" onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()} />
          <small>Leave this empty to use the site name.</small>
        </div>
        {err && <div className="mb-err">{err}</div>}
        <div className="cz-actions">
          <button className="btn btn-sm btn-primary" onClick={save}>Add link</button>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ add a KPI card --------------------------- */

function KpiDialog({ value, onClose, onSave }) {
  const [label, setLabel] = useState(value?.label || '');
  const [build, setBuild] = useState(value?.build || defaultWidget());
  const [itemStyle, setItemStyle] = useState(value?.itemStyle || 'card');
  const [color, setColor] = useState(value?.color || '');

  const save = () => {
    if (!label.trim() || !build.table) return;
    onSave({
      label: label.trim(), build, itemStyle, color,
      chartType: build.chartType, palette: build.palette,
    });
  };

  return (
    <div className="mb-modal" onClick={onClose}>
      <div className="mb-modal-box mb-modal-wide" onClick={(e) => e.stopPropagation()}>
        <h6><i className="bi bi-123 me-1"></i>{value?.editing ? 'Edit KPI card' : 'Add a KPI card'}</h6>
        <div className="cz-field">
          <label>Name shown on the card</label>
          <input className="form-control form-control-sm" autoFocus value={label}
            placeholder="Total invoices, items in stock…"
            onChange={(e) => setLabel(e.target.value)} />
        </div>
        <WidgetBuilder value={build} onChange={setBuild} />
        <div className="cz-row">
          <div className="cz-field">
            <label>Card look</label>
            <div className="mb-static-select">
              {[['card', 'Card'], ['box', 'Box'], ['link', 'Link']].map(([k, l]) => (
                <button key={k} className={`mb-static-opt ${itemStyle === k ? 'on' : ''}`}
                  onClick={() => setItemStyle(k)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="cz-field">
            <label>Accent colour <em>(auto)</em></label>
            <div className="mb-colors">
              <button className={`mb-color auto ${color ? '' : 'on'}`} title="Automatic colour"
                onClick={() => setColor('')}>
                <i className="bi bi-droplet-half"></i>
              </button>
              {SECTION_COLORS.map((s) => (
                <button key={s.c} className={`mb-color ${color === s.c ? 'on' : ''}`}
                  title={s.n} style={{ background: s.c }}
                  onClick={() => setColor(s.c)}></button>
              ))}
            </div>
          </div>
        </div>
        <div className="cz-actions">
          <button className="btn btn-sm btn-primary" disabled={!label.trim() || !build.table}
            onClick={save}>
            {value?.editing ? 'Save changes' : 'Add card'}
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- edit a section / link ---------------------- */

function EditDialog({ node, onChange, onClose, onSave, onAddLink, onAddKpi }) {
  const [label, setLabel] = useState(node.label || '');
  const icons = ['bi-folder', 'bi-house', 'bi-collection', 'bi-graph-up', 'bi-123',
    'bi-box', 'bi-truck', 'bi-cart', 'bi-people', 'bi-gear'];
  const isSec = node.kind === 'section';
  const cols = Number(node.style?.cols) || 4;
  const itemStyle = node.style?.itemStyle || 'card';

  return (
    <div className="mb-modal" onClick={onClose}>
      <div className="mb-modal-box" onClick={(e) => e.stopPropagation()}>
        <h6><i className="bi bi-pencil me-1"></i>{isSec ? 'Edit section' : 'Edit item'}</h6>
        <div className="cz-field">
          <label>Text shown on the dashboard</label>
          <input className="form-control form-control-sm" autoFocus value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSave({ label: label.trim() })} />
        </div>
        <div className="cz-field">
          <label>Icon</label>
          <div className="mb-icons">
            {icons.map((ic) => (
              <button key={ic} className={`mb-icon ${node.icon === ic ? 'on' : ''}`}
                onClick={() => onChange({ ...node, icon: ic })}>
                <i className={`bi ${ic}`}></i>
              </button>
            ))}
          </div>
        </div>
        {isSec && (
          <>
            <div className="cz-row">
              <div className="cz-field">
                <label>Cards in one row</label>
                <input type="number" min={1} max={8} className="form-control form-control-sm"
                  value={cols} onChange={(e) => onChange({ ...node, style: { ...node.style, cols: Math.max(1, Math.min(8, Number(e.target.value) || 4)) } })} />
              </div>
              <div className="cz-field">
                <label>Default card look</label>
                <div className="mb-static-select">
                  {[['card', 'Card'], ['box', 'Box'], ['link', 'Link']].map(([k, l]) => (
                    <button key={k} className={`mb-static-opt ${itemStyle === k ? 'on' : ''}`}
                      onClick={() => onChange({ ...node, style: { ...node.style, itemStyle: k } })}>{l}</button>
                  ))}
                </div>
                <small>Links in this section look like this unless they say otherwise.</small>
              </div>
            </div>
            <div className="cz-field">
              <label>Section colour {!node.color && <em>(auto)</em>}</label>
              <div className="mb-colors">
                <button className={`mb-color auto ${node.color ? '' : 'on'}`} title="Automatic colour"
                  onClick={() => onChange({ ...node, color: '' })}>
                  <i className="bi bi-droplet-half"></i>
                </button>
                {SECTION_COLORS.map((s) => (
                  <button key={s.c} className={`mb-color ${node.color === s.c ? 'on' : ''}`}
                    title={s.n} style={{ background: s.c }}
                    onClick={() => onChange({ ...node, color: s.c })}></button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="cz-field">
          <div className="form-check">
            <input className="form-check-input" type="checkbox" id="dbVis"
              checked={node.visible !== false}
              onChange={(e) => onChange({ ...node, visible: e.target.checked })} />
            <label className="form-check-label" htmlFor="dbVis">Show on the dashboard</label>
          </div>
        </div>
        <div className="cz-actions">
          <button className="btn btn-sm btn-primary" disabled={!label.trim()}
            onClick={() => onSave({ label: label.trim() })}>Save</button>
          {isSec && (
            <>
              <button className="btn btn-sm btn-outline-secondary" onClick={onAddLink}>Add link</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={onAddKpi}>Add KPI</button>
            </>
          )}
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ assign dialog ----------------------------- */

function AssignDialog({ board, assignments, users, groups, onAssign, onUnassign, onDefault, onClose, busy }) {
  const [kind, setKind] = useState('user');
  const [who, setWho] = useState('');
  const list = kind === 'user' ? users : kind === 'group' ? groups : [];
  const rows = assignments || [];

  return (
    <div className="mb-modal" onClick={onClose}>
      <div className="mb-modal-box mb-modal-wide" onClick={(e) => e.stopPropagation()}>
        <h6><i className="bi bi-person-check me-1"></i>Who sees “{board?.name}”</h6>

        <div className="mb-assign-now">
          <div className="mb-tabs">
            {[['user', 'One person'], ['group', 'A group'], ['all', 'Everyone']].map(([k, l]) => (
              <button key={k} className={`mb-tab ${kind === k ? 'on' : ''}`} onClick={() => { setKind(k); setWho(''); }}>
                {l}
              </button>
            ))}
          </div>
          {kind === 'all' ? (
            <button className="btn btn-sm btn-primary" disabled={busy}
              onClick={() => onAssign('all', '')}>
              Give it to everyone
            </button>
          ) : (
            <div className="d-flex gap-2">
              <select className="form-select form-select-sm" value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">Choose {kind === 'user' ? 'a person' : 'a group'}…</option>
                {list.map((o) => (
                  <option key={o.id || o.name} value={o.id || o.name}>{o.name}</option>
                ))}
              </select>
              <button className="btn btn-sm btn-primary" disabled={!who || busy}
                onClick={() => onAssign(kind, who)}>
                Assign
              </button>
            </div>
          )}
        </div>

        <div className="mb-assigned">
          <div className="mb-assigned-h">
            {rows.length === 0
              ? 'Not assigned to anybody yet, so only the company default applies.'
              : 'Assigned to'}
          </div>
          {rows.map((a) => (
            <div key={a.id} className="mb-assigned-row">
              <span className={`badge text-bg-${a.subjectType === 'group' ? 'info' : a.subjectType === 'all' ? 'dark' : 'secondary'}`}>
                {a.subjectType === 'user' ? 'person' : a.subjectType}
              </span>
              <strong>{a.subjectName || a.subjectId || 'everyone'}</strong>
              <button className="cz-mini danger ms-auto" title="Stop assigning"
                onClick={() => onUnassign(a.id)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
          ))}
        </div>

        <div className="mb-assign-foot">
          <div className="form-check">
            <input className="form-check-input" type="checkbox" id="dbDefault"
              checked={!!board?.isActive} disabled={busy}
              onChange={(e) => onDefault(e.target.checked)} />
            <label className="form-check-label" htmlFor="dbDefault">
              This is the dashboard for the whole company
            </label>
          </div>
          <small>
            A person who is assigned a dashboard always sees that one. Everybody
            else sees the company default.
          </small>
        </div>

        <div className="cz-actions">
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ all boards ------------------------------- */

function AllBoards({ boards, onPick }) {
  const [summ, setSumm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(boards.map(async (s) => {
      const a = await apiGet(`/dash/board/assignments/${s.id}`);
      return [String(s.id), (a && a.assignments) || []];
    }))
      .then((entries) => { if (alive) setSumm(Object.fromEntries(entries)); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [boards]);

  return (
    <div className="mb-all">
      <h6><i className="bi bi-grid-3x3-gap me-1"></i>All dashboards</h6>
      <p className="cz-note">Every dashboard in this company. Click one to edit it.</p>
      {loading && <div className="cz-empty sm"><span className="spinner-border spinner-border-sm"></span></div>}
      {!loading && boards.map((s) => {
        const as = summ[String(s.id)] || [];
        const ppl = as.filter((a) => a.subjectType === 'user');
        const grps = as.filter((a) => a.subjectType === 'group');
        const everyone = as.some((a) => a.subjectType === 'all');
        return (
          <div key={s.id} className="cz-item mb-all-row" onClick={() => onPick(s.id)}>
            <div className="cz-item-main">
              <strong>{s.name}</strong>
              <small>{s.description || 'No description'}</small>
            </div>
            <div className="cz-flags">
              {s.isActive && <span className="badge text-bg-primary">Company</span>}
              {everyone && <span className="badge text-bg-dark">Everyone</span>}
              {grps.length > 0 && (
                <span className="badge text-bg-info">{grps.length} group{grps.length > 1 ? 's' : ''}</span>
              )}
              {ppl.length > 0 && (
                <span className="badge text-bg-secondary">{ppl.length} person{ppl.length > 1 ? 's' : ''}</span>
              )}
              <span className="cz-count">{s.items ?? 0}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- the whole tab --------------------------- */

export default function DashboardBuilder({ data, act, me, busy, onChanged }) {
  const boards = data.boards || [];
  const [sel, setSel] = useState(boards[0]?.id ?? null);
  const [allView, setAllView] = useState(false);
  const [tree, setTree] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [dragKey, setDragKey] = useState(null);
  const [selected, setSelected] = useState(null);
  const [linkFor, setLinkFor] = useState(null);       /* link dialog target */
  const [kpiFor, setKpiFor] = useState(null);         /* {targetSection, node} for the KPI dialog */
  const [editFor, setEditFor] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [people, setPeople] = useState({ users: [], groups: [] });
  const [dirty, setDirty] = useState(false);
  const [loadedSet, setLoadedSet] = useState(null);
  const discardRef = useRef(false);

  const activeBoard = useMemo(() => boards.find((b) => Number(b.id) === Number(sel)) || null, [boards, sel]);

  useEffect(() => {
    if (sel == null && boards.length) setSel(boards[0].id);
  }, [boards, sel]);

  /* The link list is the same for every board, so fetch it once. */
  useEffect(() => {
    let live = true;
    setCatLoading(true);
    apiGet('/dash/menu-catalog')
      .then((r) => { if (live) setCatalog(r.links || []); })
      .catch(() => { if (live) setCatalog([]); })
      .finally(() => { if (live) setCatLoading(false); });
    return () => { live = false; };
  }, []);

  const openAssign = async () => {
    setAssignOpen(true);
    try {
      const [u, g] = await Promise.all([apiGet('/security/users'), apiGet('/security/groups')]);
      setPeople({
        users: (u.users || []).map((x) => ({ id: x.userid, name: x.name || x.userid })),
        groups: (g.groups || []).map((x) => ({ id: x.grpId, name: x.grpName || x.grpId })),
      });
    } catch (e) { /* the dialog still works, just with empty pickers */ }
  };

  useEffect(() => {
    if (!assignOpen || sel == null) return;
    apiGet(`/dash/board/assignments/${sel}`).then((r) => setAssignments(r.assignments || [])).catch(() => setAssignments([]));
  }, [assignOpen, sel]);

  const loadItems = useCallback(async (id) => {
    if (id == null) { setTree([]); setLoadedSet(null); return; }
    try {
      const r = await apiGet(`/dash/board-items/${id}`);
      setTree(nest(r.items || []));
      setLoadedSet(id);
      setDirty(false);
      setSelected(null);
    } catch (e) {
      setTree([]);
      setLoadedSet(id);
    }
  }, []);

  useEffect(() => {
    if (discardRef.current) { discardRef.current = false; return; }
    if (sel != null && Number(sel) !== Number(loadedSet)) loadItems(sel);
    if (sel == null) setTree([]);
  }, [sel, loadedSet, loadItems]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /* Where do new items land? The section pointed at by the toolbar, the
     selected section, else the last section. */
  const targetSection = () => (
    linkFor?.targetSection
    ?? (selected && isSection(selected) ? selected.key : null)
    ?? [...tree].reverse().find(isSection)?.key ?? null
  );

  const asNode = (link, extra = {}) => ({
    key: nextKey(), id: null, kind: link.kind || 'link', label: link.label,
    icon: link.icon || '', color: '', chartType: 'kpi',
    query: {}, target: link.target || '', openNew: link.openNew !== false,
    style: { itemStyle: 'card' }, visible: true, children: [],
    ...extra,
  });

  const appendInto = (sectionKey, node) => {
    if (!sectionKey) return false;
    setTree(patchKey(tree, sectionKey, (s) => ({ ...s, children: [...s.children, node] })));
    setDirty(true);
    return true;
  };

  const addSection = () => { setTree([...tree, newSection()]); setDirty(true); };

  const addLinkTo = (sectionKey, link) => appendInto(sectionKey, asNode(link));

  const addKpiTo = (sectionKey, data_) => {
    const spec = toSpec(data_.build);
    appendInto(sectionKey, {
      key: nextKey(), id: null, kind: 'kpi', label: data_.label,
      icon: 'bi-123', color: data_.color || '', chartType: data_.chartType || 'kpi',
      query: spec,
      target: '', openNew: false,
      style: { itemStyle: data_.itemStyle || 'card', palette: data_.palette || 'accent' },
      visible: true, children: [],
    });
  };

  const patchNode = (key, patch) => { setTree(patchKey(tree, key, (n) => ({ ...n, ...patch }))); setDirty(true); };

  const onDragStart = (key, e) => {
    setDragKey(key);
    e.dataTransfer.setData('text/mb-node', key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const readDrop = (e) => {
    const raw = e.dataTransfer.getData('text/mb-catalog');
    const movingKey = e.dataTransfer.getData('text/mb-node');
    e.dataTransfer.setData('text/mb-node', '');
    setDragKey(null);
    if (raw) {
      try { return { link: JSON.parse(raw) }; } catch (err) { return {}; }
    }
    if (movingKey) return { movingKey };
    return {};
  };

  const putAt = (nextList, index, node) => {
    const out = [...nextList];
    out.splice(Math.max(0, Math.min(index, out.length)), 0, node);
    return out;
  };

  /* Drop on a row: a section takes it, an item takes it after itself. */
  const onDropInto = (node, e) => {
    const catalogRaw = e.dataTransfer.getData('text/mb-catalog');
    const movingKey = e.dataTransfer.getData('text/mb-node');
    e.dataTransfer.setData('text/mb-node', '');
    setDragKey(null);

    if (catalogRaw) {
      let link;
      try { link = JSON.parse(catalogRaw); } catch (err) { return; }
      if (isSection(node)) { addLinkTo(node.key, link); return; }
      const fresh = asNode(link);
      const after = afterKey(tree, node.key, fresh);
      if (after) { setTree(after); setDirty(true); }
      else addLinkTo(targetSection(), link);
      return;
    }
    if (!movingKey) return;
    const hit = detach(tree, movingKey);
    if (!hit) return;

    /* A section dropped on an item row is refused; a section can only sit at
       the top. An item dropped on an item row goes right after it. */
    if (isSection(node)) {
      setTree(isSection(hit.node)
        ? afterKey(hit.rest, node.key, { ...hit.node, children: [] })
        : intoSection(hit.rest, node.key, hit.node));
    } else {
      setTree(afterKey(hit.rest, node.key, hit.node) ?? hit.rest);
    }
    setDirty(true);
  };

  /* Put a moved item into a section's list at the front. */
  const intoSection = (nodes, sectionKey, node) => {
    if (!sectionKey) return nodes;
    return patchKey(nodes, sectionKey, (n) => ({ ...n, children: [node, ...n.children] }));
  };

  /* Drop into a gap inside a section: a position, not a parent. */
  const onDropAt = (parentNode, index, e) => {
    const { link, movingKey } = readDrop(e);
    if (link) {
      const node = asNode(link);
      setTree(patchKey(tree, parentNode.key, (n) => ({ ...n, children: putAt(n.children, index, node) })));
      setDirty(true);
      return;
    }
    if (!movingKey) return;
    const hit = detach(tree, movingKey);
    if (!hit) return;
    if (isSection(hit.node)) {
      /* A section can only live at the top level, so this is refused. */
      setTree(hit.rest);
      return;
    }
    setTree(patchKey(hit.rest, parentNode.key, (n) => ({ ...n, children: putAt(n.children, index, hit.node) })));
    setDirty(true);
  };

  const removeNodeByKey = (key) => { setTree(removeNode(tree, key)); setDirty(true); };

  const pickBoard = (id) => {
    if (dirty && !window.confirm(`${activeBoard?.name || 'This dashboard'} has unsaved changes. Leave anyway?`)) return;
    setAllView(false);
    setSel(id);
  };

  const save = async () => {
    if (sel == null) return;
    const firstSection = [...tree].find(isSection)?.key ?? null;
    const items = flatten(tree, null, [], firstSection);
    const r = await act(() => apiPost('/dash/board-items/replace', { boardId: sel, items }), 'Dashboard saved');
    if (r) {
      setDirty(false);
      await loadItems(sel);
      if (onChanged) onChanged();
    }
  };

  const discard = () => { setDirty(false); discardRef.current = true; loadItems(sel); };

  const setDefault = async (on) => {
    if (sel == null) return;
    await act(() => apiPost('/dash/board/save', {
      id: sel, name: activeBoard?.name || '', description: activeBoard?.description || '',
      isActive: on, isAvailable: activeBoard?.isAvailable !== false,
    }), on ? 'This is now the company dashboard' : 'No longer the company dashboard');
    if (onChanged) onChanged();
  };

  const doAssign = async (subjectType, subjectId) => {
    const r = await act(() => apiPost('/dash/board/assign', { boardId: sel, subjectType, subjectId }), 'Assigned');
    if (r) {
      try {
        const a = await apiGet(`/dash/board/assignments/${sel}`);
        setAssignments(a.assignments || []);
      } catch (e) { /* leave the old list up; the next open re-reads */ }
      if (onChanged) onChanged();
    }
  };

  const doUnassign = async (id) => {
    const r = await act(() => apiPost('/dash/board/assign/delete', { id }), 'Removed');
    if (r) {
      setAssignments((prev) => prev.filter((a) => Number(a.id) !== Number(id)));
      if (onChanged) onChanged();
    }
  };

  /* Open the KPI dialog. targetSection is a section key from a "+" button;
     renameTarget means we are editing an existing KPI card. */
  const openKpi = (node) => {
    const targetSection = node?.kind === 'section' ? node.key : null;
    const editing = node?.kind === 'kpi' ? node : null;
    let value = (node?.kind === 'section') || !node ? null : { editing: true };
    if (editing) {
      const build = fromSpec(parseSpec(editing.query));
      build.chartType = editing.chartType || build.chartType || 'kpi';
      build.palette = editing.style?.palette || build.palette;
      value = {
        editing: true, label: editing.label, build,
        itemStyle: editing.style?.itemStyle || 'card',
        color: editing.color || '',
      };
    }
    setKpiFor({ targetSection, editing, value });
  };

  const editItem = (node) => setEditFor(node);

  return (
    <div className="cz-grid-2 mb-wrap">
      <div className="cz-card">
        <h6><i className="bi bi-grid-3x3-gap me-1"></i>Dashboards</h6>
        <p className="cz-note">
          A dashboard is one board of sections with links and KPI cards. Tick it
          as the company dashboard, or assign it to particular people or a group.
        </p>
        <div className="cz-list">
          <div className={`cz-item ${allView ? 'on' : ''}`} onClick={() => {
            if (allView) return;
            if (dirty && !window.confirm(`${activeBoard?.name || 'This dashboard'} has unsaved changes. Leave anyway?`)) return;
            setAllView(true);
          }}>
            <div className="cz-item-main">
              <strong><i className="bi bi-collection me-1"></i>All dashboards</strong>
              <small>Everything we have</small>
            </div>
            <div className="cz-flags"><span className="cz-count">{boards.length}</span></div>
          </div>
          <div className="mb-hr"></div>
          {boards.length === 0 && <div className="cz-empty sm">No dashboard yet.</div>}
          {boards.map((s) => (
            <div key={s.id} className={`cz-item ${!allView && Number(s.id) === Number(sel) ? 'on' : ''}`}
              onClick={() => pickBoard(s.id)}>
              <div className="cz-item-main">
                <strong>{s.name}</strong>
                <small>{s.description || 'No description'}</small>
              </div>
              <div className="cz-flags">
                {s.isActive ? <span className="badge text-bg-primary">Company</span> : null}
                <button className="cz-mini danger" title="Delete"
                  onClick={e => {
                    e.stopPropagation();
                    if (!window.confirm(`Delete "${s.name}"?`)) return;
                    if (Number(s.id) === Number(sel)) setSel(null);
                    act(() => apiDelete(`/dash/board/${s.id}`), 'Deleted').then(r => { if (r && onChanged) onChanged(); });
                  }}>
                  <i className="bi bi-trash3"></i>
                </button>
                <span className="cz-count">{s.items ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
        {sel != null && !allView && (
          <button className="btn btn-sm btn-outline-primary w-100 mt-2" onClick={openAssign}>
            <i className="bi bi-person-check me-1"></i>Who sees this dashboard?
          </button>
        )}

        <div className="cz-form">
          <h6 className="cz-form-h">Your own dashboard</h6>
          <p className="cz-note">
            You are <strong>{me}</strong>. A dashboard your administrator has
            given you always wins over this.
          </p>
          <select className="form-select form-select-sm" value=""
            onChange={(e) => e.target.value && act(
              () => apiPost('/dash/board/select', { boardId: Number(e.target.value) }), 'Dashboard updated')}>
            <option value="">Choose a dashboard…</option>
            {boards.filter((x) => x.isAvailable !== false).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <NewBoard act={act} busy={busy} onCreated={() => onChanged && onChanged()} />
      </div>

      <div className="cz-card mb-panel">
        <h6>
          <i className="bi bi-grid-3x3-gap me-1"></i>
          {allView ? 'All dashboards' : (activeBoard ? activeBoard.name : 'Dashboard')}
        </h6>
        {allView ? (
          <AllBoards boards={boards} onPick={pickBoard} />
        ) : !sel ? <div className="cz-empty sm">Pick a dashboard on the left.</div> : (
          <>
            <div className="mb-toolbar">
              <button className="btn btn-sm btn-outline-secondary" onClick={addSection} disabled={busy}>
                <i className="bi bi-folder-plus me-1"></i>Add section
              </button>
              <button className="btn btn-sm btn-outline-secondary"
                onClick={() => setLinkFor({ targetSection: selected && isSection(selected) ? selected.key : null })}
                disabled={busy}>
                <i className="bi bi-link-45deg me-1"></i>Add link
              </button>
              <button className="btn btn-sm btn-outline-secondary"
                onClick={() => openKpi(null)}
                disabled={busy}>
                <i className="bi bi-123 me-1"></i>Add KPI card
              </button>
              <div className="ms-auto d-flex gap-2">
                {dirty && (
                  <button className="btn btn-sm btn-outline-secondary" onClick={discard} disabled={busy}>
                    Discard
                  </button>
                )}
                <button className="btn btn-sm btn-primary" onClick={save} disabled={busy || !dirty}>
                  <i className="bi bi-check-lg me-1"></i>Save dashboard
                </button>
              </div>
            </div>

            <div className="mb-split">
              <div className="mb-canvas">
                {tree.length === 0 && (
                  <div className="cz-empty sm">
                    Start with a section, then drag links in or add a KPI card.
                  </div>
                )}
                {tree.map((n, i) => (
                  <div key={n.key} className="mb-slot" onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      const { link, movingKey } = readDrop(e);
                      if (link) { addLinkTo(targetSection(), link); return; }
                      if (!movingKey) return;
                      const hit = detach(tree, movingKey);
                      if (!hit) return;
                      /* Items live inside sections: a gap between sections can
                         only reorder the sections themselves. */
                      if (!isSection(hit.node)) { setTree(hit.rest); return; }
                      const next = [...hit.rest];
                      next.splice(i, 0, hit.node);
                      setTree(next);
                      setDirty(true);
                    }}>
                    <CanvasNode node={n} depth={0} dragKey={dragKey} selected={selected === n.key}
                      onDragStart={onDragStart} onDropAt={onDropAt} onDropInto={onDropInto}
                      onSelect={setSelected}
                      onEditKpi={openKpi}
                      onEdit={(node, mode) => (mode === 'addLink' ? setLinkFor({ targetSection: node.key }) : editItem(node))}
                      onToggleDelete={removeNodeByKey} />
                  </div>
                ))}
                <div className="mb-slot mb-slot-end" onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const { link, movingKey } = readDrop(e);
                    if (link) { addLinkTo(targetSection(), link); return; }
                    if (!movingKey) return;
                    const hit = detach(tree, movingKey);
                    if (!hit) return;
                    if (isSection(hit.node)) { setTree([...hit.rest, hit.node]); setDirty(true); }
                    else { setTree(hit.rest); }
                  }}></div>
              </div>

              <CatalogBox links={catalog} loading={catLoading} onAdd={(l) => addLinkTo(targetSection(), l)} />
            </div>
          </>
        )}
      </div>

      {linkFor && (
        <LinkDialog value={linkFor} onClose={() => setLinkFor(null)}
          onSave={(link) => { addLinkTo(linkFor.targetSection ?? targetSection(), link); setLinkFor(null); }} />
      )}
      {kpiFor && (
        <KpiDialog value={kpiFor.value} onClose={() => setKpiFor(null)}
          onSave={(d) => {
            if (kpiFor.editing) {
              patchNode(kpiFor.editing.key, {
                label: d.label, chartType: d.chartType, color: d.color,
                query: toSpec(d.build),
                style: { itemStyle: d.itemStyle, palette: d.palette },
              });
            } else {
              addKpiTo(kpiFor.targetSection ?? targetSection(), d);
            }
            setKpiFor(null);
          }} />
      )}
      {editFor && (
        <EditDialog node={editFor} onChange={(n) => { patchNode(editFor.key, n); setEditFor(n); }}
          onClose={() => setEditFor(null)}
          onSave={(patch) => { patchNode(editFor.key, patch); setEditFor(null); }}
          onAddLink={() => { setLinkFor({ targetSection: editFor.key }); setEditFor(null); }}
          onAddKpi={() => { openKpi(editFor); setEditFor(null); }} />
      )}
      {assignOpen && (
        <AssignDialog board={activeBoard} assignments={assignments}
          users={people.users} groups={people.groups} busy={busy}
          onAssign={doAssign} onUnassign={doUnassign} onDefault={setDefault}
          onClose={() => setAssignOpen(false)} />
      )}
    </div>
  );
}

function NewBoard({ act, busy, onCreated }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <div className="cz-form">
      <h6 className="cz-form-h">New dashboard</h6>
      <div className="cz-field">
        <label>Name</label>
        <input className="form-control form-control-sm" value={name}
          onChange={(e) => setName(e.target.value)} placeholder="Operations" />
      </div>
      <div className="cz-field">
        <label>Description</label>
        <input className="form-control form-control-sm" value={desc}
          onChange={(e) => setDesc(e.target.value)} placeholder="What this dashboard is for" />
      </div>
      <button className="btn btn-sm btn-primary" disabled={!name.trim() || busy}
        onClick={async () => {
          const r = await act(() => apiPost('/dash/board/save', { name, description: desc, isAvailable: true }), 'Dashboard created');
          if (r) { setName(''); setDesc(''); onCreated && onCreated(); }
        }}>
        Create
      </button>
    </div>
  );
}