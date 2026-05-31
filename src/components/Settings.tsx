import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Bell, Bot, Building2, CheckCircle2, CreditCard, KeyRound, Link2, Megaphone, Package, PlugZap, RefreshCw, Save, ShieldCheck, Target, Users, XCircle } from 'lucide-react'
import {
  changeOwnPassword,
  getConfig,
  getIntegrations,
  getSettings,
  getSettingsDomain,
  getUsersAndPermissions,
  inviteUser,
  startIntegrationConnect,
  testIntegration,
  updateConfig,
  updateSettingsRecord,
  updateSettingsSection,
  updateUserRole,
  updateUserStatus,
  type SettingsDomainData,
  type CompanyConfig,
} from '../api/n8n'
import { getSession } from '../session'
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
  family: string
  status: string
  health: string
  authMode: string
  entities: string
  lastConnected: string
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

type RealFieldType = 'text' | 'textarea' | 'number' | 'select' | 'toggle' | 'tags' | 'json'

interface RealFieldDef {
  key: string
  label: string
  type?: RealFieldType
  options?: string[]
  optionLabels?: Record<string, string>
  readonly?: boolean
  required?: boolean
}

interface RealCollectionDef {
  key: string
  title: string
  description: string
  mode?: 'single' | 'list'
  labelKey: string
  subLabelKey?: string
  fields: RealFieldDef[]
  emptyItem?: DataRow
}

type SubscriptionTab = 'current' | 'plans' | 'billing' | 'admin'

const A1_ADMIN_USER = '1lab@1true.ru'

const HIDDEN_REAL_FIELD_RE = /(^id$|_id$|company_id|metadata|meta|settings|attributes|variants|source_limits|capabilities|access_summary|provider_payment_id|payment_url|payload|raw|secret|token|password|webhook|n8n|system)/i

