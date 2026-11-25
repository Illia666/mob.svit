# Mobil Svit — окремий магазин з каталогом із XML-фіду

## Запуск у VS Code
1. `npm install`
2. `npm run inspect`  — покаже структуру фіду й перший товар (перевірте назви полів)
3. `npm run build`    — створить `public/data/products.json`
4. `npm run dev`      — відкрийте показану адресу (замовлення локально не надсилаються)

Якщо фід не завантажується скриптом, збережіть XML у `feeds/prices.xml`
і вкажіть цей шлях у `config.json` → `feeds`.

## Налаштування
`config.json`: `markupPercent` (націнка, % — зараз 30, змініть), `roundTo` (округлення цін),
`rates` (курси, якщо фід не в гривні: `{"UAH":1,"USD":<курс>}`).

## Публікація (Netlify)
1. Завантажте теку на GitHub, підключіть репозиторій у Netlify.
2. Netlify → Site settings → Environment variables: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
3. Build hooks → створіть хук, додайте його в GitHub Secrets як `NETLIFY_BUILD_HOOK` —
   тоді каталог оновлюватиметься щодоби (`.github/workflows/update.yml`).
