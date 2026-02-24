export type AppView = 'coo' | 'tasks' | 'clients' | 'settings' | 'leads' | 'chat'

/** Идентификатор раздела: главный (coo, crm, ops, chat, settings) или подраздел (crm/dashboard, crm/leads, ...) */
export type ViewId = string

/** Элемент навигации: раздел с опциональными подразделами */
export interface NavSection {
  id: string
  label: string
  icon: string
  children?: { id: string; label: string }[]
}

// ——— Авторизация и демо ———
export interface DemoRequest {
  name: string
  email: string
  source: string   // откуда узнали о нас
  region: string
}

export type DemoResult = 'access' | 'deny'

export interface N8nMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: Array<{
    type: 'image' | 'file' | 'chart'
    url: string
    name?: string
  }>
  timestamp: number
}

/** Сообщение, пришедшее из n8n в COO (push). id — монотонный bigint (sequence). Сообщения со status "processing" не сохраняем и не показываем — оставляем индикатор «печатает». */
export interface COOIncomingMessage {
  /** bigint sequence (в JSON приходит как string для сохранения точности) */
  id: string
  text: string
  attachments?: N8nMessage['attachments']
  timestamp: number
  /** Если "processing" — не сохраняем в лог, не показываем в чате; ждём финальный ответ */
  status?: string
}

// ——— Задачи (поля из n8n: task_type, domain, status, step_index, created_at, params) ———
export interface Task {
  id: string
  task_type: string
  domain: string
  status: string
  step_index: number | string
  created_at: string
  params?: Record<string, unknown>
}

// ——— Клиенты (динамические поля из n8n: id обязателен, остальное — любые ключи) ———
export type Client = Record<string, unknown> & { id: string }

// ——— Лиды ———
export interface LeadEvent {
  id?: string
  type?: string
  message?: string
  createdAt?: string
  timestamp?: number
  [key: string]: unknown
}

export interface Lead {
  id: string
  stageId: string
  title?: string
  events?: LeadEvent[]
  [key: string]: unknown
}

export interface LeadStage {
  id: string
  title: string
  order: number
}

/** Сделка / инвойс — те же поля что лид, для канбана и списка */
export interface Deal {
  id: string
  title: string
  description?: string
  stageId: string
  contactName?: string
  contactPhone?: string
  createdAt?: string
  [key: string]: unknown
}

export interface Invoice {
  id: string
  title: string
  description?: string
  stageId: string
  contactName?: string
  contactPhone?: string
  createdAt?: string
  [key: string]: unknown
}

// ——— Чат ———
export interface ChatChannel {
  id: string
  name: string
  isGeneral?: boolean
}

export interface ChatUser {
  id: string
  name: string
  avatar?: string
}

export interface ChatAttachment {
  type: 'file' | 'image' | 'sticker'
  url: string
  name?: string
}

export interface ChatMessage {
  id: string
  chatId: string
  chatType: 'channel' | 'user'
  senderId: string
  senderName: string
  text: string
  timestamp: number
  isOwn?: boolean
  attachments?: ChatAttachment[]
}
