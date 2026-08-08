export const TAB_IDS = ['home', 'operations', 'analytics', 'profile'] as const

export type TabId = (typeof TAB_IDS)[number]

interface TabBarProps {
  active: TabId
  onChange: (tab: TabId) => void
  onAdd: () => void
}

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'size-6',
}

const TABS: Array<{ id: TabId; label: string; path: string }> = [
  { id: 'home', label: 'Главная', path: 'M4 11 12 4l8 7M6 10v9h12v-9' },
  {
    id: 'operations',
    label: 'Операции',
    path: 'M5 4h11l3 3v13H5zM8 10h8M8 14h5',
  },
  { id: 'analytics', label: 'Аналитика', path: 'M6 19v-6M12 19V5M18 19v-9' },
  {
    id: 'profile',
    label: 'Профиль',
    path: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20a7 7 0 0 1 14 0',
  },
]

export function TabBar({ active, onChange, onAdd }: TabBarProps) {
  // Кнопка добавления живёт по центру между второй и третьей вкладкой — как в макете.
  const left = TABS.slice(0, 2)
  const right = TABS.slice(2)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative mx-auto flex max-w-lg items-center">
        {left.map((tab) => (
          <TabButton key={tab.id} tab={tab} active={active === tab.id} onClick={onChange} />
        ))}

        <div className="flex flex-1 justify-center">
          <button
            onClick={onAdd}
            aria-label="Добавить операцию"
            className="-mt-7 flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 transition-transform duration-200 active:scale-90"
          >
            <svg {...iconProps} className="size-7" strokeWidth={2.4}>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {right.map((tab) => (
          <TabButton key={tab.id} tab={tab} active={active === tab.id} onClick={onChange} />
        ))}
      </div>
    </nav>
  )
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: { id: TabId; label: string; path: string }
  active: boolean
  onClick: (id: TabId) => void
}) {
  return (
    <button
      onClick={() => onClick(tab.id)}
      className="flex flex-1 flex-col items-center gap-1 py-2.5 transition-transform duration-200 active:scale-90"
      style={{ color: active ? 'var(--color-brand)' : 'var(--color-muted)' }}
    >
      <svg {...iconProps}>
        <path d={tab.path} />
      </svg>
      <span className="text-[10px] font-medium">{tab.label}</span>
    </button>
  )
}
