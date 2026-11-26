import { POSTERS, SIDEBAR, BRAND_STRIP, OTHER_BRANDS, NEW_DAYS, ARRIVAL_DAYS, ORDER_ENDPOINT, NOVA_POSHTA_KEY } from './config.js';

/* ====================================================================
   Допоміжне
   ==================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('uk-UA') + ' грн';
const plural = (n, f) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return f[a > 10 && a < 20 ? 2 : b > 1 && b < 5 ? 1 : b === 1 ? 0 : 2];
};
const PAGE = 36;
const DAY = Math.floor(Date.now() / 864e5);
const canHover = matchMedia('(hover: hover)').matches;
const isDesktop = () => matchMedia('(min-width: 961px)').matches;

const st = {
  view: 'home',
  q: '', cat: '', stock: true, sort: '', page: 1,
  f: null,            // фільтр з меню каталогу
  title: '',          // заголовок сторінки для f
  special: '',        // '' | 'new' | 'arrivals'
  exactModel: '', type: '', typeCounts: null,
  fBrand: '', fColor: '', fForm: '', facets: null,   // фільтри всередині моделі
  activeBrand: null, menuSort: 'default', menuFilter: ''
};

let cart = JSON.parse(localStorage.getItem('cart') || '[]');
const save = () => {
  localStorage.setItem('cart', JSON.stringify(cart));
  const n = cart.reduce((a, i) => a + i.qty, 0);
  const el = $('#cartCount');
  if (el) { el.textContent = n; el.parentElement.classList.toggle('has', n > 0); }
};

// Змінні, які потрібні ще до завантаження даних (щоб не було помилок ініціалізації)
let slideIdx = 0, slideTimer = null, ready = false;
let DB = { categories: [], products: [] };
const mounts = [];

/* ====================================================================
   Іконки бокового меню
   ==================================================================== */
