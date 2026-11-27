/* =====================================================================
   Mobil Svit — конструктор «Свій дизайн чохлів» (сторінка /custom)

   Як це працює:
   • клієнт вибирає модель, завантажує фото, рухає/масштабує його на макеті чохла;
   • «Додати в кошик» створює віртуальний товар (id: custom-...), мініатюра й параметри
     лежать у localStorage, великі зображення (макет + оригінал) — в IndexedDB;
   • під час оформлення app.js бере макети через getDesigns() і шле в Google Apps Script,
     який зберігає їх на Google Диску й пише посилання в таблицю та Telegram.
   ===================================================================== */
import { CUSTOM_CASE } from './config.js';

const META_KEY = 'customItems';
const W = 540, H = 1080;           // логічний розмір полотна (співвідношення 1 : 2)
const PRINT_W = 1080, PRINT_H = 2160;   // розмір макета для друку
const MAX_SRC = 2400;              // оригінал стискаємо до цієї довшої сторони
const MAX_FILE = 25 * 1024 * 1024;
const SWATCHES = ['#ffffff', '#111111', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#f48fb1', '#8d6e63'];

/* ---------------- сховище: метадані + IndexedDB ---------------- */
const mem = new Map();
let dbp = null;
const db = () => dbp || (dbp = new Promise((res) => {
  try {
    const r = indexedDB.open('mobsvit-designs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('d');
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  } catch { res(null); }
}));
async function idbPut(id, val) {
  mem.set(id, val);
  const d = await db();
  if (!d) return;
  await new Promise((res) => {
    try {
      const t = d.transaction('d', 'readwrite');
      t.objectStore('d').put(val, id);
      t.oncomplete = res; t.onerror = res; t.onabort = res;
    } catch { res(); }
  });
}
async function idbGet(id) {
  if (mem.has(id)) return mem.get(id);
  const d = await db();
  if (!d) return null;
  return new Promise((res) => {
    try {
      const q = d.transaction('d').objectStore('d').get(id);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => res(null);
    } catch { res(null); }
  });
}
async function idbDel(id) {
  mem.delete(id);
  const d = await db();
  if (!d) return;
  await new Promise((res) => {
    try {
      const t = d.transaction('d', 'readwrite');
      t.objectStore('d').delete(id);
      t.oncomplete = res; t.onerror = res; t.onabort = res;
    } catch { res(); }
  });
}
const readMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; } catch { return {}; } };
const writeMeta = (m) => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); return true; } catch { return false; } };
const toProduct = (id, m) => ({ id, u: m.u, name: m.u, sku: 'CUSTOM', price: m.price, img: m.thumb, available: true, custom: true });

/** Повертає збережені макети в byId (щоб кошик їх не відфільтрував) і чистить сміття. */
export function registerSaved(byId, cart) {
  const meta = readMeta(), inCart = new Set(cart.map((i) => i.id));
  let changed = false;
  for (const id of Object.keys(meta)) {
    if (!inCart.has(id)) { delete meta[id]; idbDel(id); changed = true; continue; }
    byId.set(id, toProduct(id, meta[id]));
  }
  if (changed) writeMeta(meta);
}

/** Макети для відправки замовлення. null — якщо якогось уже немає в памʼяті браузера. */
export async function getDesigns(ids) {
  const meta = readMeta(), out = [];
  for (const id of ids) {
    const full = await idbGet(id), m = meta[id];
    if (!full || !m) return null;
    out.push({ id, model: m.model, material: m.material, color: m.color, preview: full.preview, original: full.original });
  }
  return out;
}

export function forgetDesigns(ids) {
  if (!ids || !ids.length) return;
  const meta = readMeta();
  ids.forEach((id) => { delete meta[id]; idbDel(id); });
  writeMeta(meta);
}


