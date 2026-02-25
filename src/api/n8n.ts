/**
 * API для работы с n8n. Один webhook URL, маршрутизация по action в теле запроса.
 * В каждый запрос (кроме login и requestDemo) добавляются company_id, token и user_id из сессии.
 * При наличии VITE_A1_WEBHOOK_SECRET запросы и ответы подписываются HMAC (body_b64 + заголовки timestamp, nonce, signature).
 */

import { getSession } from '../session'
import { signPayload, verifySignedResponse } from '../utils/webhookSignature'
import type { Task, Client, Lead, LeadStage, LeadEvent, Deal, Invoice, ChatChannel, ChatUser, ChatMessage, ChatAttachment, DemoRequest, COOIncomingMessage } from '../types'

/** Runtime-конфиг из /config.js (в Docker подставляется при старте контейнера из env) */
function getRuntimeConfig(): { VITE_A1_WEBHOOK_SECRET?: string; VITE_N8N_WEBHOOK_URL?: string } | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { __A1_CONFIG__?: { VITE_A1_WEBHOOK_SECRET?: string; VITE_N8N_WEBHOOK_URL?: string } }
  return w.__A1_CONFIG__
}

function getWebhookSecret(): string {
  const cfg = getRuntimeConfig()
  const fromConfig = cfg?.VITE_A1_WEBHOOK_SECRET
  if (typeof fromConfig === 'string' && fromConfig.trim()) return fromConfig.trim()
  const env = import.meta.env.VITE_A1_WEBHOOK_SECRET
  return typeof env === 'string' ? env.trim() : ''
}

const getWebhookUrl = (): string => {
  const cfg = getRuntimeConfig()
  const fromConfig = cfg?.VITE_N8N_WEBHOOK_URL
  if (typeof fromConfig === 'string' && fromConfig.trim()) return fromConfig.trim().replace(/\/$/, '')
  const env = import.meta.env.VITE_N8N_WEBHOOK_URL
  if (env) return (env as string).replace(/\/$/, '')
  return '/api'
}

function buildBody(action: string, payload?: object): object {
  const session = getSession()
  const base: Record<string, unknown> = { action, ...(payload && { payload }) }
  if (session && action !== 'login' && action !== 'requestDemo' && action !== 'reportFailedLogin') {
    base.company_id = session.company_id
    base.token = session.token
    base.user_id = session.user_id
  }
  return base
}

async function request<T = unknown>(body: object): Promise<T> {
  const url = getWebhookUrl()
  const secret = getWebhookSecret()

  let reqBody: string
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (secret) {
    const { body_b64, timestamp, nonce, signature } = await signPayload(secret, body)
    reqBody = JSON.stringify({ body_b64 })
    headers['X-Timestamp'] = String(timestamp)
    headers['X-Nonce'] = nonce
    headers['X-Signature'] = signature
  } else {
    reqBody = JSON.stringify(body)
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: reqBody,
  })
  if (!res.ok) throw new Error('Ошибка связи с сервером')

  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    return {} as T
  }

  if (secret && data && typeof data === 'object' && 'body_b64' in data && typeof (data as { body_b64?: string }).body_b64 === 'string') {
    const body_b64 = (data as { body_b64: string }).body_b64
    const ts = res.headers.get('X-Timestamp') ?? res.headers.get('x-timestamp') ?? ''
    const nonce = res.headers.get('X-Nonce') ?? res.headers.get('x-nonce') ?? ''
    const sig = res.headers.get('X-Signature') ?? res.headers.get('x-signature') ?? ''
    const verified = await verifySignedResponse(secret, body_b64, ts, nonce, sig)
    if (verified != null) return verified as T
  }

  return data as T
}

