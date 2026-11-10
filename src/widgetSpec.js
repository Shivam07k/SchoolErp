/* Turns the widget builder's plain UI state into the jsonb spec that
   sp_dash_query_run understands, and turns the rows it returns back into
   something a chart can draw.

   Kept free of React so the spec can be unit-tested and reused by the page
   preview, the widget editor and, later, the real dashboard renderer. */

export const LABEL_ALIAS = 'label';
export const SOURCE_ALIAS = 't1';

/* sp_dash_query_run refuses anything outside this list. */
export const AGGS = [
  { fn: 'count', name: 'Count of rows', needsColumn: false, dflt: '*' },
  { fn: 'count_distinct', name: 'Count of distinct', needsColumn: true },
  { fn: 'sum', name: 'Sum of', needsColumn: true },
  { fn: 'avg', name: 'Average of', needsColumn: true },
  { fn: 'min', name: 'Minimum of', needsColumn: true },
  { fn: 'max', name: 'Maximum of', needsColumn: true },
];

export const FILTERS = [
  { op: '=', name: 'is' },
  { op: '<>', name: 'is not' },
  { op: '>', name: 'is more than' },
  { op: '>=', name: 'is at least' },
  { op: '<', name: 'is less than' },
  { op: '<=', name: 'is at most' },
  { op: 'like', name: 'contains' },
  { op: 'in', name: 'is one of', list: true },
  { op: 'between', name: 'is between', two: true },
  { op: 'is null', name: 'is empty', noValue: true },
  { op: 'is not null', name: 'is not empty', noValue: true },
];

/* "render" says how the preview draws it. DashChart covers bar/hbar/donut/
   line/area/progress; kpi and table are handled here, and anything else falls
   back to bars so the preview is never blank. */
export const CHART_KINDS = [
  { key: 'kpi', name: 'Number', icon: 'bi-123', render: 'kpi' },
  { key: 'bar', name: 'Bar', icon: 'bi-bar-chart', render: 'bar' },
  { key: 'hbar', name: 'Bar (horizontal)', icon: 'bi-bar-chart-steps', render: 'hbar' },
  { key: 'line', name: 'Line', icon: 'bi-graph-up', render: 'line' },
  { key: 'area', name: 'Area', icon: 'bi-graph-up-arrow', render: 'area' },
  { key: 'donut', name: 'Donut', icon: 'bi-pie-chart', render: 'donut' },
  { key: 'progress', name: 'Progress', icon: 'bi-list-ol', render: 'progress' },
  { key: 'table', name: 'Table', icon: 'bi-table', render: 'table' },
];

export const SORTS = [
  { key: 'value-desc', name: 'Highest first' },
  { key: 'value-asc', name: 'Lowest first' },
  { key: 'label-asc', name: 'Name A to Z' },
  { key: 'label-desc', name: 'Name Z to A' },
];

export const chartKind = (key) =>
  CHART_KINDS.find((c) => c.key === key) || CHART_KINDS[1];

export const aggDef = (fn) => AGGS.find((a) => a.fn === fn) || AGGS[0];

export function defaultWidget() {
  return {
    table: '',
    labelCol: '',
    valueFn: 'count',
    valueCol: '',
    valueAlias: 'Total',
    limit: 20,
    sort: 'value-desc',
    chartType: 'bar',
    palette: 'accent',
    showValues: true,
    filters: [],
  };
}

const txt = (v) => (v == null ? '' : String(v));

/* Strip a filter that the user has left half-filled, so an untouched row does
   not turn into a filter on the empty string. */
function cleanFilters(filters) {
  return (filters || [])
    .filter((f) => f && f.column)
    .map((f) => {
      const def = FILTERS.find((x) => x.op === f.op);
      if (def && def.noValue) return { column: f.column, op: f.op };
      if (def && def.list) {
        const list = Array.isArray(f.value)
          ? f.value.filter((v) => txt(v).trim() !== '')
          : txt(f.value).split(',').map((s) => s.trim()).filter(Boolean);
        if (!list.length) return null;
        return { column: f.column, op: f.op, value: list };
      }
      if (def && def.two) {
        if (txt(f.value) === '' || txt(f.value2) === '') return null;
        return { column: f.column, op: f.op, value: f.value, value2: f.value2 };
      }
      if (txt(f.value) === '') return null;
      return { column: f.column, op: f.op, value: f.value };
    })
    .filter(Boolean)
    .map((f) => ({ table: SOURCE_ALIAS, ...f }));
}

