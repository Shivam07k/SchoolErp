import React, { useState } from 'react';
import { getTheme, SECTION_COLORS } from '../theme';
import { isSection, leaves } from '../menuTree';

const PAL = SECTION_COLORS.map(s => s.c);

/* Stable colour per section name: the same group always gets the same
   colour across reloads, without having to persist a per-group map. */
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function colorFor(name) {
  return PAL[hashCode(String(name)) % PAL.length];
}

/* One custom-menu link. A form opens inside the app, a page or dynamic page
   goes to its own route, and a plain link opens in a new tab so the person
   never loses the work they were in the middle of. */
function CustomLeaf({ node, currentForm, onClick, color }) {
  const isForm = node.kind === 'form';
  const active = isForm && node.target === currentForm;
  const cls = `sidebar-item sidebar-leaf ${active ? 'active' : ''}`;
  const style = color ? { '--sec-c': color } : undefined;

  if (!isForm && node.kind === 'url') {
    return (
      <a className={cls} style={style} title={node.target || node.label}
        href={node.target || '#'} target={node.openNew === false ? undefined : '_blank'}
        rel="noreferrer noopener">
        <i className={`bi ${node.icon || 'bi-box-arrow-up-right'}`}></i><span>{node.label}</span>
      </a>
    );
  }
  return (
    <div className={cls} style={style} title={node.target || node.label} onClick={onClick}>
      <i className={`bi ${node.icon || 'bi-file-earmark-text'}`}></i><span>{node.label}</span>
    </div>
  );
}

/* A custom-menu section: a collapsible drawer holding its links. The body is
   always mounted inside an animated wrapper, so open/close glides smoothly
   instead of the items popping in and out. */
