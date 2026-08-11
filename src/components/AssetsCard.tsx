import { CategoryIcon } from './CategoryIcon'
import type { DateKey, Property, Vehicle } from '../data/types'
import { formatDayHeading, fromDateKey, todayKey } from '../lib/date'
import { plural } from '../lib/text'
import { areasLine, nearestRent } from '../lib/property'
import { currentMileage, formatKm, nearestService } from '../lib/vehicle'

interface AssetsCardProps {
  vehicles: Vehicle[]
  properties: Property[]
  onOpenVehicles: () => void
  onOpenProperties: () => void
}

const CAR_COLOR = '#0891b2'
const HOME_COLOR = '#0d9488'

/**
 * «Мои активы» на главной — две плитки, за которыми лежат справочники вещей.
 *
 * Ни машина, ни квартира в баланс не входят и входить не должны: приложение
 * считает деньги, а не имущество, и оценка квартиры, вбитая однажды, устарела
 * бы в тот же месяц. Плитки стоят на главной только затем, чтобы до этих
 * разделов было одно нажатие, — и потому показывают не стоимость, а то,
 * что человек про них помнит: пробег и площадь.
 */
export function AssetsCard({
  vehicles,
  properties,
  onOpenVehicles,
  onOpenProperties,
}: AssetsCardProps) {
  const due = nearestService(vehicles)

  return (
    <section>
      <h2 className="mb-2 px-1 text-[15px] font-semibold">Мои активы</h2>

      <div className="flex gap-2.5">
        <Tile
          icon="car"
          color={CAR_COLOR}
          title="Машина"
          lines={vehicleLines(vehicles)}
          empty={vehicles.length === 0}
          alert={due?.due.overdue ? 'Пора в сервис' : undefined}
          onClick={onOpenVehicles}
        />
        <Tile
          icon="building"
          color={HOME_COLOR}
          title="Недвижимость"
          lines={propertyLines(properties)}
          empty={properties.length === 0}
          onClick={onOpenProperties}
        />
      </div>
    </section>
  )
}

/** Одна машина — её название и пробег; несколько — сколько их всего. */
function vehicleLines(vehicles: Vehicle[]): string[] {
  if (vehicles.length === 0) return ['Журнал обслуживания']

  if (vehicles.length === 1) {
    const mileage = currentMileage(vehicles[0])
    return [vehicles[0].title, mileage === undefined ? '' : formatKm(mileage)].filter(Boolean)
  }

  return [
    `${vehicles.length} ${plural(vehicles.length, 'машина', 'машины', 'машин')}`,
    vehicles.map((vehicle) => vehicle.title).join(', '),
  ]
}

function propertyLines(properties: Property[]): string[] {
  if (properties.length === 0) return ['Квартиры и дома']

  const first =
    properties.length === 1
      ? properties[0].title
      : `${properties.length} ${plural(properties.length, 'объект', 'объекта', 'объектов')}`

  /**
   * Ближайшая оплата аренды вытесняет площади, но только когда она вот-вот:
   * «10 августа» в июле — не новость, а площадь квартиры не меняется никогда,
   * и место на плитке она занимает зря ровно в те дни, когда ждут денег.
   */
  const rent = nearestRent(properties)
  const second =
    rent && daysUntil(rent.date) <= 5
      ? `Аренда — ${formatDayHeading(rent.date).toLowerCase()}`
      : areasLine(properties)

  return [first, second].filter(Boolean)
}

function daysUntil(date: DateKey): number {
  return Math.round((fromDateKey(date).getTime() - fromDateKey(todayKey()).getTime()) / 86_400_000)
}

function Tile({
  icon,
  color,
  title,
  lines,
  empty,
  alert,
  onClick,
}: {
  icon: string
  color: string
  title: string
  lines: string[]
  /** Раздел пуст: вместо данных зовём его завести. */
  empty: boolean
  /** Короткое предупреждение вместо второй строки — например, просроченное ТО. */
  alert?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-4 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center gap-2.5">
        <CategoryIcon icon={icon} color={color} size={32} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</span>
      </div>

      <p className={`mt-2.5 truncate text-[14px] ${empty ? 'text-muted' : 'font-medium'}`}>
        {lines[0]}
      </p>

      {alert ? (
        <p className="mt-0.5 truncate text-[12px] font-medium" style={{ color: 'var(--color-danger)' }}>
          {alert}
        </p>
      ) : (
        lines[1] && <p className="mt-0.5 truncate text-[12px] tabular-nums text-muted">{lines[1]}</p>
      )}

      {empty && <p className="mt-0.5 text-[12px] text-brand">Добавить</p>}
    </button>
  )
}
