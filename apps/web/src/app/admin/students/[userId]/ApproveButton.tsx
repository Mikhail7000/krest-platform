'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ApproveButtonProps {
  userId: string
  blockId: string
  progressId: string
}

export function ApproveButton({ userId, blockId, progressId }: ApproveButtonProps) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function handleApprove() {
    setLoading(true)
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, blockId, progressId }),
    })
    if (res.ok) {
      setDone(true)
      router.refresh()
    }
    setLoading(false)
  }

  if (done) return <span className="text-sm text-green-600 font-medium">✅ Одобрено</span>

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="shrink-0 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
    >
      {loading ? '...' : 'Одобрить'}
    </button>
  )
}
