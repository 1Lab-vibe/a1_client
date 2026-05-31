import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCheck, Clock3, FileText, Hash, Image, Paperclip, RefreshCw, Search, Send, Smile, UserRound, Wifi, WifiOff } from 'lucide-react'
import { fetchChatData, fetchChatMessages, sendChatFile, sendChatMessage } from '../api/n8n'
import { useAuth } from '../context/AuthContext'
import type { ChatChannel, ChatMessage as ChatMessageType, ChatUser } from '../types'
import styles from './Chat.module.css'

type ChatTarget = (ChatChannel & { kind: 'channel' }) | (ChatUser & { kind: 'user' })
type TargetFilter = 'all' | 'channel' | 'user'

const STICKERS = ['OK', '+1', 'Done', 'Wait', 'Call', 'Check']

function targetId(target: ChatTarget | null): string {
  return target?.id ?? ''
}

function targetType(target: ChatTarget | null): 'channel' | 'user' {
  return target?.kind === 'user' ? 'user' : 'channel'
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function normalizeTargets(channels: ChatChannel[], users: ChatUser[]): ChatTarget[] {
  const channelTargets = channels
    .filter((channel) => channel.id && channel.name)
    .map((channel) => ({ ...channel, kind: 'channel' as const }))
  const userTargets = users
    .filter((user) => user.id && user.name)
    .map((user) => ({ ...user, kind: 'user' as const }))
  return [...channelTargets, ...userTargets]
}

function targetMeta(target: ChatTarget): string {
  return target.kind === 'channel' ? 'Канал' : 'Пользователь'
}

function deliveryLabel(status?: string): string {
  if (!status) return 'Локально'
  if (status === 'queued') return 'В очереди'
  if (status === 'sent' || status === 'delivered') return 'Доставлено'
  if (status === 'failed' || status === 'error') return 'Ошибка'
  return status
}

export function Chat() {
  const { email } = useAuth()
  const [targets, setTargets] = useState<ChatTarget[]>([])
  const [current, setCurrent] = useState<ChatTarget | null>(null)
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all')
  const listRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = () => {
    setLoading(true)
    setError(null)
    fetchChatData()
      .then((data) => {
        const nextTargets = normalizeTargets(data.channels, data.users)
        setTargets(nextTargets)
        setCurrent((selected) => {
          if (selected && nextTargets.some((item) => item.kind === selected.kind && item.id === selected.id)) return selected
          return nextTargets[0] ?? null
        })
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить чаты'))
      .finally(() => setLoading(false))
  }

  const loadMessages = (target: ChatTarget | null = current) => {
    if (!target) {
      setMessages([])
      return
    }
    setMessagesLoading(true)
    setError(null)
    fetchChatMessages(target.id, targetType(target))
      .then((data) => setMessages(data.messages))
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить сообщения'))
      .finally(() => setMessagesLoading(false))
  }

  useEffect(loadData, [])

  useEffect(() => {
    loadMessages(current)
  }, [current?.id, current?.kind])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, messagesLoading])

  const activeTitle = current?.name ?? 'Чат'
  const statusText = loading ? 'Загрузка' : error ? 'Ошибка' : 'Онлайн'
  const online = !loading && !error
  const sortedMessages = useMemo(() => [...messages].sort((a, b) => a.timestamp - b.timestamp), [messages])
  const filteredTargets = useMemo(() => {
    const q = query.trim().toLowerCase()
    return targets.filter((target) => {
      if (targetFilter !== 'all' && target.kind !== targetFilter) return false
      if (!q) return true
      return target.name.toLowerCase().includes(q) || target.id.toLowerCase().includes(q)
    })
  }, [query, targetFilter, targets])
  const channelCount = targets.filter((target) => target.kind === 'channel').length
  const userCount = targets.filter((target) => target.kind === 'user').length

  const submitText = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || !current || sending) return
    setSending(true)
    setInput('')
    setPickerOpen(false)
    try {
      const { message } = await sendChatMessage(targetId(current), targetType(current), trimmed)
      setMessages((prev) => [...prev, message])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить сообщение')
    } finally {
      setSending(false)
    }
  }

  const submitFile = async (file: File) => {
    if (!current || sending) return
    setSending(true)
    setPickerOpen(false)
    try {
      const { message } = await sendChatFile(targetId(current), targetType(current), file)
      setMessages((prev) => [...prev, message])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить файл')
    } finally {
      setSending(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className={styles.wrap}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHead}>
          <span className={styles.sidebarTitle}>Диалоги</span>
          {email && <span className={styles.sidebarEmail} title={email}>{email}</span>}
          <span className={styles.sidebarHint}>{channelCount} каналов, {userCount} пользователей</span>
          <label className={styles.searchBox}>
            <Search aria-hidden />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" />
          </label>
          <div className={styles.segmented}>
            {([
              ['all', 'Все'],
              ['channel', 'Каналы'],
              ['user', 'Люди'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={targetFilter === value ? styles.segmentActive : ''}
                onClick={() => setTargetFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.dialogList}>
          {loading ? (
            <div className={styles.emptyDialogs}>Загружаем диалоги...</div>
          ) : filteredTargets.length > 0 ? (
            filteredTargets.map((target) => (
              <button
                key={`${target.kind}:${target.id}`}
                type="button"
                className={styles.dialogItem + (current?.id === target.id && current?.kind === target.kind ? ' ' + styles.dialogItemActive : '')}
                onClick={() => setCurrent(target)}
              >
                <span className={styles.dialogAvatar}>{target.kind === 'channel' ? <Hash aria-hidden /> : <UserRound aria-hidden />}</span>
                <span className={styles.dialogBody}>
                  <span className={styles.dialogName}>{target.name}</span>
                  <span className={styles.dialogMeta}>{targetMeta(target)}</span>
                </span>
              </button>
            ))
          ) : (
            <div className={styles.emptyDialogs}>Нет подключенных каналов</div>
          )}
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <span className={styles.headerAvatar}>{activeTitle.charAt(0).toUpperCase()}</span>
          <div className={styles.headerText}>
            <span className={styles.headerTitle}>{activeTitle}</span>
            <span className={online ? styles.headerStatusOk : styles.headerStatus}>
              {online ? <Wifi aria-hidden /> : <WifiOff aria-hidden />}
              {statusText}
            </span>
          </div>
          <button type="button" className={styles.headerButton} onClick={() => { loadData(); loadMessages() }} disabled={loading || messagesLoading}>
            <RefreshCw aria-hidden />
            Обновить
          </button>
        </header>

        {error && <div className={styles.uploadError}>{error}</div>}

        <div className={styles.messages} ref={listRef}>
          {messagesLoading ? (
            <div className={styles.empty}>Загружаем сообщения...</div>
          ) : sortedMessages.length === 0 ? (
            <div className={styles.empty}>Сообщений пока нет</div>
          ) : (
            sortedMessages.map((message) => (
              <div key={message.id} className={message.isOwn ? styles.msgOwn : styles.msg}>
                {!message.isOwn && message.senderName && <span className={styles.msgSender}>{message.senderName}</span>}
                {message.attachments?.length ? (
                  <div className={styles.msgAttachments}>
                    {message.attachments.map((attachment, index) => (
                      attachment.type === 'image' && attachment.url ? (
                        <a key={index} href={attachment.url} target="_blank" rel="noopener noreferrer" className={styles.msgImage}>
                          <img src={attachment.url} alt={attachment.name ?? ''} />
                        </a>
                      ) : (
                        <a key={index} href={attachment.url} download={attachment.name} target="_blank" rel="noopener noreferrer" className={styles.msgFile}>
                          {attachment.type === 'image' ? <Image aria-hidden /> : <FileText aria-hidden />}
                          {attachment.name || 'Файл'}
                        </a>
                      )
                    ))}
                  </div>
                ) : null}
                {message.text ? <span className={styles.msgText}>{message.text}</span> : null}
                <span className={styles.msgTime}>
                  {message.isOwn ? (
                    message.deliveryStatus === 'queued' ? <Clock3 aria-hidden /> : <CheckCheck aria-hidden />
                  ) : null}
                  {formatTime(message.timestamp)}
                  {message.isOwn ? ` · ${deliveryLabel(message.deliveryStatus)}` : ''}
                </span>
              </div>
            ))
          )}
        </div>

        <form
          className={styles.inputRow}
          onSubmit={(event) => {
            event.preventDefault()
            void submitText(input)
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            className={styles.hiddenFile}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void submitFile(file)
            }}
          />
          <button type="button" className={styles.inputBtn} onClick={() => fileInputRef.current?.click()} disabled={!current || sending} title="Прикрепить файл">
            <Paperclip aria-hidden />
          </button>
          <button type="button" className={styles.inputBtn} onClick={() => setPickerOpen((value) => !value)} disabled={!current || sending} title="Быстрые ответы">
            <Smile aria-hidden />
          </button>
          {pickerOpen && (
            <div className={styles.picker}>
              {STICKERS.map((value) => (
                <button key={value} type="button" className={styles.pickerItemSticker} onClick={() => void submitText(value)}>
                  {value}
                </button>
              ))}
            </div>
          )}
          <input
            className={styles.input}
            placeholder={current ? 'Сообщение...' : 'Выберите диалог'}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={!current || sending}
          />
          <button type="submit" className={styles.sendBtn} disabled={!current || sending || !input.trim()} title="Отправить">
            <Send aria-hidden />
          </button>
        </form>
      </div>
    </div>
  )
}
