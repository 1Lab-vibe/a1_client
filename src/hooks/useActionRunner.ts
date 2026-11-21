/**
 * Хук запуска действий отдела (action handlers) через workflow a1_action_runner.
 * Поддерживает два режима ответа n8n:
 * 1) Сразу: { status: "done", result, text, attachments }.
 * 2) Отложенно: { status: "processing", request_id } — опрашиваем getActionResult,
 *    пока не придёт { status: "done" | "error" }.
 * Действия с requires_human_approval / высоким риском должны запускаться с confirmed: true
 * (UI показывает подтверждение); иначе бэкенд может вернуть { status: "needs_approval" }.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { runAction, getActionResult, type ActionRunInput, type ActionRunResult } from '../api/n8n'

const POLL_INTERVAL_MS = 1500
const POLL_MAX_ATTEMPTS = 60 // ~90 сек

export interface ActionRunnerState {
  /** action_key выполняющегося сейчас действия (null — простаивает) */
  runningKey: string | null
  /** Результат последнего завершённого запуска */
  lastResult: (ActionRunResult & { action_key: string }) | null
  error: string | null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useActionRunner() {
  const [state, setState] = useState<ActionRunnerState>({ runningKey: null, lastResult: null, error: null })
  const inflight = useRef<Set<string>>(new Set())

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const run = useCallback(async (input: ActionRunInput, existingId?: string): Promise<ActionRunResult> => {
    if (inflight.current.has(input.action_key)) {
      return { status: 'processing' }
    }
    inflight.current.add(input.action_key)
    setState((s) => ({ ...s, runningKey: input.action_key, error: null }))

    let requestId = existingId
    try {
      let result: ActionRunResult = existingId ? { status: 'processing', request_id: existingId } : await runAction(input)

      // Отложенное выполнение — опрашиваем результат.
      if (result.status === 'processing' && result.request_id) {
        requestId = result.request_id
        for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
          await delay(POLL_INTERVAL_MS)
          if (!mounted.current) return result
          const next = await getActionResult(requestId, input.action_key)
          if (next.request_id && next.request_id !== requestId) throw new Error('Получен ответ на другой запрос')
          if (next.status !== 'processing') {
            result = next
            break
          }
        }
        if (result.status === 'processing') {
          result = { status: 'processing', request_id: requestId, text: 'Действие ещё выполняется.' }
        }
      }

      if (!mounted.current) return result
      setState({
        runningKey: null,
        lastResult: { ...result, action_key: input.action_key },
        error: result.status === 'error' ? result.error ?? 'Не удалось выполнить действие' : null,
      })
      return result
    } catch (e) {
      const message = (e instanceof Error ? e.message : 'Не удалось выполнить действие').replace(/\s*\[line \d+\]$/i, '')
      const result: ActionRunResult = { status: 'error', error: message, request_id: requestId }
      if (mounted.current) setState({ runningKey: null, lastResult: { ...result, action_key: input.action_key }, error: message })
      return result
    } finally {
      inflight.current.delete(input.action_key)
    }
  }, [])

  const clearResult = useCallback(() => setState((s) => ({ ...s, lastResult: null, error: null })), [])

  return { ...state, run, clearResult }
}
