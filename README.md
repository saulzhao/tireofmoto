# tireofmoto.com

Static site for https://tireofmoto.com, built with plain HTML/CSS/JS.

- `npm run build` copies the site files into `dist/` (see `build.mjs`).
- Cloudflare Pages: build command `npm run build`, output directory `dist`.
- Add a post by creating `posts/<YYYY-MM-DD>-<slug>/index.html`, then updating
  `index.html`, `tags/index.html`, `sitemap.xml`, `sitemap.xml.gz`, `search.json`
  and `rss.xml`.