function CustomSection({ node, color, isOpen, onToggle, currentForm, onGo, depth }) {
  const kids = node.children || [];
  const open = isOpen(node.id);
  /* A section keeps a colour of its own when the menu says so; otherwise it
     gets the stable one the label has always produced. */
  const secColor = node.color || colorFor(node.label);
  return (
    <div className={`sidebar-group ${open ? 'open' : ''} ${depth > 0 ? 'sidebar-group-nested' : ''}`}
      style={secColor ? { '--sec-c': secColor } : undefined}>
      <div className={`sidebar-group-header ${open ? 'open' : ''}`}
        onClick={() => onToggle(node.id)} title={node.label}>
        <i className="bi bi-chevron-right"></i>
        {depth === 0 && <i className="sec-dot bi-none"></i>}
        <i className={`bi ${node.icon || 'bi-folder'}`}></i>
        <span>{node.label}</span>
      </div>
      <div className="sidebar-group-body">
        <div>
          {kids.map((c) => (
            isSection(c)
              ? <CustomSection key={c.id} node={c} isOpen={isOpen} onToggle={onToggle}
                  depth={depth + 1} currentForm={currentForm} onGo={onGo} />
              : <CustomLeaf key={c.id} node={c} color={secColor} currentForm={currentForm} onClick={onGo(c)} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ menu, custom, onNavigate, currentForm, isDev, mobileOpen, onCloseMobile, desktopHidden }) {
  const [openGroups, setOpenGroups] = useState({});
  const [search, setSearch] = useState('');
  const secColors = getTheme().sidebarSecColors === true;
  const toggleGroup = (key) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  /* Every drawer starts closed; while searching they all open so the matches
     are actually visible. */
  const groupOpen = (id) => (search ? true : !!openGroups[id]);

  const go = (target, fid) => {
    onNavigate(target, fid);
    if (onCloseMobile) onCloseMobile();
  };

  const filteredMenu = {};
  for (const [mg, subgroups] of Object.entries(menu)) {
    for (const [sg, items] of Object.entries(subgroups)) {
      const filtered = items.filter(it => !search || (it.title || '').toLowerCase().includes(search.toLowerCase()));
      if (filtered.length > 0) {
        if (!filteredMenu[mg]) filteredMenu[mg] = {};
        filteredMenu[mg][sg] = filtered;
      }
    }
  }

  const groupColors = {};
  Object.keys(filteredMenu).forEach((mg) => { groupColors[mg] = colorFor(mg); });

  /* Where a custom link goes when it is clicked. */
  const goCustom = (node) => () => {
    if (node.kind === 'form') { go('form', node.target); return; }
    /* A dashboard or dynamic page has no page of its own to open, and the
       dashboard is where those live, so that is where the link leads. */
    if (node.kind === 'page' || node.kind === 'dyn') { go('dashboard'); return; }
    window.open(node.target || '#', '_blank', 'noopener');
  };

  /* A custom menu is drawn on its own; the search box filters it by label. */
  const customTree = custom && custom.tree
    ? custom.tree
      .map((node) => {
        if (!search) return node;
        const keep = { ...node, children: [] };
        const add = (n) => {
          for (const c of n.children || []) {
            if (isSection(c)) add(c);
            else if ((c.label || '').toLowerCase().includes(search.toLowerCase())) keep.children.push(c);
          }
        };
        add(node);
        return keep;
      })
      .filter((n) => !search || n.label.toLowerCase().includes(search.toLowerCase()) || n.children.length)
    : null;

  return (
    <div className={`sidebar ${mobileOpen ? 'mobile-open' : ''} ${desktopHidden ? 'hidden' : ''}`} data-sec-colors="off">
      <div className="sidebar-header">
        <div className="sidebar-logo">x</div>
        <span className="sidebar-brand">xErp</span>
        {mobileOpen && (
          <button className="btn btn-sm btn-outline-light border-0 ms-auto sidebar-close" style={{ fontSize: 'calc(14px * var(--fs, 1))', padding: '2px 6px' }} onClick={onCloseMobile} aria-label="Close menu">
            <i className="bi bi-x-lg"></i>
          </button>
        )}
      </div>
      <div className="sidebar-search">
        <input type="text" placeholder="Search menu..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="sidebar-menu">
        <div
          className={`sidebar-item ${!currentForm ? 'active' : ''}`}
          style={secColors ? { '--sec-c': PAL[0] } : undefined}
          onClick={() => go('dashboard')}
        >
          <i className="bi bi-speedometer2"></i><span>Dashboard</span>
        </div>
        <div
          className={`sidebar-item ${currentForm === '__school__' ? 'active' : ''}`}
          style={secColors ? { '--sec-c': PAL[0] } : undefined}
          onClick={() => go('school')}
        >
          <i className="bi bi-mortarboard"></i><span>School ERP</span>
        </div>
        {isDev && (
          <div
            className={`sidebar-item ${currentForm === '__generator__' ? 'active' : ''}`}
            style={secColors ? { '--sec-c': PAL[1] } : undefined}
            onClick={() => go('generator')}
          >
            <i className="bi bi-magic"></i><span>Form Generator</span>
          </div>
        )}
        <div className="sidebar-divider"></div>

        {customTree ? (
          <>
            {customTree.length === 0 && (
              <div className="sidebar-item" style={{ opacity: 0.55 }}>
                <i className="bi bi-inboxes"></i><span>No links match</span>
              </div>
            )}
            {customTree.map((node) => (
              isSection(node)
                ? <CustomSection key={node.id} node={node}
                    isOpen={groupOpen}
                    onToggle={toggleGroup}
                    currentForm={currentForm} onGo={goCustom} depth={0} />
                : <CustomLeaf key={node.id} node={node} color={colorFor(node.label)}
                    currentForm={currentForm} onClick={goCustom(node)} />
            ))}
          </>
        ) : (
          <>
            {Object.entries(filteredMenu).map(([mg, subgroups]) => (
              <div key={mg} className={`sidebar-group ${groupOpen(mg) ? 'open' : ''}`}
                style={secColors ? { '--sec-c': groupColors[mg] } : undefined}>
                <div className={`sidebar-group-header ${groupOpen(mg) ? 'open' : ''}`} onClick={() => toggleGroup(mg)} title={mg}>
                  <i className="bi bi-chevron-right"></i>
                  {secColors && <i className="sec-dot bi-none"></i>}
                  <span>{mg}</span>
                </div>
                <div className="sidebar-group-body">
                  <div>
                    {Object.entries(subgroups).map(([sg, items]) => (
                      <div key={sg}>
                        {sg !== '-' && <div className="sidebar-subgroup">{sg}</div>}
                        {items.map((item, i) => (
                          <div key={i} className={`sidebar-item sidebar-leaf ${currentForm === item.formId ? 'active' : ''}`}
                            title={item.title}
                            onClick={() => item.formId && go('form', item.formId)}>
                            <i className="bi bi-file-earmark-text"></i>
                            <span>{item.title}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {Object.keys(filteredMenu).length === 0 && (
              <div className="sidebar-item" style={{ opacity: 0.55 }}><i className="bi bi-inboxes"></i><span>No menu items</span></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
