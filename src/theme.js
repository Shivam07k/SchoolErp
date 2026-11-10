const KEY = 'xerp_theme';

export const ACCENTS = {
  blue:    { name: 'Ocean',   c: '#2563eb', h: '#1d4ed8', l: '#eff6ff', g1: '#2563eb', g2: '#7c3aed' },
  indigo:  { name: 'Indigo',  c: '#4f46e5', h: '#4338ca', l: '#eef2ff', g1: '#4f46e5', g2: '#ec4899' },
  emerald: { name: 'Emerald', c: '#059669', h: '#047857', l: '#ecfdf5', g1: '#059669', g2: '#0891b2' },
  teal:    { name: 'Teal',    c: '#0d9488', h: '#0f766e', l: '#f0fdfa', g1: '#0d9488', g2: '#2563eb' },
  rose:    { name: 'Rose',    c: '#e11d48', h: '#be123c', l: '#fff1f2', g1: '#e11d48', g2: '#f97316' },
  amber:   { name: 'Amber',   c: '#d97706', h: '#b45309', l: '#fffbeb', g1: '#d97706', g2: '#dc2626' },
  purple:  { name: 'Purple',  c: '#9333ea', h: '#7e22ce', l: '#faf5ff', g1: '#9333ea', g2: '#ec4899' },
  cyan:    { name: 'Cyan',    c: '#06b6d4', h: '#0891b2', l: '#ecfeff', g1: '#06b6d4', g2: '#8b5cf6' },
  slate:   { name: 'Slate',   c: '#475569', h: '#334155', l: '#f8fafc', g1: '#475569', g2: '#6366f1' },
  sunset:  { name: 'Sunset',  c: '#f97316', h: '#ea580c', l: '#fff7ed', g1: '#f97316', g2: '#e11d48' },
};

export const UI_STYLES = [
  { key: 'classic',   name: 'Classic',      desc: 'Clean & professional',     icon: 'bi-layout' },
  { key: 'flat',      name: 'Flat',         desc: 'Material, no shadows',     icon: 'bi-square' },
  { key: 'soft',      name: 'Soft UI',      desc: 'Rounded, pastel, float',   icon: 'bi-cloud' },
  { key: 'neu',       name: 'Neumorph',     desc: 'Extruded soft surfaces',   icon: 'bi-circle' },
  { key: 'neu-dark',  name: 'Neu Dark',     desc: 'Dark extruded surfaces',   icon: 'bi-moon' },
  { key: 'glass',     name: 'Glass',        desc: 'Frosted translucent',      icon: 'bi-droplet' },
  { key: 'glass-dark',name: 'Glass Dark',   desc: 'Dark frosted panels',      icon: 'bi-moisture' },
  { key: 'clay',      name: 'Claymorphism', desc: 'Clay-like 3D effects',     icon: 'bi-bounding-box' },
  { key: 'aurora',    name: 'Aurora',       desc: 'Gradient glow panels',     icon: 'bi-stars' },
  { key: 'minimal',   name: 'Minimal',      desc: 'Ultra-clean, whitespace',  icon: 'bi-dash' },
  { key: 'cyber',     name: 'Cyberpunk',    desc: 'Neon on dark',             icon: 'bi-lightning' },
];

export const SIDEBAR_COLORS = {
  dark:     { name: 'Dark',      bg: 'linear-gradient(175deg, #16203a 0%, #101828 45%, #131f42 100%)', text: '#b9c4da' },
  midnight: { name: 'Midnight',  bg: 'linear-gradient(175deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', text: '#c7d2fe' },
  slate:    { name: 'Slate',     bg: 'linear-gradient(175deg, #334155 0%, #1e293b 50%, #334155 100%)', text: '#e2e8f0' },
  navy:     { name: 'Navy',      bg: 'linear-gradient(175deg, #172554 0%, #1e3a5f 50%, #172554 100%)', text: '#93c5fd' },
  accent:   { name: 'Accent',    bg: null, text: '#ffffff' },
  white:    { name: 'White',     bg: 'linear-gradient(175deg, #ffffff 0%, #f8fafc 50%, #ffffff 100%)', text: '#334155' },
  light:    { name: 'Light',     bg: 'linear-gradient(175deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)', text: '#475569' },
  emerald:  { name: 'Emerald',   bg: 'linear-gradient(175deg, #064e3b 0%, #065f46 50%, #064e3b 100%)', text: '#a7f3d0' },
  rose:     { name: 'Rose',      bg: 'linear-gradient(175deg, #4c0519 0%, #881337 50%, #4c0519 100%)', text: '#fecdd3' },
  purple:   { name: 'Purple',    bg: 'linear-gradient(175deg, #3b0764 0%, #581c87 50%, #3b0764 100%)', text: '#e9d5ff' },
};

