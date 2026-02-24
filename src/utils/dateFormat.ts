/** Привести значение к формату dd-mm-yyyy hh:mm (для отображения в списках и карточках) */
export function formatDate(value: unknown): string {
  if (value === null || value === undefined) return '—'
  let date: Date
  if (typeof value === 'number') {
    date = new Date(value)
  } else if (typeof value === 'string') {
    date = new Date(value)
  } else {
    return String(value)
  }
  if (Number.isNaN(date.getTime())) return String(value)
  const d = date.getDate().toString().padStart(2, '0')
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const y = date.getFullYear()
  const h = date.getHours().toString().padStart(2, '0')
  const min = date.getMinutes().toString().padStart(2, '0')
  return `${d}-${m}-${y} ${h}:${min}`
}

/** Для сообщений: если сегодня — только время HH:MM, иначе dd.mm.yyyy HH:MM */
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—'
  const today = new Date()
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  const h = date.getHours().toString().padStart(2, '0')
  const min = date.getMinutes().toString().padStart(2, '0')
  if (sameDay) return `${h}:${min}`
  const d = date.getDate().toString().padStart(2, '0')
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const y = date.getFullYear()
  return `${d}.${m}.${y} ${h}:${min}`
}

const DATE_KEYS = new Set([
  'created_at', 'updated_at', 'createdAt', 'updatedAt', 'last_event_at', 'stage_updated_at',
  'closed_at', 'next_follow_up_at', 'last_contacted_at', 'last_email_sent_at', 'last_telegram_sent_at',
  'last_campaign_sent_at', 'primary_email_bounced_at', 'next_followup_at',
])

/** Вернуть true, если ключ поля обычно содержит дату/время */
export function isDateLikeKey(key: string): boolean {
  return DATE_KEYS.has(key) || key.endsWith('_at') || key.endsWith('At')
}

/** Форматировать значение ячейки: даты в dd-mm-yyyy hh:mm, остальное как есть */
export function formatCellValue(value: unknown, key?: string): string {
  if (value === null || value === undefined) return '—'
  if (key && isDateLikeKey(key)) {
    const formatted = formatDate(value)
    if (formatted !== '—') return formatted
  }
  if (typeof value === 'object') {
    const s = JSON.stringify(value)
    return s.length > 60 ? s.slice(0, 57) + '…' : s
  }
  return String(value)
}
