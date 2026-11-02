import { useEffect, useState } from 'react'
import { command, type Job, type ProcurementClient } from './contract'
import { ProcurementError } from './client'

export function useJob(
  client: ProcurementClient,
  company: string,
  id: string | null,
) {
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setJob(null)
    setError(null)
    if (!id) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let pending = false
    let failures = 0
    let stopped = false
    let notBefore = 0
    async function poll() {
      if (pending || stopped || controller.signal.aborted) return
      if (document.hidden || Date.now() < notBefore) {
        timer = setTimeout(poll, Math.max(2000, notBefore - Date.now()))
        return
      }
      pending = true
      try {
        const result = await client.command(
          command(company, 'job.get', { job_id: id! }),
          controller.signal,
        )
        if (controller.signal.aborted) return
        setJob(result)
        setError(null)
        failures = 0
        if (result.status === 'failed') {
          setError(
            new ProcurementError(
              result.error ?? {
                code: 'JOB_FAILED',
                message: 'Задание завершилось ошибкой',
                retryable: false,
              },
            ),
          )
          stopped = true
        } else if (result.status === 'completed') stopped = true
        else
          timer = setTimeout(
            poll,
            Math.min(10000, Math.max(2000, result.poll_after_ms)),
          )
      } catch (e) {
        if (controller.signal.aborted) return
        failures++
        const retryable =
          !(e instanceof ProcurementError) ||
          e.info.retryable ||
          e.status === 429
        setError(e)
        if (retryable && failures <= 3) {
          const delay = Math.max(
            Math.min(30000, 2000 * 2 ** failures),
            e instanceof ProcurementError ? e.retryAfterMs : 0,
          )
          notBefore = Date.now() + delay
          timer = setTimeout(poll, delay)
        } else stopped = true
      } finally {
        pending = false
      }
    }
    const visible = () => {
      if (!document.hidden && !pending && !stopped) {
        clearTimeout(timer)
        void poll()
      }
    }
    document.addEventListener('visibilitychange', visible)
    void poll()
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [client, company, id, attempt])
  return { job, error, retry: () => setAttempt((n) => n + 1) }
}
