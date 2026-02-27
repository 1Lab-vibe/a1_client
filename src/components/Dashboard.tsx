import { useState, useEffect, useMemo } from 'react'
import { getDashboard } from '../api/n8n'
import { SectionUnderDevelopment } from './SectionUnderDevelopment'
import styles from './Dashboard.module.css'

const TEMPLATES = ['default', 'sales', 'ops', 'custom']

/** Системные поля — не показываем в виджетах */
const SYSTEM_KEYS = new Set([
  'id',
  'updated_at',
  'created_at',
  'closed_at',
  'stage_updated_at',
  'last_event_at',
  'next_follow_up_at',
  'timestamp',
  'createdAt',
  'updatedAt',
])
function isSystemKey(key: string): boolean {
  if (SYSTEM_KEYS.has(key)) return true
  if (key.endsWith('_at')) return true
  if (key === 'id' || key.toLowerCase() === 'id') return true
  return false
}

/** Ключи, которые считаем «основными» (имя, название) — всегда показываем */
const NAME_KEYS = new Set(['name', 'title', 'title_ru', 'имя', 'название', 'label'])

function isDisplayableKey(key: string, value: unknown): boolean {
  if (isSystemKey(key)) return false
  if (NAME_KEYS.has(key)) return true
  if (typeof value === 'number') return true
  return false
}

/** Русские названия для типичных ключей дашборда */
const DASHBOARD_LABELS: Record<string, string> = {
  sales: 'Продажи',
  revenue: 'Выручка',
  income: 'Доход',
  orders: 'Заказы',
  leads: 'Лиды',
  tasks: 'Задачи',
  conversion: 'Конверсия',
  total: 'Итого',
  count: 'Количество',
  amount: 'Сумма',
  summary: 'Итоги',
  metrics: 'Метрики',
  kpi: 'KPI',
  this_month: 'За месяц',
  this_week: 'За неделю',
  today: 'Сегодня',
  active: 'Активные',
  new: 'Новые',
  closed: 'Закрытые',
  pending: 'В ожидании',
  default: 'По умолчанию',
  custom: 'Свой',
  ops: 'Операции',
  crm: 'CRM',
  deals: 'Сделки',
  clients: 'Клиенты',
  invoices: 'Счета',
}
function getDashboardLabel(key: string): string {
  return DASHBOARD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Разбить данные на подразделы: если есть крупный раздел "crm", раскрываем его в отдельные виджеты */
function getSections(data: Record<string, unknown>): Array<{ key: string; label: string; value: unknown }> {
  const sections: Array<{ key: string; label: string; value: unknown }> = []
  const crmKey = Object.keys(data).find((k) => k.toLowerCase() === 'crm')
  if (crmKey && data[crmKey] !== null && typeof data[crmKey] === 'object' && !Array.isArray(data[crmKey])) {
    const crm = data[crmKey] as Record<string, unknown>
    Object.entries(data).forEach(([key, value]) => {
      if (key !== crmKey) sections.push({ key, label: getDashboardLabel(key), value })
    })
    Object.entries(crm).forEach(([subKey, subValue]) => {
      sections.push({ key: subKey, label: getDashboardLabel(subKey), value: subValue })
    })
  } else {
    Object.entries(data).forEach(([key, value]) => {
      sections.push({ key, label: getDashboardLabel(key), value })
    })
  }
  return sections
}

/** Отфильтровать ключи объекта для отображения */
function getVisibleKeys(obj: Record<string, unknown>): string[] {
  return Object.entries(obj)
    .filter(([k, v]) => isDisplayableKey(k, v))
    .map(([k]) => k)
}

function formatCell(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'boolean') return val ? 'Да' : 'Нет'
  return String(val)
}

export function Dashboard() {
  const [template, setTemplate] = useState('default')
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getDashboard(template)
      .then((res) => setData(res || {}))
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false))
  }, [template])

  const sections = useMemo(() => (data ? getSections(data) : []), [data])

  if (error) {
    return <SectionUnderDevelopment title="Дашборд" />
  }

  if (loading && !data) {
    return (
      <div className={styles.wrap}>
        <header className={styles.header}>
          <h1 className={styles.title}>Дашборд</h1>
          <select
            className={styles.select}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            disabled={loading}
          >
            {TEMPLATES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </header>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Дашборд</h1>
        <select
          className={styles.select}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          disabled={loading}
        >
          {TEMPLATES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </header>
      {data && Object.keys(data).length === 0 && !error && (
        <div className={styles.stub}>Нет данных. Webhook: getDashboard ({template})</div>
      )}
      {sections.length > 0 && (
        <div className={styles.content}>
          <div className={styles.tiles}>
            {sections.map(({ key, label, value }) => (
              <div key={key} className={styles.widget}>
                <div className={styles.widgetTitle}>{label}</div>
                <div className={styles.widgetBody}>
                  <WidgetContent value={value} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Содержимое виджета: таблица или плитка ключ-значение, без дерева */
function WidgetContent({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className={styles.placeholder}>—</span>

  if (Array.isArray(value)) {
    const items = value as unknown[]
    if (items.length === 0) return <span className={styles.placeholder}>Нет данных</span>
    const first = items[0]
    if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
      const rows = items as Record<string, unknown>[]
      const allKeys = new Set<string>()
      rows.forEach((r) => getVisibleKeys(r).forEach((k) => allKeys.add(k)))
      const keys = Array.from(allKeys)
      if (keys.length === 0) return <span className={styles.placeholder}>—</span>
      return (
        <table className={styles.table}>
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k}>{getDashboardLabel(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((row, i) => (
              <tr key={i}>
                {keys.map((k) => (
                  <td key={k}>{formatCell(row[k])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    return (
      <table className={styles.table}>
        <tbody>
          {items.slice(0, 15).map((item, i) => (
            <tr key={i}>
              <td>{formatCell(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = getVisibleKeys(obj)
    if (keys.length === 0) return <span className={styles.placeholder}>—</span>
    return (
      <table className={styles.kvTable}>
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <th>{getDashboardLabel(k)}</th>
              <td>{formatCell(obj[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return <span className={styles.singleValue}>{formatCell(value)}</span>
}
