import { useState, useRef, useCallback, useEffect } from 'react'
import { AnimatedHead } from './AnimatedHead'
import { MessageList } from './MessageList'
import { useN8n } from '../hooks/useN8n'
import { getCOOIncomingMessages } from '../api/n8n'
import type { N8nMessage } from '../types'
import styles from './COO.module.css'

const WELCOME_TEXT = 'Чем могу быть полезен?'
const INCOMING_POLL_INTERVAL_MS = 4000

export function COO() {
  const [messages, setMessages] = useState<N8nMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  /** Монотонный курсор: max bigint id из последней выборки. after_id передаётся в опрос — дубли невозможны. */
  const afterIdRef = useRef<string | undefined>(undefined)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { sendToN8n } = useN8n()

  // Опрос входящих сообщений от n8n (push). Курсор after_id = bigint sequence, не UUID.
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      try {
        const { messages: incoming } = await getCOOIncomingMessages(afterIdRef.current)
        if (cancelled || !incoming?.length) return
        const assistant: N8nMessage[] = incoming.map((m) => ({
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
        setMessages((prev) => {
          const ids = new Set(prev.map((x) => x.id))
          const toAdd = assistant.filter((a) => !ids.has(a.id))
          if (toAdd.length === 0) return prev
          const merged = [...prev, ...toAdd].sort((a, b) => a.timestamp - b.timestamp)
          return merged
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
    setMessages((prev) => [...prev, userMsg])
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
      setMessages((prev) => [...prev, assistantMsg])
    } catch (e) {
      const errMsg: N8nMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Ошибка связи с сервером. Проверьте настройки и webhook.',
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errMsg])
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

  const showWelcome = messages.length === 0

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
            <MessageList messages={messages} isLoading={isLoading} />
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
