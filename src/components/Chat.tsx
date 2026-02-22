import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import type { ChatUser, ChatMessage as ChatMessageType } from '../types'
import styles from './Chat.module.css'

const CHAT_STORAGE_KEY = 'a1_chat'
const DIALOGS_KEY = 'a1_chat_dialogs'

function getStoredDialogs(): ChatUser[] {
  try {
    const raw = localStorage.getItem(DIALOGS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function getStoredMessages(chatId: string): ChatMessageType[] {
  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_KEY}_${chatId}`)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveMessages(chatId: string, messages: ChatMessageType[]) {
  try {
    localStorage.setItem(`${CHAT_STORAGE_KEY}_${chatId}`, JSON.stringify(messages))
  } catch {
    // ignore
  }
}

const EMOJI_LIST = '😀 😃 😄 😁 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🥱 😏 😴 😪 😮‍💨 🤤 😒 🙄 😬 🤥 😌 😔 😕 🙃 🤑 😲 ☹️ 🙁 😖 😞 😟 😤 😢 😭 😦 😧 😨 😩 🤯 😬 😰 😱 🥵 🥶 😳 🤗 🤔 🤭 🤫 🤥 😶 😶‍🌫️ 😏 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 🩺 🤒 🤕 🤠 🥳 🥸 😎 🤓 🧐'.split(' ')
const STICKER_EMOJI = ['👍', '❤️', '🔥', '😂', '😢', '😍', '🤔', '👋', '🎉', '✅', '⭐', '🙏', '💪', '👏', '😎', '🚀']

const FALLBACK_USER: ChatUser = { id: 'local', name: 'Локальный чат' }

export function Chat() {
  const { email } = useAuth()
  const [users, setUsers] = useState<ChatUser[]>(() => getStoredDialogs())
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [current, setCurrent] = useState<ChatUser | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [stickerOpen, setStickerOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // При первом открытии: если диалогов нет — показываем один локальный
  useEffect(() => {
    const dialogs = getStoredDialogs()
    if (dialogs.length > 0) {
      setUsers(dialogs)
      if (!current) setCurrent(dialogs[0])
    } else {
      setUsers([FALLBACK_USER])
      setCurrent(FALLBACK_USER)
    }
  }, [])

  // При смене диалога — грузим сообщения из localStorage
  useEffect(() => {
    if (!current) {
      setMessages([])
      return
    }
    setMessages(getStoredMessages(current.id))
  }, [current?.id])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const appendAndSave = (msg: ChatMessageType) => {
    if (!current) return
    setMessages((prev) => {
      const next = [...prev, msg]
      saveMessages(current.id, next)
      return next
    })
  }

  const sendText = (text: string) => {
    if (!text.trim() || !current || sending) return
    setSending(true)
    setInput('')
    setEmojiOpen(false)
    setStickerOpen(false)
    const msg: ChatMessageType = {
      id: `msg-${Date.now()}`,
      chatId: current.id,
      chatType: 'user',
      senderId: email ?? '',
      senderName: email ?? 'Я',
      text: text.trim(),
      timestamp: Date.now(),
      isOwn: true,
    }
    appendAndSave(msg)
    setSending(false)
  }

  const sendSticker = (sticker: string) => {
    if (!current || sending) return
    setStickerOpen(false)
    setSending(true)
    const msg: ChatMessageType = {
      id: `msg-${Date.now()}`,
      chatId: current.id,
      chatType: 'user',
      senderId: email ?? '',
      senderName: email ?? 'Я',
      text: sticker,
      timestamp: Date.now(),
      isOwn: true,
    }
    appendAndSave(msg)
    setSending(false)
  }

  const sendFile = (file: File) => {
    if (!current || sending) return
    setSending(true)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const msg: ChatMessageType = {
        id: `msg-${Date.now()}`,
        chatId: current.id,
        chatType: 'user',
        senderId: email ?? '',
        senderName: email ?? 'Я',
        text: file.name,
        timestamp: Date.now(),
        isOwn: true,
        attachments: [{ type: 'file', url: dataUrl, name: file.name }],
      }
      appendAndSave(msg)
      setSending(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsDataURL(file)
  }

  const dialogs = users.filter(
    (u) => u.id && String(u.name).trim() && u.id !== email && String(u.name) !== email
  )
  const showDialogs = dialogs.length > 0 ? dialogs : [FALLBACK_USER]
  const currentUser = current ?? showDialogs[0] ?? null

  return (
    <div className={styles.wrap}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHead}>
          <span className={styles.sidebarTitle}>Диалоги</span>
          {email && <span className={styles.sidebarEmail} title={email}>{email}</span>}
          <span className={styles.sidebarHint}>Локальный режим</span>
        </div>
        <div className={styles.dialogList}>
          {showDialogs.map((u) => (
            <button
              key={u.id}
              type="button"
              className={styles.dialogItem + (currentUser?.id === u.id ? ' ' + styles.dialogItemActive : '')}
              onClick={() => setCurrent(u)}
            >
              <span className={styles.dialogAvatar}>{u.name?.charAt(0)?.toUpperCase() || '?'}</span>
              <span className={styles.dialogName}>{u.name}</span>
            </button>
          ))}
        </div>
      </aside>
      <div className={styles.main}>
        {currentUser ? (
          <>
            <header className={styles.header}>
              <span className={styles.headerAvatar}>{currentUser.name?.charAt(0)?.toUpperCase() || '?'}</span>
              <span className={styles.headerTitle}>{currentUser.name}</span>
            </header>
            <div className={styles.messages} ref={listRef}>
              {messages.length === 0 ? (
                <div className={styles.empty}>Нет сообщений</div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={m.isOwn ? styles.msgOwn : styles.msg}
                  >
                    {!m.isOwn && m.senderName && <span className={styles.msgSender}>{m.senderName}</span>}
                    {m.attachments?.length ? (
                      <div className={styles.msgAttachments}>
                        {m.attachments.map((a, i) => (
                          a.type === 'image' || (a.type === 'sticker' && /^(https?:|data:)/.test(a.url)) ? (
                            <a
                              key={i}
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.msgImage}
                            >
                              <img src={a.url} alt="" />
                            </a>
                          ) : a.type === 'file' ? (
                            <a
                              key={i}
                              href={a.url}
                              download={a.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.msgFile}
                            >
                              📎 {a.name || 'Файл'}
                            </a>
                          ) : (
                            <span key={i} className={styles.msgSticker}>{a.url}</span>
                          )
                        ))}
                      </div>
                    ) : null}
                    {m.text ? <span className={styles.msgText}>{m.text}</span> : null}
                    <span className={styles.msgTime}>
                      {new Date(m.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
            <form
              className={styles.inputRow}
              onSubmit={(e) => {
                e.preventDefault()
                sendText(input)
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                className={styles.hiddenFile}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) sendFile(f)
                }}
              />
              <button
                type="button"
                className={styles.inputBtn}
                onClick={() => fileInputRef.current?.click()}
                title="Прикрепить файл"
                disabled={sending}
              >
                📎
              </button>
              <button
                type="button"
                className={styles.inputBtn}
                onClick={() => { setStickerOpen(false); setEmojiOpen((v) => !v) }}
                title="Эмодзи"
                disabled={sending}
              >
                😀
              </button>
              <button
                type="button"
                className={styles.inputBtn}
                onClick={() => { setEmojiOpen(false); setStickerOpen((v) => !v) }}
                title="Стикеры"
                disabled={sending}
              >
                🎭
              </button>
              {emojiOpen && (
                <div className={styles.picker}>
                  {EMOJI_LIST.map((em, i) => (
                    <button
                      key={i}
                      type="button"
                      className={styles.pickerItem}
                      onClick={() => setInput((prev) => prev + em)}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
              {stickerOpen && (
                <div className={styles.picker}>
                  {STICKER_EMOJI.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className={styles.pickerItemSticker}
                      onClick={() => sendSticker(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <input
                className={styles.input}
                placeholder="Сообщение..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
              />
              <button type="submit" className={styles.sendBtn} disabled={sending || !input.trim()} title="Отправить">
                ➤
              </button>
            </form>
          </>
        ) : (
          <div className={styles.placeholder}>Выберите диалог слева</div>
        )}
      </div>
    </div>
  )
}
