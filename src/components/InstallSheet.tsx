import { useState } from 'react'
import { Sheet } from './Sheet'
import { Segmented } from './Field'
import { currentPlatform } from '../lib/platform'

interface InstallSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * Ссылка сразу на файл последней сборки, а не на страницу релиза: `latest/download`
 * отдаёт APK из свежего релиза, и человек попадает на загрузку, а не на GitHub,
 * где ему пришлось бы искать нужный файл среди исходников.
 */
const APK_URL = 'https://github.com/am29-10/finance/releases/latest/download/koshelek.apk'

/** Файл для iPhone. Без подписи: подписывает его SideStore уже на телефоне. */
const IPA_URL = 'https://github.com/am29-10/finance/releases/latest/download/koshelek.ipa'

const SIDESTORE_URL = 'https://sidestore.io'

type Tab = 'android' | 'ios'

/** На iPhone способа два, и выбирать между ними приходится человеку — см. ниже. */
type IosWay = 'home' | 'file'

/**
 * Как поставить приложение на телефон.
 *
 * Инструкции разные не из-за оформления, а из-за того, что iPhone запускает
 * только подписанные приложения, а подпись продаёт Apple. Отсюда две дороги, и
 * ни одна не лучше другой во всём: иконка из Safari ставится в три касания, но
 * данные исчезают вместе с ней; файл через SideStore даёт настоящее приложение
 * с собственным хранилищем, но требует раз в неделю продлевать подпись.
 * Поэтому выбор оставлен человеку, а не сделан за него.
 */
export function InstallSheet({ open, onClose }: InstallSheetProps) {
  const [tab, setTab] = useState<Tab>(() => (currentPlatform() === 'ios' ? 'ios' : 'android'))
  const [iosWay, setIosWay] = useState<IosWay>('home')

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
                  Нажмите кнопку ниже — начнётся загрузка файла{' '}
                  <code className="rounded bg-bg px-1.5 py-0.5 text-[13px]">koshelek.apk</code>.
                </>,
                <>
                  Откройте скачанный файл из шторки уведомлений или папки «Загрузки». Android
                  предупредит, что приложение не из Play Маркета — разрешите установку из этого
                  источника.
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
            <Segmented
              value={iosWay}
              options={[
                { value: 'home', label: 'Из Safari' },
                { value: 'file', label: 'Файлом' },
              ]}
              onChange={setIosWay}
            />

            {iosWay === 'home' ? (
              <>
                <Note tone="muted">
                  Самый короткий путь: приложение добавляется на домашний экран прямо из Safari.
                  Получится та же иконка и тот же полный экран без адресной строки — за три
                  касания и без компьютера.
                </Note>

                <Steps
                  items={[
                    <>
                      Откройте приложение в <b>Safari</b>. В Chrome на iPhone кнопки добавления
                      нет.
                    </>,
                    <>Нажмите кнопку «Поделиться» — квадрат со стрелкой вверх, внизу экрана.</>,
                    <>
                      Выберите <b>«На экран „Домой“»</b> и подтвердите.
                    </>,
                  ]}
                />

                <Note tone="danger">
                  Важно: данные привязаны к этой иконке. Если удалить её с экрана, история операций
                  удалится вместе с ней, а восстановить будет неоткуда. Поэтому добавьте иконку
                  сразу, до того как заводить операции, и время от времени сохраняйте резервную
                  копию.
                </Note>
              </>
            ) : (
              <>
                <Note tone="muted">
                  Настоящее приложение — с отдельным хранилищем, которое не пропадёт вместе с
                  иконкой. iPhone запускает только подписанные программы, а подпись Apple стоит
                  99 $ в год; SideStore обходит это иначе — подписывает приложение прямо на
                  телефоне вашим обычным Apple ID, бесплатно и без Mac.
                </Note>

                <Steps
                  items={[
                    <>
                      Поставьте <b>SideStore</b> по инструкции с{' '}
                      <a
                        href={SIDESTORE_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand underline underline-offset-2"
                      >
                        sidestore.io
                      </a>
                      . Компьютер с Windows и кабель нужны только на этом шаге — дальше телефон
                      справляется сам.
                    </>,
                    <>
                      Скачайте на телефон файл{' '}
                      <code className="rounded bg-bg px-1.5 py-0.5 text-[13px]">koshelek.ipa</code>{' '}
                      кнопкой ниже.
                    </>,
                    <>
                      Откройте SideStore, нажмите «+» и выберите скачанный файл. Через минуту
                      приложение появится на домашнем экране.
                    </>,
                  ]}
                />

                <a
                  href={IPA_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full rounded-2xl bg-brand py-4 text-center text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
                >
                  Скачать файл приложения
                </a>

                <Note tone="danger">
                  Бесплатная подпись живёт 7 дней. SideStore продлевает её сам, пока телефон в
                  Wi-Fi, но если пропустить неделю, приложение перестанет открываться, пока подпись
                  не обновится вручную — данные при этом остаются на месте. Больше трёх таких
                  приложений на один Apple ID держать нельзя.
                </Note>
              </>
            )}
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
