// Unify the site header across every page: green tire logo + Home/About/Tags/
// Contact menu + search box + mobile hamburger, and add the JS/CSS those need.
// Runs on the source tree or on dist/ from build.mjs, and is idempotent.
//
//   node scripts/normalize-navbar.mjs [dir]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BRAND = '<a href="/" class="navbar-brand"><img src="/favicon.svg" width="36" height="36" alt="" class="logo-icon"><span>Tire of Moto</span></a>';
const TOGGLE = '<button class="nav-toggle" aria-label="Toggle menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"></path></svg></button>';
const MOBILE_SEARCH = '<li class="nav-search-mobile"><form action="/search/" method="get"><input type="search" name="q" placeholder="Search articles…" aria-label="Search articles"></form></li>';
const MENU = `<ul class="navbar-menu"><li><a href="/">Home</a></li><li><a href="/about/">About</a></li><li><a href="/tags/">Tags</a></li><li><a href="/contact/">Contact</a></li>${MOBILE_SEARCH}</ul>`;
const SEARCH = '<div class="navbar-search"><form action="/search/" method="get"><input type="search" name="q" placeholder="Search articles…" aria-label="Search articles"></form></div>';
const MENU_STYLE = '<style>.nav-search-mobile{display:none}@media(max-width:768px){.navbar .navbar-menu.open{align-items:stretch}.navbar .navbar-menu.open .nav-search-mobile{display:block;padding:4px 4px 8px}.nav-search-mobile input{box-sizing:border-box;width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;color:#1f2937;background:#fff}}</style>';

export const NAV_HTML = `<nav class="navbar"><div class="container">${BRAND}${TOGGLE}${MENU}${SEARCH}</div>${MENU_STYLE}</nav>`;

const NAV_RE = /<nav class="navbar">[\s\S]*?<\/nav>/;
const SITE_HEADER_RE = /<header class="site-header">[\s\S]*?<\/header>/;
const BODY_RE = /<body[^>]*>/;

// Standalone tool pages do not load the site stylesheet, so carry the header
// styles with them. Margins pull the bar out of the page's inline max-width.
const HEADER_STYLE = `<style id="site-navbar-style">
.navbar{--bg:#f8f9fa;--bg-alt:#fff;--text:#1f2937;--text-muted:#6b7280;--brand:#16a34a;--border:#e5e7eb;--shadow-sm:0 1px 2px rgba(0,0,0,.05);--shadow-md:0 4px 12px rgba(0,0,0,.08);--radius-sm:8px;--max-w:1120px;--nav-h:64px;box-sizing:border-box;position:sticky;top:0;z-index:100;background:var(--bg-alt);border-bottom:1px solid var(--border);height:var(--nav-h);box-shadow:var(--shadow-sm);margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.navbar *{box-sizing:border-box}
.navbar .container{max-width:var(--max-w);width:100%;margin:0 auto;padding:0 20px;display:flex;align-items:center;justify-content:space-between;height:100%;gap:16px}
.navbar .navbar-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;letter-spacing:-.3px;color:var(--text);text-decoration:none}
.navbar .logo-icon{width:36px;height:36px;border-radius:50%;background:var(--brand);flex-shrink:0;display:block}
.navbar .nav-toggle{display:none;background:none;border:none;cursor:pointer;padding:8px;color:var(--text)}
.navbar .nav-toggle svg{width:24px;height:24px}
.navbar .navbar-menu{display:flex;align-items:center;gap:8px;list-style:none;margin:0;padding:0}
.navbar .navbar-menu a{display:block;padding:8px 14px;border-radius:var(--radius-sm);color:var(--text-muted);font-size:14px;font-weight:500;text-decoration:none}
.navbar .navbar-menu a:hover{color:var(--text);background:var(--bg)}
.navbar .navbar-search{display:flex;align-items:center;gap:8px}
.navbar .navbar-search input{padding:8px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:#fff;color:var(--text);font-size:14px;width:200px;outline:none}
.navbar .navbar-search input:focus{border-color:var(--brand);width:240px}
@media(max-width:768px){
.navbar .navbar-menu{display:none}
.navbar .navbar-search{display:none}
.navbar .nav-toggle{display:block}
.navbar .navbar-menu.open{display:flex;flex-direction:column;position:absolute;top:var(--nav-h);left:0;right:0;background:var(--bg-alt);border-bottom:1px solid var(--border);padding:12px;box-shadow:var(--shadow-md)}
}
</style>`;

