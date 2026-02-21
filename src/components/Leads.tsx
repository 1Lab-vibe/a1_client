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
    const updated = { ...lead, stageId }
    updateLead(updated)
      .then((data) => {
        setLeads((prev) => prev.map((l) => (l.id === data.lead.id ? data.lead : l)))
      })
      .catch((e) => alert(e instanceof Error ? e.message : 'Ошибка обновления'))
      .finally(() => setMovingId(null))
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

  const leadsByStage = stages.map((s) => ({
    stage: s,
    items: leads.filter((l) => l.stageId === s.id),
  }))

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Лиды</h1>
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
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
