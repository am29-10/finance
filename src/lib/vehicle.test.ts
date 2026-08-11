import { describe, expect, it } from 'vitest'
import type { ServiceRecord, Vehicle } from '../data/types'
import {
  currentMileage,
  formatKm,
  nearestService,
  parseKm,
  sortedRecords,
  upcomingServices,
  vehicleSubtitle,
} from './vehicle'

/** Intl ставит неразрывный пробел — сравнивать удобнее по обычному. */
const plain = (value: string) => value.replace(/\s/g, ' ')

function record(patch: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    id: 'r1',
    kind: 'service',
    title: 'Замена масла',
    date: '2026-08-02',
    createdAt: '2026-08-02T10:00:00.000Z',
    ...patch,
  }
}

function vehicle(patch: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    title: 'BMW 320i',
    records: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  }
}

describe('пробег', () => {
  it('показывает километры с разделителями разрядов', () => {
    expect(plain(formatKm(87_420))).toBe('87 420 км')
  })

  it('разбирает ввод с пробелами', () => {
    expect(parseKm('87 420')).toBe(87_420)
  })

  it('не принимает буквы, ноль и невозможные числа', () => {
    expect(parseKm('сто')).toBeNull()
    expect(parseKm('0')).toBeNull()
    expect(parseKm('')).toBeNull()
    expect(parseKm('99999999')).toBeNull()
  })

  it('берёт самую свежую отметку, если в карточке число меньше', () => {
    // В сервисе записали 87 000, а в карточке с прошлого года 84 300:
    // показывать надо большее, иначе напоминание сработает не вовремя.
    const car = vehicle({ mileage: 84_300, records: [record({ mileage: 87_000 })] })

    expect(currentMileage(car)).toBe(87_000)
  })

  it('обходится без пробега вовсе', () => {
    expect(currentMileage(vehicle())).toBeUndefined()
  })
})

describe('журнал', () => {
  it('ставит свежие записи сверху, а внутри дня — последнюю добавленную', () => {
    const car = vehicle({
      records: [
        record({ id: 'старая', date: '2026-02-10' }),
        record({ id: 'первая-за-день', date: '2026-08-02', createdAt: '2026-08-02T09:00:00.000Z' }),
        record({ id: 'вторая-за-день', date: '2026-08-02', createdAt: '2026-08-02T18:00:00.000Z' }),
      ],
    })

    expect(sortedRecords(car).map((r) => r.id)).toEqual([
      'вторая-за-день',
      'первая-за-день',
      'старая',
    ])
  })
})

describe('напоминания', () => {
  it('не берёт записи без следующего срока', () => {
    const car = vehicle({ mileage: 87_000, records: [record()] })

    expect(upcomingServices(car, '2026-08-11')).toEqual([])
  })

  it('считает срок наступившим, когда пробег добран', () => {
    const car = vehicle({ mileage: 97_500, records: [record({ nextMileage: 97_000 })] })
    const [due] = upcomingServices(car, '2026-08-11')

    expect(due.overdue).toBe(true)
    expect(due.kmLeft).toBe(-500)
  })

  it('предупреждает заранее, когда до срока меньше тысячи километров', () => {
    const car = vehicle({ mileage: 96_500, records: [record({ nextMileage: 97_000 })] })
    const [due] = upcomingServices(car, '2026-08-11')

    expect(due.overdue).toBe(false)
    expect(due.soon).toBe(true)
  })

  it('молчит, пока до срока далеко', () => {
    const car = vehicle({ mileage: 87_000, records: [record({ nextMileage: 97_000 })] })
    const [due] = upcomingServices(car, '2026-08-11')

    expect(due.overdue).toBe(false)
    expect(due.soon).toBe(false)
  })

  it('срабатывает по дате, даже если по пробегу ещё рано', () => {
    // Страховку и ТО делают по календарю, и пробег их не отменяет.
    const car = vehicle({
      mileage: 87_000,
      records: [record({ nextMileage: 97_000, nextDate: '2026-08-01' })],
    })

    expect(upcomingServices(car, '2026-08-11')[0].overdue).toBe(true)
  })

  it('считает сегодняшний срок наступившим', () => {
    const car = vehicle({ records: [record({ nextDate: '2026-08-11' })] })
    const [due] = upcomingServices(car, '2026-08-11')

    expect(due.daysLeft).toBe(0)
    expect(due.overdue).toBe(true)
  })

  it('ставит просроченное впереди близкого', () => {
    const car = vehicle({
      mileage: 87_000,
      records: [
        record({ id: 'далёкая', nextMileage: 120_000 }),
        record({ id: 'просроченная', nextMileage: 80_000 }),
        record({ id: 'скорая', nextMileage: 87_500 }),
      ],
    })

    expect(upcomingServices(car, '2026-08-11').map((row) => row.record.id)).toEqual([
      'просроченная',
      'скорая',
      'далёкая',
    ])
  })

  it('не считает пробег, если его негде взять', () => {
    const car = vehicle({ records: [record({ nextMileage: 97_000 })] })
    const [due] = upcomingServices(car, '2026-08-11')

    expect(due.kmLeft).toBeUndefined()
    expect(due.overdue).toBe(false)
  })

  it('выбирает самое срочное среди всех машин', () => {
    const first = vehicle({ id: 'v1', mileage: 87_000, records: [record({ nextMileage: 97_000 })] })
    const second = vehicle({
      id: 'v2',
      mileage: 40_000,
      records: [record({ id: 'r2', nextMileage: 39_000 })],
    })

    expect(nearestService([first, second], '2026-08-11')?.vehicle.id).toBe('v2')
  })

  it('без машин напоминать не о чем', () => {
    expect(nearestService([], '2026-08-11')).toBeNull()
  })
})

describe('подпись машины', () => {
  it('собирает год и пробег', () => {
    const car = vehicle({ year: 2021, mileage: 87_420 })

    expect(plain(vehicleSubtitle(car))).toBe('2021 год · 87 420 км')
  })

  it('показывает номер, когда больше сказать нечего', () => {
    expect(vehicleSubtitle(vehicle({ plate: 'А123ВС777' }))).toBe('А123ВС777')
  })
})