const MAIN_JS = '<script src="/js/main.js"></script>';
const HEADER_STYLE_RE = /<style id="site-navbar-style">[\s\S]*?<\/style>/;
const bleedStyle = (offset) => `<style id="site-navbar-bleed">body>.navbar{margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);margin-top:-${offset}px}</style>`;
const BLEED_RE = /<style id="site-navbar-bleed">[\s\S]*?<\/style>/;

export function normalizeNavbar(root) {
  const counts = { full: 0, brandOnly: 0, siteHeader: 0, noHeader: 0, files: 0, jsAdded: 0, jsRemoved: 0, cssAdded: 0 };

  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (name === 'dist' || name === 'node_modules' || name.startsWith('.')) continue;
      const stat = statSync(path);
      if (stat.isDirectory()) { walk(path); continue; }
      if (!name.endsWith('.html')) continue;
      let html = readFileSync(path, 'utf8');
      const original = html;
      let standalone = false;

      const nav = html.match(NAV_RE);
      if (nav) {
        if (!nav[0].includes('navbar-menu')) counts.brandOnly += 1;
        else counts.full += 1;
        if (nav[0] !== NAV_HTML) html = html.replace(nav[0], NAV_HTML);
      } else if (SITE_HEADER_RE.test(html)) {
        counts.siteHeader += 1;
        standalone = true;
        html = html.replace(SITE_HEADER_RE, NAV_HTML);
      } else if (BODY_RE.test(html)) {
        counts.noHeader += 1;
        standalone = true;
        html = html.replace(BODY_RE, (m) => m + NAV_HTML);
      } else {
        continue;
      }

      // Standalone pages need the header styles inlined.
      if (standalone || (!html.includes('/css/style.css') && !html.includes('_astro/_slug_'))) {
        if (!HEADER_STYLE_RE.test(html)) {
          html = html.replace('</head>', HEADER_STYLE + '</head>');
          counts.cssAdded += 1;
        }
      }

      // Pages that set a max-width on <body> need the bar pulled back out to
      // the full viewport so the header lines up with the rest of the site.
      const bodyTag = html.match(BODY_RE);
      if (bodyTag && /style="[^"]*max-width/.test(bodyTag[0])) {
        const pad = /padding:\s*(\d+)px/.exec(bodyTag[0]);
        const style = bleedStyle(pad ? pad[1] : 0);
        if (BLEED_RE.test(html)) {
          html = html.replace(BLEED_RE, style);
        } else {
          html = html.replace('</head>', style + '</head>');
        }
      }

      // Pages generated from the article template already carry their own
      // nav-toggle handler; adding main.js there would toggle twice.
      const hasInlineToggle = html.includes('.nav-toggle');
      if (hasInlineToggle) {
        if (html.includes(MAIN_JS)) {
          html = html.replace(MAIN_JS, '');
          counts.jsRemoved += 1;
        }
      } else if (!html.includes('/js/main.js')) {
        html = html.replace('</body>', MAIN_JS + '</body>');
        counts.jsAdded += 1;
      }

      if (html !== original) {
        writeFileSync(path, html);
        counts.files += 1;
      }
    }
  }

  walk(root);
  return counts;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.argv[2] || join(fileURLToPath(new URL('..', import.meta.url)));
  const c = normalizeNavbar(root);
  console.log(`navbar: full ${c.full}, brand-only ${c.brandOnly}, site-header ${c.siteHeader}, no-header ${c.noHeader}; ${c.files} files updated, js +${c.jsAdded}/-${c.jsRemoved}, css +${c.cssAdded}`);
}
