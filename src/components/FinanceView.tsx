import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Play, RefreshCw, X } from 'lucide-react'
import { getOpsDepartment, fetchClients, fetchDeals, type PeriodPreset } from '../api/n8n'
import { useActionRunner } from '../hooks/useActionRunner'
import { FINANCE_MODES, type FinanceMode, type FieldDef } from '../config/financeModes'
import styles from './FinanceView.module.css'

type Row = Record<string, unknown>
type Option = { value: string; label: string }

function numberValue(value: unknown): number {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((i): i is Row => !!i && typeof i === 'object' && !Array.isArray(i)) : []
}

/** Находит ссылку на оплату/документ в произвольном результате хендлера. */
function findLink(result: unknown): string | null {
  let found: string | null = null
  const visit = (v: unknown, depth: number) => {
    if (found || depth > 6 || !v || typeof v !== 'object') return
    for (const [k, val] of Object.entries(v as Row)) {
      if (typeof val === 'string' && /^https?:\/\//.test(val) && /(payment|pay|link|url|pdf|invoice|checkout)/i.test(k)) {
        found = val
        return
      }
      if (val && typeof val === 'object') visit(val, depth + 1)
    }
  }
  visit(result, 0)
  return found
}

function useDbOptions() {
  const [clients, setClients] = useState<Option[] | null>(null)
  const [deals, setDeals] = useState<Option[] | null>(null)

  const ensure = async (source: FieldDef['source'], field: FieldDef): Promise<Option[]> => {
    const toOpt = (items: Row[]) => items.map((r) => ({
      value: String(r[field.optionValue ?? 'id'] ?? r.id ?? ''),
      label: String(r[field.optionLabel ?? 'name'] ?? r.name ?? r.title ?? r.id ?? '—'),
    })).filter((o) => o.value)
    if (source === 'clients') {
      if (clients) return clients
      const data = await fetchClients()
      const opts = toOpt(data.clients as Row[])
      setClients(opts)
      return opts
    }
    if (source === 'deals') {
      if (deals) return deals
      const data = await fetchDeals()
      const opts = toOpt(data.deals as Row[])
      setDeals(opts)
      return opts
    }
    return []
  }
  return { ensure }
}

