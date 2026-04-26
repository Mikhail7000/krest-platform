import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      {/* Hero */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <div className="text-5xl mb-4">✝️</div>
        <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
          КРЕСТ
        </h1>
        <p className="text-xl md:text-2xl text-[#C9A961] mb-2">
          Узнай христианство за 6 недель
        </p>
        <p className="text-base text-gray-400 mb-10 max-w-2xl mx-auto">
          С живым наставником и в кругу таких же ищущих — прямо в Telegram.
          Без страха перед офлайн-церковью, без одиночества с YouTube-роликами.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://t.me/cross_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-br from-[#229ED9] to-[#1B7BAB] text-white font-bold px-8 py-4 rounded-xl text-lg hover:opacity-90 transition-opacity"
          >
            ✈️ Начать в Telegram
          </a>
          <Link
            href="/register-church"
            className="bg-gradient-to-br from-[#C9A961] to-[#B89548] text-[#0A0E1A] font-bold px-8 py-4 rounded-xl text-lg hover:opacity-90 transition-opacity"
          >
            Стать партнёром церкви
          </Link>
        </div>
      </section>

      {/* Что внутри */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Как это работает</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-[#141828] rounded-2xl p-6 border border-[#C9A96126]">
            <div className="text-3xl mb-3">📖</div>
            <h3 className="text-lg font-bold mb-2 text-[#C9A961]">6 блоков курса</h3>
            <p className="text-sm text-gray-400">
              Структурированный путь от вопроса &laquo;откуда мы&raquo; до решения личного выбора веры.
            </p>
          </div>
          <div className="bg-[#141828] rounded-2xl p-6 border border-[#C9A96126]">
            <div className="text-3xl mb-3">👨‍🏫</div>
            <h3 className="text-lg font-bold mb-2 text-[#C9A961]">Живой наставник</h3>
            <p className="text-sm text-gray-400">
              Пастор церкви читает каждый твой ответ и одобряет блок лично — никаких автоматических тестов.
            </p>
          </div>
          <div className="bg-[#141828] rounded-2xl p-6 border border-[#C9A96126]">
            <div className="text-3xl mb-3">👥</div>
            <h3 className="text-lg font-bold mb-2 text-[#C9A961]">Малая группа</h3>
            <p className="text-sm text-gray-400">
              5-12 единомышленников проходят курс параллельно — обсуждение в Telegram-группе.
            </p>
          </div>
        </div>
      </section>

      {/* Для церквей */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-[#141828] to-[#0F1320] rounded-3xl p-8 md:p-12 border border-[#C9A96126]">
          <h2 className="text-3xl font-bold mb-4">Для пасторов</h2>
          <p className="text-gray-400 mb-6">
            КРЕСТ заменяет 20 часов ручной работы в месяц на 5. Веди 20-50 учеников вместо 5-10
            при том же времени. Платформа бесплатна для студентов.
          </p>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-3">
              <span className="text-[#C9A961] font-bold">✓</span>
              <span className="text-sm text-gray-300">No-skip видео — студент реально смотрит, не пробегает</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#C9A961] font-bold">✓</span>
              <span className="text-sm text-gray-300">Форум-рефлексия после видео — видно понимание</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#C9A961] font-bold">✓</span>
              <span className="text-sm text-gray-300">Streak-механика и малые группы — retention 30-50% (vs 5-10% у конкурентов)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#C9A961] font-bold">✓</span>
              <span className="text-sm text-gray-300">Telegram Mini App — нет барьера установки приложения</span>
            </li>
          </ul>
          <Link
            href="/register-church"
            className="inline-block bg-gradient-to-br from-[#C9A961] to-[#B89548] text-[#0A0E1A] font-bold px-6 py-3 rounded-xl"
          >
            Зарегистрировать церковь
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-sm text-gray-600 border-t border-[#C9A96126]">
        <p>КРЕСТ — платформа управляемого ученичества для евангельских церквей</p>
        <p className="mt-2">
          <Link href="/login" className="text-[#C9A961] hover:underline">Вход для пасторов</Link>
        </p>
      </footer>
    </div>
  )
}
