import type { DateKey } from '../data/types'
import { formatFullDate } from '../lib/date'

interface DateInputProps {
  value: DateKey | ''
  onChange: (value: DateKey) => void
  /** Что показать, когда дата не выбрана. Без него поле пустым не бывает. */
  placeholder?: string
}

/**
 * Поле даты.
 *
 * Родное поле браузера показывает дату как «02.08.2026» и на разных телефонах
 * по-разному, поэтому поверх него лежит наша подпись — «2 августа 2026», — а
 * само поле остаётся под ней и открывает привычный календарь по нажатию.
 *
 * Поле занимает всю ширину и в строку с соседями не ставится: у календаря
 * есть собственная минимальная ширина, сжать ниже которой браузер его не даёт,
 * и в паре с соседним полем строка выезжает за край шторки.
 */
export function DateInput({ value, onChange, placeholder }: DateInputProps) {
  return (
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={(e) => {
          // Пустое значение приходит, когда дату стирают в календаре. Для
          // обязательной даты это означало бы «нет дня» — такое не пропускаем.
          if (e.target.value || placeholder) onChange(e.target.value)
        }}
        className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none"
      />

      <span className="pointer-events-none absolute inset-y-0 right-3 left-4 flex items-center bg-surface text-[17px]">
        <span className={`truncate ${value ? '' : 'text-muted'}`}>
          {value ? formatFullDate(value) : placeholder}
        </span>
      </span>
    </div>
  )
}
