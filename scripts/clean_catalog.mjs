import fs from "fs";
import path from "path";

const INPUT_PATH = path.resolve("products.json");
const BACKUP_PATH = path.resolve("products.backup.json");
const OUTPUT_PATH = path.resolve("products.json");

// Популярні назви кольорів (українською, російською та англійською) для визначення варіантів
const COLORS = [
  "Black", "White", "Red", "Blue", "Navy", "Midnight Blue", "Sky Blue", "Light Blue",
  "Green", "Mint", "Olive", "Gray", "Grey", "Silver", "Gold", "Rose Gold",
  "Pink", "Purple", "Violet", "Lilac", "Lavender", "Brown", "Marsala", "Beige",
  "Sand", "Orange", "Yellow", "Coral", "Burgundy", "Wine", "Cyan", "Teal", "Transparent", "Clear",
  "Чорний", "Білий", "Червоний", "Синій", "Темно-синій", "Блакитний", "Зелений", "М'ятний",
  "Сірий", "Сріблястий", "Золотий", "Рожевий", "Фіолетовий", "Бузковий", "Коричневий",
  "Марсала", "Бежевий", "Пісочний", "Помаранчевий", "Жовтий", "Кораловий", "Бордовий", "Прозорий",
  "Черный", "Белый", "Красный", "Синий", "Темно-синий", "Голубой", "Зеленый", "Зелёный",
  "Мятный", "Серый", "Серебристый", "Золотой", "Розовый", "Фиолетовый", "Сиреневый",
  "Коричневый", "Марсала", "Бежевый", "Песочный", "Оранжевый", "Желтый", "Жёлтый",
  "Коралловый", "Бордовый", "Прозрачный"
];

const colorRegex = new RegExp(
  `\\b(${COLORS.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|")})\\b`,
  "gi"
);

function stripXmlNoise(value) {
  if (typeof value !== "string") return value;
  return value
    // Відрізаємо хвіст із сирими XML-тегами як на скріншоті з плівками SKLO
    .replace(/<\/?[a-zA-Z0-9_:-]+(?:\s+[^>]*)?>[\s\S]*$/g, "")
    .replace(/<\/?[a-zA-Z0-9_:-]+(?:\s+[^>]*)?>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanItemStrings(item) {
  const cleaned = { ...item };
  for (const [key, val] of Object.entries(cleaned)) {
    if (typeof val === "string") {
      cleaned[key] = stripXmlNoise(val);
    }
  }
  return cleaned;
}

function extractColorAndBaseTitle(title = "") {
  const matches = [...title.matchAll(colorRegex)];
  const detectedColor = matches.length ? matches[matches.length - 1][0].trim() : null;
  const baseTitle = title
    .replace(colorRegex, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*\/\s*$/g, "")
    .trim();

  return { baseTitle, detectedColor };
}

function buildGroupKey(item, baseTitle) {
  const sku = String(item.sku ?? item.vendorCode ?? item.article ?? item.id ?? "").trim();
  const brand = String(item.vendor ?? item.brand ?? "").trim().toLowerCase();
  const category = String(item.category ?? item.categoryId ?? "").trim().toLowerCase();
  const price = String(item.price ?? "").trim();

  return `${sku.toLowerCase()}||${brand}||${category}||${price}||${baseTitle.toLowerCase()}`;
}

function run() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error("Не знайдено products.json у поточній папці:", INPUT_PATH);
    process.exit(1);
  }

  fs.copyFileSync(INPUT_PATH, BACKUP_PATH);
  console.log("Створено резервну копію:", BACKUP_PATH);

  const raw = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));
  const list = Array.isArray(raw) ? raw : Array.isArray(raw.products) ? raw.products : null;

  if (!list) {
    console.error("Не підтримується структура products.json (очікувався масив або { products: [...] }).");
    process.exit(1);
  }

  const groups = new Map();

  for (const rawItem of list) {
    const item = cleanItemStrings(rawItem);
    const title = item.name ?? item.title ?? "";
    const { baseTitle, detectedColor } = extractColorAndBaseTitle(title);
    const key = buildGroupKey(item, baseTitle || title);

    const variantColor = item.color || detectedColor || "Standard";
    const variantImage = item.image || item.picture || item.img || null;
    const variantStock = item.stock ?? item.available ?? item.inStock ?? true;

    const variant = {
      color: variantColor,
      image: variantImage,
      stock: variantStock,
      sku: item.sku ?? item.vendorCode ?? item.id ?? null,
      price: item.price ?? null
    };

    if (!groups.has(key)) {
      groups.set(key, {
        ...item,
        name: baseTitle || title,
        colors: [variantColor],
        variants: [variant]
      });
    } else {
      const existing = groups.get(key);
      if (!existing.colors.includes(variantColor)) {
        existing.colors.push(variantColor);
      }
      existing.variants.push(variant);
    }
  }

  const mergedList = Array.from(groups.values());
  const finalData = Array.isArray(raw) ? mergedList : { ...raw, products: mergedList };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalData, null, 2), "utf8");

  console.log(`Було позицій: ${list.length}`);
  console.log(`Стало позицій після об'єднання: ${mergedList.length}`);
  console.log(`Збережено у: ${OUTPUT_PATH}`);
}

run();