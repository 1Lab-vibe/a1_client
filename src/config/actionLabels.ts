/**
 * Русские названия и описания action-хендлеров (что делает режим) по action_key.
 * Используется в OpsDepartmentView для карточек действий во всех отделах,
 * чтобы не показывать английские описания из реестра хендлеров.
 */

export interface ActionLabel {
  name: string
  description: string
}

export const ACTION_LABELS: Record<string, ActionLabel> = {
  // analytics
  analyze_table: { name: 'Анализ таблицы', description: 'Разобрать столбцы и строки, построить маппинг полей или нормализованный набор данных.' },
  build_charts: { name: 'Графики и метрики', description: 'Построить графики и диаграммы по подготовленным метрикам и KPI.' },
  build_summary_report: { name: 'Сводка / отчёт', description: 'Краткая управленческая сводка по данным или результатам цепочки.' },
  export_pdf_report: { name: 'Экспорт в PDF', description: 'Выгрузить готовый отчёт или сводку в PDF.' },
  run_report_template: { name: 'Отчёт по шаблону', description: 'Выполнить готовый отчёт из реестра шаблонов с фильтрами.' },
  // calendar
  ops_calendar: { name: 'Календарь и напоминания', description: 'Планирование, список, обновление и напоминания в местном времени.' },
  // content
  build_presentation: { name: 'Сборка презентации', description: 'Сгенерировать презентацию по структуре, исследованию или KPI.' },
  ops_images: { name: 'Генерация изображений', description: 'Изображения для презентаций и отдельных запросов.' },
  // crm
  get_crm_context: { name: 'Контекст CRM', description: 'Найти или создать сущность CRM и загрузить полный контекст.' },
  // external
  collect_data_web: { name: 'Сбор данных из интернета', description: 'Собрать публичные данные с указанием источников.' },
  // finance
  issue_invoice: { name: 'Выставить счёт', description: 'Сформировать счёт (PDF), при необходимости отправить клиенту.' },
  ms_integration_sber_business: { name: 'Сбер Бизнес', description: 'Банковские выписки и платежи.' },
  ms_integration_yookassa: { name: 'YooKassa', description: 'Онлайн-платежи и счета.' },
  ops_billing_executor: { name: 'Биллинг', description: 'Занести события биллинга по оплатам/подпискам.' },
  ops_erp_reconciliation: { name: 'Сверка с ERP', description: 'Сверить биллинг с учётной системой, найти расхождения.' },
  ops_finance: { name: 'Финансовые операции', description: 'Транзакции, обязательства, cash flow, план/факт, отчёты.' },
  // general
  answer_question: { name: 'Ответ на вопрос', description: 'Поиск в интернете и краткий ответ.' },
  capability_growth: { name: 'Рост возможностей', description: 'Найти и добавить недостающие возможности и интеграции.' },
  profit_plan: { name: 'План прибыли', description: 'Воронка, юнит-экономика, KPI, план-факт.' },
  // governance
  quality_security_gate: { name: 'Контур качества и безопасности', description: 'Запустить проверку качества и безопасности.' },
  // hr
  ops_hr_executor: { name: 'HR — операции', description: 'Изменения по HR-кейсам.' },
  ops_hris_sync: { name: 'Синхронизация HRIS', description: 'Экспорт/импорт снапшота сотрудников.' },
  ops_hr_lpr: { name: 'HR — решения', description: 'Принятие HR-решений (LLM).' },
  // itsm
  ops_itsm_executor: { name: 'IT — операции', description: 'Изменения по тикетам.' },
  ops_itsm_lpr: { name: 'IT — маршрутизация', description: 'Маршрутизация заявок (LLM).' },
  // legal
  ops_legal_executor: { name: 'Юр. операции', description: 'Изменения по юридическим кейсам.' },
  ops_legal_lpr: { name: 'Юр. маршрутизация', description: 'Юридические решения и маршрутизация (LLM).' },
  // management
  ops_ceo: { name: 'CEO', description: 'Стратегические отклонения, восстановление, кросс-функциональные решения.' },
  // marketing
  product_packaging: { name: 'Упаковка продукта', description: '3 SKU, цены, 1-pager, шаблон КП, скрипт звонка, бриф.' },
  agent_ad_image_generator: { name: 'Генерация рекламных изображений', description: 'Создать изображения (GPT Image) и загрузить в Яндекс.Директ AdImages.' },
  yandex_direct_auto_optimize_settings: { name: 'Авто-оптимизация Яндекс.Директ', description: 'Подготовить безопасные настройки авто-оптимизации (изменения — после подтверждения).' },
  yandex_direct_export_after_approval: { name: 'Экспорт в Директ (после согласования)', description: 'Публикация в Яндекс.Директ после ручного подтверждения (высокий риск).' },
  yandex_direct_report: { name: 'Отчёт Яндекс.Директ', description: 'Сбор отчётов Директа: дневная/недельная/месячная сводка по рекламе.' },
  yandex_direct_site_audit: { name: 'Аудит лендинга', description: 'Проверка посадочных страниц перед запуском рекламы.' },
  yandex_direct_validate: { name: 'Проверка доступа Яндекс.Директ', description: 'Проверка учётных данных и доступности рекламного аккаунта.' },
  marketing_agent: { name: 'Маркетинговый агент', description: 'Агент рантайм-конфигурации маркетинга.' },
  growth_leadgen_report: { name: 'PDF-отчёт по лидогенерации', description: 'Собрать PDF-отчёт по лидогенерации и отправить в Telegram администратору.' },
  ops_yandex_direct: { name: 'Яндекс.Директ (шлюз)', description: 'Защищённый шлюз Директа: режимы чтения/отчётов и публикация с проверками.' },
  yandex_direct_boost_ads: { name: 'Оптимизация объявлений', description: 'Анализ эффективности и подготовка безопасных операций оптимизации.' },
  yandex_direct_create_ads: { name: 'Создать объявления', description: 'Матрица по страницам, план ключей, объявления и креативы.' },
  yandex_direct_refresh_semantics: { name: 'Обновить семантику', description: 'Обновить черновые семантические кандидаты и решения по качеству.' },
  yandex_direct: { name: 'Яндекс.Директ', description: 'Защищённые операции Директа при готовом медиаплане.' },
  calculate_media_plan: { name: 'Расчёт медиаплана', description: 'Детерминированный калькулятор медиаплана.' },
  classify_ad_category: { name: 'Категория рекламы', description: 'Классифицировать продукт в рекламную категорию.' },
  export_yandex_direct_campaigns: { name: 'Экспорт кампаний (XLSX)', description: 'Выгрузить локальные кампании Директа в XLSX.' },
  export_yandex_direct_xlsx: { name: 'Экспорт медиаплана (XLSX)', description: 'Выгрузить медиаплан в формат загрузки Яндекс.Директ.' },
  generate_ad_variants: { name: 'Варианты объявлений', description: 'Сгенерировать черновые рекламные креативы с UTM.' },
  import_yandex_direct_xlsx: { name: 'Импорт кампаний (XLSX)', description: 'Импортировать XLSX кампаний Директа в локальный реестр.' },
  landing_watchdog: { name: 'Мониторинг лендингов', description: 'Ежечасная проверка доступности и контент-хеша лендингов.' },
  agent_marketing_daily_digest: { name: 'Ежедневный дайджест маркетинга', description: 'Дайджест в Telegram: факты, решения, здоровье лендингов.' },
  ops_yandex_direct_reports_collector: { name: 'Сбор отчётов Директа', description: 'Ежедневная выгрузка Reports API в маркетинговые показатели.' },
  marketing_media_plan_artifacts: { name: 'Артефакты медиаплана', description: 'Выгрузить актуальный медиаплан Директа в PDF-отчёт.' },
  agent_yandex_direct_marketer: { name: 'Маркетолог Яндекс.Директ', description: 'Построить полный медиаплан Директа через агента.' },
  growth_outreach_builder: { name: 'Подготовка outreach', description: 'Персонализированные черновики рассылок с HTML и проверкой качества.' },
  marketing_media_plan: { name: 'Медиаплан', description: 'Построение медиаплана Яндекс.Директ.' },
  marketingmediaplan: { name: 'Медиаплан (алиас)', description: 'Алиас команды построения медиаплана.' },
  growth_leadgen: { name: 'Лидогенерация', description: 'Поиск лидов, обогащение, скоринг и черновики рассылок.' },
  yandex_direct_campaign_build: { name: 'Сборка кампании Директ', description: 'Черновой медиаплан v2: группы продуктов, семантика, объявления.' },
  yd_build_budget_limited_launch_pack: { name: 'Пакет запуска с лимитом бюджета', description: 'Карта рынка, пакет запуска, бэклог и лестница масштабирования.' },
  // notifications
  send_report: { name: 'Отправить отчёт', description: 'Доставить отчёт получателям по настроенным каналам.' },
  // onboarding
  ms_company_onboarding: { name: 'Регистрация / демо компании', description: 'Диалог онбординга новой компании и демо-режим.' },
  // project factory
  project_architect_agent: { name: 'Архитектор проекта', description: 'Архитектура, модель данных, карта интеграций, план базы знаний.' },
  project_dev_agent: { name: 'Разработка (PF)', description: 'Агент разработки Проектной фабрики.' },
  project_factory_ceo: { name: 'CEO Проектной фабрики', description: 'Агент-руководитель Проектной фабрики.' },
  project_factory_human_review: { name: 'Ревью человеком (PF)', description: 'Гейт согласования.' },
  project_factory_start: { name: 'Старт проекта (PF)', description: 'Создать проект (intake).' },
  project_qa_agent: { name: 'QA-гейт (PF)', description: 'Агент контроля качества.' },
  project_rag_ingest: { name: 'Индексация базы знаний (PF)', description: 'Полная загрузка эмбеддингов в базу знаний.' },
  project_security_agent: { name: 'Гейт безопасности (PF)', description: 'Агент безопасности.' },
  project_factory_dispatch: { name: 'Диспетчер Проектной фабрики', description: 'Детерминированный движок стадий проекта.' },
  // ops
  compose_email: { name: 'Составить письмо', description: 'Персонализированное письмо (тема, текст, HTML).' },
  delivery_ops: { name: 'Операции доставки', description: 'Чек-листы, библиотека модулей, критерии приёмки, NPS.' },
  ops_documents: { name: 'Генерация документов', description: 'Документы (PDF) по шаблонам с нумерацией.' },
  prepare_multi_file_import: { name: 'Подготовить файл для импорта', description: 'Свести несколько файлов/вкладок в один нормализованный файл.' },
  read_sheet: { name: 'Прочитать таблицу', description: 'Данные из Google Sheet или файла (.xlsx/.csv).' },
  send_email: { name: 'Отправить письмо', description: 'Отправка через gmail / smtp / email API.' },
  // orchestrator
  ops_coo: { name: 'COO', description: 'Внутренний вызов роутера COO.' },
  route_to_agent: { name: 'Маршрутизация к агенту', description: 'Передать управление агенту-исполнителю.' },
  // planning
  build_longchain_plan: { name: 'Стратегический план', description: 'Разложить сложную цель на исполнимые шаги и хэндоффы.' },
  // platform
  sql_query: { name: 'SQL-запрос', description: 'Выполнить SQL (реестр запросов или сырой SQL).' },
  // procurement / supply
  ops_suppliers_import: { name: 'Импорт поставщиков', description: 'Импорт и обновление поставщиков, прайсов и каталогов.' },
  ops_supply: { name: 'Снабжение', description: 'Единый процесс снабжения.' },
  // sales
  dadata_find_party: { name: 'DaData — поиск компании', description: 'Поиск и обогащение компании через DaData.' },
  lead_creation: { name: 'Создание лида', description: 'Создать лид в Bitrix24 из запроса.' },
  ops_chekko: { name: 'Checko', description: 'Данные компании через Checko (ИНН/ОГРН, контракты, финансы).' },
  sales_manager: { name: 'Sales-менеджер', description: 'Конкретные действия по лиду или клиенту.' },
  sales_ops: { name: 'Настройка продаж', description: 'Воронка, follow-up, шаблоны, ежедневные рутины.' },
  // sheets
  append_rows_sheet: { name: 'Добавить строки', description: 'Дописать строки в существующую вкладку таблицы.' },
  create_table_sheet: { name: 'Создать таблицу', description: 'Создать таблицу или вкладку для экспорта.' },
  // support
  ops_support_executor: { name: 'Поддержка — операции', description: 'Изменения по обращениям.' },
  ops_support_lpr: { name: 'Поддержка — маршрутизация', description: 'Хелпдеск и маршрутизация (LLM).' },
  // tasks
  create_task: { name: 'Создать задачу', description: 'Создать запись в задачах.' },
  // voice
  ops_voice_call: { name: 'Голосовой шлюз', description: 'Исходящий звонок, анализ после звонка, синхронизация.' },
}

/** Русское имя действия по action_key (с фолбэком). */
export function actionName(actionKey: string, fallback?: string): string {
  return ACTION_LABELS[actionKey]?.name ?? fallback ?? actionKey
}

/** Русское описание действия по action_key (с фолбэком). */
export function actionDescription(actionKey: string, fallback?: string): string {
  return ACTION_LABELS[actionKey]?.description ?? fallback ?? ''
}
