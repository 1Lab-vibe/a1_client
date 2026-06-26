/**
 * Хук запуска действий отдела (action handlers) через workflow a1_action_runner.
 * Поддерживает два режима ответа n8n:
 * 1) Сразу: { status: "done", result, text, attachments }.
 * 2) Отложенно: { status: "processing", request_id } — опрашиваем getActionResult,
 *    пока не придёт { status: "done" | "error" }.
 * Действия с requires_human_approval / высоким риском должны запускаться с confirmed: true
 * (UI показывает подтверждение); иначе бэкенд может вернуть { status: "needs_approval" }.
 */

import { useCallback, useRef, useState } from 'react'
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

  const run = useCallback(async (input: ActionRunInput): Promise<ActionRunResult> => {
    if (inflight.current.has(input.action_key)) {
      return { status: 'processing' }
    }
    inflight.current.add(input.action_key)
    setState((s) => ({ ...s, runningKey: input.action_key, error: null }))

    try {
      let result = await runAction(input)

      // Отложенное выполнение — опрашиваем результат.
      if (result.status === 'processing' && result.request_id) {
        for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
          await delay(POLL_INTERVAL_MS)
          const next = await getActionResult(result.request_id)
          if (next.status !== 'processing') {
            result = next
            break
          }
        }
        if (result.status === 'processing') {
          result = { status: 'error', error: 'Действие выполняется дольше обычного. Проверьте результат позже.' }
        }
      }

      setState({
        runningKey: null,
        lastResult: { ...result, action_key: input.action_key },
        error: result.status === 'error' ? result.error ?? 'Не удалось выполнить действие' : null,
      })
      return result
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось выполнить действие'
      setState({ runningKey: null, lastResult: { status: 'error', error: message, action_key: input.action_key }, error: message })
      return { status: 'error', error: message }
    } finally {
      inflight.current.delete(input.action_key)
    }
  }, [])

  const clearResult = useCallback(() => setState((s) => ({ ...s, lastResult: null, error: null })), [])

  return { ...state, run, clearResult }
}
