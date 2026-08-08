import { accountById, categoryById } from '../data/store'
import type { FinanceData, OperationType } from '../data/types'
import { toDateKey } from './date'

/**
 * Выгрузка операций в CSV, который откроется в Excel без плясок:
 * — разделитель «;», потому что в русской локали Excel запятая внутри чисел;
 * — суммы с запятой как десятичным разделителем;
 * — BOM в начале файла, иначе кириллица превращается в кракозябры.
 */
const TYPE_TITLE: Record<OperationType, string> = {
  income: 'Доход',
  expense: 'Расход',
  transfer: 'Перевод',
}

export function exportCsv(data: FinanceData) {
  const header = ['Дата', 'Тип', 'Категория', 'Сумма', 'Валюта', 'Счёт', 'Куда', 'Комментарий']

  const rows = [...data.operations]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((operation) => {
      const account = accountById(data, operation.accountId)

      return [
        operation.date,
        TYPE_TITLE[operation.type],
        // У перевода категории нет — в таблице она сбивала бы с толку.
        operation.type === 'transfer'
          ? ''
          : (categoryById(data, operation.categoryId)?.title ?? ''),
        (operation.amount / 100).toFixed(2).replace('.', ','),
        account?.currency ?? '',
        account?.title ?? '',
        operation.toAccountId ? (accountById(data, operation.toAccountId)?.title ?? '') : '',
        operation.note ?? '',
      ]
    })

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
