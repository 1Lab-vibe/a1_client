import { useState, useEffect } from 'react'
import { fetchLeads, updateLead } from '../api/n8n'
import type { Lead, LeadStage } from '../types'
import styles from './Leads.module.css'

const DEFAULT_STAGES: LeadStage[] = [
  { id: 'new', title: 'Не обработан', order: 0 },
  { id: 'in_progress', title: 'В работе', order: 1 },
  { id: 'success', title: 'Успешный', order: 2 },
]

export function Leads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<LeadStage[]>(DEFAULT_STAGES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [editing, setEditing] = useState<Lead | null>(null)

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
      .catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setMovingId(null))
  }

  const handleSaveEdit = (lead: Lead) => {
    updateLead(lead)
      .then((data) => {
        setLeads((prev) => prev.map((l) => (l.id === data.lead.id ? data.lead : l)))
        setEditing(null)
      })
      .catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'))
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
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Лиды</h1>
        <div className={styles.error}>{error}</div>
      </div>
    )
  }

  const leadsByStage = stages.map((s) => ({ stage: s, items: leads.filter((l) => l.stageId === s.id) }))

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Лиды</h1>
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
                    <div className={styles.cardTitle}>{lead.title}</div>
                    {lead.description && <div className={styles.cardDesc}>{lead.description}</div>}
                    {(lead.contactName || lead.contactPhone) && (
                      <div className={styles.cardContact}>
                        {lead.contactName} {lead.contactPhone}
                      </div>
                    )}
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
                <th>Название</th>
                <th>Этап</th>
                <th>Контакт</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.title}</td>
                  <td>{stages.find((s) => s.id === lead.stageId)?.title ?? lead.stageId}</td>
                  <td>{lead.contactName || lead.contactPhone || '—'}</td>
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
  const [form, setForm] = useState(lead)
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Редактирование лида</h2>
        <div className={styles.modalBody}>
          <label>
            Название
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={styles.input}
            />
          </label>
          <label>
            Описание
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={styles.input}
              rows={3}
            />
          </label>
          <label>
            Этап
            <select
              value={form.stageId}
              onChange={(e) => setForm((f) => ({ ...f, stageId: e.target.value }))}
              className={styles.input}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </label>
          <label>
            Контакт (имя)
            <input
              value={form.contactName ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              className={styles.input}
            />
          </label>
          <label>
            Телефон
            <input
              value={form.contactPhone ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              className={styles.input}
            />
          </label>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" onClick={onClose}>Отмена</button>
          <button type="button" onClick={() => onSave(form)}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}
