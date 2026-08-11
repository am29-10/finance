interface ScreenHeaderProps {
  title: string
  onBack: () => void
  /** Кнопка справа — обычно «Изменить». */
  action?: { label: string; onClick: () => void }
}

/**
 * Шапка экрана, открытого поверх главной: стрелка назад, заголовок и одно действие.
 *
 * Вынесена в общий компонент, потому что таких экранов уже несколько — кредиты,
 * счета, машина, недвижимость, — и расползание отступов между ними заметно
 * ровно при переходе с одного на другой.
 */
export function ScreenHeader({ title, onBack, action }: ScreenHeaderProps) {
  return (
    <header className="flex items-center gap-3 py-4">
      <button
        onClick={onBack}
        aria-label="Назад"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface transition-transform active:scale-90"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>

      <h1 className="min-w-0 flex-1 truncate text-[20px] font-bold tracking-tight">{title}</h1>

      {action && (
        <button
          onClick={action.onClick}
          className="shrink-0 text-[15px] font-medium text-brand transition-transform active:scale-95"
        >
          {action.label}
        </button>
      )}
    </header>
  )
}
