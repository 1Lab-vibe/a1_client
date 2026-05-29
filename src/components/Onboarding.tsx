import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Circle, Rocket, Save } from 'lucide-react'
import { getConfig, getSettings, updateConfig, updateSettingsSection, type CompanyConfig } from '../api/n8n'
import styles from './Onboarding.module.css'

const STEPS = [
  {
    id: 'profile',
    section: 'company',
    title: 'Профиль',
    description: 'Название, язык и часовой пояс компании.',
    paths: ['company.name', 'company.timezone', 'company.language'],
  },
  {
    id: 'channels',
    section: 'channels',
    title: 'Каналы',
    description: 'Включите web, Telegram или email.',
    paths: ['channels.web.enabled', 'channels.telegram.enabled', 'channels.email.enabled'],
  },
  {
    id: 'marketing',
    section: 'marketing',
    title: 'Маркетинг',
    description: 'Каналы, регионы, бюджет и базовый score для входящих лидов.',
    paths: ['marketing.positioning', 'marketing.primary_channels', 'marketing.target_regions', 'marketing.min_lead_score'],
  },
  {
    id: 'products',
    section: 'products',
    title: 'Продукты',
    description: 'Продуктовая матрица, главный оффер, цена и ограничения.',
    paths: ['products.primary', 'products.core_offer', 'products.price_range', 'products.usp'],
  },
  {
    id: 'icp',
    section: 'icp',
    title: 'ICP',
    description: 'Сегменты, отрасли, ЛПР и критерии fit score.',
    paths: ['icp.segments', 'icp.industries', 'icp.decision_makers', 'icp.min_fit_score'],
  },
  {
    id: 'crm',
    section: 'crm',
    title: 'CRM',
    description: 'Стадии лидов, сделок и обязательные поля.',
    paths: ['crm.lead_stages', 'crm.deal_stages', 'crm.required_fields'],
  },
  {
    id: 'security',
    section: 'security',
    title: 'Security',
    description: 'Webhook secret, age+SOAP и audit markers.',
    paths: ['security.webhook_secret_status', 'security.keys_encryption', 'security.audit_enabled'],
  },
]

const FIELD_LABELS: Record<string, string> = {
  'company.name': 'Название компании',
  'company.timezone': 'Часовой пояс',
  'company.language': 'Язык',
  'channels.web.enabled': 'Web-client',
  'channels.telegram.enabled': 'Telegram',
  'channels.email.enabled': 'Email',
  'marketing.positioning': 'Позиционирование',
  'marketing.primary_channels': 'Каналы привлечения',
  'marketing.target_regions': 'Целевые регионы',
  'marketing.min_lead_score': 'Минимальный score лида',
  'products.primary': 'Основные продукты',
  'products.core_offer': 'Главный оффер',
  'products.price_range': 'Диапазон цен',
  'products.usp': 'УТП',
  'icp.segments': 'Сегменты',
  'icp.industries': 'Отрасли',
  'icp.decision_makers': 'ЛПР',
  'icp.min_fit_score': 'Минимальный fit score',
  'crm.lead_stages': 'Стадии лидов',
  'crm.deal_stages': 'Стадии сделок',
  'crm.required_fields': 'Обязательные поля',
  'security.webhook_secret_status': 'Webhook secret',
  'security.keys_encryption': 'Шифрование ключей',
  'security.audit_enabled': 'Audit включен',
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
    const existing = current[part]
    current[part] = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...(existing as Record<string, unknown>) } : {}
    current = current[part] as Record<string, unknown>
  })
  current[parts[parts.length - 1]] = value
  return next
}

function sectionValue(config: CompanyConfig, sectionId: string): Record<string, unknown> {
  const value = getPath(config, sectionId)
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function completion(config: CompanyConfig, paths: string[]): number {
  const done = paths.filter((path) => {
    const value = getPath(config, path)
    if (typeof value === 'boolean') return value
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && String(value).trim() !== ''
  }).length
  return Math.round((done / paths.length) * 100)
}

export function Onboarding() {
  const [active, setActive] = useState(STEPS[0].id)
  const [config, setConfig] = useState<CompanyConfig>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    getSettings()
      .catch(() => getConfig())
      .then(setConfig)
      .finally(() => setLoading(false))
  }, [])

  const activeStep = useMemo(() => STEPS.find((step) => step.id === active) ?? STEPS[0], [active])
  const total = useMemo(() => Math.round(STEPS.reduce((sum, step) => sum + completion(config, step.paths), 0) / STEPS.length), [config])

  const update = (path: string, value: string | boolean | number) => {
    setConfig((current) => setPath(current, path, value))
  }

  const save = () => {
    const patch = sectionValue(config, activeStep.section)
    setSaving(true)
    setMessage(null)
    updateSettingsSection(activeStep.section, patch)
      .catch(() => updateConfig(config))
      .then((updated) => {
        setConfig(updated && Object.keys(updated).length > 0 ? updated : config)
        setMessage('Онбординг сохранен')
      })
      .catch(() => setMessage('Не удалось сохранить онбординг'))
      .finally(() => setSaving(false))
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <div>
          <Rocket aria-hidden />
          <h2>Готовность компании к запуску</h2>
          <p>Проверьте ключевые настройки перед прод-работой: профиль, каналы, CRM и security.</p>
        </div>
        <div className={styles.progress}>
          <strong>{loading ? '...' : `${total}%`}</strong>
          <span>готово</span>
        </div>
      </section>

      <div className={styles.grid}>
        <aside className={styles.steps}>
          {STEPS.map((step) => {
            const percent = completion(config, step.paths)
            const done = percent === 100
            return (
              <button
                key={step.id}
                type="button"
                className={step.id === active ? styles.active : ''}
                onClick={() => setActive(step.id)}
              >
                {done ? <CheckCircle2 aria-hidden /> : <Circle aria-hidden />}
                <span>
                  <strong>{step.title}</strong>
                  <small>{percent}%</small>
                </span>
              </button>
            )
          })}
        </aside>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h3>{activeStep.title}</h3>
              <p>{activeStep.description}</p>
            </div>
            <button type="button" onClick={save} disabled={saving || loading}>
              <Save aria-hidden />
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>

          {message && <div className={styles.message}>{message}</div>}

          <div className={styles.fields}>
            {activeStep.paths.map((path) => {
              const value = getPath(config, path)
              const isBool = typeof value === 'boolean' || path.endsWith('.enabled') || path.endsWith('audit_enabled')
              const isScore = path.endsWith('_score')
              return (
                <label key={path}>
                  <span>{FIELD_LABELS[path] ?? path.replace(/\./g, ' / ')}</span>
                  {isBool ? (
                    <button
                      type="button"
                      className={`${styles.switch} ${Boolean(value) ? styles.switchOn : ''}`}
                      onClick={() => update(path, !Boolean(value))}
                      aria-pressed={Boolean(value)}
                    >
                      <span />
                    </button>
                  ) : isScore ? (
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={Number.isFinite(Number(value)) ? Number(value) : 0}
                      onChange={(event) => update(path, Number(event.target.value))}
                    />
                  ) : (
                    <input
                      value={Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value)}
                      onChange={(event) => update(path, event.target.value)}
                    />
                  )}
                </label>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
