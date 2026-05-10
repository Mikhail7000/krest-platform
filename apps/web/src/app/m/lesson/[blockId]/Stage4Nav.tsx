// Server Component — bottom navigation cards to Этап 4 pages
// Progress counts are not fetched here (require initData); shown as links with labels.
// TODO: fetch progress counts via server-side after database-architect adds tables

import Link from 'next/link'

interface Props {
  blockId: number
}

export function Stage4Nav({ blockId }: Props) {
  return (
    <div className="lesson-section">
      <h3 className="lesson-section__title">Этап 4 — Практика</h3>
      <Link href={`/m/locations/${blockId}`} className="lesson-stage4-card">
        <span className="lesson-stage4-card__icon">📖</span>
        <span className="lesson-stage4-card__body">
          <span className="lesson-stage4-card__title">Местописания</span>
          <span className="lesson-stage4-card__desc">Произнести стихи вслух — аудио и видеокружки</span>
        </span>
        <span className="lesson-stage4-card__arrow">›</span>
      </Link>
      <Link href={`/m/recitation/${blockId}`} className="lesson-stage4-card">
        <span className="lesson-stage4-card__icon">🎙️</span>
        <span className="lesson-stage4-card__body">
          <span className="lesson-stage4-card__title">Пересказ блока</span>
          <span className="lesson-stage4-card__desc">Аудио + видеокружки своими словами</span>
        </span>
        <span className="lesson-stage4-card__arrow">›</span>
      </Link>
      <Link href={`/m/cross-photo/${blockId}`} className="lesson-stage4-card">
        <span className="lesson-stage4-card__icon">✝️</span>
        <span className="lesson-stage4-card__body">
          <span className="lesson-stage4-card__title">Ежедневное фото</span>
          <span className="lesson-stage4-card__desc">7 дней — фото написания Креста</span>
        </span>
        <span className="lesson-stage4-card__arrow">›</span>
      </Link>
    </div>
  )
}
