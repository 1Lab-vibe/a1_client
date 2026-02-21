import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { LoginScreen } from './components/LoginScreen'
import { Desktop } from './components/Desktop'
import { COO } from './components/COO'
import { Tasks } from './components/Tasks'
import { Clients } from './components/Clients'
import { Settings } from './components/Settings'
import { Leads } from './components/Leads'
import { Chat } from './components/Chat'
import type { AppView } from './types'

function App() {
  const { isLoggedIn } = useAuth()
  const [view, setView] = useState<AppView>('coo')

  if (!isLoggedIn) {
    return <LoginScreen />
  }

  return (
    <div className="app">
      <Desktop currentView={view} onSelectView={setView} />
      <main className="main-window">
        {view === 'coo' && <COO />}
        {view === 'tasks' && <Tasks />}
        {view === 'clients' && <Clients />}
        {view === 'settings' && <Settings />}
        {view === 'leads' && <Leads />}
        {view === 'chat' && <Chat />}
      </main>
    </div>
  )
}

export default App
