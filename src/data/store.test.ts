import { describe, expect, it } from 'vitest'
import {
  actions,
  applyRecurrences,
  accountBalance,
  collapseToTop,
  flowGroups,
  groupSimilar,
  operationsBetween,
  sortedOperations,
  totalBalance,
  totalsByCategory,
  totalsOf,
} from './store'
import { defaultCategories } from './categories'
import { localStorageAdapter } from './storage'
import type { Account, FinanceData, Operation, Recurrence } from './types'

function account(patch: Partial<Account> = {}): Account {
  return {
    id: 'a1',
    title: 'Сбер',
    kind: 'card',
    currency: 'RUB',
    initialBalance: 0,
    color: '#2e7d6b',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  }
}

function operation(patch: Partial<Operation> = {}): Operation {
  return {
    id: `o${Math.round(Math.random() * 1e9)}`,
    type: 'expense',
    amount: 50000,
    categoryId: 'products',
    date: '2026-02-10',
    accountId: 'a1',
    createdAt: '2026-02-10T10:00:00.000Z',
    ...patch,
  }
}

function data(patch: Partial<FinanceData> = {}): FinanceData {
  return {
    version: 4,
    operations: [],
    categories: defaultCategories(),
    accounts: [account()],
    loans: [],
    recurrences: [],
    vehicles: [],
    properties: [],
    settings: { monthlyBudget: 0, rates: {} },
    ...patch,
  }
}

describe('totalsOf', () => {
  it('складывает доходы и расходы по отдельности', () => {
    const totals = totalsOf([
      operation({ type: 'income', amount: 100_000 }),
      operation({ amount: 30_000 }),
    ])

    expect(totals).toEqual({ income: 100_000, expense: 30_000, balance: 70_000 })
  })

  it('не считает переводы ни доходом, ни расходом', () => {
    const totals = totalsOf([operation({ type: 'transfer', amount: 500_000, toAccountId: 'a2' })])

    expect(totals).toEqual({ income: 0, expense: 0, balance: 0 })
  })
})

describe('accountBalance', () => {
  it('начинает с начального остатка', () => {
    const state = data({ accounts: [account({ initialBalance: 100_000 })] })

    expect(accountBalance(state, 'a1')).toBe(100_000)
  })

  it('прибавляет доходы и вычитает расходы', () => {
    const state = data({
      operations: [operation({ type: 'income', amount: 200_000 }), operation({ amount: 50_000 })],
    })

    expect(accountBalance(state, 'a1')).toBe(150_000)
  })

  it('двигает оба конца перевода', () => {
    const state = data({
      accounts: [account({ initialBalance: 500_000 }), account({ id: 'a2', title: 'Наличные' })],
      operations: [operation({ type: 'transfer', amount: 100_000, toAccountId: 'a2' })],
    })

    expect(accountBalance(state, 'a1')).toBe(400_000)
    expect(accountBalance(state, 'a2')).toBe(100_000)
  })

  it('не трогает остаток операцией без счёта', () => {
    // Общая трата живёт в истории и в аналитике, но ничей баланс не двигает:
    // остатки счетов человек ведёт сам, и списать «с воздуха» нельзя.
    const state = data({
      accounts: [account({ initialBalance: 100_000 })],
      operations: [operation({ amount: 30_000, accountId: undefined })],
    })

    expect(accountBalance(state, 'a1')).toBe(100_000)
  })

  it('в обмене валюты кладёт на счёт полученную сумму, а не отданную', () => {
    const state = data({
      accounts: [
        account({ initialBalance: 1_000_000 }),
        account({ id: 'a2', title: 'Доллары', currency: 'USD' }),
      ],
      operations: [
        operation({ type: 'transfer', amount: 950_000, toAccountId: 'a2', toAmount: 10_000 }),
      ],
    })

    expect(accountBalance(state, 'a1')).toBe(50_000)
    expect(accountBalance(state, 'a2')).toBe(10_000)
  })
})

