/**
 * Журнал обслуживания машины.
 *
 * Раздел намеренно нефинансовый: сколько стоило ТО, человек уже записал в
 * операции, и вторая сумма здесь неизбежно разошлась бы с первой. Смысл
 * журнала другой — помнить, что и когда с машиной делали, и вовремя
 * напомнить о следующем разе.
 */

import type { DateKey, ServiceKind, ServiceRecord, Vehicle } from '../data/types'
import { fromDateKey, todayKey } from './date'

export const SERVICE_KINDS: Array<{
  value: ServiceKind
  title: string
  icon: string
  color: string
}> = [
  { value: 'service', title: 'Обслуживание', icon: 'wrench', color: '#0891b2' },
  { value: 'inspection', title: 'ТО', icon: 'clipboard', color: '#7c3aed' },
  { value: 'tires', title: 'Шины', icon: 'tire', color: '#475569' },
  { value: 'battery', title: 'Аккумулятор', icon: 'battery', color: '#16a34a' },
  { value: 'repair', title: 'Ремонт', icon: 'cog', color: '#f97316' },
  { value: 'part', title: 'Замена детали', icon: 'bolt', color: '#0ea5e9' },
]

const KIND_BY_VALUE = new Map(SERVICE_KINDS.map((kind) => [kind.value, kind]))

/** Описание вида работ. Незнакомый вид — из чужой копии — показываем как ремонт. */
export function serviceKind(value: ServiceKind): (typeof SERVICE_KINDS)[number] {
  return KIND_BY_VALUE.get(value) ?? SERVICE_KINDS[0]
}

/* ── Пробег ────────────────────────────────────────────────────────────── */

/** 87420 → «87 420 км». */
export function formatKm(km: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(km))} км`
}

/** Разбор ввода пробега: «87 420» → 87420. null, если это не километры. */
export function parseKm(input: string): number | null {
  const cleaned = input.replace(/\s| /g, '')
  if (!cleaned || !/^\d+$/.test(cleaned)) return null

  const value = Number(cleaned)
  // Миллион километров — предел здравого смысла; всё сверх него опечатка.
  if (!Number.isFinite(value) || value <= 0 || value > 9_999_999) return null

  return value
}

/** Ввод пробега с разделителями разрядов по мере набора: «87420» → «87 420». */
export function formatKmInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 7)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Сегодняшний пробег машины.
 *
 * Записанный человеком, но не меньше самой «свежей» записи журнала: пробег
 * только растёт, и если в сервисе отметили 87 000, то показывать 84 300,
 * забытые в карточке полгода назад, значит врать в обе стороны сразу —
 * и в карточке, и в напоминании о следующей замене.
 */
export function currentMileage(vehicle: Vehicle): number | undefined {
  const fromRecords = vehicle.records.reduce<number | undefined>(
    (max, record) =>
      record.mileage !== undefined && (max === undefined || record.mileage > max)
        ? record.mileage
        : max,
    undefined,
  )

  if (vehicle.mileage === undefined) return fromRecords
  if (fromRecords === undefined) return vehicle.mileage

  return Math.max(vehicle.mileage, fromRecords)
}

/* ── Журнал ────────────────────────────────────────────────────────────── */

/** Записи «свежее сверху»: по дате, внутри дня — по времени добавления. */
export function sortedRecords(vehicle: Vehicle): ServiceRecord[] {
  return [...vehicle.records].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return a.createdAt < b.createdAt ? 1 : -1
  })
}

/* ── Напоминания ───────────────────────────────────────────────────────── */

/** Осталось меньше этого — пора записываться в сервис, а не откладывать. */
const SOON_KM = 1000
const SOON_DAYS = 30

export interface ServiceDue {
  record: ServiceRecord
  /** Срок наступил: пробег добран или дата прошла. */
  overdue: boolean
  /** Срок близко — предупредить стоит уже сейчас. */
  soon: boolean
  /** Сколько километров и дней осталось; отрицательное — насколько просрочено. */
  kmLeft?: number
  daysLeft?: number
}

/**
 * Что из журнала ждёт повторения: записи, у которых указан следующий срок.
 *
 * Сортируются по близости срока, а просроченное — впереди всего: человек
 * открывает раздел ровно затем, чтобы узнать, не пропустил ли он замену.
 * Учитываются и пробег, и календарь: масло меняют по тому из них, что
 * наступит раньше.
 */
export function upcomingServices(vehicle: Vehicle, today: DateKey = todayKey()): ServiceDue[] {
  const mileage = currentMileage(vehicle)

  const rows = vehicle.records
    .filter((record) => record.nextDate || record.nextMileage)
    .map((record) => {
      const kmLeft =
        record.nextMileage !== undefined && mileage !== undefined
          ? record.nextMileage - mileage
          : undefined

      const daysLeft = record.nextDate ? daysBetween(today, record.nextDate) : undefined

      return {
        record,
        kmLeft,
        daysLeft,
        overdue: (kmLeft !== undefined && kmLeft <= 0) || (daysLeft !== undefined && daysLeft <= 0),
        soon:
          (kmLeft !== undefined && kmLeft > 0 && kmLeft <= SOON_KM) ||
          (daysLeft !== undefined && daysLeft > 0 && daysLeft <= SOON_DAYS),
      }
    })

  return rows.sort((a, b) => urgency(a) - urgency(b))
}

/**
 * Насколько срочно, одним числом: доля «дороги» до срока, где 0 — уже пора.
 *
 * Километры и дни несравнимы напрямую — 900 км и 20 дней одинаково близки, —
 * поэтому каждый срок переводится в долю от порога «скоро», и берётся
 * меньшая. Записи без срока сюда не доходят, они отфильтрованы.
 */
function urgency(row: ServiceDue): number {
  const values: number[] = []

  if (row.kmLeft !== undefined) values.push(row.kmLeft / SOON_KM)
  if (row.daysLeft !== undefined) values.push(row.daysLeft / SOON_DAYS)

  return values.length > 0 ? Math.min(...values) : Number.POSITIVE_INFINITY
}

/** Сколько дней от одной даты до другой. Отрицательное — дата уже прошла. */
function daysBetween(from: DateKey, to: DateKey): number {
  const ms = fromDateKey(to).getTime() - fromDateKey(from).getTime()
  return Math.round(ms / 86_400_000)
}

/**
 * Ближайшее напоминание по всем машинам сразу — для карточки на главной.
 * Просроченное важнее близкого, поэтому берём первое из уже отсортированного.
 */
export function nearestService(
  vehicles: Vehicle[],
  today: DateKey = todayKey(),
): { vehicle: Vehicle; due: ServiceDue } | null {
  const rows = vehicles.flatMap((vehicle) =>
    upcomingServices(vehicle, today).map((due) => ({ vehicle, due })),
  )

  if (rows.length === 0) return null

  return rows.sort((a, b) => urgency(a.due) - urgency(b.due))[0]
}

/** «BMW 320i · 2021» — подпись машины в списке. */
export function vehicleSubtitle(vehicle: Vehicle): string {
  const parts: string[] = []

  if (vehicle.year) parts.push(`${vehicle.year} год`)

  const mileage = currentMileage(vehicle)
  if (mileage !== undefined) parts.push(formatKm(mileage))

  if (parts.length === 0 && vehicle.plate) parts.push(vehicle.plate)

  return parts.join(' · ')
}