/** Общий подписанный запрос к webhook (то же шифрование, что и для login и остальных action). Используется в т.ч. useN8n для отправки text. */
export async function requestWebhook<T = unknown>(body: object): Promise<T> {
  return request<T>(body)
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
const DEFAULT_LEAD_STAGES: LeadStage[] = [
  { id: 'new', title: 'Новый', order: 0 },
  { id: 'in_work', title: 'В работе', order: 1 },
  { id: 'offer', title: 'Предложение', order: 2 },
  { id: 'follow_up', title: 'Доработка', order: 3 },
  { id: 'won', title: 'Успех', order: 4 },
  { id: 'lost', title: 'Отказ', order: 5 },
]

function mergeLeadStages(apiStages: LeadStage[]): LeadStage[] {
  const byId = new Map<string, LeadStage>(DEFAULT_LEAD_STAGES.map((s) => [s.id, s]))
  for (const s of apiStages) {
    if (!byId.has(s.id)) byId.set(s.id, { id: s.id, title: s.title, order: byId.size })
  }
  return Array.from(byId.values()).sort((a, b) => a.order - b.order)
}

function isLeadStageLike(x: unknown): x is LeadStage {
  return isClientRecord(x) && typeof (x as LeadStage).id === 'string' && typeof (x as LeadStage).title === 'string'
}

function extractLeadEvents(raw: unknown): LeadEvent[] {
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && 'events' in (raw as object) ? (raw as { events: unknown }).events : raw && typeof raw === 'object' && 'evants' in (raw as object) ? (raw as { evants: unknown }).evants : null
  if (!Array.isArray(arr)) return []
  const list: LeadEvent[] = arr.map((e) => {
    if (!e || typeof e !== 'object') return null
    const o = e as Record<string, unknown>
    const ts = o.timestamp != null ? Number(o.timestamp) : o.createdAt ? new Date(String(o.createdAt)).getTime() : o.created_at ? new Date(String(o.created_at)).getTime() : 0
    return {
      id: o.id != null ? String(o.id) : undefined,
      type: o.type != null ? String(o.type) : undefined,
      message: o.message != null ? String(o.message) : o.text != null ? String(o.text) : undefined,
      createdAt: o.createdAt != null ? String(o.createdAt) : undefined,
      timestamp: ts || undefined,
    }
  }).filter((x): x is LeadEvent => x !== null)
  list.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
  return list
}

function extractLeadsArray(raw: unknown): Lead[] {
  const mapOne = (x: unknown): Lead | null => {
    if (!isClientRecord(x)) return null
    const o = { ...(x as Record<string, unknown>) }
    const id = o.id
    if (id == null) return null
    const title = o.title ?? o.company_name ?? o.contact_name ?? o.contact_email ?? 'Без названия'
    const stageId = o.stageId != null ? String(o.stageId) : o.stage_id != null ? String(o.stage_id) : o.stage != null ? String(o.stage) : 'new'
    const events = extractLeadEvents(o)
    const history = Array.isArray(o.history) ? extractLeadEvents(o.history) : []
    const allEvents = events.length > 0 ? events : history.length > 0 ? history : undefined
    delete o.events
    delete o.history
    const lead: Lead = {
      ...o,
      id: String(id),
      stageId,
      title: String(title),
      events: allEvents,
    }
    return lead
  }
  if (raw && typeof raw === 'object' && 'leads' in raw) return extractLeadsArray((raw as { leads: unknown }).leads)
  if (raw && typeof raw === 'object' && 'items' in raw) return extractLeadsArray((raw as { items: unknown }).items)
  if (raw && typeof raw === 'object' && 'data' in raw) return extractLeadsArray((raw as { data: unknown }).data)
  if (raw && typeof raw === 'object' && 'body' in raw) return extractLeadsArray((raw as { body: unknown }).body)
  if (Array.isArray(raw)) {
    const list = raw.map(mapOne).filter((l): l is Lead => l !== null)
    if (list.length > 0) return list
  }
  return []
}

function extractStagesArray(raw: unknown): LeadStage[] {
  if (Array.isArray(raw)) {
    const list = raw.filter(isLeadStageLike)
    if (list.length > 0) return list as LeadStage[]
  }
  if (raw && typeof raw === 'object' && 'stages' in raw) return extractStagesArray((raw as { stages: unknown }).stages)
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const data = (raw as { data: Record<string, unknown> }).data
    if (data && typeof data === 'object' && 'stages' in data) return extractStagesArray(data.stages)
  }
  if (raw && typeof raw === 'object' && 'body' in raw) return extractStagesArray((raw as { body: unknown }).body)
  return []
}

export async function fetchLeads(): Promise<{ leads: Lead[]; stages: LeadStage[] }> {
  const raw = await request<unknown>(buildBody('getLeads'))
  let leads = extractLeadsArray(raw)
  let stages = extractStagesArray(raw)
  if (leads.length === 0 && Array.isArray(raw) && raw.length > 0) {
    const first = raw[0]
    if (first && typeof first === 'object') {
      leads = extractLeadsArray(first)
      if (stages.length === 0) stages = extractStagesArray(first)
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'leads' in (raw as object)) {
    const obj = raw as Record<string, unknown>
    if (leads.length === 0 && Array.isArray(obj.leads)) leads = extractLeadsArray(obj.leads)
    if (stages.length === 0 && Array.isArray(obj.stages)) stages = extractStagesArray(obj.stages)
  }
  const leadStageIds = new Set(leads.map((l) => l.stageId))
  const stageIds = new Set(stages.map((s) => s.id))
  for (const sid of leadStageIds) {
    if (!stageIds.has(sid)) {
      stages.push({ id: sid, title: stageIdToTitle(sid), order: stages.length })
      stageIds.add(sid)
    }
  }
  stages = mergeLeadStages(stages)
  if (import.meta.env.DEV) {
    console.debug('[getLeads] raw keys:', raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.keys(raw as object) : Array.isArray(raw) ? 'array' : typeof raw)
    console.debug('[getLeads] extracted leads:', leads.length, 'stages:', stages.length)
  }
  return { leads, stages }
}

function stageIdToTitle(id: string): string {
  const map: Record<string, string> = {
    in_work: 'В работе',
    open: 'Открыт',
    closed: 'Закрыт',
    new: 'Новый',
    offer: 'Предложение',
    follow_up: 'Доработка',
    won: 'Успех',
    lost: 'Отказ',
  }
  return map[id] ?? id.replace(/_/g, ' ')
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
export interface LoginResponse {
  access: boolean
  token?: string
  company_id?: string
  /** Блокировка по IP после превышения лимита неудачных попыток */
  blocked?: boolean
  blockedUntil?: number
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  return request({ action: 'login', payload: { email, password } })
}

/** Данные клиента при неудачном входе (для вебхука block и учёта по IP на бэкенде). Пароль не передаётся. */
export interface FailedLoginClientData {
  email: string
  userAgent: string
  language: string
  screenWidth: number
  screenHeight: number
  timezoneOffset: number
  timestamp: number
}

export interface ReportFailedLoginResponse {
  blocked: boolean
  blockedUntil?: number
}

/** Сообщить бэкенду о неудачной попытке входа. Бэкенд считает попытки по IP, при достижении лимита блокирует и шлёт вебхук block. */
export async function reportFailedLogin(
  email: string,
  clientData: Omit<FailedLoginClientData, 'email' | 'timestamp'>
): Promise<ReportFailedLoginResponse> {
  const payload: FailedLoginClientData = {
    email,
    timestamp: Date.now(),
    ...clientData,
  }
  const res = await request<ReportFailedLoginResponse>({
    action: 'reportFailedLogin',
    payload,
  })
  return {
    blocked: !!res?.blocked,
    blockedUntil: res?.blockedUntil,
  }
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
