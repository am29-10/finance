interface FieldProps {
  label: string
  optional?: boolean
  /** Подсказка под полем: зачем оно и что будет, если ошибиться. */
  hint?: string
  children: React.ReactNode
}

/** Подпись над полем формы. Общая для всех шторок, чтобы отступы не разъезжались. */
export function Field({ label, optional, hint, children }: FieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {optional && <span className="text-[11px] text-muted opacity-60">необязательно</span>}
      </div>
      {children}
      {hint && <p className="mt-2 px-1 text-[12px] leading-snug text-muted">{hint}</p>}
    </div>
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}

/** Переключатель на 2–4 варианта. Всё, что не влезает, должно быть списком, а не сегментами. */
export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="flex gap-1.5 rounded-2xl bg-surface p-1.5">
      {options.map((option) => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className="flex-1 rounded-xl px-2 py-2.5 text-[14px] font-semibold transition-all duration-200"
            style={{
              backgroundColor: active ? '#2e7d6b14' : 'transparent',
              color: active ? 'var(--color-brand)' : 'var(--color-muted)',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface ToggleRowProps {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ToggleRow({ label, hint, checked, onChange }: ToggleRowProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left"
    >
      <span className="flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-snug text-muted">{hint}</span>}
      </span>

      <span
        className="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200"
        style={{ backgroundColor: checked ? 'var(--color-brand)' : '#d6dbe1' }}
      >
        <span
          className="absolute top-[3px] size-6 rounded-full bg-white shadow transition-all duration-200 ease-[var(--ease-ios)]"
          style={{ left: checked ? 23 : 3 }}
        />
      </span>
    </button>
  )
}
