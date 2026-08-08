import { useState } from 'react'
import type { CategoryTotal } from '../data/store'
import { formatMoney } from '../lib/money'

interface DonutChartProps {
  rows: CategoryTotal[]
}

const SIZE = 156
const STROKE = 18
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Зазор между сегментами в пикселях дуги — чтобы соседние цвета не сливались. */
const GAP = 3

export function DonutChart({ rows }: DonutChartProps) {
  // Выделенный сегмент показывается в центре; по умолчанию — общая сумма.
  const [selected, setSelected] = useState<number | null>(null)

  const total = rows.reduce((acc, row) => acc + row.amount, 0)
  const active = selected !== null ? rows[selected] : undefined

  let offset = 0

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          {rows.map((row, index) => {
            const length = row.share * CIRCUMFERENCE
            const dash = Math.max(length - GAP, 1)
            const circle = (
              <circle
                key={row.category.id}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={row.category.color}
                strokeWidth={selected === index ? STROKE + 4 : STROKE}
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={-offset}
                style={{
                  transition: 'stroke-width 0.2s var(--ease-ios)',
                  opacity: selected === null || selected === index ? 1 : 0.35,
                  cursor: 'pointer',
                }}
                onClick={() => setSelected(selected === index ? null : index)}
              />
            )
            offset += length
            return circle
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-[19px] font-bold tabular-nums">
            {formatMoney(active ? active.amount : total)}
          </span>
          <span className="mt-0.5 line-clamp-2 text-[12px] leading-tight text-muted">
            {active ? active.category.title : 'Расходы'}
          </span>
        </div>
      </div>

      {/* Легенда обязательна: цвет один не должен быть единственным способом различить категории. */}
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.category.id}>
            <button
              onClick={() => setSelected(selected === index ? null : index)}
              className="flex w-full items-center gap-2 text-left"
              style={{ opacity: selected === null || selected === index ? 1 : 0.45 }}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.category.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px]">{row.category.title}</span>
              <span className="shrink-0 text-[13px] tabular-nums text-muted">
                {Math.round(row.share * 100)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