/* ---------------- розташування камер за моделлю (орієнтовне, лише для макета) ---------------- */
const BLOCK = (c, x, y, w, h, r) => {
  c.fillStyle = 'rgba(12, 14, 20, 0.82)';
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 3; c.stroke();
};
const LENS = (c, x, y, r) => {
  c.fillStyle = 'rgba(255,255,255,0.14)';
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 3; c.stroke();
};
const DOT = (c, x, y, r) => { BLOCK(c, x - r, y - r, r * 2, r * 2, r); LENS(c, x, y, r * 0.58); };   // окремий об'єктив у кільці
const CAMS = {
  'tri-square': (c) => { BLOCK(c, 30, 30, 168, 188, 46); [[78, 78], [78, 160], [152, 118]].forEach(([x, y]) => LENS(c, x, y, 26)); },
  'dual-diag': (c) => { BLOCK(c, 30, 30, 152, 152, 44); LENS(c, 76, 76, 26); LENS(c, 136, 136, 26); },
  'dual-vert': (c) => { BLOCK(c, 30, 30, 110, 200, 55); LENS(c, 85, 86, 28); LENS(c, 85, 172, 28); },
  'dual-horiz': (c) => { BLOCK(c, 30, 30, 252, 112, 56); LENS(c, 86, 86, 28); LENS(c, 192, 86, 28); },
  single: (c) => { BLOCK(c, 30, 30, 104, 104, 52); LENS(c, 82, 82, 28); },
  'air-bar': (c) => { BLOCK(c, 24, 30, 492, 112, 56); LENS(c, 100, 86, 30); },
  plateau: (c) => {
    BLOCK(c, 24, 30, 492, 236, 48);
    [[100, 90], [100, 180], [186, 135]].forEach(([x, y]) => LENS(c, x, y, 32));
    LENS(c, 430, 80, 14);
  },
  'tri-vert': (c) => { BLOCK(c, 30, 30, 112, 270, 56); [86, 166, 246].forEach((y) => LENS(c, 86, y, 28)); },
  sep3: (c) => { [80, 166, 252].forEach((y) => DOT(c, 78, y, 34)); },
  bar: (c) => {
    BLOCK(c, -6, 150, 552, 132, 0);
    LENS(c, 120, 216, 38); LENS(c, 232, 216, 38); LENS(c, 360, 200, 12);
  },
  circle: (c) => {
    c.fillStyle = 'rgba(12, 14, 20, 0.82)';
    c.beginPath(); c.arc(140, 140, 108, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 3; c.stroke();
    [[100, 104], [100, 180], [176, 142]].forEach(([x, y]) => LENS(c, x, y, 30));
  }
};
function cameraKind(label) {
  const m = String(label || '').toLowerCase();
  if (!m) return 'tri-square';
  if (/iphone|apple/.test(m)) {
    if (/\bair\b/.test(m)) return 'air-bar';
    if (/\b(17|18) pro/.test(m)) return 'plateau';
    if (/16e|iphone se|\bxr\b|iphone [678]\b(?! plus)/.test(m)) return 'single';
    if (/pro/.test(m)) return 'tri-square';
    if (/iphone (17|18)\b/.test(m)) return 'dual-horiz';
    if (/iphone 16\b|iphone xs?\b|iphone x\b/.test(m)) return 'dual-vert';
    return 'dual-diag';
  }
  if (/samsung|galaxy/.test(m)) {
    if (/\bz (fold|flip)|fold|flip/.test(m)) return 'dual-vert';
    if (/\bs(20|21|22)\b/.test(m)) return 'tri-vert';
    if (/\ba0|\ba1\d?\b|\bm0|\bm1/.test(m)) return 'dual-vert';
    return 'sep3';
  }
  if (/pixel|google/.test(m)) return /pixel [1-5]\b/.test(m) ? 'tri-square' : 'bar';
  if (/motorola|moto\b/.test(m)) return 'dual-vert';
  if (/redmi a|poco c|redmi \d+c\b/.test(m)) return 'dual-vert';
  if (/xiaomi|redmi|poco/.test(m)) return 'tri-square';
  if (/oppo|oneplus|honor|huawei|vivo/.test(m)) return 'circle';
  if (/realme|infinix|tecno|zte|nokia|hmd/.test(m)) return 'dual-vert';
  return 'tri-square';
}

/* ---------------- інтерфейс конструктора ---------------- */
export function initCustomCase(ctx) {
  const { $, esc, money, byId, finderSearch, addToCart } = ctx;
  const cv = $('#cuCanvas');
  if (!cv) return;
  const g = cv.getContext('2d');

  const S = {
    model: '',            // назва моделі (як у меню)
    img: null,            // Canvas зі стиснутим оригіналом
    nw: 0, nh: 0,         // розмір оригіналу
    fileName: '',
    z: 1, ox: 0, oy: 0,   // масштаб (1 = «заповнити»), зсув у логічних одиницях
    bg: '#ffffff',
    mat: CUSTOM_CASE.materials[0].id
  };
  const matOf = (id) => CUSTOM_CASE.materials.find((m) => m.id === id) || CUSTOM_CASE.materials[0];

  /* --- малювання --- */
  const cover = () => Math.max(W / S.nw, H / S.nh);
  function paint(c, k, overlay) {
    c.save();
    c.scale(k, k);
    c.beginPath();
    c.roundRect(0, 0, W, H, 76);
    c.clip();
    c.fillStyle = S.bg;
    c.fillRect(0, 0, W, H);
    if (S.img) {
      const s = cover() * S.z, w = S.nw * s, h = S.nh * s;
      c.imageSmoothingQuality = 'high';
      c.drawImage(S.img, W / 2 - w / 2 + S.ox, H / 2 - h / 2 + S.oy, w, h);
    }
    if (overlay) (CAMS[cameraKind(S.model)] || CAMS['tri-square'])(c);   // виріз під камеру (не друкується)
    c.restore();
  }
  const draw = () => paint(g, 1, true);

  function clampPos() {
    if (!S.img) return;
    const s = cover() * S.z, w = S.nw * s, h = S.nh * s;
    const mx = w / 2 + W / 2 - 70, my = h / 2 + H / 2 - 70;
    S.ox = Math.max(-mx, Math.min(mx, S.ox));
    S.oy = Math.max(-my, Math.min(my, S.oy));
  }

  /* --- якість --- */
  function quality() {
    if (!S.img) return null;
    const across = W / (cover() * S.z);              // скільки пікселів оригіналу припадає на ширину чохла
    const n = Math.round(across);
    return across >= 540 ? { ok: true, t: `Якість друку: добра (${n} px по ширині чохла).` }
      : across >= 380 ? { ok: true, t: `Якість друку: прийнятна (${n} px по ширині чохла).` }
        : { ok: false, t: `Фото сильно збільшене (${n} px по ширині чохла) — друк може вийти нечітким. Зменште масштаб або візьміть більше фото.` };
  }

  /* --- стан інтерфейсу --- */
  const price = () => matOf(S.mat).price;
  function sync() {
    draw();
    $('#cuEmpty').hidden = !!S.img;
    $('#cuZoomBox').hidden = !S.img;
    $('#cuHint').hidden = !S.img;
    $('#cuRemove').hidden = !S.img;
    $('#cuPick').textContent = S.img ? 'Замінити зображення' : 'Завантажити зображення';
    $('#cuPrice').textContent = money(price());
    $('#cuZoom').value = String(Math.round(S.z * 100));
    $('#cuChosen').hidden = !S.model;
    $('#cuChosen').innerHTML = S.model ? `Модель: <b>${esc(S.model)}</b> <button type="button" class="link-btn" id="cuChange">Змінити</button>` : '';
    $('#cuSwatches').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.c.toLowerCase() === S.bg.toLowerCase())));
    $('#cuMats').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === S.mat)));
    const q = quality();
    const note = $('#cuNote');
    if (q) { note.textContent = `${S.fileName ? S.fileName + ' · ' : ''}${S.nw}×${S.nh}. ${q.t}`; note.className = 'cu-note ' + (q.ok ? 'ok' : 'warn'); }
    const need = !S.model ? 'Оберіть модель телефону' : !S.img ? 'Завантажте зображення' : '';
    $('#cuAdd').disabled = !!need;
    $('#cuWhy').textContent = need;
  }

  /* --- завантаження файлу --- */
  function setNote(t, cls = '') { const n = $('#cuNote'); n.textContent = t; n.className = 'cu-note ' + cls; }
  async function loadFile(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return setNote('Підтримуються лише JPG, PNG та WebP.', 'warn');
    if (file.size > MAX_FILE) return setNote('Файл завеликий — максимум 25 МБ.', 'warn');
    setNote('Завантажую…');
    let bmp;
    try { bmp = await createImageBitmap(file); } catch { return setNote('Не вдалося відкрити це зображення. Спробуйте інший файл.', 'warn'); }
    const { minW, minH } = CUSTOM_CASE;
    const big = Math.max(bmp.width, bmp.height), small = Math.min(bmp.width, bmp.height);
    if (big < Math.max(minW, minH) || small < Math.min(minW, minH)) {
      const bw = bmp.width, bh = bmp.height;
      bmp.close?.();
      return setNote(`Зображення замале: ${bw}×${bh}. Потрібно не менше ${minW}×${minH}.`, 'warn');
    }
    const k = Math.min(1, MAX_SRC / big);
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const cc = c.getContext('2d');
    cc.fillStyle = '#fff'; cc.fillRect(0, 0, c.width, c.height);   // прозорі PNG — на білому
    cc.imageSmoothingQuality = 'high';
    cc.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    S.img = c; S.nw = c.width; S.nh = c.height;
    S.fileName = file.name.length > 28 ? file.name.slice(0, 25) + '…' : file.name;
    S.z = 1; S.ox = 0; S.oy = 0;
    sync();
  }
  $('#cuPick').addEventListener('click', () => $('#cuFile').click());
  $('#cuFile').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
  $('#cuRemove').addEventListener('click', () => { S.img = null; S.nw = S.nh = 0; S.fileName = ''; setNote(`Формати JPG, PNG, WebP. Розмір — не менше ${CUSTOM_CASE.minW}×${CUSTOM_CASE.minH}.`); sync(); });

  const stage = $('#cuStage');
  ['dragenter', 'dragover'].forEach((t) => stage.addEventListener(t, (e) => { e.preventDefault(); stage.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((t) => stage.addEventListener(t, (e) => { e.preventDefault(); stage.classList.remove('drag'); }));
  stage.addEventListener('drop', (e) => loadFile(e.dataTransfer.files[0]));
  $('#cuEmpty').addEventListener('click', () => $('#cuFile').click());

  /* --- переміщення й масштаб (миша, дотик, колесо) --- */
  const ptr = new Map();
  let pinch0 = 0, z0 = 1;
  const unit = () => W / cv.clientWidth;
  cv.addEventListener('pointerdown', (e) => {
    if (!S.img) return;
    cv.setPointerCapture(e.pointerId);
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = S.z; }
  });
  cv.addEventListener('pointermove', (e) => {
    const p = ptr.get(e.pointerId);
    if (!p || !S.img) return;
    if (ptr.size === 1) {
      S.ox += (e.clientX - p.x) * unit();
      S.oy += (e.clientY - p.y) * unit();
    }
    p.x = e.clientX; p.y = e.clientY;
    if (ptr.size === 2 && pinch0) {
      const [a, b] = [...ptr.values()];
      S.z = Math.max(0.5, Math.min(4, z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0));
    }
    clampPos(); sync();
  });
  const up = (e) => { ptr.delete(e.pointerId); pinch0 = 0; };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => {
    if (!S.img) return;
    e.preventDefault();
    S.z = Math.max(0.5, Math.min(4, S.z * Math.exp(-e.deltaY * 0.0015)));
    clampPos(); sync();
  }, { passive: false });
  $('#cuZoom').addEventListener('input', (e) => { S.z = +e.target.value / 100; clampPos(); sync(); });
  $('#cuReset').addEventListener('click', () => { S.z = 1; S.ox = 0; S.oy = 0; sync(); });

  /* --- колір фону та матеріал --- */
  $('#cuSwatches').innerHTML = SWATCHES.map((c) => `<button type="button" data-c="${c}" style="--c:${c}" aria-label="Колір ${c}" aria-pressed="false"></button>`).join('')
    + '<label class="cu-custom-color" title="Свій колір"><input type="color" id="cuColor" value="#ffffff"><span>+</span></label>';
  $('#cuSwatches').addEventListener('click', (e) => { const b = e.target.closest('button[data-c]'); if (b) { S.bg = b.dataset.c; sync(); } });
  $('#cuColor').addEventListener('input', (e) => { S.bg = e.target.value; sync(); });
  $('#cuMats').innerHTML = CUSTOM_CASE.materials.map((m) => `<button type="button" class="pill" data-m="${m.id}" aria-pressed="false">${esc(m.name)}</button>`).join('');
  $('#cuMats').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (b) { S.mat = b.dataset.m; sync(); } });

  /* --- вибір моделі --- */
  const list = $('#cuList'), inp = $('#cuModel');
  let hits = [], sel = -1;
  function drawList() {
    const v = inp.value.trim();
    list.hidden = !v;
    inp.setAttribute('aria-expanded', String(!list.hidden));
    list.innerHTML = hits.length
      ? hits.map((m, i) => `<li role="option" data-i="${i}"${i === sel ? ' class="on" aria-selected="true"' : ''}>${esc(m.label)}</li>`).join('')
      : (v ? '<li class="none">Такої моделі не знайдено — спробуйте інакше</li>' : '');
  }
  function pickModel(m) {
    S.model = m.label;
    inp.value = ''; hits = []; sel = -1; list.hidden = true;
    $('.cu-model').hidden = true;
    sync();
  }
  inp.addEventListener('input', () => { hits = finderSearch(inp.value); sel = -1; drawList(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!hits.length) return;
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
      drawList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const m = hits[sel >= 0 ? sel : 0];
      if (m) pickModel(m);
    } else if (e.key === 'Escape') { hits = []; inp.value = ''; drawList(); }
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) { e.preventDefault(); pickModel(hits[+li.dataset.i]); }
  });
  inp.addEventListener('blur', () => { list.hidden = true; });
  $('#cuChosen').addEventListener('click', (e) => {
    if (!e.target.closest('#cuChange')) return;
    S.model = ''; $('.cu-model').hidden = false; sync(); inp.focus();
  });
  try {                                              // якщо клієнт уже вибирав свій телефон на головній — підставляємо
    const my = JSON.parse(localStorage.getItem('myPhone') || 'null');
    if (my && my.label) { S.model = my.label; $('.cu-model').hidden = true; }
  } catch { /* ignore */ }

  /* --- умови --- */
  $('#cuFacts').innerHTML = [
    ['Термін виготовлення', `${CUSTOM_CASE.days} дні`],
    ['Зображення', `не менше ${CUSTOM_CASE.minW}×${CUSTOM_CASE.minH}`],
    ['Форм-фактор', 'накладка'],
    ['Матеріал', CUSTOM_CASE.materials.map((m) => m.name).join(', ')]
  ].map(([k, v]) => `<li><b>${esc(k)}</b> — ${esc(v)}</li>`).join('');

  /* --- додати в кошик --- */
  $('#cuAdd').addEventListener('click', async () => {
    if (!S.model || !S.img) return;
    const btn = $('#cuAdd');
    btn.disabled = true;
    const id = 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const toURL = (w, h, type, q, overlay) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      paint(c.getContext('2d'), w / W, overlay);
      return c.toDataURL(type, q);
    };
    const preview = toURL(PRINT_W, PRINT_H, 'image/jpeg', 0.92, false);       // готовий до друку макет
    const thumb = toURL(150, 300, 'image/jpeg', 0.75, true);                  // мініатюра для кошика
    const o = document.createElement('canvas'); o.width = S.nw; o.height = S.nh;
    o.getContext('2d').drawImage(S.img, 0, 0);
    const original = o.toDataURL('image/jpeg', 0.92);
    const mat = matOf(S.mat);
    const meta = readMeta();
    meta[id] = { u: `Чохол зі своїм дизайном — ${S.model} (${mat.name})`, price: mat.price, thumb, model: S.model, material: mat.name, color: S.bg };
    writeMeta(meta);
    await idbPut(id, { preview: preview.split(',')[1], original: original.split(',')[1] });
    byId.set(id, toProduct(id, meta[id]));
    addToCart(id);
    btn.disabled = false;
    sync();
  });

  sync();
}
