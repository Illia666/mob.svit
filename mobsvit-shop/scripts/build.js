// YML-фід постачальника → public/data/products.json (легкий список) + public/data/d/*.json (деталі)
// node scripts/build.js            — зібрати каталог
// node scripts/build.js --inspect  — показати структуру фіду
import fs from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';

const cfg = JSON.parse(await fs.readFile('config.json', 'utf8'));
const inspect = process.argv.includes('--inspect');
const ARR = new Set(['category', 'offer', 'picture', 'param']);
// processEntities:false — фід має >1000 сутностей (&quot; &nbsp;), їх розкодовуємо самі
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: false, isArray: (n) => ARR.has(n) });

const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const text = (v) => decode((v && typeof v === 'object' ? v['#text'] ?? '' : v ?? '').toString().trim());
const strip = (h) => decode(text(h).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const num = (v) => Number(text(v).replace(/\s/g, '').replace(',', '.')) || 0;
const sell = (base) => Math.ceil((base * (1 + cfg.markupPercent / 100)) / cfg.roundTo) * cfg.roundTo;
const shard = (id) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 100; // та сама функція є в app.js

async function load(src, i) {
  const cache = `feeds/cache-${i}.xml`;
  if (!/^https?:/.test(src)) return fs.readFile(src, 'utf8');
  try {
    const r = await fetch(src, { headers: { 'User-Agent': cfg.userAgent } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    await fs.mkdir('feeds', { recursive: true });
    await fs.writeFile(cache, xml);
    return xml;
  } catch (e) {
    console.warn(`⚠ ${src}: ${e.message} — беру кеш ${cache}`);
    return fs.readFile(cache, 'utf8');
  }
}

const cats = new Map(), products = [], det = {};
let skipped = 0;

for (const [i, src] of cfg.feeds.entries()) {
  const shop = parser.parse(await load(src, i)).yml_catalog?.shop;
  if (!shop) throw new Error(`${src}: немає yml_catalog/shop — це не YML-фід`);
  const offers = shop.offers?.offer ?? [];

  if (inspect) {
    console.log('Категорій:', shop.categories?.category?.length, '| Офферів:', offers.length);
    console.log('Перша категорія:', JSON.stringify(shop.categories?.category?.[0]));
    console.log('Перший offer:', JSON.stringify(offers[0], null, 2));
    continue;
  }

  for (const c of shop.categories?.category ?? []) {
    const id = String(c['@_id']);
    cats.set(id, { id, name: text(c), parentId: c['@_parentId'] ? String(c['@_parentId']) : null });
  }

  for (const o of offers) {
    const rate = cfg.rates[text(o.currencyId) || 'UAH'];
    const base = num(o.price) * (rate || 0);
    if (!base) { skipped++; continue; }

    const id = String(o['@_id']); // кожен оффер = окремий товар (колір уже в назві)
    const par = {};
    for (const p of o.param ?? []) if (typeof p === 'object') par[decode(String(p['@_name']))] = text(p);
    delete par['Категорія'];
    const pics = (o.picture ?? []).map(text).filter(Boolean).slice(0, 8);
    const old = num(o.oldprice ?? o.price_old) * rate;

    products.push({
      id,
      name: text(o.name) || [text(o.vendor), text(o.model)].filter(Boolean).join(' '),
      brand: text(o.vendor),
      sku: text(o.vendorCode),
      category: text(o.categoryId),
      price: sell(base),
      oldPrice: old > base ? sell(old) : 0,
      img: pics[0] || '',
      available: String(o['@_available']) !== 'false',
    });
    (det[shard(id)] ??= {})[id] = { images: pics, description: strip(o.description).slice(0, 800), params: par };
  }
}

if (!inspect) {
  await fs.rm('public/data', { recursive: true, force: true });
  await fs.mkdir('public/data/d', { recursive: true });
  await fs.writeFile('public/data/products.json',
    JSON.stringify({ updated: new Date().toISOString(), categories: [...cats.values()], products }));
  for (const [n, obj] of Object.entries(det)) await fs.writeFile(`public/data/d/${n}.json`, JSON.stringify(obj));
  console.log(`✔ ${products.length} товарів, ${cats.size} категорій (пропущено без ціни/валюти: ${skipped})`);
}
