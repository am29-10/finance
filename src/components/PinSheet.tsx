import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { PinPad } from './PinPad'
import { actions } from '../data/store'
import { hashPin, PIN_LENGTH } from '../lib/pin'

interface PinSheetProps {
  open: boolean
  onClose: () => void
}

/** Установка нового кода: сначала ввод, затем повтор для проверки. */
export function PinSheet({ open, onClose }: PinSheetProps) {
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [error, setError] = useState(false)

  const stage = first.length < PIN_LENGTH ? 'first' : 'second'

  useEffect(() => {
    if (stage !== 'second' || second.length < PIN_LENGTH) return

    if (second === first) {
      actions.updateSettings({ pinHash: hashPin(second) })
      onClose()
      return
    }

    setError(true)
    navigator.vibrate?.([40, 60, 40])
    const timer = setTimeout(() => {
      setError(false)
      setFirst('')
      setSecond('')
    }, 500)

    return () => clearTimeout(timer)
  }, [second, first, stage, onClose])

  return (
    <Sheet open={open} onClose={onClose} title="PIN-код">
      <div className="pb-4">
        <PinPad
          title={stage === 'first' ? 'Придумайте код' : 'Повторите код'}
          hint={error ? 'Коды не совпали' : 'Четыре цифры'}
          value={stage === 'first' ? first : second}
          error={error}
          onChange={stage === 'first' ? setFirst : setSecond}
        />
      </div>
    </Sheet>
  )
}
