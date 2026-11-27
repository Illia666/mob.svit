import fs from 'node:fs';
import zlib from 'node:zlib';

const FEED_URLS = [
  'https://itsellopt.ua/price_lists/prom.xml',
  'https://itsellopt.ua/price_lists/hydrogel.xml',
  'https://itsellopt.ua/price_lists/iPrint_ppc_price_t3_uah.xml'
];

function decodeEntities(str = '') {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function getTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

// Іноді у <vendor> потрапляє артикул або залишки XML — прибираємо це
function cleanBrand(b = '', name = '') {
  const v = String(b).replace(/<.*$/s, '').trim();
  if (!v || /^\d+$/.test(v)) return /itsprint/i.test(name) ? 'itsPrint' : '';
  return v;
}
function cleanSku(v = '') {
  return String(v).replace(/<.*$/s, '').trim();
}

function getAllTags(block, tag) {
  const matches = [...block.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))];
  return matches.map((m) => decodeEntities(m[1])).filter(Boolean);
}

function parseFeedXml(xml, categoriesMap, productsMap) {
  // 1. Категорії
  for (const m of xml.matchAll(/<category\b([^>]*)>([\s\S]*?)<\/category>/gi)) {
    const attrs = m[1];
    const name = decodeEntities(m[2]);
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    const parentMatch = attrs.match(/\bparentId=["']([^"']+)["']/i);
    if (idMatch && name && !categoriesMap.has(idMatch[1])) {
      categoriesMap.set(idMatch[1], {
        id: idMatch[1],
        name,
        parentId: parentMatch ? parentMatch[1] : null
      });
    }
  }

  // 2. Товари (<offer ...>...</offer>)
  let added = 0;
  for (const m of xml.matchAll(/<offer\b([^>]*)>([\s\S]*?)<\/offer>/gi)) {
    const attrs = m[1];
    const body = m[2];
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    const availMatch = attrs.match(/\bavailable=["']([^"']+)["']/i);

    const id = idMatch ? idMatch[1] : getTag(body, 'vendorCode');
    const name = getTag(body, 'name') || getTag(body, 'model');
    const brand = cleanBrand(getTag(body, 'vendor'), getTag(body, 'name') || getTag(body, 'model'));
    const sku = cleanSku(getTag(body, 'vendorCode'));
    const category = getTag(body, 'categoryId') || 'other';
    const price = Number(getTag(body, 'price').replace(/\s+/g, '').replace(',', '.')) || 0;
    const oldRaw = ['oldprice', 'price_old', 'old_price', 'priceold'].map((t) => getTag(body, t)).find(Boolean) || '';
    const oldPrice = Number(oldRaw.replace(/\s+/g, '').replace(',', '.')) || 0;
    const pictures = getAllTags(body, 'picture');
    const available = availMatch ? availMatch[1].toLowerCase() === 'true' : true;

    if (!id || !name) continue;

    const prev = productsMap.get(id);
    const isItsPrint = /itsprint/i.test(name) || /^itsprint$/i.test(brand);
    const finalPrice = isItsPrint ? 249 : (price || prev?.price || 0);
    const finalOldPrice = isItsPrint ? 399 : (oldPrice > price ? oldPrice : (prev?.oldPrice || 0));

    productsMap.set(id, {
      id,
      name,
      brand: brand || prev?.brand || '',
      sku: sku || prev?.sku || '',
      category: category !== 'other' ? category : (prev?.category || 'other'),
      price: finalPrice,
      oldPrice: finalOldPrice,
      img: pictures[0] || prev?.img || '',
      available: prev ? (prev.available || available) : available
    });
    added++;
  }
  return added;
}

const IMG_BASE = 'https://itsellopt.ua/uploads/';
const CHUNK = 12000; // товарів в одному файлі

const TODAY = Math.floor(Date.now() / 864e5);   // номер дня (для «новинок» і «надходжень»)
const SALE_DAYS = 14;   // скільки днів показувати «знижку» після падіння ціни
const SALE_MIN = 0.03;  // мінімальне падіння ціни (3%), щоб вважати це знижкою

