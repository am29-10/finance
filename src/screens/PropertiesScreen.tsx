import { useState } from 'react'
import { CategoryIcon } from '../components/CategoryIcon'
import { ScreenHeader } from '../components/ScreenHeader'
import { PropertySheet } from '../components/PropertySheet'
import { propertyById, useFinance } from '../data/store'
import type { Property } from '../data/types'
import { formatDayHeading, formatFullDate } from '../lib/date'
import { formatMoney } from '../lib/money'
import { plural } from '../lib/text'
import {
  areasLine,
  formatArea,
  isContractOver,
  nextRentDate,
  propertyPurpose,
  PROPERTY_KIND_TITLES,
  propertySubtitle,
} from '../lib/property'

interface PropertiesScreenProps {
  onBack: () => void
}

const KIND_ICONS: Record<Property['kind'], string> = {
  flat: 'building',
  house: 'home',
  room: 'home',
  other: 'building',
}

/**
 * Недвижимость — список объектов, а не одна большая карточка «Квартира».
 *
 * Квартир бывает несколько, и назначение у них разное: в одной живут, вторую
 * сдают, третью держат как вложение. Общего у них — только адрес и площадь,
 * поэтому карточка объекта показывает разное в зависимости от назначения.
 */
export function PropertiesScreen({ onBack }: PropertiesScreenProps) {
  const data = useFinance()
  const [openId, setOpenId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ property?: Property } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const selected = openId ? propertyById(data, openId) : undefined

  function openSheet(property?: Property) {
    setSheet({ property })
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setTimeout(() => setSheet(null), 260)
  }

  if (selected) {
    return (
      <>
        <PropertyDetail
          property={selected}
          onBack={() => setOpenId(null)}
          onEdit={() => openSheet(selected)}
        />
        {sheet && (
          <PropertySheet
            key={sheet.property?.id ?? 'new'}
            open={sheetOpen}
            property={sheet.property}
            onClose={closeSheet}
            onDeleted={() => setOpenId(null)}
          />
        )}
      </>
    )
  }

  const areas = areasLine(data.properties)

  return (
    <div className="px-4 pb-8">
      <ScreenHeader title="Недвижимость" onBack={onBack} />

      {data.properties.length === 0 ? (
        <div className="mt-2 rounded-2xl bg-surface px-6 py-10 text-center">
          <p className="text-[15px] font-medium">Объектов пока нет</p>
          <p className="mx-auto mt-2 max-w-[280px] text-[14px] leading-snug text-muted">
            Добавьте квартиру или дом — приложение будет помнить площадь, этаж, арендатора и срок
            договора. Деньги по-прежнему живут в операциях.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-2 px-1 text-[13px] text-muted">
            {data.properties.length}{' '}
            {plural(data.properties.length, 'объект', 'объекта', 'объектов')}
            {areas && ` · ${areas}`}
          </p>

          <div className="flex flex-col gap-2.5">
            {data.properties.map((property) => (
              <PropertyRow
                key={property.id}
                property={property}
                onClick={() => setOpenId(property.id)}
              />
            ))}
          </div>
        </>
      )}

      <button
        onClick={() => openSheet()}
        className="mt-4 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
      >
        Добавить объект
      </button>

      {sheet && (
        <PropertySheet
          key={sheet.property?.id ?? 'new'}
          open={sheetOpen}
          property={sheet.property}
          onClose={closeSheet}
        />
      )}
    </div>
  )
}

function PropertyRow({ property, onClick }: { property: Property; onClick: () => void }) {
  const purpose = propertyPurpose(property.purpose)

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-surface px-4 py-4 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <CategoryIcon icon={KIND_ICONS[property.kind]} color={purpose.color} size={44} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{property.title}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {propertySubtitle(property) || PROPERTY_KIND_TITLES[property.kind]}
          </p>
        </div>

        <span className="shrink-0 text-[12px] font-medium" style={{ color: purpose.color }}>
          {purpose.short}
        </span>
      </div>
    </button>
  )
}

function PropertyDetail({
  property,
  onBack,
  onEdit,
}: {
  property: Property
  onBack: () => void
  onEdit: () => void
}) {
  const purpose = propertyPurpose(property.purpose)
  const rentDate = nextRentDate(property)
  const contractOver = isContractOver(property)

  return (
    <div className="px-4 pb-8">
      <ScreenHeader
        title={property.title}
        onBack={onBack}
        action={{ label: 'Изменить', onClick: onEdit }}
      />

      <section
        className="rounded-3xl px-5 py-5 text-white"
        style={{ backgroundColor: purpose.color }}
      >
        <span className="text-[13px] opacity-80">
          {PROPERTY_KIND_TITLES[property.kind]} · {purpose.short.toLowerCase()}
        </span>
        <p className="mt-1 text-[34px] font-bold tabular-nums">
          {property.area ? formatArea(property.area) : PROPERTY_KIND_TITLES[property.kind]}
        </p>
        {property.address && <p className="mt-1 text-[14px] opacity-80">{property.address}</p>}
      </section>

      {property.purpose === 'rent' && (rentDate || property.tenant || property.contractUntil) && (
        <section className="mt-3 rounded-2xl bg-surface px-4 py-4">
          {property.tenant && <Row label="Арендатор" value={property.tenant} />}
          {property.contractUntil && (
            <Row
              label="Договор до"
              value={formatFullDate(property.contractUntil).replace(/ г\.$/, '')}
              tone={contractOver ? 'var(--color-danger)' : undefined}
            />
          )}
          {rentDate && (
            <Row label="Следующая оплата" value={formatDayHeading(rentDate).toLowerCase()} />
          )}

          <p className="mt-3 text-[12px] leading-snug text-muted">
            {contractOver
              ? 'Срок договора вышел — продлите его или поправьте дату.'
              : 'Полученную аренду заносите в операции: доход, категория «Аренда квартиры».'}
          </p>
        </section>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {property.price && (
          <Tile label="Стоимость" value={formatMoney(property.price)} hint="в баланс не входит" />
        )}
        {property.rooms && <Tile label="Комнат" value={String(property.rooms)} />}
        {property.floor && <Tile label="Этаж" value={String(property.floor)} />}
        {property.area && <Tile label="Площадь" value={formatArea(property.area)} />}
        {property.renovationYear && (
          <Tile label="Ремонт" value={String(property.renovationYear)} />
        )}
      </div>

      {property.note && (
        <p className="mt-3 rounded-2xl bg-surface px-4 py-4 text-[14px] leading-relaxed">
          {property.note}
        </p>
      )}
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[14px] text-muted">{label}</span>
      <span className="min-w-0 truncate text-[15px] font-medium" style={{ color: tone }}>
        {value}
      </span>
    </div>
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
