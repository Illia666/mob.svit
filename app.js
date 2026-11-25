const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('uk-UA') + ' грн';
const PAGE = 36;

const st = { q: '', cat: '', stock: true, sort: '', page: 1, activeBrand: null, menuSort: 'default', menuFilter: '', exactModel: '', type: '', typeCounts: null };
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

// Новий формат: data/index.json + data/products-N.json (компактні рядки), старий: products.json
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
    // переходимо до старого формату
  }
  for (const url of ['products.json', 'data/products.json']) {
    try {
      const data = await getJSON(url);
      if (data && Array.isArray(data.products) && Array.isArray(data.categories)) return data;
    } catch {
      // наступний шлях
    }
  }
  return { categories: [], products: [] };
}

const DB = await loadDB();

const byId = new Map(), kids = new Map(), own = new Map();
DB.products.forEach((p) => {
  byId.set(p.id, p);
  p.s = `${p.name} ${p.brand} ${p.sku}`.toLowerCase();
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

if ($('#sort') && !$('#sort').querySelector('option[value="cat"]')) {
  $('#sort').insertAdjacentHTML('beforeend', '<option value="cat">За категорією</option>');
}

// === МЕГА-МЕНЮ МОДЕЛЕЙ ===
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

document.querySelectorAll('.mega-sort .pill').forEach((pill) => {
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
  st.type = '';
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
  st.type = '';
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
  st.q = '';
  st.exactModel = '';
  st.cat = '';
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
});

// === ФІЛЬТРАЦІЯ ТА КАТАЛОГ ===
// <matcher>
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
// </matcher>

const TYPES = [
  ['cases', 'Чохли', /чех[о]л|чохол|бампер|накладк|книжк/i],
  ['glass', 'Захисне скло', /скл[оа]|стекл/i],
  ['film', 'Плівки', /плівк|пленк/i],
  ['cables', 'Кабелі та зарядки', /кабел|заряд|адаптер|шнур|usb|lightning|type-c/i],
  ['other', 'Інше', /./]
];
const typeOf = (p) => (p._t ??= TYPES.find(([, , re]) => re.test(p.name || ''))[0]);
const typeLabel = (k) => TYPES.find((t) => t[0] === k)[1];

function modelProducts(base, raw) {
  const m = parseModel(raw);
  const pre = base.filter((p) => p.s.includes(m.key) || p.s.includes(m.s[m.s.length - 1] || m.key));
  const strictRes = pre.filter((p) => matchesModel(p, m, true));
  return strictRes.length ? strictRes : pre.filter((p) => matchesModel(p, m, false));
}

function list() {
  const ids = st.cat ? new Set(branch(st.cat)) : null;
  let r = DB.products.filter((p) => (!st.stock || p.available) && (!ids || ids.has(p.category)));

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

function cardHTML(p) {
  const img = p.img
    ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="300" height="400" onerror="this.outerHTML='<div class=\\'ph\\'>Фото оновлюється</div>'">`
    : '<div class="ph">Фото відсутнє</div>';
  const disc = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  return `<article class="card${p.available ? '' : ' is-out'}" tabindex="0" data-id="${esc(p.id)}">
    <div class="thumb">${img}<span class="tag">${typeLabel(typeOf(p))}</span>${disc ? `<span class="sale">−${disc}%</span>` : ''}</div>
    <h3>${esc(p.name)}</h3>
    <div class="meta">${esc(p.brand || '')}${p.sku ? ` · арт. ${esc(p.sku)}` : ''}</div>
    <div class="foot">
      <span class="price">${money(p.price)}${disc ? `<span class="old">${money(p.oldPrice)}</span>` : ''}</span>
      <span class="stock ${p.available ? 'ok' : 'no'}">${p.available ? 'В наявності' : 'Немає'}</span>
    </div>
    <button type="button" class="add-mini" data-add="${esc(p.id)}" ${p.available ? '' : 'disabled'}>${p.available ? 'У кошик' : 'Немає в наявності'}</button>
  </article>`;
}

function render() {
  const r = list();
  const shown = r.slice(0, st.page * PAGE);
  if ($('#count')) $('#count').textContent = `${r.length.toLocaleString('uk-UA')} товарів`;
  renderChips();
  if ($('#grid')) {
    $('#grid').innerHTML = shown.length
      ? shown.map(cardHTML).join('')
      : `<div class="empty"><p>Для цього запиту товарів не знайдено.</p>${st.stock ? '<p>Спробуйте зняти «Лише в наявності» або скинути фільтри.</p>' : ''}</div>`;
  }
  if ($('#more')) $('#more').hidden = shown.length >= r.length;
}

function openProduct(id) {
  const p = byId.get(id), d = $('#pd');
  if (!p || !d) return;
  const catObj = catById.get(p.category);
  const imgs = p.img ? [p.img] : [];

  d.innerHTML = `<form method="dialog"><button class="x" aria-label="Закрити">×</button></form>
    <div class="pd">
      <div>
        ${imgs[0] ? `<img id="big" src="${esc(imgs[0])}" alt="${esc(p.name)}">` : '<div class="ph" style="aspect-ratio:3/4;">Фото відсутнє</div>'}
      </div>
      <div>
        <h2>${esc(p.name)}</h2>
        <div class="pd-meta">
          <span class="out">${esc(p.brand)}${p.sku ? ' · арт. ' + esc(p.sku) : ''}</span>
          ${p.available ? '<span class="badge-stock">В наявності</span>' : '<span class="badge-out">Немає в наявності</span>'}
        </div>
        <p class="price">${money(p.price)}${p.oldPrice && p.oldPrice > p.price ? `<span class="old">${money(p.oldPrice)}</span>` : ''}</p>
        <button class="buy" id="add" type="button" ${p.available ? '' : 'disabled'}>${p.available ? 'У кошик' : 'Немає в наявності'}</button>
        <dl>
          ${p.brand ? `<dt>Виробник</dt><dd>${esc(p.brand)}</dd>` : ''}
          ${p.sku ? `<dt>Артикул</dt><dd>${esc(p.sku)}</dd>` : ''}
          ${catObj ? `<dt>Категорія</dt><dd>${esc(catObj.name)}</dd>` : ''}
        </dl>
      </div>
    </div>`;

  d.querySelector('#add')?.addEventListener('click', () => {
    addToCart(id);
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
            return `<div class="line"><span>${esc(p.name)}</span>
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
  const add = e.target.closest('[data-add]');
  if (add) {
    addToCart(add.dataset.add);
    add.textContent = '✓ Додано';
    setTimeout(() => (add.textContent = 'У кошик'), 1200);
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
  st.exactModel = '';
  st.type = '';
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
  st.q = '';
  st.exactModel = '';
  if ($('#q')) $('#q').value = '';
  if ($('#clearSearch')) $('#clearSearch').hidden = true;
  if ($('#activeModelBar')) $('#activeModelBar').hidden = true;
  st.page = 1;
  render();
});
$('#cat')?.addEventListener('change', (e) => {
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
      return { id: i.id, name: p?.name, sku: p?.sku, price: p?.price, qty: i.qty };
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

save();
render();