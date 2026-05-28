// Line-иконки (feather/lucide-стиль) — наследуют currentColor и размер из CSS.
// Используем вместо эмодзи: выглядят аккуратно и единообразно на тёмном фоне.
import type { SVGProps } from 'react'

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

// Местописания — открытая книга
export function IconBook(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </Svg>
  )
}

// Пересказ — микрофон
export function IconMic(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </Svg>
  )
}

// Молитва по кресту — крест
export function IconCross(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 3v18" />
      <path d="M6 8.5h12" />
    </Svg>
  )
}

// Ежедневное фото — камера
export function IconCamera(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <circle cx="12" cy="13" r="3.2" />
    </Svg>
  )
}

// Эпоха пятницы — передача / рукопожатие (две фигуры)
export function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

// Эмоции и свидетельства — реплика
export function IconMessage(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8A8.5 8.5 0 0 1 21 11.5z" />
    </Svg>
  )
}

// Навигация — дом
export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </Svg>
  )
}

// Навигация — профиль (один человек)
export function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </Svg>
  )
}

// Промежуточный экзамен — академическая шапочка
export function IconGraduation(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M22 10 12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-5" />
      <path d="M22 10v6" />
    </Svg>
  )
}

// Финальный экзамен — звезда
export function IconStar(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 2.5l2.9 5.9 6.6.9-4.8 4.6 1.1 6.6L12 18.9 6.2 21l1.1-6.6L2.5 9.8l6.6-.9z" />
    </Svg>
  )
}

// Сертификат — кубок
export function IconTrophy(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M6 3h12v6a6 6 0 0 1-12 0z" />
      <path d="M9 21h6" />
      <path d="M12 15v6" />
    </Svg>
  )
}