export function FinanceView() {
  const [kpis, setKpis] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<FinanceMode | null>(null)
  const { runningKey, lastResult, run, clearResult } = useActionRunner()

  const load = () => {
    setLoading(true)
    setError(null)
    getOpsDepartment('finances', { preset: '30d' as PeriodPreset })
      .then((res) => setKpis(rows((res as Row).kpis)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить финансы'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const writeModes = useMemo(() => FINANCE_MODES.filter((m) => m.group === 'write'), [])
  const reportModes = useMemo(() => FINANCE_MODES.filter((m) => m.group === 'report'), [])

  const resultLink = lastResult?.status === 'done' ? findLink(lastResult.result) : null

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2>Финансы</h2>
          <p>Рабочие режимы: счета, платежи, транзакции, обязательства и отчёты. Параметры заполняются формой и уходят в реальные хендлеры n8n.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}><RefreshCw aria-hidden /> Обновить</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.kpis}>
        {(kpis.length ? kpis : [{ label: 'Финансы', value: 0 }]).map((item) => (
          <article key={String(item.label)}>
            <span>{String(item.label)}</span>
            <strong>{numberValue(item.value).toLocaleString('ru-RU')}</strong>
          </article>
        ))}
      </section>

      <h3 className={styles.groupTitle}>Операции</h3>
      <section className={styles.grid}>
        {writeModes.map((mode) => (
          <ModeCard key={mode.id} mode={mode} running={runningKey === mode.action_key} onOpen={() => { clearResult(); setActive(mode) }} />
        ))}
      </section>

      <h3 className={styles.groupTitle}>Отчёты</h3>
      <section className={styles.grid}>
        {reportModes.map((mode) => (
          <ModeCard key={mode.id} mode={mode} running={runningKey === mode.action_key} onOpen={() => { clearResult(); setActive(mode) }} />
        ))}
      </section>

      {active && (
        <ModeForm
          mode={active}
          onClose={() => setActive(null)}
          onSubmit={async (params) => {
            setActive(null)
            await run({
              action_key: active.action_key,
              workflow_id: active.workflow_id,
              department: 'finances',
              operation: active.operation,
              params,
              confirmed: true,
            })
          }}
        />
      )}

      {lastResult && (
        <div className={`${styles.resultPanel} ${lastResult.status === 'error' ? styles.resultError : styles.resultOk}`}>
          <div className={styles.resultHead}>
            {lastResult.status === 'error' ? <AlertTriangle aria-hidden /> : <CheckCircle2 aria-hidden />}
            <strong>{lastResult.status === 'error' ? 'Ошибка' : 'Готово'}</strong>
            <button type="button" onClick={clearResult} aria-label="Закрыть"><X aria-hidden /></button>
          </div>
          <p>{lastResult.status === 'error' ? (lastResult.error ?? 'Не удалось выполнить') : (lastResult.text ?? 'Действие выполнено')}</p>
          {resultLink && (
            <a className={styles.payLink} href={resultLink} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden /> Открыть ссылку
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function ModeCard({ mode, running, onOpen }: { mode: FinanceMode; running: boolean; onOpen: () => void }) {
  return (
    <article className={styles.card}>
      <div>
        <strong>{mode.label}</strong>
        <p>{mode.description}</p>
      </div>
      <button type="button" onClick={onOpen} disabled={running}>
        {running ? <Loader2 className={styles.spin} aria-hidden /> : <Play aria-hidden />}
        {running ? 'Выполняется…' : 'Открыть'}
      </button>
    </article>
  )
}

function ModeForm({ mode, onClose, onSubmit }: { mode: FinanceMode; onClose: () => void; onSubmit: (params: Record<string, unknown>) => void }) {
  const initial = useMemo(() => {
    const v: Record<string, string> = {}
    for (const f of mode.fields) v[f.name] = f.default ?? ''
    return v
  }, [mode])
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [dbOptions, setDbOptions] = useState<Record<string, Option[]>>({})
  const [loadingField, setLoadingField] = useState<string | null>(null)
  const { ensure } = useDbOptions()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const f of mode.fields) {
        if (f.type === 'db-select' && f.source) {
          setLoadingField(f.name)
          try {
            const opts = await ensure(f.source, f)
            if (!cancelled) setDbOptions((prev) => ({ ...prev, [f.name]: opts }))
          } catch {
            if (!cancelled) setDbOptions((prev) => ({ ...prev, [f.name]: [] }))
          } finally {
            if (!cancelled) setLoadingField(null)
          }
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }))

  const missing = mode.fields.filter((f) => f.required && !String(values[f.name] ?? '').trim()).map((f) => f.label)

  const submit = () => {
    if (missing.length) return
    const params: Record<string, unknown> = {}
    for (const f of mode.fields) {
      const raw = values[f.name]
      if (raw === undefined || raw === '') continue
      if (f.type === 'number') params[f.name] = numberValue(raw)
      else if (f.type === 'checkbox') params[f.name] = raw === 'on'
      else params[f.name] = raw
    }
    if (mode.buildMessage) params.user_message = mode.buildMessage(values)
    onSubmit(params)
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3>{mode.label}</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть"><X aria-hidden /></button>
        </div>
        <p className={styles.modalDesc}>{mode.description}</p>
        <div className={styles.formBody}>
          {mode.fields.length === 0 && <div className={styles.noFields}>Дополнительные параметры не требуются.</div>}
          {mode.fields.map((f) => (
            <label key={f.name} className={styles.field}>
              <span>{f.label}{f.required && <em> *</em>}</span>
              {f.type === 'textarea' ? (
                <textarea rows={3} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
              ) : f.type === 'select' ? (
                <select value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'db-select' ? (
                <select value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} disabled={loadingField === f.name}>
                  <option value="">{loadingField === f.name ? 'Загрузка…' : '— не выбрано —'}</option>
                  {(dbOptions[f.name] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'checkbox' ? (
                <input type="checkbox" checked={values[f.name] === 'on'} onChange={(e) => set(f.name, e.target.checked ? 'on' : '')} />
              ) : (
                <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
              )}
              {f.help && <small>{f.help}</small>}
            </label>
          ))}
        </div>
        {mode.confirm && <div className={styles.confirmNote}><AlertTriangle aria-hidden /> Действие выполнится на проде (реальный счёт/платёж).</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Отмена</button>
          <button type="button" className={styles.btnPrimary} onClick={submit} disabled={missing.length > 0} title={missing.length ? `Заполните: ${missing.join(', ')}` : ''}>
            {mode.group === 'report' ? 'Построить' : 'Запустить'}
          </button>
        </div>
      </div>
    </div>
  )
}
