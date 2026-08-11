import { describe, expect, it } from 'vitest'
import type { Property } from '../data/types'
import {
  areasLine,
  formatArea,
  formatRooms,
  isContractOver,
  nearestRent,
  nextRentDate,
  parseArea,
  propertySubtitle,
  toAreaInput,
} from './property'

function property(patch: Partial<Property> = {}): Property {
  return {
    id: 'p1',
    title: 'Квартира на Ленина',
    kind: 'flat',
    purpose: 'living',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  }
}

describe('площадь', () => {
  it('прячет нулевую десятую', () => {
    expect(formatArea(620)).toBe('62 м²')
  })

  it('показывает половину метра', () => {
    expect(formatArea(625)).toBe('62,5 м²')
  })

  it('разбирает ввод и с запятой, и с точкой', () => {
    expect(parseArea('62,5')).toBe(625)
    expect(parseArea('62.5')).toBe(625)
  })

  it('не принимает мусор и нули', () => {
    expect(parseArea('')).toBeNull()
    expect(parseArea('много')).toBeNull()
    expect(parseArea('0')).toBeNull()
  })

  it('возвращается в поле ввода без единиц', () => {
    expect(toAreaInput(625)).toBe('62,5')
  })

  it('перечисляет площади двух объектов и складывает площади многих', () => {
    const flats = [property({ area: 620 }), property({ area: 450 })]

    expect(areasLine(flats)).toBe('62 м² + 45 м²')
    expect(areasLine([...flats, property({ area: 300 }), property({ area: 200 })])).toBe('157 м²')
  })

  it('молчит, если площадь нигде не указана', () => {
    expect(areasLine([property()])).toBe('')
  })
})

describe('подпись объекта', () => {
  it('собирает площадь, комнаты и адрес', () => {
    const flat = property({ area: 620, rooms: 3, address: 'Москва' })

    expect(propertySubtitle(flat)).toBe('62 м² · 3 комнаты · Москва')
  })

  it('согласует слово «комната» с числом', () => {
    expect(propertySubtitle(property({ rooms: 1 }))).toBe('1 комната')
    expect(propertySubtitle(property({ rooms: 5 }))).toBe('5 комнат')
  })

  it('называет ноль комнат студией, а не нулём', () => {
    expect(formatRooms(0)).toBe('Студия')
    expect(propertySubtitle(property({ area: 280, rooms: 0 }))).toBe('28 м² · Студия')
  })

  it('молчит, когда комнаты не указаны — это не то же самое, что студия', () => {
    expect(formatRooms(undefined)).toBe('')
  })
})

describe('аренда', () => {
  it('находит ближайшую оплату в этом месяце', () => {
    const flat = property({ purpose: 'rent', rentDay: 20 })

    expect(nextRentDate(flat, '2026-08-11')).toBe('2026-08-20')
  })

  it('считает сегодняшний день ближайшим, а не пропущенным', () => {
    const flat = property({ purpose: 'rent', rentDay: 11 })

    expect(nextRentDate(flat, '2026-08-11')).toBe('2026-08-11')
  })

  it('переносит прошедшую дату на следующий месяц', () => {
    const flat = property({ purpose: 'rent', rentDay: 5 })

    expect(nextRentDate(flat, '2026-08-11')).toBe('2026-09-05')
  })

  it('в коротком месяце съезжает на последний день', () => {
    const flat = property({ purpose: 'rent', rentDay: 31 })

    expect(nextRentDate(flat, '2026-02-15')).toBe('2026-02-28')
  })

  it('не ждёт оплаты от квартиры, в которой живут', () => {
    expect(nextRentDate(property({ rentDay: 10 }), '2026-08-11')).toBeNull()
  })

  it('без дня оплаты напоминать не о чем', () => {
    expect(nextRentDate(property({ purpose: 'rent' }), '2026-08-11')).toBeNull()
  })

  it('видит, что договор кончился', () => {
    const flat = property({ purpose: 'rent', contractUntil: '2026-03-15' })

    expect(isContractOver(flat, '2026-08-11')).toBe(true)
    expect(isContractOver(property({ contractUntil: '2027-03-15' }), '2026-08-11')).toBe(false)
  })

  it('выбирает самую близкую оплату среди объектов', () => {
    const rows = [
      property({ id: 'p1', purpose: 'rent', rentDay: 25 }),
      property({ id: 'p2', purpose: 'rent', rentDay: 15 }),
      property({ id: 'p3', purpose: 'living', rentDay: 12 }),
    ]

    expect(nearestRent(rows, '2026-08-11')?.property.id).toBe('p2')
  })
})
