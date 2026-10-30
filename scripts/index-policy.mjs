#!/usr/bin/env node
// 按 scripts/index-policy.json 统一管理索引状态、sitemap、search.json、rss.xml。
//
//   node scripts/index-policy.mjs            # 写入（构建时用）
//   node scripts/index-policy.mjs --check    # 只校验，不写文件
//
// 规则：
//   - models 里 status=indexed 的页面恢复 index 并进 sitemap；
//     noindex / keep / merge 一律 noindex,follow，不进 sitemap。
//   - posts 目录里除模型页和 legacyNoindex 之外的都算编辑型文章，默认 index 并进 sitemap、
//     search.json、rss.xml；新文章不用改清单。
//   - 标签子页 noindex,follow 并移出 sitemap；/tags/ 保留索引并带 140–160 字符 description。
//   - merge 来源必须在 _redirects 有且只有一条 301，目标页存在。
//   - 没有策略记录的车型页（slug 里带 5 位以上连续数字）直接让构建失败。
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const SITE = 'https://tireofmoto.com';
const POLICY_PATH = join(ROOT, 'scripts/index-policy.json');
const INDEX_ROBOTS = 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
const NOINDEX_ROBOTS = 'noindex,follow';

const errors = [];
const fail = (m) => errors.push(m);

const policy = JSON.parse(readFileSync(POLICY_PATH, 'utf8'));
const models = new Map(policy.models.map((m) => [m.slug, m]));
const legacy = new Set(policy.legacyNoindex);
const editorial = new Set(policy.editorial);

const postDir = (slug) => join(ROOT, 'posts', slug);
const postFile = (slug) => join(postDir(slug), 'index.html');
const urlOf = (slug) => `${SITE}/posts/${slug}/`;

const htmlFiles = new Set(); // 需要改 robots 的页面
const edits = new Map(); // 同一文件多处修改共用一份内容，避免后写覆盖前写

function edit(file, fn) {
  const html = edits.has(file) ? edits.get(file) : readFileSync(file, 'utf8');
  const next = fn(html);
  if (next !== html) {
    edits.set(file, next);
    htmlFiles.add(file);
  }
  return next;
}

function setRobots(file, value) {
  edit(file, (html) => {
    const tag = `<meta name="robots" content="${value}">`;
    if (html.includes(tag)) return html;
    const re = /<meta name="robots" content="[^"]*">/;
    if (re.test(html)) return html.replace(re, tag);
    const anchor = html.match(/<meta name="viewport"[^>]*>/);
    if (!anchor) {
      fail(`${file.replace(ROOT + '/', '')} 没有 viewport 标签，插不进 robots`);
      return html;
    }
    return html.replace(anchor[0], `${anchor[0]}${tag}`);
  });
}

function setDescription(file, value) {
  edit(file, (html) => {
    const tag = `<meta name="description" content="${value}">`;
    const re = /<meta name="description" content="[^"]*">/;
    if (re.test(html)) return html.replace(re, tag);
    const anchor = html.match(/<link rel="canonical" href="[^"]*">/) || html.match(/<meta name="viewport"[^>]*>/);
    if (!anchor) {
      fail(`${file.replace(ROOT + '/', '')} 找不到插入 description 的位置`);
      return html;
    }
    return html.replace(anchor[0], `${anchor[0]}${tag}`);
  });
}

function getRobots(file) {
  const html = edits.has(file) ? edits.get(file) : readFileSync(file, 'utf8');
  const m = html.match(/<meta name="robots" content="([^"]*)"/);
  return m ? m[1] : '';
}

function pageLastmod(file) {
  const html = readFileSync(file, 'utf8');
  const m = html.match(/<time datetime="(\d{4}-\d{2}-\d{2})"/);
  if (m) return m[1];
  return new Date(statSync(file).mtimeMs).toISOString().slice(0, 10);
}

function metaOf(file) {
  const html = readFileSync(file, 'utf8');
  const pick = (re) => (html.match(re) || [])[1] || '';
  const decode = (s) =>
    s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return {
    title: decode(pick(/<title>([^<]+)<\/title>/)),
    description: decode(pick(/<meta name="description" content="([^"]*)"/)),
    date: pick(/<time datetime="(\d{4}-\d{2}-\d{2})"/),
  };
}

// ---- 1. 车型页 robots ----
for (const m of policy.models) {
  if (!existsSync(postFile(m.slug))) {
    fail(`策略里的车型页不存在：posts/${m.slug}/index.html`);
    continue;
  }
  setRobots(postFile(m.slug), m.status === 'indexed' ? INDEX_ROBOTS : NOINDEX_ROBOTS);
}

