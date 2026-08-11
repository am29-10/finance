import { useState } from 'react'
import { CategoryIcon } from '../components/CategoryIcon'
import { ScreenHeader } from '../components/ScreenHeader'
import { VehicleSheet } from '../components/VehicleSheet'
import { ServiceSheet } from '../components/ServiceSheet'
import { useFinance, vehicleById } from '../data/store'
import type { ServiceRecord, Vehicle } from '../data/types'
import { formatDayHeading, formatFullDate } from '../lib/date'
import { formatMoney } from '../lib/money'
import { plural } from '../lib/text'
import {
  currentMileage,
  formatKm,
  serviceKind,
  serviceSpending,
  sortedRecords,
  upcomingServices,
  vehicleSubtitle,
  type ServiceDue,
} from '../lib/vehicle'

interface VehiclesScreenProps {
  onBack: () => void
}

const CAR_COLOR = '#0891b2'

/**
 * Машина — не финансовый раздел, а журнал: что и когда с ней делали.
 *
 * Одна машина открывается сразу, минуя список: держать между главной и
 * журналом экран с единственной строкой значит требовать лишнее нажатие
 * каждый раз. Список появляется, только когда машин действительно несколько.
 */
export function VehiclesScreen({ onBack }: VehiclesScreenProps) {
  const data = useFinance()
  const [openId, setOpenId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ vehicle?: Vehicle } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const only = data.vehicles.length === 1 ? data.vehicles[0] : undefined
  const selected = openId ? vehicleById(data, openId) : only

  function openSheet(vehicle?: Vehicle) {
    setSheet({ vehicle })
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setTimeout(() => setSheet(null), 260)
  }

  if (selected) {
    return (
      <>
        <VehicleDetail
          vehicle={selected}
          onBack={() => (openId && !only ? setOpenId(null) : onBack())}
          onEdit={() => openSheet(selected)}
        />
        {sheet && (
          <VehicleSheet
            key={sheet.vehicle?.id ?? 'new'}
            open={sheetOpen}
            vehicle={sheet.vehicle}
            onClose={closeSheet}
            onDeleted={() => setOpenId(null)}
          />
        )}
      </>
    )
  }

  return (
    <div className="px-4 pb-8">
      <ScreenHeader title="Машина" onBack={onBack} />

      {data.vehicles.length === 0 ? (
        <div className="mt-2 rounded-2xl bg-surface px-6 py-10 text-center">
          <p className="text-[15px] font-medium">Машины пока нет</p>
          <p className="mx-auto mt-2 max-w-[280px] text-[14px] leading-snug text-muted">
            Добавьте машину — приложение будет помнить, что и когда с ней делали, и напомнит о
            следующей замене масла или ТО.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {data.vehicles.map((vehicle) => (
            <VehicleRow key={vehicle.id} vehicle={vehicle} onClick={() => setOpenId(vehicle.id)} />
          ))}
        </div>
      )}

      <button
        onClick={() => openSheet()}
        className="mt-4 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
      >
        Добавить машину
      </button>

      {sheet && (
        <VehicleSheet
          key={sheet.vehicle?.id ?? 'new'}
          open={sheetOpen}
          vehicle={sheet.vehicle}
          onClose={closeSheet}
        />
      )}
    </div>
  )
}

function VehicleRow({ vehicle, onClick }: { vehicle: Vehicle; onClick: () => void }) {
  const due = upcomingServices(vehicle)[0]

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-surface px-4 py-4 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <CategoryIcon icon="car" color={CAR_COLOR} size={44} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{vehicle.title}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {vehicleSubtitle(vehicle) || 'Пробег не указан'}
          </p>
        </div>

        {due?.overdue && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ backgroundColor: '#f4433614', color: 'var(--color-danger)' }}
          >
            пора
          </span>
        )}
      </div>
    </button>
  )
}

