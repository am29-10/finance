import { describe, expect, it } from 'vitest'
import { isBackupDue, readBackup } from './backup'
import type { Operation } from '../data/types'

function file(payload: unknown): File {
  return new File([JSON.stringify(payload)], 'finance.json', { type: 'application/json' })
}

function operation(patch: Partial<Operation> = {}): Operation {
  return {
    id: 'o1',
    type: 'expense',
    amount: 50_000,
    categoryId: 'products',
    date: '2026-02-10',
    accountId: 'a1',
    createdAt: '2026-02-10T00:00:00.000Z',
    ...patch,
  }
}

const account = {
  id: 'a1',
  title: 'Сбер',
  kind: 'card',
  currency: 'RUB',
  initialBalance: 0,
  color: '#2e7d6b',
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('readBackup', () => {
  it('читает нормальную копию', async () => {
    const data = await readBackup(
      file({ app: 'finance', operations: [operation()], accounts: [account] }),
    )

    expect(data.operations).toHaveLength(1)
    expect(data.accounts).toHaveLength(1)
  })

  it('отказывается от битого JSON', async () => {
    const broken = new File(['{не json'], 'finance.json', { type: 'application/json' })

    await expect(readBackup(broken)).rejects.toThrow('повреждён')
  })

  it('отказывается от чужого формата', async () => {
    await expect(readBackup(file({ hello: 'world' }))).rejects.toThrow('не похож')
  })

  it('пропускает битые операции, сохраняя целые', async () => {
    const data = await readBackup(
      file({
        operations: [
          operation(),
          { id: 'bad', type: 'expense' },
          operation({ id: 'o2', amount: 12.5 }),
          operation({ id: 'o3', date: '10.02.2026' }),
        ],
        accounts: [account],
      }),
    )

    expect(data.operations.map((o) => o.id)).toEqual(['o1'])
  })

  it('переселяет историю на счёт по умолчанию, если счетов в копии нет', async () => {
    const data = await readBackup(file({ operations: [operation({ accountId: undefined })] }))

    expect(data.accounts).toHaveLength(1)
    expect(data.operations[0].accountId).toBe(data.accounts[0].id)
  })

  it('не заводит счёт для копии без операций', async () => {
    const data = await readBackup(file({ operations: [] }))

    expect(data.accounts).toEqual([])
  })

  it('чинит ссылку на счёт, которого в копии нет', async () => {
    const data = await readBackup(
      file({ operations: [operation({ accountId: 'потерянный' })], accounts: [account] }),
    )

    expect(data.operations[0].accountId).toBe('a1')
  })

  it('переносит правила повтора', async () => {
    const data = await readBackup(
      file({
        operations: [],
        accounts: [account],
        recurrences: [
          {
            id: 'r1',
            type: 'expense',
            amount: 29900,
            categoryId: 'subscriptions',
            accountId: 'a1',
            period: 'month',
            startDate: '2026-01-15',
            createdAt: '2026-01-15T00:00:00.000Z',
          },
        ],
      }),
    )

    expect(data.recurrences).toHaveLength(1)
  })

  it('выбрасывает правило, ссылающееся на несуществующий счёт', async () => {
    const data = await readBackup(
      file({
        operations: [],
        accounts: [account],
        recurrences: [
          {
            id: 'r1',
            type: 'expense',
            amount: 29900,
            categoryId: 'subscriptions',
            accountId: 'нет такого',
            period: 'month',
            startDate: '2026-01-15',
            createdAt: '2026-01-15T00:00:00.000Z',
          },
        ],
      }),
    )

    expect(data.recurrences).toEqual([])
  })

  it('принимает копию, снятую до появления кредитов и повторов', async () => {
    const data = await readBackup(file({ operations: [operation()], accounts: [account] }))

    expect(data.loans).toEqual([])
    expect(data.recurrences).toEqual([])
  })
})

describe('isBackupDue', () => {
  const now = new Date(2026, 1, 3)

  it('молчит, пока операций нет', () => {
    expect(isBackupDue({}, [], now)).toBe(false)
  })

  it('просит копию в новом месяце, если её ещё не делали', () => {
    const operations = [operation({ createdAt: '2026-01-10T00:00:00.000Z' })]

    expect(isBackupDue({}, operations, now)).toBe(true)
  })

  it('не пристаёт к тому, кто начал вести учёт в этом же месяце', () => {
    const operations = [operation({ createdAt: '2026-02-01T00:00:00.000Z' })]

    expect(isBackupDue({}, operations, now)).toBe(false)
  })

  it('молчит, если копия за этот месяц уже есть', () => {
    const operations = [operation({ createdAt: '2026-01-10T00:00:00.000Z' })]

    expect(isBackupDue({ lastBackupAt: '2026-02-01T00:00:00.000Z' }, operations, now)).toBe(false)
  })

  it('уважает отложенное напоминание три дня', () => {
    const operations = [operation({ createdAt: '2026-01-10T00:00:00.000Z' })]

    expect(isBackupDue({ backupRemindedAt: '2026-02-02T00:00:00.000Z' }, operations, now)).toBe(false)
    expect(isBackupDue({ backupRemindedAt: '2026-01-20T00:00:00.000Z' }, operations, now)).toBe(true)
  })
})
