import type { N8nMessage } from '../types'
import { hasHtmlTags, sanitizeHtml } from '../utils/htmlSanitize'
import { formatMessageTime } from '../utils/dateFormat'
import styles from './MessageList.module.css'

interface MessageListProps {
  messages: N8nMessage[]
  isLoading: boolean
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
            {msg.attachments?.map((att, i) => (
              <div key={i} className={styles.attachment}>
                {att.type === 'image' && (
                  <img src={att.url} alt={att.name ?? 'Изображение'} className={styles.attImage} />
                )}
                {att.type === 'file' && (
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className={styles.attFile}>
                    📎 {att.name ?? 'Файл'}
                  </a>
                )}
                {att.type === 'chart' && (
                  <img src={att.url} alt={att.name ?? 'График'} className={styles.attImage} />
                )}
              </div>
            ))}
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
