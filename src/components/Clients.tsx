import { useState, useEffect, useMemo } from 'react'
import { fetchClients, updateClient } from '../api/n8n'
import type { Client } from '../types'
import styles from './Clients.module.css'

/** Русские названия полей клиента */
const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  name: 'Имя',
  legal_name: 'Юр. название',
  website: 'Сайт',
  industry: 'Отрасль',
  city: 'Город',
  country: 'Страна',
  annual_revenue: 'Годовой доход',
  employees: 'Сотрудников',
  is_customer: 'Клиент',
  customer_stage: 'Стадия клиента',
  source_channel: 'Канал',
  primary_email: 'Email',
  primary_phone: 'Телефон',
  contacts: 'Контакты',
  tags: 'Теги',
  notes: 'Заметки',
  outreach_status: 'Статус охвата',
  next_followup_at: 'След. контакт',
  company_id: 'Компания',
  created_at: 'Создан',
  updated_at: 'Обновлён',
  last_contacted_at: 'Последний контакт',
  last_email_sent_at: 'Последнее письмо',
  last_telegram_sent_at: 'Последний Telegram',
  last_campaign_id: 'Кампания',
  last_campaign_sent_at: 'Отправка кампании',
  campaign_sent_count: 'Отправок кампании',
  primary_email_status: 'Статус email',
  primary_email_bounced_at: 'Bounce email',
  primary_email_bounce_reason: 'Причина bounce',
  primary_email_replacement: 'Замена email',
  telegram_user_id: 'Telegram user',
  telegram_chat_id: 'Telegram chat',
}

function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
}

/** Колонки, которые не показываем в таблице (в карточке остаются) */
const HIDDEN_TABLE_KEYS = new Set([
  'id',
  'company_id',
  'outreach_status',
  'campaign_sent_count',
  'is_customer',
  'contacts',
  'created_at',
  'updated_at',
  'last_contacted_at',
  'last_email_sent_at',
  'last_telegram_sent_at',
  'last_campaign_sent_at',
  'primary_email_bounced_at',
  'next_followup_at',
])

/** Порядок колонок в таблице: сначала основные, остальные по алфавиту */
const TABLE_COLUMN_ORDER = ['name', 'primary_phone', 'primary_email', 'notes', 'tags']

/** Значение не пустое (для отбора колонок таблицы) */
function isNotEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v).length > 0
  return true
}

/** Колонки для таблицы: только не скрытые ключи с хотя бы одним непустым значением. Порядок: имя, телефон, email, заметки, теги, остальные по алфавиту. */
function getTableColumns(list: Client[]): string[] {
  const keyHasValue = new Map<string, boolean>()
  list.forEach((c) =>
    Object.keys(c).forEach((k) => {
      if (!HIDDEN_TABLE_KEYS.has(k) && isNotEmpty(c[k])) keyHasValue.set(k, true)
    })
  )
  const keys = Array.from(keyHasValue.keys())
  const ordered: string[] = []
  for (const k of TABLE_COLUMN_ORDER) {
    if (keys.includes(k)) ordered.push(k)
  }
  const rest = keys.filter((k) => !TABLE_COLUMN_ORDER.includes(k)).sort((a, b) => a.localeCompare(b))
  return [...ordered, ...rest]
}

/** Все ключи клиента для карточки редактирования (все поля), id первым */
function getAllKeysForEditor(client: Client): string[] {
  const keys = Object.keys(client).sort((a, b) => (a === 'id' ? -1 : b === 'id' ? 1 : a.localeCompare(b)))
  if (keys[0] !== 'id' && keys.includes('id')) return ['id', ...keys.filter((k) => k !== 'id')]
  return keys
}

function cellValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') {
    const s = JSON.stringify(v)
    return s.length > 60 ? s.slice(0, 57) + '…' : s
  }
  return String(v)
}

export function Clients() {
  const [list, setList] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Client | null>(null)
  const [saving, setSaving] = useState(false)

  const columns = useMemo(() => getTableColumns(list), [list])

  const load = () => {
    setLoading(true)
    setError(null)
    fetchClients()
      .then((data) => {
        const raw = Array.isArray(data) ? data : (data?.clients ?? [])
        const list = Array.isArray(raw)
          ? raw.filter((c): c is Client => c != null && typeof c === 'object' && !Array.isArray(c))
          : []
        setList(list)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleSave = (client: Client) => {
    setSaving(true)
    updateClient(client)
      .then((data) => {
        setList((prev) => prev.map((c) => (String(c.id) === String(data.client.id) ? data.client : c)))
        setSelected(data.client)
      })
      .catch((e) => alert(e instanceof Error ? e.message : 'Ошибка сохранения'))
      .finally(() => setSaving(false))
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Клиенты</h1>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Клиенты</h1>
        <div className={styles.error}>{error}</div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Клиенты</h1>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((key) => (
                <th key={key}>{getFieldLabel(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={columns.length || 1} className={styles.empty}>
                  Нет клиентов
                </td>
              </tr>
            ) : (
              list.map((c, idx) => (
                <tr
                  key={String(c.id) || idx}
                  onClick={() => setSelected(c)}
                  className={styles.rowClick}
                >
                  {columns.map((key) => (
                    <td key={key} className={key === 'id' ? styles.cellId : undefined}>
                      {cellValue(c[key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <ClientEditor
          client={selected}
          columns={getAllKeysForEditor(selected)}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  )
}

interface ClientEditorProps {
  client: Client
  columns: string[]
  onClose: () => void
  onSave: (c: Client) => void
  saving: boolean
}

function ClientEditor({ client, columns, onClose, onSave, saving }: ClientEditorProps) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    columns.forEach((key) => {
      const v = client[key]
      init[key] =
        v === null || v === undefined
          ? ''
          : typeof v === 'object'
            ? JSON.stringify(v, null, 2)
            : String(v)
    })
    return init
  })

  const change = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    const edited: Record<string, unknown> = { ...client }
    columns.forEach((key) => {
      const raw = form[key] ?? ''
      if (key === 'id') {
        edited.id = raw || String(client.id)
        return
      }
      if (raw === '') {
        edited[key] = null
        return
      }
      try {
        edited[key] = JSON.parse(raw)
      } catch {
        edited[key] = raw
      }
    })
    onSave(edited as Client)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2>Редактирование клиента</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.form}>
          {columns.map((key) => {
            const val = form[key] ?? ''
            const isLong = val.length > 80 || val.includes('\n')
            return (
              <label key={key}>
                <span>{getFieldLabel(key)}</span>
                {isLong ? (
                  <textarea
                    value={val}
                    onChange={(e) => change(key, e.target.value)}
                    rows={4}
                    readOnly={key === 'id'}
                  />
                ) : (
                  <input
                    value={val}
                    onChange={(e) => change(key, e.target.value)}
                    readOnly={key === 'id'}
                  />
                )}
              </label>
            )
          })}
        </div>
        <div className={styles.modalFoot}>
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
