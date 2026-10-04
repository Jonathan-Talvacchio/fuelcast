// RSS feeds of the site's advice, one per area and fuel, so people can get an
// alert when the call changes (any feed reader, or a feed-to-email/phone
// service). Built by the data job from data/verdict-history.json into
// data/feeds/<grade>-<area>.xml. Pure: returns the files to write.

import { VERDICTS } from './predict.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const rfc822 = day => new Date(`${day}T21:00:00Z`).toUTCString();   // the data job runs ~21:00 UTC
const MAX_ITEMS = 20;

export const feedPath = (grade, areaId) => `data/feeds/${grade}-${areaId}.xml`;

// history: { 'YYYY-MM-DD': { grade: { AREA: key } } }; areas: data.areas;
// grades: { grade: display name }; siteUrl ends with '/'.
export function buildFeeds(history, areas, grades, siteUrl) {
  const days = Object.keys(history).sort();
  const files = {};
  for (const [g, gName] of Object.entries(grades)) {
    for (const [id, area] of Object.entries(areas)) {
      // Each change of call is an item; the first day seen starts the feed.
      const items = [];
      let prev = null;
      for (const day of days) {
        const key = history[day]?.[g]?.[id];
        if (!key || key === prev) continue;
        items.push({ day, key });
        prev = key;
      }
      if (!items.length) continue;
      const page = `${siteUrl}#${encodeURIComponent(`area:${id}`)}${g === 'regular' ? '' : `/${g}`}`;
      const title = `Fuelcast: ${area.name} · ${gName}`;
      const xmlItems = items.slice(-MAX_ITEMS).reverse().map(({ day, key }) => {
        const label = VERDICTS[key]?.label || key;
        return [
          '    <item>',
          `      <title>${esc(`${area.name} ${gName.toLowerCase()}: ${label}`)}</title>`,
          `      <link>${esc(page)}</link>`,
          `      <guid isPermaLink="false">${esc(`fuelcast-${g}-${id}-${day}-${key}`)}</guid>`,
          `      <pubDate>${rfc822(day)}</pubDate>`,
          `      <description>${esc(`Fuelcast's advice for ${gName.toLowerCase()} in ${area.name} changed to "${label}" on ${day}. Open the page for today's prices, the odds and the forecast.`)}</description>`,
          '    </item>',
        ].join('\n');
      });
      files[feedPath(g, id)] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        `    <title>${esc(title)}</title>`,
        `    <link>${esc(page)}</link>`,
        `    <atom:link href="${esc(siteUrl + feedPath(g, id))}" rel="self" type="application/rss+xml"/>`,
        `    <description>${esc(`An item each time Fuelcast's buy-or-wait advice for ${gName.toLowerCase()} in ${area.name} changes.`)}</description>`,
        '    <language>en-us</language>',
        `    <lastBuildDate>${rfc822(items[items.length - 1].day)}</lastBuildDate>`,
        '    <ttl>720</ttl>',
        ...xmlItems,
        '  </channel>',
        '</rss>',
        '',
      ].join('\n');
    }
  }
  return files;
}
