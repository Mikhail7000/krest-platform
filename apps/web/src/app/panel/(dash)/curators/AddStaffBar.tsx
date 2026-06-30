'use client'

import { StaffAddForm } from './StaffAddForm'

/**
 * Добавление куратора по нику на странице «Кураторы».
 * Лидеры городов добавляются на отдельной странице «Лидеры городов».
 *  - admin/super_admin (canManage): можно указать город (необязательно).
 *  - city_leader (canManage=false): без города — роут относит куратора в его город.
 */
export function AddStaffBar({
  canManage,
  cities,
}: {
  canManage: boolean
  cities: { id: number; name: string }[]
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <StaffAddForm kind="curator" cities={cities} showCity={canManage} cityRequired={false} />
    </div>
  )
}
