// 把仓库里的静态文件原样复制到 dist/，供 Cloudflare Pages 发布。
// 只复制下面白名单里的条目，仓库里其它文件（脚本、模板、开发用页面）不会进发布目录。
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { normalizeNavbar } from './scripts/normalize-navbar.mjs';

const ENTRIES = [
  '404.html',
  '_redirects',
  '_astro',
  'about',
  'contact',
  'css',
  'disclosure',
  'favicon.ico',
  'favicon.svg',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'images',
  'index.html',
  'js',
  'posts',
  'privacy-policy',
  'robots.txt',
  'rss.xml',
  'search',
  'search.json',
  'sitemap.xml',
  'sitemap.xml.gz',
  'tags',
  'tire-calculator',
  'tire-comparison',
  'tire-size-chart',
  'tire-width-converter',
];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

// 索引白名单：改 robots、重建 sitemap/search/RSS，并校验（失败就直接中断构建）。
execFileSync(process.execPath, ['scripts/index-policy.mjs'], { stdio: 'inherit' });

for (const entry of ENTRIES) {
  cpSync(entry, join('dist', entry), { recursive: true });
}

let files = 0;
let bytes = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
    } else {
      files += 1;
      bytes += stat.size;
    }
  }
};
// Every deployed page gets the icon set. Existing pages carry a single
// /favicon.svg link; add the raster fallbacks there, and insert the block
// after the viewport tag for any page that has no icon link at all.
const ICON_BLOCK = [
  '<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">',
  '<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">',
  '<link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png">',
  '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
].join('');

function ensureIcons(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) { ensureIcons(path); continue; }
    if (!name.endsWith('.html')) continue;
    let html = readFileSync(path, 'utf8');
    if (html.includes('href="/apple-touch-icon.png"')) continue;
    const svgLink = html.match(/<link rel="icon" href="\/favicon\.svg">/);
    if (svgLink) {
      html = html.replace(svgLink[0], ICON_BLOCK);
    } else {
      const viewport = html.match(/<meta name="viewport"[^>]*>/);
      if (!viewport) continue;
      html = html.replace(viewport[0], viewport[0] + ICON_BLOCK);
    }
    writeFileSync(path, html);
    iconsAdded += 1;
  }
}

let iconsAdded = 0;
ensureIcons(join(process.cwd(), 'dist'));

const navLogo = normalizeNavbar(join(process.cwd(), 'dist'));

walk('dist');

console.log(`dist: ${files} files, ${(bytes / 1048576).toFixed(1)} MB, icon links added to ${iconsAdded} pages, navbar normalized on ${navLogo.files} files`);
