// Server Component — навигационные карточки практики блока (под видео и конспектом).
// Заголовок и тексты — для ученика, без внутренней терминологии разработки.

import Link from 'next/link'

interface Props {
  blockId: number
}

export function Stage4Nav({ blockId }: Props) {
  return (
    <div className="lesson-section">
      <h3 className="lesson-section__title">Практика блока</h3>
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
          <span className="lesson-stage4-card__desc">Аудио-пересказ своими словами</span>
        </span>
        <span className="lesson-stage4-card__arrow">›</span>
      </Link>
      <Link href={`/m/prayer/${blockId}`} className="lesson-stage4-card">
        <span className="lesson-stage4-card__icon">🙏</span>
        <span className="lesson-stage4-card__body">
          <span className="lesson-stage4-card__title">Молитва по кресту</span>
          <span className="lesson-stage4-card__desc">Каждый день — отметка, что помолился</span>
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
      <Link href={`/m/friday/${blockId}`} className="lesson-stage4-card">
        <span className="lesson-stage4-card__icon">🤝</span>
        <span className="lesson-stage4-card__body">
          <span className="lesson-stage4-card__title">Эпоха пятницы</span>
          <span className="lesson-stage4-card__desc">Передать «Малый крест» и поделиться впечатлениями</span>
        </span>
        <span className="lesson-stage4-card__arrow">›</span>
      </Link>
      <Link href={`/m/emotions/${blockId}`} className="lesson-stage4-card">
        <span className="lesson-stage4-card__icon">💬</span>
        <span className="lesson-stage4-card__body">
          <span className="lesson-stage4-card__title">Эмоции и свидетельства</span>
          <span className="lesson-stage4-card__desc">Поделиться опытом — текст, аудио или кружок (необязательно)</span>
        </span>
        <span className="lesson-stage4-card__arrow">›</span>
      </Link>
    </div>
  )
}