export function toSpec(w) {
  const s = {
    mode: 'builder',
    from: [{ table: w.table, alias: SOURCE_ALIAS }],
    select: [],
    groupBy: [],
    filters: cleanFilters(w.filters),
    orderBy: [],
    limit: Math.max(1, Number(w.limit) || 20),
  };

  if (w.labelCol) {
    s.select.push({ type: 'col', table: SOURCE_ALIAS, column: w.labelCol, alias: LABEL_ALIAS });
    s.groupBy.push({ table: SOURCE_ALIAS, column: w.labelCol });
  }

  const a = aggDef(w.valueFn);
  s.select.push({
    type: 'agg',
    fn: a.fn,
    table: SOURCE_ALIAS,
    column: a.needsColumn ? (w.valueCol || '') : (w.valueCol || '*'),
    alias: txt(w.valueAlias).trim() || 'Total',
  });

  const valueAlias = s.select[s.select.length - 1].alias;
  if (w.sort === 'label-asc' || w.sort === 'label-desc') {
    if (w.labelCol) s.orderBy.push({ alias: LABEL_ALIAS, dir: w.sort.endsWith('desc') ? 'desc' : 'asc' });
    else s.orderBy.push({ alias: valueAlias, dir: 'desc' });
  } else {
    s.orderBy.push({ alias: valueAlias, dir: w.sort === 'value-asc' ? 'asc' : 'desc' });
  }

  return s;
}

/* Best effort at reading a builder spec back into the form, so editing a saved
   widget shows its real settings instead of a blank form. */
export function fromSpec(spec) {
  const w = defaultWidget();
  if (!spec || typeof spec !== 'object') return w;
  if (spec.mode && spec.mode !== 'builder') return { ...w, raw: spec };

  const from = Array.isArray(spec.from) ? spec.from[0] : null;
  if (from) w.table = txt(from.table);

  const sel = Array.isArray(spec.select) ? spec.select : [];
  const label = sel.find((s) => txt(s.type).toLowerCase() !== 'agg');
  const agg = sel.find((s) => txt(s.type).toLowerCase() === 'agg');

  if (label) w.labelCol = txt(label.column);
  if (agg) {
    w.valueFn = aggDef(txt(agg.fn).toLowerCase()).fn;
    if (txt(agg.column) !== '*') w.valueCol = txt(agg.column);
    else if (w.valueFn === 'count') w.valueCol = '';
    w.valueAlias = txt(agg.alias) || 'Total';
  }

  const order = Array.isArray(spec.orderBy) ? spec.orderBy[0] : null;
  if (order) {
    const onValue = txt(order.alias) === w.valueAlias;
    const dir = txt(order.dir).toLowerCase() === 'asc' ? 'asc' : 'desc';
    if (onValue) w.sort = `value-${dir}`;
    else w.sort = `label-${dir}`;
  }

  if (spec.limit != null) w.limit = Number(spec.limit) || 20;
  w.filters = (Array.isArray(spec.filters) ? spec.filters : []).map((f) => ({ ...f }));
  return w;
}

/* Query result -> [{ label, value }] for DashChart. Rows with a non-numeric or
   missing value are dropped rather than drawn as zero. Accepts either the
   builder state or just the value column's alias. */
export function rowsToSeries(res, w) {
  const rows = (res && res.rows) || [];
  if (!rows.length) return [];
  const alias = typeof w === 'string' ? w : txt(w && w.valueAlias).trim() || 'Total';
  const valueAlias = alias || 'Total';
  return rows
    .map((r) => {
      const raw = r[valueAlias] != null ? r[valueAlias] : r[LABEL_ALIAS];
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return { label: txt(r[LABEL_ALIAS]), value: n };
    })
    .filter(Boolean);
}

/* The saved column label, so a widget row can be previewed without the form. */
export function specValueAlias(spec) {
  const sel = (spec && Array.isArray(spec.select) ? spec.select : [])
    .filter((s) => txt(s && s.type).toLowerCase() === 'agg');
  const last = sel[sel.length - 1];
  return (last && txt(last.alias).trim()) || 'Total';
}

/* Stored jsonb may arrive as an object or, for older rows, as text. */
export function parseSpec(query) {
  if (!query) return null;
  if (typeof query === 'object') return query;
  try {
    const p = JSON.parse(String(query));
    return p && typeof p === 'object' ? p : null;
  } catch {
    return null;
  }
}

/* Same rows, for the table preview. The column list arrives as jsonb, so it may
   be plain names or objects; and a distinct query can come back with an empty
   list, in which case the row keys are the honest answer. */
export function rowsToTable(res) {
  const rows = (res && res.rows) || [];
  const raw = (res && res.columns) || [];
  let columns = raw
    .map((c) => (c == null ? '' : typeof c === 'object' ? (c.name || c.column_name || c.alias || '') : String(c)))
    .filter(Boolean);
  if (!columns.length && rows.length) {
    const seen = [];
    for (const r of rows) for (const k of Object.keys(r)) if (!seen.includes(k)) seen.push(k);
    columns = seen;
  }
  return { columns, rows };
}
