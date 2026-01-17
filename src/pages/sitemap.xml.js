export const prerender = true;

export async function GET() {
  const base = (import.meta.env.SITE || "https://tireofmoto.com/").replace(/\/?$/, "/");

  const modules = import.meta.glob("../content/posts/*.md", { eager: true });

  const postUrls = Object.values(modules).map((m) => {
    const slug = m.file.split("/").pop().replace(".md", "");
    return `${base}posts/${slug}/`;
  });

  const urls = [
    base,
    `${base}about/`,
    ...postUrls,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
