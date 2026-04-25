// Supabase + Telegram Mini App initialization
const SUPABASE_URL = 'https://aejhlmoydnhgedgfndql.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlamhsbW95ZG5oZ2VkZ2ZuZHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTU3MzcsImV4cCI6MjA2MTA5MTczN30.KGgNp2RVqoV5GdXhZEByukKT6gvdCGqAzh0e0R6NKHI';

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
    trainerTitle: 'Тренажёр стихов',
    trainerSubtitle: 'Учите стихи Библии',
    reveal: 'Показать',
    iKnow: 'Знаю ✓',
    tryAgain: 'Ещё раз ↩',
    versesProgress: 'стихов',
    allLearned: 'Все стихи выучены!',
    greatWork: 'Отличная работа!',
    repeatAgain: 'Повторить снова',
    versesAppear: 'Стихи появятся после открытия блоков',
    profile: 'Профиль',
    blocksCompleted: 'Блоков пройдено',
    journalEntries: 'Записей в журнале',
    language: 'Язык',
    logoutConfirm: 'Вы вышли из системы',
    telegramConnected: 'Telegram уведомления подключены',
    telegramNotConnected: 'Чтобы получать уведомления от лидера, напишите /start нашему боту @krest_bot',
    setupTitle: 'Настройка',
    setupWelcome: 'Добро пожаловать в КРЕСТ',
    selectFormat: 'Выберите формат обучения',
    howStudy: 'Как вы планируете проходить курс?',
    online: 'Онлайн',
    offline: 'Офлайн',
    onlineDesc: 'Я буду проходить курс дистанционно',
    offlineDesc: 'Я хожу в горницу в своём городе',
    selectCity: 'Выберите город',
    whereAreYou: 'В каком городе вы находитесь?',
    russia: 'Россия',
    international: 'За рубежом',
    selectNastavnik: 'Выберите наставника',
    leadersInCity: 'Лидеры в вашем городе',
    noLeaders: 'В вашем городе пока нет наставника',
    continueWithout: 'Продолжить без наставника',
    back: 'Назад',
    next: 'Далее',
    finish: 'Завершить',
    saving: 'Сохранение...',
    setupComplete: 'Настройка завершена!',
  }
};
const LANG = localStorage.getItem('crest_lang') || 'ru';
const t = T[LANG];
