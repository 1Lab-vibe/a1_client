import { lazy, Suspense, useSyncExternalStore } from 'react'
import { useAuth } from './context/AuthContext'
import { LoginScreen } from './components/LoginScreen'
import { CrmWorkspace } from './components/CrmWorkspace'
import { DEFAULT_SECTIONS, toViewId } from './config/sections'
import { Desktop } from './components/Desktop'
import { AppHeader, getViewTitle } from './components/AppHeader'
import { COO } from './components/COO'
import { Settings } from './components/Settings'
import { Chat } from './components/Chat'
import { Dashboard } from './components/Dashboard'
import { Reports } from './components/Reports'
import { Onboarding } from './components/Onboarding'
import { DomainView } from './components/DomainView'
import { OpsDepartmentView } from './components/OpsDepartmentView'
import { FinanceView } from './components/FinanceView'
import { SalesView } from './components/SalesView'
import { MISView } from './components/MISView'
import type { ViewId } from './types'

const ProcurementView = lazy(() =>
  import('./procurement/ProcurementView').then((module) => ({
    default: module.ProcurementView,
  })),
)

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

const views = new Set(DEFAULT_SECTIONS.flatMap(s=>s.children ? s.children.map(c=>toViewId(s.id,c.id)) : [s.id]))
function subscribe(fn:()=>void){window.addEventListener('hashchange',fn);return ()=>window.removeEventListener('hashchange',fn)}
function currentView(): ViewId {
  const path=location.hash.slice(2).split('?')[0]
  if (/^crm\/deals\/[a-f0-9-]{36}$/i.test(path)) return 'crm/deals'
  if(path==='ops/supply')return 'supply'
  return views.has(path)?path as ViewId:'coo'
}
function App() {
  const { isLoggedIn, company_id } = useAuth()
  const viewId = useSyncExternalStore(subscribe,currentView)

  if (!isLoggedIn) {
    return <LoginScreen />
  }

  let content: React.ReactNode = null
  switch (viewId) {
    case 'coo':
      content = <COO />
      break
    case 'sales':
      content = <SalesView />
      break
    case 'crm/dashboard':
      content = <Dashboard />
      break
    case 'crm/leads':
      content = <CrmWorkspace key="Leads" entity="leads"/>
      break
    case 'crm/deals':
      content = <CrmWorkspace key="Deals" entity="deals"/>
      break
    case 'crm/clients':
      content = <CrmWorkspace key="Clients" entity="clients"/>
      break
    case 'crm/invoices':
      content = <CrmWorkspace key="Invoices" entity="invoices"/>
      break
    case 'reports':
      content = <Reports />
      break
    case 'ops/tasks':
      content = (
        <OpsDepartmentView viewId={viewId} title={getViewTitle(viewId)} />
      )
      break
    case 'mis':
      content = <MISView />
      break
    case 'ops/finances':
      content = <FinanceView />
      break
    case 'supply':
    case 'ops/supply':
      content = (
        <Suspense fallback={<p role="status">Загружаем снабжение…</p>}>
          <ProcurementView />
        </Suspense>
      )
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
        content = (
          <OpsDepartmentView viewId={viewId} title={getViewTitle(viewId)} />
        )
      } else {
        content = <DomainView viewId={viewId} title={getViewTitle(viewId)} />
      }
  }

  return (
    <div className="app">
      <Desktop
        currentViewId={viewId}
        onSelectView={id=>{location.hash='/'+id}}
      />
      <section className="shell-main" key={company_id ?? 'no-company'}>
        <AppHeader viewId={viewId} />
        <main className="main-window">{content}</main>
      </section>
    </div>
  )
}

export default App
