import { useEffect, useMemo, useState, useRef } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Play, X } from 'lucide-react'
import {sendIntakeMessage} from '../api/n8n'
import {waitForIntake} from '../hooks/useN8n'
import {CrmLookup} from './CrmLookup'
import { DEPARTMENT_MODES, GROUP_LABELS, type DeptMode } from '../config/departmentModes'
import { HANDLER_SCENARIOS } from '../config/handlerScenarios'
import styles from './ActionModes.module.css'

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

export function ScenarioModes({ domain, only }: { domain: string; only?: string }) {
  const modes = useMemo(() => (DEPARTMENT_MODES[domain] ?? fallbackModes(domain)).filter(m=>!only||m.id===only), [domain,only])
  const [active, setActive] = useState<DeptMode | null>(null)
  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [note, setNote] = useState<Note | null>(null)

  const pending = useRef<{id:string;mode:string}|null>(null)
  const watch = useRef<AbortController|null>(null)
  useEffect(()=>()=>{watch.current?.abort()},[])
  const check = async (id:string, mode:DeptMode) => {
    watch.current?.abort()
    const controller = new AbortController()
    watch.current=controller
    setRunningKey(mode.id)
    setNote({ok:true,text:'В обработке…'})
    try{
      const result=await waitForIntake(id,controller.signal)
      if(controller.signal.aborted)return
      pending.current=null
      setNote({ok:true,text:result.text || 'Результат с вложением доступен в COO.'})
      setActive(null)
    }catch(e){
      if(!controller.signal.aborted)setNote({ok:false,text:e instanceof Error ? e.message : 'Не удалось проверить результат'})
    }finally{if(!controller.signal.aborted)setRunningKey(null)}
  }
  const submit = async (mode: DeptMode, text: string) => {
    if(runningKey)return
    if(pending.current){await check(pending.current.id,mode);return}
    setRunningKey(mode.id)
    setNote(null)
    try {
      const res = await sendIntakeMessage(text)
      if (res.status==='error'||res.status==='failed'||(!res.text&&!res.request_id)) throw new Error(res.text||'Сервер не подтвердил приём запроса')
      if(res.request_id && ['processing','queued','pending','accepted'].includes(res.status || '')){
        pending.current={id:res.request_id,mode:mode.id}
        await check(res.request_id,mode)
      }else if(res.text){
        setActive(null)
        setNote({ok:true,text:res.text})
      }else throw new Error('Сервер не подтвердил результат')
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
                <button type="button" onClick={() => { setNote(null); pending.current=null; setActive(mode) }} disabled={runningKey != null}>
                  {runningKey === mode.id ? <Loader2 className={styles.spin} aria-hidden /> : <Play aria-hidden />}
                  {runningKey === mode.id ? 'Отправка…' : 'Открыть'}
                </button>
              </article>
            ))}
          </section>
        </div>
      ))}

      {active && (
        <ModeForm mode={active} pending={!!pending.current} busy={!!runningKey} error={note?.ok===false?note.text:null} onClose={() => setActive(null)} onSubmit={(text) => void submit(active, text)} />
      )}

      {note && (
        <div className={`${styles.resultPanel} ${note.ok ? styles.resultOk : styles.resultError}`} role="status">
          <div className={styles.resultHead}>
            {note.ok ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}
            <strong>{runningKey ? 'В обработке' : note.ok ? 'Готово' : 'Ошибка'}</strong>
            <button type="button" onClick={() => setNote(null)} aria-label="Закрыть"><X aria-hidden /></button>
          </div>
          <p>{note.text}</p>
        </div>
      )}
    </>
  )
}

function ModeForm({ mode, pending, busy, error, onClose, onSubmit }: { mode: DeptMode; pending:boolean; busy:boolean; error:string|null; onClose: () => void; onSubmit: (text: string) => void }) {
  const initial = useMemo(() => {
    const v: Record<string, string> = {}
    for (const f of mode.fields) v[f.name] = f.default ?? ''
    return v
  }, [mode])
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [labels, setLabels] = useState<Record<string, string>>({})
  const set = (name: string, value: string) => setValues(v => ({ ...v, [name]: value }))
  const missing = mode.fields.filter((f) => f.required && !String(values[f.name] ?? '').trim()).map((f) => f.label)

  const amountInvalid = !!values.amount && !(Number(values.amount.replace(',', '.')) > 0)
  const submit = () => {
    if (missing.length || busy || amountInvalid) return
    onSubmit(mode.request(values, labels).trim())
  }

  return (
    <div className={styles.modalOverlay} onClick={busy ? undefined : onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3>{mode.label}</h3>
          <button type="button" disabled={busy} onClick={onClose} aria-label="Закрыть"><X aria-hidden /></button>
        </div>
        {mode.description && <p className={styles.modalDesc}>{mode.description}</p>}
        <fieldset disabled={busy || pending} className={styles.formBody}>
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
                <CrmLookup entity={f.source!} label={f.label} initialLabel="" value={values[f.name] || ''} required={f.required} onChange={(id,label)=>{set(f.name,id);setLabels(l=>({...l,[f.name]:label}))}}/>
              ) : f.type === 'checkbox' ? (
                <input type="checkbox" checked={values[f.name] === 'on'} onChange={(e) => set(f.name, e.target.checked ? 'on' : '')} />
              ) : (
                <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
              )}
              {f.help && <small>{f.help}</small>}
            </label>
          ))}
        </fieldset>
        {amountInvalid && <p role="alert">Сумма должна быть больше нуля.</p>}{error&&<p role="alert">{error}</p>}
        <div className={styles.confirmNote}>
          <AlertTriangle aria-hidden /> Ответ придёт в раздел COO и в Telegram отправителю.
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} disabled={busy} onClick={onClose}>Отмена</button>
          <button type="button" className={styles.btnPrimary} onClick={submit} disabled={busy || amountInvalid || missing.length > 0} title={missing.length ? `Заполните: ${missing.join(', ')}` : ''}>
            {busy ? "В обработке…" : pending ? "Проверить результат" : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  )
}
