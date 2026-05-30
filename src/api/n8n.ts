/**
 * API для работы с n8n. Один webhook URL, маршрутизация по action в теле запроса.
 * В каждый запрос (кроме login, requestDemo, requestPasswordReset) добавляются company_id, token и user_id из сессии.
 * При наличии VITE_A1_WEBHOOK_SECRET запросы и ответы подписываются HMAC (body_b64 + заголовки timestamp, nonce, signature).
 */

import { getSession } from '../session'
import { signPayload, verifySignedResponse, base64ToStr } from '../utils/webhookSignature'
import type { Task, Client, Lead, LeadStage, LeadEvent, Deal, Invoice, ChatChannel, ChatUser, ChatMessage, ChatAttachment, DemoRequest, COOIncomingMessage, AuthCompany, N8nAttachment } from '../types'

/** Runtime-конфиг: из window.__A1_CONFIG__ (config.js) или подгружен по fetch из /config.json */
function getRuntimeConfig(): { VITE_A1_WEBHOOK_SECRET?: string; VITE_N8N_WEBHOOK_URL?: string } | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { __A1_CONFIG__?: { VITE_A1_WEBHOOK_SECRET?: string; VITE_N8N_WEBHOOK_URL?: string } }
  return w.__A1_CONFIG__
}

let configFetchPromise: Promise<void> | null = null

/** Один раз подгружаем /config.json (Docker), декодируем base64 и пишем в __A1_CONFIG__. Обход кэша и порядка скриптов. */
async function ensureConfigLoaded(): Promise<void> {
  if (typeof window === 'undefined') return
  const w = window as unknown as { __A1_CONFIG__?: { VITE_A1_WEBHOOK_SECRET?: string; VITE_N8N_WEBHOOK_URL?: string } }
  if (w.__A1_CONFIG__?.VITE_A1_WEBHOOK_SECRET || w.__A1_CONFIG__?.VITE_N8N_WEBHOOK_URL) return
  if (configFetchPromise) return configFetchPromise
  configFetchPromise = (async () => {
    try {
      const r = await fetch(`${window.location.origin}/config.json`, { cache: 'no-store' })
      if (!r.ok) return
      const data = (await r.json()) as { VITE_A1_WEBHOOK_SECRET_B64?: string; VITE_N8N_WEBHOOK_URL_B64?: string; VITE_A1_WEBHOOK_SECRET?: string; VITE_N8N_WEBHOOK_URL?: string }
      let secret = data.VITE_A1_WEBHOOK_SECRET
      let url = data.VITE_N8N_WEBHOOK_URL
      if (data.VITE_A1_WEBHOOK_SECRET_B64) {
        try {
          secret = atob(data.VITE_A1_WEBHOOK_SECRET_B64)
        } catch {
          secret = ''
        }
      }
      if (data.VITE_N8N_WEBHOOK_URL_B64) {
        try {
          url = atob(data.VITE_N8N_WEBHOOK_URL_B64)
        } catch {
          url = ''
        }
      }
      w.__A1_CONFIG__ = { ...w.__A1_CONFIG__, VITE_A1_WEBHOOK_SECRET: secret ?? '', VITE_N8N_WEBHOOK_URL: url ?? '' }
      setSigningDiagnostics()
    } catch {
      // ignore
    }
  })()
  return configFetchPromise
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

/** Диагностика HMAC: в консоли браузера введите __A1_DEBUG — покажет, включена ли подпись и откуда конфиг */
function setSigningDiagnostics(): void {
  if (typeof window === 'undefined') return
  const cfg = getRuntimeConfig()
  const secret = getWebhookSecret()
  const url = getWebhookUrl()
  ;(window as unknown as { __A1_DEBUG?: Record<string, unknown> }).__A1_DEBUG = {
    signing: secret.length > 0,
    configSource: cfg ? (cfg.VITE_A1_WEBHOOK_SECRET ? 'runtime (config.js or config.json)' : 'runtime (secret empty)') : (import.meta.env.VITE_A1_WEBHOOK_SECRET ? 'build (env)' : 'none'),
    webhookUrl: url ? `${url.slice(0, 30)}${url.length > 30 ? '…' : ''}` : '(default /api)',
  }
}
setSigningDiagnostics()

// Сразу начинаем подгрузку config.json (к моменту первого запроса конфиг уже будет)
if (typeof window !== 'undefined') void ensureConfigLoaded()

function buildBody(action: string, payload?: object): object {
  const session = getSession()
  const base: Record<string, unknown> = { action, ...(payload && { payload }) }
  if (session && action !== 'login' && action !== 'requestDemo' && action !== 'requestPasswordReset' && action !== 'reportFailedLogin') {
    base.company_id = session.company_id
    base.token = session.token
    base.user_id = session.user_id
  }
  return base
}

async function request<T = unknown>(body: object): Promise<T> {
  await ensureConfigLoaded()
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

  const signedHeaders = secret ? { ...headers } : headers
  const signedRes = await fetch(url, {
    method: 'POST',
    headers: signedHeaders,
    body: reqBody,
  })

  const res = signedRes
  if (!res.ok) {
    // Попробуем добавить хвост ответа, чтобы понять причину 4xx/5xx в консоли
    let extra = ''
    try {
      extra = (await res.text())?.slice(0, 300) ?? ''
    } catch {
      // ignore
    }
    throw new Error(`Ошибка связи с сервером (${res.status}). ${extra}`)
  }

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
    // Fallback: если верификация не прошла (например, сервер не прислал сигнатурные заголовки),
    // всё равно попробуем расшифровать body_b64 и вернуть данные.
    try {
      const jsonStr = base64ToStr(body_b64)
      return JSON.parse(jsonStr) as T
    } catch {
      // ignore; дальше вернём как есть
    }
  }

  return data as T
}

