'use client'

import { useState, useEffect } from 'react'

interface SupportRequest {
  id: string
  telegram_user_id: number
  telegram_username: string | null
  message: string
  status: 'new' | 'read' | 'resolved'
  created_at: string
}

export default function SupportPage() {
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'new' | 'read' | 'resolved' | 'all'>('new')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true)
      setError(null)
      try {
        const statusParam = filter === 'all' ? '' : `&status=${filter}`
        const res = await fetch(`/api/super-admin/support?limit=100${statusParam}`)
        if (!res.ok) throw new Error('Failed to load requests')
        const data = await res.json()
        setRequests(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchRequests()
  }, [filter])

  const handleStatusChange = async (id: string, newStatus: 'read' | 'resolved') => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/super-admin/support/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update')

      setRequests((prev) =>
        prev.map((req) => (req.id === id ? { ...req, status: newStatus } : req))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setUpdatingId(null)
    }
  }

  const newCount = requests.filter((r) => r.status === 'new').length
  const readCount = requests.filter((r) => r.status === 'read').length
  const resolvedCount = requests.filter((r) => r.status === 'resolved').length

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-foreground mb-4">Support Requests</h2>

        {/* Filter buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-slate-200 text-foreground hover:bg-slate-300'
            }`}
          >
            All ({requests.length})
          </button>
          <button
            onClick={() => setFilter('new')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              filter === 'new'
                ? 'bg-primary text-primary-foreground'
                : 'bg-slate-200 text-foreground hover:bg-slate-300'
            }`}
          >
            🆕 New ({newCount})
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              filter === 'read'
                ? 'bg-primary text-primary-foreground'
                : 'bg-slate-200 text-foreground hover:bg-slate-300'
            }`}
          >
            👁️ Read ({readCount})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              filter === 'resolved'
                ? 'bg-primary text-primary-foreground'
                : 'bg-slate-200 text-foreground hover:bg-slate-300'
            }`}
          >
            ✅ Resolved ({resolvedCount})
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-muted-foreground">
          <div className="animate-pulse">Loading support requests...</div>
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-semibold">✨ No requests</p>
          <p className="text-sm mt-1">Great work keeping users happy!</p>
        </div>
      )}

      {!loading && requests.length > 0 && (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                  From
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-foreground whitespace-nowrap">
                    {req.telegram_username || `User ${req.telegram_user_id}`}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground max-w-sm truncate">
                    {req.message}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        req.status === 'new'
                          ? 'bg-yellow-100 text-yellow-800'
                          : req.status === 'read'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {req.status === 'new' ? '🆕' : req.status === 'read' ? '👁️' : '✅'}{' '}
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(req.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    {req.status !== 'read' && (
                      <button
                        onClick={() => handleStatusChange(req.id, 'read')}
                        disabled={updatingId === req.id}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium hover:bg-blue-200 disabled:opacity-50"
                      >
                        Mark Read
                      </button>
                    )}
                    {req.status !== 'resolved' && (
                      <button
                        onClick={() => handleStatusChange(req.id, 'resolved')}
                        disabled={updatingId === req.id}
                        className="px-3 py-1 bg-green-100 text-green-800 rounded text-xs font-medium hover:bg-green-200 disabled:opacity-50"
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