const DOMAIN_COLLECTIONS: Record<string, RealCollectionDef[]> = {
  company: [
    {
      key: 'company_profile',
      title: 'Профиль компании',
      description: 'Данные из a1_companies: реквизиты, бренд, контакты, адреса и статус.',
      mode: 'single',
      labelKey: 'display_name',
      subLabelKey: 'inn',
      fields: [
        { key: 'display_name', label: 'Название в интерфейсе' },
        { key: 'brand_name', label: 'Бренд' },
        { key: 'full_name', label: 'Юр. название', type: 'textarea' },
        { key: 'inn', label: 'ИНН', readonly: true },
        { key: 'ogrn', label: 'ОГРН', readonly: true },
        { key: 'kpp', label: 'КПП' },
        { key: 'industry', label: 'Отрасль' },
        { key: 'primary_email', label: 'Email' },
        { key: 'primary_phone', label: 'Телефон' },
        { key: 'website', label: 'Сайт' },
        { key: 'domain', label: 'Домен' },
        { key: 'city', label: 'Город' },
        { key: 'region', label: 'Регион' },
        { key: 'legal_address', label: 'Юр. адрес', type: 'textarea' },
        { key: 'signer_name', label: 'Подписант' },
        { key: 'signer_title', label: 'Должность подписанта' },
        { key: 'signer_basis', label: 'Основание' },
        { key: 'bank_name', label: 'Банк' },
        { key: 'bik', label: 'БИК' },
        { key: 'bank_account', label: 'Расчетный счет' },
        { key: 'corr_account', label: 'Корр. счет' },
        { key: 'status', label: 'Статус', type: 'select', options: ['active', 'inactive', 'liquidation', 'liquidated', 'unknown'] },
      ],
    },
    {
      key: 'legal_entities',
      title: 'Юрлица',
      description: 'Юридические лица тенант-компании: реквизиты, банк, адреса и основная организация для документов.',
      labelKey: 'entity_name',
      subLabelKey: 'inn',
      emptyItem: { entity_code: '', entity_name: '', entity_type: 'ooo', is_default: false, is_active: true, account_currency: 'RUB' },
      fields: [
        { key: 'entity_name', label: 'Название', required: true },
        { key: 'entity_code', label: 'Код юрлица', required: true },
        {
          key: 'entity_type',
          label: 'Тип',
          type: 'select',
          options: ['ooo', 'ip', 'ao', 'zao', 'pao', 'self_employed', 'foreign_company'],
          optionLabels: {
            ooo: 'ООО',
            ip: 'ИП',
            ao: 'АО',
            zao: 'ЗАО',
            pao: 'ПАО',
            self_employed: 'Самозанятый',
            foreign_company: 'Иностранная компания',
          },
          required: true,
        },
        { key: 'is_default', label: 'Основное юрлицо', type: 'toggle' },
        { key: 'is_active', label: 'Активно', type: 'toggle' },
        { key: 'short_name', label: 'Краткое название' },
        { key: 'full_name', label: 'Полное название', type: 'textarea' },
        { key: 'inn', label: 'ИНН' },
        { key: 'kpp', label: 'КПП' },
        { key: 'ogrn', label: 'ОГРН' },
        { key: 'ogrnip', label: 'ОГРНИП' },
        { key: 'okpo', label: 'ОКПО' },
        { key: 'signer_name', label: 'Подписант' },
        { key: 'signer_title', label: 'Должность подписанта' },
        { key: 'signer_basis', label: 'Основание подписи' },
        { key: 'bank_name', label: 'Банк' },
        { key: 'bik', label: 'БИК' },
        { key: 'account_number', label: 'Расчетный счет' },
        { key: 'corr_account', label: 'Корр. счет' },
        { key: 'account_currency', label: 'Валюта счета', type: 'select', options: ['RUB', 'USD', 'EUR'] },
        { key: 'legal_address', label: 'Юридический адрес', type: 'textarea' },
        { key: 'postal_address', label: 'Почтовый адрес', type: 'textarea' },
        { key: 'bank_address', label: 'Адрес банка', type: 'textarea' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Телефон' },
      ],
    },
  ],
  marketing: [
    {
      key: 'marketing_runtime',
      title: 'Runtime-маркетинг',
      description: 'a1_marketing_runtime_config: автономность, бюджеты, Direct, источники и legal/footer.',
      mode: 'single',
      labelKey: 'name',
      subLabelKey: 'status',
      fields: [
        { key: 'status', label: 'Статус', type: 'select', options: ['draft', 'active', 'paused', 'archived'] },
        { key: 'leadgen_enabled', label: 'Лидогенерация', type: 'toggle' },
        { key: 'leadgen_autonomy_level', label: 'Автономность', type: 'select', options: ['manual', 'approval', 'autonomous_task_queue'] },
        { key: 'outbound_mode', label: 'Outbound mode', type: 'select', options: ['manual', 'approval', 'autonomous_task_queue'] },
        { key: 'allow_autonomous_cold_email', label: 'Авто cold email', type: 'toggle' },
        { key: 'allow_paid_sources', label: 'Платные источники', type: 'toggle' },
        { key: 'max_leads_per_run', label: 'Лидов за запуск', type: 'number' },
        { key: 'max_source_requests_per_run', label: 'Запросов к источникам', type: 'number' },
        { key: 'min_priority_score', label: 'Мин. priority score', type: 'number' },
        { key: 'min_email_confidence', label: 'Мин. confidence email', type: 'number' },
        { key: 'follow_up_after_hours', label: 'Follow-up, часов', type: 'number' },
        { key: 'media_plan_enabled', label: 'Медиаплан', type: 'toggle' },
        { key: 'media_budget_total_rub', label: 'Медиа бюджет', type: 'number' },
        { key: 'yandex_direct_enabled', label: 'Yandex Direct', type: 'toggle' },
        { key: 'yandex_direct_publish_allowed', label: 'Публикация Direct', type: 'toggle' },
        { key: 'direct_monthly_budget_cap_rub', label: 'Лимит Direct / месяц', type: 'number' },
        { key: 'brand_name', label: 'Бренд' },
        { key: 'sender_name', label: 'Отправитель' },
        { key: 'sender_title', label: 'Должность' },
        { key: 'default_landing_url', label: 'Landing URL' },
        { key: 'privacy_url', label: 'Privacy URL' },
        { key: 'legal_footer_text', label: 'Юр. футер', type: 'textarea' },
        { key: 'default_source_order', label: 'Порядок источников', type: 'tags' },
        { key: 'media_plan_channel_keys', label: 'Каналы медиаплана', type: 'tags' },
        { key: 'direct_channel_keys', label: 'Каналы Direct', type: 'tags' },
        { key: 'protected_terms', label: 'Защищенные слова', type: 'tags' },
        { key: 'negative_terms', label: 'Минус-слова', type: 'tags' },
        { key: 'notes', label: 'Заметки', type: 'textarea' },
      ],
    },
    {
      key: 'geo_targets',
      title: 'География',
      description: 'a1_marketing_geo_targets: регионы для leadgen и paid ads.',
      labelKey: 'display_name',
      subLabelKey: 'geo_key',
      emptyItem: { geo_key: '', display_name: '', country_code: 'RU', priority: 100, is_active: true, include_in_leadgen: true, include_in_paid_ads: true },
      fields: [
        { key: 'geo_key', label: 'Ключ', required: true },
        { key: 'display_name', label: 'Название', required: true },
        { key: 'country_code', label: 'Страна' },
        { key: 'region_name', label: 'Регион' },
        { key: 'city_name', label: 'Город' },
        { key: 'aliases', label: 'Алиасы', type: 'tags' },
        { key: 'hh_area_id', label: 'HH area' },
        { key: 'yandex_region_id', label: 'Yandex region' },
        { key: 'priority', label: 'Приоритет', type: 'number' },
        { key: 'is_active', label: 'Активен', type: 'toggle' },
        { key: 'include_in_leadgen', label: 'Leadgen', type: 'toggle' },
        { key: 'include_in_paid_ads', label: 'Paid ads', type: 'toggle' },
      ],
    },
  ],
  products: [
    {
      key: 'products',
      title: 'Продукты / услуги',
      description: 'a1_products: карточки продуктовой матрицы, цены, фичи и лендинги.',
      labelKey: 'name',
      subLabelKey: 'sku',
      emptyItem: { sku: '', name: '', is_active: true, price_currency: 'RUB', priority: 100, deliverables: [], features: [], tags: [], search_aliases: [], attributes: {} },
      fields: [
        { key: 'sku', label: 'SKU', required: true },
        { key: 'name', label: 'Название', required: true },
        { key: 'is_active', label: 'Активен', type: 'toggle' },
        { key: 'product_type', label: 'Тип', type: 'select', options: ['subscription', 'service', 'consulting', 'ai_product', 'custom', 'platform', 'integration', 'agent_bot', 'other'] },
        { key: 'category', label: 'Категория' },
        { key: 'description', label: 'Описание', type: 'textarea' },
        { key: 'price_amount', label: 'Цена', type: 'number' },
        { key: 'price_currency', label: 'Валюта', type: 'select', options: ['RUB', 'USD', 'EUR'] },
        { key: 'billing_period', label: 'Период', type: 'select', options: ['one_time', 'month', 'quarter', 'year', 'usage'] },
        { key: 'setup_fee', label: 'Setup fee', type: 'number' },
        { key: 'trial_days', label: 'Trial дней', type: 'number' },
        { key: 'deliverables', label: 'Результаты', type: 'tags' },
        { key: 'features', label: 'Фичи', type: 'tags' },
        { key: 'target_audience', label: 'ЦА', type: 'textarea' },
        { key: 'cta_text', label: 'CTA' },
        { key: 'landing_url', label: 'Landing URL' },
        { key: 'priority', label: 'Приоритет', type: 'number' },
        { key: 'tags', label: 'Теги', type: 'tags' },
        { key: 'search_aliases', label: 'Поисковые алиасы', type: 'tags' },
        { key: 'measurement_unit', label: 'Ед. измерения' },
        { key: 'attributes', label: 'Атрибуты JSON', type: 'json' },
      ],
    },
    {
      key: 'marketing_products',
      title: 'Маркетинговый каталог',
      description: 'a1_marketing_products_catalog: value proposition, ICP, topics, economics и категории рекламы.',
      labelKey: 'name',
      subLabelKey: 'product_key',
      emptyItem: { product_key: '', name: '', type: 'service', primary_landing_url: 'https://1lab.one', active: true, product_category: 'subscription_mid', business_priority: 5, seed_topics: [], forbidden_topics: [], variants: [] },
      fields: [
        { key: 'product_key', label: 'Product key', required: true },
        { key: 'name', label: 'Название', required: true },
        { key: 'short_name', label: 'Короткое имя' },
        { key: 'type', label: 'Тип', type: 'select', options: ['saas', 'service', 'consulting', 'ai_product', 'custom', 'platform'] },
        { key: 'value_proposition', label: 'Ценность', type: 'textarea' },
        { key: 'target_audience', label: 'ЦА', type: 'textarea' },
        { key: 'primary_landing_url', label: 'Landing URL', required: true },
        { key: 'estimated_avg_order_value_rub', label: 'AOV', type: 'number' },
        { key: 'estimated_sales_cycle_days', label: 'Цикл сделки дней', type: 'number' },
        { key: 'gross_margin_pct', label: 'Маржа', type: 'number' },
        { key: 'expected_lead_to_deal_pct', label: 'Lead→deal', type: 'number' },
        { key: 'expected_click_to_lead_pct', label: 'Click→lead', type: 'number' },
        { key: 'business_priority', label: 'Приоритет', type: 'number' },
        { key: 'seed_topics', label: 'Seed topics', type: 'tags' },
        { key: 'forbidden_topics', label: 'Forbidden topics', type: 'tags' },
        { key: 'variants', label: 'Варианты JSON', type: 'json' },
        { key: 'active', label: 'Активен', type: 'toggle' },
        { key: 'product_category', label: 'Категория', type: 'select', options: ['enterprise_saas', 'custom_dev', 'subscription_mid', 'b2c_service', 'other'] },
        { key: 'ad_category_key', label: 'Ad category', type: 'select', options: ['', 'enterprise_saas', 'enterprise_onprem_deployment', 'b2b_integration_project', 'subscription_mid', 'subscription_low_selfserve', 'custom_dev_fast', 'custom_dev_complex', 'lead_magnet_discovery', 'addon_cross_sell', 'b2c_service_local', 'b2c_ecommerce_resale', 'b2b_professional_service', 'b2b_commodity_trade', 'info_education_content', 'managed_b2b_service'] },
        { key: 'notes', label: 'Заметки', type: 'textarea' },
      ],
    },
  ],
  icp: [
    {
      key: 'icp_configs',
      title: 'ICP по категориям',
      description: 'a1_marketing_category_icp_config: сегменты, источники, фразы, боли и scoring thresholds.',
      labelKey: 'display_name',
      subLabelKey: 'icp_key',
      emptyItem: { icp_key: '', display_name: '', status: 'active', segment: 'b2b', priority: 100, source_order: [], seed_phrases: [], target_industries: [], min_priority_score: 0.55, source_limits: {} },
      fields: [
        { key: 'icp_key', label: 'ICP key', required: true },
        { key: 'display_name', label: 'Название', required: true },
        { key: 'status', label: 'Статус', type: 'select', options: ['draft', 'active', 'paused', 'archived'] },
        { key: 'segment', label: 'Сегмент', type: 'select', options: ['b2b', 'b2c'] },
        { key: 'priority', label: 'Приоритет', type: 'number' },
        { key: 'product_key', label: 'Product key' },
        { key: 'product_category', label: 'Категория продукта' },
        { key: 'ad_category_key', label: 'Ad category' },
        { key: 'source_order', label: 'Порядок источников', type: 'tags' },
        { key: 'seed_phrases', label: 'Seed-фразы', type: 'tags' },
        { key: 'search_phrase_templates', label: 'Шаблоны поиска', type: 'tags' },
        { key: 'excluded_phrases', label: 'Исключения', type: 'tags' },
        { key: 'buyer_personas', label: 'Персоны', type: 'tags' },
        { key: 'target_industries', label: 'Отрасли', type: 'tags' },
        { key: 'target_okved', label: 'ОКВЭД', type: 'tags' },
        { key: 'trigger_signals', label: 'Триггеры', type: 'tags' },
        { key: 'pain_signals', label: 'Боли', type: 'tags' },
        { key: 'offer_pitch', label: 'Оффер', type: 'textarea' },
        { key: 'landing_url', label: 'Landing URL' },
        { key: 'outreach_subject_template', label: 'Тема outreach' },
        { key: 'outreach_body_template', label: 'Тело outreach', type: 'textarea' },
        { key: 'min_priority_score', label: 'Мин. score', type: 'number' },
        { key: 'source_limits', label: 'Лимиты источников JSON', type: 'json' },
      ],
    },
  ],
  channels: [
    {
      key: 'public_channels',
      title: 'Публичные каналы',
      description: 'a1_public_concierge_channels: Telegram/webhook канал без вывода секретов.',
      labelKey: 'gateway_name',
      subLabelKey: 'channel_key',
      fields: [
        { key: 'channel_key', label: 'Channel key', readonly: true },
        { key: 'gateway_key', label: 'Gateway', readonly: true },
        { key: 'source_bot_key', label: 'Bot key', readonly: true },
        { key: 'gateway_name', label: 'Название' },
        { key: 'bot_username', label: 'Username' },
        { key: 'bot_display_name', label: 'Display name' },
        { key: 'is_active', label: 'Активен', type: 'toggle' },
        { key: 'default_language', label: 'Язык', type: 'select', options: ['ru', 'en'] },
        { key: 'timezone', label: 'Часовой пояс' },
        { key: 'setup_status', label: 'Setup', type: 'select', options: ['not_configured', 'pending', 'configured', 'failed'] },
        { key: 'webhook_status', label: 'Webhook', type: 'select', options: ['unknown', 'missing', 'configured', 'failed'] },
        { key: 'token_status', label: 'Token', type: 'select', options: ['missing', 'configured', 'rotation_required'] },
        { key: 'settings', label: 'Settings JSON', type: 'json' },
      ],
    },
    {
      key: 'marketing_sites',
      title: 'Сайты / лендинги',
      description: 'a1_marketing_sites: лендинги и активность для маркетинга.',
      labelKey: 'base_url',
      subLabelKey: 'site_key',
      emptyItem: { site_key: '', base_url: 'https://1lab.one', name: '', is_active: true, metadata: {} },
      fields: [
        { key: 'site_key', label: 'Site key', required: true },
        { key: 'base_url', label: 'Base URL', required: true },
        { key: 'name', label: 'Название' },
        { key: 'is_active', label: 'Активен', type: 'toggle' },
        { key: 'metadata', label: 'Metadata JSON', type: 'json' },
      ],
    },
  ],
  handlers: [
    {
      key: 'handlers',
      title: 'Action handlers',
      description: 'a1_action_handlers: включение режимов, workflow refs, approval и риск.',
      labelKey: 'action_key',
      subLabelKey: 'domain',
      fields: [
        { key: 'action_key', label: 'Action key', readonly: true },
        { key: 'action_name', label: 'Название' },
        { key: 'description', label: 'Описание', type: 'textarea' },
        { key: 'domain', label: 'Домен', type: 'select', options: ['sales', 'marketing', 'finance', 'legal', 'hr', 'it', 'ops', 'coo', 'reports', 'support'] },
        { key: 'handler_type', label: 'Тип', type: 'select', options: ['workflow', 'tool', 'api', 'manual'] },
        { key: 'handler_ref', label: 'Ref' },
        { key: 'workflow_id', label: 'Workflow ID' },
        { key: 'enabled', label: 'Включен', type: 'toggle' },
        { key: 'priority', label: 'Приоритет', type: 'number' },
        { key: 'risk_level', label: 'Риск', type: 'select', options: ['', 'low', 'medium', 'high', 'critical'] },
        { key: 'requires_human_approval', label: 'Approval', type: 'toggle' },
        { key: 'run_only_in_work_hours', label: 'Только рабочее время', type: 'toggle' },
        { key: 'default_timeout_sec', label: 'Timeout сек', type: 'number' },
        { key: 'retry_policy', label: 'Retry JSON', type: 'json' },
        { key: 'meta', label: 'Meta JSON', type: 'json' },
      ],
    },
  ],
  dashboard: [
    {
      key: 'dashboard_config',
      title: 'Конфигурация дашборда',
      description: 'Настройки виджетов, KPI и отчетов для пользовательского дашборда.',
      mode: 'single',
      labelKey: 'name',
      subLabelKey: 'template',
      emptyItem: {
        name: 'Свой дашборд',
        template: 'custom',
        period_default: '30d',
        enabled_widgets: ['kpis', 'timeline', 'breakdown', 'recent_activity'],
        kpi_keys: ['leads', 'deals', 'customers', 'messages', 'tasks'],
        report_ids: ['sales_funnel', 'ops_sla'],
      },
      fields: [
        { key: 'name', label: 'Название' },
        { key: 'template', label: 'Шаблон', type: 'select', options: ['default', 'sales', 'ops', 'custom'] },
        { key: 'period_default', label: 'Период по умолчанию', type: 'select', options: ['today', '7d', '30d', 'month', 'quarter'] },
        { key: 'enabled_widgets', label: 'Виджеты', type: 'tags' },
        { key: 'kpi_keys', label: 'KPI', type: 'tags' },
        { key: 'report_ids', label: 'Отчеты', type: 'tags' },
        { key: 'layout', label: 'Layout JSON', type: 'json' },
      ],
    },
  ],
  subscription: [
    {
      key: 'subscription_access',
      title: 'Активная подписка',
      description: 'a1_subscription_access: статус доступа, тариф, сроки trial/paid и payment URL.',
      mode: 'single',
      labelKey: 'access_status',
      subLabelKey: 'plan_code',
      fields: [
        { key: 'user_id', label: 'User ID / account' },
        { key: 'access_status', label: 'Статус', type: 'select', options: ['active', 'trial_active', 'paid_test_active', 'expired', 'cancelled', 'blocked'] },
        { key: 'plan_code', label: 'Тариф', type: 'select', options: ['admin_internal', 'demo', 'assistant_pro_month', 'assistant_pro_year'] },
        { key: 'trial_starts_at', label: 'Trial start' },
        { key: 'trial_ends_at', label: 'Trial end' },
        { key: 'paid_test_starts_at', label: 'Paid test start' },
        { key: 'paid_test_ends_at', label: 'Paid test end' },
        { key: 'paid_subscription_starts_at', label: 'Subscription start' },
        { key: 'paid_subscription_ends_at', label: 'Subscription end' },
      ],
    },
    {
      key: 'subscription_plans',
      title: 'Тарифы',
      description: 'Доступные тарифы для покупки и продления.',
      labelKey: 'name',
      subLabelKey: 'plan_code',
      fields: [
        { key: 'name', label: 'Название', readonly: true },
        { key: 'billing_period', label: 'Период', readonly: true },
        { key: 'price_amount', label: 'Цена', type: 'number', readonly: true },
        { key: 'currency', label: 'Валюта', readonly: true },
        { key: 'is_active', label: 'Активен', type: 'toggle', readonly: true },
      ],
    },
    {
      key: 'billing_events',
      title: 'История биллинга',
      description: 'История оплат, активаций и продлений для выбранной компании.',
      labelKey: 'status',
      subLabelKey: 'provider',
      fields: [
        { key: 'status', label: 'Статус', readonly: true },
        { key: 'amount', label: 'Сумма', type: 'number', readonly: true },
        { key: 'currency', label: 'Валюта', readonly: true },
        { key: 'created_at', label: 'Создано', readonly: true },
      ],
    },
    {
      key: 'payments',
      title: 'Платежи',
      description: 'Созданные платежи и статусы оплаты.',
      labelKey: 'status',
      subLabelKey: 'plan_code',
      fields: [
        { key: 'payment_type', label: 'Тип', readonly: true },
        { key: 'plan_code', label: 'Тариф', readonly: true },
        { key: 'amount', label: 'Сумма', type: 'number', readonly: true },
        { key: 'currency', label: 'Валюта', readonly: true },
        { key: 'status', label: 'Статус', readonly: true },
        { key: 'paid_at', label: 'Оплачено', readonly: true },
      ],
    },
  ],
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
    id: 'dashboard',
    title: 'Дашборд',
    description: 'Свой дашборд: набор виджетов, KPI, отчетов и период по умолчанию.',
    icon: BarChart3,
    fields: [],
  },
  {
    id: 'subscription',
    title: 'Подписка',
    description: 'Активная подписка, тариф, сроки доступа и история платежей.',
    icon: CreditCard,
    fields: [],
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
        family: cell(row.family ?? row.provider_family),
        status: cell(row.status ?? row.connection_status ?? 'unknown'),
        health: cell(row.health ?? row.health_status ?? row.ok),
        authMode: cell(row.auth_mode ?? row.authMode ?? (Array.isArray(row.auth_modes) ? row.auth_modes[0] : undefined)),
        entities: Array.isArray(row.supported_entities) ? row.supported_entities.join(', ') : cell(row.supported_entities ?? row.entities),
        lastConnected: cell(row.last_connected_at ?? row.lastConnectedAt),
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
      family: cell(record.family ?? record.provider_family ?? 'custom'),
      status: cell(record.status ?? 'unknown'),
      health: cell(record.health ?? record.ok ?? '-'),
      authMode: cell(record.auth_mode ?? record.authMode ?? '-'),
      entities: cell(record.supported_entities ?? record.entities ?? '-'),
      lastConnected: cell(record.last_connected_at),
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

function realRows(data: SettingsDomainData | null, key: string): DataRow[] {
  return data?.collections?.[key]?.rows?.filter((row): row is DataRow => !!row && typeof row === 'object' && !Array.isArray(row)) ?? []
}

function realVisibleFields(def: RealCollectionDef): RealFieldDef[] {
  return def.fields.filter((field) => {
    if (field.type === 'json') return false
    if (HIDDEN_REAL_FIELD_RE.test(field.key)) return false
    if (/json|provider payment|payment url|payload|system/i.test(field.label)) return false
    return true
  })
}

function realLabel(row: DataRow, def: RealCollectionDef): string {
  return cell(row[def.labelKey] ?? row.name ?? row.title ?? row.id ?? 'Новая запись')
}

function realSubLabel(row: DataRow, def: RealCollectionDef): string {
  return cell((def.subLabelKey ? row[def.subLabelKey] : undefined) ?? row.status ?? row.updated_at ?? '')
}

function valueToInput(value: unknown, type?: RealFieldType): string {
  if (value === null || value === undefined) return ''
  if (type === 'tags' && Array.isArray(value)) return value.join('\n')
  if (type === 'json') return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function parseRealValue(raw: string | boolean, field: RealFieldDef): unknown {
  if (field.type === 'toggle') return Boolean(raw)
  if (field.type === 'number') {
    const n = Number(String(raw).replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  if (field.type === 'tags') {
    return String(raw).split(/[\n,;]/).map((item) => item.trim()).filter(Boolean)
  }
  if (field.type === 'json') {
    try {
      return JSON.parse(String(raw || 'null'))
    } catch {
      return raw
    }
  }
  return raw === '' ? null : raw
}

function optionLabel(field: RealFieldDef, option: string): string {
  return field.optionLabels?.[option] ?? option
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) return parsed.map((item) => String(item)).filter(Boolean)
    } catch {
      // plain text list
    }
    return trimmed.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(value) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
      // ignore invalid JSON from legacy rows
    }
  }
  return {}
}

function formatDate(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return 'не задано'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10).split('-').reverse().join('-')
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date).replace(/\./g, '-')
}

