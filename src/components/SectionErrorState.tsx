import { AlertTriangle, RefreshCw } from 'lucide-react'
import styles from './SectionErrorState.module.css'

interface SectionErrorStateProps {
  title: string
  message: string
  onRetry: () => void
}

export function SectionErrorState({ title, message, onRetry }: SectionErrorStateProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <AlertTriangle aria-hidden />
        <div>
          <h2>{title}</h2>
          <p>{message}</p>
        </div>
        <button type="button" onClick={onRetry}>
          <RefreshCw aria-hidden />
          Повторить
        </button>
      </div>
    </div>
  )
}
