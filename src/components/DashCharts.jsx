import React from 'react';
import { paletteFor } from '../dashboardDesign';

const SIZES = { sm: 150, md: 210, lg: 280 };

export function fmtNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e4) {
    const k = v / 1e3;
    /* 999_975 would otherwise round to a silly "1000k". */
    if (Math.abs(k) >= 999.5) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    return k.toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k';
  }
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

/* Turn the {key: val} stats object into a chartable series.
   Non-numeric values are skipped, because a chart of words is noise. */
export function toSeries(stats) {
  const out = [];
  for (const [label, value] of Object.entries(stats || {})) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) out.push({ label: String(label), value: n });
  }
  return out;
}

function Empty() {
  return <div className="chart-empty"><i className="bi bi-bar-chart me-1"></i>No numeric data to chart</div>;
}

function Legend({ items }) {
  return (
    <div className="chart-legend">
      {items.map(it => (
        <span key={it.label} className="chart-legend-item" style={{ '--c': it.color }}>
          <i></i>{it.label} <b style={{ color: 'var(--text-primary)' }}>{fmtNum(it.value)}</b>
        </span>
      ))}
    </div>
  );
}

function shorten(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/* ── Vertical bars ─────────────────────────────────────────── */
function BarChart({ data, colors, showValues }) {
  const W = 520, H = SIZES.md, padL = 46, padR = 10, padT = 20, padB = 34;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(...data.map(d => d.value), 0) || 1;
  const n = data.length;
  const slot = innerW / n;
  const bw = Math.max(6, Math.min(slot * 0.62, 54));
  const ticks = 4;

  return (
    <div className="chart-box">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart">
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const y = padT + innerH - (innerH * i) / ticks;
          const v = (max * i) / ticks;
          return (
            <g key={i}>
              <line className="chart-grid-line" x1={padL} y1={y} x2={W - padR} y2={y} />
              <text className="chart-axis-text" x={padL - 6} y={y + 3} textAnchor="end">{fmtNum(v)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = max > 0 ? (d.value / max) * innerH : 0;
          const x = padL + slot * i + (slot - bw) / 2;
          const y = padT + innerH - h;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={bw} height={Math.max(h, d.value > 0 ? 2 : 0)} rx={Math.min(5, bw / 3)}
                fill={colors[i % colors.length]}>
                <title>{d.label}: {fmtNum(d.value)}</title>
              </rect>
              {showValues ? (
                <text className="chart-value-text" x={x + bw / 2} y={y - 5} textAnchor="middle">{fmtNum(d.value)}</text>
              ) : null}
              <text className="chart-axis-text" x={x + bw / 2} y={H - padB + 15} textAnchor="middle">
                {shorten(d.label, Math.max(6, Math.floor(slot / 7)))}
              </text>
            </g>
          );
        })}
        <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="var(--card-border)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/* ── Horizontal bars ───────────────────────────────────────── */
function HBarChart({ data, colors, showValues }) {
  if (!data.length) return null;
  const rowH = 30;
  const W = 520, H = data.length * rowH + 16;
  const labelW = 128, valW = showValues ? 54 : 10;
  const max = Math.max(...data.map(d => d.value), 0) || 1;

  return (
    <div className="chart-box">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Horizontal bar chart">
        {data.map((d, i) => {
          const w = max > 0 ? (d.value / max) * (W - labelW - valW) : 0;
          const y = i * rowH + 8;
          return (
            <g key={d.label}>
              <text className="chart-axis-text" x={labelW - 8} y={y + 13} textAnchor="end"
                style={{ fill: 'var(--text-secondary)' }}>{shorten(d.label, 18)}</text>
              <rect x={labelW} y={y + 3} width={W - labelW - valW} height={16} rx={8} fill="var(--card-border)" opacity="0.5" />
              <rect x={labelW} y={y + 3} width={Math.max(w, d.value > 0 ? 3 : 0)} height={16} rx={8}
                fill={colors[i % colors.length]}>
                <title>{d.label}: {fmtNum(d.value)}</title>
              </rect>
              {showValues ? (
                <text className="chart-value-text" x={W - 4} y={y + 15} textAnchor="end">{fmtNum(d.value)}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Donut ─────────────────────────────────────────────────── */
function DonutChart({ data, colors }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 200, cx = size / 2, cy = size / 2, r = 78, sw = 26;
  const C = 2 * Math.PI * r;

  if (total <= 0) return <Empty />;

  let acc = 0;
  const segs = data.map((d, i) => {
    const frac = d.value / total;
    const seg = { ...d, frac, color: colors[i % colors.length], offset: acc };
    acc += frac;
    return seg;
  });

  return (
    <>
      <div className="chart-box" style={{ display: 'flex', justifyContent: 'center' }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size }} role="img" aria-label="Donut chart">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--card-border)" strokeWidth={sw} opacity="0.45" />
          {segs.map(s => (
            <circle key={s.label} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${Math.max(s.frac * C - 2, 0)} ${C}`}
              strokeDashoffset={-s.offset * C}
              transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt">
              <title>{s.label}: {fmtNum(s.value)} ({Math.round(s.frac * 100)}%)</title>
            </circle>
          ))}
          <text x={cx} y={cy - 2} textAnchor="middle" style={{ fontSize: 'calc(22px * var(--fs, 1))', fontWeight: 800, fill: 'var(--text-primary)' }}>
            {fmtNum(total)}
          </text>
          <text x={cx} y={cy + 16} textAnchor="middle" className="chart-axis-text">Total</text>
        </svg>
      </div>
      <Legend items={segs} />
    </>
  );
}

/* ── Line / area ───────────────────────────────────────────── */
function LineChart({ data, colors, showValues, area }) {
  const W = 520, H = SIZES.md, padL = 46, padR = 14, padT = 20, padB = 34;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(...data.map(d => d.value), 0) || 1;
  const n = data.length;
  const stepX = n > 1 ? innerW / (n - 1) : 0;
  const pts = data.map((d, i) => ({
    x: padL + stepX * i,
    y: padT + innerH - (max > 0 ? (d.value / max) * innerH : 0),
    d,
  }));
  const line = pts.map(p => `${p.x},${p.y}`).join(' ');
  const areaD = pts.length ? `M ${pts[0].x},${padT + innerH} L ${line.replace(/ /g, ' L ')} L ${pts[pts.length - 1].x},${padT + innerH} Z` : '';
  const gid = `g${area ? 'a' : 'l'}`;
  const ticks = 4;

  return (
    <div className="chart-box">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[0]} stopOpacity="0.38" />
            <stop offset="100%" stopColor={colors[0]} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const y = padT + innerH - (innerH * i) / ticks;
          return (
            <g key={i}>
              <line className="chart-grid-line" x1={padL} y1={y} x2={W - padR} y2={y} />
              <text className="chart-axis-text" x={padL - 6} y={y + 3} textAnchor="end">{fmtNum((max * i) / ticks)}</text>
            </g>
          );
        })}
        {area && <path d={areaD} fill={`url(#${gid})`} />}
        <polyline points={line} fill="none" stroke={colors[0]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(p => (
          <g key={p.d.label}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="var(--card-bg)" stroke={colors[0]} strokeWidth="2">
              <title>{p.d.label}: {fmtNum(p.d.value)}</title>
            </circle>
            {showValues && n <= 8 ? (
              <text className="chart-value-text" x={p.x} y={p.y - 9} textAnchor="middle">{fmtNum(p.d.value)}</text>
            ) : null}
            <text className="chart-axis-text" x={p.x} y={H - padB + 15} textAnchor="middle">
              {shorten(p.d.label, 10)}
            </text>
          </g>
        ))}
        <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="var(--card-border)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/* ── Progress rows (share of the largest value) ────────────── */
function ProgressChart({ data, colors }) {
  const max = Math.max(...data.map(d => d.value), 0) || 1;
  return (
    <div className="chart-box" style={{ padding: '2px 0' }}>
      {data.map((d, i) => (
        <div key={d.label} style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'calc(11px * var(--fs, 1))', marginBottom: 4 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{shorten(d.label, 26)}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{fmtNum(d.value)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--card-border)', opacity: 0.55, overflow: 'hidden' }}>
            <div style={{
              width: `${max > 0 ? Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0) : 0}%`,
              height: '100%', borderRadius: 999, background: colors[i % colors.length],
              transition: 'width .4s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashChart({ type, data, palette, showValues, size }) {
  const colors = paletteFor(palette);
  if (!data || !data.length) return <Empty />;
  if (data.length === 1 && type !== 'progress' && type !== 'hbar') {
    return (
      <>
        <div className="chart-empty" style={{ padding: '18px 0' }}>
          <div style={{ fontSize: 'calc(30px * var(--fs, 1))', fontWeight: 800, color: colors[0] }}>{fmtNum(data[0].value)}</div>
          <div style={{ marginTop: 4 }}>{data[0].label}</div>
        </div>
      </>
    );
  }

  switch (type) {
    case 'hbar':     return <HBarChart data={data} colors={colors} showValues={showValues} />;
    case 'donut':    return <DonutChart data={data} colors={colors} />;
    case 'line':     return <LineChart data={data} colors={colors} showValues={showValues} area={false} />;
    case 'area':     return <LineChart data={data} colors={colors} showValues={showValues} area />;
    case 'progress': return <ProgressChart data={data} colors={colors} />;
    case 'bar':
    default:         return <BarChart data={data} colors={colors} showValues={showValues} />;
  }
}
