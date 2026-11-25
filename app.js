const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('uk-UA') + ' грн';
const PAGE = 36;

const st = { q: '', cat: '', stock: true, sort: '', page: 1, activeBrand: null, menuSort: 'default', menuFilter: '' };
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
const save = () => {
  localStorage.setItem('cart', JSON.stringify(cart));
  if ($('#cartCount')) $('#cartCount').textContent = cart.reduce((a, i) => a + i.qty, 0);
};

async function loadDB() {
  for (const url of ['products.json', 'data/products.json']) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.products) && Array.isArray(data.categories)) {
        return data;
      }
    } catch {
      // Переходимо до наступного шляху
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
  $('#cat').insertAdjacentHTML(
    'beforeend',
    DB.categories
      .filter((c) => depth(c) <= 1 && count(c.id))
      .map((c) => `<option value="${esc(c.id)}">${'— '.repeat(depth(c))}${esc(c.name)} (${count(c.id)})</option>`)
      .join('')
  );
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
  const searchQuery = modelRaw.replace(/\s*\(\d+[.,]\d+["']*\)/g, '').trim();

  st.q = searchQuery;
  st.cat = '';
  if ($('#cat')) $('#cat').value = '';
  if ($('#q')) $('#q').value = searchQuery;
  if ($('#clearSearch')) $('#clearSearch').hidden = false;
  if ($('#activeModelBar')) $('#activeModelBar').hidden = false;
  if ($('#activeModelLabel')) $('#activeModelLabel').textContent = modelRaw;

  st.activeBrand = null;
  st.page = 1;
  renderMegaMenu();
  render();
});

$('#resetModelBtn')?.addEventListener('click', () => {
  st.q = '';
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
function list() {
  const q = st.q.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const ids = st.cat ? new Set(branch(st.cat)) : null;

  let r = DB.products.filter(
    (p) =>
      (!st.stock || p.available) &&
      (!ids || ids.has(p.category)) &&
      (!tokens.length || tokens.every((tok) => p.s.includes(tok)))
  );

  if (st.sort) {
    r = [...r].sort((a, b) => (st.sort === 'asc' ? a.price - b.price : b.price - a.price));
  }
  return r;
}

function render() {
  const r = list();
  const shown = r.slice(0, st.page * PAGE);
  if ($('#count')) $('#count').textContent = `${r.length.toLocaleString('uk-UA')} товарів`;
  if ($('#grid')) {
    $('#grid').innerHTML = shown.length
      ? shown
          .map(
            (p) => `
          <button class="card" type="button" data-id="${esc(p.id)}">
            ${
              p.img
                ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="300" height="400" onerror="this.outerHTML='<div class=\'ph\'>Фото оновлюється</div>'">`
                : '<div class="ph">Фото відсутнє</div>'
            }
            <h3>${esc(p.name)}</h3>
            <span class="price">${money(p.price)}${p.oldPrice && p.oldPrice > p.price ? `<span class="old">${money(p.oldPrice)}</span>` : ''}</span>
            ${p.available ? '' : '<span class="out">Немає в наявності</span>'}
          </button>`
          )
          .join('')
      : '<p style="grid-column:1/-1;text-align:center;color:var(--mut);padding:32px 0;">Товарів за цим запитом не знайдено. Спробуйте змінити модель або фільтр.</p>';
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
    const l = cart.find((i) => i.id === id);
    l ? l.qty++ : cart.push({ id, qty: 1 });
    save();
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
$('#grid')?.addEventListener('click', (e) => {
  const b = e.target.closest('.card');
  if (b) openProduct(b.dataset.id);
});
$('#more')?.addEventListener('click', () => {
  st.page++;
  render();
});
$('#q')?.addEventListener('input', (e) => {
  clearTimeout(t);
  if ($('#clearSearch')) $('#clearSearch').hidden = !e.target.value;
  t = setTimeout(() => {
    st.q = e.target.value.trim();
    st.page = 1;
    render();
  }, 200);
});
$('#clearSearch')?.addEventListener('click', () => {
  st.q = '';
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
