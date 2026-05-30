import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, BriefcaseBusiness, Building2, CheckCircle2, FileText, MessageSquareText, RefreshCw, Target, TriangleAlert } from 'lucide-react'
import { getDashboard, type PeriodFilter, type PeriodPreset } from '../api/n8n'
import styles from './Dashboard.module.css'

const TEMPLATES = [
  { id: 'default', label: 'Общий' },
  { id: 'sales', label: 'Продажи' },
  { id: 'ops', label: 'Операции' },
  { id: 'custom', label: 'Свой' },
]

const PERIODS: Array<{ id: PeriodPreset; label: string }> = [
  { id: 'today', label: 'Сегодня' },
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: 'month', label: 'Месяц' },
  { id: 'quarter', label: 'Квартал' },
  { id: 'custom', label: 'Период' },
]

type DataRecord = Record<string, unknown>

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/\s/g, '').replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function deepFindNumber(data: unknown, keys: string[]): number {
  if (!data || typeof data !== 'object') return 0
  const record = data as DataRecord
  for (const [key, value] of Object.entries(record)) {
    const normalized = key.toLowerCase()
    if (keys.some((candidate) => normalized.includes(candidate))) {
      const num = toNumber(value)
      if (num) return num
    }
    if (value && typeof value === 'object') {
      const nested = deepFindNumber(value, keys)
      if (nested) return nested
    }
  }
  return 0
}

function collectRows(data: unknown): DataRecord[] {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data)) return data.filter((item): item is DataRecord => !!item && typeof item === 'object' && !Array.isArray(item))
  const record = data as DataRecord
  for (const key of ['timeline', 'series', 'chart', 'rows', 'items', 'data']) {
    const value = record[key]
    if (Array.isArray(value)) return collectRows(value)
  }
  for (const value of Object.values(record)) {
    if (Array.isArray(value) && value.length > 0) return collectRows(value)
  }
  return []
}

function normalizeSeries(data: unknown): Array<{ label: string; value: number; secondary?: number }> {
  const rows = collectRows(data)
  return rows.slice(0, 14).map((row, index) => {
    const label = String(row.date ?? row.day ?? row.month ?? row.stage ?? row.status ?? row.label ?? row.name ?? `${index + 1}`)
    const value = toNumber(row.value ?? row.count ?? row.total ?? row.leads ?? row.amount ?? row.messages)
    const secondary = toNumber(row.deals ?? row.closed ?? row.revenue ?? row.tasks)
    return { label, value, secondary }
  }).filter((row) => row.value !== 0 || row.secondary !== 0)
}

function rowsFromKey(data: DataRecord | null, key: string): DataRecord[] {
  const source = data?.table && typeof data.table === 'object' && !Array.isArray(data.table)
    ? (data.table as DataRecord)[key]
    : null
  return Array.isArray(source)
    ? source.filter((item): item is DataRecord => !!item && typeof item === 'object' && !Array.isArray(item))
    : []
}

function breakdownRows(data: DataRecord | null): Array<{ group: string; label: string; value: number; amount?: number }> {
  const source = data?.breakdown && typeof data.breakdown === 'object' && !Array.isArray(data.breakdown)
    ? data.breakdown as DataRecord
    : {}
  return Object.entries(source).flatMap(([group, value]) => {
    if (!Array.isArray(value)) return []
    return value
      .filter((item): item is DataRecord => !!item && typeof item === 'object' && !Array.isArray(item))
      .slice(0, 5)
      .map((item) => ({
        group,
        label: String(item.label ?? item.name ?? item.status ?? '-'),
        value: toNumber(item.value ?? item.count ?? item.total),
        amount: item.amount == null ? undefined : toNumber(item.amount),
      }))
  }).slice(0, 12)
}

function buildKpis(data: DataRecord | null) {
  const apiKpis = Array.isArray(data?.kpis)
    ? (data.kpis as unknown[])
      .filter((item): item is DataRecord => !!item && typeof item === 'object' && !Array.isArray(item))
      .map((item, index) => {
        const id = String(item.id ?? item.label ?? index)
        const icon = id.includes('revenue') ? BriefcaseBusiness
          : id.includes('customer') ? Building2
            : id.includes('message') ? MessageSquareText
              : id.includes('attachment') ? FileText
                : id.includes('error') ? TriangleAlert
                  : id.includes('task') ? CheckCircle2
                    : id.includes('deal') ? BriefcaseBusiness
                      : Target
        const tone = id.includes('error') ? 'danger' : id.includes('revenue') || id.includes('deal') ? 'cyan' : id.includes('customer') ? 'green' : 'gold'
        return { label: String(item.label ?? id), value: toNumber(item.value), icon, tone }
      })
    : []
  if (apiKpis.length > 0) return apiKpis
  return [
    { label: 'Лиды', value: deepFindNumber(data, ['lead', 'лид']), icon: Target, tone: 'gold' },
    { label: 'Сделки', value: deepFindNumber(data, ['deal', 'сдел']), icon: BriefcaseBusiness, tone: 'cyan' },
    { label: 'Клиенты', value: deepFindNumber(data, ['client', 'customer', 'клиент']), icon: Building2, tone: 'green' },
    { label: 'Сообщения', value: deepFindNumber(data, ['message', 'сообщ']), icon: MessageSquareText, tone: 'blue' },
    { label: 'Задачи', value: deepFindNumber(data, ['task', 'задач']), icon: CheckCircle2, tone: 'gold' },
  ]
}

function periodFilter(preset: PeriodPreset, from: string, to: string): PeriodFilter {
  return preset === 'custom' ? { preset, from, to } : { preset }
}

