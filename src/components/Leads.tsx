import { useState, useEffect, useMemo } from 'react'
import { fetchLeads, updateLead } from '../api/n8n'
import { useColumnVisibility } from '../hooks/useColumnVisibility'
import { ColumnVisibilityPopover } from './ColumnVisibilityPopover'
import { SectionUnderDevelopment } from './SectionUnderDevelopment'
import { formatCellValue, formatDate } from '../utils/dateFormat'
import type { Lead, LeadStage } from '../types'
import styles from './Leads.module.css'

const DEFAULT_STAGES: LeadStage[] = [
  { id: 'new', title: 'Новый', order: 0 },
  { id: 'in_work', title: 'В работе', order: 1 },
  { id: 'offer', title: 'Предложение', order: 2 },
  { id: 'follow_up', title: 'Доработка', order: 3 },
  { id: 'won', title: 'Успех', order: 4 },
  { id: 'lost', title: 'Отказ', order: 5 },
]

const LEAD_FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  title: 'Название',
  description: 'Описание',
  stageId: 'Этап',
  stage: 'Этап',
  status: 'Статус',
  contact_name: 'Контакт',
  contact_email: 'Email',
  contact_phone: 'Телефон',
  company_name: 'Компания',
  source: 'Источник',
  channel: 'Канал',
  direction: 'Направление',
  website: 'Сайт',
  priority: 'Приоритет',
  lead_score: 'Оценка',
  tags: 'Теги',
  next_follow_up_at: 'След. контакт',
  last_event_at: 'Последнее событие',
  stage_updated_at: 'Обновление этапа',
  created_at: 'Создан',
  updated_at: 'Обновлён',
  closed_at: 'Закрыт',
  close_reason: 'Причина закрытия',
  contactName: 'Контакт',
  contactPhone: 'Телефон',
  createdAt: 'Создан',
}

function getLeadLabel(key: string): string {
  return LEAD_FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
}

const SKIP_KEYS = new Set(['events', 'history'])

function isNotEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v).length > 0
  return true
}

/** Ключи лида для таблицы: только те, у которых хотя бы у одного лида непустое значение */
function getTableColumns(leads: Lead[]): string[] {
  const keyHasValue = new Map<string, boolean>()
  leads.forEach((l) => {
    Object.keys(l).forEach((k) => {
      if (SKIP_KEYS.has(k)) return
      if (isNotEmpty(l[k])) keyHasValue.set(k, true)
    })
  })
  const keys = Array.from(keyHasValue.keys()).filter((k) => k !== 'events')
  if (!keys.includes('id')) keys.unshift('id')
  if (!keys.includes('title')) keys.unshift('title')
  if (!keys.includes('stageId')) keys.push('stageId')
  return keys
}

/** Все ключи лида для карточки редактирования (кроме events) */
function getLeadFormKeys(lead: Lead): string[] {
  const keys = Object.keys(lead).filter((k) => !SKIP_KEYS.has(k) && k !== 'events')
  const order = ['id', 'title', 'stageId']
  const rest = keys.filter((k) => !order.includes(k)).sort((a, b) => a.localeCompare(b))
  return [...order.filter((k) => keys.includes(k)), ...rest]
}


