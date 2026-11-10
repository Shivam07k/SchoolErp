import React from 'react';
import {
  DASH_BLOCKS, DASH_PRESETS, DASH_CARD_STYLES, DASH_CHART_TYPES,
  DASH_PALETTES, DASH_COLUMNS,
} from '../dashboardDesign';

function Toggle({ on, onChange, disabled, title }) {
  return (
    <button className={`ddes-toggle ${on ? 'on' : ''}`} disabled={disabled}
      title={title} aria-pressed={on}
      onClick={() => !disabled && onChange(!on)} />
  );
}

function Sec({ title, children }) {
  return (
    <div className="ddes-sec">
      <h6>{title}</h6>
      {children}
    </div>
  );
}

export default function DashboardDesigner({ design, onChange, onClose, onReset }) {
  const b = design.blocks;
  const setBlock = (id, v) => onChange({ blocks: { ...b, [id]: v ? 1 : 0 } });

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 510, background: 'rgba(15,23,42,0.35)' }}
        onClick={onClose} />
      <div className="ddes animate-scale" role="dialog" aria-label="Dashboard designer">
        <div className="ddes-head">
          <i className="bi bi-sliders2" style={{ color: 'var(--accent)' }}></i>
          <h6>Dashboard Designer</h6>
          <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={onClose} aria-label="Close">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="ddes-body">
          <Sec title="Ready-made designs">
            <div className="ddes-presets">
              {DASH_PRESETS.map(p => (
                <button key={p.key} className={`ddes-preset ${design.preset === p.key ? 'on' : ''}`}
                  onClick={() => onChange({ preset: p.key, blocks: { ...p.blocks } })}>
                  <span className="ddes-preset-mini">
                    {[0, 1, 2, 3].map(i => <i key={i} style={{ opacity: p.mini[i] ? undefined : 0.12 }} />)}
                  </span>
                  <strong>{p.name}</strong>
                  <small>{p.desc}</small>
                </button>
              ))}
            </div>
            <div className="ddes-note">
              Picking a design replaces the block switches below. Tweak them afterwards and the
              preset chip on the dashboard switches to &ldquo;Custom&rdquo;.
            </div>
          </Sec>

          <Sec title="Sections">
            {DASH_BLOCKS.map(bl => (
              <div className="ddes-row" key={bl.id}>
                <span className="ddes-row-ic"><i className={`bi ${bl.icon}`}></i></span>
                <span className="ddes-row-lb">
                  <strong>{bl.name}</strong>
                  <small>{bl.desc}</small>
                </span>
                <Toggle on={!!b[bl.id]} onChange={v => setBlock(bl.id, v)} title={`Show ${bl.name}`} />
              </div>
            ))}
          </Sec>

          <Sec title="Stat card design">
            <div className="ddes-opts">
              {DASH_CARD_STYLES.map(s => (
                <button key={s.key} className={`ddes-opt ${design.cardStyle === s.key ? 'on' : ''}`}
                  onClick={() => onChange({ cardStyle: s.key })} title={s.desc}>
                  <i className={`bi ${s.icon} ddes-opt-ic`}></i>{s.name}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <div className="ddes-note mb-1">Columns per row</div>
              <div className="ddes-opts">
                {DASH_COLUMNS.map(c => (
                  <button key={c.key} className={`ddes-opt ${design.columns === c.key ? 'on' : ''}`}
                    onClick={() => onChange({ columns: c.key })}>{c.name}</button>
                ))}
              </div>
            </div>
          </Sec>

          <Sec title="Chart design">
            <div className="ddes-opts mb-2">
              {DASH_CHART_TYPES.map(t => (
                <button key={t.key} className={`ddes-opt ${design.chartType === t.key ? 'on' : ''}`}
                  onClick={() => onChange({ chartType: t.key })}>
                  <i className={`bi ${t.icon} ddes-opt-ic`}></i>{t.name}
                </button>
              ))}
            </div>
            <div className="ddes-note mb-1">Colour palette</div>
            <div className="ddes-opts">
              {Object.entries(DASH_PALETTES).map(([k, p]) => (
                <button key={k} className={`ddes-opt ${design.palette === k ? 'on' : ''}`}
                  onClick={() => onChange({ palette: k })} title={p.name}>
                  <span style={{ display: 'inline-flex', gap: 2, marginRight: 5, verticalAlign: 'middle' }}>
                    {p.colors.slice(0, 4).map((c, i) => (
                      <i key={i} style={{ width: 7, height: 7, borderRadius: 2, background: c, display: 'inline-block' }} />
                    ))}
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="ddes-row mt-3">
              <span className="ddes-row-ic"><i className="bi bi-123"></i></span>
              <span className="ddes-row-lb">
                <strong>Show values</strong>
                <small>Print the number on each bar / point</small>
              </span>
              <Toggle on={!!design.showValues} onChange={v => onChange({ showValues: v ? 1 : 0 })} />
            </div>
          </Sec>

          <div className="ddes-note">
            Your layout is stored in this browser only (localStorage), per user and per company.
            Nothing here changes how the dashboard gets its data.
          </div>
        </div>

        <div className="ddes-foot">
          <button className="btn btn-outline-secondary btn-sm" onClick={onReset}>
            <i className="bi bi-arrow-counterclockwise me-1"></i>Reset
          </button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </>
  );
}
