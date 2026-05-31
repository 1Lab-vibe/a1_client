import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { LoginScreen } from './components/LoginScreen'
import { Desktop } from './components/Desktop'
import { AppHeader, getViewTitle } from './components/AppHeader'
import { COO } from './components/COO'
import { Clients } from './components/Clients'
import { Settings } from './components/Settings'
import { Leads } from './components/Leads'
import { Deals } from './components/Deals'
import { Invoices } from './components/Invoices'
import { Chat } from './components/Chat'
import { Dashboard } from './components/Dashboard'
import { Reports } from './components/Reports'
import { Onboarding } from './components/Onboarding'
import { DomainView } from './components/DomainView'
import { OpsDepartmentView } from './components/OpsDepartmentView'
import type { ViewId } from './types'

const SETTINGS_VIEW_SECTIONS: Record<string, string> = {
  'settings/configuration': 'company',
  'settings/company': 'company',
  'settings/channels': 'channels',
  'settings/marketing': 'marketing',
  'settings/products': 'products',
  'settings/icp': 'icp',
  'settings/dashboard': 'dashboard',
  'settings/subscription': 'subscription',
  'settings/crm': 'crm',
  'settings/policies': 'policies',
  'settings/prompts': 'prompts',
  'settings/handlers': 'handlers',
  'settings/integrations': 'integrations',
  'settings/users': 'access',
  'settings/permissions': 'access',
  'settings/action_templates': 'action_templates',
  'settings/letter_templates': 'letter_templates',
}

function App() {
  const { isLoggedIn, company_id } = useAuth()
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
    case 'reports':
      content = <Reports />
      break
    case 'ops/tasks':
      content = <OpsDepartmentView viewId={viewId} title={getViewTitle(viewId)} />
      break
    case 'chat':
      content = <Chat />
      break
    case 'settings/configuration':
      content = <Settings initialSection={SETTINGS_VIEW_SECTIONS[viewId]} />
      break
    case 'settings/onboarding':
      content = <Onboarding />
      break
    default:
      if (viewId.startsWith('settings/')) {
        content = <Settings initialSection={SETTINGS_VIEW_SECTIONS[viewId]} />
      } else if (viewId.startsWith('ops/')) {
        content = <OpsDepartmentView viewId={viewId} title={getViewTitle(viewId)} />
      } else {
        content = <DomainView viewId={viewId} title={getViewTitle(viewId)} />
      }
  }

  return (
    <div className="app">
      <Desktop currentViewId={viewId} onSelectView={setViewId} />
      <section className="shell-main" key={company_id ?? 'no-company'}>
        <AppHeader viewId={viewId} />
        <main className="main-window">
          {content}
        </main>
      </section>
    </div>
  )
}

export default App
