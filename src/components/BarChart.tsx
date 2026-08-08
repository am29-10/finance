import { useState } from 'react'
import type { Point } from '../lib/analytics'
import { formatCompact, formatMoney } from '../lib/money'

interface BarChartProps {
  points: Point[]
  color: string
}

const HEIGHT = 104

/**
 * Один ряд значений по времени. Легенда не нужна — заголовок карточки называет ряд.
 * Значение показывается только для выбранного столбика, а не подписью над каждым.
 */
export function BarChart({ points, color }: BarChartProps) {
  const [selected, setSelected] = useState<number | null>(null)

  const max = Math.max(...points.map((p) => p.amount), 1)
  const active = selected !== null ? points[selected] : null

  return (
    <div>
      <div className="mb-1 h-5 text-right text-[12px] text-muted">
        {active ? `${active.full} — ${formatMoney(active.amount)}` : formatCompact(max)}
      </div>

      <div className="flex items-end gap-[2px]" style={{ height: HEIGHT }}>
        {points.map((point, index) => {
          const isActive = selected === index
          // Ненулевая, но крошечная сумма всё равно должна быть заметна.
          const height = point.amount === 0 ? 2 : Math.max((point.amount / max) * HEIGHT, 4)

          return (
            <button
              key={index}
              onClick={() => setSelected(isActive ? null : index)}
              aria-label={`${point.full}: ${formatMoney(point.amount)}`}
              className="relative flex-1 self-stretch"
            >
              <span
                className="absolute inset-x-0 bottom-0 rounded-t-[3px] transition-all duration-300 ease-[var(--ease-ios)]"
                style={{
                  height,
                  backgroundColor: point.amount === 0 ? 'var(--color-line)' : color,
                  opacity: selected === null || isActive ? 1 : 0.35,
                }}
              />
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{points[0]?.label}</span>
        <span>{points[Math.floor(points.length / 2)]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  )
}
