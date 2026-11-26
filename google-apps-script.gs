/**
 * Mobil Svit — прийом замовлень у Google Таблицю.
 *
 * Як підключити:
 * 1) Відкрийте таблицю → Розширення → Apps Script, вставте весь цей код (замість наявного).
 * 2) Розгорнути → Нове розгортання → Тип: Веб-застосунок.
 *      Виконувати від імені: Я      |      Хто має доступ: Усі
 * 3) Скопіюйте адресу веб-застосунку (закінчується на /exec) і вставте в config.js:
 *      export const ORDER_ENDPOINT = 'https://script.google.com/macros/s/.../exec';
 * 4) Після зміни коду: Розгорнути → Керувати розгортаннями → олівець → Нова версія.
 */
var SHEET_ID = '1sZm_J-06Jzpch13sJlKqkSoll71Ge0xP4X5KwTx_lUg';
var SHEET_GID = 0;   // gid=0 з посилання на таблицю

var HEADERS = ['Дата', '№ замовлення', 'ПІБ', 'Телефон', 'Не телефонувати', 'Доставка', 'Місто',
  'Відділення / адреса', 'Оплата', 'Коментар', 'Товари', 'Сума, грн', 'Статус'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);
    if (!d || !d.id || !d.items || !d.items.length || !d.name || !d.phone) return out_({ ok: false, error: 'bad data' });

    var sh = sheet_();
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#fff0e4');
      sh.setFrozenRows(1);
    }
    // повторна відправка того самого замовлення (повтор запиту браузером) — не дублюємо
    var last = sh.getLastRow();
    if (last > 1) {
      var ids = sh.getRange(2, 2, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (ids[i][0] === d.id) return out_({ ok: true, id: d.id, duplicate: true });
    }

    var items = d.items.map(function (it, n) {
      return (n + 1) + ') ' + it.name + (it.sku ? ' (арт. ' + it.sku + ')' : '') +
        ' — ' + it.qty + ' × ' + it.price + ' = ' + it.sum + ' грн';
    }).join('\n');

    var row = last + 1;
    sh.appendRow([
      new Date(d.createdAt || new Date()), d.id, d.name, '', d.nocall ? 'Так' : 'Ні', d.carrier, d.city,
      d.branch, d.payment, d.comment || '', items, d.total, 'Нове'
    ]);
    sh.getRange(row, 4).setNumberFormat('@').setValue(d.phone);              // телефон як текст
    sh.getRange(row, 1).setNumberFormat('dd.MM.yyyy HH:mm');
    sh.getRange(row, 11).setWrap(true);
    return out_({ ok: true, id: d.id });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Перевірка в браузері: відкрийте адресу /exec — має показати {"ok":true}
function doGet() { return out_({ ok: true, service: 'mobsvit-orders' }); }

function sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) if (sheets[i].getSheetId() === SHEET_GID) return sheets[i];
  return sheets[0];
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
