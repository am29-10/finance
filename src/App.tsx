import { useEffect, useState } from 'react'
import { TabBar, TAB_IDS, type TabId } from './components/TabBar'
import { OperationSheet } from './components/OperationSheet'
import { LockScreen } from './components/LockScreen'
import { HomeScreen } from './screens/HomeScreen'
import { OperationsScreen } from './screens/OperationsScreen'
import { AnalyticsScreen } from './screens/AnalyticsScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { LoansScreen } from './screens/LoansScreen'
import { actions, useFinance } from './data/store'
import type { Operation } from './data/types'

const TAB_KEY = 'finance:tab'
const UNLOCKED_KEY = 'finance:unlocked'

export default function App() {
  const data = useFinance()

  const [tab, setTab] = useState<TabId>(() => {
    const saved = localStorage.getItem(TAB_KEY)
    return TAB_IDS.includes(saved as TabId) ? (saved as TabId) : 'home'
  })

  /**
   * Разблокировка живёт в sessionStorage: переключение вкладок и обновление страницы
   * код не спрашивают, а новый запуск приложения — спрашивает.
   */
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCKED_KEY) === '1')

  /**
   * Кредиты — не вкладка, а экран поверх главной: таббар и так занят,
   * а заходят сюда реже, чем в операции.
   */
  const [loansOpen, setLoansOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(TAB_KEY, tab)
  }, [tab])

  /**
   * Платежи по кредитам начисляются по календарю, а не по действиям человека.
   * Приложение может провисеть открытым через полночь и через смену месяца,
   * поэтому сверяем графики и при запуске, и при каждом возвращении на экран.
   */
  useEffect(() => {
    actions.syncLoans()

    const onVisible = () => {
      if (document.visibilityState === 'visible') actions.syncLoans()
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const [sheet, setSheet] = useState<{ operation?: Operation } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function openSheet(operation?: Operation) {
    setSheet({ operation })
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setTimeout(() => setSheet(null), 260)
  }

  if (data.settings.pinHash && !unlocked) {
    return (
      <LockScreen
        pinHash={data.settings.pinHash}
        onUnlock={() => {
          sessionStorage.setItem(UNLOCKED_KEY, '1')
          setUnlocked(true)
        }}
      />
    )
  }

  if (loansOpen) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col">
        <main className="flex-1 pb-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <LoansScreen onBack={() => setLoansOpen(false)} />
        </main>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <main className="flex-1 pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {tab === 'home' && (
          <HomeScreen
            onEdit={openSheet}
            onShowAll={() => setTab('operations')}
            onOpenLoans={() => setLoansOpen(true)}
          />
        )}
        {tab === 'operations' && <OperationsScreen onEdit={openSheet} />}
        {tab === 'analytics' && <AnalyticsScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </main>

      <TabBar active={tab} onChange={setTab} onAdd={() => openSheet()} />

      {sheet && (
        <OperationSheet
          key={sheet.operation?.id ?? 'new'}
          open={sheetOpen}
          operation={sheet.operation}
          onClose={closeSheet}
        />
      )}
    </div>
  )
}
