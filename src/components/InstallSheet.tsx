import { useState } from 'react'
import { Sheet } from './Sheet'
import { Segmented } from './Field'
import { currentPlatform } from '../lib/platform'

interface InstallSheetProps {
  open: boolean
  onClose: () => void
}

/** Прямая ссылка на последнюю сборку APK. Релизы GitHub сами ведут на свежий файл. */
const APK_URL = 'https://github.com/am29-10/finance/releases/latest'

type Tab = 'android' | 'ios'

/**
 * Как поставить приложение на телефон.
 *
 * Инструкции разные не из-за оформления, а потому что Apple не разрешает
 * устанавливать приложения файлом: на Android человек скачивает APK, на iPhone
 * добавляет страницу на домашний экран. Второй способ выглядит хуже, но
 * работает и стоит ноль.
 */
export function InstallSheet({ open, onClose }: InstallSheetProps) {
  const [tab, setTab] = useState<Tab>(() => (currentPlatform() === 'ios' ? 'ios' : 'android'))

  return (
    <Sheet open={open} onClose={onClose} title="Установить на телефон">
      <div className="flex flex-col gap-5">
        <Segmented
          value={tab}
          options={[
            { value: 'android', label: 'Android' },
            { value: 'ios', label: 'iPhone' },
          ]}
          onChange={setTab}
        />

        {tab === 'android' ? (
          <>
            <Steps
              items={[
                <>
                  Откройте страницу загрузки и скачайте файл{' '}
                  <code className="rounded bg-bg px-1.5 py-0.5 text-[13px]">koshelek.apk</code>.
                </>,
                <>
                  Нажмите на скачанный файл. Android предупредит, что приложение не из Play
                  Маркета — разрешите установку из этого источника.
                </>,
                <>Готово: приложение появится в списке программ со своей иконкой.</>,
              ]}
            />

            <a
              href={APK_URL}
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-2xl bg-brand py-4 text-center text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
            >
              Скачать приложение
            </a>

            <Note tone="brand">
              В приложении данные лежат в его собственном хранилище: очистка браузера их больше не
              трогает. Пропасть они могут только вместе с удалением самого приложения.
            </Note>
          </>
        ) : (
          <>
            <Note tone="muted">
              Apple не разрешает устанавливать приложения файлом — на iPhone это возможно только
              через App Store. Поэтому приложение добавляется на домашний экран прямо из Safari:
              получится та же иконка и тот же полный экран без адресной строки.
            </Note>

            <Steps
              items={[
                <>
                  Откройте приложение в <b>Safari</b>. В Chrome на iPhone кнопки добавления нет.
                </>,
                <>
                  Нажмите кнопку «Поделиться» — квадрат со стрелкой вверх, внизу экрана.
                </>,
                <>
                  Выберите <b>«На экран „Домой“»</b> и подтвердите.
                </>,
              ]}
            />

            <Note tone="danger">
              Важно: данные привязаны к этой иконке. Если удалить её с экрана, история операций
              удалится вместе с ней, а восстановить будет неоткуда. Поэтому добавьте иконку сразу,
              до того как заводить операции, и время от времени сохраняйте резервную копию.
            </Note>
          </>
        )}
      </div>
    </Sheet>
  )
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/12 text-[13px] font-semibold text-brand">
            {index + 1}
          </span>
          <span className="flex-1 pt-0.5 text-[14px] leading-snug">{item}</span>
        </li>
      ))}
    </ol>
  )
}

function Note({ tone, children }: { tone: 'brand' | 'danger' | 'muted'; children: React.ReactNode }) {
  const style = {
    brand: { backgroundColor: '#2e7d6b0f', color: 'var(--color-ink)' },
    danger: { backgroundColor: '#f4433610', color: 'var(--color-ink)' },
    muted: { backgroundColor: 'var(--color-surface)', color: 'var(--color-muted)' },
  }[tone]

  return (
    <p className="rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed" style={style}>
      {children}
    </p>
  )
}
