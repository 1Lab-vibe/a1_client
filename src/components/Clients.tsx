import { useState, useEffect, useMemo } from 'react'
import { fetchClients, updateClient } from '../api/n8n'
import type { Client } from '../types'
import styles from './Clients.module.css'

/** Все ключи из списка клиентов, id первым */
function getAllKeys(list: Client[]): string[] {
  const set = new Set<string>()
  list.forEach((c) => Object.keys(c).forEach((k) => set.add(k)))
  const arr = Array.from(set).sort((a, b) => (a === 'id' ? -1 : b === 'id' ? 1 : a.localeCompare(b)))
  if (arr[0] !== 'id' && arr.includes('id')) return ['id', ...arr.filter((k) => k !== 'id')]
  return arr
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

  const columns = useMemo(() => getAllKeys(list), [list])

  const load = () => {
    setLoading(true)
    setError(null)
    fetchClients()
      .then((data) => setList(data.clients ?? []))
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
                <th key={key}>{key}</th>
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
          columns={getAllKeys([selected])}
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
    const out: Client = { id: String(client.id) }
    columns.forEach((key) => {
      const raw = form[key] ?? ''
      if (key === 'id') {
        out.id = raw || String(client.id)
        return
      }
      if (raw === '') {
        out[key] = ''
        return
      }
      try {
        const parsed = JSON.parse(raw)
        out[key] = parsed
      } catch {
        out[key] = raw
      }
    })
    onSave(out)
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
                <span>{key}</span>
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
