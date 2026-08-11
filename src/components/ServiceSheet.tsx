import { useState } from 'react'
import { Sheet } from './Sheet'
import { Field, ToggleRow } from './Field'
import { CategoryIcon } from './CategoryIcon'
import { actions } from '../data/store'
import type { ServiceKind, ServiceRecord, Vehicle } from '../data/types'
import { formatFullDate, todayKey } from '../lib/date'
import { formatAmountInput, parseAmount, toAmountInput } from '../lib/money'
import { currentMileage, formatKmInput, parseKm, SERVICE_KINDS } from '../lib/vehicle'

interface ServiceSheetProps {
  open: boolean
  vehicle: Vehicle
  /** Запись для правки; без неё добавляем новую. */
  record?: ServiceRecord
  onClose: () => void
}

/** Что обычно подставляют, выбрав вид работ: девять раз из десяти это и нужно. */
const DEFAULT_TITLES: Record<ServiceKind, string> = {
  service: 'Замена масла',
  inspection: 'ТО',
  tires: 'Смена резины',
  battery: 'Замена аккумулятора',
  repair: 'Ремонт',
  part: 'Замена детали',
}

/** Через сколько километров обычно повторяют работы этого вида. */
const DEFAULT_INTERVAL: Partial<Record<ServiceKind, number>> = {
  service: 10_000,
  inspection: 15_000,
}

