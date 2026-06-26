import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, CheckCircle2, Loader2, PlayCircle, RefreshCw, Table2, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getOpsDepartment, type PeriodPreset } from '../api/n8n'
import { useActionRunner } from '../hooks/useActionRunner'
import styles from './OpsDepartmentView.module.css'

type Row = Record<string, unknown>
type OpsTab = 'main' | 'reports' | 'tasks'

/** requires_human_approval может прийти булевым или строкой ("true"/"1"/"yes") */
function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return ['true', '1', 'yes', 'да'].includes(value.trim().toLowerCase())
  return false
}

const RISK_LABELS: Record<string, string> = { low: 'низкий', medium: 'средний', high: 'высокий' }

interface PendingAction {
  action_key: string
  action_name: string
  workflow_id?: string
  department: string
  risk_level: string
  requires_approval: boolean
}

const PERIODS: Array<{ id: PeriodPreset; label: string }> = [
  { id: 'today', label: 'Сегодня' },
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: 'month', label: 'Месяц' },
  { id: 'quarter', label: 'Квартал' },
]

const DEPARTMENT_LABELS: Record<string, string> = {
  tasks: 'Задачи',
  finances: 'Финансы',
  marketing: 'Маркетинг',
  accounting: 'Бухгалтерия',
  hr: 'HR',
  legal: 'Юр. служба',
  supply: 'Снабжение',
  logistics: 'Логистика',
  it: 'IT',
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => !!item && typeof item === 'object' && !Array.isArray(item))
    : []
}

