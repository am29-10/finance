import { CategoryIcon } from './CategoryIcon'
import type { DateKey, Property, Vehicle } from '../data/types'
import { formatDayHeading, fromDateKey, todayKey } from '../lib/date'
import { plural } from '../lib/text'
import { areasLine, nearestRent } from '../lib/property'
import { formatKm, nearestService, type ServiceDue } from '../lib/vehicle'

interface AssetsCardProps {
  vehicles: Vehicle[]
  properties: Property[]
  onOpenVehicles: () => void
  onOpenProperties: () => void
}

const CAR_COLOR = '#0891b2'
const HOME_COLOR = '#0d9488'

/**
 * «Активы» на главной — две плитки, за которыми лежат справочники вещей.
 *
 * Стоят сразу под счетами: «где деньги» и «что есть» — соседние вопросы, и
 * отвечать на них лучше рядом, а бюджет с кредитами уже про месяц и планы.
 *
 * Ни машина, ни квартира в баланс не входят и входить не должны: приложение
 * считает деньги, а не имущество, и оценка квартиры, вбитая однажды, устарела
 * бы в тот же месяц. Поэтому плитки показывают не стоимость, а то, о чём
 * спрашивают: скоро ли в сервис и когда следующая аренда.
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
      <h2 className="mb-2 px-1 text-[15px] font-semibold">Активы</h2>

      <div className="flex gap-2.5">
        <Tile
          icon="car"
          color={CAR_COLOR}
          title="Машина"
          lines={vehicleLines(vehicles, due?.due)}
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

/**
 * Название машины и срок ближайшего обслуживания.
 *
 * Пробега здесь намеренно нет: он меняется каждый день, а вводят его раз в
 * несколько месяцев — на главной висело бы число, устаревшее в тот же вечер.
 * Срок до сервиса живёт по тому же пробегу, но отвечает на вопрос, который
 * человек себе действительно задаёт.
 */
function vehicleLines(vehicles: Vehicle[], due: ServiceDue | undefined): string[] {
  if (vehicles.length === 0) return ['Журнал обслуживания']

  const first =
    vehicles.length === 1
      ? vehicles[0].title
      : `${vehicles.length} ${plural(vehicles.length, 'машина', 'машины', 'машин')}`

  return [first, dueShort(due)].filter(Boolean)
}

/** «Через 800 км» или «Через 12 дней» — то, что влезает во вторую строку плитки. */
function dueShort(due: ServiceDue | undefined): string {
  if (!due || due.overdue) return ''

  if (due.kmLeft !== undefined && (due.daysLeft === undefined || due.kmLeft / 1000 <= due.daysLeft / 30)) {
    return `Сервис через ${formatKm(due.kmLeft)}`
  }

  if (due.daysLeft === undefined) return ''

  return `Сервис через ${due.daysLeft} ${plural(due.daysLeft, 'день', 'дня', 'дней')}`
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
