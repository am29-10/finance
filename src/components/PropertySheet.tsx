import { useState } from 'react'
import { Sheet } from './Sheet'
import { Field, Segmented } from './Field'
import { DateInput } from './DateInput'
import { actions } from '../data/store'
import type { Property, PropertyKind, PropertyPurpose } from '../data/types'
import { formatAmountInput, parseAmount, toAmountInput } from '../lib/money'
import {
  hasFloor,
  parseArea,
  PROPERTY_KINDS,
  PROPERTY_PURPOSES,
  toAreaInput,
} from '../lib/property'

interface PropertySheetProps {
  open: boolean
  /** Объект для правки; без него заводим новый. */
  property?: Property
  onClose: () => void
  onDeleted?: () => void
}

/**
 * Карточка объекта недвижимости.
 *
 * Поля зависят от назначения: у сдаваемой квартиры спрашиваем арендатора и
 * срок договора, у своей — год ремонта. Показывать всё сразу значило бы
 * заставлять человека, который просто живёт в своей квартире, пролистывать
 * поля про аренду, которые он никогда не заполнит.
 */
export function PropertySheet({ open, property, onClose, onDeleted }: PropertySheetProps) {
  const isEditing = Boolean(property)

  const [title, setTitle] = useState(property?.title ?? '')
  const [kind, setKind] = useState<PropertyKind>(property?.kind ?? 'flat')
  const [purpose, setPurpose] = useState<PropertyPurpose>(property?.purpose ?? 'living')
  const [address, setAddress] = useState(property?.address ?? '')
  const [area, setArea] = useState(property?.area ? toAreaInput(property.area) : '')
  const [rooms, setRooms] = useState(property?.rooms ? String(property.rooms) : '')
  // Ноль комнат — это студия, а не «комнат нет»: см. Property.rooms.
  const [studio, setStudio] = useState(property?.rooms === 0)
  const [floor, setFloor] = useState(property?.floor ? String(property.floor) : '')
  const [price, setPrice] = useState(property?.price ? toAmountInput(property.price) : '')
  const [note, setNote] = useState(property?.note ?? '')

  const [tenant, setTenant] = useState(property?.tenant ?? '')
  const [contractUntil, setContractUntil] = useState(property?.contractUntil ?? '')
  const [rentDay, setRentDay] = useState(property?.rentDay ? String(property.rentDay) : '')
  const [renovationYear, setRenovationYear] = useState(
    property?.renovationYear ? String(property.renovationYear) : '',
  )

  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const canSave = title.trim().length > 0
  const renting = purpose === 'rent'
  /** Студия — планировка квартиры; у дома и комнаты такого понятия нет. */
  const canBeStudio = kind === 'flat'

  function handleSave() {
    if (!canSave) return

    const payload = {
      title: title.trim(),
      kind,
      purpose,
      address: address.trim() || undefined,
      area: parseArea(area) ?? undefined,
      // Студия бывает у квартиры; сменили тип на дом — переключатель уже не
      // показан, и сохранять по нему ноль комнат нельзя.
      rooms: studio && canBeStudio ? 0 : parseCount(rooms, 50),
      floor: hasFloor(kind) ? parseCount(floor, 200) : undefined,
      price: parseAmount(price) ?? undefined,
      note: note.trim() || undefined,
      // Поля аренды храним только у сдаваемого: сняли квартиру с аренды —
      // прежний арендатор не должен всплыть через год как действующий.
      tenant: renting ? tenant.trim() || undefined : undefined,
      contractUntil: renting && contractUntil ? contractUntil : undefined,
      rentDay: renting ? parseCount(rentDay, 31) : undefined,
      renovationYear: parseYear(renovationYear),
    }

    if (property) actions.updateProperty(property.id, payload)
    else actions.addProperty(payload)

    onClose()
  }

  function handleDelete() {
    if (!property) return

    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }

    actions.deleteProperty(property.id)
    onClose()
    onDeleted?.()
  }

  return (
    <Sheet open={open} onClose={onClose} title={isEditing ? 'Объект' : 'Новый объект'}>
      <div className="flex flex-col gap-5">
        <Field label="Название">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, Квартира на Ленина"
            autoFocus={!isEditing}
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none placeholder:text-muted"
          />
        </Field>

        <Field label="Тип">
          <Segmented
            value={kind}
            options={PROPERTY_KINDS.map((option) => ({
              value: option.value,
              label: option.title,
            }))}
            onChange={setKind}
          />
        </Field>

        <Field label="Назначение" hint={purposeHint(purpose)}>
          <Segmented
            value={purpose}
            options={PROPERTY_PURPOSES.map((option) => ({
              value: option.value,
              label: option.title,
            }))}
            onChange={setPurpose}
          />
        </Field>

        <Field label="Адрес">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Москва, Ленина 15"
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none placeholder:text-muted"
          />
        </Field>

        {/*
          Ширины долями, а не пикселями: на узком экране три поля с жёсткими
          92 px переставали помещаться в строку и уезжали за край шторки.
          min-w-0 обязателен — без него поле не даёт себя сжать ниже
          собственного содержимого, и строка снова разъезжается.
        */}
        <div className="flex gap-3">
          <div className="min-w-0 flex-[1.3]">
            <Field label="Площадь">
              <div className="flex items-baseline gap-1.5 rounded-2xl bg-surface px-4 py-3.5">
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value.replace(/[^\d.,]/g, '').slice(0, 7))}
                  inputMode="decimal"
                  placeholder="62"
                  className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
                />
                <span className="text-[15px] text-muted">м²</span>
              </div>
            </Field>
          </div>

          {!studio && (
            <div className="min-w-0 flex-1">
              <Field label="Комнат">
                <input
                  value={rooms}
                  onChange={(e) => setRooms(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  inputMode="numeric"
                  placeholder="3"
                  className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
                />
              </Field>
            </div>
          )}

          {hasFloor(kind) && (
            <div className="min-w-0 flex-1">
              <Field label="Этаж">
                <input
                  value={floor}
                  onChange={(e) => setFloor(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  inputMode="numeric"
                  placeholder="8"
                  className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
                />
              </Field>
            </div>
          )}
        </div>

        {/*
          Студия — не «одна комната» и не «ноль»: комнаты в ней не считают
          вовсе. Поэтому это переключатель, а не число, и поле «Комнат» он
          убирает: заполнять его в студии нечем.
        */}
        {canBeStudio && (
          <button
            onClick={() => {
              setStudio(!studio)
              if (!studio) setRooms('')
            }}
            className="-mt-2 flex w-fit items-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-medium transition-all duration-200"
            style={{
              backgroundColor: studio ? '#2e7d6b14' : 'var(--color-surface)',
              color: studio ? 'var(--color-brand)' : 'var(--color-muted)',
            }}
          >
            <span
              className="flex size-4 shrink-0 items-center justify-center rounded-full transition-all duration-200"
              style={{
                border: studio ? '5px solid var(--color-brand)' : '2px solid #d6dbe1',
              }}
            />
            Студия
          </button>
        )}

        <Field
          label="Стоимость"
          hint="За сколько купили или во сколько оцениваете сейчас. Справочно — в баланс не входит: приложение считает деньги, а не имущество."
        >
          <div className="flex items-baseline gap-1.5 rounded-2xl bg-surface px-4 py-3.5">
            <input
              value={price}
              onChange={(e) => setPrice(formatAmountInput(e.target.value))}
              inputMode="numeric"
              placeholder="9 800 000"
              className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
            />
            <span className="text-[15px] text-muted">₽</span>
          </div>
        </Field>

        {renting ? (
          <>
            <Field label="Арендатор">
              <input
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
                placeholder="Иван"
                className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none placeholder:text-muted"
              />
            </Field>

            {/*
              Дата и число рядом не встают: у поля с календарём есть своя
              минимальная ширина, которую браузер не даёт сжать, и в паре с
              соседом строка выезжала за край шторки. Поэтому каждое поле
              занимает всю ширину — как и дата в остальных формах.
            */}
            <Field label="Договор до">
              <DateInput
                value={contractUntil}
                onChange={setContractUntil}
                placeholder="Не выбрана"
              />
            </Field>

            <Field label="День оплаты" hint="Число месяца, когда приходит аренда.">
              <input
                value={rentDay}
                onChange={(e) => setRentDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                inputMode="numeric"
                placeholder="10"
                className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
              />
            </Field>

            <p className="-mt-1 px-1 text-[12px] leading-snug text-muted">
              Сумма аренды здесь не нужна: полученные деньги заносятся в операции как доход в
              категорию «Аренда квартиры». Чтобы они появлялись сами каждый месяц, заведите
              повторяющуюся операцию в профиле.
            </p>
          </>
        ) : (
          <Field label="Год ремонта">
            <input
              value={renovationYear}
              onChange={(e) => setRenovationYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="2024"
              className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
            />
          </Field>
        )}

        <Field label="Комментарий">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Что важно помнить об этом объекте"
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none placeholder:text-muted"
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
            {confirmingDelete ? 'Точно удалить объект?' : 'Удалить объект'}
          </button>
        )}
      </div>
    </Sheet>
  )
}

function purposeHint(purpose: PropertyPurpose): string {
  if (purpose === 'rent') return 'Спросим арендатора, срок договора и день оплаты.'
  if (purpose === 'living') return 'Только то, что важно про своё жильё.'
  if (purpose === 'invest') return 'Куплена, чтобы вложить деньги, а не жить в ней.'
  return 'Гараж, дача, участок — всё, что не подошло к остальному.'
}

/** Целое число от 1 до предела: комнаты, этаж, день оплаты. */
function parseCount(input: string, max: number): number | undefined {
  const value = Number(input)
  if (!Number.isFinite(value) || value < 1) return undefined
  return Math.min(Math.round(value), max)
}

function parseYear(input: string): number | undefined {
  const value = Number(input)
  if (!Number.isFinite(value) || value < 1900) return undefined
  return value <= new Date().getFullYear() ? value : undefined
}