const ICONS = {
  puzzle: '<path d="M9 4h3a2 2 0 1 1 4 0h3v4a2 2 0 1 0 0 4v4h-4a2 2 0 1 1-4 0H5v-4a2 2 0 1 0 0-4V4z" transform="translate(0 1)"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M10.5 5.5h3"/>',
  glass: '<rect x="6" y="2.5" width="12" height="19" rx="2.4"/><path d="m9 15 5-6M11 16.5l4.5-5.2"/>',
  watch: '<rect x="7" y="7" width="10" height="10" rx="3"/><path d="M9 7l.6-4h4.8L15 7M9 17l.6 4h4.8L15 17M12 10v2.4l1.5 1"/>',
  charger: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="m12.8 7-2.3 4h3l-2.3 4"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.6"/><rect x="16.5" y="14" width="4" height="6" rx="1.6"/>',
  car: '<path d="M4 15v-3l2-5h12l2 5v3zM4 15v3h3v-3M17 15v3h3v-3"/><circle cx="8" cy="13" r=".6"/><circle cx="16" cy="13" r=".6"/>',
  cable: '<path d="M7 3v6M12 3v6M17 3v6M5 9h4v5H5zM10 9h4v5h-4zM15 9h4v5h-4zM7 14v7M12 14v7M17 14v7"/>',
  bag: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  tag: '<path d="m3 12 9-9h7a2 2 0 0 1 2 2v7l-9 9z"/><circle cx="16" cy="8" r="1.3"/>'
};
const icon = (k) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ''}</svg>`;

/* ====================================================================
   Кольори варіантів
   ==================================================================== */
const COLOR_DEFS = [
  ['Білий', '#ffffff', 'белый білий white'],
  ['Чорний', '#15171c', 'черный чорний black'],
  ['Червоний', '#e03131', 'красный червоний red'],
  ['Синій', '#1c63d6', 'синий синій blue'],
  ['Темно-синій', '#16264f', 'темно-синий темно-синій navy midnight midnight-blue dark-blue'],
  ['Блакитний', '#5fb7f2', 'голубой блакитний light-blue sky-blue lilac-blue'],
  ['Зелений', '#2f9e55', 'зеленый зелений green'],
  ['Темно-зелений', '#1f5a3a', 'темно-зеленый темно-зелений dark-green pine cyprus forest'],
  ['Жовтий', '#f6c224', 'желтый жовтий yellow'],
  ['Помаранчевий', '#f58220', 'оранжевый помаранчевий orange'],
  ['Рожевий', '#f39ab6', 'розовый рожевий pink'],
  ['Фіолетовий', '#7a52c7', 'фиолетовый фіолетовий purple violet'],
  ['Бузковий', '#b9a3e3', 'сиреневый бузковий lilac lavender dasheen'],
  ['Сірий', '#8a9099', 'серый сірий grey gray'],
  ['Сріблястий', '#c9ced6', 'серебристый сріблястий silver'],
  ['Золотий', '#d6ad3c', 'золотой золотий gold'],
  ['Рожеве золото', '#e3a898', 'rose-gold'],
  ['Коричневий', '#7a4a2d', 'коричневый коричневий brown chocolate'],
  ['Бежевий', '#e2d2b0', 'бежевый бежевий beige sand antique'],
  ['Бордовий', '#7b1f3f', 'бордовый бордовий burgundy plum wine marsala'],
  ['Бірюзовий', '#20b4ac', 'бирюзовый бірюзовий turquoise teal marine'],
  ['М’ятний', '#9fe3c3', 'мятный м\'ятний mint'],
  ['Прозорий', 'clear', 'прозрачный прозорий transparent clear']
];
const CMAP = new Map();
COLOR_DEFS.forEach(([uk, hex, keys]) => {
  CMAP.set(uk.toLowerCase(), { uk, hex });
  keys.split(' ').forEach((k) => {
    CMAP.set(k.replace(/-/g, ' '), { uk, hex });
    CMAP.set(k, { uk, hex });
  });
});

function colorOf(label) {
  const l = String(label || '').toLowerCase().trim();
  const parts = [l, ...l.split('/').map((x) => x.trim()), ...l.split(/[\s/]+/)];
  for (const k of parts) if (CMAP.has(k)) return CMAP.get(k).hex;
  // два слова підряд: «rose gold», «midnight blue»
  const w = l.split(/[\s/]+/);
  for (let i = 0; i < w.length - 1; i++) {
    const k = `${w[i]} ${w[i + 1]}`;
    if (CMAP.has(k)) return CMAP.get(k).hex;
  }
  return '';
}

/* Переклад назв із прайсу (російською) на українську — по словах */
const RU_UK = {};
`чехол чохол|чехла чохла|чехлы чохли|чехлов чохлів|чехлу чохлу|защитное захисне|защитная захисна|защитный захисний|защитные захисні|защитного захисного|
стекло скло|стекла скла|пленка плівка|пленки плівки|пленку плівку|плёнка плівка|гидрогелевая гідрогелева|гидрогелевые гідрогелеві|гидрогелевая гідрогелева|
бронированная броньована|бронированные броньовані|броня броня|кожаный шкіряний|кожаная шкіряна|кожаные шкіряні|кожа шкіра|силиконовый силіконовий|
силиконовая силіконова|силиконовые силіконові|силикон силікон|прозрачный прозорий|прозрачная прозора|прозрачное прозоре|матовый матовий|матовая матова|матовое матове|
глянцевый глянцевий|противоударный протиударний|противоударная протиударна|магнитный магнітний|магнитная магнітна|магнитное магнітне|магнитные магнітні|
с з|и і|или або|карманом кишенею|карман кишеня|карточек карток|визиток візиток|визитки візитки|камеры камери|камеру камеру|камера камера|
зарядное зарядний|зарядный зарядний|устройство пристрій|устройства пристрої|беспроводное бездротовий|беспроводной бездротовий|беспроводная бездротова|
наушники навушники|наушников навушників|наушниках навушниках|ремешок ремінець|ремешки ремінці|ремешка ремінця|ремень ремінь|
подставка підставка|держатель тримач|держатели тримачі|автомобильный автомобільний|автомобильное автомобільне|автомобильная автомобільна|
универсальный універсальний|универсальная універсальна|цветной кольоровий|цветная кольорова|цвет колір|цвета кольори|набор набір|
микрофиброй мікрофіброю|микрофибра мікрофібра|гибкий гнучкий|гибкая гнучка|тонкий тонкий|тонкая тонка|усиленный посилений|усиленная посилена|
экран екран|экрана екрана|экрану екрану|дисплей дисплей|задняя задня|задняя задня|накладка накладка|рамкой рамкою|рамка рамка|рамки рамки|без без|
полная повна|полный повний|полное повне|полным повним|клей клей|всей всією|поверхностью поверхнею|поверхность поверхня|
защита захист|защиты захисту|защитой захистом|зарядка зарядка|зарядки зарядки|кабель кабель|шнур шнур|провод дріт|
белый білий|черный чорний|красный червоний|синий синій|голубой блакитний|зеленый зелений|желтый жовтий|оранжевый помаранчевий|розовый рожевий|
фиолетовый фіолетовий|сиреневый бузковий|серый сірий|серебристый сріблястий|серебряный срібний|золотой золотий|коричневый коричневий|бежевый бежевий|
бордовый бордовий|бирюзовый бірюзовий|мятный м’ятний|светло світло|темно темно|салатовый салатовий|лимонный лимонний|малиновый малиновий|
персиковый персиковий|песочный пісочний|лавандовый лавандовий|арбузный кавуновий|черничный чорничний|прозрачный прозорий|разноцветный різнокольоровий|
хаки хакі|кофейный кавовий|шоколадный шоколадний|мраморный мармуровий|градиент градієнт|красочный яскравий|яркий яскравий|яркая яскрава|
мужской чоловічий|женский жіночий|детский дитячий|детская дитяча|детские дитячі|детей дітей|мини міні|большой великий|маленький маленький|
игровой ігровий|игровая ігрова|игровые ігрові|игровой ігровий|игры гри|игра гра|игрушка іграшка|игрушки іграшки|
лампа лампа|фонарь ліхтар|фонарик ліхтарик|ночник нічник|колонка колонка|микрофон мікрофон|мышь миша|клавиатура клавіатура|подарок подарунок|
упаковка упаковка|упаковки упаковки|белая біла|черная чорна|красная червона|синяя синя|зеленая зелена|желтая жовта|розовая рожева|серая сіра|
голубая блакитна|фиолетовая фіолетова|коричневая коричнева|золотая золота|серебристая сріблиста|прозрачные прозорі|темный темний|светлый світлий|
темная темна|светлая світла|холодный холодний|теплый теплий|кристалл кристал|жидкий рідкий|жидкие рідкі|жидкая рідка|блестки блискітки|блестящий блискучий|
стразы стрази|стразами стразами|принт принт|рисунком малюнком|рисунок малюнок|рисунки малюнки|узор візерунок|узором візерунком|
бесцветный безбарвний|ударопрочный ударостійкий|ударопрочная ударостійка|ударопрочные ударостійкі|усиленные посилені|усиленными посиленими|углы кути|углами кутами|
беспроводные бездротові|беспроводных бездротових|автодержатель автотримач|накладные накладні|интерактивная інтерактивна|интерактивный інтерактивний|
полимерная полімерна|полимерных полімерних|настольная настільна|настольный настільний|оливковый оливковий|лиловый ліловий|портативное портативне|портативный портативний|
портативная портативна|переходник перехідник|переходников перехідників|часы годинник|радиоуправлении радіокеруванні|телефона телефону|светильник світильник|
шнурок шнурок|шнурков шнурків|пистолет пістолет|фисташковый фісташковий|движения руху|проектор проєктор|карбоновая карбонова|инерционной інерційній|
машинкой машинкою|коралловый кораловий|аппликатор аплікатор|селфи селфі|сенсорный сенсорний|сенсорные сенсорні|накопитель накопичувач|проводная провідна|
сетевой мережевий|мыльными мильними|мыльных мильних|пузырями бульбашками|пузырей бульбашок|петличный петличний|плоттера плотера|воздуха повітря|воздушный повітряний|
аудио аудіо|гидрогелевых гідрогелевих|гидрогелевой гідрогелевої|шариках кульках|шарики кульки|орбизах орбізах|орбизы орбізи|кольцо кільце|кольцевая кільцева|кольцевой кільцевий|
увлажнитель зволожувач|увлажнителем зволожувачем|управления керування|подсветкой підсвічуванням|подсветка підсвічування|светодиодная світлодіодна|съемный знімний|
сменный змінний|сменные змінні|лодка човен|сливовый сливовий|ментоловый ментоловий|настенный настінний|настенная настінна|электрическая електрична|электрический електричний|
электрической електричної|электронный електронний|водяным водяним|водяной водяний|водный водний|охлаждением охолодженням|охлаждающий охолоджувальний|охлаждающая охолоджувальна|
памяти пам’яті|подставкой підставкою|пылесос пилосос|волос волосся|аккумулятор акумулятор|аккумуляторный акумуляторний|аккумуляторные акумуляторні|развивающая розвивальна|
видеорегистратор відеореєстратор|штатива штатива|широкий широкий|широкая широка|металлическое металеве|крепление кріплення|креплениями кріпленнями|под під|автомобиля автомобіля|
массажер масажер|ловушка пастка|насекомых комах|самолет літак|самолета літака|поклейки наклеювання|коврик килимок|очистки очищення|гаджетов гаджетів|двумя двома|солнечная сонячна|солнечной сонячній|
серебряная срібна|серия серія|скрытых прихованих|черно чорно|расходник розхідник|зубная зубна|зубной зубної|щетка щітка|щетки щітки|рисования малювання|дюймов дюймів|удлинитель подовжувач|
отверстий отворів|видеонаблюдения відеоспостереження|лазерная лазерна|держателем тримачем|питания живлення|охлаждающий охолоджувальний|мобильного мобільного|змей змій|автовизитка автовізитка|
термогигрометр термогігрометр|зеркало дзеркало|узкая вузька|карабином карабіном|подголовник підголівник|подголовника підголівника|мышки миші|стабилизатор стабілізатор|гарнитура гарнітура|
электробритва електробритва|разборным розбірним|чехле чохлі|уникальный унікальний|пластиковая пластикова|пластиковый пластиковий|пленок плівок|набором набором|перчатки рукавички|
вязаная в’язана|отверток викруток|встроенный вбудований|встроенной вбудованій|белое біле|винтовка гвинтівка|фитнес фітнес|сиденья сидіння|сиденье сидіння|обучающая навчальна|
рация рація|экшн екшн|шеи шиї|зажимом затискачем|напольная підлогова|угловая кутова|солнцезащитный сонцезахисний|солнцезащитная сонцезахисна|со зі|стальной сталевий|
пропеллером пропелером|заднего заднього|вида виду|амфибия амфібія|багажный багажний|лампой лампою|картридер картрідер|корпуса корпусу|запястья зап’ястя|гейминга геймінгу|
модульный модульний|заваривания заварювання|выпрямитель випрямляч|триммер тример|восьмиколесный восьмиколісний|круглая кругла|хирургическая хірургічна|слойная шарова|фиксатором фіксатором|
отрицательной негативною|ионизацией іонізацією|микрофона мікрофона|заказ замовлення|антискользящий протиковзкий|смартфонов смартфонів|смартфона смартфона|преобразователем перетворювачем|
картонная картонна|освежитель освіжувач|водонепроницаемый водонепроникний|водонепроницаемая водонепроникна|ручной ручний|переднего переднього|плеч плечей|погружной занурювальний|
козырек козирок|присоске присосці|игрушечный іграшковий|антистресс антистрес|звуковым звуковим|эффектом ефектом|музыкальная музична|складная складна|складной складний|мельница млинок|
перца перцю|специй спецій|стикеры стікери|беруши беруші|зонтик парасолька|удаления видалення|катышков катишків|ногтей нігтів|сублимации сублімації|автомобильные автомобільні|
животных тварин|веревкой мотузкою|лента стрічка|клейкая клейка|обложка обкладинка|сигнальная сигнальна|вибросигнализация вібросигналізація|соковыжималка соковижималка|мойки мийки|
триногой триногою|мишень мішень|мышц м’язів|ирригатор іригатор|полости порожнини|рта рота|кофеварка кавоварка|насадки насадки|электрочайник електрочайник|женская жіноча|повязка пов’язка|
подложка підкладка|обогреватель обігрівач|плетенный плетений|динамиком динаміком|ночником нічником|внедорожник позашляховик|скалолаз скелелаз|батарее батареї|видеодомофон відеодомофон|
напитков напоїв|электретный електретний|всенаправленный всенаправлений|поясницы попереку|перкуссионный перкусійний|педикюра педикюру|проекционная проєкційна|крюк гак|вешалка вішак|
пудровый пудровий|компаньон компаньйон|пулемет кулемет|насадкой насадкою|диффузором дифузором|расческа гребінець|многофункциональное багатофункціональне|домашнего домашнього|ухода догляду|
кожей шкірою|лица обличчя|магитное магнітне|велосипедный велосипедний|спасательный рятувальний|конденсаторный конденсаторний|кардиоидный кардіоїдний|мусора сміття|подстаканник підстаканник|
дисплеем дисплеєм|лобовое лобове|из з|птица птах|грузовик вантажівка|боди боді|пусковое пускове|контроллер контролер|экскаватор екскаватор|разветвителем розгалужувачем|прикуривателя прикурювача|
порта порту|соты стільники|управление керування|пультом пультом|
космические космічні|коты коти|котенок кошеня|украинский український|влюбленные закохані|выпуклые опуклі|капибары капібари|сердца серця|викторианская вікторіанська|нежность ніжність|
нежностях ніжностях|нравиться подобається|удачи удачі|плетение плетіння|
сзу мзп|бзу бзп|азу азп|зу зп|машины машини|микрофоном мікрофоном|колонкой колонкою|универсальные універсальні|уникальный унікальний|бесцветная безбарвна|бесцветное безбарвне`
  .replace(/\n/g, '|').split('|').forEach((pair) => {
    const [ru, uk] = pair.trim().split(' ');
    if (ru && uk) RU_UK[ru] = uk;
  });
const RU_WORD = /[А-Яа-яЁёІіЇїЄє]+/g;
function toUk(str) {
  return String(str || '').replace(RU_WORD, (w) => {
    const u = RU_UK[w.toLowerCase()];
    if (!u) return w;
    if (w === w.toUpperCase() && w.length > 1) return u.toUpperCase();
    return w[0] === w[0].toLowerCase() ? u : u[0].toUpperCase() + u.slice(1);
  });
}
const ukLabel = toUk;

/* ====================================================================
   Завантаження даних
   ==================================================================== */
async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  return res.json();
}

// Формат: data/index.json + data/products-N.json (компактні рядки).
// Рядок: [id, name, brand, sku, category, price, oldPrice, img, available, firstSeenDay, restockDay]
async function loadDB() {
  try {
    const idx = await getJSON('data/index.json');
    const base = idx.imgBase || '';
    const chunks = await Promise.all(idx.parts.map((f) => getJSON('data/' + f)));
    const products = chunks.flat().map((r) => ({
      id: r[0], name: r[1], brand: r[2], sku: r[3], category: r[4], price: r[5], oldPrice: r[6],
      img: r[7] && !/^https?:/.test(r[7]) ? base + r[7] : r[7], available: r[8] === 1,
      fs: r[9] || 0, ra: r[10] || 0
    }));
    return { categories: idx.categories, products, updated: idx.updated };
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

/* ====================================================================
   Верстка-каркас, що не залежить від даних (щоб сторінка не була порожньою)
   ==================================================================== */
const posterImgs = POSTERS.map(() => []);
buildSlider();
buildBrandStrip();
mountCatalog($('#heroCat'), 'overlay');
mountCatalog($('#catDrop'), 'inline');
$('#newGrid').innerHTML = skeletons(10);

DB = await loadDB();

/* ====================================================================
   Індекси
   ==================================================================== */
const byId = new Map(), kids = new Map(), groupIndex = new Map();
const ownA = new Map(), ownN = new Map(), ownR = new Map();   // за категоріями: в наявності / новинки / надходження
const brandCnt = new Map(), catBrand = new Map();

const inc = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
const isNewP = (p) => p.fs > 0 && DAY - p.fs <= NEW_DAYS;
const isArrP = (p) => p.ra > 0 && DAY - p.ra <= ARRIVAL_DAYS;

function cleanBrand(b, name) {
  const v = String(b || '').replace(/<.*$/s, '').trim();
  if (!v || /^\d+$/.test(v)) return /itsprint/i.test(name || '') ? 'itsPrint' : '';
  return v;
}

let realNew = 0;
DB.products.forEach((p) => {
  p.id = String(p.id);
  p.sku = String(p.sku || '').replace(/<.*$/s, '');
  p.br = cleanBrand(p.brand, p.name);
  p.u = toUk(p.name);
  p.s = `${p.name} ${p.u} ${p.br} ${p.sku}`.toLowerCase();
  p.n = parseInt(p.id, 10) || 0;
  const u = p.id.indexOf('_');
  p.k = u > 0 ? p.id.slice(0, u) : p.id;
  byId.set(p.id, p);
  if (u > 0) {
    const arr = groupIndex.get(p.k);
    arr ? arr.push(p) : groupIndex.set(p.k, [p]);
  }
  if (p.available) {
    inc(ownA, p.category);
    if (p.br) {
      inc(brandCnt, p.br);
      let m = catBrand.get(p.category);
      if (!m) catBrand.set(p.category, (m = new Map()));
      inc(m, p.br);
    }
  }
  if (p.available && isNewP(p)) { inc(ownN, p.category); realNew++; }
  if (p.available && isArrP(p)) inc(ownR, p.category);
});

DB.categories.forEach((c) => { c.name = toUk(c.name); });   // назви категорій із прайсу теж українською
const catById = new Map(DB.categories.map((c) => [c.id, c]));
DB.categories.forEach((c) => {
  if (c.parentId) kids.set(c.parentId, [...(kids.get(c.parentId) || []), c.id]);
});

const branchCache = new Map();
const branch = (id) => {
  let r = branchCache.get(id);
  if (!r) branchCache.set(id, (r = [id, ...(kids.get(id) || []).flatMap(branch)]));
  return r;
};
const sumBranch = (map, id) => branch(id).reduce((a, i) => a + (map.get(i) || 0), 0);
const depth = (c) => {
  let d = 0, cur = c;
  while (cur && cur.parentId && catById.get(cur.parentId)) { cur = catById.get(cur.parentId); d++; }
  return d;
};

if ($('#cat')) {
  const opts = DB.categories
    .map((c) => ({ id: c.id, name: c.name, d: depth(c), cnt: sumBranch(ownA, c.id) }))
    .filter((c) => c.cnt > 0 && c.d < 2);
  $('#cat').insertAdjacentHTML('beforeend', opts
    .map((c) => `<option value="${esc(c.id)}">${'— '.repeat(c.d)}${esc(c.name)} (${c.cnt})</option>`).join(''));
}
if ($('#sort') && !$('#sort').querySelector('option[value="cat"]')) {
  $('#sort').insertAdjacentHTML('beforeend', '<option value="cat">За категорією</option>');
}

/* ====================================================================
   Матчер моделей (для вибору моделі в меню брендів)
   ==================================================================== */
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

/* ====================================================================
   Фільтри всередині моделі: колір, бренд, форм-фактор чохла
   ==================================================================== */
// Форм-фактор чохла (розпізнається за назвою; один чохол може підходити під кілька пунктів)
const BOOK_RE = /книжк|\bbook\b|\bflip\b|гаманець|гаманец|wallet/i;
const FORMS = [
  ['Книжка', BOOK_RE],
  ['Накладка (задня панель)', (n) => !BOOK_RE.test(n)],
  ['Протиударний', /ударопроч|противоудар|протиудар|camshield|army|defender|armor|armour|shockproof|rugged/i],
  ['З MagSafe / Magnetic', /magnetic|magsafe|магнит|магніт/i],
  ['Силіконовий', /силикон|силікон|silicone|liquid/i],
  ['Прозорий', /прозрач|прозор|transparent|\bclear\b|space case/i],
  ['Ультратонкий', /ультратонк|ultra ?thin|\bslim\b/i],
  ['З кишенею для карток', /карман|кишен|визитк|візитк|card ?holder|картхолд|\bcard\b/i],
  ['Блискітки / Стрази', /блест|стразы|стрази|глиттер|glitter|shining/i],
  ['З принтом', /itsprint|принт|\bprint\b/i]
];
const FORM_ORDER = FORMS.map((f) => f[0]);
function formsOf(p) {
  if (!p._fm) {
    const n = p.name || '';
    p._fm = FORMS.filter(([, t]) => (typeof t === 'function' ? t(n) : t.test(n))).map((f) => f[0]);
  }
  return p._fm;
}

// Колір беремо з кінця назви («… для Samsung Galaxy A07 Зеленый / Dark»), а також із поля colors (старий формат)
const canonColor = (w) => CMAP.get(String(w).toLowerCase().replace(/-/g, ' ').trim())?.uk
  || CMAP.get(String(w).toLowerCase().trim())?.uk || '';
function colorsOf(p) {
  if (p._cl) return p._cl;
  const out = [];
  const add = (c) => { if (c && !out.includes(c)) out.push(c); };
  const t = String(p.name || '').toLowerCase().split(/[\s/,]+/).filter(Boolean).slice(-4);
  for (let i = 0; i < t.length; i++) {
    const two = i + 1 < t.length ? canonColor(`${t[i]} ${t[i + 1]}`) : '';
    if (two) { add(two); i++; continue; }
    add(canonColor(t[i]));
  }
  if (!out.length && Array.isArray(p.colors)) p.colors.forEach((c) => add(canonColor(c)));
  return (p._cl = out);
}
const colorHex = (uk) => COLOR_DEFS.find((c) => c[0] === uk)?.[1] || '';

const FACETS = {
  brand: { st: 'fBrand', get: (p) => (p.br ? [p.br] : []) },
  color: { st: 'fColor', get: colorsOf },
  form: { st: 'fForm', get: formsOf }
};
const facetKeys = Object.keys(FACETS);

// Рахує доступні значення (скільки карток) і відфільтровує за вибраними
function applyFacets(base) {
  const opts = {};
  if (st.type !== 'cases') st.fForm = '';
  for (let pass = 0; pass < 2; pass++) {
    for (const key of facetKeys) {
      if (key === 'form' && st.type !== 'cases') { opts[key] = []; continue; }
      const F = FACETS[key];
      const m = new Map();
      for (const p of base) {
        if (!facetKeys.every((o) => o === key || !st[FACETS[o].st] || FACETS[o].get(p).includes(st[FACETS[o].st]))) continue;
        for (const v of F.get(p)) {
          let s = m.get(v);
          if (!s) m.set(v, (s = new Set()));
          s.add(p.k);
        }
      }
      let arr = [...m].map(([v, s]) => [v, s.size]);
      if (key === 'form') arr.sort((a, b) => FORM_ORDER.indexOf(a[0]) - FORM_ORDER.indexOf(b[0]));
      else arr.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'uk'));
      opts[key] = arr;
      if (st[F.st] && !m.has(st[F.st])) st[F.st] = '';     // вибране значення зникло — скидаємо
    }
  }
  st.facets = opts;
  return base.filter((p) => facetKeys.every((k) => !st[FACETS[k].st] || FACETS[k].get(p).includes(st[FACETS[k].st])));
}

function modelProducts(base, raw) {
  const m = parseModel(raw);
  const pre = base.filter((p) => p.s.includes(m.key) || p.s.includes(m.s[m.s.length - 1] || m.key));
  const strictRes = pre.filter((p) => matchesModel(p, m, true));
  return strictRes.length ? strictRes : pre.filter((p) => matchesModel(p, m, false));
}

/* ====================================================================
   Фільтри з меню: {cats, scope, re, brand}
   ==================================================================== */
const scopeOk = (p, sc) => {
  const t = typeOf(p);
  return sc === 'glassfilm' ? t === 'glass' || t === 'film' : t === sc;
};
const predCache = new WeakMap();
function makePred(f) {
  let fn = predCache.get(f);
  if (fn) return fn;
  const ids = f.cats && f.cats.length ? new Set(f.cats.flatMap(branch)) : null;
  const res = f.re ? [].concat(f.re) : null;
  const sc = f.scope || '', br = f.brand || '';
  fn = (p) => {
    if (sc && !scopeOk(p, sc)) return false;
    if (ids && !ids.has(p.category)) return false;
    if (br && p.br !== br) return false;
    if (res) for (const re of res) if (!re.test(p.name)) return false;
    return true;
  };
  predCache.set(f, fn);
  return fn;
}

/* ====================================================================
   Групування варіантів (колір / дизайн) в одну картку
   ====================================================================
   Товари з одного артикула у прайсі мають id виду 00000070236_1,
   00000070236_2 … — це один товар для однієї моделі, що відрізняється
   кольором або дизайном. Їх ми й обʼєднуємо.                              */
function makeGroups(prods, full = false) {
  const m = new Map();
  for (const p of prods) {
    let g = m.get(p.k);
    if (!g) m.set(p.k, (g = { k: p.k, v: [] }));
    g.v.push(p);
  }
  const out = [];
  for (const g of m.values()) {
    if (full && g.v.length && groupIndex.has(g.k)) {
      g.v = groupIndex.get(g.k).filter((p) => !st.stock || p.available);
    }
    if (!g.v.length) continue;
    if (g.v.length > 1) g.v = [...g.v].sort((a, b) => Number(b.available) - Number(a.available));
    g.i = 0;
    out.push(g);
  }
  return out;
}

function ensureNames(g) {
  if (g.nm !== undefined) return;
  const v = g.v;
  if (v.length === 1) { g.nm = v[0].u; g.lb = null; return; }
  const toks = v.map((p) => p.u.split(/\s+/));
  const min = Math.min(...toks.map((t) => t.length));
  let n = 0;
  while (n < min && toks.every((t) => t[n] === toks[0][n])) n++;
  if (n < 3) { g.nm = v[0].u; g.lb = v.map((p) => p.u); return; }
  g.nm = toks[0].slice(0, n).join(' ').replace(/[\s/\-–,]+$/, '');
  g.lb = toks.map((t, i) => t.slice(n).join(' ').replace(/^[\s/\-–,]+|[\s/\-–,]+$/g, '') || `Варіант ${i + 1}`);
}
const gPrice = (g) => g.v[0].price;

/* ====================================================================
   Список товарів за поточними фільтрами
   ==================================================================== */
const score = (p) => (isNewP(p) ? 1e12 + p.fs * 1e6 : 0) + (p.n % 1e9);
const design = (p) => p.name.split(/\sдля\s/i)[0];

let freshCache = null;
function freshPool() {
  if (!freshCache) {
    freshCache = DB.products.filter((p) => p.available && (isNewP(p) || p.k !== p.id));
    freshCache.sort((a, b) => score(b) - score(a));
  }
  return freshCache;
}

function list() {
  st.typeCounts = null;
  if (st.special === 'new') return makeGroups(freshPool().slice(0, 600), true);
  if (st.special === 'arrivals') return makeGroups(DB.products.filter((p) => p.available && isArrP(p)).sort((a, b) => b.ra - a.ra), true);

  const ids = st.cat ? new Set(branch(st.cat)) : null;
  const fp = st.f ? makePred(st.f) : null;
  let r = DB.products.filter((p) => (!st.stock || p.available) && (!ids || ids.has(p.category)) && (!fp || fp(p)));

  st.facets = null;
  if (st.exactModel) {
    r = modelProducts(r, st.exactModel);
    // рахуємо картки (а не окремі варіанти кольору) в кожній категорії
    const ks = {};
    r.forEach((p) => (ks[typeOf(p)] ||= new Set()).add(p.k));
    st.typeCounts = Object.fromEntries(Object.entries(ks).map(([k, s]) => [k, s.size]));
    // окремої вкладки «Усе» немає: відкриваємо першу категорію, де є товари
    if (!st.typeCounts[st.type]) st.type = (TYPES.find(([k]) => st.typeCounts[k]) || [''])[0];
    r = applyFacets(r.filter((p) => typeOf(p) === st.type));
  } else {
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

  if (!st.stock && !st.sort) {
    r = [...r].sort((a, b) => Number(b.available) - Number(a.available));
  }

  let groups = makeGroups(r);
  if (st.sort === 'asc') groups.sort((a, b) => gPrice(a) - gPrice(b));
  else if (st.sort === 'desc') groups.sort((a, b) => gPrice(b) - gPrice(a));
  else if (st.sort === 'cat') groups.sort((a, b) => (catById.get(a.v[0].category)?.name || '').localeCompare(catById.get(b.v[0].category)?.name || '', 'uk'));
  return groups;
}

/* ====================================================================
   Картка товару
   ==================================================================== */
function skeletons(n) {
  return Array.from({ length: n }, () => '<div class="card sk" aria-hidden="true"><div class="thumb"></div><i></i><i class="s"></i></div>').join('');
}

function swatchesHTML(g, max = 5) {
  const n = g.v.length;
  if (g.v.some((_, i) => !colorOf(g.lb[i]))) max = 3;
  let idx = g.v.map((_, i) => i);
  if (n > max) {
    idx = idx.slice(0, max);
    if (g.i >= max) idx[max - 1] = g.i;
  }
  const html = idx.map((i) => {
    const p = g.v[i], lb = ukLabel(g.lb[i]), hex = colorOf(g.lb[i]);
    const cls = `sw${i === g.i ? ' on' : ''}${p.available ? '' : ' off'}${hex === 'clear' ? ' clear' : ''}${hex ? '' : ' txt'}`;
    const style = hex && hex !== 'clear' ? ` style="--c:${hex}"` : '';
    const text = hex ? '' : esc(lb.length > 9 ? lb.slice(0, 8) + '…' : lb);
    return `<button type="button" class="${cls}" data-i="${i}"${style} title="${esc(lb)}${p.available ? '' : ' — немає'}" aria-label="${esc(lb)}">${text}</button>`;
  }).join('');
  return html + (n > max ? `<button type="button" class="sw-more" aria-label="Усі варіанти">+${n - max}</button>` : '');
}

function badgesHTML(p) {
  const disc = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  return (disc ? `<span class="b sale">−${disc}%</span>` : '') + (isNewP(p) ? '<span class="b new">Новинка</span>' : '');
}

function priceHTML(p) {
  const old = p.oldPrice && p.oldPrice > p.price ? `<span class="old">${money(p.oldPrice)}</span>` : '';
  return `${money(p.price)}${old}`;
}

function cardHTML(g) {
  ensureNames(g);
  const p = g.v[g.i], multi = g.v.length > 1;
  return `<article class="card${p.available ? '' : ' is-out'}" tabindex="0" data-k="${esc(g.k)}">
    <div class="thumb${p.img ? '' : ' noimg'}">
      <img src="${esc(p.img)}" alt="${esc(g.nm)}" loading="lazy" decoding="async" width="300" height="400">
      <div class="ph">Фото відсутнє</div>
      <div class="badges">${badgesHTML(p)}</div>
    </div>
    ${multi ? `<div class="sws" role="group" aria-label="Варіанти">${swatchesHTML(g)}</div>` : ''}
    <h3>${esc(g.nm)}</h3>
    <div class="meta">${multi ? `<span class="vl">${esc(ukLabel(g.lb[g.i]))}</span>` : `${esc(p.br)}${p.sku ? `${p.br ? ' · ' : ''}арт. ${esc(p.sku)}` : ''}`}</div>
    <div class="foot">
      <span class="price">${priceHTML(p)}</span>
      <span class="stock ${p.available ? 'ok' : 'no'}">${p.available ? 'В наявності' : 'Немає'}</span>
    </div>
    <button type="button" class="add-mini" data-add="${esc(p.id)}" ${p.available ? '' : 'disabled'}>${p.available ? 'У кошик' : 'Немає в наявності'}</button>
  </article>`;
}

function updateCard(card, g) {
  const p = g.v[g.i];
  const thumb = $('.thumb', card), img = $('img', thumb);
  thumb.classList.toggle('noimg', !p.img);
  if (p.img) img.src = p.img;
  $('.badges', card).innerHTML = badgesHTML(p);
  $('.price', card).innerHTML = priceHTML(p);
  const stock = $('.stock', card);
  stock.className = `stock ${p.available ? 'ok' : 'no'}`;
  stock.textContent = p.available ? 'В наявності' : 'Немає';
  const add = $('.add-mini', card);
  add.dataset.add = p.id;
  add.disabled = !p.available;
  add.textContent = p.available ? 'У кошик' : 'Немає в наявності';
  card.classList.toggle('is-out', !p.available);
  const vl = $('.vl', card);
  if (vl) vl.textContent = ukLabel(g.lb[g.i]);
  const sws = $('.sws', card);
  if (sws) sws.innerHTML = swatchesHTML(g);
}

function bindGrid(el, getMap) {
  el.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card || card.classList.contains('sk')) return;
    const g = getMap().get(card.dataset.k);
    if (!g) return;
    const sw = e.target.closest('.sw');
    if (sw) { g.i = +sw.dataset.i; updateCard(card, g); return; }
    if (e.target.closest('.sw-more')) { openProduct(g); return; }
    const add = e.target.closest('[data-add]');
    if (add) {
      addToCart(add.dataset.add);
      const old = add.textContent;
      add.textContent = '✓ Додано';
      add.classList.add('done');
      setTimeout(() => { add.textContent = old; add.classList.remove('done'); }, 1100);
      return;
    }
    openProduct(g);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('card')) {
      const g = getMap().get(e.target.dataset.k);
      if (g) openProduct(g);
    }
  });
}

// Помилка завантаження фото → показуємо заглушку
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && t.closest('.thumb')) t.closest('.thumb').classList.add('noimg');
}, true);

/* ====================================================================
   Каталог: відображення списку
   ==================================================================== */
let current = [];
const gridMap = new Map();

function appendCards(groups) {
  const grid = $('#grid');
  groups.forEach((g) => gridMap.set(g.k, g));
  grid.insertAdjacentHTML('beforeend', groups.map(cardHTML).join(''));
}

function refresh() {
  current = list();
  st.page = 1;
  gridMap.clear();
  const grid = $('#grid');
  grid.innerHTML = '';
  const shown = current.slice(0, PAGE);
  if (shown.length) appendCards(shown);
  else grid.innerHTML = emptyHTML();
  $('#count').textContent = `${current.length.toLocaleString('uk-UA')} ${plural(current.length, ['товар', 'товари', 'товарів'])}`;
  $('#more').hidden = shown.length >= current.length;
  renderChips();
  renderFacets();
  updateHead();
}

function more() {
  if (st.view !== 'catalog') return;
  const from = st.page * PAGE;
  if (from >= current.length) { $('#more').hidden = true; return; }
  st.page++;
  appendCards(current.slice(from, from + PAGE));
  $('#more').hidden = st.page * PAGE >= current.length;
}

function emptyHTML() {
  if (st.special === 'arrivals') {
    return `<div class="empty"><strong>Нових надходжень поки немає</strong><p>Тут зʼявляються товари, які знову стали доступні за останні ${ARRIVAL_DAYS} днів. Список накопичується після кількох оновлень каталогу.</p></div>`;
  }
  return `<div class="empty"><strong>Нічого не знайдено</strong><p>Змініть запит${st.stock ? ', зніміть позначку «Лише в наявності»' : ''} або скиньте фільтр.</p></div>`;
}

function renderChips() {
  const box = $('#typeChips');
  const c = st.typeCounts;
  if (!c) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML =
    TYPES.filter(([k]) => c[k]).map(([k, l]) => `<button type="button" class="chip${st.type === k ? ' active' : ''}" data-type="${k}">${l} <b>${c[k]}</b></button>`).join('');
}

function renderFacets() {
  const inModel = !!st.exactModel && !!st.facets;
  $('#catField').hidden = true;                          // вибір категорії зі списку прибрано скрізь
  const fill = (id, field, opts, cur, all) => {
    const sel = $(id);
    $(field).hidden = !inModel || opts.length < 2 && !cur;
    sel.innerHTML = `<option value="">${all}</option>` +
      opts.map(([v, n]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(v)} (${n})</option>`).join('');
  };
  const f = st.facets || { brand: [], color: [], form: [] };
  fill('#fBrand', '#fBrandField', f.brand, st.fBrand, 'Усі бренди');
  fill('#fForm', '#fFormField', st.type === 'cases' ? f.form : [], st.fForm, 'Усі форм-фактори');
  const cBox = $('#fColor');
  $('#fColorField').hidden = !inModel || f.color.length < 2 && !st.fColor;
  cBox.innerHTML = f.color.map(([c, n]) => {
    const hex = colorHex(c);
    return `<button type="button" class="sw${st.fColor === c ? ' on' : ''}${hex === 'clear' ? ' clear' : ''}" data-color="${esc(c)}"${hex && hex !== 'clear' ? ` style="--c:${hex}"` : ''} title="${esc(c)} (${n})" aria-label="${esc(c)}" aria-pressed="${st.fColor === c}"></button>`;
  }).join('') + (st.fColor ? '<button type="button" class="fsw-reset" data-color="">Скинути ×</button>' : '');
}

