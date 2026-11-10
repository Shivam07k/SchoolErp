import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '../api';
import { SECTION_COLORS } from '../theme';
import { countLinks, isSection, detach, patchKey, intoKey, afterKey, containsKey, removeNode } from '../menuTree';

/* The builder: the finished menu on the left, every link the company has on the
   right, and drag between them.

   Work is kept in a draft and saved on demand rather than after every nudge, so
   a drag that is abandoned costs nothing and a half-finished edit is never
   left in the sidebar. Nothing here writes until Save is pressed. */

let seq = 0;
const nextKey = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;

/* Rows from the server become the same shape the draft uses, so an edit and a
   fresh drag behave identically. */
const toNode = (it) => ({
  key: nextKey(),
  id: it.id,
  label: it.label || '',
  kind: it.kind || 'link',
  target: it.target || '',
  icon: it.icon || '',
  openNew: it.openNew !== false,
  color: it.color || '',
  visible: it.visible !== false,
  children: [],
});

/* Parent key -> children, keeping the order the server returned (which is
   parent, then sort_order). */
function nest(items) {
  const byKey = new Map();
  for (const it of items) {
    const n = toNode(it);
    n.parentId = it.parentId ?? null;
    byKey.set(String(it.id), n);
  }
  const roots = [];
  for (const n of byKey.values()) {
    const parent = n.parentId == null ? null : byKey.get(String(n.parentId));
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  /* A cycle would be invisible and unreachable, so anything not reached is
     promoted rather than dropped. */
  const seen = new Set();
  const walk = (list) => list.forEach((n) => {
    if (seen.has(n.key)) return;
    seen.add(n.key);
    walk(n.children);
  });
  walk(roots);
  for (const n of byKey.values()) if (!seen.has(n.key)) roots.push(n);
  return roots;
}

/* The draft back to the flat, ordered array the server replaces from. Order is
   the display order, so a section is written before its own links. */
function flatten(nodes, parent = null, out = []) {
  nodes.forEach((n, i) => {
    out.push({
      key: n.key,
      parent,
      label: n.label,
      kind: n.kind,
      target: n.target,
      icon: n.icon,
      openNew: n.openNew,
      color: n.color,
      visible: n.visible,
      sort: out.length,
    });
    flatten(n.children, n.key, out);
    void i;
  });
  return out;
}

/* --------------------------- right-hand link list --------------------------- */

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
        Drag a link into a section, or double-click it. A double-click lands in
        the section you have selected (the one with the border), otherwise in the
        last section.
      </div>
    </div>
  );
}

/* ------------------------------ the menu itself ----------------------------- */

