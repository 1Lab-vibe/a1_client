import { useState, useEffect } from 'react'
import { fetchTasks } from '../api/n8n'
import type { Task } from '../types'
import styles from './Tasks.module.css'

const statusLabels: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  cancelled: 'Отменена',
}

/** Системные ключи, не показываем в кратком описании из params */
const SYSTEM_KEYS = new Set(['id', '_id', 'created_at', 'updated_at', 'task_type', 'domain', 'status', 'step_index', 'userId', 'user_id', 'companyId', 'company_id'])

/** Собирает краткое описание из params без системных названий полей */
function paramsToDescription(params: Task['params']): string {
  if (!params || typeof params !== 'object') return '—'
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (SYSTEM_KEYS.has(key) || value === undefined || value === null || value === '') continue
    const v = typeof value === 'object' ? JSON.stringify(value) : String(value)
    if (v.length > 60) parts.push(`${v.slice(0, 57)}…`)
    else parts.push(v)
  }
  return parts.length ? parts.join(', ') : '—'
}

function formatDate(s: string) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchTasks()
      .then((data) => {
        if (!cancelled) setTasks(data.tasks ?? [])
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Задачи</h1>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Задачи</h1>
        <div className={styles.error}>{error}</div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Задачи</h1>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Тип</th>
              <th>Отдел</th>
              <th>Статус</th>
              <th>Шаг</th>
              <th>Создана</th>
              <th>Описание</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>Нет задач</td>
              </tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.task_type || '—'}</td>
                  <td>{t.domain || '—'}</td>
                  <td>
                    <span className={styles.status} data-status={t.status}>
                      {statusLabels[t.status] ?? t.status}
                    </span>
                  </td>
                  <td>{t.step_index != null ? String(t.step_index) : '—'}</td>
                  <td>{formatDate(t.created_at)}</td>
                  <td className={styles.cellDesc}>{paramsToDescription(t.params)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