export function Leads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<LeadStage[]>(DEFAULT_STAGES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [editing, setEditing] = useState<Lead | null>(null)

  const availableColumns = useMemo(() => getTableColumns(leads), [leads])
  const { visibleColumns, toggle, isVisible } = useColumnVisibility('leads', availableColumns)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchLeads()
      .then((data) => {
        setLeads(data.leads ?? [])
        setStages((data.stages?.length ? data.stages : DEFAULT_STAGES).sort((a, b) => a.order - b.order))
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const moveToStage = (lead: Lead, stageId: string) => {
    if (lead.stageId === stageId) return
    setMovingId(lead.id)
    updateLead({ ...lead, stageId })
      .then((data) => setLeads((prev) => prev.map((l) => (l.id === data.lead.id ? data.lead : l))))
      .catch((e) => alert(e instanceof Error ? e.message : 'Ошибка связи с сервером'))
      .finally(() => setMovingId(null))
  }

  const handleSaveEdit = (lead: Lead) => {
    updateLead(lead)
      .then((data) => {
        setLeads((prev) => prev.map((l) => (l.id === data.lead.id ? data.lead : l)))
        setEditing(null)
      })
      .catch((e) => alert(e instanceof Error ? e.message : 'Ошибка связи с сервером'))
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Лиды</h1>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return <SectionUnderDevelopment title="Лиды" />
  }

  const leadsByStage = stages.map((s) => ({ stage: s, items: leads.filter((l) => l.stageId === s.id) }))

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Лиды</h1>
        <div className={styles.headerRight}>
          <ColumnVisibilityPopover
            columns={availableColumns}
            getLabel={getLeadLabel}
            isVisible={isVisible}
            onToggle={toggle}
            title="Колонки в списке и канбане"
          />
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={viewMode === 'kanban' ? styles.toggleActive : ''}
              onClick={() => setViewMode('kanban')}
            >
              Канбан
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? styles.toggleActive : ''}
              onClick={() => setViewMode('list')}
            >
              Список
            </button>
          </div>
        </div>
      </div>
      {viewMode === 'kanban' ? (
        <div className={styles.kanban}>
          {leadsByStage.map(({ stage, items }) => (
            <div key={stage.id} className={styles.column}>
              <div className={styles.columnHead}>
                <span className={styles.columnTitle}>{stage.title}</span>
                <span className={styles.columnCount}>{items.length}</span>
              </div>
              <div className={styles.columnBody}>
                {items.map((lead) => (
                  <div key={lead.id} className={styles.card}>
                    <div className={styles.cardTitle}>{formatCellValue(lead.title ?? 'Без названия')}</div>
                    {getLeadFormKeys(lead)
                      .filter((k) => !['id', 'title', 'stageId'].includes(k) && isNotEmpty(lead[k]) && isVisible(k))
                      .slice(0, 5)
                      .map((k) => (
                        <div key={k} className={styles.cardMeta}>
                          <span className={styles.cardMetaLabel}>{getLeadLabel(k)}:</span>{' '}
                          {formatCellValue(lead[k], k)}
                        </div>
                      ))}
                    <div className={styles.cardActions}>
                      {stages.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={s.id === lead.stageId ? styles.stageBtnActive : styles.stageBtn}
                          onClick={(e) => {
                            e.stopPropagation()
                            moveToStage(lead, s.id)
                          }}
                          disabled={movingId === lead.id}
                        >
                          {s.title}
                        </button>
                      ))}
                    </div>
                    <button type="button" className={styles.cardEdit} onClick={() => setEditing(lead)}>
                      Редактировать
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {visibleColumns.map((key) => (
                  <th key={key}>{getLeadLabel(key)}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  {visibleColumns.map((key) => (
                    <td key={key}>{formatCellValue(lead[key], key)}</td>
                  ))}
                  <td>
                    <button type="button" className={styles.rowEdit} onClick={() => setEditing(lead)}>
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <LeadEditModal
          lead={editing}
          stages={stages}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  )
}

function LeadEditModal({
  lead,
  stages,
  onClose,
  onSave,
}: {
  lead: Lead
  stages: LeadStage[]
  onClose: () => void
  onSave: (l: Lead) => void
}) {
  const [form, setForm] = useState<Lead>(lead)
  const events = lead.events ?? []
  const formKeys = getLeadFormKeys(lead)

  const updateField = (key: string, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalLead} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Карточка лида</h2>
        <div className={styles.modalLeadGrid}>
          <div className={styles.modalBody}>
            {formKeys.map((key) => (
              <label key={key}>
                <span>{getLeadLabel(key)}</span>
                {key === 'stageId' ? (
                  <select
                    className={styles.input}
                    value={String(form[key] ?? '')}
                    onChange={(e) => updateField(key, e.target.value)}
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                ) : typeof form[key] === 'object' && form[key] !== null ? (
                  <input
                    className={styles.input}
                    value={JSON.stringify(form[key])}
                    onChange={(e) => {
                      try {
                        updateField(key, JSON.parse(e.target.value || 'null'))
                      } catch {
                        updateField(key, e.target.value)
                      }
                    }}
                  />
                ) : (
                  <input
                    className={styles.input}
                    value={String(form[key] ?? '')}
                    onChange={(e) => updateField(key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          <div className={styles.modalEvents}>
            <h3 className={styles.eventsTitle}>События</h3>
            {events.length === 0 ? (
              <p className={styles.eventsEmpty}>Нет событий</p>
            ) : (
              <ul className={styles.eventsList}>
                {events.map((ev, i) => (
                  <li key={ev.id ?? i} className={styles.eventItem}>
                    <span className={styles.eventTime}>
                      {ev.createdAt ?? (ev.timestamp ? formatDate(ev.timestamp) : '')}
                    </span>
                    {ev.type && <span className={styles.eventType}>{ev.type}</span>}
                    {ev.message != null && <span className={styles.eventMessage}>{String(ev.message)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" onClick={onClose}>Отмена</button>
          <button type="button" onClick={() => onSave(form)}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}
