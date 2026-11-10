export function navigate(hash) { window.location.hash = hash; }
export function decimal(v) { return parseFloat(v || 0).toFixed(2); }
export function today() { return new Date().toISOString().split('T')[0]; }
export function sessionStartdate() { return '2026-04-01'; }
export function parseWidth(w) {
  const p = (w || '12,12,12,12').split(',');
  return `col-${p[0]||'12'} col-sm-${p[1]||'12'} col-md-${p[2]||'12'} col-lg-${p[3]||'12'}`;
}
