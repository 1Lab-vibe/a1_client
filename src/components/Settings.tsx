import { useEffect, useMemo, useState } from 'react'
import { Bell, Bot, Building2, CheckCircle2, KeyRound, Link2, Megaphone, Package, PlugZap, RefreshCw, Save, ShieldCheck, Target, Users } from 'lucide-react'
import {
  getConfig,
  getIntegrations,
  getSettings,
  getUsersAndPermissions,
  inviteUser,
  startIntegrationConnect,
  testIntegration,
  updateConfig,
  updateSettingsSection,
  updateUserRole,
  updateUserStatus,
  type CompanyConfig,
} from '../api/n8n'
import styles from './Settings.module.css'

type FieldType = 'text' | 'textarea' | 'select' | 'toggle' | 'slider'

interface FieldDef {
  path: string
  label: string
  hint?: string
  type: FieldType
  options?: string[]
  secret?: boolean
  min?: number
  max?: number
  step?: number
}

interface SettingsSection {
  id: string
  title: string
  description: string
  icon: typeof Building2
  fields: FieldDef[]
}

type DataRow = Record<string, unknown>

interface IntegrationRow {
  provider: string
  name: string
  status: string
  health: string
  lastSync: string
  error: string
}

interface ManagedFieldDef {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'select'
  options?: string[]
}

interface ManagedCollectionDef {
  section: string
  path: string
  title: string
  description: string
  addLabel: string
  fields: ManagedFieldDef[]
  emptyItem: Record<string, string>
}

