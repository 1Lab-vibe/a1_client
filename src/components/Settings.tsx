import { useState, useEffect, useMemo } from 'react'
import { getConfig, updateConfig, type CompanyConfig } from '../api/n8n'
import { SectionUnderDevelopment } from './SectionUnderDevelopment'
import styles from './Settings.module.css'

const MAX_NEST_DEPTH = 3

/** Разворачивает вложенный конфиг в плоские пары "section.key" или "section.sub.key" (до 3 уровней) */
function flattenConfig(
  obj: unknown,
  prefix = '',
  depth = 0
): [string, unknown][] {
  if (depth >= MAX_NEST_DEPTH) {
    return prefix ? [[prefix, obj]] : []
  }
  if (obj === null || obj === undefined) {
    return prefix ? [[prefix, obj]] : []
  }
  if (Array.isArray(obj)) {
    return prefix ? [[prefix, obj]] : []
  }
  if (typeof obj === 'object') {
    const entries: [string, unknown][] = []
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k
      const isNested =
        v !== null &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        depth + 1 < MAX_NEST_DEPTH &&
        Object.keys(v).length > 0
      if (isNested) {
        entries.push(...flattenConfig(v, key, depth + 1))
      } else {
        entries.push([key, v])
      }
    }
    return entries
  }
  return prefix ? [[prefix, obj]] : []
}

/** Собирает плоские ключи "a.b.c" обратно во вложенный объект */
function unflattenConfig(entries: [string, unknown][]): CompanyConfig {
  const root: Record<string, unknown> = {}
  for (const [key, value] of entries) {
    const parts = key.split('.')
    let cur: Record<string, unknown> = root
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]
      if (!(p in cur) || typeof cur[p] !== 'object' || cur[p] === null) {
        cur[p] = {}
      }
      cur = cur[p] as Record<string, unknown>
    }
    cur[parts[parts.length - 1]] = value
  }
  return root
}

function configToEntries(config: CompanyConfig): [string, unknown][] {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return []
  return flattenConfig(config)
}

function valueToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v, null, 2)
  return String(v)
}

function parseValue(s: string): unknown {
  const t = s.trim()
  if (t === '') return ''
  try {
    return JSON.parse(t)
  } catch {
    return t
  }
}

export function Settings() {
  const [config, setConfig] = useState<CompanyConfig>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const entries = useMemo(() => configToEntries(config), [config])

  const load = () => {
    setLoading(true)
    setError(null)
    getConfig()
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const startEdit = (key: string, value: unknown) => {
    setEditingKey(key)
    setEditValue(valueToString(value))
  }

  const handleSaveEdit = () => {
    if (editingKey == null) return
    setSaving(true)
    const flat = configToEntries(config)
    const hasKey = flat.some(([k]) => k === editingKey)
    const newFlat = hasKey
      ? flat.map(([k, v]) =>
          k === editingKey ? ([k, parseValue(editValue)] as [string, unknown]) : ([k, v] as [string, unknown])
        )
      : [...flat, [editingKey, parseValue(editValue)] as [string, unknown]]
    const next = unflattenConfig(newFlat)
    updateConfig(next)
      .then((updated) => {
        setConfig(updated)
        setEditingKey(null)
      })
      .catch((e) => alert(e instanceof Error ? e.message : 'Ошибка сохранения'))
      .finally(() => setSaving(false))
  }

  const handleAdd = () => {
    const key = prompt(
      'Ключ (можно вложенный через точку, например theme.color или notifications.email.enabled):'
    )
    if (!key?.trim()) return
    const flatKeys = configToEntries(config).map(([k]) => k)
    if (flatKeys.includes(key)) {
      alert('Такой ключ уже есть')
      return
    }
    setEditingKey(key)
    setEditValue('')
  }

  const handleDelete = (key: string) => {
    if (!confirm(`Удалить параметр "${key}"?`)) return
    setSaving(true)
    const flat = configToEntries(config).filter(
      ([k]) => k !== key && !k.startsWith(key + '.')
    )
    const next = unflattenConfig(flat)
    updateConfig(next)
      .then(setConfig)
      .catch((e) => alert(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setSaving(false))
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Настройки</h1>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return <SectionUnderDevelopment title="Настройки" />
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Настройки компании</h1>
      <p className={styles.sub}>
        Конфиг из n8n (getConfig). Поддержана вложенность до 3 уровней (ключи вида section.sub.key). Редактирование — updateConfig.
      </p>
      <div className={styles.toolbar}>
        <button type="button" onClick={handleAdd} className={styles.addBtn}>
          + Добавить параметр
        </button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ключ</th>
              <th>Значение</th>
              <th className={styles.colAction}></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.empty}>
                  Нет параметров
                </td>
              </tr>
            ) : (
              entries.map(([key, value]) => (
                <tr key={key}>
                  <td className={styles.cellKey}>
                    <span className={key.includes('.') ? styles.nestedKey : undefined}>
                      {key.replace(/\./g, ' › ')}
                    </span>
                  </td>
                  <td
                    className={styles.cellValue}
                    onClick={() => startEdit(key, value)}
                    title="Нажмите для редактирования"
                  >
                    {editingKey === key ? (
                      <textarea
                        className={styles.editArea}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        rows={3}
                      />
                    ) : (
                      valueToString(value)
                    )}
                  </td>
                  <td className={styles.colAction}>
                    {editingKey === key ? (
                      <>
                        <button
                          type="button"
                          className={styles.smallBtn}
                          onClick={handleSaveEdit}
                          disabled={saving}
                        >
                          {saving ? '…' : 'Сохранить'}
                        </button>
                        <button
                          type="button"
                          className={styles.smallBtn}
                          onClick={() => setEditingKey(null)}
                        >
                          Отмена
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.smallBtnDanger}
                        onClick={() => handleDelete(key)}
                        disabled={saving}
                      >
                        Удалить
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editingKey && !entries.some(([k]) => k === editingKey) && (
        <div className={styles.inlineEdit}>
          <span className={styles.inlineKey}>{editingKey}</span>
          <textarea
            className={styles.editArea}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={2}
          />
          <button type="button" className={styles.smallBtn} onClick={handleSaveEdit} disabled={saving}>
            {saving ? '…' : 'Сохранить'}
          </button>
          <button type="button" className={styles.smallBtn} onClick={() => setEditingKey(null)}>
            Отмена
          </button>
        </div>
      )}
    </div>
  )
}
