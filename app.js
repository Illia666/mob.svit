const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('uk-UA') + ' грн';
const PAGE = 36;

const st = {
  q: '', cat: '', stock: true, sort: '', page: 1,
  activeBrand: null, menuSort: 'default', menuFilter: '',
  exactModel: '', type: '', typeCounts: null,
  color: '', colorCounts: null, home: false,
  // side mega filters
  sideMega: null,
  fGadget: '',   // brand of phone (Apple/Samsung...)
  fBrand: '',    // accessory brand
  fMaterial: '', // silicone/leather...
  fKind: ''      // case type / glass type keyword
};

const COLOR_WORDS = [
  'чорний', 'чорна', 'черный', 'черная',
  'білий', 'біла', 'белый', 'белая',
  'червоний', 'червона', 'красный', 'красная',
  'синій', 'синя', 'синий', 'синяя',
  'темно-синій', 'темно-синя', 'темно-синий', 'темно-синяя',
  'світло-синій', 'світло-синя', 'светло-синий', 'светло-синяя',
  'темно-зелений', 'темно-зелена', 'темно-зеленый', 'темно-зеленая',
  'зелений', 'зелена', 'зеленый', 'зеленая',
  'сірий', 'сіра', 'серый', 'серая',
  'жовтий', 'жовта', 'желтый', 'желтая',
  'рожевий', 'рожева', 'розовый', 'розовая',
  'бордовий', 'бордова', 'бордовый', 'бордовая',
  'фіолетовий', 'фіолетова', 'фиолетовый', 'фиолетовая',
  'ліловий', 'лілова', 'лиловый', 'лиловая',
  'бузковий', 'бузкова', 'сиреневый', 'сиреневая',
  'бірюзовий', 'бірюзова', 'бирюзовый', 'бирюзовая',
  "м'ятний", "м'ятна", 'м’ятний', 'м’ятна', 'мятный', 'мятная',
  'салатовий', 'салатова', 'салатовый', 'салатовая',
  'фісташковий', 'фісташкова', 'фисташковый', 'фисташковая',
  'блакитний', 'блакитна', 'голубой', 'голубая',
  'золотий', 'золота', 'золотой', 'золотая',
  'коричневий', 'коричнева', 'коричневый', 'коричневая',
  'помаранчевий', 'помаранчева', 'оранжевый', 'оранжевая',
  'прозорий', 'прозора', 'прозрачный', 'прозрачная',
  'безбарвний', 'безбарвна', 'бесцветный', 'бесцветная',
  'rose gold', 'space gray', 'space grey', 'midnight green', 'pacific blue', 'sierra blue', 'alpine green',
  'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'violet', 'lilac',
  'grey', 'gray', 'orange', 'brown', 'gold', 'silver', 'beige', 'mint', 'sand', 'rose', 'midnight', 'marsala'
];

const COLOR_PATTERN = COLOR_WORDS
  .map((w) => String(w || '').trim())
  .filter(Boolean)
  .sort((a, b) => b.length - a.length) // longer first for better matching
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'))
  .join('|');

const COLOR_TOKEN_RE = new RegExp(`^(?:${COLOR_PATTERN})$`, 'i');