const MANAGED_COLLECTIONS: Record<string, ManagedCollectionDef[]> = {
  crm: [
    {
      section: 'crm',
      path: 'crm.sources',
      title: 'Источники и поля CRM',
      description: 'Источники, обязательность и правила обработки лидов сохраняются в конфиг компании.',
      addLabel: 'Добавить источник',
      fields: [
        { key: 'name', label: 'Источник' },
        { key: 'code', label: 'Код' },
        { key: 'required_fields', label: 'Обязательные поля' },
        { key: 'enabled', label: 'Статус', type: 'select', options: ['enabled', 'disabled'] },
      ],
      emptyItem: { name: '', code: '', required_fields: '', enabled: 'enabled' },
    },
    {
      section: 'crm',
      path: 'crm.stage_rules',
      title: 'Правила стадий',
      description: 'Стадии лидов и сделок с SLA, ответственными и правилами перехода.',
      addLabel: 'Добавить стадию',
      fields: [
        { key: 'pipeline', label: 'Воронка', type: 'select', options: ['lead', 'deal'] },
        { key: 'name', label: 'Стадия' },
        { key: 'sla_hours', label: 'SLA, часов' },
        { key: 'owner_role', label: 'Роль владельца', type: 'select', options: ['owner', 'admin', 'member'] },
      ],
      emptyItem: { pipeline: 'lead', name: '', sla_hours: '24', owner_role: 'admin' },
    },
  ],
  marketing: [{
    section: 'marketing',
    path: 'marketing.channels',
    title: 'Каналы привлечения',
    description: 'Каналы, бюджет, SLA и правила квалификации сохраняются в конфиг компании и читаются backend-воркфлоу.',
    addLabel: 'Добавить канал',
    fields: [
      { key: 'name', label: 'Канал' },
      { key: 'type', label: 'Тип', type: 'select', options: ['direct', 'telegram', 'email', 'partner', 'seo', 'event', 'other'] },
      { key: 'budget', label: 'Бюджет' },
      { key: 'goal', label: 'Цель' },
      { key: 'status', label: 'Статус', type: 'select', options: ['active', 'paused', 'testing'] },
    ],
    emptyItem: { name: '', type: 'direct', budget: '', goal: '', status: 'active' },
  }],
  products: [{
    section: 'products',
    path: 'products.catalog',
    title: 'Продуктовая матрица',
    description: 'Продукты, офферы и приоритеты используются в продажах, отчетах и квалификации лидов.',
    addLabel: 'Добавить продукт',
    fields: [
      { key: 'name', label: 'Продукт' },
      { key: 'offer', label: 'Оффер', type: 'textarea' },
      { key: 'price', label: 'Цена / диапазон' },
      { key: 'priority', label: 'Приоритет', type: 'select', options: ['high', 'medium', 'low'] },
    ],
    emptyItem: { name: '', offer: '', price: '', priority: 'medium' },
  }],
  icp: [{
    section: 'icp',
    path: 'icp.segments_detail',
    title: 'ICP-сегменты',
    description: 'Сегменты ICP нужны для скоринга, маркетинга и правил handoff.',
    addLabel: 'Добавить сегмент',
    fields: [
      { key: 'name', label: 'Сегмент' },
      { key: 'industry', label: 'Отрасль' },
      { key: 'decision_maker', label: 'ЛПР' },
      { key: 'pain', label: 'Ключевая боль', type: 'textarea' },
      { key: 'fit_score', label: 'Fit score' },
    ],
    emptyItem: { name: '', industry: '', decision_maker: '', pain: '', fit_score: '70' },
  }],
  policies: [{
    section: 'policies',
    path: 'policies.rules',
    title: 'Правила и ограничения',
    description: 'Политики согласования, эскалации и риск-контроля без правки JSON.',
    addLabel: 'Добавить правило',
    fields: [
      { key: 'name', label: 'Правило' },
      { key: 'domain', label: 'Домен', type: 'select', options: ['sales', 'marketing', 'finance', 'legal', 'security', 'ops'] },
      { key: 'trigger', label: 'Когда срабатывает' },
      { key: 'action', label: 'Действие', type: 'textarea' },
      { key: 'severity', label: 'Риск', type: 'select', options: ['low', 'medium', 'high'] },
    ],
    emptyItem: { name: '', domain: 'ops', trigger: '', action: '', severity: 'medium' },
  }],
  prompts: [{
    section: 'prompts',
    path: 'prompts.items',
    title: 'Рабочие промпты',
    description: 'Версионируемые инструкции по доменам: COO, продажи, маркетинг, отчеты.',
    addLabel: 'Добавить промпт',
    fields: [
      { key: 'name', label: 'Название' },
      { key: 'domain', label: 'Домен', type: 'select', options: ['coo', 'sales', 'marketing', 'reports', 'support'] },
      { key: 'enabled', label: 'Статус', type: 'select', options: ['enabled', 'disabled', 'draft'] },
      { key: 'prompt', label: 'Инструкция', type: 'textarea' },
    ],
    emptyItem: { name: '', domain: 'coo', enabled: 'enabled', prompt: '' },
  }],
  handlers: [{
    section: 'handlers',
    path: 'handlers.routes',
    title: 'Маршруты хендлеров',
    description: 'Какие домены включены и в какие внутренние workflow отправлять задачи.',
    addLabel: 'Добавить маршрут',
    fields: [
      { key: 'domain', label: 'Домен', type: 'select', options: ['sales', 'marketing', 'finance', 'legal', 'hr', 'it', 'ops'] },
      { key: 'enabled', label: 'Статус', type: 'select', options: ['enabled', 'disabled'] },
      { key: 'workflow_key', label: 'Workflow key' },
      { key: 'fallback_owner', label: 'Ответственный' },
    ],
    emptyItem: { domain: 'sales', enabled: 'enabled', workflow_key: '', fallback_owner: '' },
  }],
  action_templates: [{
    section: 'action_templates',
    path: 'action_templates.items',
    title: 'Шаблоны действий',
    description: 'Управляемые сценарии задач, follow-up, согласований и отчетов.',
    addLabel: 'Добавить шаблон',
    fields: [
      { key: 'name', label: 'Название' },
      { key: 'type', label: 'Тип', type: 'select', options: ['approval', 'follow_up', 'task', 'report', 'escalation'] },
      { key: 'enabled', label: 'Статус', type: 'select', options: ['enabled', 'disabled'] },
      { key: 'template', label: 'Шаблон', type: 'textarea' },
    ],
    emptyItem: { name: '', type: 'task', enabled: 'enabled', template: '' },
  }],
  letter_templates: [{
    section: 'letter_templates',
    path: 'letter_templates.items',
    title: 'Шаблоны писем',
    description: 'Темы и тела писем в нормальной кодировке: демо, пароль, follow-up, outreach.',
    addLabel: 'Добавить письмо',
    fields: [
      { key: 'name', label: 'Название' },
      { key: 'type', label: 'Тип', type: 'select', options: ['demo_access', 'password_reset', 'follow_up', 'outreach'] },
      { key: 'subject', label: 'Тема' },
      { key: 'body', label: 'Тело письма', type: 'textarea' },
    ],
    emptyItem: { name: '', type: 'follow_up', subject: '', body: '' },
  }],
  notifications: [{
    section: 'notifications',
    path: 'notifications.rules',
    title: 'Правила уведомлений',
    description: 'Какие события отправлять в email, Telegram и web без правки workflow.',
    addLabel: 'Добавить правило',
    fields: [
      { key: 'event', label: 'Событие' },
      { key: 'channel', label: 'Канал', type: 'select', options: ['email', 'telegram', 'web'] },
      { key: 'enabled', label: 'Статус', type: 'select', options: ['enabled', 'disabled'] },
      { key: 'quiet_hours', label: 'Тихие часы' },
    ],
    emptyItem: { event: '', channel: 'email', enabled: 'enabled', quiet_hours: '' },
  }],
  access: [
    {
      section: 'access',
      path: 'access.role_permissions',
      title: 'Матрица прав',
      description: 'Роли и доступы к разделам сохраняются в конфиг компании и используются UI/backend как единый источник.',
      addLabel: 'Добавить правило роли',
      fields: [
        { key: 'role', label: 'Роль', type: 'select', options: ['owner', 'admin', 'member'] },
        { key: 'section', label: 'Раздел', type: 'select', options: ['dashboard', 'crm', 'coo', 'reports', 'settings', 'integrations', 'users'] },
        { key: 'access', label: 'Доступ', type: 'select', options: ['none', 'read', 'write', 'admin'] },
        { key: 'note', label: 'Комментарий' },
      ],
      emptyItem: { role: 'member', section: 'dashboard', access: 'read', note: '' },
    },
    {
      section: 'access',
      path: 'access.audit_markers',
      title: 'Audit-маркеры',
      description: 'События, которые нужно логировать при изменениях доступов и настроек.',
      addLabel: 'Добавить marker',
      fields: [
        { key: 'event', label: 'Событие' },
        { key: 'severity', label: 'Важность', type: 'select', options: ['info', 'warning', 'critical'] },
        { key: 'notify', label: 'Уведомление', type: 'select', options: ['none', 'owner', 'security'] },
      ],
      emptyItem: { event: '', severity: 'info', notify: 'owner' },
    },
  ],
}

