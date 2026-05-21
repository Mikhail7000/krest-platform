'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { MainButton } from '@/components/telegram/MainButton'
import { BackButton } from '@/components/telegram/BackButton'
import { useHaptic } from '@/hooks/useHaptic'

interface Student {
  id: string
  full_name: string | null
  avatar_url: string | null
  current_block: number
  status: 'not_started' | 'video_watching' | 'quiz_passed' | 'locations_passed' | 'block_completed'
  last_activity_at: string | null
  submissions_pending: number
  days_silent: number
}

const STATUS_LABELS: Record<Student['status'], { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'bg-slate-200 text-slate-800' },
  video_watching: { label: 'Watching Video', color: 'bg-blue-200 text-blue-800' },
  quiz_passed: { label: 'Quiz Passed', color: 'bg-green-200 text-green-800' },
  locations_passed: { label: 'Locations Passed', color: 'bg-purple-200 text-purple-800' },
  block_completed: { label: 'Completed', color: 'bg-emerald-200 text-emerald-800' },
}

export default function CuratorDashboard() {
  const { profile, loading } = useTelegram()
  const { impact } = useHaptic()
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'silent'>('all')

  useEffect(() => {
    if (!profile?.id) return

    const fetchStudents = async () => {
      try {
        const params = new URLSearchParams()
        const res = await fetch(`/api/curator/students?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to load students')

        const data = await res.json()
        setStudents(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoadingStudents(false)
      }
    }

    setLoadingStudents(true)
    fetchStudents()
  }, [profile?.id, selectedFilter])

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-12 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded mb-4" />
          <div className="h-4 bg-slate-100 rounded mb-2" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-12 text-center text-red-600">
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm mt-2">Curator role required</p>
      </div>
    )
  }

  const filteredStudents =
    selectedFilter === 'pending'
      ? students.filter((s) => s.submissions_pending > 0)
      : selectedFilter === 'silent'
        ? students.filter((s) => s.days_silent >= 1)
        : students

  const pendingCount = students.reduce((sum, s) => sum + s.submissions_pending, 0)
  const silentCount = students.filter((s) => s.days_silent >= 1).length

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {students.length} {students.length === 1 ? 'student' : 'students'}
        </p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => {
            setSelectedFilter('all')
            impact('light')
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
            selectedFilter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          All ({students.length})
        </button>
        <button
          onClick={() => {
            setSelectedFilter('pending')
            impact('light')
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
            selectedFilter === 'pending'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          📝 Pending ({pendingCount})
        </button>
        <button
          onClick={() => {
            setSelectedFilter('silent')
            impact('light')
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
            selectedFilter === 'silent'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          🤐 Silent ({silentCount})
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      {loadingStudents && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loadingStudents && filteredStudents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No students found</p>
        </div>
      )}

      {!loadingStudents && (
        <div className="space-y-3">
          {filteredStudents.map((student) => {
            const statusConfig = STATUS_LABELS[student.status]
            return (
              <Link
                key={student.id}
                href={`/m/curator/students/${student.id}`}
                onClick={() => impact('medium')}
              >
                <div className="bg-card border border-slate-200 rounded-lg p-3 active:scale-95 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">
                        {student.full_name || 'Anonymous'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Block {student.current_block}
                      </div>
                      <div className={`inline-block text-xs font-medium rounded px-2 py-1 mt-2 ${statusConfig.color}`}>
                        {statusConfig.label}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {student.submissions_pending > 0 && (
                        <div className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                          {student.submissions_pending}
                        </div>
                      )}
                      {student.days_silent > 0 && student.submissions_pending === 0 && (
                        <div className="text-sm text-yellow-600 font-semibold">{student.days_silent}d silent</div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <MainButton text="Refresh" onClick={() => window.location.reload()} visible={!loadingStudents} />
      <BackButton />
    </div>
  )
}
