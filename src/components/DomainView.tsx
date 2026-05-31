import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Database, RefreshCw, Table2 } from 'lucide-react'
import { getBlockData } from '../api/n8n'
import styles from './DomainView.module.css'

interface DomainViewProps {
  viewId: string
  title: string
}

function findRows(data: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!data) return []
  for (const key of ['rows', 'items', 'tasks', 'users', 'integrations', 'templates', 'documents', 'records']) {
    const value = data[key]
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    }
  }
  const nested = data.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return findRows(nested as Record<string, unknown>)
  if (Array.isArray(nested)) return nested.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
  return []
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('No item to return') || message.includes('(500)')) {
    return 'Данные раздела сейчас недоступны. Проверьте workflow-контракт getBlockData и повторите обновление.'
  }
  return message || 'Не удалось загрузить данные раздела.'
}

function viewDomain(viewId: string): string {
  return viewId.split('/')[0] || viewId
}

export function DomainView({ viewId, title }: DomainViewProps) {
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
  const meta = data && typeof data.meta === 'object' && !Array.isArray(data.meta) ? data.meta as Record<string, unknown> : {}
  const domain = displayValue(data?.domain ?? meta.domain ?? viewDomain(viewId))
  const resolvedView = displayValue(data?.view_id ?? data?.viewId ?? meta.view_id ?? viewId)
  const source = displayValue(data?.source ?? meta.source ?? 'n8n')

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2>{title}</h2>
          <p>Операционный раздел компании: реальные строки из backend-контракта, фильтрация по выбранной компании и безопасные пустые состояния.</p>
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
        <>
          <div className={styles.kpis}>
            <div>
              <Table2 aria-hidden />
              <span>Строк</span>
              <strong>{rows.length}</strong>
            </div>
            <div>
              <BarChart3 aria-hidden />
              <span>Домен</span>
              <strong>{domain}</strong>
            </div>
            <div>
              <Database aria-hidden />
              <span>Источник</span>
              <strong>{source}</strong>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  {keys.map((key) => <th key={key}>{key}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={String(row.id ?? row.key ?? index)}>
                    {keys.map((key) => <td key={key}>{displayValue(row[key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          <Database aria-hidden />
          <strong>Для выбранной компании нет строк</strong>
          <span>Раздел подключен к backend и готов к данным. Когда в prod n8n появятся записи для {resolvedView}, они отобразятся здесь без изменения фронта.</span>
        </div>
      )}
    </div>
  )
}