function updateHead() {
  let title = 'Усі товари', note = '';
  if (st.special === 'new') {
    title = 'Новинки';
    note = realNew ? `Додано за останні ${NEW_DAYS} днів, далі — найновіші позиції каталогу.` : 'Найновіші позиції каталогу.';
  } else if (st.special === 'arrivals') {
    title = 'Надходження';
    note = `Товари, які знову зʼявилися в наявності за останні ${ARRIVAL_DAYS} днів.`;
  } else if (st.exactModel) title = st.exactModel;
  else if (st.q) title = `Пошук: «${st.q}»`;
  else if (st.f) title = st.title || 'Добірка';
  else if (st.cat) title = catById.get(st.cat)?.name || 'Каталог';
  $('#viewTitle').textContent = title;
  $('#crumbNow').textContent = title;
  const n = $('#viewNote');
  n.hidden = !note;
  n.textContent = note;
  const active = st.special || st.exactModel || st.q || st.f || st.cat;
  $('#resetModelBtn').hidden = !active;
  document.title = `${title} — Mobil Svit`;
}

/* ====================================================================
   Навігація між «Головна» і «Каталог»
   ==================================================================== */
function route() {
  const v = location.hash.startsWith('#/catalog') ? 'catalog' : location.hash.startsWith('#/checkout') ? 'checkout' : 'home';
  st.view = v;
  $('#home').hidden = v !== 'home';
  $('#catalogView').hidden = v !== 'catalog';
  $('#checkoutView').hidden = v !== 'checkout';
  if (v !== 'checkout') $('#coDone').hidden = true;
  closeMenus();
  if (v === 'catalog') refresh();
  else if (v === 'checkout') { renderCheckout(); document.title = 'Оформлення замовлення — Mobil Svit'; }
  else document.title = 'Mobil Svit — аксесуари для смартфонів: чохли, скло, зарядки, кабелі';
  window.scrollTo({ top: 0 });
}
function navigate(v) {
  const h = v === 'catalog' ? '#/catalog' : v === 'checkout' ? '#/checkout' : '#/';
  if (location.hash === h) route();
  else location.hash = h;
}
window.addEventListener('hashchange', route);

