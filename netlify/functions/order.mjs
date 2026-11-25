// Приймає замовлення й шле його в Telegram. Ціни беруться з каталогу на сервері, а не від клієнта.
export const config = { path: '/api/order' };

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let b; try { b = await req.json(); } catch { return new Response('Некоректні дані', { status: 400 }); }

  const name = String(b.name || '').trim().slice(0, 80);
  const phone = String(b.phone || '').trim().slice(0, 20);
  const comment = String(b.comment || '').trim().slice(0, 500);
  if (name.length < 2 || !/^[+\d\s()-]{9,20}$/.test(phone) || !Array.isArray(b.items) || !b.items.length || b.items.length > 50)
    return new Response('Перевірте ім\'я, телефон і кошик', { status: 400 });

  const db = await (await fetch(new URL('/data/products.json', req.url))).json();
  const byId = new Map(db.products.map((p) => [p.id, p]));
  let total = 0; const lines = [];
  for (const it of b.items) {
    const p = byId.get(String(it.id));
    if (!p || !p.available) return new Response('Один із товарів уже недоступний', { status: 409 });
    const qty = Math.min(Math.max(parseInt(it.qty) || 1, 1), 99);
    total += p.price * qty;
    lines.push(`• ${p.name} [${p.sku || p.id}] × ${qty} = ${p.price * qty} грн`);
  }

  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env;
  if (!token || !chat) return new Response('Сервер не налаштовано', { status: 500 });
  const text = `Нове замовлення\n${name}, ${phone}\n${comment}\n\n${lines.join('\n')}\n\nРазом: ${total} грн`;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }),
  });
  return r.ok ? Response.json({ ok: true }) : new Response('Не вдалося надіслати замовлення', { status: 502 });
};
