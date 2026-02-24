import { useState, useEffect, useMemo } from 'react'
import { fetchInvoices, updateInvoice } from '../api/n8n'
import { useColumnVisibility } from '../hooks/useColumnVisibility'
import { ColumnVisibilityPopover } from './ColumnVisibilityPopover'
import { SectionUnderDevelopment } from './SectionUnderDevelopment'
import { formatCellValue } from '../utils/dateFormat'
import type { Invoice } from '../types'
import styles from './Leads.module.css'

interface Stage {
  id: string
  title: string
  order: number
}

const DEFAULT_STAGES: Stage[] = [
  { id: 'draft', title: 'Черновик', order: 0 },
  { id: 'sent', title: 'Отправлен', order: 1 },
  { id: 'paid', title: 'Оплачен', order: 2 },
]

const INVOICE_LABELS: Record<string, string> = {
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

function getInvoiceLabel(k: string): string {
  return INVOICE_LABELS[k] ?? k.replace(/_/g, ' ')
}

function isNotEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v).length > 0
  return true
}

function getInvoiceTableColumns(items: Invoice[]): string[] {
  const keyHasValue = new Map<string, boolean>()
  items.forEach((i) => {
    Object.keys(i).forEach((k) => {
      if (isNotEmpty(i[k])) keyHasValue.set(k, true)
    })
  })
  const keys = Array.from(keyHasValue.keys())
  if (!keys.includes('id')) keys.unshift('id')
  if (!keys.includes('title')) keys.unshift('title')
  if (!keys.includes('stageId')) keys.push('stageId')
  return keys
}

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [editing, setEditing] = useState<Invoice | null>(null)

  const availableColumns = useMemo(() => getInvoiceTableColumns(invoices), [invoices])
  const { visibleColumns, toggle, isVisible } = useColumnVisibility('invoices', availableColumns)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchInvoices()
      .then((data) => {
        setInvoices(data.invoices ?? [])
        setStages((data.stages?.length ? data.stages : DEFAULT_STAGES).sort((a, b) => a.order - b.order))
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const moveToStage = (inv: Invoice, stageId: string) => {
    if (inv.stageId === stageId) return
    setMovingId(inv.id)
    updateInvoice({ ...inv, stageId })
      .then((data) => setInvoices((prev) => prev.map((i) => (i.id === data.invoice.id ? data.invoice : i))))
      .catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setMovingId(null))
  }

  const handleSaveEdit = (inv: Invoice) => {
    updateInvoice(inv)
      .then((data) => {
        setInvoices((prev) => prev.map((i) => (i.id === data.invoice.id ? data.invoice : i)))
        setEditing(null)
      })
      .catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'))
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Счета</h1>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return <SectionUnderDevelopment title="Счета" />
  }

  const byStage = stages.map((s) => ({ stage: s, items: invoices.filter((i) => i.stageId === s.id) }))

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Счета</h1>
        <div className={styles.headerRight}>
          <ColumnVisibilityPopover columns={availableColumns} getLabel={getInvoiceLabel} isVisible={isVisible} onToggle={toggle} title="Колонки в списке и канбане" />
          <div className={styles.viewToggle}>
            <button type="button" className={viewMode === 'kanban' ? styles.toggleActive : ''} onClick={() => setViewMode('kanban')}>Канбан</button>
            <button type="button" className={viewMode === 'list' ? styles.toggleActive : ''} onClick={() => setViewMode('list')}>Список</button>
          </div>
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
                {items.map((inv) => (
                  <div key={inv.id} className={styles.card}>
                    <div className={styles.cardTitle}>{formatCellValue(inv.title ?? 'Без названия')}</div>
                    {visibleColumns
                      .filter((k) => !['id', 'title', 'stageId'].includes(k) && isNotEmpty(inv[k]) && isVisible(k))
                      .slice(0, 5)
                      .map((k) => (
                        <div key={k} className={styles.cardMeta}>
                          <span className={styles.cardMetaLabel}>{getInvoiceLabel(k)}:</span> {formatCellValue(inv[k], k)}
                        </div>
                      ))}
                    <div className={styles.cardActions}>
                      {stages.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={s.id === inv.stageId ? styles.stageBtnActive : styles.stageBtn}
                          onClick={(e) => { e.stopPropagation(); moveToStage(inv, s.id) }}
                          disabled={movingId === inv.id}
                        >
                          {s.title}
                        </button>
                      ))}
                    </div>
                    <button type="button" className={styles.cardEdit} onClick={() => setEditing(inv)}>Редактировать</button>
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
                  <th key={key}>{getInvoiceLabel(key)}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  {visibleColumns.map((key) => (
                    <td key={key}>{formatCellValue(inv[key], key)}</td>
                  ))}
                  <td><button type="button" className={styles.rowEdit} onClick={() => setEditing(inv)}>Открыть</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <InvoiceEditModal inv={editing} stages={stages} onClose={() => setEditing(null)} onSave={handleSaveEdit} />
      )}
    </div>
  )
}

function InvoiceEditModal({ inv, stages, onClose, onSave }: { inv: Invoice; stages: Stage[]; onClose: () => void; onSave: (i: Invoice) => void }) {
  const [form, setForm] = useState(inv)
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Редактирование счёта</h2>
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
