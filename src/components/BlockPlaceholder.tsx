import { useState, useEffect } from 'react'
import { getBlockData } from '../api/n8n'
import styles from './BlockPlaceholder.module.css'

interface BlockPlaceholderProps {
  viewId: string
  title: string
}

export function BlockPlaceholder({ viewId, title }: BlockPlaceholderProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getBlockData(viewId)
      .then((res) => setData(res || {}))
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false))
  }, [viewId])

  if (loading) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.error}>{error}</div>
      </div>
    )
  }

  const isEmpty = !data || Object.keys(data).length === 0
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{title}</h1>
      {isEmpty ? (
        <div className={styles.stub}>
          <span className={styles.stubIcon}>📋</span>
          <p>Раздел в разработке</p>
          <p className={styles.hint}>Webhook: getBlockData ({viewId})</p>
        </div>
      ) : (
        <pre className={styles.json}>{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  )
}