function friendlyDashboardError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('No item to return') || message.includes('(500)')) {
    return 'n8n пока не вернул данные для этого дашборда.'
  }
  return 'Не удалось загрузить дашборд. Проверьте webhook-контракт `getDashboard`.'
}

export function Dashboard() {
  const [template, setTemplate] = useState('default')
  const [period, setPeriod] = useState<PeriodPreset>('30d')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState<DataRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getDashboard(template, periodFilter(period, dateFrom, dateTo))
      .then((res) => setData(res || {}))
      .catch((e) => setError(friendlyDashboardError(e)))
      .finally(() => setLoading(false))
  }, [template, period, dateFrom, dateTo, refreshKey])

  const kpis = useMemo(() => buildKpis(data), [data])
  const series = useMemo(() => normalizeSeries(data), [data])
  const breakdown = useMemo(() => breakdownRows(data), [data])
  const recentLeads = useMemo(() => rowsFromKey(data, 'leads'), [data])
  const recentDeals = useMemo(() => rowsFromKey(data, 'deals'), [data])
  const hasData = data && Object.keys(data).length > 0

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.segmented}>
          {TEMPLATES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={template === item.id ? styles.active : ''}
              onClick={() => setTemplate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
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
        {period === 'custom' && (
          <div className={styles.dateRange}>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
        )}
      </div>

      {error && (
        <div className={styles.error}>
          <Activity aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <section className={styles.kpiGrid}>
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <article key={kpi.label} className={styles.kpiCard} data-tone={kpi.tone}>
              <div className={styles.kpiIcon}><Icon aria-hidden /></div>
              <span>{kpi.label}</span>
              <strong>{loading ? '...' : kpi.value.toLocaleString('ru-RU')}</strong>
            </article>
          )
        })}
      </section>

      <section className={styles.panels}>
        <article className={styles.chartPanel}>
          <div className={styles.panelHead}>
            <div>
              <h2>Динамика</h2>
              <p>Ответ `getDashboard` за выбранный период</p>
            </div>
            <button type="button" onClick={() => setRefreshKey((value) => value + 1)} title="Обновить">
              <RefreshCw aria-hidden />
            </button>
          </div>
          {series.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="a1Gold" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#f3c85d" stopOpacity={0.48} />
                    <stop offset="95%" stopColor="#f3c85d" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(216,183,92,0.14)" vertical={false} />
                <XAxis dataKey="label" stroke="#7e8798" tickLine={false} axisLine={false} />
                <YAxis stroke="#7e8798" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(216,183,92,.35)', borderRadius: 8, color: '#f7f4ec' }} />
                <Area type="monotone" dataKey="value" stroke="#f3c85d" fill="url(#a1Gold)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.emptyChart}>
              {loading ? 'Загружаем данные...' : hasData ? 'В ответе нет временного ряда для графика' : 'Пока нет данных за выбранный период'}
            </div>
          )}
        </article>

        <article className={styles.chartPanel}>
          <div className={styles.panelHead}>
            <div>
              <h2>Срез по статусам</h2>
              <p>Лиды, сделки, задачи или сообщения</p>
            </div>
          </div>
          {series.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={series}>
                <CartesianGrid stroke="rgba(216,183,92,0.14)" vertical={false} />
                <XAxis dataKey="label" stroke="#7e8798" tickLine={false} axisLine={false} />
                <YAxis stroke="#7e8798" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(216,183,92,.35)', borderRadius: 8, color: '#f7f4ec' }} />
                <Bar dataKey="value" fill="#35d5ff" radius={[6, 6, 0, 0]} />
                <Bar dataKey="secondary" fill="#f3c85d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.emptyChart}>
              {loading ? 'Загружаем данные...' : 'Для графика нужен массив `timeline`, `series`, `rows` или `items`'}
            </div>
          )}
        </article>
      </section>

      {hasData && series.length === 0 && !loading && (
        <div className={styles.dataNotice}>
          Данные получены, но в ответе нет массива `timeline`, `series`, `rows` или `items` для построения графика.
        </div>
      )}

      <section className={styles.detailGrid}>
        <article className={styles.tablePanel}>
          <div className={styles.panelHead}>
            <div>
              <h2>Структура</h2>
              <p>Статусы лидов, сделок, задач и интеграций</p>
            </div>
          </div>
          {breakdown.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Группа</th>
                  <th>Срез</th>
                  <th>Кол-во</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr key={`${row.group}-${row.label}`}>
                    <td>{row.group.replace(/_/g, ' ')}</td>
                    <td>{row.label}</td>
                    <td>{row.value.toLocaleString('ru-RU')}</td>
                    <td>{row.amount == null ? '-' : row.amount.toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyMini}>Нет данных для среза</div>
          )}
        </article>

        <article className={styles.tablePanel}>
          <div className={styles.panelHead}>
            <div>
              <h2>Последняя активность CRM</h2>
              <p>Лиды и сделки из prod за выбранную компанию</p>
            </div>
          </div>
          {[...recentLeads.map((row) => ({ type: 'Лид', row })), ...recentDeals.map((row) => ({ type: 'Сделка', row }))].slice(0, 10).length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Название</th>
                  <th>Статус</th>
                  <th>Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {[...recentLeads.map((row) => ({ type: 'Лид', row })), ...recentDeals.map((row) => ({ type: 'Сделка', row }))].slice(0, 10).map(({ type, row }, index) => (
                  <tr key={`${type}-${row.id ?? index}`}>
                    <td>{type}</td>
                    <td>{String(row.title ?? row.name ?? row.company_name ?? '-')}</td>
                    <td>{String(row.stage ?? row.status ?? '-')}</td>
                    <td>{String(row.updated_at ?? '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyMini}>Нет последних записей</div>
          )}
        </article>
      </section>
    </div>
  )
}
