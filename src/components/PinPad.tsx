import { PIN_LENGTH } from '../lib/pin'

interface PinPadProps {
  title: string
  hint?: string
  value: string
  error?: boolean
  onChange: (value: string) => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

/** Цифровая клавиатура: своя, а не системная — так экран блокировки не зависит от раскладки. */
export function PinPad({ title, hint, value, error, onChange }: PinPadProps) {
  function press(key: string) {
    if (key === '⌫') {
      onChange(value.slice(0, -1))
      return
    }
    if (!key || value.length >= PIN_LENGTH) return

    navigator.vibrate?.(8)
    onChange(value + key)
  }

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-[19px] font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-[14px] text-muted">{hint}</p>}

      <div className={`mt-6 flex gap-3 ${error ? 'animate-shake' : ''}`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className="size-3.5 rounded-full transition-all duration-200"
            style={{
              backgroundColor: error
                ? 'var(--color-danger)'
                : i < value.length
                  ? 'var(--color-brand)'
                  : 'var(--color-line)',
            }}
          />
        ))}
      </div>

      <div className="mt-8 grid w-full max-w-[264px] grid-cols-3 gap-3">
        {KEYS.map((key, index) => (
          <button
            key={index}
            onClick={() => press(key)}
            disabled={!key}
            className="flex h-16 items-center justify-center rounded-2xl bg-surface text-[24px] font-medium transition-transform duration-150 active:scale-90 disabled:bg-transparent"
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}