export const TEXT_SIZES = [
  { key: 'xs',  name: 'Extra Small', val: '12px', btnVal: '11px', fs: 0.92 },
  { key: 'sm',  name: 'Small',       val: '13px', btnVal: '12px', fs: 1.00 },
  { key: 'md',  name: 'Medium',      val: '14px', btnVal: '13px', fs: 1.08 },
  { key: 'lg',  name: 'Large',       val: '15px', btnVal: '14px', fs: 1.15 },
  { key: 'xl',  name: 'Extra Large', val: '16px', btnVal: '15px', fs: 1.23 },
];

export const FONT_SCALE_MIN = 0.75;
export const FONT_SCALE_MAX = 1.60;

/* Colours used to give each sidebar section its own identity. */
export const SECTION_COLORS = [
  { key: 'blue',   name: 'Blue',   c: '#3b82f6' },
  { key: 'violet', name: 'Violet', c: '#8b5cf6' },
  { key: 'teal',   name: 'Teal',   c: '#14b8a6' },
  { key: 'amber',  name: 'Amber',  c: '#f59e0b' },
  { key: 'rose',   name: 'Rose',   c: '#f43f5e' },
  { key: 'emerald',name: 'Emerald',c: '#10b981' },
  { key: 'cyan',   name: 'Cyan',   c: '#06b6d4' },
  { key: 'orange', name: 'Orange', c: '#fb923c' },
  { key: 'indigo', name: 'Indigo', c: '#6366f1' },
  { key: 'lime',   name: 'Lime',   c: '#84cc16' },
  { key: 'pink',   name: 'Pink',   c: '#ec4899' },
  { key: 'sky',    name: 'Sky',    c: '#0ea5e9' },
];

export const BUTTON_SIZES = [
  { key: 'compact', name: 'Compact', h: '30px', font: '11.5px', radius: '6px',  icon: '12px' },
  { key: 'default', name: 'Default', h: '36px', font: '12.5px', radius: '9px',  icon: '14px' },
  { key: 'large',   name: 'Large',   h: '42px', font: '13.5px', radius: '10px', icon: '15px' },
  { key: 'xlarge',  name: 'X-Large', h: '48px', font: '14px',   radius: '12px', icon: '16px' },
];

export const BUTTON_STYLES = [
  { key: 'gradient', name: 'Gradient',     desc: 'Vivid gradient buttons' },
  { key: 'flat',     name: 'Flat',         desc: 'Solid color, no shadow' },
  { key: 'outline',  name: 'Outline',      desc: 'Border only, fill on hover' },
  { key: 'pill',     name: 'Pill',         desc: 'Fully rounded capsules' },
  { key: 'soft',     name: 'Soft',         desc: 'Colored background, light' },
  { key: 'neu',      name: 'Neumorphic',   desc: 'Extruded soft buttons' },
  { key: 'glass',    name: 'Glass',        desc: 'Frosted translucent' },
  { key: 'shadow',   name: 'Shadow',       desc: 'Bold drop shadow' },
  { key: 'glossy',   name: 'Glossy',       desc: '3D shine highlight' },
  { key: 'glow',     name: 'Glow',         desc: 'Neon glow on hover' },
  { key: 'raised',   name: 'Raised',       desc: '3D raised with depth' },
  { key: 'minimal',  name: 'Minimal',      desc: 'Understated, light' },
  { key: 'twotone',  name: 'Two-Tone',     desc: 'Dark bg, colored text' },
  { key: 'frosted',  name: 'Frosted',      desc: 'Glassmorphism blur' },
  { key: 'bordered', name: 'Bordered',     desc: 'Double frame border' },
  { key: 'link',     name: 'Link',         desc: 'Text-only, no bg' },
];

