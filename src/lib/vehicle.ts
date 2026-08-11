/**
 * Журнал обслуживания машины.
 *
 * Раздел намеренно нефинансовый: сколько стоило ТО, человек уже записал в
 * операции, и вторая сумма здесь неизбежно разошлась бы с первой. Смысл
 * журнала другой — помнить, что и когда с машиной делали, и вовремя
 * напомнить о следующем разе.
 */

import type { DateKey, ServiceKind, ServiceRecord, Vehicle } from '../data/types'
import { fromDateKey, toDateKey, todayKey } from './date'

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
 * Последний известный пробег — наибольший из отмеченных в журнале.
 *
 * Наибольший, а не из свежей по дате записи: запись могли завести задним
 * числом, и тогда «сегодняшним» стал бы пробег полугодовой давности, а
 * напоминание о замене масла отодвинулось бы на те же полгода.
 *
 * Отдельного поля у машины нет намеренно — см. комментарий к Vehicle.
 */
export function currentMileage(vehicle: Vehicle): number | undefined {
  return vehicle.records.reduce<number | undefined>(
    (max, record) =>
      record.mileage !== undefined && (max === undefined || record.mileage > max)
        ? record.mileage
        : max,
    undefined,
  )
}

/* ── Журнал ────────────────────────────────────────────────────────────── */

/** Записи «свежее сверху»: по дате, внутри дня — по времени добавления. */
export function sortedRecords(vehicle: Vehicle): ServiceRecord[] {
  return [...vehicle.records].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return a.createdAt < b.createdAt ? 1 : -1
  })
}

/* ── Сколько стоило ────────────────────────────────────────────────────── */

export interface ServiceSpending {
  /** Сумма всех записей с ценой, в копейках. */
  total: number
  /** Из них за последние двенадцать месяцев. */
  lastYear: number
  /** Сколько записей с ценой. Без этого числа сумма ни о чём не говорит. */
  count: number
}

/**
 * Во сколько обошлось содержание машины по журналу.
 *
 * Считается по ценам, записанным в самих работах, и ни с каким остатком не
 * связано: это ответ на вопрос «сколько я в неё вложил», а не строка расхода.
 * Записи без цены просто не участвуют — заставлять вспоминать сумму
 * трёхлетней давности ради ровного итога незачем.
 *
 * Год отсчитывается от сегодня назад, а не с января: «за год» — это
 * последние двенадцать месяцев, а не две недели, если сейчас середина января.
 */
export function serviceSpending(vehicle: Vehicle, today: DateKey = todayKey()): ServiceSpending {
  const now = fromDateKey(today)
  const cutoff = toDateKey(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()))

  let total = 0
  let lastYear = 0
  let count = 0

  for (const record of vehicle.records) {
    if (!record.cost) continue

    total += record.cost
    count += 1
    if (record.date > cutoff) lastYear += record.cost
  }

  return { total, lastYear, count }
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

/** «2021 год · А123ВС777» — подпись машины в списке. */
export function vehicleSubtitle(vehicle: Vehicle): string {
  return [vehicle.year && `${vehicle.year} год`, vehicle.plate].filter(Boolean).join(' · ')
}