describe('totalBalance', () => {
  it('переводит валютные счета по курсу', () => {
    const state = data({
      accounts: [
        account({ initialBalance: 100_000 }),
        account({ id: 'a2', currency: 'USD', initialBalance: 10_000 }),
      ],
      settings: { monthlyBudget: 0, rates: { USD: 9500 } },
    })

    // 100 $ по 95 ₽ = 9500 ₽ плюс 1000 ₽ рублёвого остатка.
    expect(totalBalance(state).amount).toBe(100_000 + 950_000)
    expect(totalBalance(state).missingRates).toEqual([])
  })

  it('не приплюсовывает счета без курса и называет их валюту', () => {
    const state = data({
      accounts: [
        account({ initialBalance: 100_000 }),
        account({ id: 'a2', currency: 'USD', initialBalance: 10_000 }),
      ],
    })

    expect(totalBalance(state).amount).toBe(100_000)
    expect(totalBalance(state).missingRates).toEqual(['USD'])
  })

  it('без счетов даёт ноль, а не ошибку', () => {
    expect(totalBalance(data({ accounts: [] })).amount).toBe(0)
  })
})

describe('actions.setAccountBalance', () => {
  /** Действия меняют модульное состояние, а наружу оно видно через хранилище. */
  function afterAction(seed: FinanceData, run: () => void): FinanceData {
    actions.replaceAll(seed)
    run()
    return localStorageAdapter.load()!
  }

  it('делает остаток ровно тем, который назвали', () => {
    const next = afterAction(data({ accounts: [account({ initialBalance: 100_000 })] }), () =>
      actions.setAccountBalance('a1', 250_000),
    )

    expect(accountBalance(next, 'a1')).toBe(250_000)
  })

  it('не заводит ни одной операции — аналитика остаётся чистой', () => {
    const next = afterAction(data({ accounts: [account()] }), () =>
      actions.setAccountBalance('a1', 250_000),
    )

    expect(next.operations).toEqual([])
  })

  it('оставляет историю на месте, сдвигая только точку отсчёта', () => {
    const seed = data({
      accounts: [account({ initialBalance: 100_000 })],
      operations: [operation({ amount: 30_000 })],
    })

    // Видно 700 ₽, а банк показывает 900 ₽ — недостающие 200 ₽ уходят в отсчёт.
    const next = afterAction(seed, () => actions.setAccountBalance('a1', 90_000))

    expect(accountBalance(next, 'a1')).toBe(90_000)
    expect(next.operations).toHaveLength(1)
    expect(next.accounts[0].initialBalance).toBe(120_000)
  })

  it('принимает ноль и минус: счёт бывает пустым и уходит в овердрафт', () => {
    const seed = data({ accounts: [account({ initialBalance: 100_000 })] })

    expect(accountBalance(afterAction(seed, () => actions.setAccountBalance('a1', 0)), 'a1')).toBe(0)
    expect(
      accountBalance(afterAction(seed, () => actions.setAccountBalance('a1', -50_000)), 'a1'),
    ).toBe(-50_000)
  })

  it('молчит про счёт, которого нет', () => {
    const next = afterAction(data(), () => actions.setAccountBalance('нет такого', 250_000))

    expect(next.accounts).toHaveLength(1)
    expect(accountBalance(next, 'a1')).toBe(0)
  })
})

describe('operationsBetween', () => {
  it('включает обе границы', () => {
    const state = data({
      operations: [
        operation({ date: '2026-01-31' }),
        operation({ date: '2026-02-01' }),
        operation({ date: '2026-02-28' }),
        operation({ date: '2026-03-01' }),
      ],
    })

    expect(operationsBetween(state, '2026-02-01', '2026-02-28')).toHaveLength(2)
  })
})

describe('sortedOperations', () => {
  it('ставит свежие даты выше, а внутри дня — позже добавленные', () => {
    const state = data({
      operations: [
        operation({ id: 'x', date: '2026-02-01', createdAt: '2026-02-01T10:00:00.000Z' }),
        operation({ id: 'y', date: '2026-02-10', createdAt: '2026-02-10T09:00:00.000Z' }),
        operation({ id: 'z', date: '2026-02-10', createdAt: '2026-02-10T18:00:00.000Z' }),
      ],
    })

    expect(sortedOperations(state).map((o) => o.id)).toEqual(['z', 'y', 'x'])
  })
})

