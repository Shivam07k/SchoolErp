const KEY = 'xerp_dash_design';

/* Every dashboard section is one toggleable block. Ids match the
   conditional sections rendered by DashboardPage. */
export const DASH_BLOCKS = [
  { id: 'stats',  name: 'Stat Cards',  desc: 'The headline numbers',        icon: 'bi-grid-1x2' },
  { id: 'charts', name: 'Charts',      desc: 'Bar, donut, line, progress',  icon: 'bi-bar-chart-line' },
  { id: 'links',  name: 'Quick Links', desc: 'Shortcut chips from SQL',     icon: 'bi-lightning-charge' },
  { id: 'forms',  name: 'Form Tiles',  desc: 'Tiles that open a list page', icon: 'bi-file-earmark-text' },
];

/* Pre-built designs. "classic" reproduces the dashboard as it looked
   before the designer existed, so the default install is unchanged. */
export const DASH_PRESETS = [
  { key: 'classic',  name: 'Classic',   desc: 'Cards, links and forms',
    blocks: { stats: 1, charts: 0, links: 1, forms: 1 }, mini: [1, 0, 1, 1] },
  { key: 'executive',name: 'Executive', desc: 'Cards with charts',
    blocks: { stats: 1, charts: 1, links: 0, forms: 0 }, mini: [1, 1, 0, 0] },
  { key: 'full',     name: 'Full House',desc: 'Everything switched on',
    blocks: { stats: 1, charts: 1, links: 1, forms: 1 }, mini: [1, 1, 1, 1] },
  { key: 'metrics',  name: 'Metrics',   desc: 'Charts and form tiles',
    blocks: { stats: 1, charts: 1, links: 0, forms: 1 }, mini: [1, 1, 0, 1] },
  { key: 'minimal',  name: 'Minimal',   desc: 'Stat cards only',
    blocks: { stats: 1, charts: 0, links: 0, forms: 0 }, mini: [1, 0, 0, 0] },
  { key: 'compact',  name: 'Compact',   desc: 'Small cards, no charts',
    blocks: { stats: 1, charts: 0, links: 1, forms: 1 }, mini: [1, 0, 1, 1] },
];

export const DASH_CARD_STYLES = [
  { key: 'solid',    name: 'Solid',    desc: 'White card, coloured icon', icon: 'bi-square' },
  { key: 'gradient', name: 'Gradient', desc: 'Full-colour fill',          icon: 'bi-triangle-half' },
  { key: 'soft',     name: 'Soft',     desc: 'Tinted background',         icon: 'bi-droplet' },
  { key: 'outline',  name: 'Outline',  desc: 'Coloured border',           icon: 'bi-bounding-box' },
  { key: 'glass',    name: 'Glass',    desc: 'Frosted panel',             icon: 'bi-moisture' },
  { key: 'shadow',   name: 'Shadow',   desc: 'Coloured drop shadow',      icon: 'bi-layers' },
  { key: 'minimal',  name: 'Minimal',  desc: 'Borderless, airy',          icon: 'bi-dash-lg' },
];

export const DASH_CHART_TYPES = [
  { key: 'bar',      name: 'Bars',      icon: 'bi-bar-chart' },
  { key: 'hbar',     name: 'Horizontal',icon: 'bi-bar-chart-steps' },
  { key: 'donut',    name: 'Donut',     icon: 'bi-pie-chart' },
  { key: 'line',     name: 'Line',      icon: 'bi-graph-up' },
  { key: 'area',     name: 'Area',      icon: 'bi-graph-up-arrow' },
  { key: 'progress', name: 'Progress',  icon: 'bi-speedometer2' },
];

export const DASH_PALETTES = {
  accent:  { name: 'Accent',  colors: ['#2563eb', '#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'] },
  ocean:   { name: 'Ocean',   colors: ['#0ea5e9', '#2563eb', '#1d4ed8', '#0891b2', '#06b6d4', '#38bdf8'] },
  sunset:  { name: 'Sunset',  colors: ['#f97316', '#ef4444', '#ec4899', '#f59e0b', '#e11d48', '#fb923c'] },
  nature:  { name: 'Nature',  colors: ['#059669', '#84cc16', '#14b8a6', '#10b981', '#65a30d', '#22c55e'] },
  mono:    { name: 'Mono',    colors: ['#475569', '#64748b', '#94a3b8', '#cbd5e1', '#334155', '#1e293b'] },
  candy:   { name: 'Candy',   colors: ['#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e', '#a855f7', '#22d3ee'] },
};

export const DASH_COLUMNS = [
  { key: 'auto', name: 'Auto' },
  { key: '4',    name: '4' },
  { key: '3',    name: '3' },
  { key: '2',    name: '2' },
];

const DEFAULTS = {
  preset: 'classic',
  blocks: { stats: 1, charts: 0, links: 1, forms: 1 },
  cardStyle: 'solid',
  chartType: 'bar',
  palette: 'accent',
  columns: 'auto',
  chartSize: 'md',
  showValues: 1,
};

export function getDashDesign() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (!saved || typeof saved !== 'object') return { ...DEFAULTS };
    return {
      ...DEFAULTS,
      ...saved,
      blocks: { ...DEFAULTS.blocks, ...(saved.blocks || {}) },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setDashDesign(patch) {
  const next = { ...getDashDesign(), ...patch };
  if (patch && patch.blocks) next.blocks = { ...getDashDesign().blocks, ...patch.blocks };
  if (patch && patch.preset) {
    const p = DASH_PRESETS.find(x => x.key === patch.preset);
    if (p) next.blocks = { ...p.blocks };
  }
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function resetDashDesign() {
  try { localStorage.removeItem(KEY); } catch {}
  return { ...DEFAULTS };
}

/* The default stat-card colours, so card style and palette feel related. */
export const STAT_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

export const STAT_ICONS = [
  'bi-folder', 'bi-people', 'bi-box-seam', 'bi-graph-up-arrow',
  'bi-receipt', 'bi-credit-card-2-front', 'bi-cash-stack', 'bi-truck',
];

export function paletteFor(key) {
  return (DASH_PALETTES[key] || DASH_PALETTES.accent).colors;
}
