import { useEffect, useMemo, useState } from 'react'
import { Bell, Bot, Building2, CheckCircle2, KeyRound, Link2, Megaphone, Package, Save, ShieldCheck, Target, Users } from 'lucide-react'
import { getConfig, getSettings, updateConfig, updateSettingsSection, type CompanyConfig } from '../api/n8n'
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

export function Settings({ initialSection }: SettingsProps = {}) {
  const [activeSection, setActiveSection] = useState(() => normalizeSectionId(initialSection))
  const [config, setConfig] = useState<CompanyConfig>({})
  const [draft, setDraft] = useState<CompanyConfig>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

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