export function ServiceSheet({ open, vehicle, record, onClose }: ServiceSheetProps) {
  const isEditing = Boolean(record)

  const [kind, setKind] = useState<ServiceKind>(record?.kind ?? 'service')
  const [title, setTitle] = useState(record?.title ?? '')
  const [date, setDate] = useState(record?.date ?? todayKey())
  const [mileage, setMileage] = useState(() => {
    if (record) return record.mileage === undefined ? '' : formatKmInput(String(record.mileage))

    // Новую запись почти всегда заводят сразу после сервиса — пробег с табло
    // тот же, что в карточке. Подставляем его, чтобы не набирать заново.
    const current = currentMileage(vehicle)
    return current === undefined ? '' : formatKmInput(String(current))
  })
  const [cost, setCost] = useState(record?.cost ? toAmountInput(record.cost) : '')
  const [note, setNote] = useState(record?.note ?? '')

  const [remind, setRemind] = useState(Boolean(record?.nextMileage || record?.nextDate))
  const [nextMileage, setNextMileage] = useState(
    record?.nextMileage === undefined ? '' : formatKmInput(String(record.nextMileage)),
  )
  const [nextDate, setNextDate] = useState(record?.nextDate ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const finalTitle = title.trim() || DEFAULT_TITLES[kind]

  /**
   * Выбор вида работ подставляет и название: пустое поле человек всё равно
   * заполнит теми же словами. Уже напечатанное не трогаем — это его текст.
   */
  function pickKind(value: ServiceKind) {
    setKind(value)
    if (!title.trim() || title.trim() === DEFAULT_TITLES[kind]) setTitle(DEFAULT_TITLES[value])
  }

  /** Включая напоминание, сразу предлагаем обычный для этого вида интервал. */
  function toggleRemind(value: boolean) {
    setRemind(value)
    if (!value || nextMileage || nextDate) return

    const interval = DEFAULT_INTERVAL[kind]
    const from = parseKm(mileage)
    if (interval && from) setNextMileage(formatKmInput(String(from + interval)))
  }

  function handleSave() {
    const payload = {
      kind,
      title: finalTitle,
      date,
      mileage: parseKm(mileage) ?? undefined,
      cost: parseAmount(cost) ?? undefined,
      note: note.trim() || undefined,
      nextMileage: remind ? (parseKm(nextMileage) ?? undefined) : undefined,
      nextDate: remind && nextDate ? nextDate : undefined,
    }

    if (record) actions.updateService(vehicle.id, record.id, payload)
    else actions.addService(vehicle.id, payload)

    onClose()
  }

  function handleDelete() {
    if (!record) return

    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }

    actions.deleteService(vehicle.id, record.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={isEditing ? 'Запись' : 'Обслуживание'}>
      <div className="flex flex-col gap-5">
        <Field label="Что за работы">
          <div className="grid grid-cols-3 gap-2">
            {SERVICE_KINDS.map((option) => {
              const active = option.value === kind

              return (
                <button
                  key={option.value}
                  onClick={() => pickKind(option.value)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 transition-all duration-200"
                  style={{
                    backgroundColor: active ? `${option.color}14` : 'var(--color-surface)',
                    color: active ? option.color : 'var(--color-muted)',
                  }}
                >
                  <CategoryIcon icon={option.icon} color={option.color} size={34} />
                  <span className="text-[12px] font-medium leading-tight">{option.title}</span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Что делали">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={DEFAULT_TITLES[kind]}
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none placeholder:text-muted"
          />
        </Field>

        <Field label="Дата">
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none"
            />
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center bg-surface pr-3 text-[17px]">
              {formatFullDate(date)}
            </span>
          </div>
        </Field>

        <Field label="Пробег" optional>
          <div className="flex items-baseline gap-1.5 rounded-2xl bg-surface px-4 py-3.5">
            <input
              value={mileage}
              onChange={(e) => setMileage(formatKmInput(e.target.value))}
              inputMode="numeric"
              placeholder="87 000"
              className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
            />
            <span className="text-[15px] text-muted">км</span>
          </div>
        </Field>

        <Field
          label="Стоимость"
          optional
          hint="Цена работ на тот момент. В расходы и баланс не попадёт — иначе одна и та же замена масла посчиталась бы дважды, здесь и в операции."
        >
          <div className="flex items-baseline gap-1.5 rounded-2xl bg-surface px-4 py-3.5">
            <input
              value={cost}
              onChange={(e) => setCost(formatAmountInput(e.target.value))}
              inputMode="numeric"
              placeholder="4 500"
              className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
            />
            <span className="text-[15px] text-muted">₽</span>
          </div>
        </Field>

        <Field label="Комментарий" optional>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Что заменили, где делали"
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none placeholder:text-muted"
          />
        </Field>

        <ToggleRow
          label="Напомнить о следующем разе"
          hint="Приложение покажет напоминание, когда подойдёт срок или пробег."
          checked={remind}
          onChange={toggleRemind}
        />

        {remind && (
          <div className="flex flex-col gap-5">
            <Field label="Следующий раз на пробеге" optional>
              <div className="flex items-baseline gap-1.5 rounded-2xl bg-surface px-4 py-3.5">
                <input
                  value={nextMileage}
                  onChange={(e) => setNextMileage(formatKmInput(e.target.value))}
                  inputMode="numeric"
                  placeholder="97 000"
                  className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
                />
                <span className="text-[15px] text-muted">км</span>
              </div>
            </Field>

            <Field
              label="Или к дате"
              optional
              hint="Достаточно одного из двух. Если указаны оба — напомним по тому, что наступит раньше."
            >
              <div className="relative">
                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none"
                />
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center bg-surface pr-3 text-[17px]">
                  {nextDate ? formatFullDate(nextDate) : <span className="text-muted">Не выбрана</span>}
                </span>
              </div>
            </Field>
          </div>
        )}

        <p className="px-1 text-[12px] leading-snug text-muted">
          Журнал помнит, что и когда делали и во сколько это обошлось, но деньгами не заведует:
          сам расход заносится в операции. Пробег в карточке машины подтянется сам, если станет
          больше нынешнего.
        </p>

        <button
          onClick={handleSave}
          className="mt-1 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
        >
          Сохранить
        </button>

        {isEditing && (
          <button
            onClick={handleDelete}
            className="w-full rounded-2xl py-3.5 text-[17px] font-medium transition-all duration-200 active:scale-[0.98]"
            style={{
              color: 'var(--color-danger)',
              backgroundColor: confirmingDelete ? '#f4433614' : 'transparent',
            }}
          >
            {confirmingDelete ? 'Точно удалить запись?' : 'Удалить запись'}
          </button>
        )}
      </div>
    </Sheet>
  )
}
