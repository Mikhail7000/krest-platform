import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPanelSession } from '@/lib/admin/guard'
import { ReassignBoard } from './ReassignBoard'

export const dynamic = 'force-dynamic'

/**
 * /panel/curators/reassign — перепривязка кураторов между городами/лидерами.
 * Колонки = города, карточки = кураторы; перенос через выпадашку «Переместить».
 * Доступ: только admin/super_admin (лидер города — 404, у него свой обзор кураторов).
 */
export default async function ReassignPage() {
  const session = await getPanelSession()
  const role = session?.role
  if (role !== 'admin' && role !== 'super_admin') notFound()

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <Link href="/panel/curators" className="panel-muted" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>
          ← К кураторам
        </Link>
      </div>
      <h1 className="panel-page__title">Перепривязка кураторов</h1>
      <p className="panel-page__subtitle">
        Кураторы по городам. Перемести куратора в другой город — он перейдёт под его лидера
        (ученики куратора останутся за ним).
      </p>
      <ReassignBoard />
    </div>
  )
}