function CanvasNode({ node, depth, numbers, dragKey, onDragStart, onDropAt, onDropInto, onSelect, selected, onAddLink, onAddSection, onToggleDelete, onEdit }) {
  const [over, setOver] = useState(null);
  const isSec = isSection(node);
  const hasKids = node.children.length > 0;
  return (
    <div className="mb-node" data-depth={depth}>
      <div
        className={`mb-row ${isSec ? 'is-sec' : 'is-link'} ${selected ? 'on' : ''} ${dragKey === node.key ? 'dragging' : ''} ${over ? 'over-' + over : ''}`}
        style={{ '--mb-d': depth }}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart(node.key, e);
        }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver('in'); }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          e.preventDefault(); e.stopPropagation(); setOver(null);
          onDropInto(node, e);
        }}
      >
        {/* The row is draggable so dragging by its body works too, but a row's
            buttons must never start a drag: a click on them has to stay a click.
            Stopping the mousedown there is what keeps drag and click apart. */}
        <i className="bi bi-grip-vertical mb-grip" onMouseDown={(e) => e.stopPropagation()}></i>
        <i className={`bi ${node.icon || (isSec ? 'bi-folder' : 'bi-file-earmark-text')} mb-ic`}></i>
        <span className="mb-label" onClick={() => onSelect(node)}>{node.label || 'Untitled'}</span>
        {!isSec && numbers.get(node.key) != null && (
          <em className="mb-num">{numbers.get(node.key)}</em>
        )}
        {isSec && <em className="mb-num">{countLinks(node)}</em>}
        {node.kind === 'url' && <i className="bi bi-box-arrow-up-right mb-ext" title={node.target}></i>}
        <span className="mb-acts">
          {isSec && (
            <>
              <button className="cz-mini" title="Add a section inside this one" onMouseDown={(e) => e.stopPropagation()} onClick={() => onAddSection(node)}>
                <i className="bi bi-folder-plus"></i>
              </button>
              <button className="cz-mini" title="Add a link to this section" onMouseDown={(e) => e.stopPropagation()} onClick={() => onAddLink(node)}>
                <i className="bi bi-plus-lg"></i>
              </button>
            </>
          )}
          <button className="cz-mini" title="Rename" onMouseDown={(e) => e.stopPropagation()} onClick={() => onEdit(node)}>
            <i className="bi bi-pencil"></i>
          </button>
          <button className="cz-mini danger" title="Remove" onMouseDown={(e) => e.stopPropagation()} onClick={() => onToggleDelete(node.key)}>
            <i className="bi bi-trash3"></i>
          </button>
        </span>
      </div>
      {isSec && (
        <div className={`mb-kids ${hasKids ? '' : 'mb-kids-empty'}`}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => {
            /* Any part of the section that no child slot claimed (the padding
               around the rows) still means "into this section". */
            e.preventDefault(); e.stopPropagation();
            onDropAt(node, node.children.length, e);
          }}>
          {node.children.map((c, i) => (
            <div key={c.key} className="mb-slot" onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropAt(node, i, e); }}>
              <CanvasNode node={c} depth={depth + 1} numbers={numbers}
                dragKey={dragKey} onDragStart={onDragStart} onDropAt={onDropAt}
                onDropInto={onDropInto} onSelect={onSelect} selected={selected}
                onAddLink={onAddLink} onAddSection={onAddSection}
                onToggleDelete={onToggleDelete} onEdit={onEdit} />
            </div>
          ))}
          {/* Always at least one drop slot, so even an empty section can receive
              a dragged link. The hint makes that obvious. */}
          <div className="mb-slot mb-slot-end" onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation();
              onDropAt(node, node.children.length, e);
            }}>
            {!hasKids && !dragKey && (
              <div className="mb-slot-hint">
                <i className="bi bi-arrow-down-circle"></i> drop links here
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- add a link -------------------------------- */

function LinkDialog({ value, onChange, onClose, onSave }) {
  const [url, setUrl] = useState(value?.target || '');
  const [label, setLabel] = useState(value?.label || '');
  const [err, setErr] = useState('');

  const save = () => {
    const t = url.trim();
    if (!t) return setErr('Enter a link');
    /* Anything with a scheme is taken as written; "google.com" is not, so it
       gets https:// rather than being rejected. */
    const full = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
    let host = '';
    try { host = new URL(full).hostname; } catch { return setErr('That does not look like a link'); }
    if (!host.includes('.')) return setErr('That does not look like a link');
    onSave({
      label: label.trim() || host,
      kind: 'url',
      target: full,
      icon: 'bi-box-arrow-up-right',
      openNew: true,
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
          <label>Text shown in the menu</label>
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

/* ----------------------------- rename an item ------------------------------ */

function EditDialog({ node, onChange, onClose, onSave }) {
  const [label, setLabel] = useState(node.label || '');
  const icons = ['bi-folder', 'bi-box', 'bi-truck', 'bi-cart', 'bi-receipt',
    'bi-people', 'bi-shield-lock', 'bi-gear', 'bi-graph-up', 'bi-box-arrow-up-right'];
  const isSec = node.kind === 'section';
  return (
    <div className="mb-modal" onClick={onClose}>
      <div className="mb-modal-box" onClick={(e) => e.stopPropagation()}>
        <h6><i className="bi bi-pencil me-1"></i>{isSec ? 'Edit section' : 'Edit link'}</h6>
        <div className="cz-field">
          <label>Text shown in the menu</label>
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
          <div className="cz-field">
            <label>Section colour {!node.color && <em>(auto)</em>}</label>
            <div className="mb-colors">
              <button className={`mb-color auto ${node.color ? '' : 'on'}`} title="Automatic colour (default)"
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
        )}
        <div className="cz-field">
          <div className="form-check">
            <input className="form-check-input" type="checkbox" id="mbVis"
              checked={node.visible !== false}
              onChange={(e) => onChange({ ...node, visible: e.target.checked })} />
            <label className="form-check-label" htmlFor="mbVis">Show in the sidebar</label>
          </div>
        </div>
        <div className="cz-actions">
          <button className="btn btn-sm btn-primary" disabled={!label.trim()}
            onClick={() => onSave({ label: label.trim() })}>Save</button>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ assign dialog ------------------------------ */

function AssignDialog({ set, assignments, users, groups, onAssign, onUnassign, onDefault, onClose, busy }) {
  const [kind, setKind] = useState('user');
  const [who, setWho] = useState('');
  const list = kind === 'user' ? users : kind === 'group' ? groups : [];
  const rows = assignments || [];

  return (
    <div className="mb-modal" onClick={onClose}>
      <div className="mb-modal-box mb-modal-wide" onClick={(e) => e.stopPropagation()}>
        <h6><i className="bi bi-person-check me-1"></i>Who sees “{set?.name}”</h6>

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
              ? 'Not assigned to anybody yet, so it is only the default menu.'
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
            <input className="form-check-input" type="checkbox" id="mbDefault"
              checked={!!set?.isActive} disabled={busy}
              onChange={(e) => onDefault(e.target.checked)} />
            <label className="form-check-label" htmlFor="mbDefault">
              This is the menu for the whole company
            </label>
          </div>
          <small>
            A person who is assigned a menu always uses that one. Everybody else
            uses the company default.
          </small>
        </div>

        <div className="cz-actions">
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- the whole tab ------------------------------ */

/* "All menus": one page in the builder showing every menu that exists, with who
   it belongs to. Picking one opens it for editing. */
function AllMenus({ sets, onPick }) {
  const [summ, setSumm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(sets.map(async (s) => {
      const a = await apiGet(`/dash/menu/assignments/${s.id}`);
      return [String(s.id), (a && a.assignments) || []];
    }))
      .then((entries) => { if (alive) setSumm(Object.fromEntries(entries)); })
      .catch(() => { /* leave the counts empty; editing still works */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sets]);

  return (
    <div className="mb-all">
      <h6><i className="bi bi-grid me-1"></i>All menus</h6>
      <p className="cz-note">Every menu in this company. Click one to edit it.</p>
      {loading && <div className="cz-empty sm"><span className="spinner-border spinner-border-sm"></span></div>}
      {!loading && sets.map((s) => {
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

/* "All forms": the same overview idea as "All menus", but for every form the
   company has, grouped the way the sidebar groups forms inside a section. */
function AllForms({ links, loading }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const grouped = useMemo(() => {
    const g = new Map();
    for (const l of links) {
      if (needle && !(l.title || '').toLowerCase().includes(needle)
        && !(l.group || '').toLowerCase().includes(needle)) continue;
      const name = l.group || 'Other';
      if (!g.has(name)) g.set(name, []);
      g.get(name).push(l);
    }
    return [...g.entries()];
  }, [links, needle]);

  return (
    <div className="mb-all">
      <h6><i className="bi bi-file-earmark-text me-1"></i>All forms</h6>
      <p className="cz-note">{links.length} form{links.length === 1 ? '' : 's'} in this company, the way they sit inside a section.</p>
      <input className="form-control form-control-sm mb-search" placeholder="Find a form…"
        value={q} onChange={(e) => setQ(e.target.value)} />
      {loading && <div className="cz-empty sm"><span className="spinner-border spinner-border-sm"></span></div>}
      {!loading && grouped.length === 0 && (
        <div className="cz-empty sm">{links.length ? 'Nothing matches.' : 'No forms found.'}</div>
      )}
      {!loading && grouped.map(([group, list]) => (
        <div key={group} className="mb-all-group">
          <div className="mb-catalog-group-h">
            <i className="bi bi-folder me-1"></i>{group}
            <em>{list.length}</em>
          </div>
          {list.map((l, i) => (
            <div key={`${l.kind}:${l.target}:${i}`} className="cz-item mb-all-row">
              <div className="cz-item-main">
                <strong><i className={`bi ${l.icon || 'bi-file-earmark-text'} me-1`}></i>{l.title}</strong>
                <small>{l.kind === 'form' ? (l.target || '') : (l.target || '')}</small>
              </div>
              <div className="cz-flags">
                <span className="badge text-bg-light">{l.kind}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function MenuBuilder({ data, act, me, busy, onChanged }) {
  const sets = data.menuSets || [];
  const [sel, setSel] = useState(sets[0]?.id ?? null);
  const [allView, setAllView] = useState(false);
  const [formView, setFormView] = useState(false);
  const [tree, setTree] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [dragKey, setDragKey] = useState(null);
  const [selected, setSelected] = useState(null);
  const [linkFor, setLinkFor] = useState(null);
  const [editFor, setEditFor] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [people, setPeople] = useState({ users: [], groups: [] });
  const [dirty, setDirty] = useState(false);
  const [loadedSet, setLoadedSet] = useState(null);
  const discardRef = useRef(false);

  const activeSet = useMemo(() => sets.find((s) => Number(s.id) === Number(sel)) || null, [sets, sel]);

  /* Switch to the first set once, when the list arrives. */
  useEffect(() => {
    if (sel == null && sets.length) setSel(sets[0].id);
  }, [sets, sel]);

  /* The link list does not change while editing, so it is fetched once. */
  useEffect(() => {
    let live = true;
    setCatLoading(true);
    apiGet('/dash/menu-catalog')
      .then((r) => { if (live) setCatalog(r.links || []); })
      .catch(() => { if (live) setCatalog([]); })
      .finally(() => { if (live) setCatLoading(false); });
    return () => { live = false; };
  }, []);

  /* People and groups, only when the assign dialog is about to be opened. */
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
    apiGet(`/dash/menu/assignments/${sel}`).then((r) => setAssignments(r.assignments || [])).catch(() => setAssignments([]));
  }, [assignOpen, sel]);

  /* Load the chosen set's items. Asking to be discarded drops the draft. */
  const loadItems = useCallback(async (setId) => {
    if (setId == null) { setTree([]); setLoadedSet(null); return; }
    try {
      const r = await apiGet(`/dash/menu-items/${setId}`);
      setTree(nest(r.items || []));
      setLoadedSet(setId);
      setDirty(false);
      setSelected(null);
    } catch (e) {
      setTree([]);
      setLoadedSet(setId);
    }
  }, []);

  useEffect(() => {
    if (discardRef.current) { discardRef.current = false; return; }
    if (sel != null && Number(sel) !== Number(loadedSet)) loadItems(sel);
    if (sel == null) setTree([]);
  }, [sel, loadedSet, loadItems]);

  /* Leave a set with unsaved work and switching away would lose it, so warn. */
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const numbers = useMemo(() => {
    const m = new Map();
    let n = 0;
    const walk = (list) => list.forEach((node) => {
      if (isSection(node)) {
        let inner = 0;
        node.children.forEach((c) => { inner++; m.set(c.key, inner); });
        walk(node.children);
        return;
      }
      n++;
      m.set(node.key, n);
    });
    walk(tree);
    return m;
  }, [tree]);

  const newSection = () => ({
    key: nextKey(), id: null, label: 'New section', kind: 'section',
    target: '', icon: 'bi-folder', openNew: false, color: '', visible: true, children: [],
  });

  const addSection = () => {
    setTree([...tree, newSection()]);
    setDirty(true);
  };

  /* "Add a section inside this one": the section is found wherever it sits and
     the fresh section becomes one of its children (- a nested section). */
  const addSubSection = (sec) => {
    setTree(patchKey(tree, sec.key, (s) => ({ ...s, children: [...s.children, newSection()] })));
    setDirty(true);
  };

  const appendLink = (link) => {
    /* Putting a link somewhere the person pointed at:
       1. the section whose "+" was pressed (or the selected one),
       2. the last section, so a drag into empty space still lands sensibly,
       3. the top of the menu when there are no sections. */
    const want = linkFor?.targetSection
      ?? (selected && isSection(selected) ? selected.key : null);
    appendLinkTo(want, link);
  };

  const appendLinkTo = (sectionKey, link) => {
    const node = asNode(link);
    if (sectionKey) {
      setTree(patchKey(tree, sectionKey, (s) => ({ ...s, children: [...s.children, node] })));
    } else {
      const lastSec = [...tree].reverse().find(isSection);
      if (lastSec) {
        setTree(patchKey(tree, lastSec.key, (s) => ({ ...s, children: [...s.children, node] })));
      } else {
        setTree([...tree, node]);
      }
    }
    setDirty(true);
  };

  const patchNode = (key, patch) => { setTree(patchKey(tree, key, (n) => ({ ...n, ...patch }))); setDirty(true); };

  const onDragStart = (key, e) => {
    setDragKey(key);
    e.dataTransfer.setData('text/mb-node', key);
    e.dataTransfer.effectAllowed = 'move';
  };

  /* Both drag sources in one place, so a link dragged out of the right-hand
     list behaves the same whichever gap it lands in. */
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

  const asNode = (link) => ({
    key: nextKey(), id: null, label: link.label, kind: link.kind, target: link.target,
    icon: link.icon, openNew: !!link.openNew, color: '', visible: true, children: [],
  });

  /* Drop onto a row: a section takes the link in, a link takes it right after
     itself, so "drop it there" is taken literally. */
  const onDropInto = (node, e) => {
    const catalogRaw = e.dataTransfer.getData('text/mb-catalog');
    const movingKey = e.dataTransfer.getData('text/mb-node');
    e.dataTransfer.setData('text/mb-node', '');
    setDragKey(null);

    if (catalogRaw) {
      let link;
      try { link = JSON.parse(catalogRaw); } catch (err) { return; }
      if (isSection(node)) appendLinkTo(node.key, link);
      else {
        const fresh = asNode(link);
        const after = afterKey(tree, node.key, fresh);
        if (after) { setTree(after); setDirty(true); }
        else appendLink(link);
      }
      return;
    }
    if (!movingKey) return;
    const hit = detach(tree, movingKey);
    if (!hit) return;

    /* Dropping a section inside itself or inside one of its own children would
       hide it, so the drop is refused and the menu is left as it was. */
    if (isSection(hit.node) && containsKey(node, movingKey)) { setTree(hit.rest); return; }

    setTree(isSection(node)
      ? intoKey(hit.rest, node.key, { ...hit.node, children: [] })
      : (afterKey(hit.rest, node.key, hit.node) ?? hit.rest));
    setDirty(true);
  };

  /* Drop into the gap between rows: a position, not a parent. */
  const onDropAt = (parentNode, index, e) => {
    const { link, movingKey } = readDrop(e);
    if (link) {
      /* a link from the catalog landed in a gap inside a section */
      const node = asNode(link);
      const next = [...(parentNode.children || [])];
      next.splice(Math.max(0, Math.min(index, next.length)), 0, node);
      setTree(patchKey(tree, parentNode.key, (n) => ({ ...n, children: next })));
      setDirty(true);
      return;
    }
    if (!movingKey) return;
    const hit = detach(tree, movingKey);
    if (!hit) return;

    const next = [...(parentNode.children || [])];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, hit.node);
    setTree(patchKey(hit.rest, parentNode.key, (n) => ({ ...n, children: next })));
    setDirty(true);
  };

  const removeNodeByKey = (key) => {
    setTree(removeNode(tree, key));
    setDirty(true);
  };

  /* Opening any menu later is a one-click step; the dirty guard is shared by the
     list on the left and the "All menus" overview, so no edit is ever lost. */
  const pickMenu = (id) => {
    if (dirty && !window.confirm(`${activeSet?.name || 'This menu'} has unsaved changes. Leave anyway?`)) return;
    setAllView(false);
    setFormView(false);
    setSel(id);
  };

  const save = async () => {
    if (sel == null) return;
    const items = flatten(tree);
    const r = await act(() => apiPost('/dash/menu-items/replace', { setId: sel, items }), 'Menu saved');
    if (r) {
      setDirty(false);
      /* Re-read so the ids on the draft match the rows now in the table. */
      await loadItems(sel);
      if (onChanged) onChanged();
    }
  };

  const discard = () => { setDirty(false); discardRef.current = true; loadItems(sel); };

  const setDefault = async (on) => {
    if (sel == null) return;
    await act(() => apiPost('/dash/menu-set/save', {
      id: sel, name: activeSet?.name || '', description: activeSet?.description || '',
      isActive: on, isAvailable: activeSet?.isAvailable !== false,
    }), on ? 'This is now the company menu' : 'No longer the company menu');
    if (onChanged) onChanged();
  };

  const doAssign = async (subjectType, subjectId) => {
    const r = await act(() => apiPost('/dash/menu/assign', { setId: sel, subjectType, subjectId }), 'Assigned');
    if (r) {
      try {
        const a = await apiGet(`/dash/menu/assignments/${sel}`);
        setAssignments(a.assignments || []);
      } catch (e) { /* leave the old list up; the next open re-reads */ }
      if (onChanged) onChanged();
    }
  };

  const doUnassign = async (id) => {
    const r = await act(() => apiPost('/dash/menu/assign/delete', { id }), 'Removed');
    if (r) {
      setAssignments((prev) => prev.filter((a) => Number(a.id) !== Number(id)));
      if (onChanged) onChanged();
    }
  };

  return (
    <div className="cz-grid-2 mb-wrap">
      <div className="cz-card">
        <h6><i className="bi bi-collection me-1"></i>Menus</h6>
        <p className="cz-note">
          A menu is one complete sidebar. Tick it as the company menu, or assign it
          to particular people or a group.
        </p>
        <div className="cz-list">
          <div className={`cz-item ${!formView && allView ? 'on' : ''}`} onClick={() => {
            if (allView) return;
            if (dirty && !window.confirm(`${activeSet?.name || 'This menu'} has unsaved changes. Leave anyway?`)) return;
            setFormView(false);
            setAllView(true);
          }}>
            <div className="cz-item-main">
              <strong><i className="bi bi-grid me-1"></i>All menus</strong>
              <small>Everything we have</small>
            </div>
            <div className="cz-flags"><span className="cz-count">{sets.length}</span></div>
          </div>
          <div className={`cz-item ${formView ? 'on' : ''}`} onClick={() => {
            if (formView) return;
            if (dirty && !window.confirm(`${activeSet?.name || 'This menu'} has unsaved changes. Leave anyway?`)) return;
            setAllView(false);
            setFormView(true);
          }}>
            <div className="cz-item-main">
              <strong><i className="bi bi-file-earmark-text me-1"></i>All forms</strong>
              <small>Every form in the company</small>
            </div>
            <div className="cz-flags"><span className="cz-count">{catalog.length}</span></div>
          </div>
          <div className="mb-hr"></div>
          {sets.length === 0 && <div className="cz-empty sm">No menu yet.</div>}
          {sets.map((s) => (
            <div key={s.id} className={`cz-item ${!allView && !formView && Number(s.id) === Number(sel) ? 'on' : ''}`}
              onClick={() => pickMenu(s.id)}>
              <div className="cz-item-main">
                <strong>{s.name}</strong>
                <small>{s.description || 'No description'}</small>
              </div>
              <div className="cz-flags">
                {s.isActive ? <span className="badge text-bg-primary">Company</span> : null}
                <span className="cz-count">{s.items ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
        {sel != null && !allView && (
          <button className="btn btn-sm btn-outline-primary w-100 mt-2" onClick={openAssign}>
            <i className="bi bi-person-check me-1"></i>Who sees this menu?
          </button>
        )}

        {/* A person choosing for themselves, as opposed to an administrator
            choosing for them. An administrator's choice above wins, which is
            why this is kept separate. */}
        <div className="cz-form">
          <h6 className="cz-form-h">Your own menu</h6>
          <p className="cz-note">
            You are <strong>{me}</strong>. Menus your administrator has given you
            always win over this.
          </p>
          <select className="form-select form-select-sm" value=""
            onChange={(e) => e.target.value && act(
              () => apiPost('/dash/menu/select', { setId: Number(e.target.value) }), 'Menu updated')}>
            <option value="">Choose a menu…</option>
            {sets.filter((s) => s.isAvailable !== false).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <NewMenuSet act={act} busy={busy} />
      </div>

      <div className="cz-card mb-panel">
        <h6>
          <i className="bi bi-list-nested me-1"></i>
          {formView ? 'All forms' : allView ? 'All menus' : (activeSet ? activeSet.name : 'Menu')}
        </h6>
        {formView ? (
          <AllForms links={catalog} loading={catLoading} />
        ) : allView ? (
          <AllMenus sets={sets} onPick={pickMenu} />
        ) : !sel ? <div className="cz-empty sm">Pick a menu on the left.</div> : (
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
              <div className="ms-auto d-flex gap-2">
                {dirty && (
                  <button className="btn btn-sm btn-outline-secondary" onClick={discard} disabled={busy}>
                    Discard
                  </button>
                )}
                <button className="btn btn-sm btn-primary" onClick={save} disabled={busy || !dirty}>
                  <i className="bi bi-check-lg me-1"></i>Save menu
                </button>
              </div>
            </div>

            <div className="mb-split">
              <div className="mb-canvas">
                {tree.length === 0 && (
                  <div className="cz-empty sm">
                    Drag a link in from the right, or start with a section.
                  </div>
                )}
                {tree.map((n, i) => (
                  <div key={n.key} className="mb-slot" onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      const { link, movingKey } = readDrop(e);
                      if (link) {
                        const next = [...tree];
                        next.splice(i, 0, asNode(link));
                        setTree(next);
                        setDirty(true);
                        return;
                      }
                      if (!movingKey) return;
                      const hit = detach(tree, movingKey);
                      if (!hit) return;
                      const next = [...hit.rest];
                      next.splice(i, 0, hit.node);
                      setTree(next);
                      setDirty(true);
                    }}>
                    <CanvasNode node={n} depth={0} numbers={numbers} dragKey={dragKey}
                      onDragStart={onDragStart} onDropAt={onDropAt} onDropInto={onDropInto}
                      onSelect={setSelected} selected={selected === n.key}
                      onAddLink={(sec) => setLinkFor({ targetSection: sec.key })}
                      onAddSection={addSubSection}
                      onToggleDelete={removeNodeByKey}
                      onEdit={setEditFor} />
                  </div>
                ))}
                <div className="mb-slot mb-slot-end" onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const { link, movingKey } = readDrop(e);
                    if (link) { appendLink(link); return; }
                    if (!movingKey) return;
                    const hit = detach(tree, movingKey);
                    if (hit) { setTree([...hit.rest, hit.node]); setDirty(true); }
                  }}></div>
              </div>

              <CatalogBox links={catalog} loading={catLoading} onAdd={appendLink} />
            </div>
          </>
        )}
      </div>

      {linkFor && (
        <LinkDialog value={linkFor} onClose={() => setLinkFor(null)}
          onSave={(link) => { appendLink(link); setLinkFor(null); }} />
      )}
      {editFor && (
        <EditDialog node={editFor} onChange={(n) => { patchNode(editFor.key, n); setEditFor(n); }}
          onClose={() => setEditFor(null)}
          onSave={(patch) => { patchNode(editFor.key, patch); setEditFor(null); }} />
      )}
      {assignOpen && (
        <AssignDialog set={activeSet} assignments={assignments}
          users={people.users} groups={people.groups} busy={busy}
          onAssign={doAssign} onUnassign={doUnassign} onDefault={setDefault}
          onClose={() => setAssignOpen(false)} />
      )}
    </div>
  );
}

function NewMenuSet({ act, busy }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <div className="cz-form">
      <h6 className="cz-form-h">New menu</h6>
      <div className="cz-field">
        <label>Name</label>
        <input className="form-control form-control-sm" value={name}
          onChange={(e) => setName(e.target.value)} placeholder="Sales" />
      </div>
      <div className="cz-field">
        <label>Description</label>
        <input className="form-control form-control-sm" value={desc}
          onChange={(e) => setDesc(e.target.value)} placeholder="What this menu is for" />
      </div>
      <button className="btn btn-sm btn-primary" disabled={!name.trim() || busy}
        onClick={async () => {
          await act(() => apiPost('/dash/menu-set/save', { name, description: desc, isAvailable: true }), 'Menu created');
          setName(''); setDesc('');
        }}>
        Create
      </button>
    </div>
  );
}