function clearFilters() {
  st.q = ''; st.cat = ''; st.f = null; st.title = ''; st.special = '';
  st.exactModel = ''; st.type = ''; st.sort = '';
  st.fBrand = ''; st.fColor = ''; st.fForm = '';
  $('#q').value = '';
  $('#cat').value = '';
  $('#sort').value = '';
  $('#clearSearch').hidden = true;
}
function openCatalog(patch = {}) {
  clearFilters();
  Object.assign(st, patch);
  if (patch.cat) $('#cat').value = patch.cat;
  navigate('catalog');
}
const openFilter = (f) => openCatalog({ f, title: f.title || f.label || '' });

/* ====================================================================
   Меню каталогу (бокове меню + панель як на макеті)
   ==================================================================== */
const SPECS = [];        // усі пункти меню
const facetData = { ready: false, scopeBrand: new Map() };

function addSpec(spec) { spec.id = SPECS.push(spec) - 1; return spec; }

function specFromItem(it) {
  const s = { scope: it.scope, re: it.re, brand: it.brand, cats: it.cats };
  if (it.cat) {
    const c = catById.get(String(it.cat));
    if (!c) return null;
    s.cats = [c.id];
    s.label = it.label || c.name;
  } else if (it.gadgetBrand) {
    const ids = [DB.categories.find((c) => c.parentId === '1' && c.name === it.gadgetBrand)?.id,
      DB.categories.find((c) => !c.parentId && c.name === it.gadgetBrand)?.id].filter(Boolean);
    if (!ids.length) return null;
    s.cats = ids;
    s.label = it.gadgetBrand;
  } else {
    s.label = it.label;
  }
  s.title = it.title || s.label;
  return s;
}

