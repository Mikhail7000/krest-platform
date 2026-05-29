'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { MainButton } from '@/components/telegram/MainButton'
import { BackButton } from '@/components/telegram/BackButton'
import { useHaptic } from '@/hooks/useHaptic'
import { pluralDays } from '@/lib/activity/streak'

interface StudentProgress {
  id: string
  full_name: string | null
  current_block: number
  blocks: Array<{
    block_id: number
    status: 'not_started' | 'in_progress' | 'completed'
    completed_at: string | null
    submissions_pending: number
  }>
  activity?: {
    streak: number
    total: number
    openedToday: boolean
    lastActive: string | null
    days: Array<{ date: string; on: boolean }>
  }
}

export default function StudentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { impact } = useHaptic()
  const studentId = params.id as string

  const [student, setStudent] = useState<StudentProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId) return

    const getInitData = () =>
      (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
        ?.initData ?? ''
    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/curator/students/${studentId}/progress`, {
          headers: { 'X-Init-Data': getInitData() },
        })
        if (!res.ok) {
          if (res.status === 404) throw new Error('Student not found')
          throw new Error('Failed to load student progress')
        }
        const data = await res.json()
        setStudent(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    setLoading(true)
    fetchProgress()
  }, [studentId])

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-12 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-slate-200 rounded" />
          <div className="h-4 bg-slate-100 rounded" />
          <div className="space-y-3 mt-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-red-600 font-semibold">{error || 'Student not found'}</p>
        <button
          onClick={() => {
            impact('medium')
            router.back()
          }}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
        >
          Go Back
        </button>
      </div>
    )
  }

  const completedCount = student.blocks.filter((b) => b.status === 'completed').length
  const totalPending = student.blocks.reduce((sum, b) => sum + b.submissions_pending, 0)

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{student.full_name || 'Anonymous'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {completedCount}/{student.blocks.length} blocks completed
        </p>
        {totalPending > 0 && (
          <div className="mt-3 inline-block bg-orange-100 border border-orange-300 rounded-full px-3 py-1">
            <span className="text-orange-800 text-sm font-semibold">{totalPending} pending submissions</span>
          </div>
        )}
      </div>

      {student.activity && (
        <div className="bg-card border border-slate-200 rounded-lg p-4 mb-6">
          <div className="text-xs text-muted-foreground uppercase font-semibold mb-2">
            Активность в КРЕСТ
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{student.activity.streak}</span>
            <span className="text-sm text-muted-foreground">
              {pluralDays(student.activity.streak)} подряд
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${student.activity.openedToday ? 'bg-emerald-500' : 'bg-slate-300'}`}
            />
            <span className="text-sm text-foreground">
              {student.activity.openedToday ? 'Заходил сегодня' : 'Сегодня ещё не заходил'}
            </span>
          </div>
          {student.activity.lastActive && (
            <div className="text-xs text-muted-foreground mt-1">
              Последний вход:{' '}
              {new Date(student.activity.lastActive).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
              })}
            </div>
          )}
          <div className="flex gap-1 mt-3">
            {student.activity.days.map((d) => (
              <span
                key={d.date}
                title={d.date}
                className={`flex-1 h-5 rounded ${d.on ? 'bg-emerald-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Последние 14 дней</div>
        </div>
      )}

      <div className="bg-card border border-slate-200 rounded-lg p-4 mb-6">
        <div className="text-xs text-muted-foreground uppercase font-semibold mb-2">Progress</div>
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{
              width: `${(completedCount / student.blocks.length) * 100}%`,
            }}
          />
        </div>
        <div className="text-sm font-medium text-foreground mt-2">
          {completedCount} of {student.blocks.length} blocks
        </div>
      </div>

      <div className="space-y-3">
        {student.blocks.map((block) => {
          const statusColor =
            block.status === 'completed'
              ? 'bg-emerald-50 border-emerald-200'
              : block.status === 'in_progress'
                ? 'bg-blue-50 border-blue-200'
                : 'bg-slate-50 border-slate-200'

          const statusLabel =
            block.status === 'completed'
              ? '✅ Completed'
              : block.status === 'in_progress'
                ? '⏳ In Progress'
                : '⭕ Not Started'

          return (
            <button
              key={block.block_id}
              onClick={() => {
                impact('light')
              }}
              className={`w-full text-left bg-card border rounded-lg p-4 active:scale-95 transition ${statusColor}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-foreground">Block {block.block_id}</div>
                  <div className="text-xs text-muted-foreground mt-1">{statusLabel}</div>
                  {block.completed_at && (
                    <div className="text-xs text-emerald-700 mt-1">
                      {new Date(block.completed_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  )}
                </div>
                {block.submissions_pending > 0 && (
                  <div className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {block.submissions_pending}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-8 space-y-3 border-t border-slate-200 pt-6">
        <button
          onClick={() => {
            impact('medium')
          }}
          className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-3 font-medium text-sm active:scale-95 transition"
        >
          📝 View Submissions
        </button>
        <button
          onClick={() => {
            impact('light')
          }}
          className="w-full bg-slate-100 text-foreground rounded-lg px-4 py-3 font-medium text-sm active:scale-95 transition"
        >
          🎓 Send Exam
        </button>
      </div>

      <MainButton text="Back" onClick={() => router.back()} />
      <BackButton />
    </div>
  )
}
