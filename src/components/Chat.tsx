import { useState, useEffect, useRef } from 'react'
import {
  fetchChatData,
  fetchChatMessages,
  sendChatMessage,
} from '../api/n8n'
import type { ChatChannel, ChatUser, ChatMessage as ChatMessageType } from '../types'
import styles from './Chat.module.css'

type ChatTarget = { type: 'channel'; id: string; name: string } | { type: 'user'; id: string; name: string }

export function Chat() {
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [users, setUsers] = useState<ChatUser[]>([])
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [current, setCurrent] = useState<ChatTarget | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchChatData()
      .then((data) => {
        setChannels(data.channels ?? [])
        setUsers(data.users ?? [])
        const general = (data.channels ?? []).find((c) => c.isGeneral || c.id === 'general')
        if (general) setCurrent({ type: 'channel', id: general.id, name: general.name })
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!current) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
    fetchChatMessages(current.id, current.type)
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false))
  }, [current?.id, current?.type])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || !current || sending) return
    setSending(true)
    setInput('')
    try {
      const { message } = await sendChatMessage(current.id, current.type, text)
      setMessages((prev) => [...prev, { ...message, isOwn: true }])
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка отправки')
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.loading}>Загрузка чатов...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>{error}</div>
      </div>
    )
  }

  const generalChannel: ChatTarget = { type: 'channel', id: 'general', name: 'Общий чат' }
  const hasGeneral = channels.some((c) => c.id === 'general')

  return (
    <div className={styles.wrap}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarSection}>
          <div className={styles.sidebarTitle}>Каналы</div>
          {!hasGeneral && (
            <button
              type="button"
              className={styles.chatItem + (current?.type === 'channel' && current?.id === 'general' ? ' ' + styles.chatItemActive : '')}
              onClick={() => setCurrent(generalChannel)}
            >
              <span className={styles.chatIcon}>#</span>
              Общий чат
            </button>
          )}
          {channels.map((ch) => (
            <button
              key={ch.id}
              type="button"
              className={styles.chatItem + (current?.type === 'channel' && current?.id === ch.id ? ' ' + styles.chatItemActive : '')}
              onClick={() => setCurrent({ type: 'channel', id: ch.id, name: ch.name })}
            >
              <span className={styles.chatIcon}>#</span>
              {ch.name}
            </button>
          ))}
        </div>
        <div className={styles.sidebarSection}>
          <div className={styles.sidebarTitle}>Личные</div>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              className={styles.chatItem + (current?.type === 'user' && current?.id === u.id ? ' ' + styles.chatItemActive : '')}
              onClick={() => setCurrent({ type: 'user', id: u.id, name: u.name })}
            >
              <span className={styles.chatIcon}>👤</span>
              {u.name}
            </button>
          ))}
        </div>
      </aside>
      <div className={styles.main}>
        {current ? (
          <>
            <header className={styles.header}>
              <span className={styles.headerTitle}>{current.type === 'channel' ? '#' : ''}{current.name}</span>
            </header>
            <div className={styles.messages} ref={listRef}>
              {loadingMessages ? (
                <div className={styles.loading}>Загрузка сообщений...</div>
              ) : messages.length === 0 ? (
                <div className={styles.empty}>Нет сообщений</div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={m.isOwn ? styles.msgOwn : styles.msg}
                  >
                    {!m.isOwn && <span className={styles.msgSender}>{m.senderName}</span>}
                    <span className={styles.msgText}>{m.text}</span>
                  </div>
                ))
              )}
            </div>
            <form
              className={styles.inputRow}
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <input
                className={styles.input}
                placeholder="Сообщение..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
              />
              <button type="submit" className={styles.sendBtn} disabled={sending || !input.trim()}>
                Отправить
              </button>
            </form>
          </>
        ) : (
          <div className={styles.placeholder}>Выберите чат слева</div>
        )}
      </div>
    </div>
  )
}