/** Общий подписанный запрос к webhook (то же шифрование, что и для login и остальных action). Используется в т.ч. useN8n для отправки text. */
export async function requestWebhook<T = unknown>(body: object): Promise<T> {
  return request<T>(body)
}

// ——— Задачи ———
export async function fetchTasks(): Promise<{ tasks: Task[] }> {
  const raw = await request<ApiEnvelope<{ tasks?: Task[] } | Task[]>>(buildBody('getTasks'))
  const data = unwrapData(raw)
  if (Array.isArray(data)) return { tasks: data.filter(isObjectRecord).map((row) => toTask(row as unknown as Record<string, unknown>)) }
  if (data && typeof data === 'object' && Array.isArray((data as { tasks?: unknown }).tasks)) {
    return { tasks: ((data as { tasks: unknown[] }).tasks).filter(isObjectRecord).map(toTask) }
  }
  return { tasks: extractRecords(data, ['tasks', 'items', 'rows', 'data']).map(toTask) }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function extractRecords(value: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isObjectRecord)
  if (!isObjectRecord(value)) return []
  for (const key of keys) {
    const nested = extractRecords(value[key], [])
    if (nested.length > 0) return nested
  }
  for (const nested of Object.values(value)) {
    const rows = extractRecords(nested, [])
    if (rows.length > 0) return rows
  }
  return []
}

function extractStages(value: unknown): { id: string; title: string; order: number }[] {
  const rows = extractRecords(value, ['stages', 'pipeline', 'columns'])
  return rows
    .map((row, index) => {
      const id = row.id ?? row.stageId ?? row.stage_id ?? row.code
      const title = row.title ?? row.name ?? row.label ?? id
      if (id == null) return null
      return {
        id: String(id),
        title: String(title),
        order: Number.isFinite(Number(row.order)) ? Number(row.order) : index,
      }
    })
    .filter((stage): stage is { id: string; title: string; order: number } => stage !== null)
}

