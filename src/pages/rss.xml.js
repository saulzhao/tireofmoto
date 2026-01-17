export const prerender = true;

function xmlEscape(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  // 优先用 astro.config.mjs 的 site（import.meta.env.SITE），没有就用你的域名兜底
  const base = (import.meta.env.SITE || "https://tireofmoto.com/").replace(/\/?$/, "/");

  const modules = import.meta.glob("../content/posts/*.md", { eager: true });

  const posts = Object.values(modules)
    .map((m) => ({
      title: m.frontmatter?.title ?? "",
      description: m.frontmatter?.description ?? "",
      pubDate: String(m.frontmatter?.pubDate ?? "").slice(0, 10),
      slug: m.file.split("/").pop().replace(".md", ""),
    }))
    .sort((a, b) => (b.pubDate > a.pubDate ? 1 : -1));

  const items = posts
    .map((p) => {
      const link = `${base}posts/${p.slug}/`;
      const pub = new Date(`${p.pubDate}T00:00:00Z`).toUTCString();
      return `
  <item>
    <title>${xmlEscape(p.title)}</title>
    <link>${xmlEscape(link)}</link>
    <guid>${xmlEscape(link)}</guid>
    <pubDate>${xmlEscape(pub)}</pubDate>
    <description>${xmlEscape(p.description)}</description>
  </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${xmlEscape("Tire of Moto")}</title>
  <link>${xmlEscape(base)}</link>
  <description>${xmlEscape("Motorcycle tires & inner tubes blog")}</description>
  ${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
