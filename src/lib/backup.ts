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

export function exportBackup(data: FinanceData) {
  const payload: BackupFile = {
    app: 'finance',
    exportedAt: new Date().toISOString(),
    ...data,
  }

  download(
    JSON.stringify(payload, null, 2),
    `finance-${toDateKey(new Date())}.json`,
    'application/json',
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
