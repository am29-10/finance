/**
 * Согласование существительного с числом: 1 платёж, 2 платежа, 5 платежей.
 * Без этого интерфейс сыплет «5 платёж» и выглядит машинным переводом.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100
  if (mod100 >= 11 && mod100 <= 14) return many

  const mod10 = mod100 % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