export const ACTION_BTN_STYLES = [
  { key: 'classic',  name: 'Classic',      desc: 'Rounded square',           radius: '8px' },
  { key: 'pill',     name: 'Pill',         desc: 'Fully rounded capsule',    radius: '999px' },
  { key: 'circle',   name: 'Circle',       desc: 'Perfect circle',           radius: '50%' },
  { key: 'square',   name: 'Square',       desc: 'Sharp corners',            radius: '3px' },
  { key: 'soft',     name: 'Soft',         desc: 'Gentle rounded',           radius: '12px' },
  { key: 'ghost',    name: 'Ghost',        desc: 'Borderless, fill on hover',radius: '8px' },
  { key: 'glossy',   name: 'Glossy',       desc: '3D shine highlight',       radius: '8px' },
  { key: 'glow',     name: 'Glow',         desc: 'Neon glow on hover',       radius: '8px' },
  { key: 'raised',   name: 'Raised',       desc: '3D raised with depth',     radius: '8px' },
  { key: 'frosted',  name: 'Frosted',      desc: 'Glassmorphism blur',       radius: '8px' },
  { key: 'minimal',  name: 'Minimal',      desc: 'Understated, no bg',       radius: '8px' },
  { key: 'twotone',  name: 'Two-Tone',     desc: 'Dark bg, colored accent',  radius: '8px' },
];

export const ACTION_BTN_SIZES = [
  { key: 'xs',  name: 'XS',  h: '24px', icon: '11px', font: '10px' },
  { key: 'sm',  name: 'SM',  h: '28px', icon: '13px', font: '11px' },
  { key: 'md',  name: 'MD',  h: '32px', icon: '14px', font: '12px' },
  { key: 'lg',  name: 'LG',  h: '36px', icon: '16px', font: '13px' },
];

export const GRID_STYLES = [
  { key: 'cards',    name: 'Row Cards',   desc: 'Separated with gaps' },
  { key: 'bordered', name: 'Bordered',    desc: 'Classic table lines' },
  { key: 'striped',  name: 'Striped',     desc: 'Alternating row colors' },
  { key: 'minimal',  name: 'Minimal',     desc: 'Clean dividers only' },
  { key: 'hover',    name: 'Hover Glow',  desc: 'Accent glow on hover' },
  { key: 'rounded',  name: 'Rounded',     desc: 'Pill-shaped row cards' },
];

export const DENSITIES = [
  { key: 'compact', name: 'Compact', desc: 'More rows visible' },
  { key: 'cozy',    name: 'Cozy',    desc: 'Balanced (recommended)' },
  { key: 'comfy',   name: 'Comfort', desc: 'Extra breathing room' },
];

export function getTheme() {
  migrateTheme();
  const defaults = {
    mode: 'light', accent: 'blue', ui: 'classic', density: 'cozy',
    sidebarColor: 'light', sidebarCustomBg: '', sidebarCustomText: '',
    sidebarSecColors: false, secPalette: 'auto',
    textSize: 'sm', fs: 1,
    btnSize: 'default', btnStyle: 'gradient', gridStyle: 'cards',
    actionBtnStyle: 'classic', actionBtnSize: 'md',
    accentGradAngle: 135, accentGradStop: 50,
  };
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return defaults; }
}

const MIGRATE_KEY = 'xerp_theme_migrated_v1';

/* Kept so old installs stop re-running the v1 pass. Deliberately
   NON-destructive: v1 used to delete sidebarColor / sidebarCustomBg /
   sidebarCustomText from the saved theme, which silently threw away the
   user's sidebar colour choice on every fresh browser profile. */
function migrateTheme() {
  try { localStorage.setItem(MIGRATE_KEY, '1'); } catch {}
}

