// Dates were baked into the static pages with a local-time formatter, so most
// of them show the day before the ISO date in the URL. This script rewrites
// every derived date from the ISO date, using UTC so the build machine's
// timezone never matters again. It is idempotent: run it after adding posts.
//
//   node scripts/fix-dates.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function utcDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function longDate(iso) {
  const dt = utcDate(iso);
  return `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
}
function rfc822(iso) {
  const dt = utcDate(iso);
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getUTCMonth()];
  return `${DAYS[dt.getUTCDay()]}, ${dd} ${mon} ${dt.getUTCFullYear()} 00:00:00 GMT`;
}

let timeFixed = 0;
for (const dir of readdirSync(join(ROOT, 'posts'))) {
  const file = join(ROOT, 'posts', dir, 'index.html');
  let html;
  try { html = readFileSync(file, 'utf8'); } catch { continue; }
  const next = html.replace(/<time datetime="(\d{4}-\d{2}-\d{2})">([^<]*)<\/time>/g, (all, iso, text) => {
    const want = longDate(iso);
    if (text === want) return all;
    timeFixed += 1;
    return `<time datetime="${iso}">${want}</time>`;
  });
  if (next !== html) writeFileSync(file, next);
}

// Home and tag listings show ISO dates (and tag pages often carry a year-only
// datetime attribute). Rewrite both text and attribute from the post slug.
let listFixed = 0;
const listFiles = ['index.html', 'tags/index.html'];
for (const tag of readdirSync(join(ROOT, 'tags'))) {
  if (existsSync(join(ROOT, 'tags', tag, 'index.html'))) listFiles.push(`tags/${tag}/index.html`);
}
for (const rel of listFiles) {
  const file = join(ROOT, rel);
  let html = readFileSync(file, 'utf8');
  const next = html.replace(/<article class="post-card">[\s\S]*?<\/article>/g, (block) => {
    const href = block.match(/href="\/posts\/(\d{4}-\d{2}-\d{2})-/);
    if (!href) return block;
    const iso = href[1];
    const want = `<time datetime="${iso}">${longDate(iso)}</time>`;
    return block.replace(/<time datetime="[^"]*">[^<]*<\/time>/g, () => {
      listFixed += 1;
      return want;
    });
  });
  if (next !== html) writeFileSync(file, next);
}

let rssFixed = 0;
const rssPath = join(ROOT, 'rss.xml');
let rss = readFileSync(rssPath, 'utf8');
rss = rss.replace(/<item>[\s\S]*?<\/item>/g, (item) => {
  const link = item.match(/<link>([^<]+)<\/link>/);
  const date = link && link[1].match(/\/posts\/(\d{4}-\d{2}-\d{2})-/);
  if (!date) return item;
  const want = rfc822(date[1]);
  const got = item.match(/<pubDate>([^<]*)<\/pubDate>/);
  if (got && got[1] === want) return item;
  rssFixed += 1;
  return got
    ? item.replace(/<pubDate>[^<]*<\/pubDate>/, `<pubDate>${want}</pubDate>`)
    : item.replace('</item>', `<pubDate>${want}</pubDate></item>`);
});
writeFileSync(rssPath, rss);

const searchPath = join(ROOT, 'search.json');
const search = JSON.parse(readFileSync(searchPath, 'utf8'));
let searchFixed = 0;
for (const entry of search) {
  const date = /^(\d{4}-\d{2}-\d{2})-/.exec(entry.slug);
  if (!date) continue;
  if (entry.date !== date[1] || entry.pubDate !== date[1]) {
    entry.date = date[1];
    entry.pubDate = date[1];
    searchFixed += 1;
  }
}
writeFileSync(searchPath, JSON.stringify(search, null, 2) + '\n');

console.log(`posts <time> fixed: ${timeFixed}`);
console.log(`list <time> fixed: ${listFixed}`);
console.log(`rss pubDate fixed: ${rssFixed}`);
console.log(`search.json dates fixed: ${searchFixed}`);
