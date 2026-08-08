/**
 * Иконки категорий — простые линейные глифы 24×24.
 * Ключ хранится в категории строкой, чтобы иконку можно было менять,
 * не трогая сами операции.
 */
const PATHS: Record<string, string> = {
  cart: 'M4 5h2l2.2 9.2a2 2 0 0 0 2 1.5h6.9a2 2 0 0 0 2-1.5L21 8H7M10 20h.01M17 20h.01',
  bus: 'M5 16V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v9M5 16h14M5 16v2M19 16v2M5 11h14M8 19h.01M16 19h.01',
  cup: 'M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8ZM16 9h2a2 2 0 0 1 0 4h-2M4 21h13',
  home: 'M4 11 12 4l8 7M6 10v9h12v-9M10 19v-5h4v5',
  dish: 'M4 12a8 8 0 0 1 16 0M3 12h18M6 16h12',
  ticket: 'M4 9V7h16v2a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4ZM12 8v1M12 12v1M12 16v1',
  repeat: 'M4 9a5 5 0 0 1 5-5h7l-2-2M20 15a5 5 0 0 1-5 5H8l2 2M16 4l-2 2M8 20l2-2',
  bulb: 'M9 17h6M10 21h4M12 3a6 6 0 0 0-3 11v3h6v-3a6 6 0 0 0-3-11Z',
  wifi: 'M3 9a15 15 0 0 1 18 0M6 13a10 10 0 0 1 12 0M9.5 16.5a5 5 0 0 1 5 0M12 20h.01',
  phone: 'M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM11 18h2',
  bag: 'M6 8h12l1 12H5L6 8ZM9 8V6a3 3 0 0 1 6 0v2',
  heart: 'M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z',
  dumbbell: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
  book: 'M5 5a2 2 0 0 1 2-2h11v16H7a2 2 0 0 0-2 2V5ZM7 19h11',
  plane: 'M3 13l18-7-4 14-4-5-6-1 2 5',
  dots: 'M7 12h.01M12 12h.01M17 12h.01',
  wallet: 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8ZM16 13h2M4 9h16',
  laptop: 'M6 6h12v9H6zM3 18h18',
  briefcase: 'M4 9h16v10H4zM9 9V6h6v3M4 13h16',
  chart: 'M5 19V11M12 19V5M19 19v-6M4 19h16',
  gift: 'M4 11h16v9H4zM4 8h16v3H4zM12 8v12M9 8a2.5 2.5 0 0 1 0-5c2 0 3 5 3 5M15 8a2.5 2.5 0 0 0 0-5c-2 0-3 5-3 5',
  bank: 'M3 9.5 12 4l9 5.5M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18',
  key: 'M14.5 4a5.5 5.5 0 1 1-4.3 8.9L4 19.1V21h2.6l1-1h2v-2h2l1.2-1.2A5.5 5.5 0 0 1 14.5 4ZM16 8.5h.01',
}

interface CategoryIconProps {
  icon: string
  color: string
  size?: number
}

export function CategoryIcon({ icon, color, size = 44 }: CategoryIconProps) {
  const path = PATHS[icon] ?? PATHS.dots

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-2xl"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size * 0.5, height: size * 0.5 }}
      >
        <path d={path} />
      </svg>
    </span>
  )
}
