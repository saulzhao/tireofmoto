// 部署后把网址提交给 IndexNow（Bing 等支持该协议的搜索引擎）。
//   node scripts/indexnow.mjs              # 提交 sitemap.xml 里的全部网址
//   node scripts/indexnow.mjs <url> [...]  # 只提交指定网址
const HOST = 'https://tireofmoto.com';
const KEY = 'tomindexnow2026';
const KEY_LOCATION = `${HOST}/${KEY}.txt`;

let urls = process.argv.slice(2);
if (!urls.length) {
  const res = await fetch(`${HOST}/sitemap.xml`);
  urls = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}
urls = [...new Set(urls)].filter((u) => u.startsWith(HOST));

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'tireofmoto.com', key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
});
console.log(`IndexNow ${res.status} ${res.statusText} — ${urls.length} URLs`);
process.exit(res.ok ? 0 : 1);