describe('groupSimilar', () => {
  it('сводит операции одной категории в одну группу', () => {
    const state = data()
    const groups = groupSimilar(state, [
      operation({ amount: 30_000 }),
      operation({ amount: 20_000 }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].operations).toHaveLength(2)
  })

  it('разделяет разные категории', () => {
    const groups = groupSimilar(data(), [
      operation({ categoryId: 'products' }),
      operation({ categoryId: 'cafe' }),
    ])

    expect(groups).toHaveLength(2)
  })

  it('не смешивает доход с расходом одной категории', () => {
    const groups = groupSimilar(data(), [
      operation({ type: 'expense', categoryId: 'other-expense' }),
      operation({ type: 'income', categoryId: 'other-expense' }),
    ])

    expect(groups).toHaveLength(2)
  })

  it('не смешивает суммы в разных валютах', () => {
    const state = data({
      accounts: [account(), account({ id: 'a2', currency: 'USD' })],
    })

    const groups = groupSimilar(state, [operation(), operation({ accountId: 'a2' })])

    expect(groups).toHaveLength(2)
  })

  it('разделяет переводы по маршруту', () => {
    const state = data({
      accounts: [account(), account({ id: 'a2' }), account({ id: 'a3' })],
    })

    const groups = groupSimilar(state, [
      operation({ type: 'transfer', toAccountId: 'a2' }),
      operation({ type: 'transfer', toAccountId: 'a2' }),
      operation({ type: 'transfer', toAccountId: 'a3' }),
    ])

    expect(groups).toHaveLength(2)
  })

  it('сохраняет порядок, в котором операции пришли', () => {
    const groups = groupSimilar(data(), [
      operation({ id: 'a', categoryId: 'cafe' }),
      operation({ id: 'b', categoryId: 'products' }),
      operation({ id: 'c', categoryId: 'cafe' }),
    ])

    expect(groups.map((g) => g.operations[0].id)).toEqual(['a', 'b'])
    expect(groups[0].operations.map((o) => o.id)).toEqual(['a', 'c'])
  })
})

describe('flowGroups', () => {
  it('ставит наверх то, на что ушло больше всего', () => {
    const groups = flowGroups(
      data(),
      [
        operation({ categoryId: 'cafe', amount: 20_000 }),
        operation({ categoryId: 'products', amount: 30_000 }),
        operation({ categoryId: 'products', amount: 40_000 }),
      ],
      'expense',
    )

    expect(groups.map((g) => g.total)).toEqual([70_000, 20_000])
    expect(groups[0].operations).toHaveLength(2)
  })

  it('не смешивает доходы с расходами', () => {
    const groups = flowGroups(
      data(),
      [
        operation({ type: 'income', categoryId: 'salary', amount: 300_000 }),
        operation({ categoryId: 'products', amount: 40_000 }),
      ],
      'income',
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].total).toBe(300_000)
  })

  it('оставляет переводы в стороне: они не доход и не расход', () => {
    const state = data({ accounts: [account(), account({ id: 'a2' })] })
    const groups = flowGroups(
      state,
      [operation({ type: 'transfer', amount: 500_000, toAccountId: 'a2' })],
      'expense',
    )

    expect(groups).toEqual([])
  })

  it('внутри группы держит свежее сверху', () => {
    const groups = flowGroups(
      data(),
      [
        operation({ id: 'старая', date: '2026-02-01' }),
        operation({ id: 'свежая', date: '2026-02-20' }),
      ],
      'expense',
    )

    expect(groups[0].operations.map((o) => o.id)).toEqual(['свежая', 'старая'])
  })

  it('сравнивает валютные группы по курсу, а не по числу', () => {
    const state = data({
      accounts: [account(), account({ id: 'a2', currency: 'USD' })],
      settings: { monthlyBudget: 0, rates: { USD: 9500 } },
    })

    // 200 $ — это 19 000 ₽, то есть больше, чем 5 000 ₽, хотя число меньше.
    const groups = flowGroups(
      state,
      [
        operation({ categoryId: 'products', amount: 500_000 }),
        operation({ categoryId: 'travel', amount: 20_000, accountId: 'a2' }),
      ],
      'expense',
    )

    expect(groups[0].operations[0].categoryId).toBe('travel')
    expect(groups[0].inBase).toBe(1_900_000)
  })
})

