// =====================================================================
//  Налаштування сайту. Тут можна змінювати меню каталогу та постери,
//  не чіпаючи основний код (app.js).
// =====================================================================

// ---------------------------------------------------------------------
//  ПОСТЕРИ НА ГОЛОВНІЙ (перемикаються автоматично кожні 6 секунд)
//  title      — великий заголовок (\n = перенос рядка)
//  text       — короткий опис
//  cta        — текст кнопки
//  filter     — що відкриється по кнопці (див. «фільтри» нижче)
//  links      — (необов'язково) кілька кнопок на моделі: [{ label, model }]; замінюють cta/filter
//  images     — як підібрати фото товарів для постера (беруться з каталогу)
//  image      — (необов'язково) свій готовий рекламний малюнок, замість товарів
//  theme      — колір фону: plum | teal | indigo | amber
// ---------------------------------------------------------------------
export const POSTERS = [
  {
    theme: 'plum',
    title: 'iPhone 18 та Duo —\nновий стиль',
    text: 'Чохли та скло для iPhone 18 і складного iPhone Duo: прозорі, MagSafe, з принтами',
    cta: 'Переглянути всі чохли',
    // кнопки постера: кожна відкриває сторінку конкретної моделі (назва — як у меню моделей)
    links: [
      { label: 'iPhone 18', model: 'iPhone 18' },
      { label: 'iPhone Duo', model: 'iPhone Duo (5.4/7.6")' }
    ],
    images: { q: 'iphone 18', scope: 'cases' }
  },
  {
    theme: 'teal',
    title: 'Скло та плівки\nна будь-який смартфон',
    text: 'Загартоване скло, броньована та гідрогелева плівка',
    cta: 'Обрати захист екрана',
    filter: { title: 'Скло та плівки', scope: 'glassfilm' },
    images: { scope: 'glassfilm' }
  },
  {
    theme: 'indigo',
    title: 'Зарядка й кабелі —\nзавжди під рукою',
    text: 'Мережеві, бездротові та портативні ЗП, кабелі Type-C і Lightning',
    cta: 'До зарядних пристроїв',
    filter: { title: 'Зарядні пристрої', cats: ['190703'] },
    images: { cats: ['190703'] }
  },
  {
    theme: 'amber',
    title: 'Антиблекаут:\nсвітло та звʼязок без розеток',
    text: 'Повербанки, ліхтарі, сонячні панелі, портативні обігрівачі',
    cta: 'Дивитись добірку',
    filter: { title: 'Антиблекаут', cats: ['681', '1919', '3415', '3026'] },
    images: { cats: ['681', '1919', '3415'] }
  }
];

// ---------------------------------------------------------------------
//  ФІЛЬТРИ (використовуються в меню, постерах і кнопках)
//    cats        — список id категорій з прайсу (враховуються й підкатегорії)
//    gadgetBrand — бренд гаджета з розділу «Чохли» (Apple, Samsung ...)
//    brand       — бренд виробника аксесуара (Hoco, Baseus ...)
//    scope       — тип товару: cases | glass | film | glassfilm | cables
//    re          — слово/регулярний вираз у назві (або масив: потрібні всі)
//    label       — підпис пункту (якщо не вказано — назва категорії)
// ---------------------------------------------------------------------
const NEW_TAG = { tag: 'NEW' };

const STRAP = /ремеш|ремін|браслет|strap/i;

