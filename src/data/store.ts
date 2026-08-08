import { useSyncExternalStore } from 'react'
import { LOAN_CATEGORY_ID } from './categories'
import { emptyData, localStorageAdapter, type StorageAdapter } from './storage'
import type {
  Category,
  DateKey,
  FinanceData,
  Loan,
  Operation,
  OperationType,
  Prepayment,
  Settings,
} from './types'
import { duePayments } from '../lib/loan'
import { todayKey } from '../lib/date'

let adapter: StorageAdapter = localStorageAdapter
let state: FinanceData = reconcileLoans(adapter.load() ?? initial())

const listeners = new Set<() => void>()

function initial(): FinanceData {
  const fresh = emptyData()
  adapter.save(fresh)
  return fresh
}

// Синхронизация на старте могла дозавести платежи за прошедшие месяцы — сохраняем сразу,
// иначе они пересоздавались бы при каждом запуске с новыми идентификаторами.
adapter.save(state)

function setState(next: FinanceData) {
  state = next
  adapter.save(state)
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getState(): FinanceData {
  return state
}

export function useFinance(): FinanceData {
  return useSyncExternalStore(subscribe, getState, getState)
}

function newId(): string {
  // crypto.randomUUID() существует только на HTTPS и localhost — по локальной сети его нет.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `o-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/* ── Кредиты и расходы ─────────────────────────────────────────────────── */

/**
 * Приводит операции-платежи в соответствие с графиками кредитов.
 *
 * Список платежей по кредиту — производная от самого кредита, а не независимые
 * записи: поправил ставку или внёс досрочку — половина графика пересчиталась.
 * Поэтому операции с `loanId` не редактируются вручную, а каждый раз сверяются
 * с расчётом: недостающие создаются, изменившиеся правятся, отвалившиеся
 * (кредит удалён, срок сократился, автосписание выключено) удаляются.
 *
 * Функция идемпотентна: повторный вызов на тех же данных ничего не меняет.
 */
function reconcileLoans(data: FinanceData, today: DateKey = todayKey()): FinanceData {
  const desired = new Map<string, Pick<Operation, 'amount' | 'date' | 'note' | 'loanId' | 'loanRef'>>()

  for (const loan of data.loans ?? []) {
    if (loan.closedAt || !loan.autoExpense) continue

    for (const row of duePayments(loan, today)) {
      desired.set(`${loan.id}|${row.date}`, {
        amount: row.payment,
        date: row.date,
        note: `${loan.title} — платёж ${row.index}`,
        loanId: loan.id,
        loanRef: row.date,
      })
    }

    for (const prepayment of loan.prepayments) {
      if (prepayment.date > today) continue

      desired.set(`${loan.id}|p:${prepayment.id}`, {
        amount: prepayment.amount,
        date: prepayment.date,
        // Свой комментарий человека важнее нашей формулировки — он его и искал в истории.
        note: prepayment.note ?? `${loan.title} — досрочное погашение`,
        loanId: loan.id,
        loanRef: `p:${prepayment.id}`,
      })
    }
  }

  const next: Operation[] = []
  const seen = new Set<string>()
  let changed = false

  for (const operation of data.operations) {
    if (!operation.loanId) {
      next.push(operation)
      continue
    }

    const key = `${operation.loanId}|${operation.loanRef}`
    const want = desired.get(key)

    if (!want || seen.has(key)) {
      changed = true
      continue
    }

    seen.add(key)

    if (
      operation.amount === want.amount &&
      operation.date === want.date &&
      operation.note === want.note &&
      operation.categoryId === LOAN_CATEGORY_ID
    ) {
      next.push(operation)
      continue
    }

    next.push({ ...operation, ...want, categoryId: LOAN_CATEGORY_ID })
    changed = true
  }

  for (const [key, want] of desired) {
    if (seen.has(key)) continue

    next.push({
      ...want,
      id: newId(),
      type: 'expense',
      categoryId: LOAN_CATEGORY_ID,
      createdAt: new Date().toISOString(),
    })
    changed = true
  }

  return changed ? { ...data, operations: next } : data
}

/** Меняет кредиты и сразу приводит операции в соответствие с новым графиком. */
function setLoans(loans: Loan[]) {
  setState(reconcileLoans({ ...state, loans }))
}

export const actions = {
  addOperation(input: Omit<Operation, 'id' | 'createdAt'>): Operation {
    const operation: Operation = { ...input, id: newId(), createdAt: new Date().toISOString() }
    setState({ ...state, operations: [...state.operations, operation] })
    return operation
  },

  updateOperation(id: string, patch: Partial<Omit<Operation, 'id' | 'createdAt'>>) {
    setState({
      ...state,
      operations: state.operations.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    })
  },

  /** Операции удаляются насовсем: в отличие от категорий, на них ничто не ссылается. */
  deleteOperation(id: string) {
    setState({ ...state, operations: state.operations.filter((o) => o.id !== id) })
  },

  updateSettings(patch: Partial<Settings>) {
    setState({ ...state, settings: { ...state.settings, ...patch } })
  },

  replaceAll(data: FinanceData) {
    setState(reconcileLoans(data))
  },

  /* ── Кредиты ─────────────────────────────────────────────────────────── */

  addLoan(input: Omit<Loan, 'id' | 'createdAt' | 'prepayments'>): Loan {
    const loan: Loan = {
      ...input,
      id: newId(),
      prepayments: [],
      createdAt: new Date().toISOString(),
    }

    setLoans([...state.loans, loan])
    return loan
  },

  updateLoan(id: string, patch: Partial<Omit<Loan, 'id' | 'createdAt'>>) {
    setLoans(state.loans.map((loan) => (loan.id === id ? { ...loan, ...patch } : loan)))
  },

  /** Вместе с кредитом уходят и все его платежи из расходов — их сверка удалит сама. */
  deleteLoan(id: string) {
    setLoans(state.loans.filter((loan) => loan.id !== id))
  },

  /**
   * Закрыть кредит вручную. График замирает, новые расходы не создаются,
   * но уже проведённые платежи остаются в истории.
   */
  closeLoan(id: string) {
    setState({
      ...state,
      loans: state.loans.map((loan) =>
        loan.id === id ? { ...loan, closedAt: new Date().toISOString() } : loan,
      ),
    })
  },

  reopenLoan(id: string) {
    setLoans(
      state.loans.map((loan) => {
        if (loan.id !== id) return loan
        const { closedAt: _closed, ...rest } = loan
        return rest
      }),
    )
  },

  addPrepayment(loanId: string, input: Omit<Prepayment, 'id' | 'createdAt'>): void {
    const prepayment: Prepayment = {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString(),
    }

    setLoans(
      state.loans.map((loan) =>
        loan.id === loanId ? { ...loan, prepayments: [...loan.prepayments, prepayment] } : loan,
      ),
    )
  },

  deletePrepayment(loanId: string, prepaymentId: string) {
    setLoans(
      state.loans.map((loan) =>
        loan.id === loanId
          ? { ...loan, prepayments: loan.prepayments.filter((p) => p.id !== prepaymentId) }
          : loan,
      ),
    )
  },

  /**
   * Досоздать платежи, у которых наступил срок. Вызывается при запуске и при
   * возврате в приложение: без этого расход за новый месяц появится только
   * после того, как человек сам что-нибудь нажмёт.
   */
  syncLoans() {
    const next = reconcileLoans(state)
    if (next !== state) setState(next)
  },
}

/* ── Выборки ───────────────────────────────────────────────────────────── */

export function categoriesOf(data: FinanceData, type: OperationType): Category[] {
  return data.categories.filter((c) => c.type === type && !c.archivedAt)
}

export function categoryById(data: FinanceData, id: string): Category | undefined {
  return data.categories.find((c) => c.id === id)
}

export function loanById(data: FinanceData, id: string): Loan | undefined {
  return data.loans.find((loan) => loan.id === id)
}

/** Незакрытые кредиты: сначала те, где долг больше. */
export function activeLoans(data: FinanceData): Loan[] {
  return data.loans.filter((loan) => !loan.closedAt)
}

export function closedLoans(data: FinanceData): Loan[] {
  return data.loans.filter((loan) => loan.closedAt)
}

/** Операции по убыванию даты, внутри дня — последние добавленные сверху. */
export function sortedOperations(data: FinanceData): Operation[] {
  return [...data.operations].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return a.createdAt < b.createdAt ? 1 : -1
  })
}