function VehicleDetail({
  vehicle,
  onBack,
  onEdit,
}: {
  vehicle: Vehicle
  onBack: () => void
  onEdit: () => void
}) {
  const [sheet, setSheet] = useState<{ record?: ServiceRecord } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const mileage = currentMileage(vehicle)
  const records = sortedRecords(vehicle)
  const due = upcomingServices(vehicle)
  const spending = serviceSpending(vehicle)

  function openSheet(record?: ServiceRecord) {
    setSheet({ record })
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setTimeout(() => setSheet(null), 260)
  }

  return (
    <div className="px-4 pb-8">
      <ScreenHeader
        title={vehicle.title}
        onBack={onBack}
        action={{ label: 'Изменить', onClick: onEdit }}
      />

      <section className="rounded-3xl px-5 py-5 text-white" style={{ backgroundColor: CAR_COLOR }}>
        <span className="text-[13px] opacity-80">Текущий пробег</span>
        <p className="mt-1 text-[34px] font-bold tabular-nums">
          {mileage === undefined ? 'не указан' : formatKm(mileage)}
        </p>

        <p className="mt-2 text-[13px] opacity-80">
          {[vehicle.year && `${vehicle.year} год`, vehicle.plate, vehicle.vin]
            .filter(Boolean)
            .join(' · ') || 'Год, номер и VIN — по кнопке «Изменить»'}
        </p>
      </section>

      {(vehicle.price || spending.count > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {vehicle.price && <Tile label="Стоимость машины" value={formatMoney(vehicle.price)} />}
          {spending.count > 0 && (
            <Tile
              label="Обслуживание за год"
              value={formatMoney(spending.lastYear)}
              hint={
                spending.total > spending.lastYear
                  ? `всего по журналу ${formatMoney(spending.total)}`
                  : undefined
              }
            />
          )}
        </div>
      )}

      {due.length > 0 && (
        <div className="mt-3 flex flex-col gap-2.5">
          {due.slice(0, 3).map((row) => (
            <DueCard key={row.record.id} due={row} />
          ))}
        </div>
      )}

      <button
        onClick={() => openSheet()}
        className="mt-3 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
      >
        Добавить обслуживание
      </button>

      <h2 className="mt-6 mb-2 px-1 text-[17px] font-semibold">История обслуживания</h2>

      {records.length === 0 ? (
        <p className="rounded-2xl bg-surface px-5 py-8 text-center text-[14px] leading-snug text-muted">
          Записей пока нет. Первая же — «замена масла, 87 000 км» — избавит от попыток вспомнить
          через год, когда это было.
        </p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
          {records.map((record) => (
            <RecordRow key={record.id} record={record} onClick={() => openSheet(record)} />
          ))}
        </div>
      )}

      {records.length > 0 && (
        <p className="mt-3 px-1 text-[13px] leading-relaxed text-muted">
          {records.length} {plural(records.length, 'запись', 'записи', 'записей')} в журнале.
          Цены здесь справочные: в баланс и расходы они не идут — сам расход на сервис заносится
          в операции.
        </p>
      )}

      {sheet && (
        <ServiceSheet
          key={sheet.record?.id ?? 'new'}
          open={sheetOpen}
          vehicle={vehicle}
          record={sheet.record}
          onClose={closeSheet}
        />
      )}
    </div>
  )
}

/** Напоминание о следующем разе: просроченное — тревожным цветом, остальное — спокойным. */
function DueCard({ due }: { due: ServiceDue }) {
  const kind = serviceKind(due.record.kind)
  const alarming = due.overdue || due.soon
  const color = due.overdue ? 'var(--color-danger)' : alarming ? 'var(--color-orange)' : kind.color

  return (
    <section
      className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
      style={{ backgroundColor: due.overdue ? '#f4433610' : 'var(--color-surface)' }}
    >
      <span className="mt-0.5 shrink-0">
        <CategoryIcon icon={kind.icon} color={color} size={32} />
      </span>

      <p className="min-w-0 flex-1 text-[14px] leading-snug">
        <span className="font-medium">{due.record.title}</span>
        <span className="mt-0.5 block text-[13px]" style={{ color: alarming ? color : 'var(--color-muted)' }}>
          {dueText(due)}
        </span>
      </p>
    </section>
  )
}

/** Человеческая формулировка срока: «осталось 800 км», «просрочено на 12 дней». */
function dueText(due: ServiceDue): string {
  const parts: string[] = []

  if (due.kmLeft !== undefined) {
    parts.push(
      due.kmLeft > 0
        ? `через ${formatKm(due.kmLeft)}`
        : `пробег перебран на ${formatKm(-due.kmLeft)}`,
    )
  }

  if (due.daysLeft !== undefined) {
    const days = Math.abs(due.daysLeft)
    parts.push(
      due.daysLeft > 0
        ? `через ${days} ${plural(days, 'день', 'дня', 'дней')}`
        : due.daysLeft === 0
          ? 'срок сегодня'
          : `просрочено на ${days} ${plural(days, 'день', 'дня', 'дней')}`,
    )
  }

  const target = [
    due.record.nextMileage === undefined ? '' : formatKm(due.record.nextMileage),
    due.record.nextDate ? formatFullDate(due.record.nextDate).replace(/ г\.$/, '') : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return `Следующая: ${target}${parts.length > 0 ? ` — ${parts.join(', ')}` : ''}`
}

function RecordRow({ record, onClick }: { record: ServiceRecord; onClick: () => void }) {
  const kind = serviceKind(record.kind)

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-bg"
    >
      <CategoryIcon icon={kind.icon} color={kind.color} size={38} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{record.title}</p>
        <p className="mt-0.5 truncate text-[12px] text-muted">
          {formatDayHeading(record.date)}
          {record.note ? ` · ${record.note}` : ''}
        </p>
      </div>

      {/* Цена — то, что ищут глазами в истории; пробег под ней уточняет, когда это было. */}
      {(record.cost || record.mileage !== undefined) && (
        <div className="shrink-0 text-right">
          {record.cost ? (
            <p className="text-[15px] font-semibold tabular-nums">{formatMoney(record.cost)}</p>
          ) : null}
          {record.mileage !== undefined && (
            <p className="mt-0.5 text-[12px] tabular-nums text-muted">{formatKm(record.mileage)}</p>
          )}
        </div>
      )}
    </button>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3.5">
      <p className="text-[12px] leading-snug text-muted">{label}</p>
      <p className="mt-1 text-[17px] font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  )
}
