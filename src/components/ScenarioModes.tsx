import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Play, X } from 'lucide-react'
import { fetchClients, fetchDeals, fetchLeads, sendIntakeMessage } from '../api/n8n'
import { DEPARTMENT_MODES, GROUP_LABELS, type DeptMode, type FieldDef } from '../config/departmentModes'
import { HANDLER_SCENARIOS } from '../config/handlerScenarios'
import styles from './ActionModes.module.css'

type Row = Record<string, unknown>
type Option = { value: string; label: string }
interface Note { ok: boolean; text: string }

/** Отделы без курируемого каталога — берём автокаталог: без полей, шлём канонический текст как есть. */
function fallbackModes(domain: string): DeptMode[] {
  return HANDLER_SCENARIOS.filter((h) => h.domain === domain).map((h) => ({
    id: h.action_key,
    label: h.action_name,
    description: h.examples[0] ?? '',
    group: 'ops' as const,
    fields: [],
    request: () => h.examples[0] ?? h.action_name,
  }))
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

export function ScenarioModes({ domain }: { domain: string }) {
  const modes = useMemo(() => DEPARTMENT_MODES[domain] ?? fallbackModes(domain), [domain])
  const [active, setActive] = useState<DeptMode | null>(null)
  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [note, setNote] = useState<Note | null>(null)

  const submit = async (mode: DeptMode, text: string) => {
    setActive(null)
    setRunningKey(mode.id)
    setNote(null)
    try {
      const res = await sendIntakeMessage(text)
      const extra = res.text ? ` ${res.text}` : ''
      setNote({ ok: true, text: `Запрос «${mode.label}» отправлен в обработку. Ответ придёт в раздел COO и в Telegram.${extra}` })
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Не удалось отправить запрос' })
    } finally {
      setRunningKey(null)
    }
  }

  if (modes.length === 0) return <div className={styles.noFields}>Для этого отдела пока нет настроенных режимов.</div>

  const groups = ['ops', 'report'].filter((g) => modes.some((m) => m.group === g))

  return (
    <>
      {groups.map((g) => (
        <div key={g}>
          <h3 className={styles.groupTitle}>{GROUP_LABELS[g] ?? g}</h3>
          <section className={styles.grid}>
            {modes.filter((m) => m.group === g).map((mode) => (
              <article key={mode.id} className={styles.card}>
                <div>
                  <strong>{mode.label}</strong>
                  <p>{mode.description}</p>
                </div>
                <button type="button" onClick={() => { setNote(null); setActive(mode) }} disabled={runningKey != null}>
                  {runningKey === mode.id ? <Loader2 className={styles.spin} aria-hidden /> : <Play aria-hidden />}
                  {runningKey === mode.id ? 'Отправка…' : 'Открыть'}
                </button>
              </article>
            ))}
          </section>
        </div>
      ))}

      {active && (
        <ModeForm mode={active} onClose={() => setActive(null)} onSubmit={(text) => void submit(active, text)} />
      )}

      {note && (
        <div className={`${styles.resultPanel} ${note.ok ? styles.resultOk : styles.resultError}`} role="status">
          <div className={styles.resultHead}>
            {note.ok ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}
            <strong>{note.ok ? 'Отправлено' : 'Ошибка'}</strong>
            <button type="button" onClick={() => setNote(null)} aria-label="Закрыть"><X aria-hidden /></button>
          </div>
          <p>{note.text}</p>
        </div>
      )}
    </>
  )
}

function ModeForm({ mode, onClose, onSubmit }: { mode: DeptMode; onClose: () => void; onSubmit: (text: string) => void }) {
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
    onSubmit(mode.request(values, labels).trim())
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3>{mode.label}</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть"><X aria-hidden /></button>
        </div>
        {mode.description && <p className={styles.modalDesc}>{mode.description}</p>}
        <div className={styles.formBody}>
          {mode.fields.length === 0 && <div className={styles.noFields}>Параметры не нужны — нажмите «Отправить».</div>}
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
          <AlertTriangle aria-hidden /> Ответ придёт в раздел COO и в Telegram отправителю.
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