export const SIDEBAR = [
  {
    key: 'kids', title: 'Дитячі гаджети / Ігри', icon: 'puzzle',
    sections: [{ title: 'Дитячі гаджети та ігри', children: '320003' }]
  },

  {
    key: 'cases', title: 'Чохли', icon: 'phone',
    sections: [
      {
        title: 'Принти itsPrint', ...NEW_TAG,
        items: [{ label: 'Усі принти itsPrint', re: /itsprint/i, scope: 'cases' }]
      },
      {
        title: 'Бренд гаджета',
        items: ['Apple', 'Samsung', 'Xiaomi', 'Huawei / Honor', 'Realme', 'OnePlus', 'Oppo', 'TECNO', 'Motorola', 'ZTE', 'Google', 'Nokia']
          .map((b) => ({ gadgetBrand: b, scope: 'cases' }))
      },
      {
        title: 'Тип аксесуару',
        items: [
          { label: 'Книжка', re: /книжк/i, scope: 'cases' },
          { label: 'З MagSafe / Magnetic', re: /magnetic|magsafe|магнит/i, scope: 'cases' },
          { label: 'Silicone case', re: /silicone|силикон/i, scope: 'cases' },
          { label: 'Ультратонкий', re: /ультратонк|ultra ?thin/i, scope: 'cases' },
          { label: 'Протиударний', re: /противоудар|ударопроч|armor|defender|shockproof/i, scope: 'cases' },
          { label: 'Прозорий', re: /прозрач|transparent|clear/i, scope: 'cases' },
          { label: 'З кишенею для карток', re: /карман|кишен|визиток|card/i, scope: 'cases' },
          { label: 'Блискітки / Стрази', re: /блест|стразы|глиттер|glitter|shining/i, scope: 'cases' }
        ]
      },
      {
        title: 'Матеріал аксесуара',
        items: [
          { label: 'Силікон', re: /силикон|silicone/i, scope: 'cases' },
          { label: 'TPU', re: /\btpu\b(?!\s*\+\s*pc)/i, scope: 'cases' },
          { label: 'TPU+PC', re: /tpu\s*\+\s*pc/i, scope: 'cases' },
          { label: 'Пластик', re: /пластик|\bpc\b/i, scope: 'cases' },
          { label: 'Штучна шкіра', re: /кожа|кожан|leather|эко/i, scope: 'cases' },
          { label: 'Тканина', re: /ткан|fabric|текстил/i, scope: 'cases' }
        ]
      },
      {
        title: 'Загальні товари',
        items: [{ cat: '2964' }, { cat: '176703' }]
      }
    ]
  },

  {
    key: 'glass', title: 'Скло / плівки', icon: 'glass',
    sections: [
      {
        title: 'Бренд гаджета',
        items: ['Apple', 'Samsung', 'Xiaomi', 'Huawei / Honor', 'Realme', 'OnePlus', 'Oppo', 'TECNO', 'ZTE', 'Google']
          .map((b) => ({ gadgetBrand: b, scope: 'glassfilm' }))
      },
      {
        title: 'Бренд',
        autoBrands: { n: 10, scope: 'glassfilm' }
      },
      {
        title: 'Матеріал',
        items: [
          { label: 'Загартоване скло', scope: 'glass' },
          { label: 'Броньована плівка', scope: 'film', re: /бронь|бронир|бронен|armor/i },
          { label: 'Гідрогелева плівка', scope: 'film', re: /гидрогел|гідрогел|hydrogel/i },
          { label: 'Плівка', scope: 'film' }
        ]
      },
      {
        title: 'Тип',
        items: [
          { label: '3D', scope: 'glassfilm', re: /\b3d\b/i },
          { label: '2.5D', scope: 'glassfilm', re: /2\.5d/i },
          { label: '2D', scope: 'glassfilm', re: /\b2d\b/i },
          { label: 'На камеру', scope: 'glassfilm', re: /камер/i },
          { label: 'Матове', scope: 'glassfilm', re: /матов/i },
          { label: 'Антишпигун', scope: 'glassfilm', re: /приват|антишпион|privacy/i },
          { label: 'Для планшетів', scope: 'glassfilm', re: /планшет|ipad|tab\b/i }
        ]
      },
      {
        title: 'Загальні товари',
        items: [{ cat: '308500' }, { cat: '2125' }]
      }
    ]
  },

  {
    key: 'straps', title: 'Ремінці / Футляри', icon: 'watch',
    sections: [
      {
        title: 'Ремінці',
        items: [
          { label: 'Усі ремінці', re: STRAP },
          { label: 'Для Apple Watch', re: [STRAP, /apple watch|iwatch/i] },
          { label: 'Для Mi Band / Amazfit', re: [STRAP, /mi band|amazfit|redmi band|smart band/i] },
          { label: 'Для Smart Watch', re: [STRAP, /watch|galaxy|huawei|garmin|honor/i] }
        ]
      },
      {
        title: 'Футляри для навушників',
        items: [
          { label: 'Футляри для AirPods', re: [/футляр|чехол|чохол|case/i, /airpods/i] },
          { label: 'Футляри для Galaxy Buds', re: [/футляр|чехол|чохол|case/i, /buds/i] }
        ]
      },
      {
        title: 'Сумки та органайзери',
        items: [
          { label: 'Сумки', re: /сумк|\bbag\b/i },
          { label: 'Рюкзаки', re: /рюкзак|backpack/i },
          { label: 'Конверти', re: /конверт/i },
          { label: 'Органайзери', re: /органайзер/i }
        ]
      },
      {
        title: 'Смарт-годинники',
        items: [{ cat: '1915' }, { cat: '3196' }, { cat: '1914' }]
      }
    ]
  },

  {
    key: 'charge', title: 'Зарядні пристрої', icon: 'charger',
    sections: [
      { title: 'Усі ЗП', children: '190703' },
      { title: 'Бренд', autoBrands: { n: 8, cats: ['190703'] } }
    ]
  },

  {
    key: 'audio', title: 'Аудіо', icon: 'headphones',
    sections: [
      { title: 'Тип', children: '191103' },
      { title: 'Бренд', autoBrands: { n: 8, cats: ['191103'] } }
    ]
  },

  {
    key: 'auto', title: 'Автоаксесуари', icon: 'car',
    sections: [
      { title: 'Тип аксесуару', children: '68303' },
      { title: 'Бренд', autoBrands: { n: 8, cats: ['68303'] } }
    ]
  },

  {
    key: 'cables', title: 'Кабелі / Перехідники', icon: 'cable',
    sections: [
      { title: 'Тип кабелю', children: '68203' },
      { title: 'Бренд', autoBrands: { n: 8, cats: ['68203'] } }
    ]
  },

  {
    key: 'home', title: 'Для дому / Офісу', icon: 'bag',
    sections: [
      {
        title: 'Коли вимкнули світло',
        items: [{ label: 'Антиблекаут', cats: ['681', '1919', '3415', '3026'] }]
      },
      { title: 'Фото/відео камери', items: [{ cat: '3194' }, { cat: '2950' }, { cat: '3157' }, { cat: '3381' }] },
      { title: 'Смарт гаджети', items: [{ cat: '1915' }, { cat: '1914' }, { cat: '1910' }, { cat: '2923' }, { cat: '3213' }] },
      { title: 'Освітлення', items: [{ cat: '1919' }, { cat: '2769' }] },
      { title: 'Lifestyle', items: [{ cat: '1126' }] },
      {
        title: 'Периферія',
        items: [
          { cat: '2266' }, { cat: '2879' }, { cat: '1945' }, { cat: '1809' }, { cat: '2014' },
          { cat: '1810' }, { cat: '688' }, { cat: '1920' }, { cat: '1921' }, { cat: '1429' },
          { cat: '1430' }, { cat: '3298' }, { cat: '3381' }
        ]
      },
      {
        title: 'Home & Health',
        items: [
          { cat: '3026' }, { cat: '2931' }, { cat: '3176' }, { cat: '2932' }, { cat: '2875' },
          { cat: '1941' }, { cat: '1812' }, { cat: '1971' }, { cat: '2876' }, { cat: '1952' },
          { cat: '3172' }, { cat: '3190' }, { cat: '3415' }
        ]
      },
      { title: 'Загальні товари', items: [{ cat: '1280' }, { cat: '121' }, { cat: '1681' }, { cat: '416' }] }
    ]
  },

  {
    key: 'brands', title: 'Бренди', icon: 'tag',
    sections: [{ title: 'Бренди аксесуарів', autoBrands: { n: 36 } }]
  }
];

