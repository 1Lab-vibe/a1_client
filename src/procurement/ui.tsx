import { useCallback, useEffect, useRef, useState } from 'react'
import {
  command,
  type Action,
  type Attribute,
  type Issue,
  type Money,
  type Payload,
  type ProcurementClient,
  type Result,
} from './contract'
import { ProcurementError } from './client'
import s from './Procurement.module.css'

export const moneyText = (money: Money | null) =>
  money
    ? `${Number(money.amount).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽`
    : 'Неизвестно'
export const dateText = (date: string | null) =>
  date ? new Date(date).toLocaleString('ru-RU') : 'Дата неизвестна'
export const valueText = (attribute: Attribute) =>
  attribute.status === 'conflicting'
    ? `Противоречие: ${attribute.source_values?.join(' / ') ?? 'уточните'}`
    : attribute.value === null
      ? 'Неизвестно'
      : `${typeof attribute.value === 'boolean' ? (attribute.value ? 'Да' : 'Нет') : attribute.value}${attribute.unit ? ` ${attribute.unit}` : ''}`
export const statusLabels = {
  exact_found: 'Точное совпадение',
  analog_found: 'Предложен аналог',
  needs_review: 'Требует уточнения',
  not_found: 'Не найдено',
  queued: 'В очереди',
  running: 'В работе',
  completed: 'Завершено',
  failed: 'Ошибка',
}
export function Issues({ issues }: { issues: Issue[] }) {
  return (
    <>
      {issues.map((issue, i) => (
        <p className={s.warning} key={`${issue.code}-${i}`}>
          {issue.message}
        </p>
      ))}
    </>
  )
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown
  retry?: () => void
}) {
  if (!error) return null
  return (
    <div className={s.error} role="alert">
      <strong>
        {error instanceof Error ? error.message : 'Не удалось выполнить запрос'}
      </strong>
      {error instanceof ProcurementError &&
        error.info.details?.map((d, i) => (
          <p key={i}>
            {d.reason} ({d.field})
          </p>
        ))}
      {retry && <button onClick={retry}>Повторить запрос</button>}
    </div>
  )
}
export function useQuery<A extends Action>(
  client: ProcurementClient,
  company: string,
  action: A,
  payload: Payload<A>,
  enabled = true,
) {
  const [state, setState] = useState<{
    data: Result<A> | null
    error: unknown
    loading: boolean
  }>({ data: null, error: null, loading: enabled })
  const [revision, reload] = useState(0)
  const serialized = JSON.stringify(payload)
  const latest = useRef(0)
  const dataKey = useRef('')
  useEffect(() => {
    const controller = new AbortController()
    const id = ++latest.current
    if (!enabled) {
      setState({ data: null, error: null, loading: false })
      return () => controller.abort()
    }
    const key = JSON.stringify([company, action, serialized])
    const sameQuery = dataKey.current === key
    dataKey.current = key
    setState(previous => ({ data: sameQuery ? previous.data : null, error: null, loading: true }))
    client
      .command(
        command(company, action, JSON.parse(serialized) as Payload<A>),
        controller.signal,
      )
      .then((data) => {
        if (!controller.signal.aborted && id === latest.current)
          setState({ data, error: null, loading: false })
      })
      .catch((error) => {
        if (!controller.signal.aborted && id === latest.current)
          setState({ data: null, error, loading: false })
      })
    return () => controller.abort()
  }, [client, company, action, serialized, enabled, revision])
  const refresh = useCallback(() => reload((n) => n + 1), [])
  return { ...state, reload: refresh }
}
export function Pager({
  next,
  back,
  onNext,
}: {
  next: string | null
  back?: () => void
  onNext: (cursor: string) => void
}) {
  return (
    <div className={s.toolbar}>
      {back && <button onClick={back}>В начало списка</button>}
      <button disabled={!next} onClick={() => next && onNext(next)}>
        Следующая страница
      </button>
    </div>
  )
}
