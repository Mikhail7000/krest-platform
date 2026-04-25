// ============================================================
// CREST Platform — Auth helpers
// ============================================================

async function getCurrentUser() {
  const { data: { user } } = await _supabase.auth.getUser();
  return user;
}

async function getProfile(userId) {
  const { data } = await _supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

async function requireAuth(redirectTo = '/login.html') {
  const user = await getCurrentUser();
  if (!user) { location.href = redirectTo; return null; }
  const profile = await getProfile(user.id);
  return { user, profile };
}

async function requireAdmin(redirectTo = '/student/index.html') {
  const ctx = await requireAuth();
  if (!ctx) return null;
  if (ctx.profile.role !== 'admin') { location.href = redirectTo; return null; }
  return ctx;
}

async function logout() {
  await _supabase.auth.signOut();
  location.href = '/login.html';
}

async function grantAdmin(userId, grant = true) {
  const { error } = await _supabase
    .from('profiles')
    .update({ role: grant ? 'admin' : 'student' })
    .eq('id', userId);
  return !error;
}

async function updateProfile(userId, data) {
  const { error } = await _supabase
    .from('profiles')
    .update(data)
    .eq('id', userId);
  return !error;
}

// Render top nav bar into element with id="topnav"
function renderNav(profile, isAdmin = false) {
  const nav = document.getElementById('topnav');
  if (!nav) return;
  nav.innerHTML = `
    <div class="nav-brand">
      <span class="nav-brand-main">КРЕСТ — путь спасения</span>
      <span class="nav-brand-sub">(Церковь — любовь Христа)</span>
    </div>
    <div class="nav-links">
      ${isAdmin ? `<a href="/admin/index.html" class="nav-link">${t.dashboard}</a>` : ''}
      ${isAdmin ? `<a href="/admin/students.html" class="nav-link">${t.students}</a>` : ''}
      ${isAdmin ? `<a href="/admin/editor.html" class="nav-link">${t.editor}</a>` : ''}
      ${!isAdmin ? `<a href="/student/index.html" class="nav-link">${t.dashboard}</a>` : ''}
      ${!isAdmin ? `<a href="/student/trainer.html" class="nav-link">${LANG==='ru'?'Тренажёр':'Trainer'}</a>` : ''}
    </div>
    <div class="nav-right">
      <span class="nav-user">${profile.full_name || profile.email}</span>
      <button class="btn-sm" onclick="setLang('${LANG === 'ru' ? 'en' : 'ru'}')">${t.lang}</button>
      <button class="btn-sm btn-outline" onclick="logout()">${t.logout}</button>
    </div>
  `;
}

// Show toast notification
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// Format date
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(LANG === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

// Extract YouTube video ID
function ytId(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/)([^&\s]+)/);
  return m ? m[1] : null;
}

// Send Telegram message (fire-and-forget, never throws)
async function sendTelegramMsg(chatId, text) {
  if (!chatId || !TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (_) {}
}

// YouTube embed HTML
function ytEmbed(url) {
  const id = ytId(url);
  if (!id) return '';
  return `<div class="video-wrap">
    <iframe src="https://www.youtube.com/embed/${id}" frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen></iframe>
  </div>`;
}
