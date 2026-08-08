import { defaultCategories } from '../data/categories'
import {
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  type Category,
  type FinanceData,
  type Loan,
  type Operation,
} from '../data/types'
import { download } from './csv'
import { toDateKey } from './date'

interface BackupFile extends FinanceData {
  app: 'finance'
  exportedAt: string
}

function serialize(data: FinanceData): { text: string; name: string } {
  const payload: BackupFile = {
    app: 'finance',
    exportedAt: new Date().toISOString(),
    ...data,
  }

  return {
    text: JSON.stringify(payload, null, 2),
    name: `finance-${toDateKey(new Date())}.json`,
  }
}

export function exportBackup(data: FinanceData) {
  const { text, name } = serialize(data)
  download(text, name, 'application/json')
}

/** Умеет ли устройство отдать файл в другое приложение. */
export function canShareBackup(): boolean {
  if (typeof navigator.canShare !== 'function') return false

  const probe = new File(['{}'], 'probe.json', { type: 'application/json' })
  return navigator.canShare({ files: [probe] })
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * Отдать копию в другое приложение: Telegram, «Файлы», облачный диск.
 *
 * Скачивание кладёт файл рядом с оригиналом — на тот же телефон, который можно
 * потерять или уронить. Отправка выносит копию за пределы устройства, и на
 * iPhone это вообще единственный доступный способ: файловой системы там нет.
 */
export async function shareBackup(data: FinanceData): Promise<ShareResult> {
  const { text, name } = serialize(data)

  if (!canShareBackup()) {
    download(text, name, 'application/json')
    return 'downloaded'
  }

  const file = new File([text], name, { type: 'application/json' })

  try {
    await navigator.share({ files: [file], title: 'Кошелёк — резервная копия' })
    return 'shared'
  } catch (error) {
    // Человек закрыл меню «Поделиться» — копии не было, и делать вид, что была, нельзя.
    if ((error as Error).name === 'AbortError') return 'cancelled'

    // Отправка не удалась по другой причине — скачиваем, чтобы не остаться ни с чем.
    download(text, name, 'application/json')
    return 'downloaded'
  }
}

/** «2026-08» — месяц, в котором произошло событие. */
function monthKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const SNOOZE_DAYS = 3

/**
 * Пора ли напомнить о копии.
 *
 * Напоминаем в начале каждого месяца — то есть при первом запуске в месяце,
 * в котором копии ещё не делали. Точкой отсчёта для тех, кто не сохранялся
 * ни разу, служит первая операция: у человека, начавшего вести учёт неделю
 * назад, терять пока нечего, и встречать его требованием сохраниться незачем.
 */
export function isBackupDue(
  settings: { lastBackupAt?: string; backupRemindedAt?: string },
  operations: Operation[],
  now: Date = new Date(),
): boolean {
  if (operations.length === 0) return false

  if (settings.backupRemindedAt) {
    const days = (now.getTime() - new Date(settings.backupRemindedAt).getTime()) / 86_400_000
    if (days < SNOOZE_DAYS) return false
  }

  const anchor = settings.lastBackupAt ?? earliestActivity(operations)
  return monthKey(anchor) < monthKey(now)
}

function earliestActivity(operations: Operation[]): string {
  return operations.reduce(
    (oldest, operation) => (operation.createdAt < oldest ? operation.createdAt : oldest),
    operations[0].createdAt,
  )
}

export async function readBackup(file: File): Promise<FinanceData> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('Файл повреждён или это не JSON')
  }

  return normalize(parsed)
}

/** Разбираем терпимо: битые записи пропускаем, но чужой формат не принимаем. */
function normalize(input: unknown): FinanceData {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Файл не похож на резервную копию')
  }

  const raw = input as Partial<BackupFile>
  if (!Array.isArray(raw.operations)) {
    throw new Error('Файл не похож на резервную копию')
  }

  const categories = Array.isArray(raw.categories) && raw.categories.length
    ? (raw.categories.filter(isCategory) as Category[])
    : defaultCategories()

  return {
    version: SCHEMA_VERSION,
    operations: raw.operations.filter(isOperation),
    categories,
    // Копии, снятые до появления кредитов, поля loans не имеют — это нормально.
    loans: Array.isArray(raw.loans) ? raw.loans.filter(isLoan) : [],
    settings: { ...DEFAULT_SETTINGS, ...raw.settings },
  }
}

function isLoan(value: unknown): value is Loan {
  if (typeof value !== 'object' || value === null) return false
  const l = value as Partial<Loan>

  return (
    typeof l.id === 'string' &&
    typeof l.title === 'string' &&
    typeof l.principal === 'number' &&
    Number.isInteger(l.principal) &&
    l.principal > 0 &&
    typeof l.rate === 'number' &&
    l.rate >= 0 &&
    typeof l.termMonths === 'number' &&
    l.termMonths > 0 &&
    typeof l.startDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(l.startDate) &&
    Array.isArray(l.prepayments)
  )
}

function isOperation(value: unknown): value is Operation {
  if (typeof value !== 'object' || value === null) return false
  const o = value as Partial<Operation>

  return (
    typeof o.id === 'string' &&
    (o.type === 'income' || o.type === 'expense') &&
    // Сумма обязана быть целым числом копеек — дробная означает чужой или испорченный формат.
    typeof o.amount === 'number' &&
    Number.isInteger(o.amount) &&
    o.amount > 0 &&
    typeof o.categoryId === 'string' &&
    typeof o.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.date) &&
    typeof o.createdAt === 'string'
  )
}

function isCategory(value: unknown): value is Category {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Partial<Category>

  return (
    typeof c.id === 'string' &&
    typeof c.title === 'string' &&
    (c.type === 'income' || c.type === 'expense') &&
    typeof c.icon === 'string' &&
    typeof c.color === 'string'
  )
}
