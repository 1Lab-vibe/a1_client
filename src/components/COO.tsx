import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { AnimatedHead } from './AnimatedHead'
import { MessageList } from './MessageList'
import { useN8n } from '../hooks/useN8n'
import { getCOOIncomingMessages } from '../api/n8n'
import { playIncomingMessageSound } from '../utils/playIncomingSound'
import type { N8nMessage } from '../types'
import styles from './COO.module.css'

const WELCOME_TEXT = 'Чем могу быть полезен?'
const INCOMING_POLL_INTERVAL_MS = 4000
const COO_MESSAGES_KEY = 'a1_coo_messages'
const COO_CLEARED_KEY = 'a1_coo_cleared'
const COO_CLEAR_TIMESTAMP_KEY = 'a1_coo_clear_timestamp'

function loadStoredMessages(): N8nMessage[] {
  try {
    const raw = localStorage.getItem(COO_MESSAGES_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as N8nMessage[]
    if (!Array.isArray(data)) return []
    return data.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
  } catch {
    return []
  }
}

function loadClearedState(): { cleared: boolean; clearTimestamp: number | null } {
  try {
    const cleared = localStorage.getItem(COO_CLEARED_KEY) === '1'
    const rawTs = localStorage.getItem(COO_CLEAR_TIMESTAMP_KEY)
    const clearTimestamp = rawTs != null && rawTs !== '' ? Number(rawTs) : null
    return { cleared, clearTimestamp: Number.isFinite(clearTimestamp) ? clearTimestamp : null }
  } catch {
    return { cleared: false, clearTimestamp: null }
  }
}

function saveMessages(messages: N8nMessage[]) {
  try {
    localStorage.setItem(COO_MESSAGES_KEY, JSON.stringify(messages))
  } catch {
    // ignore
  }
}

function setClearedInStorage(cleared: boolean, clearTimestamp: number | null) {
  try {
    if (cleared && clearTimestamp != null) {
      localStorage.setItem(COO_CLEARED_KEY, '1')
      localStorage.setItem(COO_CLEAR_TIMESTAMP_KEY, String(clearTimestamp))
    } else {
      localStorage.removeItem(COO_CLEARED_KEY)
      localStorage.removeItem(COO_CLEAR_TIMESTAMP_KEY)
    }
  } catch {
    // ignore
  }
}

/** Начало дня в UTC-ms для даты YYYY-MM-DD */
function dayStart(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  return d.getTime()
}

/** Конец дня (23:59:59.999) в UTC-ms */
function dayEnd(dateStr: string): number {
  const d = new Date(dateStr + 'T23:59:59.999')
  return d.getTime()
}

export function COO() {
  const [fullHistory, setFullHistory] = useState<N8nMessage[]>(() => loadStoredMessages())
  const [cleared, setCleared] = useState(() => loadClearedState().cleared)
  const [clearTimestamp, setClearTimestamp] = useState<number | null>(() => loadClearedState().clearTimestamp)
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const afterIdRef = useRef<string | undefined>(undefined)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const { sendToN8n } = useN8n()

  const displayedMessages = useMemo(() => {
    let list = fullHistory
    if (cleared && clearTimestamp != null) {
      list = list.filter((m) => (m.timestamp ?? 0) >= clearTimestamp)
    }
    if (dateFrom || dateTo) {
      const from = dateFrom ? dayStart(dateFrom) : 0
      const to = dateTo ? dayEnd(dateTo) : Number.POSITIVE_INFINITY
      list = list.filter((m) => {
        const t = m.timestamp ?? 0
        return t >= from && t <= to
      })
    }
    return list.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
  }, [fullHistory, cleared, clearTimestamp, dateFrom, dateTo])

  useEffect(() => {
    saveMessages(fullHistory)
  }, [fullHistory])

  // Автоскролл вниз и возврат фокуса в поле ввода при новом сообщении/обновлении
  useEffect(() => {
    const el = chatScrollRef.current
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      })
    }
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [displayedMessages, isLoading])

  const clearDialog = useCallback(() => {
    const ts = Date.now()
    setCleared(true)
    setClearTimestamp(ts)
    setClearedInStorage(true, ts)
  }, [])

  const showAllMessages = useCallback(() => {
    setCleared(false)
    setClearTimestamp(null)
    setClearedInStorage(false, null)
    setDateFrom('')
    setDateTo('')
  }, [])

  // Опрос входящих сообщений от n8n (push).
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      try {
        const { messages: incoming } = await getCOOIncomingMessages(afterIdRef.current)
        if (cancelled || !incoming?.length) return
        // Не сохраняем и не показываем сообщения со статусом processing — пусть «печатает» до прихода ответа
        const assistant: N8nMessage[] = incoming
          .filter((m) => m.status !== 'processing')
          .map((m) => ({
            id: m.id,
            role: 'assistant',
            content: m.text,
            attachments: m.attachments,
            timestamp: m.timestamp,
          }))
        // Следующий курсор = max(id) по bigint, чтобы порядок не зависел от времени/UUID
        let maxId: bigint | null = null
        for (const m of incoming) {
          if (m.id == null || m.id === '') continue
          const curr = typeof m.id === 'string' ? BigInt(m.id) : BigInt(Number(m.id))
          if (maxId === null || curr > maxId) maxId = curr
        }
        if (maxId !== null) afterIdRef.current = String(maxId)
        setFullHistory((prev) => {
          const ids = new Set(prev.map((x) => x.id))
          const toAdd = assistant.filter((a) => !ids.has(a.id))
          if (toAdd.length === 0) return prev
          playIncomingMessageSound()
          return [...prev, ...toAdd].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
        })
      } catch {
        // ignore
      }
    }
    const t = setInterval(poll, INCOMING_POLL_INTERVAL_MS)
    poll()
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMsg: N8nMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }
    setFullHistory((prev) => [...prev, userMsg].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)))
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await sendToN8n(trimmed)
      const assistantMsg: N8nMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.text ?? '',
        attachments: response.attachments,
        timestamp: Date.now(),
      }
      setFullHistory((prev) => [...prev, assistantMsg].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)))
      playIncomingMessageSound()
    } catch (e) {
      const errMsg: N8nMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Ошибка связи с сервером. Проверьте настройки и webhook.',
        timestamp: Date.now(),
      }
      setFullHistory((prev) => [...prev, errMsg].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)))
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, sendToN8n])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const toggleVoice = () => {
    if (isListening) {
      setIsListening(false)
      return
    }
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Голосовой ввод не поддерживается в этом браузере.')
      return
    }
    const RecognitionAPI = (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition; SpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
      ?? (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
    if (!RecognitionAPI) return
    const recognition = new RecognitionAPI()
    recognition.lang = 'ru-RU'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript
      sendMessage(transcript)
    }
    recognition.onend = () => setIsListening(false)
    recognition.start()
    setIsListening(true)
  }

  const showWelcome = fullHistory.length === 0

  return (
    <div className={styles.coo}>
      <div className={styles.gridBg} aria-hidden />
      <div className={styles.content}>
        {showWelcome ? (
          <div className={styles.welcome}>
            <div className={styles.headWrap}>
              <AnimatedHead isListening={isListening} />
            </div>
            <p className={styles.welcomeText}>{WELCOME_TEXT}</p>
            <p className={styles.welcomeHint}>Напишите или нажмите микрофон</p>
          </div>
        ) : (
          <div className={styles.chatArea}>
            <div className={styles.chatToolbar}>
              <button type="button" className={styles.clearBtn} onClick={clearDialog} title="Очистить диалог">
                Очистить диалог
              </button>
              <button type="button" className={styles.showAllBtn} onClick={showAllMessages} title="Показать все сообщения">
                Показать все сообщения
              </button>
              <span className={styles.filterLabel}>Период:</span>
              <input
                type="date"
                className={styles.dateInput}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Дата с"
              />
              <span className={styles.filterSep}>—</span>
              <input
                type="date"
                className={styles.dateInput}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="Дата по"
              />
            </div>
            <div className={styles.chatScroll} ref={chatScrollRef}>
              <MessageList messages={displayedMessages} isLoading={isLoading} />
            </div>
          </div>
        )}

        <form className={styles.inputRow} onSubmit={handleSubmit}>
          <button
            type="button"
            className={`${styles.micBtn} ${isListening ? styles.listening : ''}`}
            onClick={toggleVoice}
            title="Голосовой ввод"
          >
            {isListening ? '⏹' : '🎤'}
          </button>
          <textarea
            ref={inputRef}
            className={styles.input}
            placeholder="Сообщение или голос..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <button type="submit" className={styles.sendBtn} disabled={isLoading || !inputValue.trim()}>
            →
          </button>
        </form>
      </div>
    </div>
  )
}
