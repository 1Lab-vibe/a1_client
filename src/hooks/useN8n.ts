/**
 * Хук для отправки сообщений в n8n и получения ответов.
 * Все запросы идут через общий подписанный requestWebhook (HMAC при наличии VITE_A1_WEBHOOK_SECRET).
 * Поддерживает два режима:
 * 1) Сразу ответ: n8n возвращает { text, attachments }.
 * 2) Отложенный ответ: n8n возвращает { status: "processing", request_id }. Клиент опрашивает
 *    тот же webhook с action "getCOOResponse" и request_id, пока не придёт { status: "ready", text, attachments }.
 */

import { getSession } from '../session'
import { requestWebhook } from '../api/n8n'

export interface N8nResponse {
  text?: string
  attachments?: Array<{ type: 'image' | 'file' | 'chart'; url: string; name?: string }>
}

const POLL_INTERVAL_MS = 1500
const POLL_MAX_ATTEMPTS = 60 // ~90 сек

interface PollResponse {
  ready: boolean
  text?: string
  attachments?: N8nResponse['attachments']
}

async function getCOOResponse(requestId: string): Promise<PollResponse> {
  const session = getSession()
  const body: Record<string, unknown> = {
    action: 'getCOOResponse',
    request_id: requestId,
  }
  if (session) {
    body.company_id = session.company_id
    body.token = session.token
    body.user_id = session.user_id
  }
  const data = await requestWebhook<{
    status?: string
    text?: string
    message?: string
    output?: string
    attachments?: N8nResponse['attachments']
    files?: N8nResponse['attachments']
  }>(body)
  if (data?.status === 'ready') {
    return {
      ready: true,
      text: data.text ?? data.message ?? data.output ?? '',
      attachments: data.attachments ?? data.files ?? undefined,
    }
  }
  return { ready: false }
}

export function useN8n() {
  const sendToN8n = async (message: string): Promise<N8nResponse> => {
    const session = getSession()
    const body: Record<string, unknown> = {
      message,
      timestamp: Date.now(),
    }
    if (session) {
      body.company_id = session.company_id
      body.token = session.token
      body.user_id = session.user_id
    }
    const data = await requestWebhook<{
      status?: string
      request_id?: string
      text?: string
      message?: string
      output?: string
      attachments?: N8nResponse['attachments']
      files?: N8nResponse['attachments']
    }>(body)

    // Ответ сразу
    if (data?.text !== undefined || data?.message !== undefined || data?.output !== undefined) {
      return {
        text: data.text ?? data.message ?? data.output ?? '',
        attachments: data.attachments ?? data.files ?? undefined,
      }
    }

    // Отложенный ответ: опрашиваем по request_id
    if (data?.status === 'processing' && data?.request_id) {
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        const next = await getCOOResponse(data.request_id)
        if (next.ready) {
          return { text: next.text ?? '', attachments: next.attachments }
        }
      }
      return { text: 'Ответ не получен. Попробуйте позже.' }
    }

    return {
      text: data?.text ?? data?.message ?? data?.output ?? '',
      attachments: data?.attachments ?? data?.files ?? undefined,
    }
  }

  return { sendToN8n }
}
