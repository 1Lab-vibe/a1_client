import { useState, useEffect } from 'react'
import { fetchDeals, updateDeal } from '../api/n8n'
import type { Deal } from '../types'
import styles from './Leads.module.css'

interface Stage {
  id: string
  title: string
  order: number
}

const DEFAULT_STAGES: Stage[] = [
  { id: 'new', title: 'Новая', order: 0 },
  { id: 'negotiation', title: 'Переговоры', order: 1 },
  { id: 'won', title: 'Выиграна', order: 2 },
  { id: 'lost', title: 'Проиграна', order: 3 },
]

export function Deals() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [editing, setEditing] = useState<Deal | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchDeals()
      .then((data) => {
        setDeals(data.deals ?? [])
        setStages((data.stages?.length ? data.stages : DEFAULT_STAGES).sort((a, b) => a.order - b.order))
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const moveToStage = (deal: Deal, stageId: string) => {
    if (deal.stageId === stageId) return
    setMovingId(deal.id)
    updateDeal({ ...deal, stageId })
      .then((data) => setDeals((prev) => prev.map((d) => (d.id === data.deal.id ? data.deal : d))))
      .catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setMovingId(null))
  }

  const handleSaveEdit = (deal: Deal) => {
    updateDeal(deal)
      .then((data) => {
        setDeals((prev) => prev.map((d) => (d.id === data.deal.id ? data.deal : d)))
        setEditing(null)
      })
      .catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'))
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Сделки</h1>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Сделки</h1>
        <div className={styles.error}>{error}</div>
      </div>
    )
  }

  const byStage = stages.map((s) => ({ stage: s, items: deals.filter((d) => d.stageId === s.id) }))

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Сделки</h1>
        <div className={styles.viewToggle}>
          <button type="button" className={viewMode === 'kanban' ? styles.toggleActive : ''} onClick={() => setViewMode('kanban')}>Канбан</button>
          <button type="button" className={viewMode === 'list' ? styles.toggleActive : ''} onClick={() => setViewMode('list')}>Список</button>
        </div>
      </div>
      {viewMode === 'kanban' ? (
        <div className={styles.kanban}>
          {byStage.map(({ stage, items }) => (
            <div key={stage.id} className={styles.column}>
              <div className={styles.columnHead}>
                <span className={styles.columnTitle}>{stage.title}</span>
                <span className={styles.columnCount}>{items.length}</span>
              </div>
              <div className={styles.columnBody}>
                {items.map((deal) => (
                  <div key={deal.id} className={styles.card}>
                    <div className={styles.cardTitle}>{deal.title}</div>
                    {deal.description && <div className={styles.cardDesc}>{deal.description}</div>}
                    {(deal.contactName || deal.contactPhone) && (
                      <div className={styles.cardContact}>{deal.contactName} {deal.contactPhone}</div>
                    )}
                    <div className={styles.cardActions}>
                      {stages.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={s.id === deal.stageId ? styles.stageBtnActive : styles.stageBtn}
                          onClick={(e) => { e.stopPropagation(); moveToStage(deal, s.id) }}
                          disabled={movingId === deal.id}
                        >
                          {s.title}
                        </button>
                      ))}
                    </div>
                    <button type="button" className={styles.cardEdit} onClick={() => setEditing(deal)}>Редактировать</button>
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
              {deals.map((deal) => (
                <tr key={deal.id}>
                  <td>{deal.title}</td>
                  <td>{stages.find((s) => s.id === deal.stageId)?.title ?? deal.stageId}</td>
                  <td>{deal.contactName || deal.contactPhone || '—'}</td>
                  <td><button type="button" className={styles.rowEdit} onClick={() => setEditing(deal)}>Открыть</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <DealEditModal deal={editing} stages={stages} onClose={() => setEditing(null)} onSave={handleSaveEdit} />
      )}
    </div>
  )
}

function DealEditModal({ deal, stages, onClose, onSave }: { deal: Deal; stages: Stage[]; onClose: () => void; onSave: (d: Deal) => void }) {
  const [form, setForm] = useState(deal)
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Редактирование сделки</h2>
        <div className={styles.modalBody}>
          <label>Название <input className={styles.input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></label>
          <label>Описание <textarea className={styles.input} rows={3} value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label>
          <label>Этап <select className={styles.input} value={form.stageId} onChange={(e) => setForm((f) => ({ ...f, stageId: e.target.value }))}>{stages.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
          <label>Контакт <input className={styles.input} value={form.contactName ?? ''} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} /></label>
          <label>Телефон <input className={styles.input} value={form.contactPhone ?? ''} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} /></label>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" onClick={onClose}>Отмена</button>
          <button type="button" onClick={() => onSave(form)}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}
