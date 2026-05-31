import { useState, useEffect, useMemo } from 'react'
import { fetchClients, updateClient } from '../api/n8n'
import { useColumnVisibility } from '../hooks/useColumnVisibility'
import { ColumnVisibilityPopover } from './ColumnVisibilityPopover'
import { SectionErrorState } from './SectionErrorState'
import { formatCellValue } from '../utils/dateFormat'
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

const SYSTEM_FIELD_KEYS = new Set([
  'id',
  'company_id',
  'companyId',
  'auth_user_id',
  'user_id',
  'owner_id',
  'customer_id',
  'lead_id',
  'deal_id',
  'external_id',
  'provider_id',
  'provider_key',
  'source_id',
  'dedupe_key',
  'fingerprint',
  'raw',
  'raw_data',
  'payload',
  'meta',
  'metadata',
  'data',
  'created_at',
  'createdAt',
  'updated_at',
  'updatedAt',
  'deleted_at',
  'sync_at',
  'synced_at',
  'last_contacted_at',
  'last_email_sent_at',
  'last_telegram_sent_at',
  'last_campaign_sent_at',
  'primary_email_bounced_at',
  'primary_email_bounce_reason',
  'primary_email_replacement',
  'telegram_user_id',
  'telegram_chat_id',
  'last_campaign_id',
  'campaign_sent_count',
  'contacts',
])

/** Колонки, которые не показываем в таблице */
const HIDDEN_TABLE_KEYS = new Set([
  ...SYSTEM_FIELD_KEYS,
  'outreach_status',
  'is_customer',
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

/** Бизнес-поля клиента для карточки редактирования */
function getAllKeysForEditor(client: Client): string[] {
  const preferred = [
    'name',
    'legal_name',
    'primary_email',
    'primary_phone',
    'website',
    'industry',
    'city',
    'country',
    'annual_revenue',
    'employees',
    'customer_stage',
    'source_channel',
    'tags',
    'notes',
  ]
  const keys = Object.keys(client).filter((key) => !SYSTEM_FIELD_KEYS.has(key) && isNotEmpty(client[key]))
  const ordered = preferred.filter((key) => keys.includes(key))
  const rest = keys.filter((key) => !preferred.includes(key)).sort((a, b) => a.localeCompare(b))
  return [...ordered, ...rest]
}


export function Clients() {
  const [list, setList] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Client | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')

  const stages = useMemo(() => Array.from(new Set(list.map((item) => String(item.customer_stage ?? item.outreach_status ?? 'unknown')).filter(Boolean))).sort(), [list])
  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((item) => {
      const stage = String(item.customer_stage ?? item.outreach_status ?? 'unknown')
      const stageOk = stageFilter === 'all' || stage === stageFilter
      if (!stageOk) return false
      if (!q) return true
      return [item.name, item.legal_name, item.primary_email, item.primary_phone, item.website, item.industry, item.city]
        .some((value) => String(value ?? '').toLowerCase().includes(q))
    })
  }, [list, query, stageFilter])
  const kpis = useMemo(() => [
    { label: 'Всего', value: list.length },
    { label: 'Клиенты', value: list.filter((item) => item.is_customer).length },
    { label: 'С email', value: list.filter((item) => isNotEmpty(item.primary_email)).length },
    { label: 'Без активности', value: list.filter((item) => !isNotEmpty(item.last_contacted_at)).length },
  ], [list])

  const availableColumns = useMemo(() => getTableColumns(filteredList), [filteredList])
  const { visibleColumns, toggle, isVisible } = useColumnVisibility('clients', availableColumns)

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
    return <SectionErrorState title="Клиенты" message={error} onRetry={load} />
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Клиенты</h1>
        <ColumnVisibilityPopover
          columns={availableColumns}
          getLabel={getFieldLabel}
          isVisible={isVisible}
          onToggle={toggle}
          title="Колонки в списке"
        />
      </div>
      <div className={styles.kpiGrid}>
        {kpis.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value.toLocaleString('ru-RU')}</strong>
          </article>
        ))}
      </div>
      <div className={styles.filters}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по клиентам" />
        <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
          <option value="all">Все статусы</option>
          {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
        </select>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {visibleColumns.map((key) => (
                <th key={key}>{getFieldLabel(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className={styles.empty}>
                  Клиенты не найдены по текущим фильтрам
                </td>
              </tr>
            ) : (
              filteredList.map((c, idx) => (
                <tr
                  key={String(c.id) || idx}
                  onClick={() => setSelected(c)}
                  className={styles.rowClick}
                >
                  {visibleColumns.map((key) => (
                    <td key={key} className={key === 'id' ? styles.cellId : undefined}>
                      {formatCellValue(c[key], key)}
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
                  />
                ) : (
                  <input
                    value={val}
                    onChange={(e) => change(key, e.target.value)}
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