function numberValue(value: unknown): number {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function taskTitle(row: Row): string {
  const params = row.params && typeof row.params === 'object' && !Array.isArray(row.params) ? row.params as Row : {}
  return display(row.title ?? row.name ?? params.title ?? params.summary ?? row.task_type ?? 'Задача')
}

export function OpsDepartmentView({ viewId, title }: { viewId: string; title: string }) {
  const department = viewId.split('/')[1] || 'tasks'
  const [tab, setTab] = useState<OpsTab>('main')
  const [period, setPeriod] = useState<PeriodPreset>('30d')
  const [data, setData] = useState<Row>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const { runningKey, lastResult, run, clearResult } = useActionRunner()

  const load = () => {
    setLoading(true)
    setError(null)
    getOpsDepartment(department, { preset: period })
      .then((res) => setData(res || {}))
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить OPS-раздел'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [department, period])

  const actions = useMemo(() => rows(data.actions), [data])
  const tasks = useMemo(() => rows(data.tasks), [data])
  const reports = useMemo(() => rows(data.reports), [data])
  const kpis = useMemo(() => rows(data.kpis), [data])
  const chartData = useMemo(() => reports.map((row) => ({
    label: display(row.label ?? row.status ?? row.name),
    value: numberValue(row.value ?? row.count ?? row.total),
  })).filter((row) => row.value > 0), [reports])

  const launch = (action: Row) => {
    const requiresApproval = isTruthy(action.requires_human_approval)
    const riskLevel = display(action.risk_level).toLowerCase()
    const meta: PendingAction = {
      action_key: String(action.action_key ?? action.id ?? ''),
      action_name: display(action.action_name ?? action.action_key),
      workflow_id: action.workflow_id != null ? String(action.workflow_id) : undefined,
      department,
      risk_level: riskLevel,
      requires_approval: requiresApproval,
    }
    if (!meta.action_key) return
    // Подтверждение для действий с approval или высоким риском
    if (requiresApproval || riskLevel === 'high') {
      setPending(meta)
      return
    }
    void doRun(meta)
  }

  const doRun = async (meta: PendingAction) => {
    setPending(null)
    const result = await run({
      action_key: meta.action_key,
      workflow_id: meta.workflow_id,
      department: meta.department,
      confirmed: meta.requires_approval || meta.risk_level === 'high',
    })
    // После успешного выполнения обновляем данные отдела
    if (result.status === 'done') load()
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2>{title || DEPARTMENT_LABELS[department] || department}</h2>
          <p>Функциональное окно отдела: действия из action handlers, отчеты и задачи только выбранного направления.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          <RefreshCw aria-hidden />
          Обновить
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {[
            ['main', 'Главное'],
            ['reports', 'Отчеты'],
            ['tasks', 'Задачи'],
          ].map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? styles.active : ''} onClick={() => setTab(id as OpsTab)}>
              {label}
            </button>
          ))}
        </div>
        <div className={styles.periods}>
          {PERIODS.map((item) => (
            <button key={item.id} type="button" className={period === item.id ? styles.periodActive : ''} onClick={() => setPeriod(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.state}>Загружаем данные отдела...</div>}

      {!loading && tab === 'main' && (
        <>
          <section className={styles.kpis}>
            {(kpis.length ? kpis : [
              { label: 'Действий', value: actions.length },
              { label: 'Задач', value: tasks.length },
              { label: 'Отчетов', value: reports.length },
            ]).map((item) => (
              <article key={display(item.label)}>
                <CheckCircle2 aria-hidden />
                <span>{display(item.label)}</span>
                <strong>{numberValue(item.value).toLocaleString('ru-RU')}</strong>
              </article>
            ))}
          </section>

          <section className={styles.actionGrid}>
            {actions.length > 0 ? actions.map((action) => (
              <article key={display(action.id ?? action.action_key)} className={styles.actionCard}>
                <div>
                  <strong>{display(action.action_name ?? action.action_key)}</strong>
                  <p>{display(action.description)}</p>
                </div>
                <dl>
                  <div><dt>Тип</dt><dd>{display(action.handler_type)}</dd></div>
                  <div><dt>Риск</dt><dd>{display(action.risk_level)}</dd></div>
                  <div><dt>Approval</dt><dd>{display(action.requires_human_approval)}</dd></div>
                </dl>
                <button
                  type="button"
                  className={styles.runBtn}
                  onClick={() => launch(action)}
                  disabled={runningKey != null}
                  title={isTruthy(action.requires_human_approval) ? 'Требует подтверждения перед запуском' : 'Запустить действие'}
                >
                  {runningKey === display(action.action_key ?? action.id) ? <Loader2 className={styles.spin} aria-hidden /> : <PlayCircle aria-hidden />}
                  {runningKey === display(action.action_key ?? action.id) ? 'Выполняется…' : 'Запуск'}
                </button>
              </article>
            )) : (
              <div className={styles.empty}>Для отдела пока нет включенных action handlers.</div>
            )}
          </section>
        </>
      )}

      {!loading && tab === 'reports' && (
        <section className={styles.reportGrid}>
          <article className={styles.chartPanel}>
            <div className={styles.panelHead}>
              <h3>Срез задач отдела</h3>
              <BarChart3 aria-hidden />
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(216,183,92,0.14)" vertical={false} />
                  <XAxis dataKey="label" stroke="#7e8798" tickLine={false} axisLine={false} />
                  <YAxis stroke="#7e8798" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(216,183,92,.35)', borderRadius: 8, color: '#f7f4ec' }} />
                  <Bar dataKey="value" fill="#f3c85d" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className={styles.empty}>Нет агрегатов за выбранный период.</div>}
          </article>
          <article className={styles.tablePanel}>
            <div className={styles.panelHead}>
              <h3>Агрегаты</h3>
              <Table2 aria-hidden />
            </div>
            <table>
              <thead><tr><th>Срез</th><th>Значение</th></tr></thead>
              <tbody>
                {reports.length > 0 ? reports.map((row, index) => (
                  <tr key={`${display(row.label ?? row.status)}-${index}`}>
                    <td>{display(row.label ?? row.status ?? row.name)}</td>
                    <td>{numberValue(row.value ?? row.count ?? row.total).toLocaleString('ru-RU')}</td>
                  </tr>
                )) : <tr><td colSpan={2}>Нет данных</td></tr>}
              </tbody>
            </table>
          </article>
        </section>
      )}

      {!loading && tab === 'tasks' && (
        <section className={styles.tablePanel}>
          <div className={styles.panelHead}>
            <h3>Задачи отдела</h3>
            <Table2 aria-hidden />
          </div>
          <table>
            <thead>
              <tr><th>Задача</th><th>Тип</th><th>Статус</th><th>Создана</th></tr>
            </thead>
            <tbody>
              {tasks.length > 0 ? tasks.map((task, index) => (
                <tr key={display(task.id ?? index)}>
                  <td>{taskTitle(task)}</td>
                  <td>{display(task.task_type ?? task.type)}</td>
                  <td>{display(task.status)}</td>
                  <td>{display(task.created_at ?? task.createdAt)}</td>
                </tr>
              )) : <tr><td colSpan={4}>Для отдела нет задач за выбранный период.</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {pending && (
        <div className={styles.modalOverlay} onClick={() => setPending(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <AlertTriangle aria-hidden />
              <h3>Подтвердите запуск</h3>
            </div>
            <p>
              Действие <strong>{pending.action_name}</strong> будет выполнено на проде.
              {pending.requires_approval && ' Оно отмечено как требующее подтверждения человеком.'}
              {pending.risk_level === 'high' && ` Уровень риска: ${RISK_LABELS[pending.risk_level] ?? pending.risk_level}.`}
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setPending(null)}>Отмена</button>
              <button type="button" className={styles.btnPrimary} onClick={() => void doRun(pending)}>Запустить</button>
            </div>
          </div>
        </div>
      )}

      {lastResult && (
        <div className={`${styles.toast} ${lastResult.status === 'error' ? styles.toastError : styles.toastOk}`} role="status">
          <span>
            {lastResult.status === 'error'
              ? (lastResult.error ?? 'Не удалось выполнить действие')
              : (lastResult.text ?? 'Действие выполнено')}
          </span>
          <button type="button" onClick={clearResult} aria-label="Закрыть"><X aria-hidden /></button>
        </div>
      )}
    </div>
  )
}
