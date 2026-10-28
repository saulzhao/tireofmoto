// The header brand used three different marks (🔬 on most pages, 🛞 on some,
// text only on the rest). Rewrite every `.navbar-brand` block to the same
// green tire icon plus the site name, so a build makes new pages consistent.
//
//   node scripts/normalize-navbar-logo.mjs [dir]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BRAND_HTML = '<a href="/" class="navbar-brand"><img src="/favicon.svg" width="36" height="36" alt="" class="logo-icon"><span>Tire of Moto</span></a>';

const BRAND_RE = /<a href="\/" class="navbar-brand">[\s\S]*?<\/a>/g;

export function normalizeNavbar(root) {
  const counts = { micro: 0, wheel: 0, plain: 0, changed: 0, files: 0 };

  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) { walk(path); continue; }
      if (!name.endsWith('.html')) continue;
      const html = readFileSync(path, 'utf8');
      if (!html.includes('class="navbar-brand"')) continue;
      let fileChanged = false;
      const next = html.replace(BRAND_RE, (block) => {
        if (block === BRAND_HTML) return block;
        if (block.includes('🛞')) counts.wheel += 1;
        else if (block.includes('&#128300;') || block.includes('🔬')) counts.micro += 1;
        else counts.plain += 1;
        counts.changed += 1;
        fileChanged = true;
        return BRAND_HTML;
      });
      if (fileChanged) {
        writeFileSync(path, next);
        counts.files += 1;
      }
    }
  }

  walk(root);
  return counts;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.argv[2] || join(fileURLToPath(new URL('..', import.meta.url)));
  const counts = normalizeNavbar(root);
  console.log(`navbar logo: replaced ${counts.changed} blocks in ${counts.files} files (🔬 ${counts.micro}, 🛞 ${counts.wheel}, text-only ${counts.plain})`);
}
