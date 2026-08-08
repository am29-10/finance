import { useState } from 'react'
import { Sheet } from './Sheet'
import { actions, useFinance } from '../data/store'
import { canShareBackup, exportBackup, shareBackup } from '../lib/backup'
import { storageRisk } from '../lib/platform'
import { formatFullDate, toDateKey } from '../lib/date'

interface BackupSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * Напоминание сохранить копию, показывается в начале месяца.
 *
 * Появляется само, потому что резервную копию никто не делает по своей воле —
 * о ней вспоминают ровно в тот момент, когда данные уже пропали. Отправку
 * ставим главной кнопкой, а не скачивание: копия рядом с оригиналом не спасает
 * от потери телефона, а на iPhone скачанный файл ещё и найти негде.
 */
export function BackupSheet({ open, onClose }: BackupSheetProps) {
  const data = useFinance()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const risk = storageRisk()
  const canShare = canShareBackup()
  const last = data.settings.lastBackupAt

  async function handleShare() {
    setBusy(true)
    setError(null)

    try {
      const result = await shareBackup(data)

      if (result === 'cancelled') {
        setError('Отправка отменена — копия не сохранена.')
        return
      }

      actions.updateSettings({
        lastBackupAt: new Date().toISOString(),
        backupRemindedAt: undefined,
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  function handleDownload() {
    exportBackup(data)
    actions.updateSettings({
      lastBackupAt: new Date().toISOString(),
      backupRemindedAt: undefined,
    })
    onClose()
  }

  function handleLater() {
    actions.updateSettings({ backupRemindedAt: new Date().toISOString() })
    onClose()
  }

  return (
    <Sheet open={open} onClose={handleLater} title="Резервная копия">
      <div className="flex flex-col gap-4">
        <p className="px-1 text-[15px] leading-relaxed">
          {last
            ? `Последняя копия — ${formatFullDate(toDateKey(new Date(last)))}. Начался новый месяц, самое время сохранить свежую.`
            : 'Копии ваших данных ещё ни разу не было. Стоит сделать первую — это один файл.'}
        </p>

        <p className="rounded-2xl bg-surface px-4 py-3.5 text-[13px] leading-relaxed text-muted">
          {risk === 'fragile' ? (
            <>
              Данные привязаны к иконке на домашнем экране. Если её удалить, вся история исчезнет
              вместе с ней, и восстановить её на iPhone будет неоткуда.
            </>
          ) : risk === 'safe' ? (
            <>
              Данные лежат в хранилище приложения и никуда не денутся сами. Копия нужна на случай
              потери телефона или переезда на новый.
            </>
          ) : (
            <>
              Данные лежат в хранилище браузера, и очистка данных сайтов стирает их без
              предупреждения. Копия — единственный способ их вернуть.
            </>
          )}
        </p>

        {error && (
          <p className="px-1 text-[13px]" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}

        {canShare ? (
          <>
            <button
              onClick={handleShare}
              disabled={busy}
              className="w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-40"
            >
              Отправить копию
            </button>
            <p className="-mt-2 px-1 text-center text-[12px] leading-snug text-muted">
              Откроется меню «Поделиться» — сохраните файл в Telegram, на диск или в «Файлы».
              Лучше туда, где он переживёт телефон.
            </p>
            <button
              onClick={handleDownload}
              className="w-full rounded-2xl py-3 text-[15px] font-medium text-muted transition-all duration-200 active:scale-[0.98]"
            >
              Просто скачать файлом
            </button>
          </>
        ) : (
          <button
            onClick={handleDownload}
            className="w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
          >
            Скачать копию
          </button>
        )}

        <button
          onClick={handleLater}
          className="w-full rounded-2xl py-3 text-[15px] font-medium text-muted transition-all duration-200 active:scale-[0.98]"
        >
          Напомнить позже
        </button>
      </div>
    </Sheet>
  )
}