describe('totalsByCategory и collapseToTop', () => {
  it('считает доли и сортирует по убыванию', () => {
    const rows = totalsByCategory(
      data(),
      [
        operation({ categoryId: 'products', amount: 30_000 }),
        operation({ categoryId: 'cafe', amount: 70_000 }),
      ],
      'expense',
    )

    expect(rows[0].category.id).toBe('cafe')
    expect(rows[0].share).toBeCloseTo(0.7)
  })

  it('сворачивает хвост в «Другое», сохраняя общую сумму', () => {
    const rows = totalsByCategory(
      data(),
      [
        operation({ categoryId: 'products', amount: 60_000 }),
        operation({ categoryId: 'cafe', amount: 50_000 }),
        operation({ categoryId: 'home', amount: 40_000 }),
        operation({ categoryId: 'fun', amount: 30_000 }),
        operation({ categoryId: 'sport', amount: 20_000 }),
        operation({ categoryId: 'travel', amount: 10_000 }),
      ],
      'expense',
    )

    const collapsed = collapseToTop(rows)

    expect(collapsed).toHaveLength(5)
    expect(collapsed.at(-1)?.category.title).toBe('Другое')
    expect(collapsed.reduce((sum, row) => sum + row.amount, 0)).toBe(210_000)
  })

  it('не трогает список, который и так помещается', () => {
    const rows = totalsByCategory(data(), [operation()], 'expense')

    expect(collapseToTop(rows)).toHaveLength(1)
  })
})

