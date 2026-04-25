# LESSON_FLOW.md — Архитектура урока (7 шагов)

> Источник истины для flow урока. Нарушение порядка = нарушение педагогической модели.

---

## Визуальная схема

```
СТУДЕНТ ОТКРЫВАЕТ УРОК
        ↓
[1] Проверка доступа
    blocks_unlocked >= block.order_num?
    ├── НЕТ → редирект на дашборд (/student/index.html)
    └── ДА  ↓

[2] Показать видео
    Конспект скрыт (display: none)
    Кнопка форума заблокирована
        ↓

[3] YouTube no-skip
    polling каждые 500мс
    if currentTime > maxWatched + 2 → seekTo(maxWatched)
        ↓

[4] watched >= 95%
    → Активировать кнопку форума
        ↓

[5] Форум (минимум 20 символов)
    → INSERT journal_entries
    → Отправить Telegram лидеру
        ↓

[6] Сохранить прогресс
    → INSERT/CHECK student_progress
      (admin_approved: false)
        ↓

[7] Показать конспект
    Кнопка "Следующий" 🔒
    ├── admin_approved = false → кнопка заблокирована, ждём лидера
    └── admin_approved = true  → кнопка активна → следующий блок
```

---

## Одобрение лидера (параллельный поток)

```
ЛИДЕР получает Telegram уведомление
        ↓
Открывает /admin/students.html
        ↓
Читает ответ студента
        ↓
Нажимает "Одобрить"
        ↓
UPDATE student_progress
  SET admin_approved = true
  WHERE user_id = ? AND block_id = ? AND lesson_id IS NULL
        ↓
UPDATE profiles
  SET blocks_unlocked = LEAST(blocks_unlocked + 1, 6)
  WHERE id = ?
        ↓
Отправить Telegram студенту:
  "✅ Блок одобрен! Следующий блок разблокирован."
```

---

## Детали каждого шага

### Шаг 1: Проверка доступа

```javascript
const { user, profile } = await requireAuth();
const blockNum = parseInt(new URLSearchParams(location.search).get('block'));

if (profile.blocks_unlocked < blockNum) {
  location.href = '/student/index.html';
  return;
}
```

### Шаг 2: Скрыть конспект

```html
<!-- конспект скрыт по умолчанию -->
<section id="synopsis" style="display:none">
  <!-- контент вставляется через innerHTML только после форума -->
</section>
```

### Шаг 3: YouTube no-skip polling

```javascript
let maxWatched = 0;

const poll = setInterval(() => {
  if (player.getPlayerState() !== YT.PlayerState.PLAYING) return;

  const current = player.getCurrentTime();
  const duration = player.getDuration();

  if (current > maxWatched + 2) {
    player.seekTo(maxWatched);
  } else {
    maxWatched = Math.max(maxWatched, current);
  }

  if (duration > 0 && maxWatched / duration >= 0.95) {
    clearInterval(poll);
    activateForumButton();
  }
}, 500);
```

### Шаг 4: Активация кнопки форума

```javascript
function activateForumButton() {
  const btn = document.getElementById('forum-submit');
  btn.disabled = false;
  btn.classList.remove('btn-locked');
}
```

### Шаг 5: Отправка форума

```javascript
async function submitForum() {
  const text = document.getElementById('forum-text').value.trim();

  if (text.length < 20) {
    toast(t.forum_min_length, 'error');
    return;
  }

  const { error } = await _supabase
    .from('journal_entries')
    .insert({
      user_id: user.id,
      block_id: blockId,
      content: text,
      submitted_to_leader: true
    });

  if (error) { toast(t.error_save, 'error'); return; }

  // Telegram уведомление лидеру
  sendTelegramMsg(TELEGRAM_LEADER_CHAT,
    `📩 <b>${profile.full_name}</b> отправил ответ по блоку «${blockTitle}»\n\n${text.slice(0, 300)}`
  );

  await saveProgress();
}
```

### Шаг 6: Сохранение прогресса

```javascript
async function saveProgress() {
  // проверить дубликат
  const { data: existing } = await _supabase
    .from('student_progress')
    .select('id')
    .eq('user_id', user.id)
    .eq('block_id', blockId)
    .is('lesson_id', null)
    .single();

  if (!existing) {
    await _supabase.from('student_progress').insert({
      user_id: user.id,
      block_id: blockId,
      admin_approved: false
    });
  }

  showSynopsis();
}
```

### Шаг 7: Показать конспект

```javascript
function showSynopsis() {
  const synopsis = document.getElementById('synopsis');
  synopsis.innerHTML = LANG === 'ru' ? block.content_ru : block.content_en;
  synopsis.style.display = 'block';

  // Проверить статус одобрения
  checkApprovalStatus();
}

async function checkApprovalStatus() {
  const { data: progress } = await _supabase
    .from('student_progress')
    .select('admin_approved')
    .eq('user_id', user.id)
    .eq('block_id', blockId)
    .is('lesson_id', null)
    .single();

  const nextBtn = document.getElementById('next-block-btn');
  if (progress?.admin_approved) {
    nextBtn.disabled = false;
    nextBtn.textContent = t.next_block;
  } else {
    nextBtn.disabled = true;
    nextBtn.textContent = '🔒 ' + t.waiting_approval;
  }
}
```

---

## Edge Cases

| Ситуация | Обработка |
|----------|-----------|
| Студент обновил страницу после форума | Проверить существующий journal_entry → пропустить форум, показать конспект |
| Студент уже одобрен | Кнопка "Следующий" сразу активна |
| Видео не загрузилось | onError в YouTube API → toast ошибки |
| Форум пустой | Валидация: length < 20 → toast |
| Блок 6 одобрен | Не инкрементировать blocks_unlocked (максимум 6) |
