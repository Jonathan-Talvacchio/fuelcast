// Trend chart: recent reported prices + daily projection with an uncertainty
// band. Uses the Chart.js global loaded from the CDN in index.html.
// x axis is "days relative to the latest report" so weekly and daily points
// share one linear scale without a date adapter.

import { parseDate } from './predict.js';

const DAY_MS = 86400000;
const HISTORY_WEEKS = 13;
const FUTURE_DAYS = 14;

let chart = null;

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function fmtDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function renderChart(canvas, result) {
  if (typeof Chart === 'undefined') {
    canvas.replaceWith(Object.assign(document.createElement('p'), {
      className: 'muted', textContent: 'Chart unavailable (could not load the chart library).',
    }));
    return;
  }
  const asOf = parseDate(result.asOf);
  const toDay = date => Math.round((parseDate(date) - asOf) / DAY_MS);

  const history = result.history.slice(-HISTORY_WEEKS).map(p => ({ x: toDay(p.date), y: p.price }));
  const lastDay = result.projectionFromDay + FUTURE_DAYS;
  const proj = result.projection.filter(p => p.day <= lastDay);
  const projLine = proj.map(p => ({ x: p.day, y: p.price }));
  const bandHi = proj.map(p => ({ x: p.day, y: p.high }));
  const bandLo = proj.map(p => ({ x: p.day, y: p.low }));

  const line = cssVar('--line');
  const band = cssVar('--band');
  const grid = cssVar('--grid');
  const ink = cssVar('--text-2');
  const surface = cssVar('--surface');
  const today = result.projectionFromDay;

  const data = {
    datasets: [
      { label: 'Reported weekly average', data: history, borderColor: line, borderWidth: 2,
        pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: surface, pointBorderWidth: 2, tension: 0.25, order: 1 },
      { label: 'Predicted', data: projLine, borderColor: line, borderWidth: 2, borderDash: [6, 4],
        pointRadius: 0, pointHoverRadius: 6, pointBackgroundColor: surface, pointBorderWidth: 2, tension: 0.25, order: 0 },
      { label: 'Likely high', data: bandHi, borderWidth: 0, pointRadius: 0, pointHoverRadius: 0,
        backgroundColor: band, fill: '+1', tension: 0.25, order: 2 },
      { label: 'Likely low', data: bandLo, borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, order: 3 },
    ],
  };

  const todayLine = {
    id: 'todayLine',
    afterDraw(c) {
      const x = c.scales.x.getPixelForValue(today);
      const { top, bottom } = c.chartArea;
      const ctx = c.ctx;
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ink;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('today', x, top - 4);
      ctx.restore();
    },
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    layout: { padding: { top: 14 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        filter: item => item.datasetIndex < 2,
        callbacks: {
          title: items => (items.length ? fmtDate(asOf + items[0].parsed.x * DAY_MS) : ''),
          label: item => {
            const p = item.parsed;
            let s = `${item.dataset.label}: $${p.y.toFixed(3)}`;
            if (item.datasetIndex === 1) {
              const pt = proj.find(q => q.day === p.x);
              if (pt && pt.day > 0) s += `  (range $${pt.low.toFixed(2)}–$${pt.high.toFixed(2)})`;
            }
            return s;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min: history.length ? history[0].x : -7 * HISTORY_WEEKS,
        max: lastDay,
        grid: { color: grid, drawTicks: false },
        border: { display: false },
        afterBuildTicks: scale => {
          // One tick every two weeks from the first history point, plus the last day.
          const ticks = [];
          for (let v = scale.min; v < scale.max - 6; v += 14) ticks.push({ value: v });
          ticks.push({ value: scale.max });
          scale.ticks = ticks;
        },
        ticks: { color: ink, callback: v => fmtDate(asOf + v * DAY_MS), font: { size: 11 }, maxRotation: 0 },
      },
      y: {
        grid: { color: grid, drawTicks: false },
        border: { display: false },
        ticks: { color: ink, callback: v => `$${v.toFixed(2)}`, maxTicksLimit: 6, font: { size: 11 } },
        grace: '10%',
      },
    },
  };

  if (chart) {
    chart.data = data;
    chart.options = options;
    chart.update();
  } else {
    chart = new Chart(canvas, { type: 'line', data, options, plugins: [todayLine] });
  }
}

export function fillTable(tbody, result) {
  const rows = [];
  for (const p of result.history.slice(-HISTORY_WEEKS)) rows.push([p.date, p.price, 'Reported']);
  for (const p of result.projection) {
    if (p.day === 0 || p.day > result.projectionFromDay + FUTURE_DAYS) continue;
    rows.push([p.date, p.price, `Predicted (range $${p.low.toFixed(2)}–$${p.high.toFixed(2)})`]);
  }
  tbody.replaceChildren(...rows.map(([d, price, kind]) => {
    const tr = document.createElement('tr');
    for (const v of [fmtDate(parseDate(d)), `$${price.toFixed(3)}`, kind]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    return tr;
  }));
}
