/* КРЕСТ — Maintenance Gate
 * Подключается ПЕРВЫМ скриптом на каждой странице miniapp.
 * Если включён maintenance mode и пользователь не в whitelist по chat_id —
 * заменяет содержимое страницы на maintenance.html.
 *
 * Зависит только от Telegram WebApp SDK (telegram-web-app.js).
 */
(function () {
  if (window.__crestMaintenanceChecked) return;
  window.__crestMaintenanceChecked = true;

  // Если уже на maintenance — не проверяем, иначе зацикливание
  if (location.pathname.endsWith('/maintenance.html')) return;

  function showMaintenance() {
    try { location.replace('maintenance.html'); }
    catch (_) { document.documentElement.innerHTML = '<body style="background:#0e1116;color:#e6e6e6;display:flex;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,sans-serif;text-align:center;padding:24px"><div><div style="font-size:56px">✝️</div><h1 style="color:#C9A961;margin-top:14px">Приложение в разработке</h1><p style="color:#b8b8b8;margin-top:10px">Извините, попробуйте зайти позже.</p></div></body>'; }
  }

  // Скрываем body до получения ответа
  var hideStyle = document.createElement('style');
  hideStyle.id = 'crest-maintenance-hide';
  hideStyle.textContent = 'body{visibility:hidden!important}';
  document.head.appendChild(hideStyle);

  function reveal() {
    var el = document.getElementById('crest-maintenance-hide');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function check() {
    var tg = window.Telegram && window.Telegram.WebApp;
    var initData = tg && tg.initData ? tg.initData : '';

    fetch('/api/miniapp/maintenance-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initData }),
      cache: 'no-store'
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.allowed) {
          reveal();
          return;
        }
        showMaintenance();
      })
      .catch(function () {
        // Если API недоступно — показываем maintenance (fail-closed)
        showMaintenance();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check);
  } else {
    check();
  }
})();
