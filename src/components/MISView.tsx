import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, RefreshCw, TrendingUp } from 'lucide-react'
import { getMisDashboard, type MisDashboard, type MisDeviation, type MisKpi, type PeriodPreset } from '../api/n8n'
import styles from './MISView.module.css'

const PERIODS: { id: PeriodPreset; label: string; days: number }[] = [
  { id: '7d', label: '7 дней', days: 7 },
  { id: '30d', label: '30 дней', days: 30 },
  { id: '90d' as PeriodPreset, label: '90 дней', days: 90 },
  { id: 'quarter', label: 'Квартал', days: 90 },
]

function fmt(value: number, unit?: string): string {
  const n = Number(value) || 0
  if (unit === 'RUB') return n.toLocaleString('ru-RU') + ' ₽'
  if (unit === 'pct') return n.toLocaleString('ru-RU') + '%'
  return n.toLocaleString('ru-RU')
}

function KpiCard({ kpi }: { kpi: MisKpi }) {
  return (
    <article className={styles.kpi}>
      <span>{kpi.label}</span>
      <strong>{fmt(kpi.value, kpi.unit)}</strong>
    </article>
  )
}

function DeviationCard({ d, positive }: { d: MisDeviation; positive: boolean }) {
  return (
    <article className={`${styles.devCard} ${positive ? styles.devPos : styles.devNeg}`}>
      <div className={styles.devHead}>
        {positive ? <ArrowUpRight aria-hidden /> : <ArrowDownRight aria-hidden />}
        <strong>{d.metric}</strong>
        <span className={styles.devDay}>{d.day}</span>
        {d.severity && <span className={styles.badge}>{d.severity}</span>}
      </div>
      <p className={styles.devNarr}>{d.narrative ?? `${d.metric}: Δ ${Math.round(d.delta ?? 0).toLocaleString('ru-RU')} (z=${d.z ?? '—'})`}</p>
      {(d.drivers ?? []).length > 0 && (
        <ul className={styles.drivers}>
          {(d.drivers ?? []).slice(0, 3).map((dr, i) => (
            <li key={i}>
              <span className={styles.driverPct}>{dr.pct != null ? `${dr.pct}%` : '—'}</span>
              <span className={styles.driverTitle}>{dr.title || dr.event_type}</span>
              {dr.why && <em>{dr.why}</em>}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export function MISView() {
  const [period, setPeriod] = useState<PeriodPreset>('90d' as PeriodPreset)
  const [data, setData] = useState<MisDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getMisDashboard({ preset: period })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить MIS'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [period])

  const chart = useMemo(() => (data?.cash_series ?? []).map((p) => ({ label: p.d.slice(5), value: p.v, baseline: p.b ?? 0 })), [data])
  const pos = data?.events_positive ?? []
  const neg = data?.events_negative ?? []

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2><TrendingUp aria-hidden /> MIS — динамика и события</h2>
          <p>Приход денег в динамике, отклонения (рост/падение) и события, которые на них повлияли. Данные из бэкенда A1.</p>
        </div>
        <div className={styles.headRight}>
          <div className={styles.periods}>
            {PERIODS.map((p) => (
              <button key={p.label} type="button" className={period === p.id ? styles.periodActive : ''} onClick={() => setPeriod(p.id)}>{p.label}</button>
            ))}
          </div>
          <button type="button" className={styles.refresh} onClick={load} disabled={loading}><RefreshCw aria-hidden /></button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.state}>Загружаем данные MIS…</div>}

      {!loading && data && (
        <>
          <section className={styles.kpis}>
            {data.kpis.length > 0 ? data.kpis.map((k) => <KpiCard key={k.key} kpi={k} />) : <div className={styles.empty}>Нет метрик за период.</div>}
          </section>

          <section className={styles.chartPanel}>
            <div className={styles.panelHead}><h3>Приход денег (cash&nbsp;in)</h3><span>{data.period_days} дн.</span></div>
            {chart.some((c) => c.value > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="misGold" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#f3c85d" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#f3c85d" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(216,183,92,0.14)" vertical={false} />
                  <XAxis dataKey="label" stroke="#7e8798" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis stroke="#7e8798" tickLine={false} axisLine={false} width={48} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(216,183,92,.35)', borderRadius: 8, color: '#f7f4ec' }} />
                  <Area type="monotone" dataKey="value" name="Приход" stroke="#f3c85d" fill="url(#misGold)" strokeWidth={2} />
                  <Line type="monotone" dataKey="baseline" name="База" stroke="#35d5ff" strokeWidth={1} dot={false} strokeDasharray="4 3" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className={styles.empty}>За выбранный период не было прихода денег для графика.</div>}
          </section>

          <section className={styles.devGrid}>
            <div className={styles.devCol}>
              <h3 className={styles.colTitle}><ArrowUpRight aria-hidden /> Положительные события <span>{pos.length}</span></h3>
              {pos.length > 0 ? pos.map((d, i) => <DeviationCard key={i} d={d} positive />) : <div className={styles.empty}>Нет положительных отклонений.</div>}
            </div>
            <div className={styles.devCol}>
              <h3 className={styles.colTitle}><ArrowDownRight aria-hidden /> Отрицательные события <span>{neg.length}</span></h3>
              {neg.length > 0 ? neg.map((d, i) => <DeviationCard key={i} d={d} positive={false} />) : <div className={styles.empty}>Нет отрицательных отклонений.</div>}
            </div>
          </section>

          <section className={styles.bottomGrid}>
            <div className={styles.tablePanel}>
              <div className={styles.panelHead}><h3>Журнал событий</h3><span>{data.events.length}</span></div>
              <table>
                <thead><tr><th>Дата</th><th>Событие</th><th>Категория</th><th>Значимость</th></tr></thead>
                <tbody>
                  {data.events.length > 0 ? data.events.slice(0, 20).map((e, i) => (
                    <tr key={i}><td>{e.at}</td><td>{e.title}</td><td>{e.category ?? '—'}</td><td>{e.magnitude ?? '—'}</td></tr>
                  )) : <tr><td colSpan={4}>Нет событий за период.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className={styles.tablePanel}>
              <div className={styles.panelHead}><h3>Что работает (playbook)</h3><span>{data.playbook.length}</span></div>
              <table>
                <thead><tr><th>Действие</th><th>Метрика</th><th>+раз</th><th>Ср. вклад</th></tr></thead>
                <tbody>
                  {data.playbook.length > 0 ? data.playbook.map((p, i) => (
                    <tr key={i}><td>{p.event_type}</td><td>{p.metric}</td><td>{p.pos ?? '—'}</td><td>{p.pct != null ? `${p.pct}%` : '—'}</td></tr>
                  )) : <tr><td colSpan={4}>Пока нет накопленных выводов.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
