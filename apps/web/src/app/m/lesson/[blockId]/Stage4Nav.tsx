// Server Component — навигационные карточки практики блока (под видео и конспектом).
// Заголовок и тексты — для ученика, без внутренней терминологии разработки.
// data-s4-key на каждой карточке — для вставки статус-бейджей через Stage4Status.

import Link from 'next/link'
import {
  IconBook,
  IconCamera,
  IconCards,
  IconCross,
  IconMessage,
  IconMic,
} from '@/app/m/_components/icons'

interface Props {
  blockId: number
}

const ICON_CLASS = 'lesson-stage4-card__icon-svg'

export function Stage4Nav({ blockId }: Props) {
  return (
    <div className="lesson-section">
      <h3 className="lesson-section__title">Практика блока</h3>

      {/* ── Обязательно для закрытия дня (порядок как в чеклисте «закрой день») ── */}
      <p className="lesson-stage4-grouplabel">Для закрытия дня</p>
      <Link href={`/m/cross-photo/${blockId}`} className="lesson-stage4-card" data-s4-key="cross_photo">
        <span className="lesson-stage4-card__icon">
          <IconCamera className={ICON_CLASS} />
        </span>
        <span className="lesson-stage4-card__body">
          <span className="lesson-stage4-card__title">Ежедневное фото</span>
          <span className="lesson-stage4-card__desc">7 дней — фото написания Креста</span>
        </span>
        <span className="lesson-stage4-card__arrow">›</span>
      </Link>
      <Link href={`/m/prayer/${blockId}`} className="lesson-stage4-card" data-s4-key="prayer">
        <span className="lesson-stage4-card__icon">
          <IconCross className={ICON_CLASS} />
        </span>
        <span className="lesson-stage4-card__body">
          <span className="lesson-stage4-card__title">Молитва по кресту</span>
          <span className="lesson-stage4-card__desc">Каждый день — отметка, что помолился</span>
        </span>
        <span className="lesson-stage4-card__arrow">›</span>
      </Link>
      <Link href={`/m/locations/${blockId}`} className="lesson-stage4-card" data-s4-key="locations">
        <span className="lesson-stage4-card__icon">
          <IconBook className={ICON_CLASS} />
        </span>
        <span className="lesson-stage4-card__body">
          <span className="lesson-stage4-card__title">Местописания</span>
          <span className="lesson-stage4-card__desc">Произнести стихи вслух — аудио и видеокружки</span>
        </span>
        <span className="lesson-stage4-card__arrow">›</span>
      </Link>
      <Link href={`/m/recitation/${blockId}`} className="lesson-stage4-card" data-s4-key="recitation">
        <span className="lesson-stage4-card__icon">
          <IconMic className={ICON_CLASS} />
        </span>
        <span className="lesson-stage4-card__body">
          <span className="lesson-stage4-card__title">Пересказ блока</span>
          <span className="lesson-stage4-card__desc">Аудио-пересказ своими словами</span>
        </span>
        <span className="lesson-stage4-card__arrow">›</span>
      </Link>

      {/* ── По желанию ── */}
      <p className="lesson-stage4-grouplabel">По желанию</p>
      <Link href={`/m/trainer/${blockId}`} className="lesson-stage4-card" data-s4-key="trainer">
        <span className="lesson-stage4-card__icon">
          <IconCards className={ICON_CLASS} />
        </span>
        <span className="lesson-stage4-card__body">
          <span className="lesson-stage4-card__title">Тренажёр местописаний</span>
          <span className="lesson-stage4-card__desc">Выучить стихи перед сдачей — карточки, пропуски, викторина</span>
        </span>
        <span className="lesson-stage4-card__arrow">›</span>
      </Link>
      <Link href={`/m/emotions/${blockId}`} className="lesson-stage4-card" data-s4-key="emotions">
        <span className="lesson-stage4-card__icon">
          <IconMessage className={ICON_CLASS} />
        </span>
        <span className="lesson-stage4-card__body">
          <span className="lesson-stage4-card__title">Эмоции и свидетельства</span>
          <span className="lesson-stage4-card__desc">
            Что ты пережил после — расскажи куратору. Выйди на места действия, передай «Малый крест»
            людям. Текст, аудио или кружок.
          </span>
          <span className="lesson-stage4-badge lesson-stage4-badge--optional">по желанию</span>
        </span>
        <span className="lesson-stage4-card__arrow">›</span>
      </Link>
    </div>
  )
}