function cleanProductTitle(name) {
  return String(name || '')
    .replace(/\s*[\/|]\s*(?:standard|стандарт)$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTrailingColor(rawText) {
  const s = cleanProductTitle(rawText);
  if (!s) return '';

  const words = s.split(/\s+/);
  for (let len = Math.min(3, words.length); len >= 1; len--) {
    const tail = words.slice(-len).join(' ').replace(/^[(\[\s\-–—/,+]+|[)\]\s\-–—/,+]+$/g, '').trim();
    if (!tail) continue;

    if (COLOR_TOKEN_RE.test(tail)) {
      return tail;
    }

    const comboParts = tail.split(/\s*(?:\/|–|—|\+)\s*/).map((x) => x.trim()).filter(Boolean);
    if (comboParts.length > 1 && comboParts.every((part) => COLOR_TOKEN_RE.test(part))) {
      return comboParts.join(' / ');
    }
  }

  const dashMatch = s.match(/(?:\s+[—–-]\s+|\s+-\s+)([А-ЯІЇЄҐA-Z][а-яіїєґa-z'’\-]{1,22})$/);
  if (dashMatch && dashMatch[1] && !/^(pro|max|plus|ultra|lite|mini|air|neo|fe|se|gt)$/i.test(dashMatch[1])) {
    return dashMatch[1].trim();
  }

  return '';
}

function baseName(p) {
  const n = cleanProductTitle(p.name);
  if (!n) return '';

  const col = extractTrailingColor(n);
  if (col) {
    const escapedCol = col
      .replace(/\s*\/\s*/g, '\\s*(?:\\/|\\-|–|—|\\+)\\s*')
      .replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === '\\s*' || m === '\\s+' ? m : `\\${m}`))
      .replace(/\s+/g, '\\s+');
    const stripped = n
      .replace(new RegExp(`(?:\\s+(?:—|–|-|\/|,)\\s+|\\s+)${escapedCol}$`, 'i'), '')
      .trim();
    if (stripped) return stripped;
  }

  return n;
}

function variantLabel(p) {
  const fromName = extractTrailingColor(p.name);
  if (fromName) return fromName;

  const candidates = [
    ...(Array.isArray(p.colors) ? p.colors : []),
    p.color,
    p.design,
    p.variants?.[0]?.color,
    p.variants?.[0]?.design
  ];

  for (const cand of candidates) {
    const val = String(cand || '').trim();
    if (!val || /^(standard|стандарт)$/i.test(val)) continue;
    const onlyColor = extractTrailingColor(val);
    if (onlyColor) return onlyColor;
    const matched = val.match(new RegExp(`\\b(?:${COLOR_PATTERN})\\b`, 'i'))?.[0]?.trim();
    if (matched) return matched;
  }

  return 'Стандарт';
}

function buildVariantTitle(p, selectedColor) {
  const clean = cleanProductTitle(p.name);
  const base = baseName(p);
  const color = selectedColor || variantLabel(p);
  if (!color || color === 'Стандарт') return clean;
  return `${base} ${color}`.trim();
}

function collapseVariants(products) {
  const groups = new Map();
  for (const p of products) {
    // Group by cleaned base name + category so same model/design with different colors
    // become one card with in-card color selection (SKU alone would keep them separate).
    const base = baseName(p).toLowerCase().replace(/\s+/g, ' ').trim();
    const key = `${base}|${p.category || ''}|${(p.brand || '').toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return [...groups.values()].map((variants) => {
    // Prefer in-stock items, then cheapest as primary
    const available = variants.filter((p) => p.available);
    const sorted = (available.length ? available : variants).slice().sort((a, b) => a.price - b.price);
    const primary = sorted[0] || variants[0];
    const unique = [];
    const seen = new Set();
    for (const p of variants) {
      const label = variantLabel(p).toLowerCase();
      if (seen.has(label)) continue;
      seen.add(label);
      unique.push(p);
    }
    // Sort variants: available first, then by label
    unique.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return variantLabel(a).localeCompare(variantLabel(b), 'uk');
    });
    return {
      primary,
      variants: unique.length ? unique : variants,
      key: `g-${baseName(primary).toLowerCase().slice(0, 40)}-${primary.category || ''}`
    };
  });
}

let cart = JSON.parse(localStorage.getItem('cart') || '[]');
const save = () => {
  localStorage.setItem('cart', JSON.stringify(cart));
  if ($('#cartCount')) $('#cartCount').textContent = cart.reduce((a, i) => a + i.qty, 0);
};

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  return res.json();
}

async function loadDB() {
  try {
    const idx = await getJSON('data/index.json');
    const base = idx.imgBase || '';
    const chunks = await Promise.all(idx.parts.map((f) => getJSON('data/' + f)));
    const products = chunks.flat().map((r) => ({
      id: r[0], name: r[1], brand: r[2], sku: r[3], category: r[4], price: r[5], oldPrice: r[6],
      img: r[7] && !/^https?:/.test(r[7]) ? base + r[7] : r[7], available: r[8] === 1
    }));
    return { categories: idx.categories, products };
  } catch {
    // perekhodymo do staroho formatu
  }
  for (const url of ['products.json', 'data/products.json']) {
    try {
      const data = await getJSON(url);
      if (data && Array.isArray(data.products) && Array.isArray(data.categories)) return data;
    } catch {
      // nastupnyi shliakh
    }
  }
  return { categories: [], products: [] };
}

const DB = await loadDB();

const byId = new Map(), kids = new Map(), own = new Map();
DB.categories.forEach((c) => { c.name = toUkrainian(c.name); });
DB.products.forEach((p) => {
  p.available = p.available === true || p.available === 1 || p.available === '1' || String(p.available).toLowerCase() === 'true';
  p.price = Number(p.price || 0);
  p.oldPrice = Number(p.oldPrice || 0);
  p.name = toUkrainian(p.name);
  if (Array.isArray(p.colors)) p.colors = p.colors.map(toUkrainian);
  if (Array.isArray(p.variants)) p.variants = p.variants.map((v) => ({ ...v, color: toUkrainian(v.color) }));
  byId.set(p.id, p);
  p.s = `${p.name} ${toUkrainian(p.brand || '')} ${p.sku || ''}`.toLowerCase();
  own.set(p.category, (own.get(p.category) || 0) + 1);
});

const catById = new Map(DB.categories.map((c) => [c.id, c]));
DB.categories.forEach((c) => {
  if (c.parentId) kids.set(c.parentId, [...(kids.get(c.parentId) || []), c.id]);
});

const branch = (id) => [id, ...(kids.get(id) || []).flatMap(branch)];
const count = (id) => branch(id).reduce((a, i) => a + (own.get(i) || 0), 0);
const depth = (c) => {
  let d = 0;
  let curr = c;
  while (curr && curr.parentId && catById.get(curr.parentId)) {
    curr = catById.get(curr.parentId);
    d++;
  }
  return d;
};

if ($('#cat')) {
  const catOptions = DB.categories
    .filter((c) => count(c.id) > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      d: depth(c),
      cnt: count(c.id)
    }));

  $('#cat').insertAdjacentHTML(
    'beforeend',
    catOptions
      .map((c) => `<option value="${esc(c.id)}">${'— '.repeat(Math.min(c.d, 3))}${esc(c.name)} (${c.cnt})</option>`)
      .join('')
  );
}

// Full left catalog — all categories named like itsellopt
const SIDE_CATS = [
  { id: '320003', name: 'Дитячі гаджети / Ігри', icon: '🧸' },
  { id: '1', name: 'Чохли', icon: '📱' },
  { id: '178100', name: 'Скло / плівки', icon: '🪟' },
  { id: '2', name: 'Захист екрану', icon: '🛡' },
  { id: '275301', name: 'Ремінці / Футляри', icon: '⌚' },
  { id: '190703', name: 'Зарядні пристрої', icon: '🔌' },
  { id: '191103', name: 'Аудіо', icon: '🎧' },
  { id: '68303', name: 'Автоаксесуари', icon: '🚗' },
  { id: '68203', name: 'Кабелі / Перехідники', icon: '🔗' },
  { id: '178603', name: 'Для дому / Офісу', icon: '🏠' },
  { id: '3', name: 'Технічні / Загальні', icon: '📦' }
].filter((s) => catById.has(s.id) && count(s.id) > 0);

// Any extra top-level non-brand categories with products
const _sideIds = new Set(SIDE_CATS.map((s) => s.id));
const _brandTop = /Apple|Samsung|Xiaomi|Motorola|Google|Oppo|Infinix|Realme|Huawei|Honor|TECNO|OnePlus|ZTE|Nokia|Lenovo|Nothing|Blackview|Vivo|Sony|Umidigi|HMD/i;
DB.categories
  .filter((c) => !c.parentId && !_sideIds.has(c.id) && !_brandTop.test(c.name) && count(c.id) > 0)
  .forEach((c) => SIDE_CATS.push({ id: c.id, name: c.name, icon: '•' }));

function brandProductCount(brandName) {
  const key = brandName.toLowerCase();
  return DB.products.filter((p) => (p.brand || '').toLowerCase().includes(key) || p.s.includes(key)).length;
}

function renderBrandBadges() {
  document.querySelectorAll('#brandList button[data-brand]').forEach((btn) => {
    const brand = btn.dataset.brand;
    if (!brand || brand === 'More') return;
    const n = brandProductCount(brand);
    if (!n) return;
    let badge = btn.querySelector('.brand-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'brand-badge';
      btn.appendChild(badge);
    }
    badge.innerHTML = `<i class="b-in">${Math.min(n, 9999)}</i>`;
  });
}

function renderSideCats() {
  const box = $('#sideCats');
  if (!box) return;
  const items = [
    { id: '', name: 'Усі товари', icon: '☰' },
    ...SIDE_CATS.map((s) => {
      // prefer live name from catalog data
      const live = catById.get(s.id);
      return { ...s, name: live?.name || s.name };
    })
  ];
  box.innerHTML = items
    .map((s) => {
      const active = (st.cat || '') === s.id;
      const megaOpen = st.sideMega === s.id;
      const cnt = s.id ? count(s.id) : DB.products.length;
      return `<button type="button" class="side-cat${active ? ' active' : ''}${megaOpen ? ' mega-open' : ''}" data-side-cat="${esc(s.id)}">
        <span class="side-icon">${s.icon}</span>
        <span class="side-name">${esc(s.name)}</span>
        <span class="side-cnt">${cnt > 999 ? (Math.round(cnt / 1000) + 'k') : cnt}</span>
        <span class="side-arrow">›</span>
      </button>`;
    })
    .join('');
}

function openSideMega(catId) {
  if (!catId) {
    st.sideMega = null;
    renderSideMega();
    renderSideCats();
    return;
  }
  st.sideMega = catId;
  // selecting category filters products too
  st.cat = catId;
  st.exactModel = '';
  st.type = '';
  st.color = '';
  clearMegaFilters();
  st.page = 1;
  if ($('#cat')) $('#cat').value = st.cat;
  if ($('#activeModelBar')) $('#activeModelBar').hidden = true;
  renderSideCats();
  renderSideMega();
  render();
}

$('#sideCats')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-side-cat]');
  if (!btn) return;
  const id = btn.dataset.sideCat || '';
  if (!id) {
    // "Усі товари" — clear everything
    st.cat = '';
    st.sideMega = null;
    clearMegaFilters();
    st.exactModel = '';
    st.type = '';
    st.color = '';
    st.page = 1;
    if ($('#cat')) $('#cat').value = '';
    if ($('#activeModelBar')) $('#activeModelBar').hidden = true;
    renderSideCats();
    renderSideMega();
    render();
    return;
  }
  // toggle mega for same category
  if (st.sideMega === id) {
    st.sideMega = null;
    renderSideMega();
    renderSideCats();
    return;
  }
  openSideMega(id);
});

// Hover opens mega on desktop
let megaHoverTimer = null;
$('#sideCats')?.addEventListener('mouseover', (e) => {
  if (window.matchMedia('(max-width: 900px)').matches) return;
  const btn = e.target.closest('[data-side-cat]');
  if (!btn) return;
  const id = btn.dataset.sideCat || '';
  if (!id) return;
  clearTimeout(megaHoverTimer);
  megaHoverTimer = setTimeout(() => {
    if (st.sideMega !== id) {
      st.sideMega = id;
      renderSideCats();
      renderSideMega();
    }
  }, 120);
});

$('#sidebarWrap')?.addEventListener('mouseleave', () => {
  if (window.matchMedia('(max-width: 900px)').matches) return;
  clearTimeout(megaHoverTimer);
  megaHoverTimer = setTimeout(() => {
    // keep open if filters active for this cat, else close
    if (!st.fGadget && !st.fBrand && !st.fMaterial && !st.fKind) {
      st.sideMega = null;
      renderSideMega();
      renderSideCats();
    }
  }, 200);
});

$('#sideMegaClose')?.addEventListener('click', () => {
  st.sideMega = null;
  renderSideMega();
  renderSideCats();
});

$('#sideMegaCols')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-fkey]');
  if (!btn) return;
  const key = btn.dataset.fkey;
  const val = btn.dataset.fval || '';
  if (!key) return;
  // toggle
  st[key] = st[key] === val ? '' : val;
  // ensure category is set to the mega's category
  if (st.sideMega) {
    st.cat = st.sideMega;
    if ($('#cat')) $('#cat').value = st.cat;
  }
  st.page = 1;
  st.exactModel = '';
  st.color = '';
  renderSideMega();
  render();
});

if ($('#sort') && !$('#sort').querySelector('option[value="cat"]')) {
  $('#sort').insertAdjacentHTML('beforeend', '<option value="cat">За категорією</option>');
}

const MENU = window.MODELS_MENU || {};
const EXTRA_BRANDS = ['ZTE', 'Nokia', 'Lenovo', 'Nothing', 'Blackview', 'Vivo', 'Sony', 'Umidigi', 'HMD'];

function getMenuSections(brandKey) {
  if (brandKey === 'More') {
    return EXTRA_BRANDS.flatMap((b) =>
      (MENU[b] || []).map((grp) => ({ title: b, models: grp.models }))
    );
  }
  return MENU[brandKey] || [];
}

function renderMegaMenu() {
  const menuEl = $('#megaMenu');
  if (!menuEl) return;
  const brand = st.activeBrand;
  document.querySelectorAll('#brandList button').forEach((b) => {
    b.classList.toggle('active', b.dataset.brand === brand);
  });

  if (!brand) {
    menuEl.hidden = true;
    return;
  }

  menuEl.hidden = false;
  if ($('#megaTitle')) $('#megaTitle').textContent = brand === 'More' ? 'Інші бренди смартфонів' : `Моделі ${brand}`;
  if ($('#allBrandBtn')) $('#allBrandBtn').hidden = brand === 'More';

  const filterQ = st.menuFilter.trim().toLowerCase();
  const sections = getMenuSections(brand);

  if ($('#megaCols')) {
    $('#megaCols').innerHTML = sections
      .map((sec) => {
        let models = [...(sec.models || [])];
        if (filterQ) {
          models = models.filter((m) => m.toLowerCase().includes(filterQ));
        }
        if (st.menuSort === 'alpha') {
          models.sort((a, b) => a.localeCompare(b, 'uk'));
        }
        if (!models.length) return '';
        return `
          <div class="mega-group">
            <div class="mega-group-title">${esc(sec.title)}</div>
            <ul>
              ${models.map((m) => `<li><button type="button" data-model="${esc(m)}" data-b="${esc(brand)}">${esc(m)}</button></li>`).join('')}
            </ul>
          </div>
        `;
      })
      .join('');
  }
}

$('#brandList')?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-brand]');
  if (!btn) return;
  const b = btn.dataset.brand;
  st.activeBrand = st.activeBrand === b ? null : b;
  st.menuFilter = '';
  if ($('#megaSearch')) $('#megaSearch').value = '';
  renderMegaMenu();
});

$('#megaSearch')?.addEventListener('input', (e) => {
  st.menuFilter = e.target.value;
  renderMegaMenu();
});

document.querySelectorAll('.mega-sort .pill')?.forEach((pill) => {
  pill.onclick = () => {
    st.menuSort = pill.dataset.msort;
    document.querySelectorAll('.mega-sort .pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    renderMegaMenu();
  };
});

$('#allBrandBtn')?.addEventListener('click', () => {
  const brand = st.activeBrand;
  if (!brand) return;
  st.exactModel = '';
  st.home = false;
  st.type = '';
  st.color = '';
  const topCat = DB.categories.find((c) => !c.parentId && c.name.toLowerCase().includes(brand.toLowerCase()));
  if (topCat) {
    st.cat = topCat.id;
    st.q = '';
    if ($('#cat')) $('#cat').value = topCat.id;
    if ($('#q')) $('#q').value = '';
    if ($('#clearSearch')) $('#clearSearch').hidden = true;
  } else {
    st.cat = '';
    st.q = brand;
    if ($('#cat')) $('#cat').value = '';
    if ($('#q')) $('#q').value = brand;
    if ($('#clearSearch')) $('#clearSearch').hidden = false;
  }
  if ($('#activeModelBar')) $('#activeModelBar').hidden = false;
  if ($('#activeModelLabel')) $('#activeModelLabel').textContent = `Усі товари ${brand}`;
  st.activeBrand = null;
  st.page = 1;
  renderMegaMenu();
  render();
});

$('#megaCols')?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-model]');
  if (!btn) return;
  const modelRaw = btn.dataset.model;
  st.q = '';
  st.exactModel = modelRaw;
  st.home = false;
  st.type = '';
  st.color = '';
  st.cat = '';
  if ($('#cat')) $('#cat').value = '';
  if ($('#q')) $('#q').value = '';
  if ($('#clearSearch')) $('#clearSearch').hidden = true;
  if ($('#activeModelBar')) $('#activeModelBar').hidden = false;
  if ($('#activeModelLabel')) $('#activeModelLabel').textContent = `${modelRaw}`;

  st.activeBrand = null;
  st.page = 1;
  renderMegaMenu();
  render();
});

$('#resetModelBtn')?.addEventListener('click', () => {
  st.type = '';
  st.color = '';
  st.q = '';
  st.exactModel = '';
  st.cat = '';
  st.sideMega = null;
  clearMegaFilters();
  if ($('#q')) $('#q').value = '';
  if ($('#cat')) $('#cat').value = '';
  if ($('#clearSearch')) $('#clearSearch').hidden = true;
  if ($('#activeModelBar')) $('#activeModelBar').hidden = true;
  st.page = 1;
  render();
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.brand-nav') && st.activeBrand) {
    st.activeBrand = null;
    renderMegaMenu();
  }
  if (st.sideMega && !e.target.closest('#sidebarWrap') && !e.target.closest('#activeModelBar')) {
    // don't auto-close if filters applied
    if (!st.fGadget && !st.fBrand && !st.fMaterial && !st.fKind) {
      st.sideMega = null;
      renderSideMega();
      renderSideCats();
    }
  }
});

const VARIANTS = new Set(['pro', 'max', 'plus', 'ultra', 'lite', 'fe', 'mini', 'air', 'neo', 'gt', 'se', 'fiveg', 'fourg', 'threeg', 'edge', 'turbo', 'speed', 'power', 'prime', 'core', 'go', 'nfc']);
const BRAND_WORDS = new Set(['apple', 'samsung', 'galaxy', 'xiaomi', 'iphone', 'redmi', 'poco', 'motorola', 'google', 'oppo', 'realme', 'huawei', 'honor', 'tecno', 'infinix', 'oneplus']);

function tokens(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/\(\s*\d+[.,]\d+\s*["”'′″]*\s*\)/g, ' ')
    .replace(/\b([345])\s?g\b/g, (_, n) => ` ${['', '', '', 'threeg', 'fourg', 'fiveg'][n]} `)
    .replace(/\+/g, ' plus ')
    .replace(/[\/,;]+/g, ' | ')
    .replace(/([a-zа-яіїєґ])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zа-яіїєґ])/g, '$1 $2')
    .replace(/[^a-zа-яіїєґ0-9|]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const targetCache = new WeakMap();
function target(p) {
  let t = targetCache.get(p);
  if (!t) {
    const n = p.name || '';
    const i = n.search(/\sдля\s/i);
    t = tokens(i >= 0 ? n.slice(i + 5) : n);
    targetCache.set(p, t);
  }
  return t;
}

function parseModel(raw) {
  const w = tokens(raw).filter((x) => x !== '|');
  let k = 0;
  while (k < w.length - 1 && BRAND_WORDS.has(w[k])) k++;
  return { w, s: k ? w.slice(k) : [], set: new Set(w), key: w.reduce((a, b) => (b.length > a.length ? b : a), '') };
}

function matchesModel(p, m, strict) {
  const pw = target(p);
  const run = (qw, needStart) => {
    for (let i = 0; i + qw.length <= pw.length; i++) {
      if (needStart && i > 0 && pw[i - 1] !== '|') continue;
      let ok = true;
      for (let j = 0; j < qw.length; j++) if (pw[i + j] !== qw[j]) { ok = false; break; }
      if (!ok) continue;
      const nx = pw[i + qw.length];
      if (nx === undefined || nx === '|' || m.set.has(nx)) return true;
      if (/^\d/.test(nx)) continue;
      if (strict && (VARIANTS.has(nx) || (nx.length === 1 && /[a-z]/.test(nx)))) continue;
      return true;
    }
    return false;
  };
  return run(m.w, false) || (m.s.length > 0 && run(m.s, true));
}

const TYPES = [
  ['cases', 'Чохли', /чех[о]л|чохол|бампер|накладк|книжк/i],
  ['glass', 'Захисне скло', /скл[оа]|стекл/i],
  ['film', 'Плівки', /плівк|пленк/i],
  ['cables', 'Кабелі та зарядки', /кабел|заряд|адаптер|шнур|usb|lightning|type-c/i],
  ['other', 'Інше', /./]
];
const typeOf = (p) => (p._t ??= TYPES.find(([, , re]) => re.test(p.name || ''))[0]);
const typeLabel = (k) => TYPES.find((t) => t[0] === k)[1];

const GADGET_BRANDS = [
  'Apple', 'Samsung', 'Xiaomi', 'Redmi', 'Poco', 'Huawei', 'Honor', 'Realme',
  'Oppo', 'Vivo', 'Motorola', 'Google', 'OnePlus', 'TECNO', 'Infinix',
  'Nokia', 'Sony', 'ZTE', 'Nothing', 'Blackview', 'Lenovo'
];

const MATERIALS = [
  { key: 'силікон', label: 'Силікон', re: /силікон|силикон|silicone/i },
  { key: 'tpu', label: 'TPU', re: /\btpu\b/i },
  { key: 'шкіра', label: 'Шкіра', re: /шкір|кож[аы]|leather|кожн/i },
  { key: 'пластик', label: 'Пластик', re: /пластик|plastic|pc\b/i },
  { key: 'скло', label: 'Скло', re: /скл[оа]|стекл|glass/i },
  { key: 'плівка', label: 'Плівка', re: /плівк|пленк|film/i },
  { key: 'метал', label: 'Метал', re: /метал|metal|aluminium|алюмін/i },
  { key: 'тканина', label: 'Тканина', re: /тканин|fabric|nylon|нейлон/i }
];

const KINDS = [
  { key: 'книжка', label: 'Чохол-книжка', re: /книжк|flip|book/i },
  { key: 'накладка', label: 'Накладка', re: /накладк|бампер|case/i },
  { key: 'ультратонкий', label: 'Ультратонкий', re: /ультратон|ultrathin|тонкий/i },
  { key: 'протиударний', label: 'Протиударний', re: /протиудар|ударостій|armor|military|протиударн/i },
  { key: 'magsafe', label: 'MagSafe', re: /magsafe|mag\s*safe|магніт/i },
  { key: '3d', label: '3D скло', re: /\b3d\b/i },
  { key: '2.5d', label: '2.5D скло', re: /2[.,]?5\s*d/i },
  { key: 'повна', label: 'Повна поклейка', re: /повн[ае].*поклей|full\s*glue|full\s*cover/i },
  { key: 'кабель', label: 'Кабель', re: /кабел|cable|шнур/i },
  { key: 'зарядка', label: 'Зарядка', re: /заряд|charger|adapter|адаптер|powerbank|павер/i }
];

function detectGadgetBrand(p) {
  if (p._gb) return p._gb;
  const s = `${p.name || ''} ${p.brand || ''}`;
  for (const b of GADGET_BRANDS) {
    if (new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s)) {
      p._gb = b;
      return b;
    }
  }
  p._gb = '';
  return '';
}

function detectMaterial(p) {
  if (p._mat !== undefined) return p._mat;
  const s = p.name || '';
  for (const m of MATERIALS) {
    if (m.re.test(s)) { p._mat = m.key; return m.key; }
  }
  p._mat = '';
  return '';
}

function detectKind(p) {
  if (p._kind !== undefined) return p._kind;
  const s = p.name || '';
  for (const k of KINDS) {
    if (k.re.test(s)) { p._kind = k.key; return k.key; }
  }
  p._kind = '';
  return '';
}

function productsInCat(catId) {
  const ids = catId ? new Set(branch(catId)) : null;
  return DB.products.filter((p) => (!st.stock || p.available) && (!ids || ids.has(p.category)));
}

function buildMegaColumns(catId) {
  const items = productsInCat(catId);
  const gadgets = new Map();
  const brands = new Map();
  const materials = new Map();
  const kinds = new Map();

  for (const p of items) {
    const gb = detectGadgetBrand(p);
    if (gb) gadgets.set(gb, (gadgets.get(gb) || 0) + 1);
    const br = (p.brand || '').trim();
    if (br && br.length < 40) brands.set(br, (brands.get(br) || 0) + 1);
    const mat = detectMaterial(p);
    if (mat) materials.set(mat, (materials.get(mat) || 0) + 1);
    const kind = detectKind(p);
    if (kind) kinds.set(kind, (kinds.get(kind) || 0) + 1);
  }

  const sortMap = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'uk'));
  const matLabel = (k) => MATERIALS.find((x) => x.key === k)?.label || k;
  const kindLabel = (k) => KINDS.find((x) => x.key === k)?.label || k;

  const cols = [];
  const gSorted = sortMap(gadgets).slice(0, 20);
  if (gSorted.length) {
    cols.push({
      title: 'Бренд гаджета',
      key: 'fGadget',
      items: gSorted.map(([name, n]) => ({ id: name, label: name, n }))
    });
  }
  const bSorted = sortMap(brands).slice(0, 18);
  if (bSorted.length) {
    cols.push({
      title: 'Бренд',
      key: 'fBrand',
      items: bSorted.map(([name, n]) => ({ id: name, label: name, n }))
    });
  }
  const mSorted = sortMap(materials);
  if (mSorted.length) {
    cols.push({
      title: 'Матеріал',
      key: 'fMaterial',
      items: mSorted.map(([k, n]) => ({ id: k, label: matLabel(k), n }))
    });
  }
  const kSorted = sortMap(kinds);
  if (kSorted.length) {
    cols.push({
      title: 'Тип',
      key: 'fKind',
      items: kSorted.map(([k, n]) => ({ id: k, label: kindLabel(k), n }))
    });
  }
  return cols;
}

function renderSideMega() {
  const mega = $('#sideMega');
  const colsEl = $('#sideMegaCols');
  const title = $('#sideMegaTitle');
  if (!mega || !colsEl) return;

  if (!st.sideMega) {
    mega.classList.remove('is-open');
    // keep in DOM for exit animation, then hide
    const onEnd = () => {
      if (!mega.classList.contains('is-open')) mega.hidden = true;
      mega.removeEventListener('transitionend', onEnd);
    };
    mega.addEventListener('transitionend', onEnd);
    // fallback if no transition fires
    setTimeout(() => {
      if (!mega.classList.contains('is-open')) mega.hidden = true;
    }, 280);
    return;
  }

  const cat = catById.get(st.sideMega);
  if (title) title.textContent = cat ? cat.name : 'Фільтри';

  const cols = buildMegaColumns(st.sideMega);
  if (!cols.length) {
    colsEl.innerHTML = '<p class="mega-empty">Немає фільтрів для цієї категорії</p>';
  } else {
    colsEl.innerHTML = cols
      .map((col) => {
        const activeVal = st[col.key] || '';
        return `<div class="side-mega-col">
          <div class="side-mega-col-title">${esc(col.title)}</div>
          <ul>
            ${col.items
              .map(
                (it) => `<li>
              <button type="button" class="mega-filter-btn${activeVal === it.id ? ' active' : ''}"
                data-fkey="${esc(col.key)}" data-fval="${esc(it.id)}">
                <span>${esc(it.label)}</span>
                <b>${it.n}</b>
              </button>
            </li>`
              )
              .join('')}
          </ul>
        </div>`;
      })
      .join('');
  }

  // open with animation: show first, then next frame add class
  mega.hidden = false;
  // force reflow so transition runs
  void mega.offsetWidth;
  requestAnimationFrame(() => {
    mega.classList.add('is-open');
  });
}

function clearMegaFilters() {
  st.fGadget = '';
  st.fBrand = '';
  st.fMaterial = '';
  st.fKind = '';
}

function modelProducts(base, raw) {
  const m = parseModel(raw);
  const pre = base.filter((p) => p.s.includes(m.key) || p.s.includes(m.s[m.s.length - 1] || m.key));
  const strictRes = pre.filter((p) => matchesModel(p, m, true));
  return strictRes.length ? strictRes : pre.filter((p) => matchesModel(p, m, false));
}

function list() {
  const ids = st.cat ? new Set(branch(st.cat)) : null;
  let r = DB.products.filter((p) => (!st.stock || p.available) && (!ids || ids.has(p.category)));

  // Side mega filters
  if (st.fGadget) r = r.filter((p) => detectGadgetBrand(p) === st.fGadget);
  if (st.fBrand) r = r.filter((p) => (p.brand || '').trim() === st.fBrand);
  if (st.fMaterial) r = r.filter((p) => detectMaterial(p) === st.fMaterial);
  if (st.fKind) r = r.filter((p) => detectKind(p) === st.fKind);

  if (st.exactModel) {
    r = modelProducts(r, st.exactModel);
    st.typeCounts = r.reduce((a, p) => ((a[typeOf(p)] = (a[typeOf(p)] || 0) + 1), a), {});
    if (st.type) r = r.filter((p) => typeOf(p) === st.type);
  } else {
    st.typeCounts = null;
    const toks = st.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (toks.length) {
      r = r.filter((p) => toks.every((t) => p.s.includes(t)));
      if (toks.some((t) => /\d/.test(t))) {
        const m = parseModel(st.q);
        const hit = new Set(r.filter((p) => matchesModel(p, m, true)));
        if (hit.size) r = [...hit, ...r.filter((p) => !hit.has(p))];
      }
    }
  }

  if (st.sort === 'asc') r = [...r].sort((a, b) => a.price - b.price);
  else if (st.sort === 'desc') r = [...r].sort((a, b) => b.price - a.price);
  else if (st.sort === 'cat') r = [...r].sort((a, b) => (catById.get(a.category)?.name || '').localeCompare(catById.get(b.category)?.name || '', 'uk'));
  else if (st.exactModel && !st.type) {
    const order = Object.fromEntries(TYPES.map((t, i) => [t[0], i]));
    r = [...r].sort((a, b) => order[typeOf(a)] - order[typeOf(b)] || Number(b.available) - Number(a.available));
  }
  return r;
}

function renderChips() {
  const box = $('#typeChips');
  if (!box) return;
  const c = st.typeCounts;
  if (!c) { box.hidden = true; return; }
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  box.hidden = false;
  box.innerHTML =
    `<button type="button" class="chip${st.type ? '' : ' active'}" data-type="">Усе <b>${total}</b></button>` +
    TYPES.filter(([k]) => c[k]).map(([k, l]) => `<button type="button" class="chip${st.type === k ? ' active' : ''}" data-type="${k}">${l} <b>${c[k]}</b></button>`).join('');
}

function normalizeColorKey(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isStandardColor(label) {
  return /^(standard|стандарт)$/i.test(String(label || '').trim());
}

function renderColorChips(groups) {
  const box = $('#colorChips');
  const block = $('#colorFilterBlock');
  const clearBtn = $('#clearColorBtn');
  if (!box) return;

  // Count colors across groups (prefer in-stock variants when stock filter is on)
  const counts = new Map();
  for (const g of groups) {
    const seen = new Set();
    for (const v of g.variants) {
      if (st.stock && !v.available) continue;
      const label = variantLabel(v);
      if (isStandardColor(label)) continue;
      const key = normalizeColorKey(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (!counts.has(key)) counts.set(key, { label, n: 0 });
      counts.get(key).n++;
    }
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label, 'uk'))
    .slice(0, 18);

  st.colorCounts = Object.fromEntries(sorted.map(([k, v]) => [k, v.n]));

  if (st.color && !counts.has(st.color)) st.color = '';

  if (!sorted.length) {
    box.innerHTML = '<p class="filter-empty">Немає кольорів у вибірці</p>';
    if (clearBtn) clearBtn.hidden = true;
    if (block) block.hidden = false;
    return;
  }

  if (clearBtn) clearBtn.hidden = !st.color;
  if (block) block.hidden = false;

  box.innerHTML = sorted
    .map(([key, { label, n }]) => {
      const active = st.color === key;
      return `<button type="button" class="color-filter-item${active ? ' active' : ''}" data-color="${esc(key)}" title="${esc(label)}">
        <span class="color-dot" data-color-name="${esc(key)}"></span>
        <span class="color-name">${esc(label)}</span>
        <span class="color-n">${n}</span>
      </button>`;
    })
    .join('');
}

function applyColorFilter(groups) {
  if (!st.color) return groups;
  return groups
    .map((g) => {
      const match = g.variants.filter((v) => {
        if (st.stock && !v.available) return false;
        return normalizeColorKey(variantLabel(v)) === st.color;
      });
      if (!match.length) return null;
      // Prefer available, then cheapest as primary among matching color
      const primary =
        match.filter((v) => v.available).sort((a, b) => a.price - b.price)[0] ||
        match.sort((a, b) => a.price - b.price)[0] ||
        match[0];
      return { ...g, primary, variants: g.variants }; // keep all variants for in-card switch
    })
    .filter(Boolean);
}

function colorDotStyle(label) {
  const k = normalizeColorKey(label);
  const map = {
    чорний: '#1a1a1a', чорна: '#1a1a1a', black: '#1a1a1a',
    білий: '#f5f5f5', біла: '#f5f5f5', white: '#f5f5f5',
    червоний: '#e53935', red: '#e53935',
    синій: '#1e88e5', blue: '#1e88e5',
    зелений: '#43a047', green: '#43a047',
    сірий: '#9e9e9e', gray: '#9e9e9e', grey: '#9e9e9e',
    жовтий: '#fdd835', yellow: '#fdd835',
    рожевий: '#ec407a', pink: '#ec407a',
    фіолетовий: '#8e24aa', purple: '#8e24aa',
    золотий: '#f9a825', gold: '#f9a825',
    прозорий: 'linear-gradient(135deg,#eee,#fff)',
    'rose gold': '#e8b4a0',
    'space gray': '#5c5c60', midnight: '#191f28'
  };
  for (const [key, val] of Object.entries(map)) {
    if (k.includes(key)) return val;
  }
  return '#c5c9d1';
}

function cardHTML(group) {
  const p = group.primary;
  const variants = group.variants;
  const title = buildVariantTitle(p, variantLabel(p));
  const img = p.img
    ? `<img src="${esc(p.img)}" alt="${esc(title)}" loading="lazy" decoding="async" width="300" height="400" onerror="this.outerHTML='<div class=\'ph\'>Фото оновлюється</div>'">`
    : '<div class="ph">Фото відсутнє</div>';
  const disc = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const varCount = variants.length;
  const dots = variants.slice(0, 8).map((v) => {
    const label = variantLabel(v);
    const bg = colorDotStyle(label);
    return `<button type="button" class="color-swatch${v.id === p.id ? ' active' : ''}${!v.available ? ' out' : ''}" data-variant-id="${esc(v.id)}" title="${esc(label)}" style="--sw:${bg}"></button>`;
  }).join('');

  return `<article class="card${p.available ? '' : ' is-out'}" tabindex="0" data-id="${esc(p.id)}">
    <div class="thumb">
      ${img}
      ${p.available ? '<span class="badge-new">NEW</span>' : '<span class="out-badge">Немає</span>'}
      ${disc ? `<span class="sale">−${disc}%</span>` : ''}
    </div>
    <div class="card-body">
      ${varCount > 1 ? `<span class="models-badge">${varCount} кольорів</span>` : `<span class="models-badge muted">${typeLabel(typeOf(p))}</span>`}
      <h3>${esc(title)}</h3>
      ${varCount > 1 ? `<div class="swatch-row">${dots}${varCount > 8 ? `<span class="swatch-more">+${varCount - 8}</span>` : ''}</div>` : ''}
      <div class="meta">${p.sku ? `#${esc(p.sku)}` : esc(p.brand || '')}</div>
      <div class="foot">
        <div class="price-block">
          <span class="price">${money(p.price)}</span>
          ${disc ? `<span class="old">${money(p.oldPrice)}</span>` : ''}
        </div>
        <button type="button" class="add-cart-ico" data-add="${esc(p.id)}" ${p.available ? '' : 'disabled'} aria-label="У кошик">🛒</button>
      </div>
    </div>
  </article>`;
}

function applyCardVariant(card, variantBtn) {
  const p = byId.get(variantBtn.dataset.variantId);
  if (!p || !card) return;

  card.querySelectorAll('.variant-btn').forEach((b) => b.classList.remove('active'));
  variantBtn.classList.add('active');
  card.dataset.id = p.id;

  const col = variantLabel(p);
  const updatedTitle = buildVariantTitle(p, col);

  const titleEl = card.querySelector('h3');
  if (titleEl) titleEl.textContent = updatedTitle;

  const img = card.querySelector('.thumb img');
  if (img && p.img) {
    img.src = p.img;
    img.alt = updatedTitle;
  }

  const priceEl = card.querySelector('.foot .price');
  if (priceEl) {
    const disc = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    priceEl.innerHTML = `${money(p.price)}${disc ? `<span class="old">${money(p.oldPrice)}</span>` : ''}`;
  }

  const stock = card.querySelector('.stock');
  if (stock) {
    stock.className = `stock ${p.available ? 'ok' : 'no'}`;
    stock.textContent = p.available ? 'В наявності' : 'Немає';
  }

  const add = card.querySelector('[data-add]');
  if (add) {
    add.dataset.add = p.id;
    add.disabled = !p.available;
  }

  card.querySelectorAll('.color-swatch').forEach((b) => b.classList.remove('active'));
  const sw = card.querySelector(`.color-swatch[data-variant-id="${CSS.escape(p.id)}"]`);
  if (sw) sw.classList.add('active');
}

function setMeta(name, content, prop) {
  if (!content) return;
  const sel = prop ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let el = document.querySelector(sel);
  if (!el) {
    el = document.createElement('meta');
    if (prop) el.setAttribute('property', name);
    else el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function updateSeo(groups) {
  const total = groups?.length || 0;
  const parts = [];
  if (st.exactModel) parts.push(st.exactModel);
  else if (st.q) parts.push(st.q);
  if (st.cat) {
    const c = catById.get(st.cat);
    if (c?.name) parts.push(c.name);
  }
  if (st.fGadget) parts.push(st.fGadget);
  if (st.fBrand) parts.push(st.fBrand);
  if (st.fMaterial) {
    parts.push(MATERIALS.find((x) => x.key === st.fMaterial)?.label || st.fMaterial);
  }
  if (st.fKind) {
    parts.push(KINDS.find((x) => x.key === st.fKind)?.label || st.fKind);
  }
  if (st.color) parts.push(st.color);

  const topic = parts.length ? parts.join(' — ') : 'Каталог товарів';
  const title = parts.length
    ? `${topic} купити | Mobil Svit`
    : 'Mobil Svit — чохли, скло та аксесуари для смартфонів | Каталог';
  const desc = parts.length
    ? `${topic}: ${total.toLocaleString('uk-UA')} позицій у каталозі Mobil Svit. Актуальні ціни, наявність, доставка по Україні.`
    : 'Купити чохли, захисне скло, кабелі та зарядки для iPhone, Samsung, Xiaomi та інших. Актуальні ціни, наявність на складі, доставка по Україні.';

  document.title = title.slice(0, 65);
  setMeta('description', desc.slice(0, 160));
  setMeta('og:title', title.slice(0, 70), true);
  setMeta('og:description', desc.slice(0, 160), true);
  setMeta('twitter:title', title.slice(0, 70));
  setMeta('twitter:description', desc.slice(0, 160));

  const h1 = $('#catalogH1');
  if (h1) h1.textContent = parts.length ? topic : 'Каталог товарів Mobil Svit';

  const lead = $('#catalogLead');
  if (lead) {
    lead.textContent = parts.length
      ? `Знайдено ${total.toLocaleString('uk-UA')} товарів. Оберіть колір і модель — актуальні ціни та наявність.`
      : 'Чохли, захисне скло, кабелі та зарядки для iPhone, Samsung, Xiaomi та інших моделей. Актуальні ціни та наявність.';
  }

  const bc = $('#bcCurrent');
  if (bc) bc.textContent = parts.length ? topic : 'Каталог';

  // ItemList JSON-LD for visible products (SEO rich results)
  const items = (groups || []).slice(0, 24).map((g, i) => {
    const p = g.primary;
    return {
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: buildVariantTitle(p, variantLabel(p)),
        sku: p.sku || undefined,
        image: p.img || undefined,
        brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'UAH',
          price: String(p.price || 0),
          availability: p.available
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock'
        }
      }
    };
  });

  let ld = document.getElementById('ldItemList');
  if (!ld) {
    ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.id = 'ldItemList';
    document.head.appendChild(ld);
  }
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: topic,
    numberOfItems: total,
    itemListElement: items
  });

  // BreadcrumbList
  let ldb = document.getElementById('ldBreadcrumb');
  if (!ldb) {
    ldb = document.createElement('script');
    ldb.type = 'application/ld+json';
    ldb.id = 'ldBreadcrumb';
    document.head.appendChild(ldb);
  }
  const crumbs = [
    { '@type': 'ListItem', position: 1, name: 'Головна', item: '/' }
  ];
  if (parts.length) {
    crumbs.push({ '@type': 'ListItem', position: 2, name: topic });
  } else {
    crumbs.push({ '@type': 'ListItem', position: 2, name: 'Каталог' });
  }
  ldb.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs
  });
}

function render() {
  // Catalog is always on the main page (hero stays visible above)
  if ($('#homePage')) $('#homePage').hidden = false;
  if ($('#catalogPage')) $('#catalogPage').hidden = false;
  if ($('#cat')) $('#cat').hidden = true;

  const r = list();
  let groups = collapseVariants(r);
  // Build color filter from all groups, then apply selected color
  renderColorChips(groups);
  groups = applyColorFilter(groups);

  const shown = groups.slice(0, st.page * PAGE);
  if ($('#count')) $('#count').textContent = `${groups.length.toLocaleString('uk-UA')} товарів`;
  renderChips();
  renderSideCats();
  renderSideMega();
  updateSeo(groups);

  const hasMegaF = st.fGadget || st.fBrand || st.fMaterial || st.fKind;
  if ($('#activeModelBar')) {
    if (st.exactModel) {
      // model bar already managed elsewhere
    } else if (hasMegaF) {
      const parts = [];
      if (st.fGadget) parts.push(st.fGadget);
      if (st.fBrand) parts.push(st.fBrand);
      if (st.fMaterial) {
        const ml = MATERIALS.find((x) => x.key === st.fMaterial)?.label || st.fMaterial;
        parts.push(ml);
      }
      if (st.fKind) {
        const kl = KINDS.find((x) => x.key === st.fKind)?.label || st.fKind;
        parts.push(kl);
      }
      $('#activeModelBar').hidden = false;
      if ($('#activeModelLabel')) $('#activeModelLabel').textContent = parts.join(' · ');
    } else if (!st.exactModel) {
      // only hide if no model either — careful not to fight model selection
    }
  }

  if ($('#grid')) {
    $('#grid').innerHTML = shown.length
      ? shown.map(cardHTML).join('')
      : `<div class="empty"><p>Для цього запиту товарів не знайдено.</p>${st.stock || st.color ? '<p>Спробуйте зняти фільтр наявності / кольору або скинути фільтри.</p>' : ''}</div>`;
  }
  if ($('#more')) $('#more').hidden = shown.length >= groups.length;
}

function openProduct(id) {
  const p = byId.get(id), d = $('#pd');
  if (!p || !d) return;
  const catObj = catById.get(p.category);
  const initialTitle = buildVariantTitle(p, variantLabel(p));

  const base = baseName(p).toLowerCase().replace(/\s+/g, ' ').trim();
  const groupKey = `${base}|${p.category || ''}|${(p.brand || '').toLowerCase()}`;
  const variants = [...DB.products]
    .filter((v) => {
      const vb = baseName(v).toLowerCase().replace(/\s+/g, ' ').trim();
      return `${vb}|${v.category || ''}|${(v.brand || '').toLowerCase()}` === groupKey;
    })
    .filter((v, i, arr) => arr.findIndex((x) => variantLabel(x).toLowerCase() === variantLabel(v).toLowerCase()) === i)
    .sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return variantLabel(a).localeCompare(variantLabel(b), 'uk');
    });
  const choices = variants.length > 1
    ? `<div class="pd-variants"><span>Колір</span><div class="variant-list">${variants.map((v) => {
      const label = variantLabel(v);
      return `<button type="button" class="variant-btn${v.id === p.id ? ' active' : ''}" data-pd-variant="${esc(v.id)}" title="${esc(label)}">${esc(label)}</button>`;
    }).join('')}</div></div>`
    : '';

  d.innerHTML = `<form method="dialog"><button class="x" aria-label="Закрити">×</button></form>
    <div class="pd">
      <div>
        ${p.img ? `<img id="big" src="${esc(p.img)}" alt="${esc(initialTitle)}">` : '<div class="ph" style="aspect-ratio:3/4;">Фото відсутнє</div>'}
      </div>
      <div>
        <h2 id="pdTitle">${esc(initialTitle)}</h2>
        <div class="pd-meta">
          <span class="out">${esc(p.brand)}${p.sku ? ' · арт. ' + esc(p.sku) : ''}</span>
          <span id="pdStock" class="${p.available ? 'badge-stock' : 'badge-out'}">${p.available ? 'В наявності' : 'Немає в наявності'}</span>
        </div>
        ${choices}
        <p class="price" id="pdPrice">${money(p.price)}${p.oldPrice && p.oldPrice > p.price ? `<span class="old">${money(p.oldPrice)}</span>` : ''}</p>
        <button class="buy" id="add" type="button" ${p.available ? '' : 'disabled'}>${p.available ? 'У кошик' : 'Немає в наявності'}</button>
        <dl>
          ${p.brand ? `<dt>Виробник</dt><dd>${esc(p.brand)}</dd>` : ''}
          ${p.sku ? `<dt>Артикул</dt><dd id="pdSku">${esc(p.sku)}</dd>` : ''}
          ${catObj ? `<dt>Категорія</dt><dd>${esc(catObj.name)}</dd>` : ''}
        </dl>
      </div>
    </div>`;

  let selectedId = p.id;
  d.querySelectorAll('[data-pd-variant]').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = byId.get(button.dataset.pdVariant);
      if (!selected) return;
      selectedId = selected.id;
      d.querySelectorAll('[data-pd-variant]').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');

      const nextTitle = buildVariantTitle(selected, variantLabel(selected));
      const big = d.querySelector('#big');
      if (big) {
        if (selected.img) { big.src = selected.img; big.alt = nextTitle; }
        else big.removeAttribute('src');
      }
      if (d.querySelector('#pdTitle')) d.querySelector('#pdTitle').textContent = nextTitle;
      if (d.querySelector('#pdSku')) d.querySelector('#pdSku').textContent = selected.sku || '';
      const stock = d.querySelector('#pdStock');
      if (stock) {
        stock.className = selected.available ? 'badge-stock' : 'badge-out';
        stock.textContent = selected.available ? 'В наявності' : 'Немає в наявності';
      }
      const price = d.querySelector('#pdPrice');
      if (price) {
        const disc = selected.oldPrice && selected.oldPrice > selected.price;
        price.innerHTML = `${money(selected.price)}${disc ? `<span class="old">${money(selected.oldPrice)}</span>` : ''}`;
      }
      const add = d.querySelector('#add');
      if (add) {
        add.disabled = !selected.available;
        add.textContent = selected.available ? 'У кошик' : 'Немає в наявності';
      }
    });
  });

  d.querySelector('#add')?.addEventListener('click', () => {
    addToCart(selectedId);
    d.close();
    drawCart();
    $('#cartD')?.showModal();
  });
  d.showModal();
}

function drawCart() {
  cart = cart.filter((i) => byId.has(i.id));
  let total = 0;
  if ($('#lines')) {
    $('#lines').innerHTML = cart.length
      ? cart
          .map((i, n) => {
            const p = byId.get(i.id);
            total += p.price * i.qty;
            return `<div class="line"><span>${esc(buildVariantTitle(p, variantLabel(p)))}</span>
        <span><button type="button" data-n="${n}" data-d="-1" aria-label="Менше">−</button> ${i.qty} <button type="button" data-n="${n}" data-d="1" aria-label="Більше">+</button></span>
        <b class="price">${money(p.price * i.qty)}</b></div>`;
          })
          .join('') + `<p class="price">Разом: ${money(total)}</p>`
      : '<p>Кошик порожній</p>';
  }
  if ($('#order')) $('#order').hidden = !cart.length;
  save();
}

let t;
function addToCart(id) {
  const l = cart.find((i) => i.id === id);
  l ? l.qty++ : cart.push({ id, qty: 1 });
  save();
}

$('#grid')?.addEventListener('click', (e) => {
  const variant = e.target.closest('[data-variant-id]');
  if (variant) {
    e.stopPropagation();
    applyCardVariant(variant.closest('.card'), variant);
    return;
  }
  const add = e.target.closest('[data-add]');
  if (add) {
    addToCart(add.dataset.add);
    const prev = add.innerHTML;
    add.innerHTML = '✓';
    add.classList.add('added');
    setTimeout(() => {
      add.innerHTML = prev || '🛒';
      add.classList.remove('added');
    }, 1000);
    return;
  }
  const b = e.target.closest('.card');
  if (b) openProduct(b.dataset.id);
});

$('#grid')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('card')) openProduct(e.target.dataset.id);
});

$('#typeChips')?.addEventListener('click', (e) => {
  const c = e.target.closest('.chip');
  if (!c) return;
  st.type = c.dataset.type;
  st.page = 1;
  render();
});

$('#colorChips')?.addEventListener('click', (e) => {
  const c = e.target.closest('[data-color]');
  if (!c) return;
  const next = c.dataset.color || '';
  // toggle: click active color again → clear
  st.color = st.color === next ? '' : next;
  st.page = 1;
  render();
});

$('#clearColorBtn')?.addEventListener('click', () => {
  st.color = '';
  st.page = 1;
  render();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && st.activeBrand) { st.activeBrand = null; renderMegaMenu(); }
});

if ('IntersectionObserver' in window && $('#more')) {
  new IntersectionObserver((en) => {
    if (en[0].isIntersecting && !$('#more').hidden) { st.page++; render(); }
  }, { rootMargin: '600px' }).observe($('#more'));
}

$('#more')?.addEventListener('click', () => {
  st.page++;
  render();
});

$('#q')?.addEventListener('input', (e) => {
  clearTimeout(t);
  st.home = false;
  st.exactModel = '';
  st.type = '';
  st.color = '';
  if ($('#activeModelBar')) $('#activeModelBar').hidden = true;
  if ($('#clearSearch')) $('#clearSearch').hidden = !e.target.value;
  t = setTimeout(() => {
    st.q = e.target.value.trim();
    st.page = 1;
    render();
  }, 200);
});

$('#clearSearch')?.addEventListener('click', () => {
  st.type = '';
  st.color = '';
  st.q = '';
  st.exactModel = '';
  if ($('#q')) $('#q').value = '';
  if ($('#clearSearch')) $('#clearSearch').hidden = true;
  if ($('#activeModelBar')) $('#activeModelBar').hidden = true;
  st.page = 1;
  render();
});

$('#cat')?.addEventListener('change', (e) => {
  st.home = false;
  st.cat = e.target.value;
  st.page = 1;
  render();
});

$('#sort')?.addEventListener('change', (e) => {
  st.sort = e.target.value;
  st.page = 1;
  render();
});

$('#stock')?.addEventListener('change', (e) => {
  st.stock = e.target.checked;
  st.page = 1;
  render();
});

$('#cartBtn')?.addEventListener('click', () => {
  drawCart();
  $('#cartD')?.showModal();
});

$('#lines')?.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-n]');
  if (!b) return;
  const i = cart[+b.dataset.n];
  i.qty += +b.dataset.d;
  if (i.qty < 1) cart.splice(+b.dataset.n, 1);
  drawCart();
});

$('#order')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), msg = $('#msg');
  if (msg) msg.textContent = 'Надсилаю…';
  const payload = {
    name: f.get('name'),
    phone: f.get('phone'),
    comment: f.get('comment'),
    items: cart.map((i) => {
      const p = byId.get(i.id);
      return { id: i.id, name: p ? buildVariantTitle(p, variantLabel(p)) : '', sku: p?.sku, price: p?.price, qty: i.qty };
    }),
    createdAt: new Date().toISOString()
  };

  try {
    const r = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('API недоступне');
  } catch {
    const savedOrders = JSON.parse(localStorage.getItem('mobsvit_orders') || '[]');
    savedOrders.push(payload);
    localStorage.setItem('mobsvit_orders', JSON.stringify(savedOrders));
  }

  cart = [];
  drawCart();
  e.target.reset();
  if ($('#lines')) $('#lines').innerHTML = '<p>Дякуємо! Замовлення прийнято, ми зателефонуємо.</p>';
  if (msg) msg.textContent = '';
});

function showCatalog() {
  st.home = false;
  render();
  const target = $('#catalogPage') || $('#grid');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderHome() {
  // Hero stays on main page; catalog always rendered below
  if ($('#homePage')) $('#homePage').hidden = false;
  if ($('#catalogPage')) $('#catalogPage').hidden = false;
}

function renderLayout() {
  renderHome();
  render();
}

document.querySelectorAll('[data-open-catalog], [data-scroll-catalog]').forEach((b) =>
  b.addEventListener('click', showCatalog)
);

const slides = [...document.querySelectorAll('.hero-slide')];
const dots = [...document.querySelectorAll('#heroDots button')];
let heroIndex = 0;
function showHero(index) {
  heroIndex = (index + slides.length) % slides.length;
  slides.forEach((s, i) => s.classList.toggle('active', i === heroIndex));
  dots.forEach((d, i) => d.classList.toggle('active', i === heroIndex));
}
dots.forEach((d, i) => d.addEventListener('click', () => showHero(i)));
if (slides.length) setInterval(() => showHero(heroIndex + 1), 5200);

save();
renderBrandBadges();
renderLayout();

// Quick action pills (like itsellopt top buttons)
document.querySelectorAll('[data-quick]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const q = btn.dataset.quick;
    st.page = 1;
    st.exactModel = '';
    st.color = '';
    st.type = '';
    if (q === 'stock') {
      st.stock = true;
      if ($('#stock')) $('#stock').checked = true;
    } else if (q === 'sale') {
      st.stock = false;
      if ($('#stock')) $('#stock').checked = false;
      st.sort = 'desc';
      if ($('#sort')) $('#sort').value = 'desc';
    } else if (q === 'new') {
      st.stock = true;
      if ($('#stock')) $('#stock').checked = true;
      st.sort = '';
      if ($('#sort')) $('#sort').value = '';
    }
    showCatalog();
    render();
  });
});

$('#cartBtn2')?.addEventListener('click', () => {
  drawCart();
  $('#cartD')?.showModal();
});

$('#newGrid')?.addEventListener('click', (e) => {
  const variant = e.target.closest('[data-variant-id]');
  if (variant) {
    e.stopPropagation();
    applyCardVariant(variant.closest('.card'), variant);
    return;
  }
  const add = e.target.closest('[data-add]');
  if (add) {
    addToCart(add.dataset.add);
    const prev = add.innerHTML;
    add.innerHTML = '✓';
    setTimeout(() => { add.innerHTML = prev || '🛒'; }, 1000);
    return;
  }
  const card = e.target.closest('.card');
  if (card) openProduct(card.dataset.id);
});

function toUkrainian(text) {
  const replacements = [
    ['Защитное стекло', 'Захисне скло'], ['Защитная пленка', 'Захисна плівка'],
    ['Кожаный', 'Шкіряний'], ['Силиконовый', 'Силіконовий'], ['Силиконовая', 'Силіконова'],
    ['Чехол-книжка', 'Чохол-книжка'], ['чехол', 'чохол'], ['Чехол', 'Чохол'],
    ['наушников', 'навушників'], ['Дата кабель', 'Кабель'], ['Зарядное устройство', 'Блок живлення'],
    ['Черный', 'Чорний'], ['чёрный', 'Чорний'], ['черный', 'чорний'],
    ['Белый', 'Білий'], ['белый', 'білий'], ['Красный', 'Червоний'], ['красный', 'червоний'],
    ['Синий', 'Синій'], ['синий', 'синій'], ['Темно-синий', 'Темно-синій'],
    ['Зеленый', 'Зелений'], ['зеленый', 'зелений'], ['Серый', 'Сірий'], ['серый', 'сірий'],
    ['Желтый', 'Жовтий'], ['желтый', 'жовтий'], ['Розовый', 'Рожевий'], ['розовый', 'рожевий'],
    ['Бордовый', 'Бордовий'], ['бордовый', 'бордовий'], ['Фиолетовый', 'Фіолетовий'], ['фиолетовый', 'фіолетовий'],
    ['Лиловый', 'Ліловий'], ['лиловый', 'ліловий'], ['Бирюзовый', 'Бірюзовий'], ['бирюзовый', 'бірюзовий'],
    ['Мятный', 'М’ятний'], ['мятный', 'м’ятний'], ['Салатовый', 'Салатовий'], ['салатовый', 'салатовый'],
    ['Сиреневый', 'Бузковий'], ['сиреневый', 'бузковий'], ['Фисташковый', 'Фісташковий'], ['фисташковый', 'фісташковий'],
    ['Бесцветный', 'Безбарвний'], ['бесцветный', 'безбарвний'], ['Прозрачный', 'Прозорий'], ['прозрачный', 'прозорий'],
    ['Голубой', 'Блакитний'], ['голубой', 'блакитний'], ['Золотой', 'Золотий'], ['золотой', 'золотий'],
    ['Коричневый', 'Коричневий'], ['коричневый', 'коричневий'], ['Оранжевый', 'Помаранчевий'], ['оранжевый', 'помаранчевий'],
    ['Упаковка', 'Пакування'], ['Пленка', 'Плівка'], ['пленка', 'плівка'], ['пленок', 'плівок'],
    ['полимерных', 'полімерних'], ['Лопатка', 'Шпатель'], ['поклейки', 'приклеювання'],
    ['Антискользящий', 'Антиковзний'], ['Ремешок', 'Ремінець'], ['ремешок', 'ремінець'],
    ['Стекло', 'Скло'], ['стекло', 'скло']
  ];
  let s = String(text || '');
  for (const [from, to] of replacements) s = s.split(from).join(to);
  return s;
}