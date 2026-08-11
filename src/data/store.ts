import { useSyncExternalStore } from 'react'
import { LOAN_CATEGORY_ID, REST_COLOR } from './categories'
import { emptyData, localStorageAdapter, type StorageAdapter } from './storage'
import type {
  Account,
  Category,
  DateKey,
  FinanceData,
  FlowType,
  Loan,
  Operation,
  Prepayment,
  Property,
  Recurrence,
  ServiceRecord,
  Settings,
  Vehicle,
} from './types'
import { duePayments } from '../lib/loan'
import { todayKey } from '../lib/date'
import { occurrencesBetween } from '../lib/recurrence'
import { BASE_CURRENCY, toBase } from '../lib/currency'

let adapter: StorageAdapter = localStorageAdapter
let state: FinanceData = applyRecurrences(reconcileLoans(adapter.load() ?? initial()))

const listeners = new Set<() => void>()

function initial(): FinanceData {
  const fresh = emptyData()
  adapter.save(fresh)
  return fresh
}

// Синхронизация на старте могла дозавести платежи и повторы за прошедшие месяцы —
// сохраняем сразу, иначе они пересоздавались бы при каждом запуске с новыми идентификаторами.
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

/**
 * Пробег машины после записи в журнал: он только растёт.
 *
 * Запись задним числом — «в мае меняли колодки на 84 300» — не должна
 * отматывать табло назад, поэтому меньшее число игнорируется.
 */