export function applyTheme(t) {
  migrateTheme();
  if (!t) t = getTheme();
  const a = ACCENTS[t.accent] || ACCENTS.blue;
  const root = document.documentElement;

  root.dataset.mode = t.mode === 'dark' ? 'dark' : 'light';
  root.dataset.ui = UI_STYLES.some(u => u.key === t.ui) ? t.ui : 'classic';
  root.dataset.density = DENSITIES.some(d => d.key === t.density) ? t.density : 'cozy';
  root.dataset.sidebarColor = SIDEBAR_COLORS[t.sidebarColor] ? t.sidebarColor : 'light';
  root.dataset.secColors = t.sidebarSecColors === false ? 'off' : 'on';
  root.dataset.textSize = TEXT_SIZES.some(s => s.key === t.textSize) ? t.textSize : 'sm';
  root.dataset.btnSize = BUTTON_SIZES.some(s => s.key === t.btnSize) ? t.btnSize : 'default';
  root.dataset.btnStyle = BUTTON_STYLES.some(s => s.key === t.btnStyle) ? t.btnStyle : 'gradient';
  root.dataset.gridStyle = GRID_STYLES.some(s => s.key === t.gridStyle) ? t.gridStyle : 'cards';
  root.dataset.actionBtnStyle = ACTION_BTN_STYLES.some(s => s.key === t.actionBtnStyle) ? t.actionBtnStyle : 'classic';
  root.dataset.actionBtnSize = ACTION_BTN_SIZES.some(s => s.key === t.actionBtnSize) ? t.actionBtnSize : 'md';

  const abs = ACTION_BTN_SIZES.find(s => s.key === t.actionBtnSize) || ACTION_BTN_SIZES[2];
  const abs2 = ACTION_BTN_STYLES.find(s => s.key === t.actionBtnStyle) || ACTION_BTN_STYLES[0];
  root.style.setProperty('--action-btn-h', abs.h);
  root.style.setProperty('--action-btn-icon', abs.icon);
  root.style.setProperty('--action-btn-font', abs.font);
  root.style.setProperty('--action-btn-radius', abs2.radius);

  if (t.actionEditColor) root.style.setProperty('--action-btn-edit-color', t.actionEditColor);
  else root.style.removeProperty('--action-btn-edit-color');
  if (t.actionDeleteColor) root.style.setProperty('--action-btn-delete-color', t.actionDeleteColor);
  else root.style.removeProperty('--action-btn-delete-color');
  if (t.actionPrintColor) root.style.setProperty('--action-btn-print-color', t.actionPrintColor);
  else root.style.removeProperty('--action-btn-print-color');

  const angle = t.accentGradAngle || 135;
  const stop = t.accentGradStop || 50;
  const g2 = a.g2 || a.c;
  root.style.setProperty('--accent', a.c);
  root.style.setProperty('--accent-hover', a.h);
  root.style.setProperty('--accent-light', t.mode === 'dark' ? 'rgba(255,255,255,0.10)' : a.l);
  root.style.setProperty('--accent-ring', hexToRgba(a.c, 0.22));
  root.style.setProperty('--accent-soft', hexToRgba(a.c, t.mode === 'dark' ? 0.16 : 0.09));
  root.style.setProperty('--accent-gradient', `linear-gradient(${angle}deg, ${a.c} ${stop}%, ${g2})`);

  const ts = TEXT_SIZES.find(s => s.key === t.textSize) || TEXT_SIZES[1];
  root.style.setProperty('--base-font', '13px');
  root.style.setProperty('--btn-font', ts.btnVal);

  /* Whole-system font scale. Every px font-size in app.css is written as
     calc(Npx * var(--fs)), so this single variable rescales menus, forms,
     grids, buttons and every inline-styled element at the same time. */
  let fs = Number(t.fs);
  if (!Number.isFinite(fs)) fs = 1;
  fs = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(fs * 100) / 100));
  root.style.setProperty('--fs', String(fs));

  const bs = BUTTON_SIZES.find(s => s.key === t.btnSize) || BUTTON_SIZES[1];
  root.style.setProperty('--btn-h', bs.h);
  root.style.setProperty('--btn-font-size', bs.font);
  root.style.setProperty('--btn-radius', bs.radius);
  root.style.setProperty('--btn-icon-size', bs.icon);

  const sc = SIDEBAR_COLORS[t.sidebarColor] || SIDEBAR_COLORS.dark;
  if (t.sidebarColor === 'accent') {
    root.style.setProperty('--sidebar-bg', `linear-gradient(175deg, ${a.c}, ${a.h})`);
    root.style.setProperty('--sidebar-text', '#ffffff');
  } else if (t.sidebarColor === 'white' || t.sidebarColor === 'light') {
    root.style.setProperty('--sidebar-bg', sc.bg);
    root.style.setProperty('--sidebar-text', sc.text);
    root.style.setProperty('--sidebar-text-active', '#0f172a');
  } else {
    root.style.setProperty('--sidebar-bg', sc.bg);
    root.style.setProperty('--sidebar-text', sc.text);
  }

  if (t.sidebarCustomBg) root.style.setProperty('--sidebar-bg', t.sidebarCustomBg);
  if (t.sidebarCustomText) root.style.setProperty('--sidebar-text', t.sidebarCustomText);
}

export function setTheme(patch) {
  const t = { ...getTheme(), ...patch };
  const save = {};
  for (const k of Object.keys(t)) { if (t[k] !== undefined && t[k] !== '') save[k] = t[k]; }
  localStorage.setItem(KEY, JSON.stringify(save));
  applyTheme(t);
  return t;
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
