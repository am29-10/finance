import { useEffect, useState } from 'react'
import { PinPad } from './PinPad'
import { checkPin, PIN_LENGTH } from '../lib/pin'

interface LockScreenProps {
  pinHash: string
  onUnlock: () => void
}

export function LockScreen({ pinHash, onUnlock }: LockScreenProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (value.length < PIN_LENGTH) return

    if (checkPin(value, pinHash)) {
      onUnlock()
      return
    }

    // Неверный код: показываем встряску и очищаем поле, чтобы можно было сразу набрать заново.
    setError(true)
    navigator.vibrate?.([40, 60, 40])
    const timer = setTimeout(() => {
      setError(false)
      setValue('')
    }, 500)

    return () => clearTimeout(timer)
  }, [value, pinHash, onUnlock])

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-10">
      <span className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-brand">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="white" strokeWidth={1.9} strokeLinecap="round">
          <path d="M6 19v-6M12 19V9M18 19v-9M4 19h16" />
        </svg>
      </span>

      <PinPad
        title="Введите PIN-код"
        hint={error ? 'Неверный код' : undefined}
        value={value}
        error={error}
        onChange={setValue}
      />
    </div>
  )
}
