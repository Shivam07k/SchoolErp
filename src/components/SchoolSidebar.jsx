import React, { useEffect, useMemo, useState } from 'react';
import { SCHOOL_MENU, SCHOOL_GROUPS, canUse } from '../school/menu';

function initials(name) {
  const parts = String(name || 'School').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || 'S';
}

export default function SchoolSidebar({
  me, currentModule, currentSub, onNavigate,
  mobileOpen, onCloseMobile, desktopHidden,
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState({ Core: true });

  const branding = me?.branding || {};
  const brandName = branding.instituteName || 'School ERP';
  const shortName = branding.shortName || brandName;

  // Stable visible items - never empty during loading
  const term = search.trim().toLowerCase();
  const visible = useMemo(() => {
    const allowed = SCHOOL_MENU.filter((m) => canUse(me, m));
    if (!term) return allowed;
    return allowed
      .map((m) => {
        const moduleHit = m.label.toLowerCase().includes(term);
        if (!m.children) return moduleHit ? m : null;
        const kids = moduleHit ? m.children : m.children.filter((c) => c.label.toLowerCase().includes(term));
        return kids.length ? { ...m, children: kids } : null;
      })
      .filter(Boolean);
  }, [me, term]);

  const go = (path) => {
    onNavigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  const isModuleOpen = (key) => (term ? true : !!open[key]);
  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const groupItems = (group) => visible.filter((m) => m.group === group);

  useEffect(() => {
    const active = SCHOOL_MENU.find((m) => m.key === currentModule);
    if (active?.group) setOpen((prev) => ({ ...prev, [active.group]: true }));
  }, [currentModule]);

  return (
    <aside className={`sidebar school-sidebar ${mobileOpen ? 'mobile-open' : ''} ${desktopHidden ? 'hidden' : ''}`}>
      <div className="sidebar-header school-sidebar-brand">
        <div className="sidebar-logo">{initials(shortName)}</div>
        <div className="school-brand-text">
          <span className="sidebar-brand">{shortName}</span>
          <span className="school-brand-sub">{brandName}</span>
        </div>
        {mobileOpen && (
          <button
            className="btn btn-sm btn-outline-light border-0 ms-auto sidebar-close"
            style={{ fontSize: 'calc(14px * var(--fs, 1))', padding: '2px 6px' }}
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        )}
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search modules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="sidebar-menu" tabIndex="0" aria-label="School modules">
        {SCHOOL_GROUPS.map((group) => {
          const items = groupItems(group);
          if (!items.length) return null;
          return (
            <div className="school-nav-group" key={group}>
              <div className="school-nav-group-label">{group}</div>
              {items.map((m) => {
                const moduleActive = currentModule === m.key;
                if (!m.children) {
                  if (!m.built) {
                    return (
                      <div className="sidebar-item sidebar-soon" key={m.key} title={`${m.label} - coming soon`}>
                        <i className={`bi ${m.icon}`}></i>
                        <span>{m.label}</span>
                        <span className="soon-badge">Soon</span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={m.key}
                      className={`sidebar-item ${moduleActive ? 'active' : ''}`}
                      title={m.label}
                      onClick={() => go(m.path)}
                    >
                      <i className={`bi ${m.icon}`}></i>
                      <span>{m.label}</span>
                    </div>
                  );
                }

                const expanded = isModuleOpen(m.key);
                return (
                  <div className={`sidebar-group school-module ${expanded ? 'open' : ''}`} key={m.key}>
                    <div
                      className={`sidebar-group-header ${expanded ? 'open' : ''} ${moduleActive ? 'active-module' : ''}`}
                      title={m.label}
                      onClick={() => toggle(m.key)}
                    >
                      <i className="bi bi-chevron-right"></i>
                      <i className={`bi ${m.icon}`}></i>
                      <span>{m.label}</span>
                      {!m.built && <span className="soon-badge">Soon</span>}
                    </div>
                    <div className="sidebar-group-body">
                      <div>
                        {m.children.map((child) => {
                          if (!child.built) {
                            return (
                              <div className="sidebar-item sidebar-leaf sidebar-soon" key={child.key} title={`${child.label} - coming soon`}>
                                <i className="bi bi-dot"></i>
                                <span>{child.label}</span>
                                <span className="soon-badge">Soon</span>
                              </div>
                            );
                          }
                          const active = moduleActive && (currentSub === child.key || (!currentSub && child.key === m.children[0]?.key));
                          return (
                            <div
                              key={child.key}
                              className={`sidebar-item sidebar-leaf ${active ? 'active' : ''}`}
                              title={child.label}
                              onClick={() => go(child.path)}
                            >
                              <i className="bi bi-dot"></i>
                              <span>{child.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="sidebar-item" style={{ opacity: 0.55 }}>
            <i className="bi bi-inboxes"></i><span>No modules match</span>
          </div>
        )}
      </div>
    </aside>
  );
}