function grownMileage(current: number | undefined, fromRecord: number | undefined): number | undefined {
  if (fromRecord === undefined) return current
  if (current === undefined) return fromRecord
  return Math.max(current, fromRecord)
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
  const desired = new Map<string, Pick<Operation, 'amount' | 'date' | 'note' | 'loanId' | 'loanRef' | 'accountId'>>()

  const fallbackAccount = data.accounts.find((a) => !a.archivedAt)?.id ?? data.accounts[0]?.id

  for (const loan of data.loans ?? []) {
    if (loan.closedAt || !loan.autoExpense) continue

    // Счёт списания: указанный у кредита, иначе первый активный.
    const accountId = loan.accountId ?? fallbackAccount
    if (!accountId) continue

    for (const row of duePayments(loan, today)) {
      desired.set(`${loan.id}|${row.date}`, {
        amount: row.payment,
        date: row.date,
        note: `${loan.title} — платёж ${row.index}`,
        loanId: loan.id,
        loanRef: row.date,
        accountId,
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
        accountId,
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
      operation.accountId === want.accountId &&
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

/* ── Повторяющиеся операции ────────────────────────────────────────────── */

/**
 * Заводит операции по правилам повтора за всё время, что приложение не открывали.
 *
 * Принципиально отличается от сверки кредитов: та каждый раз приводит операции
 * к расчёту, а эта только создаёт недостающие. Платёж по кредиту — производная
 * от графика, а повторяющаяся операция — обычная запись: аренда выросла на
 * тысячу, человек поправил сумму за этот месяц, и затирать его правку шаблоном
 * нельзя. Ровно поэтому и удалённая операция не возвращается — до какой даты
 * уже создавали, помнит `lastRunAt`.
 *
 * Функция идемпотентна: повторный вызов в тот же день ничего не добавляет.
 */
export function applyRecurrences(data: FinanceData, today: DateKey = todayKey()): FinanceData {
  const created: Operation[] = []
  let changed = false

  const recurrences = (data.recurrences ?? []).map((rule) => {
    if (rule.pausedAt) return rule

    // Счёт могли удалить или заархивировать — списывать стало неоткуда.
    // Правило без счёта живёт дальше: общей трате счёт и не был нужен.
    if (rule.accountId) {
      const account = accountById(data, rule.accountId)
      if (!account || account.archivedAt) return rule
    }

    const dates = occurrencesBetween(rule, today, rule.lastRunAt)
    if (dates.length === 0) {
      return rule.lastRunAt === today ? rule : { ...rule, lastRunAt: today }
    }

    for (const date of dates) {
      created.push({
        id: newId(),
        type: rule.type,
        amount: rule.amount,
        categoryId: rule.categoryId,
        date,
        note: rule.note,
        accountId: rule.accountId,
        toAccountId: rule.toAccountId,
        toAmount: rule.toAmount,
        recurrenceId: rule.id,
        createdAt: new Date().toISOString(),
      })
    }

    changed = true
    return { ...rule, lastRunAt: today }
  })

  // Отметка `lastRunAt` двигается каждый день, но сохранять из-за неё новое
  // состояние стоит только вместе с операциями — иначе запись в хранилище
  // и перерисовка экрана происходили бы на ровном месте.
  if (!changed) return data

  return { ...data, operations: [...data.operations, ...created], recurrences }
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
   * Досоздать всё, у чего наступил срок: платежи по кредитам и повторяющиеся
   * операции. Вызывается при запуске и при возврате в приложение — без этого
   * расход за новый месяц появился бы только после того, как человек сам
   * что-нибудь нажмёт.
   */
  sync() {
    const next = applyRecurrences(reconcileLoans(state))
    if (next !== state) setState(next)
  },

  /* ── Повторяющиеся операции ──────────────────────────────────────────── */

  /**
   * Завести правило повтора. `lastRunAt` ставится на дату первой операции:
   * её человек уже создал руками в форме, и сверка не должна её задвоить.
   */
  addRecurrence(input: Omit<Recurrence, 'id' | 'createdAt'>): Recurrence {
    const rule: Recurrence = {
      ...input,
      lastRunAt: input.lastRunAt ?? input.startDate,
      id: newId(),
      createdAt: new Date().toISOString(),
    }

    setState({ ...state, recurrences: [...state.recurrences, rule] })
    return rule
  },

  updateRecurrence(id: string, patch: Partial<Omit<Recurrence, 'id' | 'createdAt'>>) {
    setState({
      ...state,
      recurrences: state.recurrences.map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule,
      ),
    })
  },

  /** Остановить повтор, не трогая уже созданные операции. */
  pauseRecurrence(id: string) {
    actions.updateRecurrence(id, { pausedAt: new Date().toISOString() })
  },

  /**
   * Возобновить повтор. Пропущенное за время паузы не досоздаётся: человек
   * выключил повтор осознанно, и получить за это пачку операций задним числом
   * он точно не рассчитывал.
   */
  resumeRecurrence(id: string) {
    setState({
      ...state,
      recurrences: state.recurrences.map((rule) => {
        if (rule.id !== id) return rule
        const { pausedAt: _paused, ...rest } = rule
        return { ...rest, lastRunAt: todayKey() }
      }),
    })
  },

  /** Удалить правило. Созданные им операции остаются: это уже потраченные деньги. */
  deleteRecurrence(id: string) {
    setState({ ...state, recurrences: state.recurrences.filter((rule) => rule.id !== id) })
  },

  /* ── Счета ───────────────────────────────────────────────────────────── */

  addAccount(input: Omit<Account, 'id' | 'createdAt'>): Account {
    const account: Account = { ...input, id: newId(), createdAt: new Date().toISOString() }
    setState({ ...state, accounts: [...state.accounts, account] })
    return account
  },

  updateAccount(id: string, patch: Partial<Omit<Account, 'id' | 'createdAt'>>) {
    setState({
      ...state,
      accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })
  },

  /**
   * Сделать остаток на счёте равным указанному.
   *
   * Остаток нигде не хранится — он считается как точка отсчёта плюс операции
   * счёта, — поэтому «поправить остаток» означает сдвинуть точку отсчёта на
   * разницу. Ни одной новой записи в истории при этом не появляется: выдуманный
   * доход на недостающую тысячу навсегда испортил бы аналитику месяца, а
   * выдуманный расход — структуру трат.
   *
   * Разницу считаем от текущего состояния, а не от начального остатка: между
   * двумя правками могли добавиться операции, и вычитать надо ровно то, что
   * человек сейчас видит на экране.
   */
  setAccountBalance(id: string, amount: number) {
    const account = accountById(state, id)
    if (!account) return

    const delta = amount - accountBalance(state, id)
    if (delta === 0) return

    actions.updateAccount(id, { initialBalance: account.initialBalance + delta })
  },

  /**
   * Убрать счёт из обихода, сохранив историю.
   *
   * Полное удаление осиротило бы операции: они ссылаются на счёт, и без него
   * их некуда отнести. Архивный счёт не предлагается в формах, но остатки и
   * прошлые траты по нему остаются на месте.
   */
  archiveAccount(id: string) {
    setState({
      ...state,
      accounts: state.accounts.map((a) =>
        a.id === id ? { ...a, archivedAt: new Date().toISOString() } : a,
      ),
    })
  },

  unarchiveAccount(id: string) {
    setState({
      ...state,
      accounts: state.accounts.map((a) => {
        if (a.id !== id) return a
        const { archivedAt: _archived, ...rest } = a
        return rest
      }),
    })
  },

  /** Удалить счёт вместе со всеми его операциями. Без возврата. */
  deleteAccount(id: string) {
    setState(
      reconcileLoans({
        ...state,
        accounts: state.accounts.filter((a) => a.id !== id),
        operations: state.operations.filter(
          (o) => o.accountId !== id && o.toAccountId !== id,
        ),
        loans: state.loans.filter((l) => l.accountId !== id),
        // Повтор без счёта списывать не с чего — он бы молча перестал работать.
        recurrences: state.recurrences.filter(
          (rule) => rule.accountId !== id && rule.toAccountId !== id,
        ),
      }),
    )
  },

  /* ── Машины ──────────────────────────────────────────────────────────── */

  addVehicle(input: Omit<Vehicle, 'id' | 'createdAt' | 'records'>): Vehicle {
    const vehicle: Vehicle = {
      ...input,
      id: newId(),
      records: [],
      createdAt: new Date().toISOString(),
    }

    setState({ ...state, vehicles: [...state.vehicles, vehicle] })
    return vehicle
  },

  updateVehicle(id: string, patch: Partial<Omit<Vehicle, 'id' | 'createdAt' | 'records'>>) {
    setState({
      ...state,
      vehicles: state.vehicles.map((vehicle) =>
        vehicle.id === id ? { ...vehicle, ...patch } : vehicle,
      ),
    })
  },

  /** Машина уходит вместе со своим журналом: без неё записи не к чему отнести. */
  deleteVehicle(id: string) {
    setState({ ...state, vehicles: state.vehicles.filter((vehicle) => vehicle.id !== id) })
  },

  /**
   * Записать работы в журнал.
   *
   * Пробег из записи подтягивает текущий пробег машины, если он больше:
   * человек только что ввёл число на табло — заставлять его вписать то же
   * самое второй раз в карточку значит гарантированно получить расхождение.
   */
  addService(vehicleId: string, input: Omit<ServiceRecord, 'id' | 'createdAt'>): void {
    const record: ServiceRecord = {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString(),
    }

    setState({
      ...state,
      vehicles: state.vehicles.map((vehicle) =>
        vehicle.id === vehicleId
          ? {
              ...vehicle,
              records: [...vehicle.records, record],
              mileage: grownMileage(vehicle.mileage, record.mileage),
            }
          : vehicle,
      ),
    })
  },

  updateService(
    vehicleId: string,
    recordId: string,
    patch: Partial<Omit<ServiceRecord, 'id' | 'createdAt'>>,
  ) {
    setState({
      ...state,
      vehicles: state.vehicles.map((vehicle) =>
        vehicle.id === vehicleId
          ? {
              ...vehicle,
              records: vehicle.records.map((record) =>
                record.id === recordId ? { ...record, ...patch } : record,
              ),
              mileage: grownMileage(vehicle.mileage, patch.mileage),
            }
          : vehicle,
      ),
    })
  },

  deleteService(vehicleId: string, recordId: string) {
    setState({
      ...state,
      vehicles: state.vehicles.map((vehicle) =>
        vehicle.id === vehicleId
          ? { ...vehicle, records: vehicle.records.filter((record) => record.id !== recordId) }
          : vehicle,
      ),
    })
  },

  /* ── Недвижимость ────────────────────────────────────────────────────── */

  addProperty(input: Omit<Property, 'id' | 'createdAt'>): Property {
    const property: Property = { ...input, id: newId(), createdAt: new Date().toISOString() }
    setState({ ...state, properties: [...state.properties, property] })
    return property
  },

  updateProperty(id: string, patch: Partial<Omit<Property, 'id' | 'createdAt'>>) {
    setState({
      ...state,
      properties: state.properties.map((property) =>
        property.id === id ? { ...property, ...patch } : property,
      ),
    })
  },

  deleteProperty(id: string) {
    setState({ ...state, properties: state.properties.filter((property) => property.id !== id) })
  },

  /* ── Очистка ─────────────────────────────────────────────────────────── */

  /**
   * Стереть историю операций, оставив счета, кредиты и настройки.
   *
   * Кредиты приходится удалять вместе с ней: их платежи не хранятся, а
   * вычисляются из графика, и сверка вернула бы их обратно через секунду.
   * Обещать очистку и тут же показать те же операции — хуже, чем честно
   * сказать, что кредиты уйдут тоже.
   */
  clearOperations() {
    setState({ ...state, operations: [], loans: [] })
  },

  /** Полный сброс: как будто приложение открыли впервые. */
  resetAll() {
    setState(emptyData())
  },
}

/* ── Выборки ───────────────────────────────────────────────────────────── */

export function categoriesOf(data: FinanceData, type: FlowType): Category[] {
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

export function vehicleById(data: FinanceData, id: string): Vehicle | undefined {
  return data.vehicles.find((vehicle) => vehicle.id === id)
}

export function propertyById(data: FinanceData, id: string): Property | undefined {
  return data.properties.find((property) => property.id === id)
}

/** Порядок «свежее сверху»: по дате, внутри дня — по времени добавления. */
export function byRecency(a: Operation, b: Operation): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : -1
}

/** Операции по убыванию даты, внутри дня — последние добавленные сверху. */
export function sortedOperations(data: FinanceData): Operation[] {
  return [...data.operations].sort(byRecency)
}

export function operationsBetween(data: FinanceData, from: DateKey, to: DateKey): Operation[] {
  return data.operations.filter((o) => o.date >= from && o.date <= to)
}

export interface OperationGroup {
  key: string
  /** Хотя бы одна; если ровно одна — группировать было нечего. */
  operations: Operation[]
}

/**
 * Схлопывает однотипные операции в группы.
 *
 * Три поездки на такси за день — это одна мысль «на такси ушло 900 ₽», а не три
 * строки, между которыми теряется всё остальное. Однотипность — это совпадение
 * типа, категории (у переводов — пары счетов) и валюты: суммы в группе
 * складываются, а рубли с долларами складывать нельзя.
 *
 * Порядок групп — по первой операции каждой, поэтому исходная сортировка списка
 * сохраняется. Внутри дня список уже отсортирован, так что группировать нужно
 * именно поданный кусок, а не всю историю.
 */
export function groupSimilar(data: FinanceData, operations: Operation[]): OperationGroup[] {
  const groups = new Map<string, OperationGroup>()

  for (const operation of operations) {
    // У операции без счёта валюта та же, в которой её показывает список, —
    // иначе одинаковые с виду строки разъехались бы по разным группам.
    const currency = accountById(data, operation.accountId)?.currency ?? BASE_CURRENCY

    const key =
      operation.type === 'transfer'
        ? `transfer|${operation.accountId}|${operation.toAccountId}|${currency}`
        : `${operation.type}|${operation.categoryId}|${currency}`

    const group = groups.get(key)
    if (group) group.operations.push(operation)
    else groups.set(key, { key, operations: [operation] })
  }

  return [...groups.values()]
}

export interface FlowGroup extends OperationGroup {
  /** Сумма группы в валюте её операций. */
  total: number
  /** Она же в рублях; null — курс не задан. */
  inBase: number | null
}

/**
 * Доходы или расходы периода, схлопнутые в группы и выстроенные по убыванию суммы.
 *
 * Лента «последних операций» отвечала на вопрос «что я делал вчера», а спрашивают
 * обычно другое: на что уходит больше всего. Поэтому здесь не хронология, а
 * рейтинг: сверху то, что стоило дороже всего, и уже внутри группы — из чего оно
 * сложилось. Порядок операций внутри остаётся хронологическим — развернув
 * «Продукты», человек ждёт увидеть последнюю покупку первой.
 *
 * Валюты не смешиваются: `groupSimilar` разводит их по разным группам, а
 * сравниваем группы по рублёвому эквиваленту. Там, где курса нет, в сравнение
 * идёт сумма как есть — место в списке будет условным, но группа не потеряется.
 */
export function flowGroups(
  data: FinanceData,
  operations: Operation[],
  type: FlowType,
): FlowGroup[] {
  const flow = operations.filter((operation) => operation.type === type).sort(byRecency)

  return groupSimilar(data, flow)
    .map((group) => {
      const total = group.operations.reduce((sum, operation) => sum + operation.amount, 0)
      const currency =
        accountById(data, group.operations[0].accountId)?.currency ?? BASE_CURRENCY

      return { ...group, total, inBase: toBase(total, currency, data.settings.rates) }
    })
    .sort((a, b) => (b.inBase ?? b.total) - (a.inBase ?? a.total))
}

export interface Totals {
  income: number
  expense: number
  balance: number
}

/**
 * Доходы и расходы. Переводы игнорируются: они не создают и не уничтожают
 * деньги, а перекладывают их между своими счетами, и в отчёте о тратах им
 * делать нечего.
 */
export function totalsOf(operations: Operation[]): Totals {
  let income = 0
  let expense = 0

  for (const operation of operations) {
    if (operation.type === 'income') income += operation.amount
    else if (operation.type === 'expense') expense += operation.amount
  }

  return { income, expense, balance: income - expense }
}

/* ── Счета и остатки ───────────────────────────────────────────────────── */

/** Принимает и пустой идентификатор: у операции счёта может не быть вовсе. */
export function accountById(data: FinanceData, id: string | undefined): Account | undefined {
  if (!id) return undefined
  return data.accounts.find((account) => account.id === id)
}

export function activeAccounts(data: FinanceData): Account[] {
  return data.accounts.filter((account) => !account.archivedAt)
}

/** Работающие правила повтора — те, что заведут операцию в свой срок. */
export function activeRecurrences(data: FinanceData): Recurrence[] {
  return data.recurrences.filter((rule) => !rule.pausedAt)
}

/**
 * Остаток на счёте в его собственной валюте: начальный остаток плюс всё, что
 * пришло, минус всё, что ушло. Переводы двигают оба конца — с одного счёта
 * снимается `amount`, на другой ложится `toAmount`, если валюты разные.
 */
export function accountBalance(data: FinanceData, accountId: string): number {
  const account = accountById(data, accountId)
  let balance = account?.initialBalance ?? 0

  for (const operation of data.operations) {
    // Операции без счёта в остаток не попадают ни к кому: это общие траты,
    // которые человек намеренно не разносил по картам.
    if (operation.accountId && operation.accountId === accountId) {
      if (operation.type === 'income') balance += operation.amount
      else balance -= operation.amount
    } else if (operation.toAccountId === accountId) {
      balance += operation.toAmount ?? operation.amount
    }
  }

  return balance
}

export interface AccountBalance {
  account: Account
  /** Остаток в валюте счёта. */
  amount: number
  /** Он же в рублях; null — курс не задан, и приплюсовать его к итогу нечем. */
  inBase: number | null
}

export function accountBalances(data: FinanceData): AccountBalance[] {
  return activeAccounts(data).map((account) => {
    const amount = accountBalance(data, account.id)
    return { account, amount, inBase: toBase(amount, account.currency, data.settings.rates) }
  })
}

export interface TotalBalance {
  /** Сумма всех счетов в рублях. */
  amount: number
  /** Счета, которые в неё не вошли из-за незаданного курса. */
  missingRates: string[]
}

/**
 * Общий баланс — то, что показано крупно на главной.
 *
 * Считается по остаткам счетов, а не по одним операциям: у счёта бывает
 * начальный остаток, заведённый до появления приложения, и без него итог
 * расходился бы с реальностью с первого дня.
 */
export function totalBalance(data: FinanceData): TotalBalance {
  let amount = 0
  const missingRates: string[] = []

  for (const row of accountBalances(data)) {
    if (row.inBase === null) {
      if (!missingRates.includes(row.account.currency)) missingRates.push(row.account.currency)
      continue
    }
    amount += row.inBase
  }

  return { amount, missingRates }
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
  type: FlowType,
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
        color: REST_COLOR,
      },
      amount: tail.reduce((acc, row) => acc + row.amount, 0),
      share: tail.reduce((acc, row) => acc + row.share, 0),
    },
  ]
}
