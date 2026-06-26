/**
 * Курируемый каталог режимов по отделам (Операции + Отчёты).
 * Текст запроса ЗАШИТ в код (request) и пользователю не показывается — он заполняет только поля.
 * Значения полей подставляются в шаблон, готовый запрос уходит в пайплайн через ms_in_take,
 * результат приходит в окно COO и в Telegram. Тексты — из канонических сценариев a1-dev-ops/knowledge-base.
 */

export type FieldType = 'text' | 'number' | 'textarea' | 'date' | 'select' | 'db-select' | 'checkbox'

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  help?: string
  default?: string
  options?: { value: string; label: string }[]
  source?: 'clients' | 'deals' | 'leads'
  optionLabel?: string
  optionValue?: string
}

export interface DeptMode {
  id: string
  label: string
  description: string
  group: 'ops' | 'report'
  fields: FieldDef[]
  /** скрытый шаблон: собирает текст запроса из значений (v) и названий выбранных из БД записей (labels) */
  request: (v: Record<string, string>, labels: Record<string, string>) => string
}

export const GROUP_LABELS: Record<string, string> = { ops: 'Операции', report: 'Отчёты' }

const PERIOD: FieldDef = {
  name: 'period', label: 'Период', type: 'select', default: 'текущий месяц',
  options: [
    { value: 'сегодня', label: 'Сегодня' },
    { value: 'неделю', label: 'Неделя' },
    { value: 'текущий месяц', label: 'Текущий месяц' },
    { value: 'квартал', label: 'Квартал' },
  ],
}
const clientField = (req = true): FieldDef => ({ name: 'client', label: 'Клиент', type: 'db-select', source: 'clients', optionValue: 'id', optionLabel: 'name', required: req })
const leadField = (req = true): FieldDef => ({ name: 'lead', label: 'Лид', type: 'db-select', source: 'leads', optionValue: 'id', optionLabel: 'title', required: req })
const dealField = (req = true): FieldDef => ({ name: 'deal', label: 'Сделка', type: 'db-select', source: 'deals', optionValue: 'id', optionLabel: 'title', required: req })

const nm = (labels: Record<string, string>, v: Record<string, string>, key: string) => labels[key] || v[key] || ''
const amt = (v: Record<string, string>) => String(v.amount ?? '').replace(/\s/g, '').replace(',', '.')

