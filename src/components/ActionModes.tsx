import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Play, X } from 'lucide-react'
import { fetchClients, fetchDeals, fetchLeads, sendIntakeMessage } from '../api/n8n'
import type { ActionMode, FieldDef } from '../config/modeTypes'
import styles from './ActionModes.module.css'

type Row = Record<string, unknown>
type Option = { value: string; label: string }

interface SubmitState {
  runningKey: string | null
  note: { ok: boolean; text: string } | null
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

export function ActionModes({ modes, groups }: ActionModesProps) {
  const [active, setActive] = useState<ActionMode | null>(null)
  const [state, setState] = useState<SubmitState>({ runningKey: null, note: null })

  const submit = async (mode: ActionMode, text: string) => {
    setActive(null)
    setState({ runningKey: mode.id, note: null })
    try {
      const res = await sendIntakeMessage(text)
      const extra = res.text ? ` ${res.text}` : ''
      setState({
        runningKey: null,
        note: { ok: true, text: `Запрос «${mode.label}» отправлен в обработку. Ответ придёт в раздел COO и в Telegram.${extra}` },
      })
    } catch (e) {
      setState({ runningKey: null, note: { ok: false, text: e instanceof Error ? e.message : 'Не удалось отправить запрос' } })
    }
  }

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
                <ModeCard key={mode.id} mode={mode} running={state.runningKey === mode.id} onOpen={() => { setState((s) => ({ ...s, note: null })); setActive(mode) }} />
              ))}
            </section>
          </div>
        )
      })}

      {active && (
        <ModeForm
          mode={active}
          onClose={() => setActive(null)}
          onSubmit={(text) => void submit(active, text)}
        />
      )}

      {state.note && (
        <div className={`${styles.resultPanel} ${state.note.ok ? styles.resultOk : styles.resultError}`} role="status">
          <div className={styles.resultHead}>
            {state.note.ok ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}
            <strong>{state.note.ok ? 'Отправлено' : 'Ошибка'}</strong>
            <button type="button" onClick={() => setState((s) => ({ ...s, note: null }))} aria-label="Закрыть"><X aria-hidden /></button>
          </div>
          <p>{state.note.text}</p>
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
        {running ? 'Отправка…' : 'Открыть'}
      </button>
    </article>
  )
}

function ModeForm({ mode, onClose, onSubmit }: { mode: ActionMode; onClose: () => void; onSubmit: (text: string) => void }) {
  const initial = useMemo(() => {
    const v: Record<string, string> = {}
    for (const f of mode.fields) v[f.name] = f.default ?? ''
    return v
  }, [mode])
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [labels, setLabels] = useState<Record<string, string>>({})
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
  const setDb = (name: string, value: string, opts: Option[]) => {
    set(name, value)
    setLabels((l) => ({ ...l, [name]: opts.find((o) => o.value === value)?.label ?? value }))
  }
  const missing = mode.fields.filter((f) => f.required && !String(values[f.name] ?? '').trim()).map((f) => f.label)

  const submit = () => {
    if (missing.length) return
    const text = mode.buildMessage ? mode.buildMessage(values, labels) : mode.label
    onSubmit(text)
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
                <select value={values[f.name] ?? ''} onChange={(e) => setDb(f.name, e.target.value, dbOptions[f.name] ?? [])} disabled={loadingField === f.name}>
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
        <div className={styles.confirmNote}>
          <AlertTriangle aria-hidden /> Запрос уйдёт в обработку — ответ придёт в раздел COO и в Telegram отправителю.
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Отмена</button>
          <button type="button" className={styles.btnPrimary} onClick={submit} disabled={missing.length > 0} title={missing.length ? `Заполните: ${missing.join(', ')}` : ''}>
            Отправить
          </button>
        </div>
      </div>
    </div>
  )
}