function toTask(row: Record<string, unknown>): Task {
  return {
    ...row,
    id: String(row.id ?? row._id ?? crypto.randomUUID()),
    task_type: String(row.task_type ?? row.type ?? row.title ?? ''),
    domain: String(row.domain ?? row.department ?? ''),
    status: String(row.status ?? 'new'),
    step_index: row.step_index != null ? row.step_index as string | number : '',
    created_at: String(row.created_at ?? row.createdAt ?? ''),
    params: isObjectRecord(row.params) ? row.params : row,
  }
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
  const raw = await request<ApiEnvelope<{ client?: Client } & Client>>(buildBody('updateClient', client))
  const data = unwrapData(raw)
  if (isObjectRecord(data) && isObjectRecord(data.client)) return { client: data.client as Client }
  return { client: (isObjectRecord(data) ? data : client) as Client }
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
  if (!isClientRecord(x)) return false
  const r = x as Record<string, unknown>
  return typeof r.id === 'string' && typeof r.title === 'string'
}

function extractLeadEvents(raw: unknown): LeadEvent[] {
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && 'events' in (raw as object) ? (raw as { events: unknown }).events : raw && typeof raw === 'object' && 'evants' in (raw as object) ? (raw as { evants: unknown }).evants : null
  if (!Array.isArray(arr)) return []
  const mapped = arr.map((e): LeadEvent | null => {
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
  })
  const list = mapped.filter((x): x is LeadEvent => x !== null)
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
  const raw = await request<ApiEnvelope<{ lead?: Lead } & Lead>>(buildBody('updateLead', lead))
  const data = unwrapData(raw)
  if (isObjectRecord(data) && isObjectRecord(data.lead)) return { lead: data.lead as Lead }
  return { lead: (isObjectRecord(data) ? data : lead) as Lead }
}

// ——— Сделки ———
export async function fetchDeals(): Promise<{ deals: Deal[]; stages: { id: string; title: string; order: number }[] }> {
  const raw = await request<ApiEnvelope<{ deals?: Deal[]; stages?: { id: string; title: string; order: number }[] } | Deal[]>>(buildBody('getDeals'))
  const data = unwrapData(raw)
  const deals = (isObjectRecord(data) && Array.isArray(data.deals)
    ? data.deals.filter(isObjectRecord)
    : extractRecords(data, ['deals', 'items', 'rows', 'data'])) as Deal[]
  const stages = extractStages(data)
  return { deals, stages }
}

export async function updateDeal(deal: Deal): Promise<{ deal: Deal }> {
  const raw = await request<ApiEnvelope<{ deal?: Deal } & Deal>>(buildBody('updateDeal', deal))
  const data = unwrapData(raw)
  if (isObjectRecord(data) && isObjectRecord(data.deal)) return { deal: data.deal as Deal }
  return { deal: (isObjectRecord(data) ? data : deal) as Deal }
}

// ——— Счета ———
export async function fetchInvoices(): Promise<{ invoices: Invoice[]; stages: { id: string; title: string; order: number }[] }> {
  const raw = await request<ApiEnvelope<{ invoices?: Invoice[]; stages?: { id: string; title: string; order: number }[] } | Invoice[]>>(buildBody('getInvoices'))
  const data = unwrapData(raw)
  const invoices = (isObjectRecord(data) && Array.isArray(data.invoices)
    ? data.invoices.filter(isObjectRecord)
    : extractRecords(data, ['invoices', 'items', 'rows', 'data'])) as Invoice[]
  const stages = extractStages(data)
  return { invoices, stages }
}

export async function updateInvoice(invoice: Invoice): Promise<{ invoice: Invoice }> {
  const raw = await request<ApiEnvelope<{ invoice?: Invoice } & Invoice>>(buildBody('updateInvoice', invoice))
  const data = unwrapData(raw)
  if (isObjectRecord(data) && isObjectRecord(data.invoice)) return { invoice: data.invoice as Invoice }
  return { invoice: (isObjectRecord(data) ? data : invoice) as Invoice }
}

