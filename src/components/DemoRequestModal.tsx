import { useState } from 'react'
import type { DemoRequest, DemoResult } from '../types'
import styles from './DemoRequestModal.module.css'

interface DemoRequestModalProps {
  onClose: () => void
  onSubmit: (data: DemoRequest) => Promise<void>
  result: DemoResult | null
}

export function DemoRequestModal({ onClose, onSubmit, result }: DemoRequestModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState('')
  const [region, setRegion] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setLoading(true)
    try {
      await onSubmit({ name: name.trim(), email: email.trim(), source: source.trim(), region: region.trim() })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <h2>Запросить демо доступ</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        {result === null ? (
          <form onSubmit={handleSubmit} className={styles.form}>
            <label>
              <span>Имя</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ваше имя" />
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@example.com" />
            </label>
            <label>
              <span>Откуда узнали о нас</span>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Поиск, рекомендация, реклама..." />
            </label>
            <label>
              <span>Регион</span>
              <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Город или регион" />
            </label>
            <div className={styles.foot}>
              <button type="button" onClick={onClose}>Отмена</button>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.result}>
            {result === 'access' ? (
              <>
                <div className={styles.resultIcon}>✓</div>
                <p className={styles.resultTitle}>Доступ одобрен</p>
                <p className={styles.resultText}>Проверьте почту — мы отправили данные для входа.</p>
              </>
            ) : (
              <>
                <div className={styles.resultIconDeny}>✕</div>
                <p className={styles.resultTitle}>В доступе отказано</p>
                <p className={styles.resultText}>К сожалению, заявка не одобрена. Обратитесь в поддержку.</p>
              </>
            )}
            <button type="button" className={styles.resultBtn} onClick={onClose}>
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
