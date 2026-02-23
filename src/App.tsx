import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { LoginScreen } from './components/LoginScreen'
import { Desktop } from './components/Desktop'
import { COO } from './components/COO'
import { Tasks } from './components/Tasks'
import { Clients } from './components/Clients'
import { Settings } from './components/Settings'
import { Leads } from './components/Leads'
import { Deals } from './components/Deals'
import { Invoices } from './components/Invoices'
import { Chat } from './components/Chat'
import { Dashboard } from './components/Dashboard'
import { BlockPlaceholder } from './components/BlockPlaceholder'
import type { ViewId } from './types'

const VIEW_TITLES: Record<string, string> = {
  'ops/finances': 'Финансы',
  'ops/marketing': 'Маркетинг',
  'ops/accounting': 'Бухгалтерия',
  'ops/hr': 'HR',
  'ops/legal': 'Юр. служба',
  'ops/supply': 'Снабжение',
  'ops/logistics': 'Логистика',
  'ops/it': 'IT',
  'settings/configuration': 'Конфигурация',
  'settings/crm': 'CRM',
  'settings/policies': 'Политики',
  'settings/prompts': 'Промты',
  'settings/handlers': 'Хендлеры',
  'settings/integrations': 'Интеграции',
  'settings/users': 'Пользователи',
  'settings/permissions': 'Права доступа',
  'settings/action_templates': 'Шаблоны действий',
  'settings/letter_templates': 'Шаблоны писем',
}

function getViewTitle(viewId: ViewId): string {
  return VIEW_TITLES[viewId] ?? viewId
}

function App() {
  const { isLoggedIn } = useAuth()
  const [viewId, setViewId] = useState<ViewId>('coo')

  if (!isLoggedIn) {
    return <LoginScreen />
  }

  let content: React.ReactNode = null
  switch (viewId) {
    case 'coo':
      content = <COO />
      break
    case 'crm/dashboard':
      content = <Dashboard />
      break
    case 'crm/leads':
      content = <Leads />
      break
    case 'crm/deals':
      content = <Deals />
      break
    case 'crm/clients':
      content = <Clients />
      break
    case 'crm/invoices':
      content = <Invoices />
      break
    case 'ops/tasks':
      content = <Tasks />
      break
    case 'ops/finances':
    case 'ops/marketing':
    case 'ops/accounting':
    case 'ops/hr':
    case 'ops/legal':
    case 'ops/supply':
    case 'ops/logistics':
    case 'ops/it':
      content = <BlockPlaceholder viewId={viewId} title={getViewTitle(viewId)} />
      break
    case 'chat':
      content = <Chat />
      break
    case 'settings/configuration':
      content = <Settings />
      break
    case 'settings/crm':
    case 'settings/policies':
    case 'settings/prompts':
    case 'settings/handlers':
    case 'settings/integrations':
    case 'settings/users':
    case 'settings/permissions':
    case 'settings/action_templates':
    case 'settings/letter_templates':
      content = <BlockPlaceholder viewId={viewId} title={getViewTitle(viewId)} />
      break
    default:
      content = <BlockPlaceholder viewId={viewId} title={getViewTitle(viewId)} />
  }

  return (
    <div className="app">
      <Desktop currentViewId={viewId} onSelectView={setViewId} />
      <main className="main-window">
        {content}
      </main>
    </div>
  )
}

export default App
