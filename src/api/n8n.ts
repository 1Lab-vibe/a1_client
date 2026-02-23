/**
 * API для работы с n8n. Один webhook URL, маршрутизация по action в теле запроса.
 * В каждый запрос (кроме login и requestDemo) добавляются company_id, token и user_id (email) из сессии.
 */

import { getSession } from '../session'
import type { Task, Client, Lead, LeadStage, Deal, Invoice, ChatChannel, ChatUser, ChatMessage, ChatAttachment, DemoRequest, COOIncomingMessage } from '../types'

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
function isClientRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/** Похож на запись клиента (есть id или name) — чтобы выбрать нужный массив среди нескольких */
function looksLikeClient(x: unknown): boolean {
  if (!isClientRecord(x)) return false
  return 'id' in x || 'name' in x || 'primary_email' in x
}

function filterToClientRecords(arr: unknown[]): unknown[] {
  return arr.filter(isClientRecord)
}

function parseJsonArray(s: string): unknown[] | null {
  try {
    const v = JSON.parse(s) as unknown
    return Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

/** Рекурсивно собирает все массивы из дерева (до 6 уровней). */
function collectAllArrays(value: unknown, depth: number): unknown[][] {
  if (depth <= 0) return []
  if (Array.isArray(value)) return [value]
  const out: unknown[][] = []
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) {
      out.push(...collectAllArrays(v, depth - 1))
    }
  }
  return out
}

/** Выбирает массив с максимальным числом элементов, похожих на клиентов (объект с id/name). */
function pickBestClientsArray(raw: unknown): Client[] {
  if (Array.isArray(raw)) {
    const records = filterToClientRecords(raw)
    if (records.some(looksLikeClient)) return records as Client[]
    return records as Client[]
  }
  if (typeof raw === 'string') {
    const arr = parseJsonArray(raw)
    if (arr) return filterToClientRecords(arr) as Client[]
    return []
  }
  if (!raw || typeof raw !== 'object') return []

  const allArrays = collectAllArrays(raw, 6)
  let best: unknown[] = []
  let bestScore = -1
  for (const arr of allArrays) {
    const records = filterToClientRecords(arr)
    if (records.length === 0) continue
    const score = records.filter(looksLikeClient).length
    if (score > bestScore || (bestScore < 0 && records.length > 0)) {
      bestScore = score
      best = records
    }
  }
  return best as Client[]
}

export async function fetchClients(): Promise<{ clients: Client[] }> {
  const raw = await request<unknown>(buildBody('getClients'))
  const clients = pickBestClientsArray(raw)

  if (import.meta.env.DEV) {
    const preview =
      typeof raw === 'object' && raw !== null
        ? JSON.stringify(raw).slice(0, 500) + (JSON.stringify(raw).length > 500 ? '…' : '')
        : String(raw)
    console.debug('[getClients] ответ:', preview)
    console.debug('[getClients] найдено клиентов:', clients.length, clients)
  }

  return { clients }
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

// ——— Сделки ———
export async function fetchDeals(): Promise<{ deals: Deal[]; stages: { id: string; title: string; order: number }[] }> {
  return request(buildBody('getDeals'))
}

export async function updateDeal(deal: Deal): Promise<{ deal: Deal }> {
  return request(buildBody('updateDeal', deal))
}

// ——— Счета ———
export async function fetchInvoices(): Promise<{ invoices: Invoice[]; stages: { id: string; title: string; order: number }[] }> {
  return request(buildBody('getInvoices'))
}

export async function updateInvoice(invoice: Invoice): Promise<{ invoice: Invoice }> {
  return request(buildBody('updateInvoice', invoice))
}

// ——— Данные по разделу (универсальный webhook для любого блока) ———
export async function getBlockData(viewId: string): Promise<Record<string, unknown>> {
  return request(buildBody('getBlockData', { viewId }))
}

// ——— Дашборд: данные по шаблону ———
export async function getDashboard(template: string = 'default'): Promise<Record<string, unknown>> {
  return request(buildBody('getDashboard', { template }))
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
  text: string,
  attachments?: ChatAttachment[]
): Promise<{ message: ChatMessage }> {
  return request(buildBody('sendChatMessage', { chatId, chatType, text, attachments }))
}

/** Отправка файла в чат (base64). Бэкенд может вернуть message с attachment.url для скачивания. */
export async function sendChatFile(
  chatId: string,
  chatType: 'channel' | 'user',
  file: File
): Promise<{ message: ChatMessage }> {
  const buf = await file.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  return request(buildBody('sendChatFile', {
    chatId,
    chatType,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    contentBase64: base64,
  }))
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

// ——— COO: входящие сообщения от n8n (push). Нормализуем ответ: n8n может вернуть { messages } или [{ messages }]. ———
export async function getCOOIncomingMessages(afterId?: string): Promise<{ messages: COOIncomingMessage[] }> {
  const raw = await request<{ messages?: COOIncomingMessage[] } | Array<{ messages?: COOIncomingMessage[] }>>(
    buildBody('getCOOIncomingMessages', afterId != null ? { after_id: afterId } : undefined)
  )
  if (Array.isArray(raw) && raw.length > 0 && raw[0]?.messages) {
    return { messages: raw[0].messages }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as { messages?: COOIncomingMessage[] }).messages)) {
    return { messages: (raw as { messages: COOIncomingMessage[] }).messages }
  }
  return { messages: [] }
}

// ——— Настройки (конфиг компании) ———
export type CompanyConfig = Record<string, unknown>

export async function getConfig(): Promise<CompanyConfig> {
  const data = await request<{ config?: CompanyConfig } & CompanyConfig>(buildBody('getConfig'))
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if ((data as { config?: CompanyConfig }).config != null) return (data as { config: CompanyConfig }).config
    return data as CompanyConfig
  }
  return {}
}

export async function updateConfig(config: CompanyConfig): Promise<CompanyConfig> {
  const data = await request<{ config?: CompanyConfig } & CompanyConfig>(
    buildBody('updateConfig', config)
  )
  if (data && typeof data === 'object' && (data as { config?: CompanyConfig }).config != null) {
    return (data as { config: CompanyConfig }).config
  }
  return (data as CompanyConfig) || config
}