// ---- 2. 标签页 ----
for (const tag of policy.tags.noindex) {
  const file = join(ROOT, 'tags', tag, 'index.html');
  if (!existsSync(file)) {
    fail(`策略里的标签页不存在：tags/${tag}/index.html`);
    continue;
  }
  setRobots(file, NOINDEX_ROBOTS);
}
const tagsOverview = join(ROOT, 'tags/index.html');
setRobots(tagsOverview, INDEX_ROBOTS);
setDescription(tagsOverview, policy.tags.overview.description);
if (policy.tags.overview.description.length < 140 || policy.tags.overview.description.length > 160) {
  fail(`/tags/ 的 description 是 ${policy.tags.overview.description.length} 字符，应为 140–160`);
}

// ---- 3. 编辑型文章：磁盘上除模型页和旧 noindex 页之外的都是 ----
const disk = readdirSync(join(ROOT, 'posts'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const unclassified = [];
for (const slug of disk) {
  if (models.has(slug) || legacy.has(slug)) continue;
  // slug 里 5 位以上连续数字 = 程序化车型页的尺寸串（12070-zr1718055-zr17 这种）
  if (/\d{5,}/.test(slug)) { unclassified.push(slug); continue; }
  editorial.add(slug);
}
for (const slug of editorial) {
  if (!existsSync(postFile(slug))) {
    fail(`编辑型文章不存在：posts/${slug}/index.html`);
    continue;
  }
  const robots = getRobots(postFile(slug));
  if (robots.includes('noindex')) fail(`编辑型文章被标成 noindex：posts/${slug}/`);
}
for (const slug of unclassified) {
  fail(`新车型页没有策略记录：posts/${slug}/，请先加到 scripts/index-policy.json 并核 OEM 来源`);
}

// ---- 4. sitemap ----
const sitemapPath = join(ROOT, 'sitemap.xml');
const oldEntry = new Map();
for (const m of readFileSync(sitemapPath, 'utf8').matchAll(/<url>(.*?)<\/url>/g)) {
  const loc = (m[1].match(/<loc>([^<]+)<\/loc>/) || [])[1];
  if (loc) oldEntry.set(loc, m[1]);
}
const entry = (url, priority, lastmod) =>
  `<url><loc>${url}</loc><priority>${priority}</priority>` +
  (lastmod ? `<lastmod>${lastmod}</lastmod>` : '') + '</url>';

const urls = [];
for (const item of policy.base) urls.push(entry(item.url, item.priority, item.lastmod));
for (const item of policy.tools) urls.push(entry(item.url, item.priority, item.lastmod));
for (const slug of [...editorial].sort()) {
  const url = urlOf(slug);
  const prev = oldEntry.get(url);
  if (prev) {
    const pri = (prev.match(/<priority>([^<]+)/) || [])[1] || '0.7';
    const mod = (prev.match(/<lastmod>([^<]+)/) || [])[1] || pageLastmod(postFile(slug));
    urls.push(entry(url, pri, mod));
  } else {
    urls.push(entry(url, '0.7', pageLastmod(postFile(slug))));
  }
}
for (const m of policy.models) {
  if (m.status !== 'indexed') continue;
  urls.push(entry(m.url, '0.7', m.lastReviewed || pageLastmod(postFile(m.slug))));
}

const sitemap = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  urls.join('') + '</urlset>\n';

// ---- 5. search.json ----
const searchPath = join(ROOT, 'search.json');
const search = JSON.parse(readFileSync(searchPath, 'utf8'));
const kept = [];
for (const item of search) {
  if (!editorial.has(item.slug)) continue;
  kept.push(item);
}
const keptSlugs = new Set(kept.map((i) => i.slug));
for (const slug of editorial) {
  if (keptSlugs.has(slug)) continue;
  const meta = metaOf(postFile(slug));
  kept.push({ slug, title: meta.title, date: meta.date, description: meta.description, pubDate: meta.date, tags: [] });
}
kept.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

// ---- 6. rss.xml：去掉车型页，编辑型文章和工具保留 ----
const rssPath = join(ROOT, 'rss.xml');
const rss = readFileSync(rssPath, 'utf8');
const rssItems = [...rss.matchAll(/<item>[\s\S]*?<\/item>/g)].map((m) => m[0]);
const rssKept = rssItems.filter((item) => {
  const link = (item.match(/<link>([^<]+)<\/link>/) || [])[1] || '';
  const m = link.match(/\/posts\/([^/]+)\/$/);
  if (!m) return true; // 工具页等非文章条目保留
  return !models.has(m[1]) && !legacy.has(m[1]);
});
let newRss = rss;
for (const item of rssItems) {
  if (!rssKept.includes(item)) newRss = newRss.replace(item, '');
}

// ---- 7. 校验 ----
function fileForUrl(url) {
  const rel = url.slice(SITE.length).replace(/^\//, '');
  return rel === '' ? join(ROOT, 'index.html') : join(ROOT, rel, 'index.html');
}
for (const url of urls.map((u) => (u.match(/<loc>([^<]+)</) || [])[1])) {
  const file = fileForUrl(url);
  if (!existsSync(file)) fail(`sitemap 里的网址没有对应文件：${url}`);
  else if (getRobots(file).includes('noindex')) fail(`sitemap 里的页面带 noindex：${url}`);
}
for (const m of policy.models) {
  if (m.status === 'indexed') continue;
  if (new Set(urls.map((u) => (u.match(/<loc>([^<]+)</) || [])[1])).has(m.url)) {
    fail(`不该进 sitemap 的车型页在里面：${m.url}（status=${m.status}）`);
  }
}
for (const tag of policy.tags.noindex) {
  const url = `${SITE}/tags/${tag}/`;
  if (urls.some((u) => u.includes(`<loc>${url}</loc>`))) fail(`标签子页不该进 sitemap：${url}`);
}

const redirects = readFileSync(join(ROOT, '_redirects'), 'utf8');
for (const m of policy.models) {
  if (m.status !== 'merge') continue;
  if (!m.canonical) {
    fail(`合并页没有目标：${m.slug}`);
    continue;
  }
  const re = new RegExp(`^/posts/${m.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\s+\\S+\\s+301$`, 'm');
  const matches = redirects.match(new RegExp(`^/posts/${m.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\s+\\S+\\s+(\\d+)$`, 'gm')) || [];
  if (matches.length !== 1) fail(`合并页 ${m.slug} 在 _redirects 里的规则有 ${matches.length} 条，应恰好 1 条`);
  else if (!matches[0].includes(` ${m.canonical} 301`)) fail(`合并页 ${m.slug} 的 301 目标不是 ${m.canonical}`);
  const targetSlug = m.canonical.replace(/\/$/, '').split('/').pop();
  if (!existsSync(postFile(targetSlug))) fail(`合并目标不存在：${m.canonical}`);
  const target = models.get(targetSlug);
  if (target && !['keep', 'indexed'].includes(target.status)) fail(`合并目标 ${targetSlug} 的状态是 ${target.status}，应保留`);
  if (!re.test(redirects) && matches.length === 1) fail(`合并页 ${m.slug} 的 301 行格式不对`);
}
for (const item of kept) {
  if (models.has(item.slug)) fail(`search.json 里还有车型页：${item.slug}`);
}
for (const item of newRss.matchAll(/<item>[\s\S]*?<\/item>/g)) {
  const link = (item[0].match(/<link>([^<]+)<\/link>/) || [])[1] || '';
  const m = link.match(/\/posts\/([^/]+)\/$/);
  if (m && (models.has(m[1]) || legacy.has(m[1]))) fail(`rss.xml 里还有不该收录的文章：${link}`);
}

if (errors.length) {
  console.error(`索引策略检查失败，${errors.length} 个问题：`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const checkOnly = process.argv.includes('--check');
const sitemapBytes = Buffer.from(sitemap, 'utf8');
const gz = gzipSync(sitemapBytes, { level: 9, mtime: 0 });

if (!checkOnly) {
  for (const file of htmlFiles) writeFileSync(file, edits.get(file));
  writeFileSync(sitemapPath, sitemap);
  writeFileSync(join(ROOT, 'sitemap.xml.gz'), gz);
  writeFileSync(searchPath, JSON.stringify(kept, null, 2) + '\n');
  writeFileSync(rssPath, newRss);
}

console.log(
  `${checkOnly ? '[check] ' : ''}索引策略：sitemap ${urls.length} 条，编辑文章 ${editorial.size} 篇，` +
  `车型页 ${policy.models.length} 个（其中已补厚 ${policy.models.filter((m) => m.status === 'indexed').length}），` +
  `标签 ${policy.tags.noindex.length} 个 noindex；search.json ${kept.length} 条；rss ${rssKept.length} 条；` +
  `改动页面 ${htmlFiles.size} 个`,
);
