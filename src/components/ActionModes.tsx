import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Play, X } from 'lucide-react'
import { fetchClients, fetchDeals, fetchLeads } from '../api/n8n'
import { useActionRunner } from '../hooks/useActionRunner'
import type { ActionMode, FieldDef } from '../config/modeTypes'
import styles from './ActionModes.module.css'

type Row = Record<string, unknown>
type Option = { value: string; label: string }

function numberValue(value: unknown): number {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
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
  const [cache, setCache] = useState<Record<string, Option[]>>({})

  const ensure = async (field: FieldDef): Promise<Option[]> => {
    const src = field.source
    if (!src) return []
    if (cache[src]) return cache[src]
    const toOpt = (items: Row[]) => items.map((r) => ({
      value: String(r[field.optionValue ?? 'id'] ?? r.id ?? ''),
      label: String(r[field.optionLabel ?? 'name'] ?? r.name ?? r.title ?? r.id ?? '—'),
    })).filter((o) => o.value)
    let opts: Option[] = []
    if (src === 'clients') opts = toOpt((await fetchClients()).clients as Row[])
    else if (src === 'deals') opts = toOpt((await fetchDeals()).deals as Row[])
    else if (src === 'leads') opts = toOpt((await fetchLeads()).leads as Row[])
    setCache((prev) => ({ ...prev, [src]: opts }))
    return opts
  }
  return { ensure }
}

interface ActionModesProps {
  modes: ActionMode[]
  department: string
  /** заголовки групп (по полю mode.group); если не задано — один общий грид */
  groups?: { id: string; title: string }[]
}

export function ActionModes({ modes, department, groups }: ActionModesProps) {
  const [active, setActive] = useState<ActionMode | null>(null)
  const { runningKey, lastResult, run, clearResult } = useActionRunner()

  const resultLink = lastResult?.status === 'done' ? findLink(lastResult.result) : null
  const rendered = groups ?? [{ id: '__all__', title: '' }]

  return (
    <>
      {rendered.map((g) => {
        const list = groups ? modes.filter((m) => m.group === g.id) : modes
        if (list.length === 0) return null
        return (
          <div key={g.id}>
            {g.title && <h3 className={styles.groupTitle}>{g.title}</h3>}
            <section className={styles.grid}>
              {list.map((mode) => (
                <ModeCard key={mode.id} mode={mode} running={runningKey === mode.action_key} onOpen={() => { clearResult(); setActive(mode) }} />
              ))}
            </section>
          </div>
        )
      })}

      {active && (
        <ModeForm
          mode={active}
          onClose={() => setActive(null)}
          onSubmit={async (params) => {
            setActive(null)
            await run({
              action_key: active.action_key,
              workflow_id: active.workflow_id,
              department,
              operation: active.operation,
              params,
              confirmed: true,
            })
          }}
        />
      )}

      {lastResult && (
        <div className={`${styles.resultPanel} ${lastResult.status === 'error' ? styles.resultError : styles.resultOk}`} role="status">
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
    </>
  )
}

function ModeCard({ mode, running, onOpen }: { mode: ActionMode; running: boolean; onOpen: () => void }) {
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

function ModeForm({ mode, onClose, onSubmit }: { mode: ActionMode; onClose: () => void; onSubmit: (params: Record<string, unknown>) => void }) {
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
            const opts = await ensure(f)
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
        {mode.confirm && <div className={styles.confirmNote}><AlertTriangle aria-hidden /> Действие выполнится на проде (реальные данные).</div>}
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
