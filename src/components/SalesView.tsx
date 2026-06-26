import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { getOpsDepartment, getReport, type PeriodPreset } from '../api/n8n'
import { ActionModes } from './ActionModes'
import { Deals } from './Deals'
import { SALES_MODES } from '../config/salesModes'
import styles from './SalesView.module.css'

type Row = Record<string, unknown>
type Tab = 'operations' | 'pipeline'

function numberValue(value: unknown): number {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((i): i is Row => !!i && typeof i === 'object' && !Array.isArray(i)) : []
}

const GROUPS = [
  { id: 'work', title: 'Операции' },
  { id: 'report', title: 'Отчёты' },
]

/** KPI продаж: берём leads/deals/revenue/customers из getReport, дополняем счётчиками из getOpsDepartment. */
function pickSalesKpis(report: Row, dept: Row): Row[] {
  const fromReport = rows(report.kpis).filter((k) => ['leads', 'deals', 'revenue', 'customers'].includes(String(k.id)))
  if (fromReport.length) return fromReport
  return rows(dept.kpis)
}

export function SalesView() {
  const [tab, setTab] = useState<Tab>('operations')
  const [report, setReport] = useState<Row>({})
  const [dept, setDept] = useState<Row>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([
      getReport('sales', { preset: '30d' as PeriodPreset }),
      getOpsDepartment('sales', { preset: '30d' as PeriodPreset }),
    ])
      .then(([rep, dp]) => { setReport(rep as Row); setDept(dp as Row) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить продажи'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const kpis = useMemo(() => pickSalesKpis(report, dept), [report, dept])

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2>Продажи</h2>
          <p>Воронка сделок и рабочие режимы Sales Manager: обработка сделок, реактивация, отчёты — через реальные хендлеры n8n.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}><RefreshCw aria-hidden /> Обновить</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.kpis}>
        {(kpis.length ? kpis : [{ label: 'Продажи', value: 0 }]).map((item) => (
          <article key={String(item.label ?? item.id)}>
            <span>{String(item.label ?? item.id)}</span>
            <strong>{numberValue(item.value).toLocaleString('ru-RU')}</strong>
          </article>
        ))}
      </section>

      <div className={styles.tabs}>
        <button type="button" className={tab === 'operations' ? styles.active : ''} onClick={() => setTab('operations')}>Операции</button>
        <button type="button" className={tab === 'pipeline' ? styles.active : ''} onClick={() => setTab('pipeline')}>Воронка</button>
      </div>

      {tab === 'operations' ? (
        <ActionModes modes={SALES_MODES} department="sales" groups={GROUPS} />
      ) : (
        <div className={styles.pipelineWrap}>
          <Deals />
        </div>
      )}
    </div>
  )
}
