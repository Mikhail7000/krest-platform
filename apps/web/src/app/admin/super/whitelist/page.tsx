'use client'

import { useState, useEffect } from 'react'

interface WhitelistEntry {
  telegram_username: string
  display_name: string
  added_at: string
}

export default function WhitelistPage() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchWhitelist()
  }, [])

  const fetchWhitelist = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/super-admin/whitelist?limit=100')
      if (!res.ok) throw new Error('Failed to load whitelist')
      const data = await res.json()
      setEntries(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddUsername = async () => {
    if (!newUsername.trim()) {
      setError('Username is required')
      return
    }

    if (!newUsername.startsWith('@')) {
      setError('Username must start with @')
      return
    }

    setAdding(true)
    setError(null)

    try {
      const res = await fetch('/api/super-admin/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_username: newUsername,
          display_name: newDisplayName || newUsername,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message ?? 'Failed to add username')
      }

      setNewUsername('')
      setNewDisplayName('')
      await fetchWhitelist()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (username: string) => {
    if (!confirm(`Remove @${username} from whitelist?`)) return

    setDeleting(username)
    try {
      const res = await fetch(`/api/super-admin/whitelist/${username}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to remove')

      await fetchWhitelist()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      {/* Add new */}
      <div className="mb-8 bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Add to Whitelist</h3>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Telegram Username
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="@username"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={adding}
            />
            <p className="text-xs text-muted-foreground mt-1">Must start with @</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Display Name (optional)
            </label>
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Full name or note"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={adding}
            />
          </div>

          <button
            onClick={handleAddUsername}
            disabled={adding || !newUsername.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {adding ? '⏳ Adding...' : '✅ Add to Whitelist'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground mb-4">
          Whitelisted Users ({entries.length})
        </h3>

        {loading && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="animate-pulse">Loading whitelist...</div>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-white border border-slate-200 rounded-lg">
            <p className="text-sm">No users in whitelist yet</p>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Display Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Added
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {entries.map((entry) => (
                  <tr key={entry.telegram_username} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-foreground whitespace-nowrap">
                      {entry.telegram_username}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {entry.display_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(entry.added_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleRemove(entry.telegram_username)}
                        disabled={deleting === entry.telegram_username}
                        className="px-3 py-1 bg-red-100 text-red-800 rounded text-xs font-medium hover:bg-red-200 disabled:opacity-50"
                      >
                        {deleting === entry.telegram_username ? '⏳' : '✕'} Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
