import React, { useState } from 'react';
import { navigate } from '../utils';
import {
  ACCENTS, UI_STYLES, SIDEBAR_COLORS, TEXT_SIZES, BUTTON_SIZES,
  BUTTON_STYLES, GRID_STYLES, DENSITIES, ACTION_BTN_STYLES, ACTION_BTN_SIZES,
  SECTION_COLORS, FONT_SCALE_MIN, FONT_SCALE_MAX,
  getTheme, setTheme,
} from '../theme';

function Section({ title, icon, children }) {
  return (
    <div className="ap-section">
      <h6><i className={`bi ${icon} me-1`}></i>{title}</h6>
      {children}
    </div>
  );
}

function SegCtrl({ items, value, onChange, renderLabel }) {
  return (
    <div className="theme-seg">
      {items.map(item => (
        <button key={item.key} className={value === item.key ? 'on' : ''} onClick={() => onChange(item.key)}>
          {renderLabel ? renderLabel(item) : item.name}
        </button>
      ))}
    </div>
  );
}

function SwatchGrid({ items, value, onChange, getKey, getName, getStyle }) {
  return (
    <div className="swatches">
      {items.map((item, i) => {
        const k = getKey ? getKey(item, i) : item;
        const n = getName ? getName(item, i) : item;
        const s = getStyle ? getStyle(item, i) : {};
        return (
          <div key={k} className={`swatch ${value === k ? 'on' : ''}`}
            style={s} title={n} onClick={() => onChange(k)} />
        );
      })}
    </div>
  );
}

function ColorInput({ label, value, onChange }) {
  return (
    <div className="d-flex align-items-center gap-2 mt-1">
      <label className="form-label mb-0" style={{ minWidth: 50, fontSize: 'calc(11px * var(--fs, 1))' }}>{label}</label>
      <input type="color" value={value || '#2563eb'} onChange={e => onChange(e.target.value)}
        style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }} />
      <input type="text" className="form-control form-control-sm" value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder="#hex" style={{ fontSize: 'calc(11px * var(--fs, 1))', flex: 1 }} />
    </div>
  );
}

function Slider({ label, value, min, max, unit, onChange }) {
  return (
    <div className="d-flex align-items-center gap-2 mt-1">
      <label className="form-label mb-0" style={{ minWidth: 50, fontSize: 'calc(11px * var(--fs, 1))' }}>{label}</label>
      <input type="range" className="form-range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ fontSize: 'calc(11px * var(--fs, 1))', minWidth: 36, textAlign: 'right', color: 'var(--text-secondary)' }}>
        {value}{unit}
      </span>
    </div>
  );
}

function UIStyleGrid({ value, onChange }) {
  const [preview, setPreview] = useState(null);
  const previews = {
    classic: '#ffffff',
    flat: '#f5f5f5',
    soft: '#eef1f8',
    neu: '#e4e9f2',
    'neu-dark': '#1e293b',
    glass: 'rgba(255,255,255,0.5)',
    'glass-dark': 'rgba(15,23,42,0.5)',
    clay: '#fef3c7',
    aurora: 'linear-gradient(135deg, #667eea, #764ba2)',
    minimal: '#ffffff',
    cyber: '#0a0a0a',
  };
  const shadows = {
    classic: '0 1px 3px rgba(0,0,0,0.1)',
    flat: 'none',
    soft: '0 8px 24px rgba(136,152,180,0.25)',
    neu: '6px 6px 12px #b8bec7, -6px -6px 12px #ffffff',
    'neu-dark': '6px 6px 12px #0a0f1a, -6px -6px 12px #2a3a5c',
    glass: '0 8px 32px rgba(0,0,0,0.08)',
    'glass-dark': '0 8px 32px rgba(0,0,0,0.3)',
    clay: '0 8px 20px rgba(0,0,0,0.15), inset 0 -4px 8px rgba(0,0,0,0.06)',
    aurora: '0 8px 32px rgba(102,126,234,0.3)',
    minimal: 'none',
    cyber: '0 0 15px rgba(0,255,255,0.2), inset 0 0 15px rgba(0,255,255,0.05)',
  };

  return (
    <div className="ui-grid">
      {UI_STYLES.map(u => (
        <button key={u.key} className={`ui-card ${value === u.key ? 'on' : ''}`}
          onClick={() => onChange(u.key)}
          onMouseEnter={() => setPreview(u.key)} onMouseLeave={() => setPreview(null)}>
          <span className="ui-preview" style={{
            background: previews[u.key] || '#fff',
            boxShadow: shadows[u.key] || 'none',
            borderRadius: u.key === 'soft' || u.key === 'clay' ? '10px' : u.key === 'cyber' ? '2px' : '6px',
            border: u.key === 'cyber' ? '1px solid rgba(0,255,255,0.3)' : u.key === 'flat' ? '1px solid #e0e0e0' : undefined,
            backdropFilter: u.key === 'glass' || u.key === 'glass-dark' ? 'blur(4px)' : undefined,
          }}>
            <i style={{
              background: u.key === 'cyber' ? 'rgba(0,255,255,0.3)' : u.key === 'aurora' ? 'rgba(255,255,255,0.3)' : undefined,
              border: u.key === 'cyber' ? '1px solid rgba(0,255,255,0.5)' : undefined,
              boxShadow: u.key === 'neu' || u.key === 'neu-dark'
                ? '2px 2px 4px rgba(0,0,0,0.15), -2px -2px 4px rgba(255,255,255,0.5)' : undefined,
            }}></i>
          </span>
          <strong>{u.name}</strong>
          <small>{u.desc}</small>
        </button>
      ))}
    </div>
  );
}

