import { describe, expect, it } from 'vitest'
import { emptyData, migrate } from './storage'
import { DEFAULT_ACCOUNT_ID } from './accounts'
import { defaultCategories, LOAN_CATEGORY_ID, REST_COLOR } from './categories'
import type { Account, FinanceData, Operation } from './types'

function account(patch: Partial<Account> = {}): Account {
  return {
    id: DEFAULT_ACCOUNT_ID,
    title: 'Основной',
    kind: 'card',
    currency: 'RUB',
    initialBalance: 0,
    color: '#2e7d6b',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...patch,
  }
}

function operation(patch: Partial<Operation> = {}): Operation {
  return {
    id: 'o1',
    type: 'expense',
    amount: 50000,
    categoryId: 'products',
    date: '2026-01-10',
    accountId: DEFAULT_ACCOUNT_ID,
    createdAt: '2026-01-10T00:00:00.000Z',
    ...patch,
  }
}

/** Сырые данные из хранилища: поля могут отсутствовать, как в старых версиях. */
function stored(patch: Partial<FinanceData> = {}): FinanceData {
  return {
    version: 3,
    operations: [],
    categories: defaultCategories(),
    accounts: [],
    loans: [],
    recurrences: [],
    vehicles: [],
    properties: [],
    settings: { monthlyBudget: 0, rates: {} },
    ...patch,
  }
}

describe('emptyData', () => {
  it('не заводит счетов за человека', () => {
    expect(emptyData().accounts).toEqual([])
  })

  it('даёт категории и пустую историю', () => {
    const data = emptyData()

    expect(data.operations).toEqual([])
    expect(data.recurrences).toEqual([])
    expect(data.categories.length).toBeGreaterThan(0)
  })
})

describe('migrate: счёт «Основной»', () => {
  it('убирает пустой счёт по умолчанию', () => {
    expect(migrate(stored({ accounts: [account()] })).accounts).toEqual([])
  })

  it('оставляет его, если на нём есть операции', () => {
    const data = migrate(stored({ accounts: [account()], operations: [operation()] }))

    expect(data.accounts).toHaveLength(1)
  })

  it('оставляет его, если на нём лежит начальный остаток', () => {
    const data = migrate(stored({ accounts: [account({ initialBalance: 100_000 })] }))

    expect(data.accounts).toHaveLength(1)
  })

  it('оставляет его, если он получатель перевода', () => {
    const data = migrate(
      stored({
        accounts: [account(), account({ id: 'a2', title: 'Наличные' })],
        operations: [operation({ type: 'transfer', accountId: 'a2', toAccountId: DEFAULT_ACCOUNT_ID })],
      }),
    )

    expect(data.accounts.map((a) => a.id)).toContain(DEFAULT_ACCOUNT_ID)
  })

  it('оставляет его, если с него списывается кредит', () => {
    const data = migrate(
      stored({
        accounts: [account()],
        loans: [{ id: 'l1', accountId: DEFAULT_ACCOUNT_ID } as never],
      }),
    )

    expect(data.accounts).toHaveLength(1)
  })

  it('убирает его, если на нём только платежи по кредиту без своего счёта', () => {
    // Такие операции — производная от графика: сверка перенесёт их на другой счёт.
    const data = migrate(
      stored({
        accounts: [account(), account({ id: 'a2', title: 'Сбер' })],
        operations: [operation({ loanId: 'l1', loanRef: '2026-01-10' })],
        loans: [{ id: 'l1' } as never],
      }),
    )

    expect(data.accounts.map((a) => a.id)).toEqual(['a2'])
  })

  it('не убирает его, если переносить платежи некуда', () => {
    const data = migrate(
      stored({
        accounts: [account()],
        operations: [operation({ loanId: 'l1', loanRef: '2026-01-10' })],
        loans: [{ id: 'l1' } as never],
      }),
    )

    expect(data.accounts).toHaveLength(1)
  })

  it('не трогает счета, заведённые человеком', () => {
    const data = migrate(stored({ accounts: [account({ id: 'a2', title: 'Тинькофф' })] }))

    expect(data.accounts).toHaveLength(1)
  })
})

