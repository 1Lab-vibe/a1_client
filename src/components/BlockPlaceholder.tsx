import { useEffect, useMemo, useState } from 'react'
import { Database, RefreshCw } from 'lucide-react'
import { getBlockData } from '../api/n8n'
import styles from './BlockPlaceholder.module.css'

interface BlockPlaceholderProps {
  viewId: string
  title: string
}

function findRows(data: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!data) return []
  for (const key of ['rows', 'items', 'data', 'tasks', 'users', 'integrations', 'templates']) {
    const value = data[key]
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    }
  }
  return []
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('No item to return') || message.includes('(500)')) {
    return 'Данные раздела пока недоступны. Повторите обновление или проверьте workflow сервиса.'
  }
  return 'Не удалось загрузить данные раздела.'
}

export function BlockPlaceholder({ viewId, title }: BlockPlaceholderProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getBlockData(viewId)
      .then((res) => setData(res || {}))
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }

  useEffect(load, [viewId])

  const rows = useMemo(() => findRows(data), [data])
  const keys = useMemo(() => {
    const collected = new Set<string>()
    rows.slice(0, 20).forEach((row) => Object.keys(row).slice(0, 8).forEach((key) => collected.add(key)))
    return Array.from(collected).slice(0, 8)
  }, [rows])

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2>{title}</h2>
          <p>Рабочий раздел с данными выбранной компании, периодами и операционными строками.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} title="Обновить">
          <RefreshCw aria-hidden />
          Обновить
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.state}>Загружаем данные...</div>
      ) : rows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {keys.map((key) => <th key={key}>{key}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.id ?? index)}>
                  {keys.map((key) => <td key={key}>{displayValue(row[key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>
          <Database aria-hidden />
          <strong>По выбранной компании пока нет строк</strong>
          <span>Можно продолжать работу: раздел готов к данным из n8n, а пустое состояние означает отсутствие записей в текущем контуре или периоде.</span>
        </div>
      )}
    </div>
  )
}