// Читаємо попередню версію каталогу, щоб знати, що зʼявилось нового
function readPrev(dir) {
  try {
    const idx = JSON.parse(fs.readFileSync(`${dir}/index.json`, 'utf8'));
    const prev = new Map();
    for (const f of idx.parts) {
      for (const r of JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'))) prev.set(r[0], r);
    }
    return prev;
  } catch {
    return null;
  }
}

// Компактний формат: рядки-масиви замість об'єктів, відносні URL фото, шматки по CHUNK.
// Рядок: [id, name, brand, sku, category, price, oldPrice, img, available(1/0),
//         firstSeenDay, restockDay, saleDay]
//   firstSeenDay — день, коли товар вперше зʼявився у прайсі (0 = невідомо, на першому запуску)
//   restockDay   — день, коли товар знову зʼявився в наявності
//   saleDay      — день, коли зʼявилась знижка (стара ціна у полі oldPrice)
function writeData(categories, products, dir = 'data') {
  const prev = readPrev(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let fresh = 0, restocked = 0, onSale = 0;
  const rows = products.map((p) => {
    const old = prev?.get(p.id);
    const avail = p.available ? 1 : 0;
    let firstSeen = 0, restock = 0;
    if (prev) {
      firstSeen = old ? old[9] || 0 : TODAY;
      restock = old ? old[10] || 0 : 0;
      if (old && old[8] === 0 && avail === 1) restock = TODAY;
    }
    if (firstSeen === TODAY) fresh++;
    if (restock === TODAY) restocked++;
    // Знижка: стара ціна з фіду, а якщо її нема — попередня ціна, коли товар подешевшав
    const isItsPrint = /itsprint/i.test(p.name || '') || /^itsprint$/i.test(p.brand || '');
    const price = isItsPrint ? 249 : (p.price || 0);
    let oldP = isItsPrint ? 399 : (p.oldPrice || 0), drop = 0;
    if (oldP > price) {
      drop = old && old[6] === oldP && old[11] ? old[11] : TODAY;
    } else {
      oldP = 0;
      if (old && price > 0) {
        if (old[5] > price * (1 + SALE_MIN)) { oldP = old[5]; drop = TODAY; }
        else if (old[6] > price && old[11] && TODAY - old[11] <= SALE_DAYS) { oldP = old[6]; drop = old[11]; }
      }
    }
    if (oldP && drop === TODAY) onSale++;
    return [
      p.id, p.name, p.brand || '', p.sku || '', p.category, price, oldP,
      p.img && p.img.startsWith(IMG_BASE) ? p.img.slice(IMG_BASE.length) : p.img || '',
      avail, firstSeen, restock, drop
    ];
  });
  console.log(prev ? `Нових товарів: ${fresh}, повернулись у наявність: ${restocked}, подешевшало: ${onSale}` : 'Перший запуск: історії ще немає');
  const parts = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const file = `products-${parts.length + 1}.json`;
    const json = JSON.stringify(rows.slice(i, i + CHUNK));
    fs.writeFileSync(`${dir}/${file}`, json, 'utf8');
    fs.writeFileSync(`${dir}/${file}.gz`, zlib.gzipSync(json, { level: 9 })); // для серверів без автостиснення
    parts.push(file);
  }
  fs.writeFileSync(`${dir}/index.json`, JSON.stringify({
    updated: new Date().toISOString(), imgBase: IMG_BASE, categories, parts, total: rows.length
  }), 'utf8');
  const kb = (f) => (fs.statSync(`${dir}/${f}`).size / 1024).toFixed(0);
  console.log(`Записано ${rows.length} товарів у ${parts.length} файлів (${parts.map((f) => kb(f) + ' КБ').join(', ')})`);
}

// Режим конвертації без мережі: node sync_itsell.mjs --from-json products.json
const fromIdx = process.argv.indexOf('--from-json');
if (fromIdx > -1) {
  const old = JSON.parse(fs.readFileSync(process.argv[fromIdx + 1] || 'products.json', 'utf8'));
  writeData(old.categories, old.products);
  process.exit(0);
}

const categoriesMap = new Map();
const productsMap = new Map();
let okFeeds = 0;

for (const url of FEED_URLS) {
  console.log(`Завантажую ${url}...`);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MobilSvitSync/1.0)' } });
    if (!res.ok) { console.warn(`Пропущено ${url}: HTTP ${res.status}`); continue; }
    const count = parseFeedXml(await res.text(), categoriesMap, productsMap);
    okFeeds++;
    console.log(`Оброблено ${count} позицій із ${url}`);
  } catch (e) {
    console.warn(`Пропущено ${url}: ${e.message}`);
  }
}

// Не перезаписуємо каталог, якщо якийсь фід не завантажився: інакше товари «зникнуть» з сайту
if (okFeeds < FEED_URLS.length) {
  throw new Error(`Завантажилось ${okFeeds} із ${FEED_URLS.length} фідів — дані не оновлено`);
}
if (productsMap.size === 0) throw new Error('Жодного товару не завантажено з жодного фіду');

writeData([...categoriesMap.values()], [...productsMap.values()]);
