import Link from 'next/link'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Super Admin Panel — КРЕСТ',
}

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireSuperAdmin()

  if ('errorResponse' in auth) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">🔧 Super Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">Управление платформой КРЕСТ</p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6">
            <Link
              href="/admin/super"
              className="px-4 py-4 text-sm font-medium text-foreground border-b-2 border-primary transition hover:bg-slate-50"
            >
              📋 Support Requests
            </Link>
            <Link
              href="/admin/super/whitelist"
              className="px-4 py-4 text-sm font-medium text-muted-foreground border-b-2 border-transparent transition hover:bg-slate-50 hover:border-slate-200"
            >
              ✅ Whitelist
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
