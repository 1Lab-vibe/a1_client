/**
 * API для работы с n8n. Один webhook URL, маршрутизация по action в теле запроса.
 * В каждый запрос (кроме login и requestDemo) добавляются company_id, token и user_id (email) из сессии.
 */

import { getSession } from '../session'
import type { Task, Client, Lead, LeadStage, ChatChannel, ChatUser, ChatMessage, DemoRequest, COOIncomingMessage } from '../types'

const getWebhookUrl = (): string => {
  const env = import.meta.env.VITE_N8N_WEBHOOK_URL
  if (env) return env.replace(/\/$/, '')
  return '/api'
}

function buildBody(action: string, payload?: object): object {
  const session = getSession()
  const base: Record<string, unknown> = { action, ...(payload && { payload }) }
  if (session && action !== 'login' && action !== 'requestDemo') {
    base.company_id = session.company_id
    base.token = session.token
    base.user_id = session.user_id
  }
  return base
}

async function request<T = unknown>(body: object): Promise<T> {
  const url = getWebhookUrl()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`n8n: ${res.status}`)
  return res.json().catch(() => ({} as T))
}

// ——— Задачи ———
export async function fetchTasks(): Promise<{ tasks: Task[] }> {
  return request(buildBody('getTasks'))
}

// ——— Клиенты ———
export async function fetchClients(): Promise<{ clients: Client[] }> {
  return request(buildBody('getClients'))
}

export async function updateClient(client: Client): Promise<{ client: Client }> {
  return request(buildBody('updateClient', client))
}

// ——— Лиды ———
export async function fetchLeads(): Promise<{ leads: Lead[]; stages: LeadStage[] }> {
  return request(buildBody('getLeads'))
}

export async function updateLead(lead: Lead): Promise<{ lead: Lead }> {
  return request(buildBody('updateLead', lead))
}

// ——— Чат ———
export async function fetchChatData(): Promise<{ channels: ChatChannel[]; users: ChatUser[] }> {
  return request(buildBody('getChatData'))
}

export async function fetchChatMessages(chatId: string, chatType: 'channel' | 'user'): Promise<{
  messages: ChatMessage[]
}> {
  return request(buildBody('getChatMessages', { chatId, chatType }))
}

export async function sendChatMessage(
  chatId: string,
  chatType: 'channel' | 'user',
  text: string
): Promise<{ message: ChatMessage }> {
  return request(buildBody('sendChatMessage', { chatId, chatType, text }))
}

// ——— Авторизация (company_id и token не добавляются) ———
export async function login(
  email: string,
  password: string
): Promise<{ access: boolean; token?: string; company_id?: string }> {
  return request({ action: 'login', payload: { email, password } })
}

export async function requestDemo(data: DemoRequest): Promise<{ access: 'access' | 'deny'; message?: string }> {
  const res = await request<{ access?: 'access' | 'deny'; result?: 'access' | 'deny'; message?: string }>(
    buildBody('requestDemo', data)
  )
  const access = res.access ?? res.result ?? 'deny'
  return { access, message: res.message }
}

// ——— COO: входящие сообщения от n8n (push) ———
export async function getCOOIncomingMessages(afterId?: string): Promise<{ messages: COOIncomingMessage[] }> {
  return request(buildBody('getCOOIncomingMessages', afterId != null ? { after_id: afterId } : undefined))
}