// Бренди у верхній смузі (решта — у пункті «Інші»)
export const BRAND_STRIP = ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Google', 'Oppo', 'Infinix'];
export const OTHER_BRANDS = ['Realme', 'Huawei / Honor', 'TECNO', 'OnePlus', 'ZTE', 'Nokia', 'Lenovo', 'Nothing', 'Blackview', 'Vivo', 'Sony', 'Umidigi', 'HMD'];

// Скільки днів товар вважається «новинкою» / «новим надходженням»
export const NEW_DAYS = 14;
export const ARRIVAL_DAYS = 7;

// Знижка (у відсотках) на комплект «чохол + скло/плівка» для тієї самої моделі
export const BUNDLE_DISCOUNT = 10;

// ---------------------------------------------------------------------
//  ЗАМОВЛЕННЯ
//  ORDER_ENDPOINT  — адреса веб-застосунку Google Apps Script (файл
//                    google-apps-script.gs), який записує замовлення в Google Таблицю.
//                    Поки порожньо — замовлення зберігаються лише в браузері.
//  NOVA_POSHTA_KEY — (необов'язково) ключ API «Нової пошти»: тоді місто та відділення
//                    підказуються зі списку. Без ключа поля заповнюються вручну.
// ---------------------------------------------------------------------
export const ORDER_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwTgrGnshE7eju0SCIJNY4YnJjRNIXHr8Vl3UIsFsfMvcN2Jg8yKiuncFFIXvvn2A0f/exec';
export const NOVA_POSHTA_KEY = '5ab16659e56bc85dabf0c790fdd6f2ff';
