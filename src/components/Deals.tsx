import { useState, useEffect, useMemo } from 'react'
import { fetchDeals, updateDeal } from '../api/n8n'
import { useColumnVisibility } from '../hooks/useColumnVisibility'
import { ColumnVisibilityPopover } from './ColumnVisibilityPopover'
import { SectionErrorState } from './SectionErrorState'
import { formatCellValue } from '../utils/dateFormat'
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

const DEAL_LABELS: Record<string, string> = {
  id: 'ID',
  title: 'Название',
  description: 'Описание',
  stageId: 'Этап',
  contactName: 'Контакт',
  contactPhone: 'Телефон',
  createdAt: 'Создан',
  created_at: 'Создан',
  updated_at: 'Обновлён',
}

function getDealLabel(k: string): string {
  return DEAL_LABELS[k] ?? k.replace(/_/g, ' ')
}

function isNotEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v).length > 0
  return true
}

function getDealTableColumns(items: Deal[]): string[] {
  const keyHasValue = new Map<string, boolean>()
  items.forEach((d) => {
    Object.keys(d).forEach((k) => {
      if (k !== 'events' && isNotEmpty(d[k])) keyHasValue.set(k, true)
    })
  })
  const keys = Array.from(keyHasValue.keys())
  if (!keys.includes('id')) keys.unshift('id')
  if (!keys.includes('title')) keys.unshift('title')
  if (!keys.includes('stageId')) keys.push('stageId')
  return keys
}

export function Deals() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [editing, setEditing] = useState<Deal | null>(null)
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')

  const filteredDeals = useMemo(() => {
    const q = query.trim().toLowerCase()
    return deals.filter((deal) => {
      const stageOk = stageFilter === 'all' || deal.stageId === stageFilter
      if (!stageOk) return false
      if (!q) return true
      return [deal.title, deal.description, deal.contactName, deal.contactPhone, deal.stage, deal.status]
        .some((value) => String(value ?? '').toLowerCase().includes(q))
    })
  }, [deals, query, stageFilter])
  const kpis = useMemo(() => [
    { label: 'Всего', value: deals.length },
    { label: 'Выиграно', value: deals.filter((deal) => ['won', 'paid', 'success'].includes(String(deal.stageId ?? deal.stage ?? deal.status))).length },
    { label: 'Сумма', value: deals.reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0) },
    { label: 'В работе', value: deals.filter((deal) => !['won', 'lost', 'closed'].includes(String(deal.stageId ?? deal.stage ?? deal.status))).length },
  ], [deals])

  const availableColumns = useMemo(() => getDealTableColumns(filteredDeals), [filteredDeals])
  const { visibleColumns, toggle, isVisible } = useColumnVisibility('deals', availableColumns)

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
    return <SectionErrorState title="Сделки" message={error} onRetry={load} />
  }

  const byStage = stages.map((s) => ({ stage: s, items: filteredDeals.filter((d) => d.stageId === s.id) }))

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Сделки</h1>
        <div className={styles.headerRight}>
          <ColumnVisibilityPopover columns={availableColumns} getLabel={getDealLabel} isVisible={isVisible} onToggle={toggle} title="Колонки в списке и канбане" />
          <div className={styles.viewToggle}>
            <button type="button" className={viewMode === 'kanban' ? styles.toggleActive : ''} onClick={() => setViewMode('kanban')}>Канбан</button>
            <button type="button" className={viewMode === 'list' ? styles.toggleActive : ''} onClick={() => setViewMode('list')}>Список</button>
          </div>
        </div>
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
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по сделкам" />
        <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
          <option value="all">Все стадии</option>
          {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.title}</option>)}
        </select>
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
                    <div className={styles.cardTitle}>{formatCellValue(deal.title ?? 'Без названия')}</div>
                    {Object.keys(deal)
                      .filter((k) => !['id', 'title', 'stageId'].includes(k) && isNotEmpty(deal[k]) && isVisible(k))
                      .slice(0, 5)
                      .map((k) => (
                        <div key={k} className={styles.cardMeta}>
                          <span className={styles.cardMetaLabel}>{getDealLabel(k)}:</span> {formatCellValue(deal[k], k)}
                        </div>
                      ))}
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
                {visibleColumns.map((key) => (
                  <th key={key}>{getDealLabel(key)}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className={styles.empty}>Сделки не найдены по текущим фильтрам</td>
                </tr>
              ) : filteredDeals.map((deal) => (
                <tr key={deal.id}>
                  {visibleColumns.map((key) => (
                    <td key={key}>{formatCellValue(deal[key], key)}</td>
                  ))}
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