// ——— Данные по разделу (универсальный webhook для любого блока) ———
export async function getBlockData(viewId: string): Promise<Record<string, unknown>> {
  const session = getSession()
  const body: Record<string, unknown> = {
    action: 'getBlockData',
    viewId,
    view_id: viewId,
    payload: { viewId, view_id: viewId },
  }
  if (session) {
    body.company_id = session.company_id
    body.token = session.token
    body.user_id = session.user_id
  }
  const raw = await request<ApiEnvelope<Record<string, unknown>>>(body)
  return unwrapData(raw) || {}
}

// ——— Дашборд: данные по шаблону ———
export type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'quarter' | 'custom'

export interface PeriodFilter {
  preset: PeriodPreset
  from?: string
  to?: string
}

type ApiEnvelope<T> = T | { ok?: boolean; data?: T; error?: string; meta?: Record<string, unknown> }

function unwrapData<T>(data: ApiEnvelope<T>): T {
  if (data && typeof data === 'object' && !Array.isArray(data) && 'data' in data) {
    return (data as { data?: T }).data as T
  }
  return data as T
}

export async function getDashboard(template: string = 'default', period?: PeriodFilter): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('getDashboard', { template, period }))
  return unwrapData(data) || {}
}

export async function getUiBootstrap(): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('getUiBootstrap'))
  return unwrapData(data) || {}
}

export async function getReport(reportId: string, period?: PeriodFilter, filters?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('getReport', { report_id: reportId, period, filters }))
  return unwrapData(data) || {}
}

export async function getSettingsSchema(): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('getSettingsSchema'))
  return unwrapData(data) || {}
}

export async function getSettings(): Promise<CompanyConfig> {
  const data = await request<ApiEnvelope<{ config?: CompanyConfig } & CompanyConfig>>(buildBody('getSettings'))
  const unwrapped = unwrapData(data)
  if (unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped) && (unwrapped as { config?: CompanyConfig }).config != null) {
    return (unwrapped as { config: CompanyConfig }).config
  }
  return (unwrapped as CompanyConfig) || {}
}

export async function updateSettingsSection(section: string, patch: Record<string, unknown>): Promise<CompanyConfig> {
  const data = await request<ApiEnvelope<{ config?: CompanyConfig } & CompanyConfig>>(buildBody('updateSettingsSection', { section, patch }))
  const unwrapped = unwrapData(data)
  if (unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped) && (unwrapped as { config?: CompanyConfig }).config != null) {
    return (unwrapped as { config: CompanyConfig }).config
  }
  return (unwrapped as CompanyConfig) || {}
}

export async function getOnboardingState(): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('getOnboardingState'))
  return unwrapData(data) || {}
}

export async function saveOnboardingStep(stepId: string, values: Record<string, unknown>): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('saveOnboardingStep', { step_id: stepId, values }))
  return unwrapData(data) || {}
}

export async function completeOnboarding(): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('completeOnboarding'))
  return unwrapData(data) || {}
}

export async function getIntegrations(): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('getIntegrations'))
  return unwrapData(data) || {}
}

export async function startIntegrationConnect(provider: string): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('startIntegrationConnect', { provider }))
  return unwrapData(data) || {}
}

export async function testIntegration(provider: string): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('testIntegration', { provider }))
  return unwrapData(data) || {}
}

export async function getUsersAndPermissions(): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('getUsersAndPermissions'))
  return unwrapData(data) || {}
}

export async function updateUserRole(userId: string, role: string, companyId?: string): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('updateUserRole', { user_id: userId, role, company_id: companyId }))
  return unwrapData(data) || {}
}

export async function inviteUser(email: string, role: string, fullName?: string): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('inviteUser', { email, role, full_name: fullName }))
  return unwrapData(data) || {}
}

export async function updateUserStatus(userId: string, isActive: boolean, companyId?: string): Promise<Record<string, unknown>> {
  const data = await request<ApiEnvelope<Record<string, unknown>>>(buildBody('updateUserStatus', { user_id: userId, is_active: isActive, company_id: companyId }))
  return unwrapData(data) || {}
}

