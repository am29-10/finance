/**
 * Ядро модели.
 *
 * Единственный источник правды — список операций. Баланс, аналитика и остаток
 * бюджета нигде не хранятся, а всегда считаются из него: иначе после правки или
 * удаления операции сохранённый баланс разойдётся с историей и починить его будет нечем.
 */

export type OperationType = 'income' | 'expense'

/** Дата в формате YYYY-MM-DD, всегда локальная, не UTC. */
export type DateKey = string

export interface Operation {
  id: string
  type: OperationType
  /**
   * Сумма в КОПЕЙКАХ, целым числом. Дробные рубли в JavaScript накапливают
   * ошибку округления, и на сотне операций баланс перестаёт сходиться.
   */
  amount: number
  categoryId: string
  date: DateKey
  note?: string
  createdAt: string
  /** Кредит, платёж по которому породил эту операцию. Такие операции не редактируются вручную. */
  loanId?: string
  /**
   * Ключ идемпотентности платежа по кредиту: дата планового платежа либо `p:<id досрочки>`.
   * По нему синхронизация понимает, что операция уже создана, и не задваивает расход.
   */
  loanRef?: string
}

export interface Category {
  id: string
  title: string
  type: OperationType
  /** Ключ иконки из CategoryIcon. */
  icon: string
  color: string
  /** Встроенные категории нельзя удалить — на них ссылается история. */
  builtin?: boolean
  archivedAt?: string
}

/* ── Кредиты ───────────────────────────────────────────────────────────── */

export type LoanKind = 'mortgage' | 'consumer' | 'auto' | 'other'

/** Схема погашения. Аннуитет — равный платёж; дифференцированный — равное тело, убывающий платёж. */
export type LoanScheme = 'annuity' | 'differentiated'

/**
 * Что делает досрочное погашение с оставшимся графиком.
 * `term` — платёж прежний, кредит закрывается раньше (выгоднее по процентам).
 * `payment` — срок прежний, ежемесячный платёж падает (легче нагрузка).
 */
export type EarlyMode = 'term' | 'payment'

export interface Prepayment {
  id: string
  date: DateKey
  /** Сумма досрочного погашения в копейках. */
  amount: number
  mode: EarlyMode
  note?: string
  createdAt: string
}

export interface Loan {
  id: string
  title: string
  kind: LoanKind
  /**
   * Долг в копейках на дату `startDate`. Для нового кредита — сумма выдачи,
   * для уже действующего — остаток, который показывает банк на день заведения.
   */
  principal: number
  /**
   * Годовая ставка в СОТЫХ ДОЛЯХ ПРОЦЕНТА: 10,5 % → 1050.
   * Целое по той же причине, что и суммы: дробь в проценте уводит график на сотни рублей.
   */
  rate: number
  /** Срок в месяцах, считая от `startDate`. */
  termMonths: number
  startDate: DateKey
  /** День списания, 1–31. В коротких месяцах съезжает на последнее число. */
  paymentDay: number
  scheme: LoanScheme
  /** Режим досрочки, предлагаемый по умолчанию. */
  earlyMode: EarlyMode
  /**
   * Заводить расход на каждый плановый платёж автоматически.
   * Банк списывает сам — приложение делает то же, иначе расходы месяца занижены
   * ровно на платёж по ипотеке, а это обычно самая крупная трата.
   */
  autoExpense: boolean
  prepayments: Prepayment[]
  /** Кредит закрыт вручную: график больше не считается, операции не создаются. */
  closedAt?: string
  createdAt: string
}

export interface Settings {
  /** Имя для приветствия на главной. */
  name: string
  /** Месячный бюджет в копейках; 0 — не задан. */
  monthlyBudget: number
  /** Хеш PIN-кода; пусто — вход без кода. Сам код нигде не хранится. */
  pinHash?: string
  /**
   * Когда в последний раз выгружали резервную копию.
   * Нужно, чтобы напомнить: в браузере данные живут ровно до чистки хранилища,
   * а на iPhone — до удаления иконки с домашнего экрана.
   */
  lastBackupAt?: string
}

export interface FinanceData {
  version: number
  operations: Operation[]
  categories: Category[]
  loans: Loan[]
  settings: Settings
}

export const SCHEMA_VERSION = 2

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  monthlyBudget: 0,
}
