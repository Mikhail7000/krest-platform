// Supabase + Telegram Mini App initialization
const SUPABASE_URL = 'https://aejhlmoydnhgedgfndql.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlamhsbW95ZG5oZ2VkZ2ZuZHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTkxNjEsImV4cCI6MjA5MjE3NTE2MX0.OhWK6etLZPw6_uWUNxJExCNEBdKg_JGWe50s4n0JCyw';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// i18n
const T = {
  ru: {
    loading: 'Загрузка...',
    error: 'Ошибка',
    login: 'Войти',
    logout: 'Выйти',
    email: 'Email',
    password: 'Пароль',
    myProgress: 'Мой прогресс',
    block: 'Блок',
    locked: '🔒 Заблокирован',
    available: '▶️ Доступен',
    pending: '⏳ На проверке',
    approved: '✅ Завершён',
    openLesson: 'Открыть урок',
    watchVideo: 'Смотреть видео',
    forum: 'Форум',
    forumPlaceholder: 'Напишите ответ (минимум 20 символов)...',
    send: 'Отправить',
    konspekt: 'Конспект',
    nextBlock: 'Следующий блок',
    pendingApproval: 'Ожидает одобрения лидера',
    loginError: 'Ошибка входа. Проверьте email и пароль.',
    forumMin: 'Минимум 20 символов',
    saved: 'Сохранено!',
    watchFull: 'Посмотрите видео полностью',
  }
};
const LANG = localStorage.getItem('crest_lang') || 'ru';
const t = T[LANG];
