'use client'

import { useState, useEffect } from 'react'
import { useTelegram } from '@/components/telegram/TelegramProvider'
import { MainButton } from '@/components/telegram/MainButton'
import { BackButton } from '@/components/telegram/BackButton'
import { useHaptic } from '@/hooks/useHaptic'

interface Submission {
  id: string
  student_id: string
  student_name: string
  block_id: number
  assignment_type: string
  submission_date: string
  content_text: string | null
  media_url: string | null
  media_type: string | null
  status: 'pending' | 'approved' | 'auto_approved' | 'rejected'
  reviewer_comment: string | null
  created_at: string
}

const ASSIGNMENT_LABELS: Record<string, string> = {
  reflection_forum: '💭 Reflection Forum',
  summary: '📝 Summary',
  daily_cross: '✝️ Daily Cross',
  locations: '🗺️ Locations',
  friday_practice: '🎯 Friday Practice',
  daily_report: '📊 Daily Report',
}

export default function SubmissionsPage() {
  const { profile } = useTelegram()
  const { impact } = useHaptic()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const res = await fetch('/api/curator/submissions?status=pending&limit=100')
        if (!res.ok) throw new Error('Failed to load submissions')
        const data = await res.json()
        setSubmissions(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    setLoading(true)
    fetchSubmissions()
  }, [])

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-12 text-center">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!selectedSubmission) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-6 pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">📋 Submissions</h1>
          <p className="text-sm text-muted-foreground mt-1">{submissions.length} pending</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-800 text-sm">
            {error}
          </div>
        )}

        {submissions.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-semibold">✨ All caught up!</p>
            <p className="text-sm mt-1">No pending submissions</p>
          </div>
        )}

        <div className="space-y-3">
          {submissions.map((sub) => (
            <button
              key={sub.id}
              onClick={() => {
                setSelectedSubmission(sub)
                impact('medium')
              }}
              className="w-full text-left bg-card border border-orange-200 rounded-lg p-4 active:scale-95 transition hover:border-orange-400"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground truncate">{sub.student_name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Block {sub.block_id} • {ASSIGNMENT_LABELS[sub.assignment_type] || sub.assignment_type}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {new Date(sub.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="text-orange-600 font-bold text-2xl flex-shrink-0">→</div>
              </div>
            </button>
          ))}
        </div>

        <MainButton text="Refresh" onClick={() => window.location.reload()} visible={submissions.length > 0} />
        <BackButton />
      </div>
    )
  }

  return (
    <SubmissionDetail
      submission={selectedSubmission}
      onBack={() => setSelectedSubmission(null)}
      onApproved={() => {
        setSubmissions(submissions.filter((s) => s.id !== selectedSubmission.id))
        setSelectedSubmission(null)
      }}
    />
  )
}

interface SubmissionDetailProps {
  submission: Submission
  onBack: () => void
  onApproved: () => void
}

function SubmissionDetail({ submission, onBack, onApproved }: SubmissionDetailProps) {
  const { impact } = useHaptic()
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async () => {
    setApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/curator/submissions/${submission.id}/approve`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to approve')
      impact('success')
      onApproved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      impact('error')
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectComment || rejectComment.length < 10) {
      setError('Comment must be at least 10 characters')
      return
    }

    setRejecting(true)
    setError(null)
    try {
      const res = await fetch(`/api/curator/submissions/${submission.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer_comment: rejectComment }),
      })
      if (!res.ok) throw new Error('Failed to reject')
      impact('success')
      onApproved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      impact('error')
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 pb-24">
      <button
        onClick={() => {
          impact('light')
          onBack()
        }}
        className="text-primary mb-4 text-sm font-semibold"
      >
        ← Back
      </button>

      <div className="bg-card border border-slate-200 rounded-lg p-4 mb-4">
        <p className="text-xs text-muted-foreground">From</p>
        <p className="text-lg font-bold text-foreground">{submission.student_name}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Block {submission.block_id} • {ASSIGNMENT_LABELS[submission.assignment_type] || submission.assignment_type}
        </p>
      </div>

      {submission.content_text && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Text Submission</p>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{submission.content_text}</p>
        </div>
      )}

      {submission.media_url && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">
            Media ({submission.media_type})
          </p>
          {submission.media_type === 'image' && (
            <img
              src={submission.media_url}
              alt="submission"
              className="w-full h-auto rounded max-h-64 object-cover"
            />
          )}
          {submission.media_type === 'video' && (
            <video src={submission.media_url} controls className="w-full h-auto rounded max-h-64" />
          )}
          {submission.media_type === 'audio' && <audio src={submission.media_url} controls className="w-full" />}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-800 text-sm">{error}</div>
      )}

      <div className="space-y-3 border-t border-slate-200 pt-4">
        <button
          onClick={handleApprove}
          disabled={approving}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-4 py-3 font-medium text-sm active:scale-95 transition disabled:opacity-50"
        >
          {approving ? '⏳ Approving...' : '✅ Approve'}
        </button>

        <div className="space-y-2">
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Why are you rejecting? (min 10 chars)"
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={3}
          />
          <button
            onClick={handleReject}
            disabled={rejecting || rejectComment.length < 10}
            className="w-full bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-3 font-medium text-sm active:scale-95 transition disabled:opacity-50"
          >
            {rejecting ? '⏳ Rejecting...' : '❌ Reject'}
          </button>
        </div>
      </div>

      <BackButton onClick={onBack} />
    </div>
  )
}