function needsPass(s) { return !!(s.scope || s.re); }

function countOf(s) {
  if (!needsPass(s)) {
    if (s.brand && !s.cats) return { n: brandCnt.get(s.brand) || 0, nw: 0, ra: 0 };
    if (s.cats && !s.brand) {
      return {
        n: s.cats.reduce((a, c) => a + sumBranch(ownA, c), 0),
        nw: s.cats.reduce((a, c) => a + sumBranch(ownN, c), 0),
        ra: s.cats.reduce((a, c) => a + sumBranch(ownR, c), 0)
      };
    }
    if (s.cats && s.brand) {
      return { n: s.cats.flatMap(branch).reduce((a, c) => a + (catBrand.get(c)?.get(s.brand) || 0), 0), nw: 0, ra: 0 };
    }
  }
  return s.cnt || null;      // null = ще не пораховано
}

// Підрахунок для пунктів із ключовими словами — шматками, щоб не підвисала сторінка
function runFacetPass() {
  const facets = SPECS.filter(needsPass);
  if (!facets.length) { facetData.ready = true; return; }
  const preds = facets.map(makePred);
  facets.forEach((s) => (s.cnt = { n: 0, nw: 0, ra: 0 }));
  const sb = { glassfilm: new Map(), cases: new Map() };
  const P = DB.products;
  let i = 0;
  const step = () => {
    const end = Math.min(P.length, i + 6000);
    for (; i < end; i++) {
      const p = P[i];
      if (!p.available) continue;
      const nw = isNewP(p), ra = isArrP(p);
      const t = typeOf(p);
      if (p.br) {
        if (t === 'glass' || t === 'film') inc(sb.glassfilm, p.br);
        else if (t === 'cases') inc(sb.cases, p.br);
      }
      for (let k = 0; k < facets.length; k++) {
        if (preds[k](p)) {
          const c = facets[k].cnt;
          c.n++;
          if (nw) c.nw++;
          if (ra) c.ra++;
        }
      }
    }
    if (i < P.length) setTimeout(step, 0);
    else { facetData.scopeBrand = sb; facetData.ready = true; refreshMenus(); }
  };
  setTimeout(step, 250);
}

function autoBrandItems(sec) {
  const a = sec.autoBrands;
  let map;
  if (a.cats) {
    map = new Map();
    a.cats.flatMap(branch).forEach((c) => catBrand.get(c)?.forEach((n, b) => inc(map, b, n)));
  } else if (a.scope) map = facetData.scopeBrand[a.scope === 'glassfilm' ? 'glassfilm' : a.scope] || new Map();
  else map = brandCnt;
  return [...map.entries()].sort((x, y) => y[1] - x[1]).slice(0, a.n || 8).map(([b, n]) => {
    const s = { brand: b, label: b, title: b, cats: a.cats, scope: a.scope, cnt: { n, nw: 0, ra: 0 } };
    if (a.scope) s.scope = a.scope;
    return s;
  });
}

function resolveSection(sec) {
  let specs = [];
  if (sec.children) {
    specs = (kids.get(sec.children) || [])
      .map((id) => specFromItem({ cat: id }))
      .filter(Boolean)
      .map((s) => ((s.cnt = countOf(s)), s))
      .sort((a, b) => b.cnt.n - a.cnt.n);
  } else if (sec.autoBrands) {
    specs = autoBrandItems(sec);
  } else {
    specs = (sec.items || []).map((it) => sec._cache?.get(it) || null);
  }
  return specs;
}

// Побудова пунктів один раз
function prepareMenu() {
  SIDEBAR.forEach((cat) => {
    cat.sections.forEach((sec) => {
      if (sec.items) {
        sec._cache = new Map();
        sec.items.forEach((it) => {
          const s = specFromItem(it);
          if (s) { addSpec(s); sec._cache.set(it, s); }
        });
      } else if (sec.children) {
        (kids.get(sec.children) || []).forEach((id) => {
          const s = specFromItem({ cat: id });
          if (s) addSpec(s);
        });
      }
    });
  });
}

const ALL_SPEC = {
  kids: { cats: ['320003'] }, cases: { scope: 'cases' }, glass: { scope: 'glassfilm' }, straps: { re: /ремеш|ремін|браслет|strap/i },
  charge: { cats: ['190703'] }, audio: { cats: ['191103'] }, auto: { cats: ['68303'] }, cables: { cats: ['68203'] }, home: { cats: ['178603'] }
};

const flat = (map) => ({ map });
function linkHTML(s) {
  if (!s.id && s.id !== 0) addSpec(s);
  const c = countOf(s);
  const hide = c && c.n === 0;
  if (hide) return '';
  const nums = c ? `<span class="n">(${c.n.toLocaleString('uk-UA')})</span>${c.nw ? `<i class="g">+${c.nw}</i>` : ''}${c.ra ? `<i class="o">+${c.ra}</i>` : ''}` : '';
  return `<li><a href="#/catalog" data-s="${s.id}">${esc(s.label)} ${nums}</a></li>`;
}

function panelHTML(cat) {
  const secs = cat.sections.map((sec) => {
    const items = resolveSection(sec).filter(Boolean).map(linkHTML).join('');
    if (!items) return '';
    return `<section class="cw-sec"><h4>${esc(sec.title)}${sec.tag ? ` <em>${esc(sec.tag)} !</em>` : ''}</h4><ul>${items}</ul></section>`;
  }).join('');
  const all = ALL_SPEC[cat.key];
  const allLink = all ? `<a class="cw-all" href="#/catalog" data-all="${cat.key}">Усі товари розділу «${esc(cat.title)}»</a>` : '';
  return `<button type="button" class="cw-back">← Усі розділи</button><div class="cw-cols">${secs || '<p class="muted">Товарів у цьому розділі поки немає.</p>'}</div>${allLink}`;
}

function mountCatalog(host, mode) {
  host.innerHTML = `<div class="cw ${mode}">
    <ul class="cw-side" role="menu">${SIDEBAR.map((c, i) =>
      `<li role="none"><button type="button" role="menuitem" data-i="${i}" aria-haspopup="true">${icon(c.icon)}<span>${esc(c.title)}</span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></li>`).join('')}</ul>
    <div class="cw-panel" hidden></div></div>`;
  const root = $('.cw', host), panel = $('.cw-panel', root);
  const m = { root, panel, cur: -1, mode };
  mounts.push(m);
  const show = (i) => {
    m.cur = i;
    $$('.cw-side button', root).forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
    if (!ready) { panel.innerHTML = '<p class="muted pad">Завантаження каталогу…</p>'; }
    else panel.innerHTML = panelHTML(SIDEBAR[i]);
    panel.hidden = false;
    root.classList.add('show-panel');
  };
  m.show = show;
  m.hide = () => {
    m.cur = -1;
    panel.hidden = mode === 'overlay';
    root.classList.remove('show-panel');
    $$('.cw-side button', root).forEach((b) => b.classList.remove('on'));
    if (mode === 'inline' && isDesktop()) show(0);
  };
  const side = $('.cw-side', root);
  side.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) show(+b.dataset.i);
  });
  if (canHover) {
    let t;
    side.addEventListener('mouseover', (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b || !isDesktop() || +b.dataset.i === m.cur) return;
      clearTimeout(t);
      t = setTimeout(() => show(+b.dataset.i), 70);
    });
    if (mode === 'overlay') root.addEventListener('mouseleave', () => { clearTimeout(t); m.hide(); });
  }
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.cw-back')) { m.hide(); return; }
    const a = e.target.closest('a[data-s], a[data-all]');
    if (!a) return;
    e.preventDefault();
    if (a.dataset.all) {
      const cat = SIDEBAR.find((c) => c.key === a.dataset.all);
      openFilter({ ...ALL_SPEC[cat.key], title: cat.title });
    } else {
      const s = SPECS[+a.dataset.s];
      openFilter({ cats: s.cats, scope: s.scope, re: s.re, brand: s.brand, title: s.title });
    }
  });
  if (mode === 'inline') m.hide = ((orig) => () => { orig(); })(m.hide);
}
const refreshMenus = () => mounts.forEach((m) => { if (m.cur >= 0 && ready) m.panel.innerHTML = panelHTML(SIDEBAR[m.cur]); });

const catDrop = $('#catDrop');
function openDrop() {
  closeMega();
  catDrop.style.setProperty('--hh', $('#header').getBoundingClientRect().bottom + 'px');
  catDrop.hidden = false;
  $('#catBtn').setAttribute('aria-expanded', 'true');
  $('#scrim').hidden = false;
  document.body.classList.add('drop-open');
  const m = mounts.find((x) => x.mode === 'inline');
  if (isDesktop()) m.show(0);
  else m.hide();
}
function closeDrop() {
  catDrop.hidden = true;
  $('#catBtn').setAttribute('aria-expanded', 'false');
  if (!$('#megaMenu') || $('#megaMenu').hidden) $('#scrim').hidden = true;
  document.body.classList.remove('drop-open');
}
function closeMenus() { closeDrop(); closeMega(); mounts.forEach((m) => m.mode === 'overlay' && m.hide()); }

