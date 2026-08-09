import { useEffect, useState } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

/** Шторка снизу. Закрывается тапом по фону или крестиком. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  // Держим смонтированной ещё 240 мс после закрытия, иначе анимация ухода не успеет проиграть.
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      return
    }
    setClosing(true)
    const timer = setTimeout(() => setMounted(false), 240)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/35 backdrop-blur-sm ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      />

      <div
        className={`relative mx-auto flex max-h-[94vh] w-full max-w-lg flex-col rounded-t-[28px] bg-bg ${closing ? 'animate-sheet-out' : 'animate-sheet-in'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex shrink-0 items-center gap-3 px-5 pt-4 pb-3">
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="flex size-9 items-center justify-center rounded-full bg-surface transition-transform active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <h2 className="flex-1 text-center text-[17px] font-semibold">{title}</h2>
          {/* Пустой блок уравновешивает крестик, чтобы заголовок был ровно по центру. */}
          <span className="size-9" />
        </div>

        {/*
          overflow-x задан явно, и это не перестраховка. Стоит объявить прокрутку
          по одной оси, как вторая перестаёт быть visible и тоже становится
          прокручиваемой — шторка превращается в собственный контейнер прокрутки
          внутри страницы, до которого общий запрет на документе не достаёт.
          Заметно это ровно при заполнении формы: коснувшись поля, браузер сам
          подтягивает его в видимую область и заодно возит содержимое вбок.
        */}
        <div className="overflow-y-auto overflow-x-clip px-5 pb-5">{children}</div>
      </div>
    </div>
  )
}
