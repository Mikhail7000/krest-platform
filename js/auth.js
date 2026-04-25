// Auth helpers for Telegram Mini App

async function requireAuth() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) {
    window.location.href = './index.html';
    return null;
  }
  const { data: profile } = await _supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  return { user: session.user, profile };
}

function toast(msg, type = 'info') {
  const existing = document.querySelector('.tg-toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'tg-toast tg-toast--' + type;
  el.textContent = msg;
  document.body.appendChild(el);

  if (tg?.HapticFeedback) {
    if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
    if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
  }

  setTimeout(() => el.remove(), 3000);
}

async function requireAdmin() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) { window.location.href = './index.html'; return null; }
  const { data: profile } = await _supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  if (!profile || profile.role !== 'admin') {
    window.location.href = './index.html';
    return null;
  }
  return { user: session.user, profile };
}

function showLoading(show) {
  const el = document.getElementById('loading');
  if (el) el.style.display = show ? 'flex' : 'none';
}
