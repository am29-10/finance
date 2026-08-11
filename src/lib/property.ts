/**
 * Недвижимость — справочник объектов, а не финансовый раздел.
 *
 * Полученная аренда и коммунальные платежи живут в операциях: приложение
 * считает деньги в одном месте, иначе один и тот же платёж рано или поздно
 * оказался бы учтён дважды. Здесь — то, что в операциях не хранится:
 * площадь, этаж, арендатор, срок договора.
 */

import type { DateKey, Property, PropertyKind, PropertyPurpose } from '../data/types'
import { fromDateKey, todayKey, toDateKey } from './date'
import { plural } from './text'

export const PROPERTY_KINDS: Array<{ value: PropertyKind; title: string }> = [
  { value: 'flat', title: 'Квартира' },
  { value: 'house', title: 'Дом' },
  { value: 'room', title: 'Комната' },
  { value: 'other', title: 'Другое' },
]

export const PROPERTY_KIND_TITLES: Record<PropertyKind, string> = {
  flat: 'Квартира',
  house: 'Дом',
  room: 'Комната',
  other: 'Объект',
}

export const PROPERTY_PURPOSES: Array<{
  value: PropertyPurpose
  title: string
  short: string
  color: string
}> = [
  { value: 'living', title: 'Живу сам', short: 'Для проживания', color: '#0d9488' },
  { value: 'rent', title: 'Сдаю', short: 'Сдаётся', color: '#9d174d' },
  { value: 'invest', title: 'Инвестиция', short: 'Инвестиционная', color: '#7c3aed' },
  { value: 'other', title: 'Другое', short: 'Другое назначение', color: '#64748b' },
]

const PURPOSE_BY_VALUE = new Map(PROPERTY_PURPOSES.map((purpose) => [purpose.value, purpose]))

export function propertyPurpose(value: PropertyPurpose): (typeof PROPERTY_PURPOSES)[number] {
  return PURPOSE_BY_VALUE.get(value) ?? PROPERTY_PURPOSES[3]
}

/** Этаж и год ремонта у комнаты в общежитии те же, что у квартиры, — поле общее. */
export function hasFloor(kind: PropertyKind): boolean {
  return kind === 'flat' || kind === 'room'
}

/* ── Площадь ───────────────────────────────────────────────────────────── */

/** 625 → «62,5 м²», 620 → «62 м²». Ровные метры показываем без нуля после запятой. */
export function formatArea(tenths: number): string {
  const whole = Math.trunc(tenths / 10)
  const rest = Math.abs(tenths % 10)

  return rest === 0 ? `${whole} м²` : `${whole},${rest} м²`
}

/** «62,5» → 625. Принимает и точку: на телефоне запятая не всегда под рукой. */
export function parseArea(input: string): number | null {
  const cleaned = input.replace(/\s| /g, '').replace(',', '.')
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null

  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0 || value > 100_000) return null

  return Math.round(value * 10)
}

/** Площадь из хранилища в поле ввода: 625 → «62,5». */
export function toAreaInput(tenths: number): string {
  return formatArea(tenths).replace(' м²', '')
}

/* ── Подписи ───────────────────────────────────────────────────────────── */

/** «62 м² · 3 комнаты» — вторая строка карточки объекта. */
export function propertySubtitle(property: Property): string {
  const parts: string[] = []

  if (property.area) parts.push(formatArea(property.area))

  const rooms = formatRooms(property.rooms)
  if (rooms) parts.push(rooms)

  if (property.address) parts.push(property.address)

  return parts.join(' · ')
}

/** «3 комнаты» либо «Студия». Пусто, если комнаты не указаны. */
export function formatRooms(rooms: number | undefined): string {
  if (rooms === undefined) return ''
  if (rooms === 0) return 'Студия'

  return `${rooms} ${plural(rooms, 'комната', 'комнаты', 'комнат')}`
}

/** «62 м² + 45 м²» для двух-трёх объектов и «107 м²» для большего числа. */
export function areasLine(properties: Property[]): string {
  const areas = properties.map((property) => property.area).filter((area): area is number => Boolean(area))

  if (areas.length === 0) return ''
  if (areas.length <= 3) return areas.map(formatArea).join(' + ')

  return formatArea(areas.reduce((sum, area) => sum + area, 0))
}

/* ── Аренда ────────────────────────────────────────────────────────────── */

/**
 * Ближайшая дата оплаты аренды.
 *
 * Сегодняшний день считается ближайшим, а не пропущенным: деньги приходят в
 * течение дня, и убирать напоминание с утра значило бы прятать его ровно
 * тогда, когда оно нужно. 31-го числа в феврале не бывает — срок съезжает
 * на последний день месяца.
 */
export function nextRentDate(property: Property, today: DateKey = todayKey()): DateKey | null {
  if (property.purpose !== 'rent' || !property.rentDay) return null

  const now = fromDateKey(today)

  for (const step of [0, 1]) {
    const target = new Date(now.getFullYear(), now.getMonth() + step, 1)
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
    target.setDate(Math.min(Math.max(property.rentDay, 1), lastDay))

    const date = toDateKey(target)
    if (date >= today) return date
  }

  return null
}

/** Договор кончился — самое время о нём вспомнить, а не узнать постфактум. */
export function isContractOver(property: Property, today: DateKey = todayKey()): boolean {
  return Boolean(property.contractUntil) && property.contractUntil! < today
}

/**
 * Ближайшая оплата аренды по всем объектам — для карточки на главной.
 * Объекты, которые не сдаются, в расчёт не идут: платить по ним некому.
 */
export function nearestRent(
  properties: Property[],
  today: DateKey = todayKey(),
): { property: Property; date: DateKey } | null {
  const rows = properties
    .map((property) => ({ property, date: nextRentDate(property, today) }))
    .filter((row): row is { property: Property; date: DateKey } => row.date !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  return rows[0] ?? null
}