export function operationsBetween(data: FinanceData, from: DateKey, to: DateKey): Operation[] {
  return data.operations.filter((o) => o.date >= from && o.date <= to)
}

export interface Totals {
  income: number
  expense: number
  balance: number
}

export function totalsOf(operations: Operation[]): Totals {
  let income = 0
  let expense = 0

  for (const operation of operations) {
    if (operation.type === 'income') income += operation.amount
    else expense += operation.amount
  }

  return { income, expense, balance: income - expense }
}

/** Общий баланс за всё время — то, что показано крупно на главной. */
export function totalBalance(data: FinanceData): number {
  return totalsOf(data.operations).balance
}

export interface CategoryTotal {
  category: Category
  amount: number
  share: number
}

/** Суммы по категориям, по убыванию. Используется в кольце и в структуре расходов. */
export function totalsByCategory(
  data: FinanceData,
  operations: Operation[],
  type: OperationType,
): CategoryTotal[] {
  const sums = new Map<string, number>()

  for (const operation of operations) {
    if (operation.type !== type) continue
    sums.set(operation.categoryId, (sums.get(operation.categoryId) ?? 0) + operation.amount)
  }

  const total = [...sums.values()].reduce((acc, value) => acc + value, 0)

  return [...sums.entries()]
    .map(([categoryId, amount]) => ({
      category: categoryById(data, categoryId),
      amount,
      share: total === 0 ? 0 : amount / total,
    }))
    .filter((row): row is CategoryTotal => Boolean(row.category))
    .sort((a, b) => b.amount - a.amount)
}

/**
 * Сворачивает хвост в «Другое».
 *
 * Больше пяти сегментов в кольце показывать нельзя: различимых цветов столько
 * не бывает, особенно при дальтонизме. Проверено валидатором палитры.
 */
export function collapseToTop(rows: CategoryTotal[], limit = 5): CategoryTotal[] {
  if (rows.length <= limit) return rows

  const head = rows.slice(0, limit - 1)
  const tail = rows.slice(limit - 1)

  return [
    ...head,
    {
      category: {
        id: '__rest',
        title: 'Другое',
        type: tail[0].category.type,
        icon: 'dots',
        color: '#94a3b8',
      },
      amount: tail.reduce((acc, row) => acc + row.amount, 0),
      share: tail.reduce((acc, row) => acc + row.share, 0),
    },
  ]
}