describe('migrate: старые базы', () => {
  it('заводит счёт истории, у которой его не было', () => {
    const legacy = stored({ operations: [operation({ accountId: undefined as never })] })
    delete (legacy as Partial<FinanceData>).accounts

    const data = migrate(legacy)

    expect(data.accounts).toHaveLength(1)
    expect(data.operations[0].accountId).toBe(data.accounts[0].id)
  })

  it('не заводит счёт пустой базе без операций', () => {
    const legacy = stored()
    delete (legacy as Partial<FinanceData>).accounts

    expect(migrate(legacy).accounts).toEqual([])
  })

  it('дозаводит категорию кредитов', () => {
    const withoutLoans = defaultCategories().filter((c) => c.id !== LOAN_CATEGORY_ID)
    const data = migrate(stored({ categories: withoutLoans }))

    expect(data.categories.some((c) => c.id === LOAN_CATEGORY_ID)).toBe(true)
  })

  it('дозаводит категории, появившиеся позже, — например аренду квартиры', () => {
    const withoutRent = defaultCategories().filter((c) => c.id !== 'rent-income')
    const data = migrate(stored({ categories: withoutRent }))

    const rent = data.categories.find((c) => c.id === 'rent-income')

    expect(rent?.type).toBe('income')
    // Место в списке — из кода: новая категория встаёт рядом с зарплатой,
    // а не в хвосте после «Другого».
    expect(data.categories.indexOf(rent!)).toBeLessThan(
      data.categories.findIndex((c) => c.id === 'other-income'),
    )
  })

  it('не приписывает счёт общей трате', () => {
    // Поле accounts у базы есть — значит про счета она знает, и операция без
    // счёта в ней заведена намеренно. Приписать карту значило бы изменить
    // остаток, которого человек не менял.
    const data = migrate(
      stored({
        accounts: [account({ id: 'a2', title: 'Сбер' })],
        operations: [operation({ accountId: undefined })],
      }),
    )

    expect(data.operations[0].accountId).toBeUndefined()
  })

  it('добавляет пустой список повторов', () => {
    const legacy = stored()
    delete (legacy as Partial<FinanceData>).recurrences

    expect(migrate(legacy).recurrences).toEqual([])
  })

  it('добавляет пустые списки машин и недвижимости', () => {
    const legacy = stored()
    delete (legacy as Partial<FinanceData>).vehicles
    delete (legacy as Partial<FinanceData>).properties

    const data = migrate(legacy)

    expect(data.vehicles).toEqual([])
    expect(data.properties).toEqual([])
  })

  it('подставляет машине пустой журнал, если его нет', () => {
    const data = migrate(
      stored({ vehicles: [{ id: 'v1', title: 'BMW 320i', createdAt: '' } as never] }),
    )

    expect(data.vehicles[0].records).toEqual([])
  })

  it('переносит настройки, подставляя недостающее', () => {
    const data = migrate(stored({ settings: { monthlyBudget: 50_000_00 } as never }))

    expect(data.settings.monthlyBudget).toBe(50_000_00)
    expect(data.settings.rates).toEqual({})
  })
})

describe('migrate: слияние категорий', () => {
  /** База, снятая до слияния: «Рестораны» ещё отдельная категория. */
  function withRestaurants(patch: Partial<FinanceData> = {}): FinanceData {
    return stored({
      categories: [
        ...defaultCategories(),
        {
          id: 'restaurants',
          title: 'Рестораны',
          type: 'expense' as const,
          icon: 'dish',
          color: '#db2777',
        },
      ],
      ...patch,
    })
  }

  it('переносит операции из «Ресторанов» в «Кафе и рестораны»', () => {
    const data = migrate(
      withRestaurants({ operations: [operation({ categoryId: 'restaurants' })] }),
    )

    expect(data.operations[0].categoryId).toBe('cafe')
  })

  it('переносит и правила повтора — иначе они заводили бы операции в пустоту', () => {
    const data = migrate(
      withRestaurants({
        recurrences: [
          {
            id: 'r1',
            type: 'expense',
            amount: 100_000,
            categoryId: 'restaurants',
            accountId: DEFAULT_ACCOUNT_ID,
            period: 'month',
            startDate: '2026-01-10',
            createdAt: '2026-01-10T00:00:00.000Z',
          },
        ],
      }),
    )

    expect(data.recurrences[0].categoryId).toBe('cafe')
  })

  it('убирает опустевшую категорию и не заводит её обратно', () => {
    const data = migrate(withRestaurants())

    expect(data.categories.some((c) => c.id === 'restaurants')).toBe(false)
  })

  it('переименовывает «Кафе» у тех, кто завёл базу до слияния', () => {
    const data = migrate(withRestaurants())

    expect(data.categories.find((c) => c.id === 'cafe')?.title).toBe('Кафе и рестораны')
  })
})

describe('migrate: цвета категорий', () => {
  it('обновляет цвета встроенных категорий из кода', () => {
    const stale = defaultCategories().map((c) =>
      c.id === 'salary' ? { ...c, color: '#4caf50' } : c,
    )

    const data = migrate(stored({ categories: stale }))

    expect(data.categories.find((c) => c.id === 'salary')?.color).toBe('#008300')
  })

  it('перекрашивает «Другое» в общий нейтральный', () => {
    const stale = defaultCategories().map((c) =>
      c.id === 'other-income' ? { ...c, color: '#6ee7b7' } : c,
    )

    const data = migrate(stored({ categories: stale }))

    expect(data.categories.find((c) => c.id === 'other-income')?.color).toBe(REST_COLOR)
  })

  it('не трогает категории, которых нет во встроенных', () => {
    const custom = [
      ...defaultCategories(),
      { id: 'mine', title: 'Своя', type: 'expense' as const, icon: 'dots', color: '#123456' },
    ]

    const data = migrate(stored({ categories: custom }))

    expect(data.categories.find((c) => c.id === 'mine')?.color).toBe('#123456')
  })
})