$('#catBtn').addEventListener('click', () => {
  if (st.view === 'home' && isDesktop()) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('#heroCat button')?.focus();
    return;
  }
  catDrop.hidden ? openDrop() : closeDrop();
});
$('#scrim').addEventListener('click', closeMenus);

/* ====================================================================
   Верхня смуга брендів + меню моделей
   ==================================================================== */
const GADGET_RE = [
  ['Apple', /iphone|ipad|apple|airpods|macbook/i], ['Samsung', /samsung|galaxy/i], ['Xiaomi', /xiaomi|redmi|poco|\bmi\b/i],
  ['Motorola', /motorola|\bmoto\b/i], ['Google', /google|pixel/i], ['Oppo', /oppo/i], ['Infinix', /infinix/i]
];
const gadgetBrandOf = (p) => (GADGET_RE.find(([, re]) => re.test(p.name)) || ['Інші'])[0];

function buildBrandStrip() {
  const names = [...BRAND_STRIP, 'Інші'];
  const stat = {};
  {
    DB.products.forEach((p) => {
      if (!p.available) return;
      const nw = isNewP(p), ra = isArrP(p);
      if (!nw && !ra) return;
      const b = gadgetBrandOf(p);
      stat[b] ||= { nw: 0, ra: 0 };
      if (nw) stat[b].nw++;
      if (ra) stat[b].ra++;
    });
  }
  $('#brandList').innerHTML = names.map((b) => {
    const s = stat[b] || { nw: 0, ra: 0 };
    const badges = s.nw || s.ra ? `<span class="bb">${s.nw ? `<i class="g">${s.nw}</i>` : ''}${s.ra ? `<i class="o">${s.ra}</i>` : ''}</span>` : '';
    return `<li><button type="button" data-brand="${b === 'Інші' ? 'More' : esc(b)}"><span>${esc(b)}</span>${badges}</button></li>`;
  }).join('');
}

const MENU = window.MODELS_MENU || {};
function getMenuSections(brandKey) {
  if (brandKey === 'More') return OTHER_BRANDS.flatMap((b) => (MENU[b] || []).map((grp) => ({ title: b, models: grp.models })));
  return MENU[brandKey] || [];
}

function renderMegaMenu() {
  const menuEl = $('#megaMenu');
  const brand = st.activeBrand;
  $$('#brandList button').forEach((b) => b.classList.toggle('active', b.dataset.brand === brand));
  if (!brand) { menuEl.hidden = true; if (catDrop.hidden) $('#scrim').hidden = true; return; }
  closeDrop();
  menuEl.hidden = false;
  $('#scrim').hidden = false;
  $('#megaTitle').textContent = brand === 'More' ? 'Інші бренди смартфонів' : `Моделі ${brand}`;
  $('#allBrandBtn').hidden = brand === 'More';
  const filterQ = st.menuFilter.trim().toLowerCase();
  $('#megaCols').innerHTML = getMenuSections(brand).map((sec) => {
    let models = [...(sec.models || [])];
    if (filterQ) models = models.filter((m) => m.toLowerCase().includes(filterQ));
    if (st.menuSort === 'alpha') models.sort((a, b) => a.localeCompare(b, 'uk'));
    if (!models.length) return '';
    return `<div class="mega-group"><div class="mega-group-title">${esc(sec.title)}</div><ul>${models.map((m) => `<li><button type="button" data-model="${esc(m)}">${esc(m)}</button></li>`).join('')}</ul></div>`;
  }).join('') || '<p class="muted pad">Нічого не знайдено</p>';
}
function closeMega() { if (st.activeBrand) { st.activeBrand = null; renderMegaMenu(); } }

$('#brandList').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-brand]');
  if (!btn) return;
  const b = btn.dataset.brand;
  st.activeBrand = st.activeBrand === b ? null : b;
  st.menuFilter = '';
  $('#megaSearch').value = '';
  renderMegaMenu();
});
$('#megaSearch').addEventListener('input', (e) => { st.menuFilter = e.target.value; renderMegaMenu(); });
$('#megaClose').addEventListener('click', closeMega);
$$('.mega-sort .pill').forEach((pill) => {
  pill.onclick = () => {
    st.menuSort = pill.dataset.msort;
    $$('.mega-sort .pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    renderMegaMenu();
  };
});
$('#allBrandBtn').addEventListener('click', () => {
  const brand = st.activeBrand;
  if (!brand) return;
  const ids = [DB.categories.find((c) => c.parentId === '1' && c.name === brand)?.id,
    DB.categories.find((c) => !c.parentId && c.name === brand)?.id].filter(Boolean);
  st.activeBrand = null;
  renderMegaMenu();
  if (ids.length) openFilter({ cats: ids, title: `Усі товари ${brand}` });
  else openCatalog({ q: brand });
  if (!ids.length) { $('#q').value = brand; $('#clearSearch').hidden = false; }
});
$('#megaCols').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-model]');
  if (!btn) return;
  st.activeBrand = null;
  renderMegaMenu();
  openCatalog({ exactModel: btn.dataset.model });
});
$('#typeChips').addEventListener('click', (e) => {
  const c = e.target.closest('.chip');
  if (!c) return;
  st.type = c.dataset.type;
  st.fBrand = ''; st.fColor = ''; st.fForm = '';
  refresh();
});
$('#fBrand').addEventListener('change', (e) => { st.fBrand = e.target.value; refresh(); });
$('#fForm').addEventListener('change', (e) => { st.fForm = e.target.value; refresh(); });
$('#fColor').addEventListener('click', (e) => {
  const b = e.target.closest('[data-color]');
  if (!b) return;
  st.fColor = st.fColor === b.dataset.color ? '' : b.dataset.color;
  refresh();
});

/* ====================================================================
   Слайдер із постерами
   ==================================================================== */
function posterHTML(p, i) {
  const imgs = (p.image ? [p.image] : posterImgs[i]).slice(0, 3);
  return `<div class="slide theme-${esc(p.theme || 'plum')}${i === 0 ? ' on' : ''}" role="group" aria-roledescription="слайд" aria-label="${i + 1} з ${POSTERS.length}" data-i="${i}" ${i === 0 ? '' : 'aria-hidden="true"'}>
    <div class="slide-copy">
      <h2>${esc(p.title).replace(/\n/g, '<br>')}</h2>
      <p>${esc(p.text)}</p>
      <div class="cta-row">${(p.links && p.links.length
        ? p.links.map((l, j) => `<button type="button" class="cta" data-poster="${i}" data-link="${j}" ${i === 0 ? '' : 'tabindex="-1"'}>${esc(l.label)}</button>`)
        : [`<button type="button" class="cta" data-poster="${i}" ${i === 0 ? '' : 'tabindex="-1"'}>${esc(p.cta)}</button>`]).join('')}</div>
    </div>
    <div class="slide-art" aria-hidden="true">${imgs.map((src, k) => `<figure style="--k:${k}"><img src="${esc(src)}" alt="" decoding="async"></figure>`).join('')}</div>
  </div>`;
}

function buildSlider() {
  const el = $('#slider');
  el.innerHTML = `<div class="slides">${POSTERS.map(posterHTML).join('')}</div>
    <button type="button" class="s-arrow prev" aria-label="Попередній слайд"><svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg></button>
    <button type="button" class="s-arrow next" aria-label="Наступний слайд"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button>
    <div class="s-dots" role="tablist">${POSTERS.map((_, i) => `<button type="button" role="tab" class="${i === 0 ? 'on' : ''}" data-i="${i}" aria-label="Слайд ${i + 1}" aria-selected="${i === 0}"></button>`).join('')}</div>`;

  const go = (n) => {
    slideIdx = (n + POSTERS.length) % POSTERS.length;
    $$('.slide', el).forEach((s, i) => {
      const on = i === slideIdx;
      s.classList.toggle('on', on);
      s.setAttribute('aria-hidden', String(!on));
      $$('.cta', s).forEach((b) => { b.tabIndex = on ? 0 : -1; });
    });
    $$('.s-dots button', el).forEach((d, i) => { d.classList.toggle('on', i === slideIdx); d.setAttribute('aria-selected', String(i === slideIdx)); });
  };
  const play = () => {
    clearInterval(slideTimer);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    slideTimer = setInterval(() => go(slideIdx + 1), 6500);
  };
  el.addEventListener('click', (e) => {
    if (e.target.closest('.prev')) { go(slideIdx - 1); play(); }
    else if (e.target.closest('.next')) { go(slideIdx + 1); play(); }
    else if (e.target.closest('.s-dots button')) { go(+e.target.closest('button').dataset.i); play(); }
    else if (e.target.closest('[data-poster]')) {
      const b = e.target.closest('[data-poster]'), P = POSTERS[+b.dataset.poster];
      if (b.dataset.link !== undefined) openCatalog({ exactModel: P.links[+b.dataset.link].model });
      else openFilter({ ...P.filter });
    }
  });
  el.addEventListener('mouseenter', () => clearInterval(slideTimer));
  el.addEventListener('mouseleave', play);
  el.addEventListener('focusin', () => clearInterval(slideTimer));
  el.addEventListener('focusout', play);
  let x0 = null;
  el.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  el.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) { go(slideIdx + (dx < 0 ? 1 : -1)); play(); }
  });
  document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(slideTimer) : play()));
  play();
}

// Фото для постерів беремо з реальних товарів каталогу
function fillPosterImages() {
  POSTERS.forEach((p, i) => {
    if (p.image || !p.images) return;
    const pred = makePred(p.images);
    const seen = new Set(), out = [];
    const pool = p.images.scope === 'cases' || p.images.q ? freshPool() : DB.products;
    const q = p.images.q;
    for (const x of pool) {
      if (out.length >= 3) break;
      if (!x.available || !x.img || !pred(x)) continue;
      if (q && !x.s.includes(q)) continue;
      const d = design(x);
      if (seen.has(d)) continue;
      seen.add(d);
      out.push(x.img);
    }
    posterImgs[i] = out;
    const art = $(`.slide[data-i="${i}"] .slide-art`);
    if (art) art.innerHTML = out.map((src, k) => `<figure style="--k:${k}"><img src="${esc(src)}" alt="" decoding="async"></figure>`).join('');
  });
}

/* ====================================================================
   Головна: «Новинки»
   ==================================================================== */
const newMap = new Map();
function renderNewShelf() {
  const seen = new Set(), picked = [];
  const groups = makeGroups(freshPool().slice(0, 400), true);
  for (const g of groups) {
    const d = design(g.v[0]);
    if (seen.has(d)) continue;
    seen.add(d);
    picked.push(g);
    if (picked.length >= 10) break;
  }
  newMap.clear();
  picked.forEach((g) => newMap.set(g.k, g));
  $('#newGrid').innerHTML = picked.length ? picked.map(cardHTML).join('') : '<div class="empty"><p>Новинок поки немає.</p></div>';
}

