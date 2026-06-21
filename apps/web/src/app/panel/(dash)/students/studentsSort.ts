import type { PanelStudentRow } from '@/app/api/panel/students/route'

/** Сортировка списка учеников по заголовкам столбцов. */

export type SortKey = 'name' | 'city' | 'curator' | 'passed' | 'block' | 'days' | 'created'
export type SortDir = 'asc' | 'desc'

// Колонки таблицы. key=null — несортируемая (Действия).
export const COLUMNS: { key: SortKey | null; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Ученик' },
  { key: 'city', label: 'Город' },
  { key: 'curator', label: 'Куратор' },
  { key: 'passed', label: 'Сдано' },
  { key: 'block', label: 'Текущий блок' },
  { key: 'days', label: 'Дней закрыто' },
  { key: 'created', label: 'Создан' },
  { key: null, label: 'Действия', align: 'right' },
]

// Числовые/дата — по убыванию по умолчанию, текстовые — по возрастанию.
const NUMERIC: SortKey[] = ['passed', 'block', 'days', 'created']
export const defaultDir = (key: SortKey): SortDir => (NUMERIC.includes(key) ? 'desc' : 'asc')

export function compareStudents(a: PanelStudentRow, b: PanelStudentRow, key: SortKey): number {
  switch (key) {
    case 'name':
      return (a.fullName ?? '').localeCompare(b.fullName ?? '', 'ru')
    case 'city':
      return (a.cityName ?? '').localeCompare(b.cityName ?? '', 'ru')
    case 'curator':
      return (a.curatorName ?? '').localeCompare(b.curatorName ?? '', 'ru')
    case 'passed':
      return a.passedBlocks - b.passedBlocks
    case 'block':
      return a.currentBlock - b.currentBlock
    case 'days':
      return a.closedDays - b.closedDays
    case 'created':
      return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    default:
      return 0
  }
}