const FINANCE: DeptMode[] = [
  // ——— Операции ———
  {
    id: 'issue_invoice', label: 'Выставить счёт', group: 'ops',
    description: 'Сформировать счёт на оплату клиенту (номер + PDF), при необходимости отправить.',
    fields: [
      clientField(),
      { name: 'amount', label: 'Сумма, ₽', type: 'number', required: true },
      { name: 'purpose', label: 'Назначение', type: 'text', placeholder: 'внедрение A1' },
      { name: 'due_date', label: 'Срок оплаты', type: 'date' },
      { name: 'send', label: 'Отправить клиенту', type: 'checkbox' },
    ],
    request: (v, l) => {
      let s = `Выставь счёт клиенту «${nm(l, v, 'client')}» на ${amt(v)} рублей`
      if (v.purpose) s += ` за ${v.purpose}`
      if (v.due_date) s += `, срок оплаты ${v.due_date}`
      s += '.'
      if (v.send === 'on') s += ' Отправь счёт клиенту.'
      return s
    },
  },
  {
    id: 'yookassa_payment', label: 'Платёж YooKassa', group: 'ops',
    description: 'Создать онлайн-платёж в ЮKassa и получить ссылку на оплату.',
    fields: [
      { name: 'amount', label: 'Сумма, ₽', type: 'number', required: true },
      { name: 'description', label: 'Назначение', type: 'text', required: true, placeholder: 'подписка A1' },
      { name: 'email', label: 'Email клиента', type: 'text', placeholder: 'client@example.com' },
    ],
    request: (v) => {
      let s = `Создай платёж в ЮKassa на ${amt(v)} рублей за ${v.description}`
      if (v.email) s += `, email клиента ${v.email}`
      return s + '. Верни ссылку на оплату.'
    },
  },
  {
    id: 'record_transaction', label: 'Записать операцию', group: 'ops',
    description: 'Зафиксировать доход или расход по счёту компании.',
    fields: [
      { name: 'direction', label: 'Тип', type: 'select', default: 'расход', options: [{ value: 'расход', label: 'Расход' }, { value: 'доход', label: 'Доход' }] },
      { name: 'amount', label: 'Сумма, ₽', type: 'number', required: true },
      { name: 'category', label: 'Категория', type: 'text', required: true, placeholder: 'аренда / реклама / зарплата' },
      { name: 'date', label: 'Дата', type: 'date' },
    ],
    request: (v) => {
      let s = `Запиши ${v.direction || 'расход'} на ${amt(v)} рублей, категория ${v.category}`
      if (v.date) s += `, дата ${v.date}`
      return s + '.'
    },
  },
  {
    id: 'create_obligation', label: 'Создать обязательство', group: 'ops',
    description: 'Плановое обязательство к оплате (разовое или регулярное).',
    fields: [
      { name: 'counterparty', label: 'Контрагент', type: 'text', required: true, placeholder: 'Арендодатель' },
      { name: 'amount', label: 'Сумма, ₽', type: 'number', required: true },
      { name: 'due_date', label: 'Срок оплаты', type: 'date' },
      { name: 'recurrence', label: 'Периодичность', type: 'select', default: 'разовое', options: [{ value: 'разовое', label: 'Разовое' }, { value: 'ежемесячно', label: 'Ежемесячно' }, { value: 'ежеквартально', label: 'Ежеквартально' }] },
    ],
    request: (v) => {
      const rec = v.recurrence && v.recurrence !== 'разовое' ? ` (${v.recurrence})` : ''
      let s = `Добавь финансовое обязательство на оплату «${v.counterparty}» на ${amt(v)} рублей`
      if (v.due_date) s += `, срок ${v.due_date}`
      return s + rec + '.'
    },
  },
  {
    id: 'mark_obligation_paid', label: 'Отметить оплату обязательства', group: 'ops',
    description: 'Пометить обязательство как оплаченное.',
    fields: [
      { name: 'obligation', label: 'Обязательство', type: 'text', required: true, placeholder: 'аренда офиса за июнь' },
      { name: 'amount', label: 'Сумма оплаты, ₽', type: 'number' },
    ],
    request: (v) => `Отметь обязательство «${v.obligation}» как оплаченное${v.amount ? ` на сумму ${amt(v)} рублей` : ''}.`,
  },
  {
    id: 'billing_event', label: 'Событие биллинга', group: 'ops',
    description: 'Занести событие биллинга по оплате/подписке клиента.',
    fields: [clientField(), { name: 'amount', label: 'Сумма, ₽', type: 'number', required: true }],
    request: (v, l) => `Занеси событие биллинга по оплате клиента «${nm(l, v, 'client')}» на ${amt(v)} рублей.`,
  },
  {
    id: 'bank_statement', label: 'Банковская выписка (Сбер)', group: 'ops',
    description: 'Проверить выписку и поступления на расчётный счёт.',
    fields: [{ name: 'period', label: 'Период', type: 'select', default: 'вчера', options: [{ value: 'вчера', label: 'Вчера' }, { value: 'сегодня', label: 'Сегодня' }, { value: 'неделю', label: 'Неделя' }] }],
    request: (v) => `Проверь банковскую выписку и поступления на расчётный счёт за ${v.period || 'вчера'}.`,
  },
  {
    id: 'erp_reconciliation', label: 'Сверка с ERP', group: 'ops',
    description: 'Сверить биллинг с учётной системой, найти расхождения.',
    fields: [PERIOD],
    request: (v) => `Сверь биллинг с учётной системой за ${v.period} и покажи расхождения между оплатами и актами.`,
  },
  // ——— Отчёты ———
  { id: 'finance_morning_brief', label: 'Утренняя финансовая сводка', group: 'report', description: 'Краткая сводка состояния финансов на сегодня.', fields: [], request: () => 'Сделай утреннюю финансовую сводку.' },
  { id: 'cashflow', label: 'Движение денег (cash flow)', group: 'report', description: 'Поступления и расходы за период.', fields: [PERIOD], request: (v) => `Построй отчёт по движению денежных средств (cash flow) за ${v.period}.` },
  { id: 'ar_control', label: 'Дебиторка и просрочки', group: 'report', description: 'AR control: задолженности и просроченные оплаты.', fields: [], request: () => 'Покажи AR control: дебиторку и просрочки по оплатам.' },
  { id: 'cash_gap', label: 'Кассовый разрыв', group: 'report', description: 'Прогноз кассового разрыва до конца периода.', fields: [], request: () => 'Проверь кассовый разрыв до конца месяца.' },
  { id: 'billing_7d', label: 'События биллинга за 7 дней', group: 'report', description: 'Лента биллинг-событий за неделю.', fields: [], request: () => 'Покажи billing-события за 7 дней.' },
  { id: 'expenses', label: 'Расходы по категориям', group: 'report', description: 'Структура расходов за период.', fields: [PERIOD], request: (v) => `Построй отчёт по расходам в разрезе категорий за ${v.period}.` },
  { id: 'plan_fact', label: 'План/факт', group: 'report', description: 'Сравнение плановых и фактических показателей.', fields: [PERIOD], request: (v) => `Сформируй отчёт план/факт за ${v.period}.` },
  { id: 'finance_month', label: 'Финансовый отчёт за месяц', group: 'report', description: 'Сводный отчёт: cashflow, дебиторка, обязательства.', fields: [], request: () => 'Собери отчёт по финансам за месяц: cashflow, дебиторка, обязательства.' },
]