// ——— Чат ———
export async function fetchChatData(): Promise<{ channels: ChatChannel[]; users: ChatUser[] }> {
  const raw = await request<ApiEnvelope<{ channels?: ChatChannel[]; users?: ChatUser[] }>>(buildBody('getChatData'))
  const data = unwrapData(raw)
  return {
    channels: Array.isArray(data?.channels) ? data.channels : [],
    users: Array.isArray(data?.users) ? data.users : [],
  }
}

export async function fetchChatMessages(chatId: string, chatType: 'channel' | 'user'): Promise<{
  messages: ChatMessage[]
}> {
  const raw = await request<ApiEnvelope<{ messages?: ChatMessage[] }>>(buildBody('getChatMessages', { chatId, chatType }))
  const data = unwrapData(raw)
  return { messages: Array.isArray(data?.messages) ? data.messages : [] }
}

export async function sendChatMessage(
  chatId: string,
  chatType: 'channel' | 'user',
  text: string,
  attachments?: ChatAttachment[]
): Promise<{ message: ChatMessage }> {
  const raw = await request<ApiEnvelope<{ message?: ChatMessage }>>(buildBody('sendChatMessage', { chatId, chatType, text, attachments }))
  const data = unwrapData(raw)
  if (!data?.message) throw new Error('Не удалось отправить сообщение')
  return { message: data.message }
}

/** Отправка файла в чат (base64). Бэкенд может вернуть message с attachment.url для скачивания. */
export async function sendChatFile(
  chatId: string,
  chatType: 'channel' | 'user',
  file: File
): Promise<{ message: ChatMessage }> {
  const buf = await file.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  const raw = await request<ApiEnvelope<{ message?: ChatMessage }>>(buildBody('sendChatFile', {
    chatId,
    chatType,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    contentBase64: base64,
  }))
  const data = unwrapData(raw)
  if (!data?.message) throw new Error('Не удалось отправить файл')
  return { message: data.message }
}

// ——— Авторизация (company_id и token не добавляются) ———
export interface LoginResponse {
  access: boolean
  token?: string
  company_id?: string
  companies?: AuthCompany[]
  /** Блокировка по IP после превышения лимита неудачных попыток */
  blocked?: boolean
  blockedUntil?: number
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const raw = await request<unknown>({ action: 'login', payload: { email, password } })

  // n8n иногда возвращает login как массив [{ access, token, ... }] или объект { access, token, ... }.
  // Клиент ожидает LoginResponse: { access: boolean, token?, company_id?, blocked?, blockedUntil? }.
  const first = Array.isArray(raw) ? raw[0] : raw
  if (!first || typeof first !== 'object') {
    return { access: false }
  }

  const obj = first as Record<string, unknown>
  const wf3 = (obj as { _wf3?: { access?: Record<string, unknown> } })._wf3?.access

  const accessVal = obj.access ?? wf3?.access ?? wf3?.allowed
  const access = Boolean(accessVal)

  const token = typeof obj.token === 'string' ? obj.token : undefined
  const company_id =
    typeof obj.company_id === 'string'
      ? obj.company_id
      : typeof wf3?.company_id === 'string'
        ? wf3.company_id
        : typeof wf3?.user_id === 'string'
          ? wf3.user_id
          : undefined

  const blocked = obj.blocked != null ? Boolean(obj.blocked) : undefined
  const blockedUntilRaw = obj.blockedUntil ?? obj.blocked_until ?? (wf3?.blockedUntil as unknown)
  const blockedUntil = typeof blockedUntilRaw === 'number' ? blockedUntilRaw : undefined
  const companiesRaw = Array.isArray(obj.companies)
    ? obj.companies
    : Array.isArray(wf3?.companies)
      ? wf3.companies
      : []
  const companies = companiesRaw
    .map((company): AuthCompany | null => {
      if (!company || typeof company !== 'object') return null
      const c = company as Record<string, unknown>
      const id = typeof c.company_id === 'string' ? c.company_id : typeof c.id === 'string' ? c.id : ''
      if (!id) return null
      return {
        company_id: id,
        name: typeof c.name === 'string' && c.name.trim() ? c.name : `Компания ${id.slice(0, 8)}`,
        role: typeof c.role === 'string' ? c.role : undefined,
        token: typeof c.token === 'string' ? c.token : undefined,
        is_default: c.is_default != null ? Boolean(c.is_default) : undefined,
      }
    })
    .filter((company): company is AuthCompany => company !== null)