/* ====================================================================
   Картка товару у вікні
   ==================================================================== */

/* Характеристики товару — розпізнаються з назви та категорії */
const MATERIALS = [
  ['TPU + PC', /tpu\s*\+\s*pc/i], ['TPU', /\btpu\b(?!\s*\+\s*pc)/i], ['Силікон', /силикон|силікон|silicone|liquid/i],
  ['Штучна шкіра', /кожа|кожан|шкір|leather|эко/i], ['Пластик', /пластик|\bpc\b(?!\s*\+)/i], ['Метал', /metal|метал|алюмин|алюмін/i],
  ['Тканина', /ткан|fabric|текстил/i], ['Гідрогель', /гидрогел|гідрогел|hydrogel/i], ['Броньована плівка', /бронь|бронир|armor/i]
];
const FEATURES = [
  ['MagSafe / Magnetic', /magnetic|magsafe|магнит|магніт/i], ['Захист камери', /камер|camera|camshield/i],
  ['Кільце-підставка', /\bring\b|подставк|підставк|кольц|кільц/i], ['Кишеня для карток', /карман|кишен|визитк|візитк|card ?holder|картхолд/i],
  ['Протиударний', /ударопроч|противоудар|протиудар|army|defender|armor|shockproof/i], ['Матове покриття', /матов|matte/i],
  ['Антишпигун', /приват|антишпион|privacy/i], ['Блискітки / стрази', /блест|стразы|стрази|glitter|shining/i],
  ['З принтом', /itsprint|принт|\bprint\b/i]
];
const MODS = new Set(['dark', 'light', 'deep', 'pale', 'темний', 'світлий', 'темно', 'светло', 'світло']);
const GLASS_KINDS = /\b(2\.5d|2d|3d|4d|5d|6d|9d|10d|21d)\b/i;
const TYPE_NAME = { cases: 'Чохол', glass: 'Захисне скло', film: 'Захисна плівка', cables: 'Кабель / зарядний пристрій', other: '' };

function compatOf(p) {
  const i = String(p.name).search(/\sдля\s/i);
  if (i < 0) return '';
  let t = p.name.slice(i + 5).replace(/\s*\(\s*\d+[.,]\d+\s*["”″']*\s*\)/g, '').trim().split(/\s+/);
  while (t.length > 1) {
    const w = t[t.length - 1].toLowerCase();
    if (w === '/' || w === '-' || canonColor(w) || MODS.has(w)) t.pop(); else break;
  }
  return toUk(t.join(' ').replace(/\s*\/\s*/g, ' / ')).replace(/[\s/]+$/, '');
}

function catPath(id) {
  const out = [];
  for (let c = catById.get(id), n = 0; c && n < 6; c = catById.get(c.parentId), n++) out.unshift(c.name);
  return out.join(' › ');
}

function specRows(p, g) {
  const t = typeOf(p), n = p.name || '', rows = [];
  const add = (k, v) => { if (v) rows.push([k, v]); };
  add('Виробник', p.br);
  add('Артикул', p.sku);
  add('Тип товару', TYPE_NAME[t]);
  if (t === 'cases') {
    const forms = formsOf(p).filter((f) => f !== 'Накладка (задня панель)' || !BOOK_RE.test(n));
    add('Форм-фактор', forms.filter((f) => f !== 'З принтом').slice(0, 3).join(', '));
  }
  add('Матеріал', MATERIALS.filter(([, re]) => re.test(n)).slice(0, 2).map((m) => m[0]).join(', '));
  if (t === 'glass') add('Тип скла', (n.match(GLASS_KINDS) || [])[1]?.toUpperCase());
  add('Колір', colorsOf(p).join(' / ') || (g && g.v.length > 1 ? ukLabel(g.lb[g.i]) : ''));
  add('Сумісність', compatOf(p));
  const diag = n.match(/\(\s*(\d+[.,]\d+)\s*["”″']*\s*\)/);
  add('Діагональ екрана', diag ? `${diag[1].replace(',', '.')}"` : '');
  add('Особливості', FEATURES.filter(([, re]) => re.test(n)).map((f) => f[0]).join(', '));
  add('Категорія', catById.get(p.category)?.name);
  if (p.oldPrice && p.oldPrice > p.price) add('Знижка', `−${Math.round((1 - p.price / p.oldPrice) * 100)}% (було ${money(p.oldPrice)})`);
  add('Повна назва', p.u);
  return rows;
}

let pdG = null;
function pdHTML(g) {
  ensureNames(g);
  const p = g.v[g.i], multi = g.v.length > 1;
  const catObj = catById.get(p.category);
  const chips = multi ? `<div class="vgroup"><div class="vtitle">Колір / дизайн: <b>${esc(ukLabel(g.lb[g.i]))}</b></div>
    <div class="vchips">${g.v.map((q, i) => {
      const hex = colorOf(g.lb[i]);
      const dot = hex ? `<i class="dot${hex === 'clear' ? ' clear' : ''}" ${hex !== 'clear' ? `style="--c:${hex}"` : ''}></i>` : '';
      return `<button type="button" class="vchip${i === g.i ? ' on' : ''}${q.available ? '' : ' off'}" data-i="${i}">${dot}${esc(ukLabel(g.lb[i]))}</button>`;
    }).join('')}</div></div>` : '';
  return `<form method="dialog"><button class="x" aria-label="Закрити">×</button></form>
    <div class="pd">
      <div class="pd-media">${p.img ? `<img src="${esc(p.img)}" alt="${esc(g.nm)}">` : '<div class="ph" style="aspect-ratio:3/4">Фото відсутнє</div>'}</div>
      <div class="pd-info">
        <h2>${esc(g.nm)}</h2>
        <div class="pd-meta">
          <span>${esc(p.br)}${p.sku ? `${p.br ? ' · ' : ''}арт. ${esc(p.sku)}` : ''}</span>
          ${p.available ? '<span class="badge-stock">В наявності</span>' : '<span class="badge-out">Немає в наявності</span>'}
        </div>
        <p class="price big">${priceHTML(p)}</p>
        ${chips}
        <button class="buy" id="add" type="button" ${p.available ? '' : 'disabled'}>${p.available ? 'У кошик' : 'Немає в наявності'}</button>
        <dl>${specRows(p, g).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      </div>
    </div>`;
}
function openProduct(g) {
  const d = $('#pd');
  pdG = g;
  d.innerHTML = pdHTML(g);
  if (!d.open) d.showModal();
}
$('#pd').addEventListener('click', (e) => {
  const d = e.currentTarget;
  if (e.target === d) { d.close(); return; }
  const chip = e.target.closest('.vchip');
  if (chip && pdG) {
    pdG.i = +chip.dataset.i;
    d.innerHTML = pdHTML(pdG);
    // синхронізуємо картку в сітці
    const card = $(`.card[data-k="${CSS.escape(pdG.k)}"]`);
    if (card) updateCard(card, pdG);
    return;
  }
  if (e.target.closest('#add')) {
    addToCart(pdG.v[pdG.i].id);
    d.close();
    drawCart();
    $('#cartD').showModal();
  }
});

/* ====================================================================
   Кошик
   ==================================================================== */
const cartTotal = () => cart.reduce((a, i) => a + (byId.get(i.id)?.price || 0) * i.qty, 0);
const thumb = (p) => (p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : '<span class="line-ph"></span>');
const qtyHTML = (i, n) => `<span class="qty"><button type="button" data-n="${n}" data-d="-1" aria-label="Менше">−</button><span>${i.qty}</span><button type="button" data-n="${n}" data-d="1" aria-label="Більше">+</button></span>`;

function drawCart() {
  cart = cart.filter((i) => byId.has(i.id));
  $('#lines').innerHTML = cart.length
    ? cart.map((i, n) => {
      const p = byId.get(i.id);
      return `<div class="line">${thumb(p)}
        <span class="line-name">${esc(p.u)}<small>${money(p.price)}</small></span>
        ${qtyHTML(i, n)}
        <b class="price">${money(p.price * i.qty)}</b></div>`;
    }).join('')
    : '<p class="muted">Кошик порожній</p>';
  $('#cartFoot').hidden = !cart.length;
  $('#cartTotal').textContent = money(cartTotal());
  save();
  if (st.view === 'checkout') renderSummary();
}
function addToCart(id) {
  const l = cart.find((i) => i.id === id);
  l ? l.qty++ : cart.push({ id, qty: 1 });
  save();
}
function changeCart(e) {
  const del = e.target.closest('[data-del]');
  if (del) { cart.splice(+del.dataset.del, 1); drawCart(); return; }
  const b = e.target.closest('button[data-n]');
  if (!b) return;
  const i = cart[+b.dataset.n];
  i.qty += +b.dataset.d;
  if (i.qty < 1) cart.splice(+b.dataset.n, 1);
  drawCart();
}
$('#cartBtn').addEventListener('click', () => { drawCart(); $('#cartD').showModal(); });
$('#cartD').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$('#lines').addEventListener('click', changeCart);
$('#sumLines').addEventListener('click', changeCart);
$('#backShop').addEventListener('click', () => $('#cartD').close());
$('#toCheckout').addEventListener('click', () => { $('#cartD').close(); $('#coDone').hidden = true; navigate('checkout'); });
$('#coShop').addEventListener('click', () => { clearFilters(); });

/* ====================================================================
   Оформлення замовлення (Нова пошта / Укрпошта → Google Таблиця)
   ==================================================================== */
function renderSummary() {
  const empty = !cart.length;
  $('#sumLines').innerHTML = cart.map((i, n) => {
    const p = byId.get(i.id);
    return `<div class="sum-line">${thumb(p)}
      <div class="sum-name"><span>${esc(p.u)}</span><button type="button" class="sum-del" data-del="${n}" aria-label="Видалити">🗑</button></div>
      <div class="sum-meta"><div>${qtyHTML(i, n)}<small>${money(p.price)} × ${i.qty}</small></div><b>${money(p.price * i.qty)}</b></div></div>`;
  }).join('');
  $('#sumTotal').textContent = money(cartTotal());
  const done = !$('#coDone').hidden;
  $('#order').hidden = empty || done;
  $('#coSum').hidden = empty || done;
  $('#coEmpty').hidden = !(empty && !done);
}
function renderCheckout() {
  cart = cart.filter((i) => byId.has(i.id));
  if (cart.length) $('#coDone').hidden = true;
  syncCarrier();
  renderSummary();
}

const carrierNP = () => $('#oCarrier').value === 'Нова пошта';
function syncCarrier() {
  const np = carrierNP();
  $('#oBranchL').textContent = np ? 'Відділення / поштомат' : 'Відділення Укрпошти';
  $('#oBranch').placeholder = np ? 'Напр.: Відділення №12 або Поштомат №3456' : 'Поштовий індекс та/або адреса відділення';
}
$('#oCarrier').addEventListener('change', () => { $('#oBranch').value = ''; syncCarrier(); });

// Телефон: тільки 9 цифр після +380, формат «50 123 4567»
$('#oPhone').addEventListener('input', (e) => {
  let d = e.target.value.replace(/\D/g, '');
  if (d.startsWith('380')) d = d.slice(3); else if (d.startsWith('0')) d = d.slice(1);
  d = d.slice(0, 9);
  e.target.value = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(' ');
});

// ---- Нова пошта API (за наявності ключа): підказки міст і відділень ----
async function npCall(modelName, calledMethod, methodProperties) {
  // без заголовка Content-Type запит «простий» і не потребує CORS-preflight
  const r = await fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'POST',
    body: JSON.stringify({ apiKey: NOVA_POSHTA_KEY, modelName, calledMethod, methodProperties })
  });
  if (!r.ok) throw new Error('NP HTTP ' + r.status);
  const j = await r.json();
  if (!j.success) throw new Error('NP: ' + (j.errors || []).concat(j.errorCodes || []).join('; '));
  return j.data;
}
const userErr = (m) => Object.assign(new Error(m), { user: true });

// Простий випадаючий список підказок під полем (fetcher повертає масив {value,label,sub?} або null — без підказок)
function autocomplete(input, fetcher, onPick) {
  const box = document.createElement('ul');
  box.className = 'ac-list'; box.hidden = true; box.setAttribute('role', 'listbox');
  input.parentNode.classList.add('ac');
  input.parentNode.appendChild(box);
  let items = [], idx = -1, timer, seq = 0;
  const hide = () => { box.hidden = true; idx = -1; };
  const mark = () => $$('li[data-i]', box).forEach((li, i) => li.classList.toggle('on', i === idx));
  const render = (list, note) => {
    items = list; idx = -1;
    box.innerHTML = list.length
      ? list.map((x, i) => `<li role="option" data-i="${i}">${esc(x.label)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</li>`).join('')
      : `<li class="ac-note">${esc(note || 'Нічого не знайдено — введіть вручну')}</li>`;
    box.hidden = false;
  };
  const pick = (i) => {
    const x = items[i];
    if (!x) return;
    input.value = x.value; hide();
    input.classList.remove('bad');
    onPick && onPick(x);
  };
  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const my = ++seq;
      try {
        const list = await fetcher(input.value.trim());
        if (my !== seq || document.activeElement !== input) return;
        list === null ? hide() : render(list);
      } catch (e) {
        if (my !== seq) return;
        if (!e.user) console.warn('Підказки не завантажились:', e);
        if (document.activeElement === input) render([], e.user ? e.message : 'Підказки недоступні — введіть вручну');
      }
    }, 250);
  };
  input.addEventListener('input', run);
  input.addEventListener('focus', run);
  input.addEventListener('blur', () => setTimeout(hide, 150));
  input.addEventListener('keydown', (e) => {
    if (box.hidden || !items.length) return;
    if (e.key === 'ArrowDown') { idx = (idx + 1) % items.length; mark(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = (idx - 1 + items.length) % items.length; mark(); e.preventDefault(); }
    else if (e.key === 'Enter' && idx >= 0) { pick(idx); e.preventDefault(); }
    else if (e.key === 'Escape') hide();
  });
  box.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) { e.preventDefault(); pick(+li.dataset.i); }
  });
}

