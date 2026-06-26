import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Play, X } from 'lucide-react'
import { sendIntakeMessage } from '../api/n8n'
import { DEPARTMENT_MODES, GROUP_LABELS, type DeptMode } from '../config/departmentModes'
import { HANDLER_SCENARIOS } from '../config/handlerScenarios'
import styles from './ActionModes.module.css'

interface ScenarioModesProps {
  /** домен/отдел (finance, sales, analytics, ...) */
  domain: string
}

interface Note { ok: boolean; text: string }

/** Для отделов без курируемого каталога — собираем режимы из автокаталога (описание берём из RU-примера). */
function fallbackModes(domain: string): DeptMode[] {
  return HANDLER_SCENARIOS.filter((h) => h.domain === domain).map((h) => ({
    id: h.action_key,
    label: h.action_name,
    description: h.examples[0] ?? '',
    group: 'ops' as const,
    examples: h.examples,
  }))
}

export function ScenarioModes({ domain }: ScenarioModesProps) {
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

  if (modes.length === 0) {
    return <div className={styles.noFields}>Для этого отдела пока нет настроенных режимов.</div>
  }

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
        <ScenarioForm mode={active} onClose={() => setActive(null)} onSubmit={(text) => void submit(active, text)} />
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

function ScenarioForm({ mode, onClose, onSubmit }: { mode: DeptMode; onClose: () => void; onSubmit: (text: string) => void }) {
  const [idx, setIdx] = useState(0)
  const [text, setText] = useState(mode.examples[0] ?? '')

  useEffect(() => { setText(mode.examples[idx] ?? '') }, [idx, mode])

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3>{mode.label}</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть"><X aria-hidden /></button>
        </div>
        {mode.description && <p className={styles.modalDesc}>{mode.description}</p>}
        <div className={styles.formBody}>
          {mode.examples.length > 1 && (
            <label className={styles.field}>
              <span>Вариант запроса</span>
              <select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
                {mode.examples.map((ex, i) => <option key={i} value={i}>{`Вариант ${i + 1}: ${ex.slice(0, 64)}${ex.length > 64 ? '…' : ''}`}</option>)}
              </select>
            </label>
          )}
          <label className={styles.field}>
            <span>Запрос<em> *</em></span>
            <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Подставьте конкретные значения вместо <…>" />
            <small>Замените значения в &lt;скобках&gt; на свои (клиент, сумма, ИНН, даты). Запрос уйдёт в пайплайн как есть.</small>
          </label>
        </div>
        <div className={styles.confirmNote}>
          <AlertTriangle aria-hidden /> Запрос уйдёт в обработку — ответ придёт в раздел COO и в Telegram отправителю.
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Отмена</button>
          <button type="button" className={styles.btnPrimary} onClick={() => onSubmit(text.trim())} disabled={!text.trim()}>Отправить</button>
        </div>
      </div>
    </div>
  )
}
