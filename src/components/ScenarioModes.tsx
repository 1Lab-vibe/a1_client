import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Play, X } from 'lucide-react'
import { sendIntakeMessage } from '../api/n8n'
import { HANDLER_SCENARIOS, type HandlerScenario } from '../config/handlerScenarios'
import styles from './ActionModes.module.css'

interface ScenarioModesProps {
  /** домен/отдел (finance, sales, analytics, ...) */
  domain: string
}

interface Note { ok: boolean; text: string }

export function ScenarioModes({ domain }: ScenarioModesProps) {
  const handlers = useMemo(() => HANDLER_SCENARIOS.filter((h) => h.domain === domain), [domain])
  const [active, setActive] = useState<HandlerScenario | null>(null)
  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [note, setNote] = useState<Note | null>(null)

  const submit = async (handler: HandlerScenario, text: string) => {
    setActive(null)
    setRunningKey(handler.action_key)
    setNote(null)
    try {
      const res = await sendIntakeMessage(text)
      const extra = res.text ? ` ${res.text}` : ''
      setNote({ ok: true, text: `Запрос «${handler.action_name}» отправлен в обработку. Ответ придёт в раздел COO и в Telegram.${extra}` })
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Не удалось отправить запрос' })
    } finally {
      setRunningKey(null)
    }
  }

  if (handlers.length === 0) {
    return <div className={styles.noFields}>Для этого отдела пока нет настроенных режимов.</div>
  }

  return (
    <>
      <section className={styles.grid}>
        {handlers.map((h) => (
          <article key={h.action_key} className={styles.card}>
            <div>
              <strong>{h.action_name}</strong>
              <p>{h.description || h.examples[0]}</p>
            </div>
            <button type="button" onClick={() => { setNote(null); setActive(h) }} disabled={runningKey != null}>
              {runningKey === h.action_key ? <Loader2 className={styles.spin} aria-hidden /> : <Play aria-hidden />}
              {runningKey === h.action_key ? 'Отправка…' : 'Открыть'}
            </button>
          </article>
        ))}
      </section>

      {active && (
        <ScenarioForm handler={active} onClose={() => setActive(null)} onSubmit={(text) => void submit(active, text)} />
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

function ScenarioForm({ handler, onClose, onSubmit }: { handler: HandlerScenario; onClose: () => void; onSubmit: (text: string) => void }) {
  const [idx, setIdx] = useState(0)
  const [text, setText] = useState(handler.examples[0] ?? '')

  // при выборе другого примера подставляем его текст
  useEffect(() => { setText(handler.examples[idx] ?? '') }, [idx, handler])

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3>{handler.action_name}</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть"><X aria-hidden /></button>
        </div>
        {handler.description && <p className={styles.modalDesc}>{handler.description}</p>}
        <div className={styles.formBody}>
          {handler.examples.length > 1 && (
            <label className={styles.field}>
              <span>Пример запроса</span>
              <select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
                {handler.examples.map((ex, i) => <option key={i} value={i}>{`Вариант ${i + 1}: ${ex.slice(0, 60)}${ex.length > 60 ? '…' : ''}`}</option>)}
              </select>
            </label>
          )}
          <label className={styles.field}>
            <span>Запрос<em> *</em></span>
            <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Сформулируйте запрос, подставив конкретные значения" />
            <small>Отредактируйте под свои данные (названия, суммы, ИНН и т.п.). Запрос уйдёт в пайплайн как есть.</small>
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
