'use client'

import { useState } from 'react'

type Result = {
  church_id: string
  invite_token: string
  invite_link: string
  telegram_invite_link: string
}

export default function RegisterChurchPage() {
  const [form, setForm] = useState({
    church_name: '',
    pastor_email: '',
    pastor_name: '',
    pastor_password: '',
    size: 'small',
    region: 'russia',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/church/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || 'Ошибка регистрации')
      } else {
        setResult(json.data)
      }
    } catch {
      setError('Сетевая ошибка')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#141828] rounded-2xl p-8 border border-[#C9A96126]">
          <h1 className="text-2xl font-bold mb-2 text-[#C9A961]">✓ Церковь зарегистрирована!</h1>
          <p className="text-sm text-gray-400 mb-6">Поделитесь ссылкой со своими прихожанами</p>

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Telegram-ссылка</label>
              <div className="mt-1 bg-[#0A0E1A] border border-[#C9A96126] rounded-xl p-3 break-all text-sm font-mono">
                {result.telegram_invite_link}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(result.telegram_invite_link)}
                className="mt-2 text-xs text-[#C9A961] hover:text-[#B89548]"
              >
                Скопировать
              </button>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Прямая ссылка</label>
              <div className="mt-1 bg-[#0A0E1A] border border-[#C9A96126] rounded-xl p-3 break-all text-sm font-mono">
                {result.invite_link}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(result.invite_link)}
                className="mt-2 text-xs text-[#C9A961] hover:text-[#B89548]"
              >
                Скопировать
              </button>
            </div>
          </div>

          <a
            href="/login"
            className="mt-8 block w-full bg-gradient-to-br from-[#C9A961] to-[#B89548] text-[#0A0E1A] font-bold py-3 rounded-xl text-center"
          >
            Войти в админ-панель
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <h1 className="text-3xl font-bold mb-2">КРЕСТ для церкви</h1>
        <p className="text-sm text-gray-400 mb-8">
          Регистрация церкви-партнёра. После регистрации вы получите ссылку для приглашения прихожан в Telegram-бот.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 bg-[#141828] rounded-2xl p-6 border border-[#C9A96126]">
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Название церкви</label>
            <input
              required
              value={form.church_name}
              onChange={(e) => setForm({ ...form, church_name: e.target.value })}
              className="mt-1 w-full bg-[#0A0E1A] border border-[#C9A96126] rounded-xl px-4 py-3 text-sm focus:border-[#C9A961] outline-none"
              placeholder="Церковь Благодати"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Имя пастора</label>
            <input
              required
              value={form.pastor_name}
              onChange={(e) => setForm({ ...form, pastor_name: e.target.value })}
              className="mt-1 w-full bg-[#0A0E1A] border border-[#C9A96126] rounded-xl px-4 py-3 text-sm focus:border-[#C9A961] outline-none"
              placeholder="Иван Петров"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Email</label>
            <input
              required
              type="email"
              value={form.pastor_email}
              onChange={(e) => setForm({ ...form, pastor_email: e.target.value })}
              className="mt-1 w-full bg-[#0A0E1A] border border-[#C9A96126] rounded-xl px-4 py-3 text-sm focus:border-[#C9A961] outline-none"
              placeholder="pastor@church.ru"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Пароль (мин. 8 символов)</label>
            <input
              required
              type="password"
              minLength={8}
              value={form.pastor_password}
              onChange={(e) => setForm({ ...form, pastor_password: e.target.value })}
              className="mt-1 w-full bg-[#0A0E1A] border border-[#C9A96126] rounded-xl px-4 py-3 text-sm focus:border-[#C9A961] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Размер</label>
              <select
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="mt-1 w-full bg-[#0A0E1A] border border-[#C9A96126] rounded-xl px-4 py-3 text-sm focus:border-[#C9A961] outline-none"
              >
                <option value="small">До 50 человек</option>
                <option value="medium">50-200</option>
                <option value="large">200-1000</option>
                <option value="network">Сеть церквей</option>
              </select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Регион</label>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="mt-1 w-full bg-[#0A0E1A] border border-[#C9A96126] rounded-xl px-4 py-3 text-sm focus:border-[#C9A961] outline-none"
              >
                <option value="russia">Россия</option>
                <option value="international">Международная</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl p-3">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-br from-[#C9A961] to-[#B89548] text-[#0A0E1A] font-bold py-3 rounded-xl disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Регистрируем...' : 'Зарегистрировать церковь'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Уже есть аккаунт? <a href="/login" className="text-[#C9A961] hover:text-[#B89548]">Войти</a>
        </p>
      </div>
    </div>
  )
}
