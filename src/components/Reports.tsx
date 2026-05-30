import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, Download, RefreshCw } from 'lucide-react'
import { getReport, type PeriodFilter, type PeriodPreset } from '../api/n8n'
import styles from './Reports.module.css'

const REPORTS = [
  { id: 'sales', label: 'Продажи', metric: 'Выручка / сделки' },
  { id: 'crm', label: 'CRM', metric: 'Лиды / клиенты' },
  { id: 'coo', label: 'COO', metric: 'Сообщения / вложения' },
  { id: 'ops', label: 'Операции', metric: 'Задачи / SLA' },
  { id: 'integrations', label: 'Интеграции', metric: 'Sync / ошибки' },
]

const PERIODS: Array<{ id: PeriodPreset; label: string }> = [
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: 'month', label: 'Месяц' },
  { id: 'quarter', label: 'Квартал' },
  { id: 'custom', label: 'Период' },
]

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function rowsFrom(data: Record<string, unknown> | null) {
  if (!data) return []
  const source = data.timeline ?? data.series ?? data.rows ?? data.items ?? data.data
  if (!Array.isArray(source)) return []
  return source
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .slice(0, 24)
    .map((item, index) => ({
      label: String(item.date ?? item.day ?? item.week ?? item.label ?? item.status ?? item.name ?? index + 1),
      value: toNumber(item.value ?? item.count ?? item.total ?? item.amount ?? item.messages ?? item.leads),
      secondary: toNumber(item.secondary ?? item.deals ?? item.errors ?? item.tasks ?? item.attachments),
    }))
}

function makePeriod(preset: PeriodPreset, from: string, to: string): PeriodFilter {
  return preset === 'custom' ? { preset, from, to } : { preset }
}

function friendlyReportError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('No item to return') || message.includes('(500)')) {
    return 'Не удалось получить данные отчета для выбранного раздела. Проверьте настройки отчета и повторите запрос.'
  }
  return 'Не удалось загрузить отчет. Проверьте webhook-контракт `getReport`.'
}

export function Reports() {
  const [reportId, setReportId] = useState('sales')
  const [period, setPeriod] = useState<PeriodPreset>('30d')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getReport(reportId, makePeriod(period, dateFrom, dateTo))
      .then((res) => setData(res || {}))
      .catch((e) => {
        setData({})
        setError(friendlyReportError(e))
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [reportId, period, dateFrom, dateTo])

  const rows = useMemo(() => rowsFrom(data), [data])
  const current = REPORTS.find((item) => item.id === reportId) ?? REPORTS[0]

  return (
    <div className={styles.wrap}>
      <aside className={styles.rail}>
        {REPORTS.map((report) => (
          <button
            key={report.id}
            type="button"
            className={report.id === reportId ? styles.activeReport : ''}
            onClick={() => setReportId(report.id)}
          >
            <strong>{report.label}</strong>
            <span>{report.metric}</span>
          </button>
        ))}
      </aside>

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <div>
            <h2>{current.label}</h2>
            <p>{current.metric}</p>
          </div>
          <div className={styles.actions}>
            <div className={styles.periods}>
              {PERIODS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={period === item.id ? styles.activePeriod : ''}
                  onClick={() => setPeriod(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button type="button" className={styles.iconBtn} onClick={load} title="Обновить">
              <RefreshCw aria-hidden />
            </button>
            <button type="button" className={styles.iconBtn} title="Экспорт будет подключен через n8n">
              <Download aria-hidden />
            </button>
          </div>
        </div>

        {period === 'custom' && (
          <div className={styles.customPeriod}>
            <CalendarDays aria-hidden />
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <span>по</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
        )}

        {error && <div className={styles.notice}>{error}</div>}

        <div className={styles.grid}>
          <article className={styles.panel}>
            <h3>Динамика</h3>
            {rows.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={rows}>
                  <defs>
                    <linearGradient id="reportGold" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#f3c85d" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#f3c85d" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(216,183,92,0.14)" vertical={false} />
                  <XAxis dataKey="label" stroke="#7e8798" tickLine={false} axisLine={false} />
                  <YAxis stroke="#7e8798" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(216,183,92,.35)', borderRadius: 8, color: '#f7f4ec' }} />
                  <Area type="monotone" dataKey="value" stroke="#f3c85d" fill="url(#reportGold)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.empty}>{loading ? 'Загружаем отчет...' : 'За выбранный период нет временного ряда для графика'}</div>
            )}
          </article>

          <article className={styles.panel}>
            <h3>Сравнение</h3>
            {rows.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rows}>
                  <CartesianGrid stroke="rgba(216,183,92,0.14)" vertical={false} />
                  <XAxis dataKey="label" stroke="#7e8798" tickLine={false} axisLine={false} />
                  <YAxis stroke="#7e8798" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(216,183,92,.35)', borderRadius: 8, color: '#f7f4ec' }} />
                  <Bar dataKey="value" fill="#35d5ff" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="secondary" fill="#f3c85d" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.empty}>Нет числовых данных для сравнения</div>
            )}
          </article>
        </div>

        {rows.length > 0 && (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Период / статус</th>
                  <th>Основной показатель</th>
                  <th>Доп. показатель</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.value.toLocaleString('ru-RU')}</td>
                    <td>{row.secondary.toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