const SALES: DeptMode[] = [
  // ——— Операции ———
  {
    id: 'lead_create', label: 'Создать лид', group: 'ops',
    description: 'Завести новый лид по заявке/контакту.',
    fields: [
      { name: 'company', label: 'Компания', type: 'text', required: true, placeholder: 'ООО Альфа' },
      { name: 'contact', label: 'Контакт', type: 'text', placeholder: 'Иван, +7900…' },
      { name: 'note', label: 'Комментарий', type: 'textarea', placeholder: 'хочет демо A1' },
    ],
    request: (v) => {
      let s = `Создай лид: компания «${v.company}» хочет демо A1`
      if (v.contact) s += `, контакт ${v.contact}`
      if (v.note) s += `. ${v.note}`
      return s + '.'
    },
  },
  {
    id: 'leadgen_launch', label: 'Запустить лидогенерацию', group: 'ops',
    description: 'Подобрать потенциальных клиентов (без холодной отправки).',
    fields: [
      { name: 'similar_to', label: 'Похоже на клиента', type: 'text', placeholder: 'ООО Гамма Логистик' },
      { name: 'count', label: 'Сколько подобрать', type: 'number', default: '5' },
    ],
    request: (v) => `Запусти лидогенерацию: подбери ${v.count || '5'} потенциальных клиентов по похожести на «${v.similar_to || 'наших клиентов'}», только исследование, без отправки сообщений.`,
  },
  { id: 'next_step', label: 'Следующий шаг по лиду', group: 'ops', description: 'Предложить лучший следующий шаг менеджеру.', fields: [leadField()], request: (v, l) => `Найди лид «${nm(l, v, 'lead')}» и предложи следующий лучший шаг для менеджера без отправки клиенту.` },
  {
    id: 'lead_stage', label: 'Сменить стадию лида', group: 'ops',
    description: 'Перевести лид на новую стадию с указанием причины.',
    fields: [
      leadField(),
      { name: 'stage', label: 'Новая стадия', type: 'select', default: 'квалификация', options: [{ value: 'квалификация', label: 'Квалификация' }, { value: 'в работу', label: 'В работе' }, { value: 'предложение', label: 'Предложение' }, { value: 'успешный', label: 'Успешный' }, { value: 'отказ', label: 'Отказ' }] },
      { name: 'reason', label: 'Причина', type: 'text', placeholder: 'клиент подтвердил интерес' },
    ],
    request: (v, l) => `Переведи лид «${nm(l, v, 'lead')}» в ${v.stage}${v.reason ? `, причина: ${v.reason}` : ''}.`,
  },
  { id: 'meeting_result', label: 'Зафиксировать встречу', group: 'ops', description: 'Записать итог встречи и договорённости.', fields: [leadField(), { name: 'result', label: 'Итог встречи', type: 'textarea', required: true, placeholder: 'клиенту интересен пилот, просит КП и счёт' }], request: (v, l) => `По лиду «${nm(l, v, 'lead')}» зафиксируй результат встречи: ${v.result}.` },
  { id: 'follow_up', label: 'Назначить follow-up', group: 'ops', description: 'Поставить задачу-напоминание по лиду в CRM.', fields: [leadField(), { name: 'when', label: 'Когда', type: 'text', required: true, placeholder: 'завтра в 14:00' }, { name: 'owner', label: 'Ответственный', type: 'text', placeholder: 'Иван Трушков' }], request: (v, l) => `Назначь follow-up по лиду «${nm(l, v, 'lead')}» на ${v.when}${v.owner ? ` для ${v.owner}` : ''} и сохрани в CRM.` },
  { id: 'email_draft', label: 'Письмо по лиду (черновик)', group: 'ops', description: 'Подготовить письмо клиенту без отправки.', fields: [leadField(), { name: 'about', label: 'О чём письмо', type: 'textarea', placeholder: 'резюме пользы A1' }], request: (v, l) => `Подготовь письмо клиенту по лиду «${nm(l, v, 'lead')}»: ${v.about || 'краткое резюме пользы A1'}, но не отправляй.` },
  { id: 'email_send', label: 'Сформировать и отправить письмо', group: 'ops', description: 'Составить и отправить письмо клиенту по лиду.', fields: [leadField(), { name: 'about', label: 'О чём письмо', type: 'textarea', placeholder: 'резюме пользы A1 и приглашение на встречу' }], request: (v, l) => `Сформируй и отправь письмо клиенту по лиду «${nm(l, v, 'lead')}»: ${v.about || 'резюме пользы A1 и приглашение на встречу'}.` },
  { id: 'proposal_pdf', label: 'Коммерческое предложение (PDF)', group: 'ops', description: 'Сформировать КП в PDF по лиду.', fields: [leadField(), { name: 'amount', label: 'Сумма, ₽', type: 'number', required: true }], request: (v, l) => `Сформируй коммерческое предложение в PDF по лиду «${nm(l, v, 'lead')}» на внедрение A1 на сумму ${amt(v)} рублей.` },
  { id: 'deal_create', label: 'Создать сделку из лида', group: 'ops', description: 'Завести сделку из лида и назначить ответственного.', fields: [leadField(), { name: 'owner', label: 'Ответственный', type: 'text', placeholder: 'Иван Трушков' }], request: (v, l) => `Создай сделку из лида «${nm(l, v, 'lead')}»${v.owner ? `, ответственный ${v.owner}` : ''}, проверь синхронизацию с Bitrix.` },
  {
    id: 'deal_stage', label: 'Обновить стадию сделки', group: 'ops', description: 'Сменить стадию сделки и записать следующий шаг.',
    fields: [dealField(), { name: 'stage', label: 'Новая стадия', type: 'text', required: true, placeholder: 'подготовка предложения' }, { name: 'next', label: 'Следующий шаг', type: 'text' }],
    request: (v, l) => `По сделке «${nm(l, v, 'deal')}» обнови стадию на ${v.stage}${v.next ? ` и запиши следующий шаг: ${v.next}` : ''}.`,
  },
  {
    id: 'deal_close', label: 'Завершить сделку', group: 'ops', description: 'Закрыть сделку (выиграна/проиграна), зафиксировать итог.',
    fields: [dealField(), { name: 'outcome', label: 'Итог', type: 'select', default: 'успешно выигранную', options: [{ value: 'успешно выигранную', label: 'Выиграна' }, { value: 'проигранную', label: 'Проиграна' }] }, { name: 'result', label: 'Комментарий', type: 'text' }],
    request: (v, l) => `Заверши сделку «${nm(l, v, 'deal')}» как ${v.outcome}${v.result ? `, ${v.result}` : ''}. Проверь отражение в Bitrix.`,
  },
  { id: 'dadata', label: 'Реквизиты по ИНН', group: 'ops', description: 'Найти юрлицо и реквизиты контрагента по ИНН.', fields: [{ name: 'inn', label: 'ИНН', type: 'text', required: true, placeholder: '7700000000' }], request: (v) => `Найди реквизиты компании по ИНН ${v.inn} и проверь данные клиента.` },
  { id: 'sales_profile', label: 'Профиль клиента для продаж', group: 'ops', description: 'Собрать профиль: контакты, ЛПР, риски, следующий шаг.', fields: [clientField()], request: (v, l) => `По клиенту «${nm(l, v, 'client')}» собери профиль для продаж: контакты, ЛПР, недостающие поля, риск и следующий шаг.` },
  // ——— Отчёты ———
  { id: 'sales_morning_brief', label: 'Утренняя сводка продаж', group: 'report', description: 'Краткая сводка по продажам на сегодня.', fields: [], request: () => 'Сделай утреннюю сводку по продажам.' },
  { id: 'leads_overview', label: 'Сводка по лидам', group: 'report', description: 'Лиды за период: новые, в работе, без шага, по менеджерам.', fields: [PERIOD], request: (v) => `Сделай сводку по лидам за ${v.period}: сколько новых, в работе, без следующего шага, разбивка по менеджерам и краткий план фокуса.` },
  { id: 'pipeline_dashboard', label: 'Дашборд воронки', group: 'report', description: 'Воронка по менеджерам и стадиям, конверсия.', fields: [PERIOD], request: (v) => `Покажи дашборд по новым лидам и сделкам за ${v.period}: менеджеры, стадии, конверсия лидов в сделки, проблемы и план.` },
  { id: 'open_deals', label: 'Открытые сделки', group: 'report', description: 'Открытые сделки: суммы, стадии, что застряло.', fields: [{ name: 'owner', label: 'Менеджер (опц.)', type: 'text', placeholder: 'Иван Трушков' }], request: (v) => `Подготовь отчёт по открытым сделкам${v.owner ? ` «${v.owner}»` : ''}: суммы, стадии, что застряло, какие следующие действия нужны.` },
  { id: 'crm_hygiene', label: 'CRM hygiene', group: 'report', description: 'Качество данных CRM: незаполненные поля, лиды без шага.', fields: [], request: () => 'Покажи CRM hygiene по лидам: незаполненные поля и лиды без следующего шага.' },
  { id: 'meetings_activity', label: 'Активность встреч', group: 'report', description: 'Встречи отдела продаж за неделю.', fields: [], request: () => 'Покажи встречи sales за неделю.' },
  { id: 'sales_export', label: 'Отчёт PDF/Excel', group: 'report', description: 'Выгрузка по продажам в PDF и Excel.', fields: [PERIOD], request: (v) => `Сделай PDF и Excel отчёт по продажам за ${v.period} с таблицей лидов, сделок, менеджеров, рисков и рекомендаций.` },
]

export const DEPARTMENT_MODES: Record<string, DeptMode[]> = {
  finance: FINANCE,
  sales: SALES,
}
