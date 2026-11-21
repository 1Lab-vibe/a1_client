import { useEffect, useMemo, useState } from 'react'
import { Database, RefreshCw, Table2 } from 'lucide-react'
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
  if (typeof value === 'object') return Array.isArray(value) ? value.filter(v=>typeof v==='string').join(', ') : '—'
  return String(value)
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('No item to return') || message.includes('(500)')) {
    return 'Данные раздела сейчас недоступны. Повторите обновление.'
  }
  return message || 'Не удалось загрузить данные раздела.'
}

const labels:Record<string,string>={name:'Название',title:'Название',description:'Описание',status:'Статус',stage:'Стадия',amount:'Сумма',currency:'Валюта',email:'Email',phone:'Телефон',due_date:'Срок',created_at:'Дата создания'};

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
    return Object.keys(labels).filter(key=>rows.some(row=>row[key]!=null && typeof row[key]!=='object'))
  }, [rows])

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2>{title}</h2>
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
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  {keys.map((key) => <th key={key}>{labels[key]}</th>)}
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
        </div>
      )}
    </div>
  )
}
