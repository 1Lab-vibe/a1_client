import { useState, useEffect } from 'react'
import { getDashboard } from '../api/n8n'
import { SectionUnderDevelopment } from './SectionUnderDevelopment'
import styles from './Dashboard.module.css'

const TEMPLATES = ['default', 'sales', 'ops', 'custom']

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
      {data && Object.keys(data).length > 0 && (
        <div className={styles.content}>
          <DashboardStructure data={data} />
        </div>
      )}
    </div>
  )
}

function DashboardStructure({ data }: { data: Record<string, unknown> }) {
  return (
    <div className={styles.structure}>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className={styles.block}>
          <div className={styles.blockTitle}>{key}</div>
          <div className={styles.blockBody}>
            {value === null || value === undefined ? (
              '—'
            ) : Array.isArray(value) ? (
              <ul className={styles.list}>
                {value.map((item, i) => (
                  <li key={i}>
                    {typeof item === 'object' && item !== null ? (
                      <DashboardStructure data={item as Record<string, unknown>} />
                    ) : (
                      String(item)
                    )}
                  </li>
                ))}
              </ul>
            ) : typeof value === 'object' ? (
              <DashboardStructure data={value as Record<string, unknown>} />
            ) : (
              String(value)
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
