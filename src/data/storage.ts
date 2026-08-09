import { defaultCategories } from './categories'
import { DEFAULT_ACCOUNT_ID, defaultAccount } from './accounts'
import type { Account, Category, FinanceData, Operation } from './types'
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from './types'

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
  const operations = data.operations ?? []

  /**
   * База старее счетов — её узнаём по отсутствию самого поля, а не по пустому
   * списку. С v5 операция без счёта законна: это общая трата, которую человек
   * намеренно не разнёс по картам. Пустой список счетов такую операцию не
   * выдаёт, а вот отсутствие поля выдаёт базу, писанную до v3.
   */
  const legacy = data.accounts === undefined

  /**
   * v2 → v3: появились счета. У операций из тех баз счёта нет не по выбору, а
   * потому что его негде было указать, — заводим первый счёт и переселяем на
   * него всю историю, иначе она выпала бы из любого остатка.
   */
  const accounts = data.accounts?.length
    ? data.accounts
    : legacy && operations.length > 0
      ? [defaultAccount()]
      : []

  const fallback = accounts[0]?.id

  // Переселение считаем до чистки счетов: она смотрит, кто чем пользуется, и по
  // старым операциям — тем, у которых счёта ещё нет, — решила бы, что счётом не
  // пользуется никто, и снесла бы его вместе со всей их привязкой.
  const settled =
    legacy && fallback
      ? operations.map((operation) =>
          operation.accountId ? operation : { ...operation, accountId: fallback },
        )
      : operations

  return {
    version: SCHEMA_VERSION,
    operations: settled,
    // Встроенные категории появляются со временем — кредиты, аренда квартиры,
    // — а копируются в базу только при первом запуске. Дозаводим недостающие,
    // иначе новая категория дошла бы лишь до тех, кто ставит приложение с нуля.
    categories: withFreshColors(withBuiltinCategories(categories)),
    accounts: withoutUnusedDefault(accounts, settled, data.loans ?? []),
    loans: data.loans ?? [],
    // v3 → v4: появились повторяющиеся операции; у старых баз правил нет.
    recurrences: data.recurrences ?? [],
    settings: { ...DEFAULT_SETTINGS, ...data.settings, rates: data.settings?.rates ?? {} },
  }
}

/**
 * Убирает счёт «Основной», если им так и не воспользовались.
 *
 * Он заводился автоматически всем подряд, и у тех, кто сразу создал свои счета,
 * в балансе висела пустая строка, которую они не добавляли и не могут объяснить.
 * Счёт с деньгами или собственной историей не трогаем: удаление осиротило бы её.
 *
 * Платежи по кредиту — исключение. Они не самостоятельные записи, а производная
 * от графика: сверка сама перенесёт их на другой счёт, если у кредита он не
 * указан явно. Но только при условии, что этот другой счёт есть, — иначе
 * переносить будет некуда и расходы по кредиту молча пропадут из истории.
 */
function withoutUnusedDefault(
  accounts: Account[],
  operations: Operation[],
  loans: Array<{ id: string; accountId?: string }>,
): Account[] {
  const hasOwnAccount = accounts.some(
    (account) => account.id !== DEFAULT_ACCOUNT_ID && !account.archivedAt,
  )

  const movable = (operation: Operation) =>
    hasOwnAccount &&
    Boolean(operation.loanId) &&
    loans.some((loan) => loan.id === operation.loanId && !loan.accountId)

  const used = (id: string) =>
    operations.some(
      (operation) =>
        (operation.accountId === id && !movable(operation)) || operation.toAccountId === id,
    ) || loans.some((loan) => loan.accountId === id)

  return accounts.filter(
    (account) =>
      account.id !== DEFAULT_ACCOUNT_ID ||
      account.initialBalance !== 0 ||
      used(account.id),
  )
}

/**
 * Дозаводит встроенные категории, которых в базе ещё нет.
 *
 * Порядок сохраняем из кода, а не дописываем в хвост: в форме категории идут
 * сеткой, и «Аренда квартиры», приехавшая обновлением, должна встать рядом с
 * зарплатой, а не после «Другого». Свои категории человека остаются на местах.
 */
function withBuiltinCategories(categories: Category[]): Category[] {
  const known = new Set(categories.map((c) => c.id))
  const missing = defaultCategories().filter((c) => !known.has(c.id))
  if (missing.length === 0) return categories

  const order = defaultCategories().map((c) => c.id)
  const rank = (id: string) => {
    const index = order.indexOf(id)
    return index === -1 ? order.length : index
  }

  // Своим категориям ранга нет — они идут в конце в прежнем порядке, поэтому
  // сортировка устойчивая: у равных рангов сравнение возвращает ноль.
  return [...categories, ...missing].sort((a, b) => rank(a.id) - rank(b.id))
}

/**
 * Подтягивает цвета встроенных категорий из кода.
 *
 * Категории копируются в базу при первом запуске, поэтому исправленная палитра
 * сама собой доходит только до новых пользователей — у остальных навсегда
 * остались бы старые цвета, ради которых её и меняли. Сверяемся по id: чужие
 * категории в списке останутся как есть.
 */
function withFreshColors(categories: Category[]): Category[] {
  const palette = new Map(defaultCategories().map((category) => [category.id, category.color]))

  return categories.map((category) => {
    const fresh = palette.get(category.id)
    return fresh && fresh !== category.color ? { ...category, color: fresh } : category
  })
}

export function emptyData(): FinanceData {
  return {
    version: SCHEMA_VERSION,
    operations: [],
    categories: defaultCategories(),
    // Счета заводит сам человек — до этого показывать в балансе нечего.
    accounts: [],
    loans: [],
    recurrences: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}