const SECTIONS: SettingsSection[] = [
  {
    id: 'company',
    title: 'Профиль компании',
    description: 'Название, язык, часовой пояс и базовая рабочая среда.',
    icon: Building2,
    fields: [
      { path: 'company.name', label: 'Название компании', type: 'text' },
      { path: 'company.brand_name', label: 'Публичное название', type: 'text' },
      { path: 'company.timezone', label: 'Часовой пояс', type: 'select', options: ['Europe/Moscow', 'Asia/Dubai', 'UTC'] },
      { path: 'company.language', label: 'Язык', type: 'select', options: ['ru', 'en'] },
      { path: 'company.work_hours', label: 'Рабочие часы', type: 'text', hint: 'Например: 10:00-19:00' },
    ],
  },
  {
    id: 'coo',
    title: 'COO Behavior',
    description: 'Тон, handoff и ограничения операционного ассистента.',
    icon: Bot,
    fields: [
      { path: 'coo.tone', label: 'Тон ответа', type: 'select', options: ['деловой', 'нейтральный', 'дружелюбный'] },
      { path: 'coo.auto_reply_enabled', label: 'Автоответы включены', type: 'toggle' },
      { path: 'coo.handoff_enabled', label: 'Передача оператору', type: 'toggle' },
      { path: 'coo.escalation_channel', label: 'Канал эскалации', type: 'text' },
      { path: 'coo.system_prompt', label: 'Системная инструкция', type: 'textarea' },
    ],
  },
  {
    id: 'channels',
    title: 'Каналы',
    description: 'Telegram, email, web-client и статусы подключения.',
    icon: Link2,
    fields: [
      { path: 'channels.telegram.enabled', label: 'Telegram включен', type: 'toggle' },
      { path: 'channels.email.enabled', label: 'Email включен', type: 'toggle' },
      { path: 'channels.web.enabled', label: 'Web-client включен', type: 'toggle' },
      { path: 'channels.default_channel', label: 'Канал по умолчанию', type: 'select', options: ['web', 'telegram', 'email'] },
    ],
  },
  {
    id: 'crm',
    title: 'CRM',
    description: 'Стадии, источники, обязательные поля и правила обработки.',
    icon: CheckCircle2,
    fields: [
      { path: 'crm.default_source', label: 'Источник по умолчанию', type: 'text' },
      { path: 'crm.required_fields', label: 'Обязательные поля', type: 'text', hint: 'Через запятую' },
      { path: 'crm.lead_stages', label: 'Стадии лидов', type: 'text', hint: 'Через запятую' },
      { path: 'crm.deal_stages', label: 'Стадии сделок', type: 'text', hint: 'Через запятую' },
    ],
  },
  {
    id: 'marketing',
    title: 'Маркетинг',
    description: 'Позиционирование, каналы привлечения, бюджет и правила квалификации лидов.',
    icon: Megaphone,
    fields: [
      { path: 'marketing.positioning', label: 'Позиционирование', type: 'textarea' },
      { path: 'marketing.primary_channels', label: 'Основные каналы', type: 'text', hint: 'direct, tg, email, partner' },
      { path: 'marketing.target_regions', label: 'Целевые регионы', type: 'text', hint: 'Через запятую' },
      { path: 'marketing.monthly_budget', label: 'Месячный бюджет', type: 'text' },
      { path: 'marketing.leadgen_enabled', label: 'Лидогенерация включена', type: 'toggle' },
      { path: 'marketing.min_lead_score', label: 'Минимальный score лида', type: 'slider', min: 0, max: 100, step: 5 },
      { path: 'marketing.follow_up_sla_hours', label: 'SLA follow-up, часов', type: 'slider', min: 1, max: 72, step: 1 },
    ],
  },
  {
    id: 'products',
    title: 'Продукты',
    description: 'Продуктовая матрица, офферы, цены, ограничения и приоритеты продаж.',
    icon: Package,
    fields: [
      { path: 'products.primary', label: 'Основные продукты', type: 'textarea', hint: 'По одному продукту или группе в строке' },
      { path: 'products.core_offer', label: 'Главный оффер', type: 'textarea' },
      { path: 'products.price_range', label: 'Диапазон цен', type: 'text' },
      { path: 'products.usp', label: 'УТП', type: 'textarea' },
      { path: 'products.exclusions', label: 'Что не продаем / ограничения', type: 'textarea' },
      { path: 'products.priority_score', label: 'Приоритет продуктовой линейки', type: 'slider', min: 0, max: 100, step: 5 },
    ],
  },
  {
    id: 'icp',
    title: 'ICP',
    description: 'Идеальный профиль клиента: сегменты, роли, боли, география и fit score.',
    icon: Target,
    fields: [
      { path: 'icp.segments', label: 'Сегменты', type: 'text', hint: 'Через запятую' },
      { path: 'icp.industries', label: 'Отрасли', type: 'text', hint: 'Через запятую' },
      { path: 'icp.company_size', label: 'Размер компании', type: 'text' },
      { path: 'icp.geo', label: 'География', type: 'text' },
      { path: 'icp.decision_makers', label: 'ЛПР', type: 'text', hint: 'CEO, COO, CMO...' },
      { path: 'icp.pain_points', label: 'Боли клиента', type: 'textarea' },
      { path: 'icp.min_fit_score', label: 'Минимальный fit score', type: 'slider', min: 0, max: 100, step: 5 },
    ],
  },
  {
    id: 'policies',
    title: 'Политики',
    description: 'Правила согласования, эскалации, хранения данных и риск-контроля COO.',
    icon: ShieldCheck,
    fields: [
      { path: 'policies.approval_required', label: 'Согласование важных действий', type: 'toggle' },
      { path: 'policies.human_handoff_required', label: 'Handoff при риске', type: 'toggle' },
      { path: 'policies.risk_level', label: 'Уровень риска', type: 'select', options: ['low', 'medium', 'high'] },
      { path: 'policies.data_retention_days', label: 'Хранение данных, дней', type: 'slider', min: 30, max: 1095, step: 30 },
      { path: 'policies.escalation_rules', label: 'Правила эскалации', type: 'textarea' },
    ],
  },
  {
    id: 'prompts',
    title: 'Промпты',
    description: 'Рабочие инструкции для COO, продаж, квалификации лидов и отчетов.',
    icon: Bot,
    fields: [
      { path: 'prompts.coo_system', label: 'COO system prompt', type: 'textarea' },
      { path: 'prompts.lead_qualification', label: 'Квалификация лидов', type: 'textarea' },
      { path: 'prompts.sales_reply', label: 'Ответы продаж', type: 'textarea' },
      { path: 'prompts.report_summary', label: 'Сводки и отчеты', type: 'textarea' },
    ],
  },
  {
    id: 'handlers',
    title: 'Хендлеры',
    description: 'Включение доменов обработки и маршрутизация задач по внутренним workflow.',
    icon: CheckCircle2,
    fields: [
      { path: 'handlers.sales.enabled', label: 'Sales handler', type: 'toggle' },
      { path: 'handlers.marketing.enabled', label: 'Marketing handler', type: 'toggle' },
      { path: 'handlers.finance.enabled', label: 'Finance handler', type: 'toggle' },
      { path: 'handlers.legal.enabled', label: 'Legal handler', type: 'toggle' },
      { path: 'handlers.default_owner', label: 'Ответственный по умолчанию', type: 'text' },
      { path: 'handlers.route_map', label: 'Карта маршрутизации', type: 'textarea' },
    ],
  },
  {
    id: 'action_templates',
    title: 'Шаблоны действий',
    description: 'Готовые команды и сценарии: approval, follow-up, task, report, escalation.',
    icon: KeyRound,
    fields: [
      { path: 'action_templates.approval', label: 'Approval template', type: 'textarea' },
      { path: 'action_templates.follow_up', label: 'Follow-up template', type: 'textarea' },
      { path: 'action_templates.task', label: 'Task template', type: 'textarea' },
      { path: 'action_templates.report', label: 'Report template', type: 'textarea' },
    ],
  },
  {
    id: 'letter_templates',
    title: 'Шаблоны писем',
    description: 'Письма для демо-доступа, сброса пароля, лидогенерации и follow-up.',
    icon: Bell,
    fields: [
      { path: 'letter_templates.demo_access_subject', label: 'Тема демо-доступа', type: 'text' },
      { path: 'letter_templates.demo_access_body', label: 'Тело демо-доступа', type: 'textarea' },
      { path: 'letter_templates.password_reset_subject', label: 'Тема временного пароля', type: 'text' },
      { path: 'letter_templates.password_reset_body', label: 'Тело временного пароля', type: 'textarea' },
      { path: 'letter_templates.outreach_body', label: 'Лидогенерация', type: 'textarea' },
    ],
  },
  {
    id: 'notifications',
    title: 'Уведомления',
    description: 'События, quiet hours и каналы доставки.',
    icon: Bell,
    fields: [
      { path: 'notifications.email.enabled', label: 'Уведомления на email', type: 'toggle' },
      { path: 'notifications.telegram.enabled', label: 'Уведомления в Telegram', type: 'toggle' },
      { path: 'notifications.quiet_hours', label: 'Тихие часы', type: 'text', hint: 'Например: 22:00-09:00' },
      { path: 'notifications.events', label: 'События', type: 'text', hint: 'lead_created, deal_won' },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Только статусы: секреты и ключи не показываются в UI.',
    icon: ShieldCheck,
    fields: [
      { path: 'security.webhook_secret_status', label: 'Webhook secret', type: 'select', options: ['configured', 'missing', 'rotation_required'], secret: true },
      { path: 'security.keys_encryption', label: 'Шифрование ключей', type: 'select', options: ['age+soap', 'missing', 'rotation_required'], secret: true },
      { path: 'security.audit_enabled', label: 'Audit включен', type: 'toggle' },
      { path: 'security.last_rotation_at', label: 'Последняя ротация', type: 'text', secret: true },
    ],
  },
  {
    id: 'integrations',
    title: 'Интеграции',
    description: 'Подключения, health-check и последняя синхронизация.',
    icon: KeyRound,
    fields: [
      { path: 'integrations.telegram.status', label: 'Telegram', type: 'select', options: ['connected', 'disconnected', 'error'] },
      { path: 'integrations.email.status', label: 'Email', type: 'select', options: ['connected', 'disconnected', 'error'] },
      { path: 'integrations.yandex_direct.status', label: 'Yandex Direct', type: 'select', options: ['connected', 'disconnected', 'error'] },
      { path: 'integrations.last_sync_at', label: 'Последний sync', type: 'text' },
    ],
  },
  {
    id: 'access',
    title: 'Доступ',
    description: 'Owner/admin/member и доступы по компаниям.',
    icon: Users,
    fields: [
      { path: 'access.default_role', label: 'Роль по умолчанию', type: 'select', options: ['owner', 'admin', 'member'] },
      { path: 'access.invites_enabled', label: 'Приглашения включены', type: 'toggle' },
      { path: 'access.allowed_domains', label: 'Домены почты', type: 'text', hint: 'Через запятую' },
    ],
  },
]

interface SettingsProps {
  initialSection?: string
}

function normalizeSectionId(sectionId?: string): string {
  if (sectionId && SECTIONS.some((section) => section.id === sectionId)) return sectionId
  return SECTIONS[0].id
}

function getPath(obj: CompanyConfig, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object' || Array.isArray(acc)) return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

function setPath(obj: CompanyConfig, path: string, value: unknown): CompanyConfig {
  const next: Record<string, unknown> = { ...obj }
  const parts = path.split('.')
  let current = next
  parts.slice(0, -1).forEach((part) => {
    const valueAtPart = current[part]
    current[part] = valueAtPart && typeof valueAtPart === 'object' && !Array.isArray(valueAtPart)
      ? { ...(valueAtPart as Record<string, unknown>) }
      : {}
    current = current[part] as Record<string, unknown>
  })
  current[parts[parts.length - 1]] = value
  return next
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function parseTextValue(value: string): unknown {
  const trimmed = value.trim()
  if (trimmed.includes(',') && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return value
}

function fieldValue(config: CompanyConfig, field: FieldDef): string | boolean {
  const value = getPath(config, field.path)
  if (field.type === 'toggle') return Boolean(value)
  if (field.type === 'slider') return Number.isFinite(Number(value)) ? String(Number(value)) : String(field.min ?? 0)
  if (field.secret && typeof value === 'string' && value.length > 16) return 'configured'
  return stringifyValue(value)
}

function sectionValue(config: CompanyConfig, sectionId: string): Record<string, unknown> {
  const value = getPath(config, sectionId)
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asRows(value: unknown, keys: string[]): DataRow[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is DataRow => !!item && typeof item === 'object' && !Array.isArray(item))
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const record = value as Record<string, unknown>
  for (const key of keys) {
    const rows = asRows(record[key], [])
    if (rows.length > 0) return rows
  }
  return []
}

function cell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const PROVIDER_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  email: 'Email',
  yandex_direct: 'Yandex Direct',
  web: 'Web client',
  client: 'A1 client',
  crm: 'CRM',
}

function normalizeIntegrations(data: Record<string, unknown> | null, config: CompanyConfig): IntegrationRow[] {
  const rows = asRows(data, ['integrations', 'items', 'rows', 'data'])
  if (rows.length > 0) {
    return rows.map((row) => {
      const provider = cell(row.provider ?? row.id ?? row.code ?? row.name).toLowerCase().replace(/\s+/g, '_')
      return {
        provider,
        name: cell(row.title ?? row.name ?? PROVIDER_LABELS[provider] ?? provider),
        status: cell(row.status ?? row.connection_status ?? 'unknown'),
        health: cell(row.health ?? row.health_status ?? row.ok),
        lastSync: cell(row.last_sync_at ?? row.lastSyncAt ?? row.updated_at),
        error: cell(row.error ?? row.last_error),
      }
    })
  }

  const configured = sectionValue(config, 'integrations')
  const providers = ['telegram', 'email', 'yandex_direct', 'web', 'client']
  return providers.map((provider) => {
    const value = configured[provider]
    const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    return {
      provider,
      name: PROVIDER_LABELS[provider] ?? provider,
      status: cell(record.status ?? 'unknown'),
      health: cell(record.health ?? record.ok ?? '-'),
      lastSync: cell(record.last_sync_at ?? configured.last_sync_at),
      error: cell(record.error ?? record.last_error),
    }
  })
}

function normalizeUsers(data: Record<string, unknown> | null): DataRow[] {
  return asRows(data, ['users', 'permissions', 'items', 'rows', 'data'])
}

function rowId(row: DataRow): string {
  return cell(row.user_id ?? row.id ?? row.auth_user_id ?? row.email ?? row.login)
}

function rowCompanyId(row: DataRow): string | undefined {
  const value = row.company_id ?? row.companyId
  return value == null ? undefined : String(value)
}

function rowIsActive(row: DataRow): boolean {
  if (typeof row.is_active === 'boolean') return row.is_active
  if (typeof row.active === 'boolean') return row.active
  const status = String(row.status ?? '').toLowerCase()
  return !['blocked', 'disabled', 'inactive', 'deactivated', 'archived'].includes(status)
}

function collectionItems(config: CompanyConfig, def: ManagedCollectionDef): DataRow[] {
  const value = getPath(config, def.path)
  if (Array.isArray(value)) {
    return value.map((item) => item && typeof item === 'object' && !Array.isArray(item) ? item as DataRow : { name: String(item) })
  }
  return []
}

export function Settings({ initialSection }: SettingsProps = {}) {
  const [activeSection, setActiveSection] = useState(() => normalizeSectionId(initialSection))
  const [config, setConfig] = useState<CompanyConfig>({})
  const [draft, setDraft] = useState<CompanyConfig>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [integrationsData, setIntegrationsData] = useState<Record<string, unknown> | null>(null)
  const [integrationsLoading, setIntegrationsLoading] = useState(false)
  const [integrationsError, setIntegrationsError] = useState<string | null>(null)
  const [integrationAction, setIntegrationAction] = useState<string | null>(null)
  const [usersData, setUsersData] = useState<Record<string, unknown> | null>(null)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [roleAction, setRoleAction] = useState<string | null>(null)
  const [statusAction, setStatusAction] = useState<string | null>(null)
  const [inviteAction, setInviteAction] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', fullName: '', role: 'member' })

  useEffect(() => {
    setLoading(true)
    setError(null)
    getSettings()
      .catch(() => getConfig())
      .then((res) => {
        setConfig(res || {})
        setDraft(res || {})
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки настроек'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setActiveSection(normalizeSectionId(initialSection))
  }, [initialSection])

  const loadIntegrations = () => {
    setIntegrationsLoading(true)
    setIntegrationsError(null)
    getIntegrations()
      .then((res) => setIntegrationsData(res || {}))
      .catch((e) => setIntegrationsError(e instanceof Error ? e.message : 'Ошибка загрузки интеграций'))
      .finally(() => setIntegrationsLoading(false))
  }

  const loadUsers = () => {
    setUsersLoading(true)
    setUsersError(null)
    getUsersAndPermissions()
      .then((res) => setUsersData(res || {}))
      .catch((e) => setUsersError(e instanceof Error ? e.message : 'Ошибка загрузки доступов'))
      .finally(() => setUsersLoading(false))
  }

  useEffect(() => {
    if (activeSection === 'integrations' && !integrationsData && !integrationsLoading) loadIntegrations()
    if (activeSection === 'access' && !usersData && !usersLoading) loadUsers()
  }, [activeSection])

  const section = useMemo(() => SECTIONS.find((item) => item.id === activeSection) ?? SECTIONS[0], [activeSection])
  const dirty = useMemo(
    () => JSON.stringify(sectionValue(config, section.id)) !== JSON.stringify(sectionValue(draft, section.id)),
    [config, draft, section.id],
  )

  const updateField = (field: FieldDef, value: string | boolean) => {
    const parsed = field.type === 'toggle'
      ? value
      : field.type === 'slider'
        ? Number(value)
        : parseTextValue(String(value))
    setDraft((current) => setPath(current, field.path, parsed))
  }

  const save = () => {
    const patch = sectionValue(draft, section.id)
    setSaving(true)
    setError(null)
    updateSettingsSection(section.id, patch)
      .catch(() => updateConfig(draft))
      .then((updated) => {
        const next = updated && Object.keys(updated).length > 0 ? updated : setPath(config, section.id, patch)
        setConfig(next)
        setDraft((current) => ({ ...current, [section.id]: sectionValue(next, section.id) }))
        setSavedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка сохранения настроек'))
      .finally(() => setSaving(false))
  }

  const runIntegrationAction = (provider: string, mode: 'connect' | 'test') => {
    setIntegrationAction(`${mode}:${provider}`)
    setIntegrationsError(null)
    const action = mode === 'connect' ? startIntegrationConnect(provider) : testIntegration(provider)
    action
      .then(() => loadIntegrations())
      .catch((e) => setIntegrationsError(e instanceof Error ? e.message : 'Ошибка проверки интеграции'))
      .finally(() => setIntegrationAction(null))
  }

  const changeRole = (row: DataRow, role: string) => {
    const userId = rowId(row)
    if (!userId || userId === '-') return
    setRoleAction(userId)
    setUsersError(null)
    updateUserRole(userId, role, rowCompanyId(row))
      .then(() => loadUsers())
      .catch((e) => setUsersError(e instanceof Error ? e.message : 'Ошибка изменения роли'))
      .finally(() => setRoleAction(null))
  }

  const inviteAccessUser = () => {
    const email = inviteForm.email.trim()
    if (!email) {
      setUsersError('Укажите email пользователя')
      return
    }
    setInviteAction(true)
    setUsersError(null)
    inviteUser(email, inviteForm.role, inviteForm.fullName.trim() || undefined)
      .then(() => {
        setInviteForm({ email: '', fullName: '', role: 'member' })
        loadUsers()
      })
      .catch((e) => setUsersError(e instanceof Error ? e.message : 'Ошибка приглашения пользователя'))
      .finally(() => setInviteAction(false))
  }

  const toggleUserStatus = (row: DataRow) => {
    const userId = rowId(row)
    if (!userId || userId === '-') return
    const nextActive = !rowIsActive(row)
    setStatusAction(userId)
    setUsersError(null)
    updateUserStatus(userId, nextActive, rowCompanyId(row))
      .then(() => loadUsers())
      .catch((e) => setUsersError(e instanceof Error ? e.message : 'Ошибка изменения статуса пользователя'))
      .finally(() => setStatusAction(null))
  }

  const updateCollectionItem = (def: ManagedCollectionDef, index: number, key: string, value: string) => {
    setDraft((current) => {
      const rows = collectionItems(current, def).map((item) => ({ ...item }))
      rows[index] = { ...(rows[index] ?? {}), [key]: value }
      return setPath(current, def.path, rows)
    })
  }

  const addCollectionItem = (def: ManagedCollectionDef) => {
    setDraft((current) => {
      const rows = collectionItems(current, def)
      return setPath(current, def.path, [...rows, { ...def.emptyItem }])
    })
  }

  const removeCollectionItem = (def: ManagedCollectionDef, index: number) => {
    setDraft((current) => {
      const rows = collectionItems(current, def).filter((_, rowIndex) => rowIndex !== index)
      return setPath(current, def.path, rows)
    })
  }

  const integrationRows = useMemo(() => normalizeIntegrations(integrationsData, draft), [integrationsData, draft])
  const userRows = useMemo(() => normalizeUsers(usersData), [usersData])
  const collectionDefs = MANAGED_COLLECTIONS[section.id] ?? []
  const managedRowsByPath = useMemo(
    () => Object.fromEntries(collectionDefs.map((def) => [def.path, collectionItems(draft, def)])),
    [collectionDefs, draft],
  )

  return (
    <div className={styles.wrap}>
      <aside className={styles.nav}>
        {SECTIONS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={item.id === activeSection ? styles.active : ''}
              onClick={() => setActiveSection(item.id)}
            >
              <Icon aria-hidden />
              <span>{item.title}</span>
            </button>
          )
        })}
      </aside>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </div>
          <button type="button" className={styles.saveBtn} onClick={save} disabled={!dirty || saving || loading}>
            <Save aria-hidden />
            {saving ? 'Сохраняем...' : dirty ? 'Сохранить' : 'Сохранено'}
          </button>
        </div>

        {loading && <div className={styles.state}>Загружаем настройки...</div>}
        {error && <div className={styles.error}>{error}</div>}
        {savedAt && !dirty && <div className={styles.saved}>Сохранено в {savedAt}</div>}

        {!loading && section.id === 'integrations' && (
          <div className={styles.runtimePanel}>
            <div className={styles.runtimeHead}>
              <div>
                <h3>Подключения и health-check</h3>
                <p>Статусы приходят из prod n8n, секреты и токены в интерфейс не выводятся.</p>
              </div>
              <button type="button" onClick={loadIntegrations} disabled={integrationsLoading}>
                <RefreshCw aria-hidden />
                Обновить
              </button>
            </div>
            {integrationsError && <div className={styles.error}>{integrationsError}</div>}
            <div className={styles.integrationGrid}>
              {integrationRows.map((item) => (
                <article key={item.provider} className={styles.integrationCard}>
                  <div className={styles.integrationTop}>
                    <PlugZap aria-hidden />
                    <div>
                      <strong>{item.name}</strong>
                      <span className={styles.statusPill}>{item.status}</span>
                    </div>
                  </div>
                  <dl>
                    <div><dt>Проверка</dt><dd>{item.health}</dd></div>
                    <div><dt>Синхронизация</dt><dd>{item.lastSync}</dd></div>
                    <div><dt>Ошибка</dt><dd>{item.error}</dd></div>
                  </dl>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      onClick={() => runIntegrationAction(item.provider, 'test')}
                      disabled={integrationAction === `test:${item.provider}`}
                    >
                      Проверить
                    </button>
                    <button
                      type="button"
                      onClick={() => runIntegrationAction(item.provider, 'connect')}
                      disabled={integrationAction === `connect:${item.provider}`}
                    >
                      Подключить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {!loading && section.id === 'access' && (
          <div className={styles.runtimePanel}>
            <div className={styles.runtimeHead}>
              <div>
                <h3>Пользователи и роли</h3>
                <p>Роли сохраняются в backend и перечитываются из prod n8n.</p>
              </div>
              <button type="button" onClick={loadUsers} disabled={usersLoading}>
                <RefreshCw aria-hidden />
                Обновить
              </button>
            </div>
            {usersError && <div className={styles.error}>{usersError}</div>}
            <div className={styles.inviteForm}>
              <input
                value={inviteForm.email}
                onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="email@company.ru"
                type="email"
              />
              <input
                value={inviteForm.fullName}
                onChange={(event) => setInviteForm((current) => ({ ...current, fullName: event.target.value }))}
                placeholder="Имя пользователя"
              />
              <select
                value={inviteForm.role}
                onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}
              >
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="member">member</option>
              </select>
              <button type="button" onClick={inviteAccessUser} disabled={inviteAction}>
                {inviteAction ? 'Добавляем...' : 'Добавить доступ'}
              </button>
            </div>
            <div className={styles.accessTable}>
              <table>
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Email / login</th>
                    <th>Компания</th>
                    <th>Роль</th>
                    <th>Статус</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {userRows.length > 0 ? userRows.map((row, index) => {
                    const id = rowId(row)
                    const currentRole = cell(row.role ?? row.access_role ?? 'member')
                    return (
                      <tr key={`${id}-${index}`}>
                        <td>{cell(row.name ?? row.full_name ?? row.user_name ?? id)}</td>
                        <td>{cell(row.email ?? row.login)}</td>
                        <td>{cell(row.company_name ?? row.company_id)}</td>
                        <td>
                          <select value={currentRole} onChange={(event) => changeRole(row, event.target.value)} disabled={roleAction === id}>
                            <option value="owner">owner</option>
                            <option value="admin">admin</option>
                            <option value="member">member</option>
                          </select>
                        </td>
                        <td>{rowIsActive(row) ? 'Активен' : 'Отключен'}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.tableAction}
                            onClick={() => toggleUserStatus(row)}
                            disabled={statusAction === id}
                          >
                            {rowIsActive(row) ? 'Отключить' : 'Активировать'}
                          </button>
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan={6}>Пока нет записей доступа для выбранной компании.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && collectionDefs.map((collectionDef) => {
          const managedRows = managedRowsByPath[collectionDef.path] ?? []
          return (
            <div key={collectionDef.path} className={styles.managedPanel}>
              <div className={styles.runtimeHead}>
                <div>
                  <h3>{collectionDef.title}</h3>
                  <p>{collectionDef.description}</p>
                </div>
                <button type="button" onClick={() => addCollectionItem(collectionDef)}>
                  {collectionDef.addLabel}
                </button>
              </div>
              {managedRows.length > 0 ? (
                <div className={styles.managedGrid}>
                  {managedRows.map((row, rowIndex) => (
                    <article key={`${collectionDef.path}-${rowIndex}`} className={styles.managedCard}>
                      <div className={styles.managedCardHead}>
                        <strong>{cell(row.name ?? row.title ?? row.event ?? `${collectionDef.title} ${rowIndex + 1}`)}</strong>
                        <button type="button" onClick={() => removeCollectionItem(collectionDef, rowIndex)}>Удалить</button>
                      </div>
                      <div className={styles.managedFields}>
                        {collectionDef.fields.map((field) => {
                          const value = String(row[field.key] ?? '')
                          return (
                            <label key={field.key} className={field.type === 'textarea' ? styles.managedWide : ''}>
                              <span>{field.label}</span>
                              {field.type === 'select' ? (
                                <select value={value} onChange={(event) => updateCollectionItem(collectionDef, rowIndex, field.key, event.target.value)}>
                                  {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                              ) : field.type === 'textarea' ? (
                                <textarea value={value} rows={4} onChange={(event) => updateCollectionItem(collectionDef, rowIndex, field.key, event.target.value)} />
                              ) : (
                                <input value={value} onChange={(event) => updateCollectionItem(collectionDef, rowIndex, field.key, event.target.value)} />
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyManaged}>
                  <span>Пока нет записей.</span>
                  <button type="button" onClick={() => addCollectionItem(collectionDef)}>{collectionDef.addLabel}</button>
                </div>
              )}
            </div>
          )
        })}

        {!loading && (
          <div className={styles.formGrid}>
            {section.fields.map((field) => {
              const value = fieldValue(draft, field)
              return (
                <label key={field.path} className={field.type === 'textarea' ? styles.fullField : styles.field}>
                  <span className={styles.labelRow}>
                    <span>{field.label}</span>
                    {field.secret && <small>masked</small>}
                  </span>
                  {field.type === 'toggle' ? (
                    <button
                      type="button"
                      className={`${styles.switch} ${value ? styles.switchOn : ''}`}
                      onClick={() => updateField(field, !value)}
                      aria-pressed={Boolean(value)}
                    >
                      <span />
                    </button>
                  ) : field.type === 'select' ? (
                    <select value={String(value)} onChange={(event) => updateField(field, event.target.value)}>
                      <option value="">Не задано</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : field.type === 'slider' ? (
                    <div className={styles.sliderControl}>
                      <input
                        type="range"
                        min={field.min ?? 0}
                        max={field.max ?? 100}
                        step={field.step ?? 1}
                        value={String(value)}
                        onChange={(event) => updateField(field, event.target.value)}
                      />
                      <input
                        type="number"
                        min={field.min ?? 0}
                        max={field.max ?? 100}
                        step={field.step ?? 1}
                        value={String(value)}
                        onChange={(event) => updateField(field, event.target.value)}
                      />
                    </div>
                  ) : field.type === 'textarea' ? (
                    <textarea value={String(value)} onChange={(event) => updateField(field, event.target.value)} rows={7} />
                  ) : (
                    <input value={String(value)} onChange={(event) => updateField(field, event.target.value)} />
                  )}
                  {field.hint && <em>{field.hint}</em>}
                </label>
              )
            })}
          </div>
        )}

        <div className={styles.securityNote}>
          Секреты, webhook keys и OAuth tokens не выводятся в открытом виде. В этом экране редактируются только безопасные статусы и пользовательские параметры.
        </div>
      </section>
    </div>
  )
}
