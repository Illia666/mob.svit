const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => n.toLocaleString('uk-UA') + ' грн';
const shard = (id) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 100; // як у scripts/build.js
const PAGE = 24;
const st = { q: '', cat: '', stock: true, sort: '', page: 1 };
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
const save = () => { localStorage.setItem('cart', JSON.stringify(cart)); $('#cartCount').textContent = cart.reduce((a, i) => a + i.qty, 0); };

const DB = await (await fetch('data/products.json')).json();
const byId = new Map(), kids = new Map(), own = new Map();
DB.products.forEach((p) => { byId.set(p.id, p); p.s = `${p.name} ${p.brand} ${p.sku}`.toLowerCase(); own.set(p.category, (own.get(p.category) || 0) + 1); });
const catById = new Map(DB.categories.map((c) => [c.id, c]));
DB.categories.forEach((c) => { if (c.parentId) kids.set(c.parentId, [...(kids.get(c.parentId) || []), c.id]); });
const branch = (id) => [id, ...(kids.get(id) || []).flatMap(branch)];
const count = (id) => branch(id).reduce((a, i) => a + (own.get(i) || 0), 0);
const depth = (c) => { let d = 0; while (c.parentId && catById.get(c.parentId)) { c = catById.get(c.parentId); d++; } return d; };
// у списку лише 2 верхні рівні категорій (їх у фіді дуже багато), вибір категорії охоплює і вкладені
$('#cat').insertAdjacentHTML('beforeend', DB.categories.filter((c) => depth(c) <= 1 && count(c.id))
  .map((c) => `<option value="${esc(c.id)}">${'— '.repeat(depth(c))}${esc(c.name)} (${count(c.id)})</option>`).join(''));

function list() {
  const q = st.q.toLowerCase(), ids = st.cat ? new Set(branch(st.cat)) : null;
  let r = DB.products.filter((p) => (!st.stock || p.available) && (!ids || ids.has(p.category)) && (!q || p.s.includes(q)));
  if (st.sort) r = [...r].sort((a, b) => (st.sort === 'asc' ? a.price - b.price : b.price - a.price));
  return r;
}

function render() {
  const r = list(), shown = r.slice(0, st.page * PAGE);
  $('#count').textContent = `${r.length.toLocaleString('uk-UA')} товарів`;
  $('#grid').innerHTML = shown.map((p) => `
    <button class="card" data-id="${esc(p.id)}">
      ${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" decoding="async" width="300" height="400">` : '<div class="ph"></div>'}
      <h3>${esc(p.name)}</h3>
      <span class="price">${money(p.price)}${p.oldPrice ? `<span class="old">${money(p.oldPrice)}</span>` : ''}</span>
      ${p.available ? '' : '<span class="out">Немає в наявності</span>'}
    </button>`).join('');
  $('#more').hidden = shown.length >= r.length;
}

const shards = new Map();
async function details(id) {
  const n = shard(id);
  if (!shards.has(n)) shards.set(n, fetch(`data/d/${n}.json`).then((r) => r.json()));
  return (await shards.get(n))[id] || { images: [], description: '', params: {} };
}

async function open(id) {
  const p = byId.get(id), d = $('#pd'), x = await details(id);
  const params = Object.entries(x.params).slice(0, 8).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  d.innerHTML = `<form method="dialog"><button class="x" aria-label="Закрити">×</button></form>
    <div class="pd"><div>
      <img id="big" src="${esc(x.images[0] || p.img)}" alt="${esc(p.name)}">
      <div class="thumbs">${x.images.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div></div>
      <div><h2>${esc(p.name)}</h2>
        <p class="out">${esc(p.brand)}${p.sku ? ' · арт. ' + esc(p.sku) : ''}</p>
        <p class="price">${money(p.price)}${p.oldPrice ? `<span class="old">${money(p.oldPrice)}</span>` : ''}</p>
        <button class="buy" id="add" ${p.available ? '' : 'disabled'}>${p.available ? 'У кошик' : 'Немає в наявності'}</button>
        <dl>${params}</dl><p>${esc(x.description)}</p></div></div>`;
  d.querySelector('.thumbs').onclick = (e) => { if (e.target.src) d.querySelector('#big').src = e.target.src; };
  d.querySelector('#add').onclick = () => {
    const l = cart.find((i) => i.id === id);
    l ? l.qty++ : cart.push({ id, qty: 1 });
    save(); d.close(); drawCart(); $('#cartD').showModal();
  };
  d.showModal();
}

function drawCart() {
  cart = cart.filter((i) => byId.has(i.id));
  let total = 0;
  $('#lines').innerHTML = cart.length ? cart.map((i, n) => {
    const p = byId.get(i.id); total += p.price * i.qty;
    return `<div class="line"><span>${esc(p.name)}</span>
      <span><button data-n="${n}" data-d="-1" aria-label="Менше">−</button> ${i.qty} <button data-n="${n}" data-d="1" aria-label="Більше">+</button></span>
      <b class="price">${money(p.price * i.qty)}</b></div>`;
  }).join('') + `<p class="price">Разом: ${money(total)}</p>` : '<p>Кошик порожній</p>';
  $('#order').hidden = !cart.length; save();
}

let t;
$('#grid').onclick = (e) => { const b = e.target.closest('.card'); if (b) open(b.dataset.id); };
$('#more').onclick = () => { st.page++; render(); };
$('#q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value.trim(); st.page = 1; render(); }, 200); };
$('#cat').onchange = (e) => { st.cat = e.target.value; st.page = 1; render(); };
$('#sort').onchange = (e) => { st.sort = e.target.value; st.page = 1; render(); };
$('#stock').onchange = (e) => { st.stock = e.target.checked; st.page = 1; render(); };
$('#cartBtn').onclick = () => { drawCart(); $('#cartD').showModal(); };
$('#lines').onclick = (e) => {
  const b = e.target.closest('button[data-n]'); if (!b) return;
  const i = cart[+b.dataset.n]; i.qty += +b.dataset.d; if (i.qty < 1) cart.splice(+b.dataset.n, 1); drawCart();
};
$('#order').onsubmit = async (e) => {
  e.preventDefault(); const f = new FormData(e.target), msg = $('#msg');
  msg.textContent = 'Надсилаю…';
  try {
    const r = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: f.get('name'), phone: f.get('phone'), comment: f.get('comment'), items: cart }) });
    if (!r.ok) throw new Error(await r.text());
    cart = []; drawCart(); e.target.reset(); $('#lines').innerHTML = '<p>Дякуємо! Замовлення прийнято, ми зателефонуємо.</p>'; msg.textContent = '';
  } catch (err) { msg.textContent = 'Не вдалося надіслати: ' + err.message; }
};
save(); render();
