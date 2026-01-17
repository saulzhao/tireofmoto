export const prerender = true;

export const GET = async ({ site }) => {
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
    .map(
      (p) => `
  <item>
    <title><![CDATA[${p.title}]]></title>
    <link>${site}posts/${p.slug}</link>
    <guid>${site}posts/${p.slug}</guid>
    <pubDate>${new Date(p.pubDate + "T00:00:00Z").toUTCString()}</pubDate>
    <description><![CDATA[${p.description}]]></description>
  </item>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Tire of Moto</title>
  <link>${site}</link>
  <description>Motorcycle tires & inner tubes blog</description>
  ${items}
</channel>
</rss>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
