'use client'

import type { MouseEvent } from 'react'
import { Avatar } from '../_components/Avatar'
import type { LeaderRow } from './leaderboard.types'

interface Props {
  row: LeaderRow
}

/** Правильное склонение: 1 очко, 2-4 очка, 5-20 очков (и по последней цифре). */
function pointsWord(n: number): string {
  const mod100 = Math.abs(n) % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'очков'
  if (mod10 === 1) return 'очко'
  if (mod10 >= 2 && mod10 <= 4) return 'очка'
  return 'очков'
}

function TierCrown() {
  return (
    <span className="lb-crown" aria-label="Первое место" role="img">
      👑
    </span>
  )
}

function RankBadge({
  rank,
  tier,
  outOfRanking,
}: {
  rank: number
  tier: LeaderRow['tier']
  outOfRanking?: boolean
}) {
  if (outOfRanking) {
    return (
      <span className="lb-rank lb-rank--out" aria-label="Вне рейтинга">
        —
      </span>
    )
  }
  return <span className={`lb-rank lb-rank--${tier}`}>#{rank}</span>
}

/** Открывает чат с учеником в Telegram (нативно из MiniApp, иначе по ссылке t.me). */
function openTelegram(e: MouseEvent<HTMLAnchorElement>, username: string) {
  const url = `https://t.me/${username}`
  const tg = (window as unknown as {
    Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } }
  })?.Telegram?.WebApp
  if (tg?.openTelegramLink) {
    e.preventDefault()
    tg.openTelegramLink(url)
  }
}

export function LeaderboardCard({ row }: Props) {
  const isBig = row.tier === 'gold'

  return (
    <div
      className={[
        'lb-card',
        `lb-card--${row.tier}`,
        row.is_self ? 'lb-card--self' : '',
        isBig ? 'lb-card--big' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Шапка: ранг + аватар + имя + баллы */}
      <div className="lb-card__head">
        <RankBadge rank={row.rank} tier={row.tier} outOfRanking={row.outOfRanking} />

        <div className="lb-avatar-wrap">
          {isBig && <TierCrown />}
          <Avatar src={row.avatar_url} name={row.name} size={isBig ? 56 : 44} />
        </div>

        <div className="lb-card__info">
          <div className="lb-card__name">
            {row.name}
            {row.is_self && <span className="lb-you"> · вы</span>}
          </div>
          {row.telegram && (
            <a
              className="lb-card__telegram lb-card__telegram--link"
              href={`https://t.me/${row.telegram}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => openTelegram(e, row.telegram!)}
            >
              @{row.telegram}
            </a>
          )}
          {row.city && <div className="lb-card__city">{row.city}</div>}
        </div>

        <div className="lb-card__points">
          <span className="lb-points-num">{row.points}</span>
          <span className="lb-points-cap">{pointsWord(row.points)}</span>
        </div>
      </div>

      {/* Мета-чипы */}
      <div className="lb-card__meta">
        <span className="lb-chip">Блок {row.currentBlock}</span>
        <span className="lb-chip">Сдано {row.blocksPassed}</span>
        <span className="lb-chip">🔥 {row.currentStreak} дн.</span>
        <span className="lb-chip">{row.closedDays} закрыто</span>
      </div>

      {/* Ачивки */}
      {row.achievements.length > 0 && (
        <div className="lb-card__achievements">
          {row.achievements.map((a) => (
            <span key={a} className="lb-badge">
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
