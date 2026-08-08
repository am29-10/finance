import type { Category } from './types'

/**
 * Категории из ТЗ (разделы 3.2 и 3.3).
 *
 * Цвета: первые четыре расходные — валидированная палитра для диаграмм
 * (оранжевый, фиолетовый, розовый, бирюзовый различимы в том числе при дальтонизме).
 * Остальные получают производные оттенки: в списках они разделены текстом,
 * а в кольцевой диаграмме показываются только пять сегментов — топ-4 и «Другое».
 * Доходные все зелёные — доход в интерфейсе всегда зелёный.
 */

/**
 * Категория, в которую падают платежи по кредитам.
 * Вынесена в константу: на неё ссылается синхронизация графиков, а опечатка
 * в строке увела бы платёж по ипотеке в «Другое» без единой ошибки.
 */
export const LOAN_CATEGORY_ID = 'loans'

const EXPENSES: Array<[string, string, string, string]> = [
  ['products', 'Продукты', 'cart', '#f97316'],
  ['transport', 'Транспорт', 'bus', '#7c6cf2'],
  ['cafe', 'Кафе', 'cup', '#ec4899'],
  ['home', 'Жильё', 'home', '#0d9488'],
  ['restaurants', 'Рестораны', 'dish', '#db2777'],
  ['fun', 'Развлечения', 'ticket', '#a855f7'],
  ['subscriptions', 'Подписки', 'repeat', '#6366f1'],
  ['utilities', 'Коммунальные услуги', 'bulb', '#0891b2'],
  ['internet', 'Интернет', 'wifi', '#0ea5e9'],
  ['phone', 'Телефон', 'phone', '#3b82f6'],
  ['shopping', 'Покупки', 'bag', '#f43f5e'],
  ['health', 'Здоровье', 'heart', '#f44336'],
  ['sport', 'Спорт', 'dumbbell', '#65a30d'],
  ['education', 'Образование', 'book', '#ca8a04'],
  ['travel', 'Путешествия', 'plane', '#8b5cf6'],
  [LOAN_CATEGORY_ID, 'Кредиты и ипотека', 'bank', '#7c3aed'],
  ['other-expense', 'Другое', 'dots', '#94a3b8'],
]

const INCOMES: Array<[string, string, string, string]> = [
  ['salary', 'Зарплата', 'wallet', '#4caf50'],
  ['freelance', 'Фриланс', 'laptop', '#22c55e'],
  ['business', 'Бизнес', 'briefcase', '#16a34a'],
  ['investments', 'Инвестиции', 'chart', '#059669'],
  ['gift', 'Подарок', 'gift', '#34d399'],
  ['other-income', 'Другое', 'dots', '#6ee7b7'],
]

export function defaultCategories(): Category[] {
  return [
    ...EXPENSES.map(([id, title, icon, color]) => ({
      id,
      title,
      icon,
      color,
      type: 'expense' as const,
      builtin: true,
    })),
    ...INCOMES.map(([id, title, icon, color]) => ({
      id,
      title,
      icon,
      color,
      type: 'income' as const,
      builtin: true,
    })),
  ]
}

/** Та же категория отдельно — для баз, созданных до появления кредитов. */
export function loanCategory(): Category {
  const [id, title, icon, color] = EXPENSES.find(([key]) => key === LOAN_CATEGORY_ID)!
  return { id, title, icon, color, type: 'expense', builtin: true }
}

/** Куда попадают операции, чья категория была удалена. */
export const FALLBACK_CATEGORY: Record<'income' | 'expense', string> = {
  expense: 'other-expense',
  income: 'other-income',
}