describe('applyRecurrences', () => {
  function rule(patch: Partial<Recurrence> = {}): Recurrence {
    return {
      id: 'r1',
      type: 'expense',
      amount: 29900,
      categoryId: 'subscriptions',
      accountId: 'a1',
      period: 'month',
      startDate: '2026-01-15',
      createdAt: '2026-01-15T00:00:00.000Z',
      ...patch,
    }
  }

  it('заводит операции за всё пропущенное время', () => {
    const next = applyRecurrences(data({ recurrences: [rule()] }), '2026-03-20')

    expect(next.operations.map((o) => o.date)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
    expect(next.operations[0].recurrenceId).toBe('r1')
  })

  it('повторный запуск в тот же день ничего не добавляет', () => {
    const once = applyRecurrences(data({ recurrences: [rule()] }), '2026-03-20')
    const twice = applyRecurrences(once, '2026-03-20')

    expect(twice).toBe(once)
    expect(twice.operations).toHaveLength(3)
  })

  it('не возвращает удалённую операцию', () => {
    const created = applyRecurrences(data({ recurrences: [rule()] }), '2026-03-20')
    const withoutFebruary = {
      ...created,
      operations: created.operations.filter((o) => o.date !== '2026-02-15'),
    }

    const next = applyRecurrences(withoutFebruary, '2026-03-25')

    expect(next.operations.map((o) => o.date)).toEqual(['2026-01-15', '2026-03-15'])
  })

  it('молчит про правило на паузе', () => {
    const state = data({ recurrences: [rule({ pausedAt: '2026-01-20T00:00:00.000Z' })] })

    expect(applyRecurrences(state, '2026-03-20').operations).toEqual([])
  })

  it('не списывает с архивного счёта', () => {
    const state = data({
      accounts: [account({ archivedAt: '2026-01-01T00:00:00.000Z' })],
      recurrences: [rule()],
    })

    expect(applyRecurrences(state, '2026-03-20').operations).toEqual([])
  })

  it('не списывает с удалённого счёта', () => {
    const state = data({ accounts: [], recurrences: [rule()] })

    expect(applyRecurrences(state, '2026-03-20').operations).toEqual([])
  })

  it('не заглядывает в будущее', () => {
    const state = data({ recurrences: [rule({ startDate: '2026-06-01' })] })

    expect(applyRecurrences(state, '2026-03-20').operations).toEqual([])
  })

  it('переносит на операцию сумму, счёт и комментарий правила', () => {
    const state = data({ recurrences: [rule({ note: 'Яндекс Плюс', amount: 39900 })] })
    const created = applyRecurrences(state, '2026-01-20').operations[0]

    expect(created).toMatchObject({
      amount: 39900,
      note: 'Яндекс Плюс',
      accountId: 'a1',
      categoryId: 'subscriptions',
      type: 'expense',
    })
  })

  it('заводит повторяющийся перевод обоими концами', () => {
    const state = data({
      accounts: [account(), account({ id: 'a2', title: 'Вклад' })],
      recurrences: [rule({ type: 'transfer', toAccountId: 'a2', amount: 1_000_000 })],
    })

    const created = applyRecurrences(state, '2026-01-20').operations[0]

    expect(created.type).toBe('transfer')
    expect(created.toAccountId).toBe('a2')
  })
})

describe('actions: машина и её журнал', () => {
  /** Действия меняют модульное состояние, а наружу оно видно через хранилище. */
  function afterAction(seed: FinanceData, run: () => void): FinanceData {
    actions.replaceAll(seed)
    run()
    return localStorageAdapter.load()!
  }

  const service = {
    kind: 'service' as const,
    title: 'Замена масла',
    date: '2026-08-02',
    mileage: 87_000,
  }

  it('заводит машину с пустым журналом', () => {
    const next = afterAction(data(), () => actions.addVehicle({ title: 'BMW 320i' }))

    expect(next.vehicles).toHaveLength(1)
    expect(next.vehicles[0].records).toEqual([])
  })

  it('подтягивает пробег из записи, если он вырос', () => {
    const next = afterAction(data(), () => {
      const car = actions.addVehicle({ title: 'BMW 320i', mileage: 84_300 })
      actions.addService(car.id, service)
    })

    expect(next.vehicles[0].mileage).toBe(87_000)
  })

  it('не отматывает пробег назад записью задним числом', () => {
    const next = afterAction(data(), () => {
      const car = actions.addVehicle({ title: 'BMW 320i', mileage: 87_420 })
      actions.addService(car.id, { ...service, date: '2026-05-15', mileage: 84_300 })
    })

    expect(next.vehicles[0].mileage).toBe(87_420)
  })

  it('удаляет машину вместе с журналом', () => {
    const next = afterAction(data(), () => {
      const car = actions.addVehicle({ title: 'BMW 320i' })
      actions.addService(car.id, service)
      actions.deleteVehicle(car.id)
    })

    expect(next.vehicles).toEqual([])
  })

  it('убирает одну запись, не трогая остальные', () => {
    const next = afterAction(data(), () => {
      const car = actions.addVehicle({ title: 'BMW 320i' })
      actions.addService(car.id, service)
      actions.addService(car.id, { ...service, title: 'Тормозные колодки' })
      actions.deleteService(car.id, localStorageAdapter.load()!.vehicles[0].records[0].id)
    })

    expect(next.vehicles[0].records.map((r) => r.title)).toEqual(['Тормозные колодки'])
  })

  it('оставляет машины и объекты при очистке истории операций', () => {
    // Журнал обслуживания — не операции: стирая расходы, человек не просил
    // забыть, что он менял масло.
    const next = afterAction(data({ operations: [operation()] }), () => {
      actions.addVehicle({ title: 'BMW 320i' })
      actions.addProperty({ title: 'Квартира', kind: 'flat', purpose: 'living' })
      actions.clearOperations()
    })

    expect(next.operations).toEqual([])
    expect(next.vehicles).toHaveLength(1)
    expect(next.properties).toHaveLength(1)
  })
})