let cityRef = '';
$('#oCity').addEventListener('input', () => { cityRef = ''; });
autocomplete($('#oCity'), async (q) => {
  if (!NOVA_POSHTA_KEY || q.length < 2) return null;
  const data = await npCall('Address', 'searchSettlements', { CityName: q, Limit: 10 });
  return (data[0]?.Addresses || []).filter((x) => x.DeliveryCity)
    .map((x) => ({ value: x.Present, label: x.Present, ref: x.DeliveryCity }));
}, (x) => { cityRef = x.ref; $('#oBranch').value = ''; });

autocomplete($('#oBranch'), async (q) => {
  if (!NOVA_POSHTA_KEY || !carrierNP()) return null;
  if (!cityRef) throw userErr('Спочатку виберіть місто зі списку підказок');
  const data = await npCall('AddressGeneral', 'getWarehouses', { CityRef: cityRef, FindByString: q, Language: 'UA', Limit: 30 });
  return data.map((w) => ({ value: w.Description, label: w.Description }));
});

async function sendOrder(payload) {
  const init = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) };
  try {
    const r = await fetch(ORDER_ENDPOINT, init);
    const j = await r.json().catch(() => null);
    if (j && j.ok === false) throw new Error(j.error || 'server');
  } catch (e) {
    if (e.name !== 'TypeError') throw e;
    // браузер міг заблокувати читання відповіді (CORS) — повторюємо «наосліп»; дублікати відсікає скрипт за id
    await fetch(ORDER_ENDPOINT, { ...init, mode: 'no-cors' });
  }
}

const bad = (el, on) => el.closest('.phone')?.classList.toggle('bad', on) || el.classList.toggle('bad', on);
$('#order').addEventListener('input', (e) => bad(e.target, false));
$('#order').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, fd = new FormData(f), msg = $('#msg'), btn = $('#orderBtn');
  msg.className = '';
  if (fd.get('website')) return;                                   // пастка для ботів
  const name = String(fd.get('name')).trim().replace(/\s+/g, ' ');
  const digits = String(fd.get('phone')).replace(/\D/g, '');
  const city = String(fd.get('city')).trim(), branch = String(fd.get('branch')).trim();
  const checks = [
    [f.elements.name, name.split(' ').length >= 2, 'Вкажіть прізвище та імʼя'],
    [f.elements.phone, digits.length === 9, 'Введіть номер телефону повністю: +380 XX XXX XXXX'],
    [f.elements.city, city.length >= 2, 'Вкажіть місто'],
    [f.elements.branch, branch.length >= 1, carrierNP() ? 'Вкажіть відділення або поштомат' : 'Вкажіть відділення Укрпошти']
  ];
  let first = null;
  checks.forEach(([el, ok]) => { bad(el, !ok); if (!ok && !first) first = el; });
  if (first) { msg.textContent = checks.find(([el]) => el === first)[2]; msg.className = 'err'; first.focus(); return; }
  if (!cart.length) { msg.textContent = 'Кошик порожній'; msg.className = 'err'; return; }

  const items = cart.map((i) => {
    const p = byId.get(i.id);
    return { id: i.id, name: p.u, sku: p.sku, price: p.price, qty: i.qty, sum: p.price * i.qty };
  });
  const payload = {
    id: 'MS-' + Date.now().toString(36).toUpperCase(),
    createdAt: new Date().toISOString(),
    name, phone: '+380' + digits, nocall: !!fd.get('nocall'),
    carrier: fd.get('carrier'), city, branch, payment: fd.get('payment'),
    comment: String(fd.get('comment') || '').trim(),
    items, total: cartTotal()
  };
  btn.disabled = true;
  msg.textContent = 'Надсилаю…';
  const backup = (flag) => {
    const saved = JSON.parse(localStorage.getItem('mobsvit_orders') || '[]');
    saved.push({ ...payload, sent: flag });
    localStorage.setItem('mobsvit_orders', JSON.stringify(saved));
  };
  try {
    if (!ORDER_ENDPOINT) { backup(false); console.warn('ORDER_ENDPOINT не заданий у config.js — замовлення збережено лише в браузері'); }
    else await sendOrder(payload);
  } catch {
    backup(false);
    msg.textContent = 'Не вдалося надіслати замовлення. Перевірте звʼязок і спробуйте ще раз.';
    msg.className = 'err';
    btn.disabled = false;
    return;
  }
  cart = [];
  save();
  f.reset();
  $('#coDone').innerHTML = `<h2>Дякуємо! Замовлення ${esc(payload.id)} прийнято</h2>
    <p>${payload.nocall ? 'Ми відправимо замовлення без дзвінка.' : 'Ми зателефонуємо вам для підтвердження.'} Сума: <b>${money(payload.total)}</b>, доставка: ${esc(payload.carrier)}.</p>
    <a class="buy co-link" href="#/">На головну</a>`;
  $('#coDone').hidden = false;
  btn.disabled = false;
  msg.textContent = '';
  renderSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ====================================================================
   Пошук, фільтри, кнопки
   ==================================================================== */
let timer;
$('#q').addEventListener('input', (e) => {
  clearTimeout(timer);
  const v = e.target.value;
  $('#clearSearch').hidden = !v;
  timer = setTimeout(() => {
    st.q = v.trim();
    st.f = null; st.title = ''; st.special = ''; st.exactModel = ''; st.type = ''; st.cat = '';
    st.fBrand = ''; st.fColor = ''; st.fForm = '';
    $('#cat').value = '';
    st.view === 'catalog' ? refresh() : navigate('catalog');
  }, 220);
});
$('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter' && st.view !== 'catalog') { st.q = e.target.value.trim(); navigate('catalog'); } });
$('#clearSearch').addEventListener('click', () => {
  $('#q').value = '';
  $('#clearSearch').hidden = true;
  st.q = '';
  if (st.view === 'catalog') refresh();
});
$('#cat').addEventListener('change', (e) => { st.cat = e.target.value; refresh(); });
$('#sort').addEventListener('change', (e) => { st.sort = e.target.value; refresh(); });
$('#stock').addEventListener('change', (e) => { st.stock = e.target.checked; refresh(); });
$('#resetModelBtn').addEventListener('click', () => { clearFilters(); refresh(); });
$('#more').addEventListener('click', more);
$('#newBtn').addEventListener('click', () => openCatalog({ special: 'new' }));
$('#allNewBtn').addEventListener('click', () => openCatalog({ special: 'new' }));
$('#arrBtn').addEventListener('click', () => openCatalog({ special: 'arrivals' }));
$('#logo').addEventListener('click', () => { if (location.hash === '#/' || !location.hash) { clearFilters(); route(); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
document.addEventListener('click', (e) => {
  if (st.activeBrand && !e.target.closest('.navbar') && !e.target.closest('.mega-menu')) closeMega();
});
if ('IntersectionObserver' in window) {
  new IntersectionObserver((en) => { if (en[0].isIntersecting && !$('#more').hidden) more(); }, { rootMargin: '700px' }).observe($('#more'));
}

bindGrid($('#grid'), () => gridMap);
bindGrid($('#newGrid'), () => newMap);

/* ====================================================================
   Старт
   ==================================================================== */
prepareMenu();
ready = true;
buildBrandStrip();
renderNewShelf();
fillPosterImages();
mounts.forEach((m) => { if (m.cur >= 0) m.show(m.cur); });
save();
route();
runFacetPass();
