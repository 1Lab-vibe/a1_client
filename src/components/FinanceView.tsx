import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { getOpsDepartment, type PeriodPreset } from '../api/n8n'
import { ScenarioModes } from './ScenarioModes'
import styles from './FinanceView.module.css'

type Row = Record<string, unknown>

function numberValue(value: unknown): number {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((i): i is Row => !!i && typeof i === 'object' && !Array.isArray(i)) : []
}

export function FinanceView() {
  const [kpis, setKpis] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getOpsDepartment('finances', { preset: '30d' as PeriodPreset })
      .then((res) => setKpis(rows((res as Row).kpis)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить финансы'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const kpiCards = useMemo(() => (kpis.length ? kpis : [{ label: 'Финансы', value: 0 }]), [kpis])

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2>Финансы</h2>
          <p>Рабочие режимы: счета, платежи, транзакции, обязательства и отчёты. Выберите режим, подставьте свои значения в запрос — он уйдёт в пайплайн, а ответ придёт в COO и Telegram.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}><RefreshCw aria-hidden /> Обновить</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.kpis}>
        {kpiCards.map((item) => (
          <article key={String(item.label)}>
            <span>{String(item.label)}</span>
            <strong>{numberValue(item.value).toLocaleString('ru-RU')}</strong>
          </article>
        ))}
      </section>

      <h3 className={styles.sectionTitle}>Режимы</h3>
      <ScenarioModes domain="finance" />
    </div>
  )
}
