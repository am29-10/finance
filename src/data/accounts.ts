import { BASE_CURRENCY } from '../lib/currency'
import type { Account, AccountKind } from './types'

/**
 * Счета создаёт сам человек — банки, наличные, вклады, валютные кошельки.
 * Здесь только то, что нужно для их создания и для первого запуска.
 */

export const ACCOUNT_KINDS: Array<{ value: AccountKind; label: string; icon: string }> = [
  { value: 'card', label: 'Карта', icon: 'wallet' },
  { value: 'bank', label: 'Счёт в банке', icon: 'bank' },
  { value: 'cash', label: 'Наличные', icon: 'cash' },
  { value: 'deposit', label: 'Вклад', icon: 'safe' },
  { value: 'other', label: 'Другое', icon: 'dots' },
]

export function accountIcon(kind: AccountKind): string {
  return ACCOUNT_KINDS.find((k) => k.value === kind)?.icon ?? 'wallet'
}

/**
 * Палитра для счетов. Отличается от категорийной: счета и категории
 * встречаются на одном экране, и одинаковые цвета читались бы как связь,
 * которой нет.
 */
export const ACCOUNT_COLORS = [
  '#2e7d6b',
  '#1d4ed8',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#0f766e',
  '#475569',
]

export const DEFAULT_ACCOUNT_ID = 'main'

/**
 * Счёт, который получают все, кто пользовался приложением до появления счетов.
 * Вся прежняя история переезжает на него: операция без счёта не имела бы
 * остатка и выпадала бы из баланса.
 */
export function defaultAccount(): Account {
  return {
    id: DEFAULT_ACCOUNT_ID,
    title: 'Основной',
    kind: 'card',
    currency: BASE_CURRENCY,
    initialBalance: 0,
    color: ACCOUNT_COLORS[0],
    createdAt: new Date().toISOString(),
  }
}
