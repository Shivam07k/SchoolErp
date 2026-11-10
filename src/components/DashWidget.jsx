import React, { useEffect, useRef, useState } from 'react';
import DashChart, { fmtNum } from './DashCharts';
import {
  rowsToSeries, chartKind, specValueAlias, parseSpec, rowsToTable,
} from '../widgetSpec';
import { apiPost } from '../api';

/* Runs a widget spec and keeps the result. Debounced, and guarded against an
   older slower run overwriting a newer one, so dragging through the controls
   does not flicker between answers. */
export function useWidgetQuery(spec, { enabled = true, delay = 350 } = {}) {
  const [state, setState] = useState({ loading: false, res: null, error: '' });
  const timer = useRef(null);
  const seq = useRef(0);
  const key = spec ? JSON.stringify(spec) : '';

  useEffect(() => {
    if (!enabled || !key) {
      setState({ loading: false, res: null, error: '' });
      return undefined;
    }
    const mine = (seq.current += 1);
    setState((s) => ({ ...s, loading: true }));
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await apiPost('/dash/query', { spec, maxRows: 200 });
        if (mine !== seq.current) return;
        /* apiPost resolves with {error} rather than throwing. */
        if (r && r.error) setState({ loading: false, res: null, error: r.error });
        else setState({ loading: false, res: r, error: '' });
      } catch (e) {
        if (mine !== seq.current) return;
        setState({ loading: false, res: null, error: e.message || 'Could not run the query' });
      }
    }, delay);
    return () => clearTimeout(timer.current);
    /* key stands in for spec so an equal-but-new object does not re-run */
  }, [key, enabled, delay]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

function PreviewError({ error }) {
  const admin = /administrator|only an admin/i.test(error);
  return (
    <div className="cz-prev-err">
      <i className={`bi ${admin ? 'bi-shield-lock' : 'bi-exclamation-triangle'}`}></i>
      <div>
        <strong>{admin ? 'Only an administrator can run this' : 'Could not build the chart'}</strong>
        <div>{error}</div>
      </div>
    </div>
  );
}

function KpiPreview({ data, name }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="cz-prev-kpi">
      <div className="cz-prev-kpi-num">{fmtNum(total)}</div>
      <div className="cz-prev-kpi-lb">{name || data[0].label || 'Total'}</div>
    </div>
  );
}

function TablePreview({ res }) {
  const { columns, rows } = rowsToTable(res);
  const shown = rows.slice(0, 12);
  return (
    <div className="cz-prev-table-wrap">
      <table className="cz-prev-table">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>{columns.map((c) => <td key={c}>{String(r[c] ?? '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <div className="cz-prev-more">Showing {shown.length} of {rows.length} rows</div>
      )}
    </div>
  );
}

/* The chart area. Shows a spinner on every change but keeps the previous chart
   visible underneath, so the preview updates in place instead of blinking. */
export function WidgetPreview({
  res, loading, error, chartType, palette, showValues, valueAlias, name, hint,
}) {
  if (error) return <PreviewError error={error} />;

  const kind = chartKind(chartType);
  const data = res ? rowsToSeries(res, valueAlias) : [];
  const render = kind.render;

  let body;
  if (!res) body = <div className="chart-empty">{hint || 'Choose a table to start'}</div>;
  else if (!data.length) body = <div className="chart-empty">No rows came back</div>;
  else if (render === 'kpi') body = <KpiPreview data={data} name={name} />;
  else if (render === 'table') body = <TablePreview res={res} />;
  else body = <DashChart type={render} data={data} palette={palette} showValues={showValues} />;

  return (
    <div className={`cz-prev ${loading ? 'loading' : ''}`}>
      {body}
      {loading && <div className="cz-prev-spin"><span className="spinner-border spinner-border-sm"></span></div>}
    </div>
  );
}

/* A saved widget, straight from the database row: reads its own spec, runs it
   and draws itself. Used by the page preview and, later, the real dashboard. */
export default function DashWidget({
  widget, chartType, palette, showValues, className = '',
}) {
  const spec = parseSpec(widget && widget.query);
  const type = chartType || (widget && widget.chartType) || 'bar';
  const style = (widget && widget.style) || {};
  const pal = palette || style.palette;
  const vals = showValues != null ? showValues : style.showValues !== false;
  const q = useWidgetQuery(spec, { enabled: !!spec });

  return (
    <div className={`dash-widget ${className}`}>
      <div className="dash-widget-head">
        <strong>{(widget && widget.name) || 'Widget'}</strong>
        {widget && widget.chartType ? <span className="dash-widget-kind">{type}</span> : null}
      </div>
      <WidgetPreview
        res={q.res} loading={q.loading} error={q.error}
        chartType={type} palette={pal} showValues={vals}
        valueAlias={specValueAlias(spec)} name={(widget && widget.name) || ''}
        hint="This widget has no query yet"
      />
    </div>
  );
}
