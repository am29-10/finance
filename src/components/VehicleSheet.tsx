import { useState } from 'react'
import { Sheet } from './Sheet'
import { Field } from './Field'
import { actions } from '../data/store'
import type { Vehicle } from '../data/types'
import { formatKmInput, parseKm } from '../lib/vehicle'

interface VehicleSheetProps {
  open: boolean
  /** Машина для правки; без неё заводим новую. */
  vehicle?: Vehicle
  onClose: () => void
  onDeleted?: () => void
}

/**
 * Карточка машины: только то, что человек про неё знает наизусть.
 *
 * Полей намеренно мало. Раздел живёт не карточкой, а журналом обслуживания,
 * и анкета на десять строк перед первой записью — верный способ до журнала
 * так и не дойти. Всё, кроме названия, необязательно.
 */
export function VehicleSheet({ open, vehicle, onClose, onDeleted }: VehicleSheetProps) {
  const isEditing = Boolean(vehicle)

  const [title, setTitle] = useState(vehicle?.title ?? '')
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : '')
  const [mileage, setMileage] = useState(
    vehicle?.mileage === undefined ? '' : formatKmInput(String(vehicle.mileage)),
  )
  const [plate, setPlate] = useState(vehicle?.plate ?? '')
  const [vin, setVin] = useState(vehicle?.vin ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const canSave = title.trim().length > 0

  function handleSave() {
    if (!canSave) return

    const payload = {
      title: title.trim(),
      year: parseYear(year),
      mileage: parseKm(mileage) ?? undefined,
      plate: plate.trim() || undefined,
      vin: vin.trim() || undefined,
    }

    if (vehicle) actions.updateVehicle(vehicle.id, payload)
    else actions.addVehicle(payload)

    onClose()
  }

  function handleDelete() {
    if (!vehicle) return

    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }

    actions.deleteVehicle(vehicle.id)
    onClose()
    onDeleted?.()
  }

  return (
    <Sheet open={open} onClose={onClose} title={isEditing ? 'Машина' : 'Новая машина'}>
      <div className="flex flex-col gap-5">
        <Field label="Марка и модель">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, BMW 320i"
            autoFocus={!isEditing}
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none placeholder:text-muted"
          />
        </Field>

        <div className="flex gap-3">
          <div className="w-[120px]">
            <Field label="Год" optional>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="2021"
                className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
              />
            </Field>
          </div>

          <div className="min-w-0 flex-1">
            <Field label="Текущий пробег" optional>
              <div className="flex items-baseline gap-1.5 rounded-2xl bg-surface px-4 py-3.5">
                <input
                  value={mileage}
                  onChange={(e) => setMileage(formatKmInput(e.target.value))}
                  inputMode="numeric"
                  placeholder="87 420"
                  className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
                />
                <span className="text-[15px] text-muted">км</span>
              </div>
            </Field>
          </div>
        </div>

        <Field label="Госномер" optional>
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="А123ВС777"
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] uppercase outline-none placeholder:text-muted"
          />
        </Field>

        <Field label="VIN" optional hint="Пригодится при заказе деталей — чтобы не искать документы.">
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 17))}
            placeholder="WBA8E9G50GNT12345"
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[15px] uppercase tracking-wide outline-none placeholder:text-muted"
          />
        </Field>

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="mt-1 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-30"
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
            {confirmingDelete ? 'Удалить машину вместе с журналом?' : 'Удалить машину'}
          </button>
        )}
      </div>
    </Sheet>
  )
}

/** Год выпуска: раньше конца XIX века машин не было, будущий год — опечатка. */
function parseYear(input: string): number | undefined {
  const value = Number(input)
  if (!Number.isFinite(value) || value < 1900) return undefined

  return value <= new Date().getFullYear() + 1 ? value : undefined
}
