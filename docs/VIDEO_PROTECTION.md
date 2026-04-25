# VIDEO_PROTECTION.md — YouTube No-Skip Логика

> Защита от перемотки видео через YouTube IFrame API.

---

## Принцип работы

YouTube IFrame API не имеет встроенной защиты от перемотки. Мы реализуем её через polling — каждые 500мс проверяем позицию плеера. Если студент перемотал вперёд дальше максимального просмотренного момента — возвращаем назад.

```
Polling каждые 500мс:
  currentTime > maxWatched + 2?
  ├── ДА  → seekTo(maxWatched)  ← перемотка назад
  └── НЕТ → maxWatched = max(maxWatched, currentTime)

maxWatched / duration >= 0.95?
  └── ДА  → активировать кнопку форума
```

---

## Полная реализация

### HTML — контейнер плеера

```html
<div id="player-wrapper">
  <div id="yt-player"></div>
</div>

<!-- скрипт YouTube IFrame API -->
<script src="https://www.youtube.com/iframe_api"></script>
```

### JavaScript — инициализация и защита

```javascript
let player;
let maxWatched = 0;
let pollInterval = null;
let forumActivated = false;

// Коллбэк YouTube API — вызывается когда API готов
function onYouTubeIframeAPIReady() {
  player = new YT.Player('yt-player', {
    height: '100%',
    width: '100%',
    videoId: ytId(lesson.youtube_url),  // ytId() из auth.js
    playerVars: {
      rel: 0,           // без похожих видео
      modestbranding: 1,
      disablekb: 1,     // отключить клавиатурные shortcut'ы
      fs: 0,            // без полноэкранного режима
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    }
  });
}

function onPlayerReady(event) {
  // Плеер готов, ждём воспроизведения
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    startNoSkipPolling();
  } else {
    stopPolling();
  }
}

function startNoSkipPolling() {
  if (pollInterval) return; // уже запущен

  pollInterval = setInterval(() => {
    if (!player || player.getPlayerState() !== YT.PlayerState.PLAYING) return;

    const current = player.getCurrentTime();
    const duration = player.getDuration();

    // Защита от перемотки
    if (current > maxWatched + 2) {
      player.seekTo(maxWatched, true);
    } else {
      maxWatched = Math.max(maxWatched, current);
    }

    // Проверка 95% просмотра
    if (!forumActivated && duration > 0 && maxWatched / duration >= 0.95) {
      forumActivated = true;
      stopPolling();
      activateForumButton();
    }
  }, 500);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function activateForumButton() {
  const btn = document.getElementById('forum-submit-btn');
  btn.disabled = false;
  btn.classList.remove('btn-locked');
  btn.classList.add('btn-primary');
  toast(t.video_complete, 'success');
}
```

---

## Порог 95% (а не 100%)

Используем 95% а не 100% потому что:
- Конец видео может иметь пустые титры
- YouTube не всегда точно возвращает duration
- Небольшой буфер улучшает UX без ущерба педагогике

---

## Вспомогательные функции (из auth.js)

```javascript
// Извлечь YouTube ID из любого формата URL
function ytId(url) {
  if (!url) return '';
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : url;
}

// Получить embed URL
function ytEmbed(url) {
  return `https://www.youtube.com/embed/${ytId(url)}`;
}
```

---

## Что не даёт надёжной защиты

| Метод | Почему не используем |
|-------|---------------------|
| CSS overlay поверх плеера | Легко обходится через DevTools |
| disablekb: 1 | Только клавиатура, не мышь |
| Iframe с pointer-events: none | Блокирует воспроизведение полностью |
| Kinescope/Vimeo | Требует платную подписку |

Polling 500мс — лучший баланс между защитой и совместимостью для браузерного JS.

---

## Edge Cases

| Ситуация | Обработка |
|----------|-----------|
| Студент закрыл вкладку | maxWatched сбрасывается, начинает с начала |
| Видео буферизация | current может прыгнуть, +2 секунды — буфер |
| Видео не загрузилось | onError в YouTube API → `toast(t.video_error, 'error')` |
| Студент уже смотрел (повторный заход) | Проверить journal_entries — если есть → показать конспект, пропустить видео |

---

## Восстановление состояния (повторный заход)

```javascript
async function checkExistingProgress() {
  const { data: entry } = await _supabase
    .from('journal_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('block_id', blockId)
    .single();

  if (entry) {
    // Форум уже отправлен — показать конспект сразу
    forumActivated = true;
    document.getElementById('forum-section').style.display = 'none';
    showSynopsis();
    return true;
  }
  return false;
}
```
