import type { N8nMessage } from '../types'
import { downloadCOOAttachment } from '../api/n8n'
import { hasHtmlTags, sanitizeHtml } from '../utils/htmlSanitize'
import { formatMessageTime } from '../utils/dateFormat'
import styles from './MessageList.module.css'

interface MessageListProps {
  messages: N8nMessage[]
  isLoading: boolean
}

function attachmentName(att: NonNullable<N8nMessage['attachments']>[number]): string {
  return att.name ?? att.filename ?? 'Файл'
}

function attachmentMime(att: NonNullable<N8nMessage['attachments']>[number]): string {
  return att.mimeType ?? att.contentType ?? att.content_type ?? ''
}

function attachmentType(att: NonNullable<N8nMessage['attachments']>[number]): 'image' | 'file' | 'chart' {
  if (att.type) return att.type
  const mime = attachmentMime(att)
  if (mime.startsWith('image/')) return 'image'
  return 'file'
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' })
}

async function downloadAttachment(att: NonNullable<N8nMessage['attachments']>[number]) {
  if (att.url && /^(https?:|data:|blob:)/.test(att.url)) return
  const file = await downloadCOOAttachment(att)
  const blobUrl = URL.createObjectURL(base64ToBlob(file.contentBase64, file.mimeType))
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = file.fileName || attachmentName(att)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className={styles.list}>
      {messages.map((msg) => (
        <div key={msg.id} className={`${styles.bubble} ${styles[msg.role]}`}>
          <span className={styles.messageTime}>{formatMessageTime(msg.timestamp)}</span>
          <div className={styles.content}>
            {msg.content &&
              (hasHtmlTags(msg.content) ? (
                <div className={styles.text} dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.content) }} />
              ) : (
                <div className={styles.text}>{msg.content}</div>
              ))}
            {msg.attachments?.map((att, i) => {
              const type = attachmentType(att)
              const name = attachmentName(att)
              const directUrl = att.url && /^(https?:|data:|blob:)/.test(att.url) ? att.url : ''
              return (
                <div key={i} className={styles.attachment}>
                  {type === 'image' && directUrl && (
                    <img src={directUrl} alt={name} className={styles.attImage} />
                  )}
                  {type === 'chart' && directUrl && (
                    <img src={directUrl} alt={name} className={styles.attImage} />
                  )}
                  {directUrl ? (
                    <a href={directUrl} target="_blank" rel="noopener noreferrer" download={name} className={styles.attFile}>
                      📎 {name}
                    </a>
                  ) : (
                    <button
                      type="button"
                      className={styles.attFileButton}
                      onClick={() => {
                        downloadAttachment(att).catch(() => alert('Не удалось скачать файл'))
                      }}
                    >
                      📎 {name}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className={`${styles.bubble} ${styles.bubbleTyping} ${styles.assistant}`}>
          <div className={styles.typing}>
            <span /><span /><span />
          </div>
        </div>
      )}
    </div>
  )
}
