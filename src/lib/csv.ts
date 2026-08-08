import { categoryById } from '../data/store'
import type { FinanceData } from '../data/types'
import { toDateKey } from './date'

/**
 * Выгрузка операций в CSV, который откроется в Excel без плясок:
 * — разделитель «;», потому что в русской локали Excel запятая внутри чисел;
 * — суммы с запятой как десятичным разделителем;
 * — BOM в начале файла, иначе кириллица превращается в кракозябры.
 */
export function exportCsv(data: FinanceData) {
  const header = ['Дата', 'Тип', 'Категория', 'Сумма', 'Комментарий']

  const rows = [...data.operations]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((operation) => [
      operation.date,
      operation.type === 'income' ? 'Доход' : 'Расход',
      categoryById(data, operation.categoryId)?.title ?? '',
      (operation.amount / 100).toFixed(2).replace('.', ','),
      operation.note ?? '',
    ])

  const csv = [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')

  download(`﻿${csv}`, `operations-${toDateKey(new Date())}.csv`, 'text/csv;charset=utf-8')
}

function escape(value: string): string {
  // Кавычки, точки с запятой и переносы строк ломают разбор — экранируем по правилам CSV.
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}