  return { access, token, company_id, companies, blocked, blockedUntil }
}

/** Данные клиента при неудачном входе (для вебхука block и учёта по IP на бэкенде). Пароль не передаётся. */
export async function getAuthCompanies(): Promise<{ companies: AuthCompany[] }> {
  const res = await request<{ companies?: unknown[] }>(buildBody('getAuthCompanies'))
  const companies = Array.isArray(res.companies)
    ? res.companies
        .map((company): AuthCompany | null => {
          if (!company || typeof company !== 'object') return null
          const c = company as Record<string, unknown>
          const company_id = typeof c.company_id === 'string' ? c.company_id : typeof c.id === 'string' ? c.id : ''
          if (!company_id) return null
          return {
            company_id,
            name: typeof c.name === 'string' && c.name.trim() ? c.name : `Компания ${company_id.slice(0, 8)}`,
            role: typeof c.role === 'string' ? c.role : undefined,
            token: typeof c.token === 'string' ? c.token : undefined,
            is_default: c.is_default != null ? Boolean(c.is_default) : undefined,
          }
        })
        .filter((company): company is AuthCompany => company !== null)
    : []
  return { companies }
}

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

export async function requestPasswordReset(email: string): Promise<{ sent: boolean; message?: string }> {
  const res = await request<{ sent?: boolean; ok?: boolean; message?: string }>({
    action: 'requestPasswordReset',
    payload: { email },
  })
  return {
    sent: res.sent ?? res.ok ?? true,
    message: res.message,
  }
}

// ——— COO: входящие сообщения от n8n (push). Нормализуем ответ: n8n может вернуть { messages } или [{ messages }]. ———
export async function getCOOIncomingMessages(afterId?: string): Promise<{ messages: COOIncomingMessage[] }> {
  let raw: ApiEnvelope<{ messages?: COOIncomingMessage[] } | Array<{ messages?: COOIncomingMessage[] }>>
  try {
    raw = await request<ApiEnvelope<{ messages?: COOIncomingMessage[] } | Array<{ messages?: COOIncomingMessage[] }>>>(
      buildBody('getCOOIncomingMessages', afterId != null ? { after_id: afterId } : undefined)
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('No item to return was found')) {
      return { messages: [] }
    }
    throw error
  }
  const data = unwrapData(raw)
  if (Array.isArray(data) && data.length > 0 && data[0]?.messages) {
    return { messages: data[0].messages }
  }
  if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray((data as { messages?: COOIncomingMessage[] }).messages)) {
    return { messages: (data as { messages: COOIncomingMessage[] }).messages }
  }
  return { messages: [] }
}

export async function downloadCOOAttachment(attachment: N8nAttachment): Promise<{
  fileName: string
  mimeType: string
  contentBase64: string
}> {
  const raw = await request<ApiEnvelope<{
    fileName: string
    mimeType: string
    contentBase64: string
  }>>(buildBody('downloadCOOAttachment', {
    path: attachment.path ?? attachment.url,
    filename: attachment.filename ?? attachment.name,
    content_type: attachment.content_type ?? attachment.contentType ?? attachment.mimeType,
  }))
  const data = unwrapData(raw)
  if (!data?.contentBase64) {
    const rawRecord: unknown = raw
    const message = isObjectRecord(rawRecord) && typeof rawRecord.error === 'string' ? rawRecord.error : 'Не удалось скачать файл'
    throw new Error(message)
  }
  return data
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