function GradientPreview({ angle, stop, color1, color2 }) {
  return (
    <div style={{
      height: 36, borderRadius: 8, border: '1px solid var(--card-border)',
      background: `linear-gradient(${angle}deg, ${color1} ${stop}%, ${color2})`,
      marginTop: 4, transition: 'all 0.2s',
    }} />
  );
}

export default function ThemeSettings() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('appearance');
  const [theme, setLocal] = useState(getTheme());

  const pick = (patch) => setLocal(setTheme(patch));
  const a = ACCENTS[theme.accent] || ACCENTS.blue;

  return (
    <div className="theme-wrap">
      <button className="btn btn-sm btn-outline-light" title="Appearance & Theme" onClick={() => setOpen(o => !o)}>
        <i className="bi bi-palette"></i><span className="d-none d-md-inline ms-1">Theme</span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 400 }} onClick={() => setOpen(false)} />
          <div className="appearance-panel animate-scale" onClick={e => e.stopPropagation()}>
            <div className="ap-head">
              <span><i className="bi bi-magic me-2"></i>Theme Settings</span>
              <button className="btn-row" onClick={() => setOpen(false)}><i className="bi bi-x-lg"></i></button>
            </div>

            <div className="ap-tabs">
              {[
                { key: 'appearance', icon: 'bi-palette', label: 'Style' },
                { key: 'sidebar', icon: 'bi-layout-sidebar', label: 'Sidebar' },
                { key: 'typography', icon: 'bi-fonts', label: 'Type' },
                { key: 'buttons', icon: 'bi-hand-index', label: 'Buttons' },
                { key: 'grid', icon: 'bi-grid-3x3', label: 'Grid' },
              ].map(t => (
                <button key={t.key} className={`ap-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
                  <i className={`bi ${t.icon}`}></i><span>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="ap-actions">
              <button className="ap-action-btn" onClick={() => { setOpen(false); navigate('#/customize'); }}>
                <i className="bi bi-sliders2"></i>
                <span>
                  <strong>Customize</strong>
                  <small>Sidebar, dashboard &amp; dynamic pages</small>
                </span>
                <i className="bi bi-chevron-right ms-auto"></i>
              </button>
            </div>

            {tab === 'appearance' && (
              <>
                <Section title="Mode" icon="bi-circle-half">
                  <SegCtrl items={[{ key: 'light', name: 'Light' }, { key: 'dark', name: 'Dark' }]}
                    value={theme.mode} onChange={v => pick({ mode: v })}
                    renderLabel={item => <><i className={`bi bi-${item.key === 'light' ? 'sun' : 'moon-stars'}`}></i> {item.name}</>} />
                </Section>

                <Section title="UI Style" icon="bi-layers">
                  <UIStyleGrid value={theme.ui} onChange={v => pick({ ui: v })} />
                </Section>

                <Section title="Accent Gradient" icon="bidroplet-half">
                  <SwatchGrid
                    items={Object.entries(ACCENTS)}
                    value={theme.accent}
                    onChange={v => pick({ accent: v })}
                    getKey={([k]) => k}
                    getName={([k, v]) => v.name}
                    getStyle={([k, v]) => ({ background: `linear-gradient(135deg, ${v.c}, ${v.g2})` })}
                  />
                  <Slider label="Angle" value={theme.accentGradAngle || 135} min={0} max={360} unit="deg"
                    onChange={v => pick({ accentGradAngle: v })} />
                  <Slider label="Split" value={theme.accentGradStop || 50} min={0} max={100} unit="%"
                    onChange={v => pick({ accentGradStop: v })} />
                  <GradientPreview angle={theme.accentGradAngle || 135} stop={theme.accentGradStop || 50}
                    color1={a.c} color2={a.g2 || a.c} />
                </Section>

                <Section title="Density" icon="bi-arrows-expand">
                  <div className="density-row">
                    {DENSITIES.map(d => (
                      <button key={d.key} className={`density-card ${theme.density === d.key ? 'on' : ''}`}
                        onClick={() => pick({ density: d.key })}>
                        <span className={`density-visual dv-${d.key}`}>
                          {[0, 1, 2].map(i => <i key={i} />)}
                        </span>
                        <strong>{d.name}</strong>
                        <small>{d.desc}</small>
                      </button>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {tab === 'sidebar' && (
              <>
                <Section title="Menu Behaviour" icon="bi-layout-sidebar">
                  <div className="ddes-row">
                    <span className="ddes-row-ic"><i className="bi bi-lock"></i></span>
                    <span className="ddes-row-lb">
                      <strong>Menu always open</strong>
                      <small>On desktop the menu stays pinned open; on phones it is still a swipe drawer.</small>
                    </span>
                    <span className="ddes-toggle on" style={{ opacity: 0.85, cursor: 'default' }}></span>
                  </div>
                </Section>

                <Section title="Colour by Section" icon="bi-palette-fill">
                  <div className="ddes-row">
                    <span className="ddes-row-ic"><i className="bi bi-collection"></i></span>
                    <span className="ddes-row-lb">
                      <strong>Give each section its own colour</strong>
                      <small>Each main menu group gets a colour bar, dot and hover tint</small>
                    </span>
                    <button className={`ddes-toggle ${theme.sidebarSecColors !== false ? 'on' : ''}`}
                      aria-pressed={theme.sidebarSecColors !== false}
                      onClick={() => pick({ sidebarSecColors: theme.sidebarSecColors === false })} />
                  </div>
                  {theme.sidebarSecColors !== false && (
                    <div className="sec-legend">
                      {SECTION_COLORS.map(s => (
                        <div className="sec-legend-item" key={s.key} style={{ '--c': s.c }}>
                          <i></i><span>{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="Sidebar Color" icon="bi-palette-fill">
                  <div className="sidebar-color-grid">
                    {Object.entries(SIDEBAR_COLORS).map(([k, sc]) => (
                      <button key={k} className={`sidebar-color-btn ${theme.sidebarColor === k ? 'on' : ''}`}
                        onClick={() => pick({ sidebarColor: k })}>
                        <span className="sidebar-color-preview" style={{
                          background: k === 'accent'
                            ? `linear-gradient(135deg, ${a.c}, ${a.h})`
                            : sc.bg || '#fff',
                          color: sc.text,
                        }}>
                          {k === 'accent' ? 'A' : k[0].toUpperCase()}
                        </span>
                        <small>{sc.name}</small>
                      </button>
                    ))}
                  </div>
                </Section>

                <Section title="Custom Colors" icon="bi-eyedropper">
                  <ColorInput label="BG" value={theme.sidebarCustomBg} onChange={v => pick({ sidebarCustomBg: v })} />
                  <ColorInput label="Text" value={theme.sidebarCustomText} onChange={v => pick({ sidebarCustomText: v })} />
                  {(theme.sidebarCustomBg || theme.sidebarCustomText) && (
                    <button className="btn btn-outline-secondary btn-xs mt-2" onClick={() => pick({ sidebarCustomBg: '', sidebarCustomText: '' })}>
                      <i className="bi bi-arrow-counterclockwise"></i> Reset to preset
                    </button>
                  )}
                </Section>
              </>
            )}

            {tab === 'typography' && (
              <>
                <Section title="Text Size" icon="bi-fonts">
                  <div className="fss-btns">
                    {TEXT_SIZES.map(s => (
                      <button key={s.key} className={Math.abs((theme.fs ?? 1) - s.fs) < 0.03 ? 'on' : ''}
                        onClick={() => pick({ textSize: s.key, fs: s.fs })}
                        title={`Whole system at ${Math.round(s.fs * 100)}%`}>
                        {s.key.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <div className="fss-scale">
                    <i className="bi bi-fonts" style={{ color: 'var(--text-muted)' }}></i>
                    <span className="fss-demo">The quick brown fox jumps over the lazy dog</span>
                    <input type="range" min={FONT_SCALE_MIN} max={FONT_SCALE_MAX} step={0.01}
                      value={theme.fs ?? 1}
                      onChange={e => pick({ fs: Number(e.target.value) })}
                      aria-label="Whole system font size" />
                    <span className="fss-val">{Math.round((theme.fs ?? 1) * 100)}%</span>
                  </div>
                  <div className="fss-preset-note">
                    Scales every part of the system at once &mdash; menu, forms, grids, buttons,
                    dashboard and tables. Presets above are shortcuts for the slider.
                  </div>
                </Section>
              </>
            )}

            {tab === 'buttons' && (
              <>
                <Section title="Button Size" icon="bi-arrows-angle-expand">
                  <div className="density-row">
                    {BUTTON_SIZES.map(s => (
                      <button key={s.key} className={`density-card ${theme.btnSize === s.key ? 'on' : ''}`}
                        onClick={() => pick({ btnSize: s.key })}>
                        <span style={{ height: s.h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{
                            width: s.h, height: '60%', borderRadius: s.radius, background: 'var(--accent)',
                            display: 'inline-block',
                          }}></span>
                        </span>
                        <strong>{s.name}</strong>
                        <small>{s.h}</small>
                      </button>
                    ))}
                  </div>
                </Section>

                <Section title="Button Style" icon="bi-hand-index-thumb">
                  <div className="btn-style-grid">
                    {BUTTON_STYLES.map(bs => (
                      <button key={bs.key} className={`btn-style-card ${theme.btnStyle === bs.key ? 'on' : ''}`}
                        onClick={() => pick({ btnStyle: bs.key })}>
                        <span className={`btn-preview bp-${bs.key}`}>Button</span>
                        <strong>{bs.name}</strong>
                        <small>{bs.desc}</small>
                      </button>
                    ))}
                  </div>
                </Section>

                <Section title="Action Buttons Shape" icon="bi-ui-checks-grid">
                  <div className="btn-style-grid">
                    {ACTION_BTN_STYLES.map(bs => (
                      <button key={bs.key} className={`btn-style-card ${theme.actionBtnStyle === bs.key ? 'on' : ''}`}
                        onClick={() => pick({ actionBtnStyle: bs.key })}>
                        <span className="btn-preview" style={{
                          borderRadius: bs.radius,
                          background: 'var(--page-bg)',
                          border: '1.5px solid var(--card-border)',
                          padding: '3px 8px',
                          fontSize: 'calc(11px * var(--fs, 1))',
                        }}>
                          <i className="bi bi-pencil-square" style={{ fontSize: 'calc(12px * var(--fs, 1))' }}></i>
                        </span>
                        <strong>{bs.name}</strong>
                        <small>{bs.desc}</small>
                      </button>
                    ))}
                  </div>
                </Section>

                <Section title="Action Buttons Size" icon="bi-arrows-angle-expand">
                  <div className="density-row">
                    {ACTION_BTN_SIZES.map(s => (
                      <button key={s.key} className={`density-card ${theme.actionBtnSize === s.key ? 'on' : ''}`}
                        onClick={() => pick({ actionBtnSize: s.key })}>
                        <span style={{ height: s.h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{
                            width: s.h, height: '60%', borderRadius: 'var(--action-btn-radius, 8px)',
                            background: 'var(--page-bg)', border: '1.5px solid var(--card-border)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <i className="bi bi-pencil-square" style={{ fontSize: s.icon }}></i>
                          </span>
                        </span>
                        <strong>{s.name}</strong>
                        <small>{s.h}</small>
                      </button>
                    ))}
                  </div>
                </Section>

                <Section title="Action Button Colors" icon="bi-palette-fill">
                  <div className="d-flex flex-column gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="btn-preview" style={{ background: theme.actionEditColor || '#2563eb', color: '#fff', border: 'none', borderRadius: 'var(--action-btn-radius, 8px)', padding: '4px 10px', fontSize: 'calc(11px * var(--fs, 1))', minWidth: 40, textAlign: 'center' }}>
                        <i className="bi bi-pencil-square"></i>
                      </span>
                      <label className="form-label mb-0" style={{ fontSize: 'calc(11px * var(--fs, 1))', minWidth: 40 }}>Edit</label>
                      <input type="color" value={theme.actionEditColor || '#2563eb'} onChange={e => pick({ actionEditColor: e.target.value })}
                        style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }} />
                      <input type="text" className="form-control form-control-sm" value={theme.actionEditColor || ''} onChange={e => pick({ actionEditColor: e.target.value })}
                        placeholder="#hex" style={{ fontSize: 'calc(11px * var(--fs, 1))', flex: 1 }} />
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="btn-preview" style={{ background: theme.actionDeleteColor || '#ef4444', color: '#fff', border: 'none', borderRadius: 'var(--action-btn-radius, 8px)', padding: '4px 10px', fontSize: 'calc(11px * var(--fs, 1))', minWidth: 40, textAlign: 'center' }}>
                        <i className="bi bi-trash3"></i>
                      </span>
                      <label className="form-label mb-0" style={{ fontSize: 'calc(11px * var(--fs, 1))', minWidth: 40 }}>Delete</label>
                      <input type="color" value={theme.actionDeleteColor || '#ef4444'} onChange={e => pick({ actionDeleteColor: e.target.value })}
                        style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }} />
                      <input type="text" className="form-control form-control-sm" value={theme.actionDeleteColor || ''} onChange={e => pick({ actionDeleteColor: e.target.value })}
                        placeholder="#hex" style={{ fontSize: 'calc(11px * var(--fs, 1))', flex: 1 }} />
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="btn-preview" style={{ background: theme.actionPrintColor || '#0ea5e9', color: '#fff', border: 'none', borderRadius: 'var(--action-btn-radius, 8px)', padding: '4px 10px', fontSize: 'calc(11px * var(--fs, 1))', minWidth: 40, textAlign: 'center' }}>
                        <i className="bi bi-printer"></i>
                      </span>
                      <label className="form-label mb-0" style={{ fontSize: 'calc(11px * var(--fs, 1))', minWidth: 40 }}>Print</label>
                      <input type="color" value={theme.actionPrintColor || '#0ea5e9'} onChange={e => pick({ actionPrintColor: e.target.value })}
                        style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }} />
                      <input type="text" className="form-control form-control-sm" value={theme.actionPrintColor || ''} onChange={e => pick({ actionPrintColor: e.target.value })}
                        placeholder="#hex" style={{ fontSize: 'calc(11px * var(--fs, 1))', flex: 1 }} />
                    </div>
                    {(theme.actionEditColor || theme.actionDeleteColor || theme.actionPrintColor) && (
                      <button className="btn btn-outline-secondary btn-xs" onClick={() => pick({ actionEditColor: '', actionDeleteColor: '', actionPrintColor: '' })}>
                        <i className="bi bi-arrow-counterclockwise"></i> Reset to defaults
                      </button>
                    )}
                  </div>
                </Section>
              </>
            )}

            {tab === 'grid' && (
              <>
                <Section title="Table Style" icon="bi-grid-3x3-gap">
                  <div className="grid-style-grid">
                    {GRID_STYLES.map(gs => (
                      <button key={gs.key} className={`grid-style-card ${theme.gridStyle === gs.key ? 'on' : ''}`}
                        onClick={() => pick({ gridStyle: gs.key })}>
                        <span className={`grid-preview gp-${gs.key}`}>
                          <i></i><i></i><i></i>
                        </span>
                        <strong>{gs.name}</strong>
                        <small>{gs.desc}</small>
                      </button>
                    ))}
                  </div>
                </Section>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
