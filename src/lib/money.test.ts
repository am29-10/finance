import { describe, expect, it } from 'vitest'
import { formatAmountInput, formatCompact, formatMoney, parseAmount, toAmountInput } from './money'

/** Intl ставит неразрывный пробел — сравнивать удобнее по обычному. */
const plain = (value: string) => value.replace(/ | /g, ' ')

describe('formatMoney', () => {
  it('показывает целые рубли с разделителями разрядов', () => {
    expect(plain(formatMoney(12_505_000))).toBe('125 050 ₽')
  })

  it('округляет копейки, а не отбрасывает их', () => {
    expect(plain(formatMoney(14_999))).toBe('150 ₽')
  })

  it('ставит минус у отрицательных всегда, а плюс — по просьбе', () => {
    expect(plain(formatMoney(-50_000))).toBe('−500 ₽')
    expect(plain(formatMoney(50_000, { sign: true }))).toBe('+500 ₽')
    expect(plain(formatMoney(50_000))).toBe('500 ₽')
  })

  it('уважает валюту счёта', () => {
    expect(plain(formatMoney(2500, { currency: 'USD' }))).toBe('25 $')
  })
})

describe('formatCompact', () => {
  it('сокращает тысячи для осей графика', () => {
    expect(formatCompact(5_625_000)).toBe('56k')
    expect(formatCompact(45_000)).toBe('450')
  })
})

describe('parseAmount', () => {
  it('переводит ввод в копейки', () => {
    expect(parseAmount('1250')).toBe(125_000)
  })

  it('не спотыкается о пробелы-разделители', () => {
    expect(parseAmount('1 250')).toBe(125_000)
    expect(parseAmount('1 250')).toBe(125_000)
  })

  it('отвергает пустое, ноль и всё, что не сумма', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('12,5')).toBeNull()
    expect(parseAmount('сто')).toBeNull()
  })
})

describe('formatAmountInput', () => {
  it('расставляет разряды по мере набора', () => {
    expect(formatAmountInput('1250')).toBe('1 250')
    expect(formatAmountInput('1250000')).toBe('1 250 000')
  })

  it('выбрасывает всё, кроме цифр', () => {
    expect(formatAmountInput('12a5b0')).toBe('1 250')
  })
})

describe('toAmountInput', () => {
  it('возвращает в поле целые рубли', () => {
    expect(toAmountInput(125_000)).toBe('1 250')
  })

  it('округляет копейки, а не умножает сумму в сто раз', () => {
    expect(toAmountInput(14_999)).toBe('150')
  })
})