function dateInputValue(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function formatMoney(amount: unknown, currency: unknown, period?: unknown): string {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return 'по запросу'
  const suffix = String(currency || 'RUB').toUpperCase() === 'RUB' ? '₽' : String(currency || '')
  const periodText = String(period || '') === 'year' ? ' / год' : String(period || '') === 'month' ? ' / месяц' : ''
  return `${new Intl.NumberFormat('ru-RU').format(n)} ${suffix}${periodText}`
}

function subscriptionStatusLabel(value: unknown): string {
  const status = String(value || '').toLowerCase()
  if (['active', 'paid_active', 'subscription_active', 'paid_subscription_active'].includes(status)) return 'Активна'
  if (status.includes('trial')) return 'Пробный доступ'
  if (['expired', 'cancelled', 'blocked', 'revoked'].includes(status)) return 'Завершена'
  return status ? status : 'Нет активной подписки'
}

function planName(row: DataRow | null | undefined): string {
  return cell(row?.name ?? row?.plan_name ?? row?.title ?? 'Тариф не выбран')
}

function planDescription(row: DataRow | null | undefined): string {
  return cell(row?.description ?? row?.plan_description ?? row?.summary ?? 'Описание тарифа будет добавлено в карточку продукта.')
}

function planSku(row: DataRow | null | undefined): string {
  return cell(row?.sku ?? row?.plan_sku ?? row?.plan_code)
}

function isUiErrorMessage(value: string | null): boolean {
  return Boolean(value && /не удалось|выберите|нет прав|ошиб|не найден|нельзя|требуется/i.test(value))
}

function limitRows(row: DataRow | null | undefined): { label: string; value: string }[] {
  const limits = asObject(row?.limits)
  const map: Record<string, string> = {
    seats: 'Сотрудников',
    tasks_per_month: 'Задач в месяц',
    channels: 'Каналы',
    storage_gb: 'Место на диске',
    admins: 'Администраторов',
  }
  return Object.entries(limits).map(([key, value]) => ({
    label: map[key] || key.replace(/_/g, ' '),
    value: Array.isArray(value) ? value.join(', ') : String(value),
  }))
}

function findPlanBySku(plans: DataRow[], sku: string): DataRow | null {
  return plans.find((plan) => planSku(plan) === sku) ?? null
}

function activeUntil(row: DataRow | null | undefined): unknown {
  return row?.active_until ?? row?.paid_subscription_ends_at ?? row?.paid_test_ends_at ?? row?.trial_ends_at ?? row?.expires_at
}

function SubscriptionPanel({
  data,
  loading,
  error,
  onReload,
  isAdmin,
}: {
  data: SettingsDomainData | null
  loading: boolean
  error: string | null
  onReload: () => void
  isAdmin: boolean
}) {
  const [tab, setTab] = useState<SubscriptionTab>('current')
  const [selectedPlanSku, setSelectedPlanSku] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [adminPlanSku, setAdminPlanSku] = useState('')
  const [adminUntil, setAdminUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const currentRows = useMemo(() => {
    const rows = realRows(data, 'current_subscription')
    return rows.length ? rows : realRows(data, 'subscription_access')
  }, [data])
  const plans = useMemo(() => realRows(data, 'subscription_plans'), [data])
  const billing = useMemo(() => {
    const rows = realRows(data, 'billing_history')
    return rows.length ? rows : [...realRows(data, 'billing_events'), ...realRows(data, 'payments')]
  }, [data])
  const companies = useMemo(() => realRows(data, 'admin_companies'), [data])
  const current = currentRows[0] ?? null
  const activeSku = planSku(current)
  const selectedPlan = useMemo(() => findPlanBySku(plans, selectedPlanSku || activeSku) ?? plans[0] ?? null, [activeSku, plans, selectedPlanSku])
  const adminCompany = useMemo(
    () => companies.find((company) => cell(company.company_id ?? company.id) === selectedCompanyId) ?? companies[0] ?? null,
    [companies, selectedCompanyId],
  )

  useEffect(() => {
    if (!selectedPlanSku && (activeSku || plans[0])) setSelectedPlanSku(activeSku || planSku(plans[0]))
  }, [activeSku, plans, selectedPlanSku])

  useEffect(() => {
    if (!selectedCompanyId && companies[0]) setSelectedCompanyId(cell(companies[0].company_id ?? companies[0].id))
  }, [companies, selectedCompanyId])

  useEffect(() => {
    if (!adminCompany) return
    setAdminPlanSku(cell(adminCompany.active_plan_sku ?? adminCompany.plan_sku ?? adminCompany.plan_code ?? plans[0]?.sku ?? ''))
    setAdminUntil(dateInputValue(activeUntil(adminCompany)))
  }, [adminCompany, plans])

  const saveAdmin = (action: 'activate' | 'deactivate') => {
    if (!adminCompany) return
    setSaving(true)
    setMessage(null)
    updateSettingsRecord('subscription_admin', undefined, {
      action,
      company_id: cell(adminCompany.company_id ?? adminCompany.id),
      plan_sku: adminPlanSku,
      active_until: adminUntil,
    })
      .then(() => {
        setMessage(action === 'deactivate' ? 'Подписка деактивирована' : 'Подписка обновлена')
        onReload()
      })
      .catch((e) => setMessage(e instanceof Error ? e.message : 'Не удалось сохранить подписку'))
      .finally(() => setSaving(false))
  }

  if (loading) return <div className={styles.state}>Загружаем подписку...</div>
  if (error) return <div className={styles.error}>{error}</div>

  const tabs: { id: SubscriptionTab; label: string }[] = [
    { id: 'current', label: 'Текущий тариф' },
    { id: 'plans', label: 'Тарифы' },
    { id: 'billing', label: 'Биллинг' },
    ...(isAdmin ? [{ id: 'admin' as SubscriptionTab, label: 'Админ' }] : []),
  ]

  return (
    <div className={styles.subscriptionPanel}>
      <div className={styles.runtimeHead}>
        <div>
          <h3>Подписка A1</h3>
          <p>Статус доступа, тарифы и история оплат без служебных полей и секретов.</p>
        </div>
        <button type="button" onClick={onReload}>
          <RefreshCw aria-hidden />
          Обновить
        </button>
      </div>

      <div className={styles.subscriptionTabs}>
        {tabs.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? styles.subscriptionTabActive : ''} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {message && <div className={isUiErrorMessage(message) ? styles.error : styles.saved}>{message}</div>}

      {tab === 'current' && (
        <div className={styles.subscriptionGrid}>
          <section className={styles.subscriptionCard}>
            <span className={styles.subscriptionEyebrow}>Активная подписка</span>
            <h3>{planName(current || findPlanBySku(plans, activeSku))}</h3>
            <p>{planDescription(current || findPlanBySku(plans, activeSku))}</p>
            <div className={styles.subscriptionFacts}>
              <div><span>Статус</span><strong>{subscriptionStatusLabel(current?.access_status ?? current?.status)}</strong></div>
              <div><span>Активна до</span><strong>{formatDate(activeUntil(current))}</strong></div>
            </div>
          </section>
          <section className={styles.subscriptionCard}>
            <span className={styles.subscriptionEyebrow}>Что входит</span>
            <ul className={styles.featureList}>
              {asArray((current || findPlanBySku(plans, activeSku))?.features).slice(0, 8).map((feature) => <li key={feature}>{feature}</li>)}
              {asArray((current || findPlanBySku(plans, activeSku))?.features).length === 0 && <li>Состав тарифа подтянется из карточки продукта A1.</li>}
            </ul>
          </section>
        </div>
      )}

      {tab === 'plans' && (
        <div className={styles.recordWorkbench}>
          <aside className={styles.recordList}>
            <div className={styles.recordListHead}><strong>Тарифы</strong></div>
            {plans.map((plan) => {
              const sku = planSku(plan)
              const active = sku && sku === activeSku
              return (
                <button key={sku || planName(plan)} type="button" className={sku === planSku(selectedPlan) ? styles.recordActive : ''} onClick={() => setSelectedPlanSku(sku)}>
                  <strong>{active ? '✓ ' : ''}{planName(plan)}</strong>
                  <span>{formatMoney(plan.price_amount, plan.price_currency, plan.billing_period)}</span>
                </button>
              )
            })}
            {plans.length === 0 && <div className={styles.recordEmpty}>Тарифы не найдены</div>}
          </aside>
          <section className={styles.subscriptionCard}>
            <span className={styles.subscriptionEyebrow}>{planSku(selectedPlan) === activeSku ? 'Ваш тариф' : 'Доступный тариф'}</span>
            <h3>{planName(selectedPlan)}</h3>
            <p>{planDescription(selectedPlan)}</p>
            <div className={styles.priceLine}>{formatMoney(selectedPlan?.price_amount, selectedPlan?.price_currency, selectedPlan?.billing_period)}</div>
            <ul className={styles.featureList}>
              {asArray(selectedPlan?.features).map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <div className={styles.limitGrid}>
              {limitRows(selectedPlan).map((limit) => <div key={limit.label}><span>{limit.label}</span><strong>{limit.value}</strong></div>)}
            </div>
            <div className={styles.subscriptionActions}>
              <button type="button" className={styles.saveBtn} onClick={() => setMessage('Форма оплаты на месяц будет подключена следующим шагом.')}>
                <CreditCard aria-hidden />
                Оплатить месяц
              </button>
              <button type="button" className={styles.saveBtn} onClick={() => setMessage('Годовая оплата будет подключена следующим шагом.')}>
                <CreditCard aria-hidden />
                Оплатить год
              </button>
            </div>
          </section>
        </div>
      )}

      {tab === 'billing' && (
        <div className={styles.billingList}>
          {billing.map((item, index) => (
            <article key={cell(item.id ?? index)} className={styles.billingItem}>
              <div>
                <strong>{cell(item.title ?? item.operation ?? item.payment_type ?? 'Операция по подписке')}</strong>
                <span>{cell(item.details ?? item.status ?? 'Статус операции обновлен')}</span>
              </div>
              <div><span>Дата</span><strong>{formatDate(item.date ?? item.created_at ?? item.paid_at)}</strong></div>
              <div><span>Сумма</span><strong>{formatMoney(item.amount, item.currency, '')}</strong></div>
              <div><span>Чек</span><strong>{cell(item.receipt ?? item.receipt_url ?? item.invoice_id ?? 'нет')}</strong></div>
            </article>
          ))}
          {billing.length === 0 && <div className={styles.recordEmpty}>Оплат и грантов пока нет.</div>}
        </div>
      )}

      {tab === 'admin' && isAdmin && (
        <div className={styles.recordWorkbench}>
          <aside className={styles.recordList}>
            <div className={styles.recordListHead}><strong>Компании</strong></div>
            {companies.map((company) => {
              const id = cell(company.company_id ?? company.id)
              return (
                <button key={id} type="button" className={id === selectedCompanyId ? styles.recordActive : ''} onClick={() => setSelectedCompanyId(id)}>
                  <strong>{cell(company.company_name ?? company.display_name ?? company.name ?? 'Компания')}</strong>
                  <span>{subscriptionStatusLabel(company.access_status ?? company.status)} · до {formatDate(activeUntil(company))}</span>
                </button>
              )
            })}
          </aside>
          <section className={styles.subscriptionCard}>
            <span className={styles.subscriptionEyebrow}>Управление подпиской</span>
            <h3>{cell(adminCompany?.company_name ?? adminCompany?.display_name ?? adminCompany?.name ?? 'Компания')}</h3>
            <div className={styles.adminForm}>
              <label>
                <span>Тариф</span>
                <select value={adminPlanSku} onChange={(event) => setAdminPlanSku(event.target.value)}>
                  {plans.map((plan) => <option key={planSku(plan)} value={planSku(plan)}>{planName(plan)}</option>)}
                </select>
              </label>
              <label>
                <span>Активна до</span>
                <input type="date" value={adminUntil} onChange={(event) => setAdminUntil(event.target.value)} />
              </label>
            </div>
            <div className={styles.subscriptionActions}>
              <button type="button" className={styles.saveBtn} onClick={() => saveAdmin('activate')} disabled={saving || !adminCompany || !adminPlanSku || !adminUntil}>
                <CheckCircle2 aria-hidden />
                Активировать
              </button>
              <button type="button" className={styles.dangerBtn} onClick={() => saveAdmin('deactivate')} disabled={saving || !adminCompany}>
                <XCircle aria-hidden />
                Деактивировать
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function DomainCollectionsPanel({
  domain,
  data,
  loading,
  error,
  onReload,
  canEdit = true,
}: {
  domain: string
  data: SettingsDomainData | null
  loading: boolean
  error: string | null
  onReload: () => void
  canEdit?: boolean
}) {
  const defs = DOMAIN_COLLECTIONS[domain] ?? []
  const [activeCollection, setActiveCollection] = useState(defs[0]?.key ?? '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<DataRow>({})
  const [savingRecord, setSavingRecord] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)

  useEffect(() => {
    const nextCollection = defs[0]?.key ?? ''
    setActiveCollection((current) => defs.some((def) => def.key === current) ? current : nextCollection)
    setSelectedId(null)
  }, [domain])

  const collectionDef = defs.find((def) => def.key === activeCollection) ?? defs[0]
  const rows = collectionDef ? realRows(data, collectionDef.key) : []
  const selected = useMemo(() => {
    if (!collectionDef) return null
    if (selectedId === '__new__') return collectionDef.emptyItem ? { ...collectionDef.emptyItem } : {}
    return rows.find((row) => String(row.id ?? '') === selectedId) ?? rows[0] ?? null
  }, [collectionDef, rows, selectedId])

  useEffect(() => {
    setForm(selected ? { ...selected } : {})
  }, [selected])

  const selectRow = (row: DataRow) => setSelectedId(String(row.id ?? ''))
  const addRow = () => {
    if (!canEdit || !collectionDef?.emptyItem) return
    setSelectedId('__new__')
    setForm({ ...collectionDef.emptyItem })
  }

  const updateRealField = (field: RealFieldDef, raw: string | boolean) => {
    setForm((current) => ({ ...current, [field.key]: parseRealValue(raw, field) }))
  }

  const saveRecord = () => {
    if (!collectionDef || !canEdit) return
    setSavingRecord(true)
    setRecordError(null)
    const id = selectedId === '__new__' ? undefined : String(form.id ?? selected?.id ?? '')
    updateSettingsRecord(collectionDef.key, id, form)
      .then((record) => {
        if (collectionDef.key === 'company_profile' && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('a1:company-updated', {
            detail: {
              company_id: cell(record.id ?? record.company_id ?? form.id ?? form.company_id),
              name: cell(record.display_name ?? record.company_name ?? record.brand_name ?? form.display_name ?? form.company_name ?? form.brand_name),
            },
          }))
        }
        setSelectedId(null)
        onReload()
      })
      .catch((e) => setRecordError(e instanceof Error ? e.message : 'Ошибка сохранения записи'))
      .finally(() => setSavingRecord(false))
  }

  if (loading) return <div className={styles.state}>Загружаем данные из prod...</div>
  if (error) return <div className={styles.error}>{error}</div>
  if (!collectionDef) return null

  return (
    <div className={styles.domainPanel}>
      <div className={styles.runtimeHead}>
        <div>
          <h3>Данные из prod DB</h3>
          <p>Секции ниже читают реальные данные и сохраняют изменения через защищенный backend.</p>
          {domain === 'subscription' && !canEdit && <p>Покупка и продление будут подключены позже. Сейчас доступен просмотр текущей подписки и тарифов.</p>}
        </div>
        <button type="button" onClick={onReload}>
          <RefreshCw aria-hidden />
          Обновить
        </button>
      </div>

      <div className={styles.collectionTabs}>
        {defs.map((def) => (
          <button key={def.key} type="button" className={def.key === collectionDef.key ? styles.collectionTabActive : ''} onClick={() => { setActiveCollection(def.key); setSelectedId(null) }}>
            {def.title}
            <span>{realRows(data, def.key).length}</span>
          </button>
        ))}
      </div>

      <div className={styles.recordWorkbench}>
        <aside className={styles.recordList}>
          <div className={styles.recordListHead}>
            <strong>{collectionDef.title}</strong>
            {canEdit && collectionDef.emptyItem && <button type="button" onClick={addRow}>Добавить</button>}
          </div>
          {rows.length === 0 && selectedId !== '__new__' ? (
            <div className={styles.recordEmpty}>Записей нет</div>
          ) : (
            rows.map((row) => (
              <button key={String(row.id ?? realLabel(row, collectionDef))} type="button" className={String(row.id ?? '') === String(selected?.id ?? '') && selectedId !== '__new__' ? styles.recordActive : ''} onClick={() => selectRow(row)}>
                <strong>{realLabel(row, collectionDef)}</strong>
                <span>{realSubLabel(row, collectionDef)}</span>
              </button>
            ))
          )}
        </aside>

        <section className={styles.recordCard}>
          <div className={styles.recordCardHead}>
            <div>
              <h3>{selectedId === '__new__' ? 'Новая запись' : realLabel(form, collectionDef)}</h3>
              <p>{collectionDef.description}</p>
            </div>
            {canEdit ? (
              <button type="button" className={styles.saveBtn} onClick={saveRecord} disabled={savingRecord || !Object.keys(form).length}>
                <Save aria-hidden />
                {savingRecord ? 'Сохраняем...' : 'Сохранить'}
              </button>
            ) : domain === 'subscription' ? (
              <button type="button" className={styles.saveBtn} onClick={() => setRecordError('Оплата и продление будут подключены на следующем этапе.')} disabled={collectionDef.key !== 'subscription_access'}>
                <CreditCard aria-hidden />
                Продлить / купить
              </button>
            ) : null}
          </div>
          {recordError && <div className={styles.error}>{recordError}</div>}
          <div className={styles.realForm}>
            {realVisibleFields(collectionDef).map((field) => {
              const value = form[field.key]
              const inputValue = valueToInput(value, field.type)
              const wide = field.type === 'textarea' || field.type === 'json' || field.type === 'tags'
              const readonly = field.readonly || !canEdit
              return (
                <label key={field.key} className={wide ? styles.realFieldWide : undefined}>
                  <span>{field.label}{field.required ? ' *' : ''}</span>
                  {field.type === 'toggle' ? (
                    <button type="button" className={`${styles.switch} ${value ? styles.switchOn : ''}`} onClick={() => updateRealField(field, !Boolean(value))} disabled={readonly}>
                      <span />
                    </button>
                  ) : field.type === 'select' ? (
                    <select value={inputValue} onChange={(event) => updateRealField(field, event.target.value)} disabled={readonly}>
                      {(field.options ?? []).map((option) => <option key={option} value={option}>{optionLabel(field, option) || '-'}</option>)}
                    </select>
                  ) : field.type === 'textarea' || field.type === 'json' || field.type === 'tags' ? (
                    <textarea value={inputValue} onChange={(event) => updateRealField(field, event.target.value)} rows={field.type === 'json' ? 7 : 4} readOnly={readonly} />
                  ) : (
                    <input type={field.type === 'number' ? 'number' : 'text'} value={inputValue} onChange={(event) => updateRealField(field, event.target.value)} readOnly={readonly} />
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
  const [domainData, setDomainData] = useState<SettingsDomainData | null>(null)
  const [domainLoading, setDomainLoading] = useState(false)
  const [domainError, setDomainError] = useState<string | null>(null)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

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

  const loadDomainData = () => {
    if (!DOMAIN_COLLECTIONS[activeSection]) return
    setDomainLoading(true)
    setDomainError(null)
    getSettingsDomain(activeSection)
      .then((res) => setDomainData(res))
      .catch((e) => setDomainError(e instanceof Error ? e.message : 'Ошибка загрузки данных раздела'))
      .finally(() => setDomainLoading(false))
  }

  useEffect(() => {
    if (DOMAIN_COLLECTIONS[activeSection]) {
      setDomainData(null)
      loadDomainData()
    }
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

  const submitPasswordChange = () => {
    const currentPassword = passwordForm.current.trim()
    const nextPassword = passwordForm.next
    const confirmPassword = passwordForm.confirm
    setPasswordError(null)
    setPasswordMessage(null)
    if (!currentPassword) {
      setPasswordError('Введите текущий пароль')
      return
    }
    if (nextPassword.length < 8) {
      setPasswordError('Новый пароль должен быть не короче 8 символов')
      return
    }
    if (nextPassword !== confirmPassword) {
      setPasswordError('Новый пароль и подтверждение не совпадают')
      return
    }
    setPasswordSaving(true)
    changeOwnPassword(currentPassword, nextPassword)
      .then(() => {
        setPasswordForm({ current: '', next: '', confirm: '' })
        setPasswordMessage('Пароль обновлен')
      })
      .catch((e) => setPasswordError(e instanceof Error ? e.message : 'Не удалось сменить пароль'))
      .finally(() => setPasswordSaving(false))
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
  const hasRealDomain = Boolean(DOMAIN_COLLECTIONS[section.id])
  const session = getSession()
  const isSubscriptionAdmin = session?.user_id?.toLowerCase() === A1_ADMIN_USER
  const canEditDomain = section.id !== 'subscription' || isSubscriptionAdmin
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
          {!hasRealDomain && (
            <button type="button" className={styles.saveBtn} onClick={save} disabled={!dirty || saving || loading}>
              <Save aria-hidden />
              {saving ? 'Сохраняем...' : dirty ? 'Сохранить' : 'Сохранено'}
            </button>
          )}
        </div>

        {loading && <div className={styles.state}>Загружаем настройки...</div>}
        {error && <div className={styles.error}>{error}</div>}
        {savedAt && !dirty && <div className={styles.saved}>Сохранено в {savedAt}</div>}

        {!loading && section.id === 'security' && (
          <div className={styles.runtimePanel}>
            <div className={styles.runtimeHead}>
              <div>
                <h3>Смена пароля</h3>
                <p>Пароль меняется только для текущего аккаунта. После смены временный токен входа больше не используется.</p>
              </div>
            </div>
            {passwordError && <div className={styles.error}>{passwordError}</div>}
            {passwordMessage && <div className={styles.saved}>{passwordMessage}</div>}
            <div className={styles.passwordForm}>
              <label>
                <span>Текущий пароль</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.current}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))}
                />
              </label>
              <label>
                <span>Новый пароль</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.next}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))}
                />
              </label>
              <label>
                <span>Повторите новый пароль</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirm}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, confirm: event.target.value }))}
                />
              </label>
              <button type="button" onClick={submitPasswordChange} disabled={passwordSaving}>
                <KeyRound aria-hidden />
                {passwordSaving ? 'Меняем...' : 'Сменить пароль'}
              </button>
            </div>
          </div>
        )}

        {!loading && section.id === 'subscription' && (
          <SubscriptionPanel
            data={domainData}
            loading={domainLoading}
            error={domainError}
            onReload={loadDomainData}
            isAdmin={isSubscriptionAdmin}
          />
        )}

        {!loading && section.id !== 'subscription' && DOMAIN_COLLECTIONS[section.id] && (
          <DomainCollectionsPanel
            domain={section.id}
            data={domainData}
            loading={domainLoading}
            error={domainError}
            onReload={loadDomainData}
            canEdit={canEditDomain}
          />
        )}

        {!loading && section.id === 'integrations' && (
          <div className={styles.runtimePanel}>
            <div className={styles.runtimeHead}>
              <div>
                <h3>Подключения и health-check</h3>
                <p>Статусы приходят из backend, секреты и токены в интерфейс не выводятся.</p>
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
                      <small>{item.family} · {item.authMode}</small>
                      <span className={styles.statusPill}>{item.status}</span>
                    </div>
                  </div>
                  <dl>
                    <div><dt>Проверка</dt><dd>{item.health}</dd></div>
                    <div><dt>Данные</dt><dd>{item.entities}</dd></div>
                    <div><dt>Подключение</dt><dd>{item.lastConnected}</dd></div>
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
                <p>Роли сохраняются в backend и перечитываются после изменения.</p>
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

        {!loading && !hasRealDomain && collectionDefs.map((collectionDef) => {
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

        {!loading && !hasRealDomain && (
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
