import { defaultCategories, LOAN_CATEGORY_ID, loanCategory } from './categories'
import type { Category } from './types'
import { DEFAULT_SETTINGS, SCHEMA_VERSION, type FinanceData } from './types'

/**
 * Слой хранения за интерфейсом: сейчас localStorage, позже сюда встанет облако,
 * и экраны об этом не узнают.
 */
export interface StorageAdapter {
  load(): FinanceData | null
  save(data: FinanceData): void
}

const STORAGE_KEY = 'finance:v1'

export const localStorageAdapter: StorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return migrate(JSON.parse(raw) as FinanceData)
    } catch {
      // Битые данные лучше проигнорировать, чем уронить приложение на старте.
      return null
    }
  },

  save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Приватный режим или переполненное хранилище — работаем дальше в памяти.
    }
  },
}

export function migrate(data: FinanceData): FinanceData {
  const categories = data.categories?.length ? data.categories : defaultCategories()

  return {
    version: SCHEMA_VERSION,
    operations: data.operations ?? [],
    // v1 → v2: у старых баз нет категории кредитов, но операции по ним уже могут
    // создаваться сразу после обновления — дозаводим её, не трогая остальные.
    categories: withLoanCategory(categories),
    loans: data.loans ?? [],
    settings: { ...DEFAULT_SETTINGS, ...data.settings },
  }
}

function withLoanCategory(categories: Category[]): Category[] {
  if (categories.some((c) => c.id === LOAN_CATEGORY_ID)) return categories
  return [...categories, loanCategory()]
}

export function emptyData(): FinanceData {
  return {
    version: SCHEMA_VERSION,
    operations: [],
    categories: defaultCategories(),
    loans: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}
