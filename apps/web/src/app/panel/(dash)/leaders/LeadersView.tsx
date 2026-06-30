'use client'

import { useState } from 'react'
import { StaffAddForm } from '../curators/StaffAddForm'
import { RoleModal } from '../curators/RoleModal'
import type { CuratorRow } from '../curators/types'
import { LeaderRow } from './LeaderRow'
import { CityModal } from './CityModal'
import type { LeaderRow as LeaderRowType } from './types'

/** LeaderRow → CuratorRow для переиспользования RoleModal (studentsCount=0: лидер
 *  не держит учеников напрямую, ложного предупреждения об отвязке быть не должно). */
function toCuratorRow(l: LeaderRowType): CuratorRow {
  return {
    id: l.id,
    name: l.name,
    nick: l.nick,
    role: 'city_leader',
    isProtected: l.isProtected,
    city: l.city,
    cityId: l.cityId,
    country: l.country,
    leaderName: null,
    studentsCount: 0,
    students: [],
  }
}

/**
 * Таблица лидеров городов: город, число кураторов (разворот), вход в их панель,
 * смена города, смена роли. Добавление нового лидера — StaffAddForm (city_leader).
 */
export function LeadersView({
  leaders,
  cities,
  isSuperAdmin,
  canViewAs = false,
  isOwner = false,
}: {
  leaders: LeaderRowType[]
  cities: { id: number; name: string }[]
  isSuperAdmin: boolean
  canViewAs?: boolean
  isOwner?: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [roleTarget, setRoleTarget] = useState<LeaderRowType | null>(null)
  const [cityTarget, setCityTarget] = useState<LeaderRowType | null>(null)
  void isOwner // view-as для лидеров доступен любому реальному админу

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <StaffAddForm kind="city_leader" cities={cities} showCity cityRequired />
      </div>

      {leaders.length === 0 ? (
        <div className="panel-empty">Лидеров городов пока нет</div>
      ) : (
        <div className="panel-table-wrap">
          <table className="panel-table">
            <thead>
              <tr>
                <th>Лидер</th>
                <th>Город</th>
                <th>Кураторов</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((l) => (
                <LeaderRow
                  key={l.id}
                  leader={l}
                  isOpen={openId === l.id}
                  canViewAs={canViewAs && !l.isProtected}
                  onToggle={() => setOpenId(openId === l.id ? null : l.id)}
                  onCity={() => setCityTarget(l)}
                  onRole={() => setRoleTarget(l)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cityTarget ? (
        <CityModal
          userId={cityTarget.id}
          name={cityTarget.name ?? cityTarget.nick ?? cityTarget.id}
          currentCityId={cityTarget.cityId}
          cities={cities}
          onClose={() => setCityTarget(null)}
        />
      ) : null}

      {roleTarget ? (
        <RoleModal
          curator={toCuratorRow(roleTarget)}
          isSuperAdmin={isSuperAdmin}
          cities={cities}
          onClose={() => setRoleTarget(null)}
        />
      ) : null}
    </>
  )
}
