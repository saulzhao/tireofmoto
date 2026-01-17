export const prerender = true;

export const GET = async ({ site }) => {
  const modules = import.meta.glob("../content/posts/*.md", { eager: true });

  const urls = Object.values(modules).map((m) => {
    const slug = m.file.split("/").pop().replace(".md", "");
    return `${site}posts/${slug}`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${site}</loc></url>
  <url><loc>${site}about</loc></url>
  <url><loc>${site}tags</loc></url>
  ${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}
</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
