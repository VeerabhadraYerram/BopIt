import { formatProductPrice } from './product-display.js';

export function priceHistorySeries(history, currency) {
  return (history || []).filter(point => typeof point.price === 'number' && Number.isFinite(point.price)
    && point.currency === currency && Number.isFinite(Date.parse(point.timestamp)))
    .map(point => ({ ...point, time: Date.parse(point.timestamp) })).sort((a, b) => a.time - b.time);
}

export function createPriceHistoryChart(points, currency) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const make = (name, attrs, text) => {
    const element = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const date = time => new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const min = Math.min(...points.map(p => p.price)), max = Math.max(...points.map(p => p.price));
  const padding = max === min ? Math.max(Math.abs(min) * .05, 1) : (max - min) * .08;
  const low = min - padding, high = max + padding;
  const start = points[0].time, end = points.at(-1).time;
  const x = time => start === end ? 238 : 78 + 320 * (time - start) / (end - start);
  const y = price => 134 - 104 * (price - low) / (high - low);
  svg.setAttribute('viewBox', '0 0 420 190');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Recorded price history in ${currency}, ${date(start)} to ${date(end)}. Minimum ${formatProductPrice(min, currency)}, maximum ${formatProductPrice(max, currency)}. Dates are UTC.`);
  svg.append(make('text', { x: 78, y: 16, class: 'chart-axis-title' }, `Price (${currency})`));
  for (const price of [high, (high + low) / 2, low]) {
    svg.append(make('line', { x1: 78, x2: 398, y1: y(price), y2: y(price), class: 'chart-gridline' }),
      make('text', { x: 70, y: y(price) + 4, 'text-anchor': 'end', class: 'chart-tick' }, new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(price)));
  }
  svg.append(make('polyline', { points: points.map(p => `${x(p.time)},${y(p.price)}`).join(' '), fill: 'none', stroke: '#52775c', 'stroke-width': 2 }));
  for (const point of points) {
    const dot = make('circle', { cx: x(point.time), cy: y(point.price), r: 3, fill: '#52775c' });
    dot.append(make('title', {}, `${date(point.time)} · ${formatProductPrice(point.price, currency)}`));
    svg.append(dot);
  }
  svg.append(make('text', { x: start === end ? 238 : 78, y: 154, 'text-anchor': start === end ? 'middle' : 'start', class: 'chart-tick' }, date(start)));
  if (start !== end) svg.append(make('text', { x: 398, y: 154, 'text-anchor': 'end', class: 'chart-tick' }, date(end)));
  svg.append(make('text', { x: 238, y: 178, 'text-anchor': 'middle', class: 'chart-axis-title' }, 'Date (UTC)'));
  return svg;
}
