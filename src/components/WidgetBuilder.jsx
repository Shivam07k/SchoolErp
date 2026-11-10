import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api';
import {
  toSpec, defaultWidget, AGGS, FILTERS, CHART_KINDS, SORTS, aggDef, chartKind,
} from '../widgetSpec';
import { DASH_PALETTES } from '../dashboardDesign';
import { useWidgetQuery, WidgetPreview } from './DashWidget';

function Row({ children, className = '' }) {
  return <div className={`cz-row ${className}`}>{children}</div>;
}

function Field({ label, children, hint }) {
  return (
    <div className="cz-field">
      <label>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

/* Tables change rarely, so cache them for the life of the page instead of
   asking again every time the builder is opened. */
let tableCache = null;
const useTables = () => {
  const [tables, setTables] = useState(tableCache || []);
  useEffect(() => {
    if (tableCache) return;
    let alive = true;
    apiGet('/dash/tables')
      .then((r) => { if (alive && Array.isArray(r.tables)) { tableCache = r.tables; setTables(r.tables); } })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return tables;
};

const useColumns = (table) => {
  const [columns, setColumns] = useState([]);
  useEffect(() => {
    if (!table) { setColumns([]); return undefined; }
    let alive = true;
    apiGet(`/dash/columns/${table}`)
      .then((r) => { if (alive) setColumns(Array.isArray(r.columns) ? r.columns : []); })
      .catch(() => { if (alive) setColumns([]); });
    return () => { alive = false; };
  }, [table]);
  return columns;
};

const isNumeric = (c) => /int|numeric|decimal|real|double|float|money/i.test(c.data_type);
const isTextual = (c) => /char|text|name|code|desc/i.test(c.data_type);

function FilterRows({ filters, columns, onChange }) {
  if (!columns.length) return null;
  const patch = (i, k, v) => {
    const next = filters.map((f, j) => (j === i ? { ...f, [k]: v } : f));
    onChange(next);
  };
  const add = () => onChange([...filters, { column: columns[0].column_name, op: '=', value: '' }]);
  const remove = (i) => onChange(filters.filter((_, j) => j !== i));

  if (!filters.length) {
    return (
      <button type="button" className="cz-mini" onClick={add} disabled={!columns.length}>
        <i className="bi bi-plus-lg me-1"></i>Add a condition
      </button>
    );
  }

  return (
    <div className="cz-filters">
      {filters.map((f, i) => {
        const def = FILTERS.find((x) => x.op === f.op) || FILTERS[0];
        return (
          <div className="cz-filter" key={i}>
            <select className="form-select form-select-sm"
              value={f.column || ''} onChange={e => patch(i, 'column', e.target.value)}>
              {columns.map((c) => <option key={c.column_name} value={c.column_name}>{c.column_name}</option>)}
            </select>
            <select className="form-select form-select-sm"
              value={f.op} onChange={e => patch(i, 'op', e.target.value)}>
              {FILTERS.map((o) => <option key={o.op} value={o.op}>{o.name}</option>)}
            </select>
            {def.noValue ? <span className="cz-filter-none">no value needed</span> : (
              <input className="form-control form-control-sm" placeholder={def.two ? 'from' : def.list ? 'a, b, c' : 'value'}
                value={f.value ?? ''} onChange={e => patch(i, 'value', e.target.value)} />
            )}
            {def.two && (
              <input className="form-control form-control-sm" placeholder="to"
                value={f.value2 ?? ''} onChange={e => patch(i, 'value2', e.target.value)} />
            )}
            <button type="button" className="cz-mini danger" title="Remove"
              onClick={() => remove(i)}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        );
      })}
      <button type="button" className="cz-mini" onClick={add}>
        <i className="bi bi-plus-lg me-1"></i>Another condition
      </button>
    </div>
  );
}

/* The click-to-build half of the dashboard maker: pick a table and a
   calculation, and the chart on the right follows along. */
export default function WidgetBuilder({ value, onChange }) {
  const w = value || defaultWidget();
  const tables = useTables();
  const columns = useColumns(w.table);
  const set = useCallback((patch) => onChange({ ...w, ...patch }), [w, onChange]);

  const agg = aggDef(w.valueFn);
  const kind = chartKind(w.chartType);

  /* Which columns make sense for each slot, so the picker does not offer
     numbers where a name belongs. */
  const labelCols = useMemo(
    () => columns.filter((c) => isTextual(c) || isNumeric(c)).map((c) => c.column_name), [columns]);
  const valueCols = useMemo(
    () => columns.filter((c) => agg.needsColumn ? isNumeric(c) : true).map((c) => c.column_name), [columns, agg]);

  const spec = useMemo(() => (w.table ? toSpec(w) : null), [w]);
  const q = useWidgetQuery(spec);

  const valueAlias = useMemo(() => {
    const sel = (spec && spec.select) || [];
    return (sel[sel.length - 1] && sel[sel.length - 1].alias) || 'Total';
  }, [spec]);

  /* kpi with a grouping still needs to read as one number. */
  const effectiveType = w.chartType === 'kpi' && w.labelCol ? 'kpi' : w.chartType;

  return (
    <div className="cz-builder">
      <div className="cz-builder-form">
        <Row>
          <Field label="Data from" hint="Any table in this company">
            <select className="form-select form-select-sm" value={w.table}
              onChange={e => {
                const t = e.target.value;
                /* the old column names belong to the old table */
                onChange({ ...defaultWidget(), ...w, table: t, labelCol: '', valueCol: '', filters: [], chartType: w.chartType, palette: w.palette });
              }}>
              <option value="">Choose a table…</option>
              {tables.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Split by" hint="Leave empty for a single number">
            <select className="form-select form-select-sm" value={w.labelCol}
              disabled={!columns.length}
              onChange={e => set({ labelCol: e.target.value })}>
              <option value="">Nothing (one total)</option>
              {labelCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </Row>

        <Row>
          <Field label="Show">
            <select className="form-select form-select-sm" value={w.valueFn}
              onChange={e => {
                const a = aggDef(e.target.value);
                set({ valueFn: a.fn, valueCol: a.needsColumn ? (w.valueCol || '') : '' });
              }}>
              {AGGS.map((a) => <option key={a.fn} value={a.fn}>{a.name}</option>)}
            </select>
          </Field>
          {agg.needsColumn && (
            <Field label="of column">
              <select className="form-select form-select-sm" value={w.valueCol}
                disabled={!columns.length}
                onChange={e => set({ valueCol: e.target.value })}>
                <option value="">Choose a column…</option>
                {valueCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          )}
          <Field label="Name it" hint="Also the column heading on a table">
            <input className="form-control form-control-sm" value={w.valueAlias}
              onChange={e => set({ valueAlias: e.target.value })} />
          </Field>
        </Row>

        <Row>
          <Field label="Order">
            <select className="form-select form-select-sm" value={w.sort}
              onChange={e => set({ sort: e.target.value })}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="How many">
            <input type="number" min="1" max="5000" className="form-control form-control-sm"
              value={w.limit} onChange={e => set({ limit: e.target.value })} />
          </Field>
          <Field label="Values on chart">
            <div className="form-check mt-1">
              <input className="form-check-input" type="checkbox" id="czShowValues"
                checked={w.showValues !== false}
                onChange={e => set({ showValues: e.target.checked })} />
              <label className="form-check-label" htmlFor="czShowValues">Print them</label>
            </div>
          </Field>
        </Row>

        <Field label="Conditions" hint="Only rows that match are counted">
          <FilterRows filters={w.filters} columns={columns} onChange={(f) => set({ filters: f })} />
        </Field>

        <div className="cz-form-h mt-3">Appearance</div>
        <div className="cz-kinds">
          {CHART_KINDS.map((c) => (
            <button type="button" key={c.key}
              className={`cz-kind ${w.chartType === c.key ? 'on' : ''}`}
              onClick={() => set({ chartType: c.key })}>
              <i className={`bi ${c.icon}`}></i>{c.name}
            </button>
          ))}
        </div>
        <div className="cz-kinds mt-2">
          {Object.entries(DASH_PALETTES).map(([k, p]) => (
            <button type="button" key={k} className={`cz-swatch ${w.palette === k ? 'on' : ''}`}
              title={p.name} onClick={() => set({ palette: k })}>
              {p.colors.slice(0, 4).map((c, i) => (
                <i key={i} style={{ background: c }} />
              ))}
            </button>
          ))}
        </div>
      </div>

      <div className="cz-builder-prev">
        <div className="cz-prev-head">
          <strong>Live preview</strong>
          {q.res && <span className="cz-prev-rows">{q.res.rowCount} row{q.res.rowCount === 1 ? '' : 's'}</span>}
        </div>
        <WidgetPreview
          res={q.res} loading={q.loading} error={q.error}
          chartType={effectiveType} palette={w.palette} showValues={w.showValues !== false}
          valueAlias={valueAlias} name={w.valueAlias}
          hint={w.table ? 'Nothing to show yet' : 'Choose a table on the left'}
        />
        {q.res && q.res.sql && (
          <details className="cz-prev-sql">
            <summary>SQL</summary>
            <code>{q.res.sql}</code>
          </details>
        )}
        <div className="cz-prev-kind">Rendered as {kind.name}</div>
      </div>
    </div>
  );
}
