import { useAuth } from '../context/AuthContext'
import type { AppView } from '../types'
import styles from './Desktop.module.css'

const icons: { id: AppView; label: string; icon: string }[] = [
  { id: 'coo', label: 'COO', icon: '◉' },
  { id: 'tasks', label: 'Задачи', icon: '☑' },
  { id: 'clients', label: 'Клиенты', icon: '👥' },
  { id: 'leads', label: 'Лиды', icon: '📋' },
  { id: 'chat', label: 'Чат', icon: '💬' },
  { id: 'settings', label: 'Настройки', icon: '⚙' },
]

interface DesktopProps {
  currentView: AppView
  onSelectView: (v: AppView) => void
}

export function Desktop({ currentView, onSelectView }: DesktopProps) {
  const { email, logout } = useAuth()
  return (
    <aside className={styles.desktop}>
      <div className={styles.brand}>A1</div>
      <nav className={styles.icons}>
        {icons.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className={`${styles.icon} ${currentView === id ? styles.active : ''}`}
            onClick={() => onSelectView(id)}
            title={label}
          >
            <span className={styles.iconSymbol}>{icon}</span>
            <span className={styles.iconLabel}>{label}</span>
          </button>
        ))}
      </nav>
      <div className={styles.footer}>
        {email && <span className={styles.email} title={email}>{email}</span>}
        <button type="button" className={styles.logoutBtn} onClick={logout} title="Выйти">
          Выйти
        </button>
      </div>
    </aside>
  )
}
