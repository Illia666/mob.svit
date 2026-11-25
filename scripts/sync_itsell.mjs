import fs from 'node:fs';

const FEED_URLS = [
  'https://itsellopt.ua/price_lists/prom.xml',
  'https://itsellopt.ua/price_lists/general_price_damskii_uk.xml',
  'https://itsellopt.ua/price_lists/hydrogel.xml'
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
    const brand = getTag(body, 'vendor');
    const sku = getTag(body, 'vendorCode');
    const category = getTag(body, 'categoryId') || 'other';
    const price = Number(getTag(body, 'price').replace(/\s+/g, '').replace(',', '.')) || 0;
    const oldPrice = Number(getTag(body, 'oldprice').replace(/\s+/g, '').replace(',', '.')) || 0;
    const pictures = getAllTags(body, 'picture');
    const available = availMatch ? availMatch[1].toLowerCase() === 'true' : true;

    if (!id || !name) continue;

    // Якщо товар уже є з попереднього фіду, зберігаємо наявність true і не втрачаємо фото
    const prev = productsMap.get(id);
    productsMap.set(id, {
      id,
      name,
      brand: brand || prev?.brand || '',
      sku: sku || prev?.sku || '',
      category: category !== 'other' ? category : (prev?.category || 'other'),
      price: price || prev?.price || 0,
      oldPrice: oldPrice > price ? oldPrice : (prev?.oldPrice || 0),
      img: pictures[0] || prev?.img || '',
      available: prev ? (prev.available || available) : available
    });
    added++;
  }
  return added;
}

const categoriesMap = new Map();
const productsMap = new Map();

for (const url of FEED_URLS) {
  console.log(`Завантажую ${url}...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MobilSvitSync/1.0)' }
  });
  if (!res.ok) {
    console.warn(`Пропущено ${url}: HTTP ${res.status}`);
    continue;
  }
  const xml = await res.text();
  const count = parseFeedXml(xml, categoriesMap, productsMap);
  console.log(`Оброблено ${count} позицій із ${url}`);
}

if (productsMap.size === 0) {
  throw new Error('Жодного товару не завантажено з жодного фіду');
}

const out = {
  updated: new Date().toISOString(),
  categories: [...categoriesMap.values()],
  products: [...productsMap.values()]
};

fs.writeFileSync('products.json', JSON.stringify(out), 'utf8');
console.log(`Готово! Усього унікальних товарів у products.json: ${out.products.length}, категорій: ${out.categories.length}`);