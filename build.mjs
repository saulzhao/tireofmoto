// 把仓库里的静态文件原样复制到 dist/，供 Cloudflare Pages 发布。
// 只复制下面白名单里的条目，仓库里其它文件（脚本、模板、开发用页面）不会进发布目录。
import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ENTRIES = [
  '404.html',
  '_redirects',
  '_astro',
  'about',
  'contact',
  'css',
  'disclosure',
  'favicon.svg',
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
walk('dist');

console.log(`dist: ${files} files, ${(bytes / 1048576).toFixed(1)} MB`);
