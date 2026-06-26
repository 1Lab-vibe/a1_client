// АВТОГЕНЕРАЦИЯ из a1-dev-ops/knowledge-base/manual/coo_action_handlers_smoke_5_each_2026-05-01.json
// Канонические запросы по отделам (проверенный роутинг через ms_in_take). Не редактировать вручную — перегенерировать из KB.

export interface HandlerScenario {
  action_key: string
  action_name: string
  domain: string
  description: string
  workflow_id: string
  examples: string[]
}

export const DOMAIN_LABELS: Record<string, string> = {
  finance: "Финансы", sales: "Продажи", analytics: "Аналитика", marketing: "Маркетинг",
  hr: "HR", legal: "Юр. служба", itsm: "IT", procurement: "Снабжение", ops: "Операции",
  content: "Контент", crm: "CRM", general: "Общие", management: "Управление",
  notifications: "Уведомления", onboarding: "Онбординг", planning: "Планирование",
  platform: "Платформа", orchestrator: "Оркестратор", calendar_ops: "Календарь",
  external: "Внешние данные", governance: "Контроль качества", operations: "Проектная фабрика",
  project_factory: "Проектная фабрика",
}

export const HANDLER_SCENARIOS: HandlerScenario[] = [
  {
    "action_key": "analyze_table",
    "action_name": "Анализ таблицы",
    "domain": "analytics",
    "description": "Analyze source columns/rows and build a strict field mapping or normalized recordset for downstream write operations.",
    "workflow_id": "XhoyAI2i4XTj2lPM",
    "examples": [
      "Проанализируй приложенную таблицу клиентов и скажи, какие колонки к чему относятся.",
      "Разбери файл с заявками и сопоставь поля с нашей CRM.",
      "Проверь таблицу поставщиков и подготовь понятную структуру полей.",
      "Посмотри прайс-лист и выдели, где название, цена, артикул и категория.",
      "Разбери выгрузку из Excel и нормализуй колонки для загрузки."
    ]
  },
  {
    "action_key": "build_charts",
    "action_name": "Графики/метрики",
    "domain": "analytics",
    "description": "Build chart specs or chart artifacts from prepared tabular metrics and KPI datasets.",
    "workflow_id": "XhoyAI2i4XTj2lPM",
    "examples": [
      "Построй графики по продажам за последние три месяца.",
      "Сделай диаграмму по выручке и марже по категориям.",
      "Подготовь график динамики лидов по неделям.",
      "Собери визуализацию по платежам и просрочкам.",
      "Покажи на графике план и факт по отделам."
    ]
  },
  {
    "action_key": "build_summary_report",
    "action_name": "Сводка/отчет",
    "domain": "analytics",
    "description": "Build a concise user-facing or executive summary from prepared data, SQL rows, or chain outputs.",
    "workflow_id": "XhoyAI2i4XTj2lPM",
    "examples": [
      "Сделай краткую сводку по итогам продаж за неделю.",
      "Подготовь управленческое резюме по финансам за месяц.",
      "Собери короткий отчет по текущим задачам команды.",
      "Дай понятную сводку по закупкам и поставщикам.",
      "Сформируй итоговый summary по результатам анализа."
    ]
  },
  {
    "action_key": "export_pdf_report",
    "action_name": "Экспорт PDF",
    "domain": "analytics",
    "description": "Export a prepared report or summary into a PDF artifact for delivery.",
    "workflow_id": "XhoyAI2i4XTj2lPM",
    "examples": [
      "Выполни операционную задачу: Экспорт PDF.",
      "Помоги с задачей для отдела: Экспорт PDF.",
      "Подготовь действие по запросу: Экспорт PDF.",
      "Разбери запрос и выполни сценарий: Экспорт PDF.",
      "Запусти нужный рабочий сценарий: Экспорт PDF."
    ]
  },
  {
    "action_key": "run_report_template",
    "action_name": "Run report template",
    "domain": "analytics",
    "description": "Execute predefined report from a1_report_templates with filters and artifact output.",
    "workflow_id": "M6pSSU8tna0ILHQG",
    "examples": [
      "Сформируй стандартный отчет по продажам за неделю.",
      "Запусти регулярный отчет по финансовым показателям.",
      "Собери шаблонный отчет по CRM-гигиене.",
      "Подготовь готовый отчет по платежному календарю.",
      "Сделай типовой отчет по закупкам за месяц."
    ]
  },
  {
    "action_key": "ops_calendar",
    "action_name": "calendar_ops — Universal calendar + reminders (single entrypoint for COO)",
    "domain": "calendar_ops",
    "description": "Universal calendar and reminders entrypoint for COO: schedule, list, update, summarize, and remind in local time.",
    "workflow_id": "iZJo5gvUNrj0qU8p",
    "examples": [
      "Запланируй встречу с клиентом на завтра в 15:00.",
      "Поставь напоминание созвониться с бухгалтерией утром.",
      "Перенеси встречу с отделом продаж на пятницу.",
      "Покажи свободные окна на следующей неделе.",
      "Отмени завтрашний созвон по проекту."
    ]
  },
  {
    "action_key": "build_presentation",
    "action_name": "Сборка презентации",
    "domain": "content",
    "description": "Generate a presentation artifact or slide deck from structured outline, research, or KPI inputs.",
    "workflow_id": "tvFOZVlWprnbq0DA",
    "examples": [
      "Подготовь презентацию для клиента на десять слайдов.",
      "Собери слайды для партнерской встречи.",
      "Сделай презентацию по итогам квартала.",
      "Подготовь короткий deck для инвестора.",
      "Собери коммерческую презентацию новой услуги."
    ]
  },
  {
    "action_key": "ops_images",
    "action_name": "Генерация изображений",
    "domain": "content",
    "description": "Универсальная генерация изображений для презентаций и отдельных запросов",
    "workflow_id": "9ooLfqIflBcoaB8p",
    "examples": [
      "Сгенерируй обложку для презентации про автоматизацию продаж.",
      "Подготовь иллюстрацию для слайда о финансовом контроле.",
      "Сделай картинку для анонса вебинара.",
      "Создай визуал для поста про CRM-дисциплину.",
      "Нарисуй баннер для внутреннего обучения менеджеров."
    ]
  },
  {
    "action_key": "get_crm_context",
    "action_name": "get_crm_context",
    "domain": "crm",
    "description": "Resolve/create CRM entity by email/phone/name/website or refs and load full CRM context. Returns crm_refs + crm block.",
    "workflow_id": "PhFR2nWD4e1QSowK",
    "examples": [
      "Найди в CRM клиента Альфа и покажи контекст по нему.",
      "Проверь карточку лида Ромашка перед звонком.",
      "Подтяни данные по сделке Север из CRM.",
      "Найди клиента по email и покажи историю общения.",
      "Проверь, есть ли компания Вектор в нашей базе."
    ]
  },
  {
    "action_key": "collect_data_web",
    "action_name": "Сбор данных из интернета",
    "domain": "external",
    "description": "Collect public web data and return factual findings with source references for downstream use.",
    "workflow_id": "rRHcGyo7XegfFFdD",
    "examples": [
      "Найди в интернете конкурентов для сервиса автоматизации закупок.",
      "Собери публичные данные о ценах на CRM-консалтинг.",
      "Проверь сайт клиента и кратко опиши его бизнес.",
      "Найди источники по рынку b2b аналитики в России.",
      "Собери факты о поставщике перед переговорами."
    ]
  },
  {
    "action_key": "issue_invoice",
    "action_name": "Issue invoice",
    "domain": "finance",
    "description": "Generate and optionally email a numbered invoice PDF",
    "workflow_id": "8zwRIxxijdq2JDDu",
    "examples": [
      "Выставь счет клиенту Альфа на предоплату.",
      "Подготовь инвойс для компании Север за услуги внедрения.",
      "Сформируй счет на оплату по проекту CRM.",
      "Сделай счет клиенту за консультацию и отправь менеджеру.",
      "Подготовь счет на второй этап работ."
    ]
  },
  {
    "action_key": "ms_integration_sber_business",
    "action_name": "Sber Business API",
    "domain": "finance",
    "description": "Statements + payments stub",
    "workflow_id": "gs7gpQpUDJ5tfoSN",
    "examples": [
      "Проверь банковскую выписку за вчера.",
      "Посмотри последние поступления на расчетный счет.",
      "Сверь платежи в банке за эту неделю.",
      "Подготовь данные по исходящим платежам из банка.",
      "Проверь, прошла ли оплата от клиента."
    ]
  },
  {
    "action_key": "ms_integration_yookassa",
    "action_name": "YooKassa",
    "domain": "finance",
    "description": "Payments + invoices API",
    "workflow_id": "ic2ycjtwKCWfgjDq",
    "examples": [
      "Проверь оплату клиента через онлайн-кассу.",
      "Найди платеж в ЮKassa за сегодня.",
      "Сделай ссылку на оплату для клиента.",
      "Посмотри статус онлайн-платежа по заказу.",
      "Проверь возврат по платежу клиента."
    ]
  },
  {
    "action_key": "ops_billing_executor",
    "action_name": "Billing Executor",
    "domain": "finance",
    "description": "a1_billing_events ingest",
    "workflow_id": "DzoH2vZG04lZvUsE",
    "examples": [
      "Занеси событие биллинга по оплате клиента.",
      "Обнови биллинг по подписке клиента.",
      "Зафиксируй начисление за текущий месяц.",
      "Проверь биллинговое событие по счету.",
      "Добавь запись о списании по договору."
    ]
  },
  {
    "action_key": "ops_erp_reconciliation",
    "action_name": "ERP reconciliation",
    "domain": "finance",
    "description": "Billing rollup",
    "workflow_id": "bxGtdE1vhaHJd5Ma",
    "examples": [
      "Сверь биллинг с учетной системой за месяц.",
      "Проверь расхождения между оплатами и актами.",
      "Сделай сверку начислений и платежей.",
      "Подготовь reconciliation по финансовым операциям.",
      "Найди несовпадения в ERP и биллинге."
    ]
  },
  {
    "action_key": "ops_finance",
    "action_name": "Финансовые операции",
    "domain": "finance",
    "description": "Ops finance engine: транзакции, обязательства, recurring, cash flow, plan/fact, отчеты",
    "workflow_id": "qD172IZJGkaQCW6c",
    "examples": [
      "Добавь финансовое обязательство на оплату аренды.",
      "Проверь кассовый разрыв до конца месяца.",
      "Составь платежный календарь на неделю.",
      "Зафиксируй расход по подрядчику.",
      "Обнови план-факт по финансам."
    ]
  },
  {
    "action_key": "answer_question",
    "action_name": "answer_question",
    "domain": "general",
    "description": "Off-topic Q&A: web lookup + final answer (no COO)",
    "workflow_id": "IV2bbHhj5Ih6Cpbq",
    "examples": [
      "Ответь, какие документы нужны для регистрации ООО.",
      "Объясни простыми словами, что такое факторинг.",
      "Найди ответ, чем отличается счет от акта.",
      "Расскажи, как работает электронная подпись.",
      "Ответь на вопрос клиента про сроки оплаты."
    ]
  },
  {
    "action_key": "capability_growth",
    "action_name": "Capability growth",
    "domain": "general",
    "description": "Find and add missing capabilities, resources and integrations for A1 autonomy.",
    "workflow_id": "fHYSs5kelcr3q2lA",
    "examples": [
      "Найди, какой возможности нам не хватает для обработки тендеров.",
      "Предложи, какую интеграцию добавить для закупок.",
      "Проверь, какого инструмента не хватает для HR процессов.",
      "Разберись, какой новый навык нужен агенту для отчетов.",
      "Определи недостающую возможность для работы с файлами."
    ]
  },
  {
    "action_key": "profit_plan",
    "action_name": "Profit plan",
    "domain": "general",
    "description": "Build profit/metrics plan: funnel, unit-economics, KPIs, plan-fact.",
    "workflow_id": "fHYSs5kelcr3q2lA",
    "examples": [
      "Составь план прибыли для новой услуги.",
      "Посчитай, как выйти на миллион выручки в месяц.",
      "Подготовь план по воронке, марже и unit economics.",
      "Собери финансовую модель для направления продаж.",
      "Сделай план-факт по прибыли и ключевым метрикам."
    ]
  },
  {
    "action_key": "quality_security_gate",
    "action_name": "Контур качества/безопасности",
    "domain": "governance",
    "description": "Запустить WF7",
    "workflow_id": "5z73UV8HtF0yDnAw",
    "examples": [
      "Проверь решение на риски качества и безопасности.",
      "Проведи контроль качества перед запуском workflow.",
      "Оцени, безопасно ли выполнять этот план.",
      "Проверь цепочку действий на рискованные шаги.",
      "Сделай security review перед отправкой результата."
    ]
  },
  {
    "action_key": "ops_hr_executor",
    "action_name": "HR Executor",
    "domain": "hr",
    "description": "HR case mutations",
    "workflow_id": "dnyHMc2zgZzNgG2s",
    "examples": [
      "Создай HR кейс на онбординг нового менеджера.",
      "Открой кадровую задачу по отпуску сотрудника.",
      "Зафиксируй HR обращение по адаптации новичка.",
      "Создай кейс по найму менеджера продаж.",
      "Обнови HR статус по кандидату."
    ]
  },
  {
    "action_key": "ops_hris_sync",
    "action_name": "HRIS sync",
    "domain": "hr",
    "description": "Snapshot export/import",
    "workflow_id": "MpYHKhYp1h0iqzuX",
    "examples": [
      "Синхронизируй данные сотрудников из HR системы.",
      "Обнови кадровый справочник из HRIS.",
      "Сделай выгрузку сотрудников для сверки.",
      "Импортируй изменения по сотрудникам.",
      "Проверь синхронизацию кадровых данных."
    ]
  },
  {
    "action_key": "ops_hr_lpr",
    "action_name": "HR LPR",
    "domain": "hr",
    "description": "HR decisioning via ops_llm",
    "workflow_id": "dnyHMc2zgZzNgG2s",
    "examples": [
      "Определи, кому передать HR вопрос по отпуску.",
      "Разбери HR обращение и предложи решение.",
      "Помоги принять решение по кадровому кейсу.",
      "Классифицируй запрос сотрудника в HR.",
      "Определи маршрут по вопросу найма."
    ]
  },
  {
    "action_key": "ops_itsm_executor",
    "action_name": "ITSM Executor",
    "domain": "itsm",
    "description": "Ticket mutations",
    "workflow_id": "fLESy4guDfXQdQcV",
    "examples": [
      "Создай IT тикет: не работает интеграция с CRM.",
      "Открой заявку в IT по ошибке авторизации.",
      "Зафиксируй проблему с почтовой отправкой.",
      "Создай тикет на падение отчета.",
      "Обнови статус IT заявки по серверу."
    ]
  },
  {
    "action_key": "ops_itsm_lpr",
    "action_name": "ITSM LPR",
    "domain": "itsm",
    "description": "ITSM routing via ops_llm",
    "workflow_id": "fLESy4guDfXQdQcV",
    "examples": [
      "Разбери IT проблему и определи приоритет.",
      "Классифицируй обращение про ошибку интеграции.",
      "Определи, кому передать техническую проблему.",
      "Помоги маршрутизировать IT инцидент.",
      "Оцени срочность заявки по сбою сервиса."
    ]
  },
  {
    "action_key": "ops_legal_executor",
    "action_name": "Legal Executor",
    "domain": "legal",
    "description": "Legal case mutations",
    "workflow_id": "EYh3mpoaqiuLPqKo",
    "examples": [
      "Создай юридический кейс на проверку договора.",
      "Открой задачу юристу по NDA.",
      "Зафиксируй правовой вопрос по претензии клиента.",
      "Обнови статус согласования договора.",
      "Создай кейс на проверку оферты."
    ]
  },
  {
    "action_key": "ops_legal_lpr",
    "action_name": "Legal LPR",
    "domain": "legal",
    "description": "Legal routing via ops_llm",
    "workflow_id": "EYh3mpoaqiuLPqKo",
    "examples": [
      "Разбери юридический запрос и предложи маршрут.",
      "Определи, нужен ли юрист по этому договору.",
      "Классифицируй правовой риск по клиенту.",
      "Помоги принять решение по претензии.",
      "Определи приоритет юридического кейса."
    ]
  },
  {
    "action_key": "ops_ceo",
    "action_name": "OPS CEO",
    "domain": "management",
    "description": "Strategic deviation / recovery / cross-functional decision engine.",
    "workflow_id": "AwkdgcvCL3zaOHr6",
    "examples": [
      "Передай стратегический вопрос руководителю.",
      "Подготовь решение по конфликту между продажами и финансами.",
      "Разбери управленческий риск и предложи CEO решение.",
      "Нужно решение руководителя по приоритетам недели.",
      "Помоги CEO выбрать между ростом продаж и маржей."
    ]
  },
  {
    "action_key": "product_packaging",
    "action_name": "Product packaging",
    "domain": "marketing",
    "description": "Create offer packaging: 3 SKUs, pricing, 1-pager, КП template, call script, brief.",
    "workflow_id": "LhSapA3yHGfBeW09",
    "examples": [
      "Упакуй новую услугу в три тарифа и оффер.",
      "Подготовь позиционирование продукта для b2b клиентов.",
      "Сделай описание пакетов, цены и скрипт продажи.",
      "Собери one-pager для новой услуги.",
      "Упакуй предложение для корпоративных клиентов."
    ]
  },
  {
    "action_key": "send_report",
    "action_name": "Отправить отчет",
    "domain": "notifications",
    "description": "Deliver a prepared report summary or artifact to recipients through configured channels.",
    "workflow_id": "XhoyAI2i4XTj2lPM",
    "examples": [
      "Отправь готовый отчет руководителю на почту.",
      "Перешли сводку по продажам команде.",
      "Отправь финансовый отчет директору.",
      "Доставь отчет клиенту после формирования.",
      "Разошли итоговую сводку ответственным."
    ]
  },
  {
    "action_key": "ms_company_onboarding",
    "action_name": "Регистрация / демо компании",
    "domain": "onboarding",
    "description": "Stateful dialog workflow for new company onboarding bootstrap and sandbox demo mode.",
    "workflow_id": "GlhrT3z1eoYUqnkp",
    "examples": [
      "Запусти регистрацию новой компании в демо.",
      "Начни онбординг клиента в системе.",
      "Помоги подключить новую компанию к A1.",
      "Создай демо-пространство для клиента.",
      "Проведи первичную настройку компании."
    ]
  },
  {
    "action_key": "project_architect_agent",
    "action_name": "Project Architect Agent",
    "domain": "operations",
    "description": "Project Factory architect: designs architecture package, data model, integration map, KB plan and readiness gates.",
    "workflow_id": "R9vDa9b1d2LXZMyL",
    "examples": [
      "Спроектируй архитектуру нового продукта.",
      "Подготовь техническую архитектуру проекта.",
      "Опиши модель данных и интеграции для сервиса.",
      "Собери архитектурный пакет для разработки.",
      "Проверь готовность архитектуры перед реализацией."
    ]
  },
  {
    "action_key": "project_dev_agent",
    "action_name": "PF Dev submit",
    "domain": "operations",
    "description": "Project Factory dev agent workflow (project_dev_agent); orchestration in pf_cursor_job_submit.",
    "workflow_id": "0uQfk7NYdUbV3glv",
    "examples": [
      "Передай задачу в разработку проекта.",
      "Запусти разработку MVP по готовому брифу.",
      "Подготовь dev-задачу для команды.",
      "Отправь проект на реализацию разработчику.",
      "Создай задание на кодинг нового модуля."
    ]
  },
  {
    "action_key": "project_factory_ceo",
    "action_name": "PF CEO",
    "domain": "operations",
    "description": "Project Factory CEO agent workflow (project_factory_ceo).",
    "workflow_id": "Awy5Kj3d8yAmlM5o",
    "examples": [
      "Оцени проект как руководитель фабрики.",
      "Прими продуктовые решения по новому проекту.",
      "Проверь бизнес-логику проекта перед запуском.",
      "Сделай CEO review для идеи проекта.",
      "Определи приоритеты проекта в фабрике."
    ]
  },
  {
    "action_key": "project_factory_human_review",
    "action_name": "PF human review",
    "domain": "operations",
    "description": "Approvals gate (pf_human_review_gate).",
    "workflow_id": "98mKbvxMe6fM6i5h",
    "examples": [
      "Отправь проект на ручное согласование.",
      "Попроси человека проверить решение фабрики.",
      "Поставь проект на human review.",
      "Запроси подтверждение перед следующим этапом.",
      "Передай спорный результат на проверку оператору."
    ]
  },
  {
    "action_key": "project_factory_start",
    "action_name": "PF start / intake",
    "domain": "operations",
    "description": "Create project via pf_project_intake.",
    "workflow_id": "G3jEmUaRuMIj59az",
    "examples": [
      "Создай новый проект по идее сервиса для клиник.",
      "Запусти фабрику проекта по нише b2b обучение.",
      "Начни новый проект из брифа по закупкам.",
      "Оформи проект по идее AI ассистента.",
      "Запусти discovery для нового продукта."
    ]
  },
  {
    "action_key": "project_qa_agent",
    "action_name": "PF QA gate",
    "domain": "operations",
    "description": "Project Factory QA agent workflow (project_qa_agent); orchestration in pf_quality_gate.",
    "workflow_id": "MEtuRpQp5b9JPi8s",
    "examples": [
      "Проведи QA проверку проекта перед релизом.",
      "Проверь качество результата фабрики.",
      "Сделай тестирование проекта по чеклисту.",
      "Оцени готовность проекта к передаче клиенту.",
      "Запусти контроль качества по проекту."
    ]
  },
  {
    "action_key": "project_rag_ingest",
    "action_name": "PF RAG ingest",
    "domain": "operations",
    "description": "Full KB embedding ingest",
    "workflow_id": "cg6voYgyOuzAKVSn",
    "examples": [
      "Обнови базу знаний проекта из документов.",
      "Загрузи материалы проекта в поиск по знаниям.",
      "Переиндексируй документацию проекта.",
      "Добавь новые файлы проекта в базу знаний.",
      "Синхронизируй знания проекта после изменений."
    ]
  },
  {
    "action_key": "project_security_agent",
    "action_name": "PF Security gate",
    "domain": "operations",
    "description": "Project Factory security agent workflow (project_security_agent); orchestration in pf_quality_gate.",
    "workflow_id": "ve3XNpgoLCE7NZKh",
    "examples": [
      "Проверь безопасность проекта перед запуском.",
      "Сделай security gate для нового сервиса.",
      "Оцени риски доступа и секретов в проекте.",
      "Проведи проверку безопасности архитектуры.",
      "Запусти аудит безопасности проекта."
    ]
  },
  {
    "action_key": "compose_email",
    "action_name": "compose_email",
    "domain": "ops",
    "description": "Compose personalized email (subject/body_text/body_html) via WF13",
    "workflow_id": "I5MQvvH72efFChdZ",
    "examples": [
      "Подготовь письмо клиенту с предложением созвона.",
      "Напиши email поставщику с запросом цены.",
      "Составь письмо партнеру по итогам встречи.",
      "Подготовь follow-up письмо после демо.",
      "Напиши клиенту письмо о переносе сроков."
    ]
  },
  {
    "action_key": "delivery_ops",
    "action_name": "Delivery ops",
    "domain": "ops",
    "description": "Delivery templates: checklists, modules library, acceptance criteria, NPS process.",
    "workflow_id": "fHYSs5kelcr3q2lA",
    "examples": [
      "Подготовь чеклист приемки проекта для клиента.",
      "Собери план delivery на следующую неделю.",
      "Опиши критерии готовности модуля.",
      "Сделай шаблон процесса сдачи работ.",
      "Подготовь NPS процесс после внедрения."
    ]
  },
  {
    "action_key": "ops_documents",
    "action_name": "ops_documents",
    "domain": "ops",
    "description": "Universal document generator (PDF) by templates in a1_document_templates with numbering in a1_doc_counters; logs to a1_documents.",
    "workflow_id": "w3wc6QpU2uLjzJ6N",
    "examples": [
      "Сформируй договор по шаблону для клиента.",
      "Подготовь акт выполненных работ.",
      "Создай документ с регламентом обработки лидов.",
      "Сделай PDF предложение по шаблону.",
      "Подготовь служебную записку по проекту."
    ]
  },
  {
    "action_key": "prepare_multi_file_import",
    "action_name": "Подготовить единый файл для импорта из нескольких файлов/вкладок",
    "domain": "ops",
    "description": "Universal pre-import handler: reads multiple files and workbook tabs, consolidates them into one normalized single-sheet file, and returns prepared_file for downstream read_sheet/import.",
    "workflow_id": "y1Ueo6oGmQ6XiH60",
    "examples": [
      "Объедини несколько файлов поставщиков в один импорт.",
      "Подготовь единый файл из разных вкладок Excel.",
      "Собери несколько прайс-листов в одну таблицу.",
      "Нормализуй файлы клиентов перед загрузкой.",
      "Сконсолидируй несколько таблиц для импорта."
    ]
  },
  {
    "action_key": "read_sheet",
    "action_name": "Read sheet",
    "domain": "ops",
    "description": "Read tabular data from Google Sheet OR from file attachment (.xlsx/.csv). Use params.source_type = 'google_sheet' (spreadsheet_id, sheet_name) OR 'file' (file.path, file.filename, file.content_type). Output: rows, columns, row_count.",
    "workflow_id": "4f4sP1CakAKJCwoo",
    "examples": [
      "Прочитай таблицу с лидами из файла.",
      "Открой Google таблицу и покажи строки.",
      "Считай данные из приложенного Excel.",
      "Прочитай вкладку с оплатами.",
      "Посмотри таблицу поставщиков и верни колонки."
    ]
  },
  {
    "action_key": "send_email",
    "action_name": "send_email",
    "domain": "ops",
    "description": "Send email via gmail|smtp|email_api (WF27)",
    "workflow_id": "l1LJh5raGlb0DTnz",
    "examples": [
      "Отправь письмо клиенту с подтверждением встречи.",
      "Перешли КП на почту клиента.",
      "Отправь поставщику запрос коммерческого предложения.",
      "Направь менеджеру письмо с итогами.",
      "Отправь клиенту уведомление о счете."
    ]
  },
  {
    "action_key": "ops_coo",
    "action_name": "OPS COO",
    "domain": "orchestrator",
    "description": "Internal call to the real COO workflow router/orchestrator.",
    "workflow_id": "ppmeLsVg9vM6KTsm",
    "examples": [
      "Передай операционную задачу COO для исполнения.",
      "Разбей запрос на действия и запусти исполнение.",
      "Пусть COO выберет исполнителя и следующий шаг.",
      "Маршрутизируй операционный запрос по ответственным.",
      "Собери цепочку действий через COO."
    ]
  },
  {
    "action_key": "route_to_agent",
    "action_name": "Маршрутизация к агенту",
    "domain": "orchestrator",
    "description": "Передать управление WF4 (agent runner)",
    "workflow_id": "AGzcDadCtOflOM64",
    "examples": [
      "Передай этот диалог профильному агенту.",
      "Маршрутизируй запрос к нужному специалисту.",
      "Подключи агента по продажам для продолжения.",
      "Передай клиента агенту поддержки.",
      "Отправь вопрос профильному исполнителю."
    ]
  },
  {
    "action_key": "build_longchain_plan",
    "action_name": "Стратегический план",
    "domain": "planning",
    "description": "Build a strategic longchain plan that decomposes a complex objective into executable steps and handoffs.",
    "workflow_id": "TuQaTD49njBTia8t",
    "examples": [
      "Составь бизнес-план для нового направления.",
      "Разбей запуск продукта на цепочку действий.",
      "Подготовь стратегический план на квартал.",
      "Собери длинный план внедрения CRM.",
      "Составь roadmap запуска новой услуги."
    ]
  },
  {
    "action_key": "sql_query",
    "action_name": "SQL Query",
    "domain": "platform",
    "description": "Execute SQL via WF25. Supports registry queries (query_key) and raw SQL (query_key=raw_sql).",
    "workflow_id": "eRMLpNNOjRDZ17LS",
    "examples": [
      "Выбери из базы список клиентов без активности.",
      "Проверь в базе оплаты за вчера.",
      "Найди сделки без следующего шага.",
      "Посчитай количество лидов по стадиям.",
      "Обнови запись в базе по задаче после подтверждения."
    ]
  },
  {
    "action_key": "ops_suppliers_import",
    "action_name": "Импорт поставщиков",
    "domain": "procurement",
    "description": "Импорт и обновление поставщиков/прайсов/каталогов из файлов и enrichment/update режимы",
    "workflow_id": "mG2sWN2FKpv4DZvN",
    "examples": [
      "Импортируй поставщиков из приложенного файла.",
      "Загрузи прайс-лист поставщика в систему.",
      "Обнови каталог товаров по файлу поставщика.",
      "Добавь новых поставщиков из таблицы.",
      "Импортируй цены и артикулы из Excel."
    ]
  },
  {
    "action_key": "project_factory_dispatch",
    "action_name": "Project Factory Dispatcher",
    "domain": "project_factory",
    "description": "Deterministic stage engine for Project Factory.",
    "workflow_id": "8sL3ZTBGskN0Fes6",
    "examples": [
      "Переведи проект фабрики на следующий этап.",
      "Определи следующий шаг по проекту в фабрике.",
      "Запусти stage engine для проекта.",
      "Проверь статус проекта и продолжи процесс.",
      "Диспетчеризуй проект по текущему этапу."
    ]
  },
  {
    "action_key": "dadata_find_party",
    "action_name": "DaData find party",
    "domain": "sales",
    "description": "Поиск и обогащение компании через DaData",
    "workflow_id": "9uPId6cTXwQ4JN1p",
    "examples": [
      "Найди реквизиты компании по ИНН.",
      "Проверь юрлицо клиента и его данные.",
      "Обогати компанию Альфа по реквизитам.",
      "Найди официальное название компании.",
      "Проверь контрагента перед договором."
    ]
  },
  {
    "action_key": "lead_creation",
    "action_name": "Lead creation",
    "domain": "sales",
    "description": "Create a lead in connected Bitrix24 from natural sales request.",
    "workflow_id": "FKAELVdLqPQCbWGH",
    "examples": [
      "Создай лид по заявке клиента с сайта.",
      "Добавь новый лид: компания Альфа хочет демо.",
      "Заведи лид по входящему письму.",
      "Создай карточку потенциального клиента.",
      "Добавь лид в CRM для менеджера."
    ]
  },
  {
    "action_key": "ops_chekko",
    "action_name": "Checko",
    "domain": "sales",
    "description": "ДОПОЛНИТЕЛЬНЫЙ инструмент Checko API (https://checko.ru/integration/api): company (ИНН/ОГРН), search, contracts, finances. Предпочтительно после dadata_find_party. Полный JSON — в a1_customers.requisites.",
    "workflow_id": "1zTfcKEzjWHh3lGi",
    "examples": [
      "Проверь компанию через открытые реестры.",
      "Найди финансовые данные контрагента.",
      "Проверь надежность поставщика по ИНН.",
      "Посмотри контракты и выручку компании.",
      "Обогати юрлицо данными из внешних источников."
    ]
  },
  {
    "action_key": "sales_manager",
    "action_name": "Sales manager",
    "domain": "sales",
    "description": "Frontline sales executor for concrete lead/customer actions.",
    "workflow_id": "y7zsYXBZHXRJ7zdg",
    "examples": [
      "Подготовь следующий шаг по лиду Альфа.",
      "Обнови карточку клиента после звонка.",
      "Составь follow-up для менеджера по сделке.",
      "Переведи лид в работу и добавь заметку.",
      "Помоги менеджеру закрыть сделку с клиентом."
    ]
  },
  {
    "action_key": "sales_ops",
    "action_name": "Sales ops",
    "domain": "sales",
    "description": "Setup sales funnel ops: CRM-lite stages, follow-up cadence, templates, daily routines.",
    "workflow_id": "y7zsYXBZHXRJ7zdg",
    "examples": [
      "Настрой воронку продаж и стадии CRM.",
      "Собери процесс follow-up для отдела продаж.",
      "Подготовь шаблоны ежедневной работы менеджеров.",
      "Опиши рутину контроля лидов.",
      "Настрой операционный процесс продаж."
    ]
  },
  {
    "action_key": "ops_supply",
    "action_name": "Procurement / Supply",
    "domain": "scm",
    "description": "Unified ops_supply workflow",
    "workflow_id": "Hxmyv2PpfTCaE2lu",
    "examples": [
      "Создай закупочную заявку на ноутбуки.",
      "Запроси цены у поставщиков оборудования.",
      "Выбери поставщика по цене и срокам.",
      "Обнови статус заказа на поставку.",
      "Проведи закупку расходных материалов."
    ]
  },
  {
    "action_key": "append_rows_sheet",
    "action_name": "Добавить строки",
    "domain": "sheets",
    "description": "Append normalized flat rows into an existing spreadsheet tab for logging or report export.",
    "workflow_id": "4f4sP1CakAKJCwoo",
    "examples": [
      "Добавь новые строки в таблицу лидов.",
      "Запиши результаты звонков в существующую таблицу.",
      "Добавь оплаты за сегодня в лист.",
      "Внеси поставщиков в текущую таблицу.",
      "Дополни таблицу задач новыми строками."
    ]
  },
  {
    "action_key": "create_table_sheet",
    "action_name": "Создать таблицу",
    "domain": "sheets",
    "description": "Create a spreadsheet or tab for structured export and return identifiers for downstream writes.",
    "workflow_id": "4f4sP1CakAKJCwoo",
    "examples": [
      "Создай таблицу для контроля оплат.",
      "Заведи новый лист для лидов вебинара.",
      "Сделай таблицу учета поставщиков.",
      "Создай spreadsheet для плана продаж.",
      "Подготовь таблицу для импортированных клиентов."
    ]
  },
  {
    "action_key": "ops_support_executor",
    "action_name": "Support Executor",
    "domain": "support",
    "description": "Support cases",
    "workflow_id": "JEW5W59JLhRaHhQl",
    "examples": [
      "Создай обращение поддержки от клиента.",
      "Открой support case по жалобе клиента.",
      "Зафиксируй запрос клиента в поддержку.",
      "Обнови статус обращения поддержки.",
      "Создай кейс по проблеме пользователя."
    ]
  },
  {
    "action_key": "ops_support_lpr",
    "action_name": "Support LPR",
    "domain": "support",
    "description": "Helpdesk via ops_llm",
    "workflow_id": "JEW5W59JLhRaHhQl",
    "examples": [
      "Классифицируй обращение клиента в поддержку.",
      "Определи приоритет support запроса.",
      "Реши, кому передать жалобу клиента.",
      "Разбери обращение и предложи маршрут.",
      "Оцени срочность клиентской проблемы."
    ]
  },
  {
    "action_key": "create_task",
    "action_name": "Создать задачу",
    "domain": "tasks",
    "description": "Создать запись в a1_tasks",
    "workflow_id": "XL0vjlKkx3Ti4IfY",
    "examples": [
      "Создай задачу менеджеру связаться с клиентом.",
      "Поставь задачу бухгалтерии проверить оплату.",
      "Открой задачу юристу согласовать договор.",
      "Создай задачу COO проверить просрочки.",
      "Поставь задачу подготовить материалы к встрече."
    ]
  },
  {
    "action_key": "ops_voice_call",
    "action_name": "Голосовой gateway handler",
    "domain": "voice",
    "description": "3 режима: исходящий звонок, post-call анализ, company-relevant sync.",
    "workflow_id": "6KOSpVFkYzwH0wzB",
    "examples": [
      "Запланируй исходящий звонок клиенту.",
      "Разбери запись звонка и добавь итоги.",
      "Синхронизируй результаты телефонного разговора.",
      "Подготовь анализ звонка менеджера.",
      "Создай задачу после разговора с клиентом."
    ]
  }
]
