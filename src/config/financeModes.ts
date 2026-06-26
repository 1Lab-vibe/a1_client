/**
 * Каталог финансовых режимов для раздела OPS → Финансы.
 * Каждый режим = запуск конкретного хендлера (workflow_id) с операцией и набором полей.
 * Поля заполняются формой; часть — выбором из БД (clients/deals). Для LLM-хендлера ops_finance
 * из полей собирается текст-запрос (buildMessage), который кладётся в params.user_message.
 *
 * workflow_id берутся из карточек действий getOpsDepartment (отдел finances), см. docs/N8N_ACTION_RUNNER.md.
 */

import type { ActionMode } from './modeTypes'
export type { FieldDef } from './modeTypes'
export type FinanceMode = ActionMode

// workflow_id финансовых хендлеров (prod)
const WF = {
  issue_invoice: '8zwRIxxijdq2JDDu',
  yookassa: 'ic2ycjtwKCWfgjDq',
  ops_finance: 'qD172IZJGkaQCW6c',
} as const

const num = (v: string) => String(v ?? '').replace(/\s/g, '').replace(',', '.')

export const FINANCE_MODES: ActionMode[] = [
  {
    id: 'issue_invoice',
    label: 'Выписать счёт',
    description: 'Сформировать счёт на оплату (номер + PDF), при необходимости отправить клиенту.',
    group: 'write',
    action_key: 'issue_invoice',
    workflow_id: WF.issue_invoice,
    confirm: true,
    fields: [
      { name: 'amount', label: 'Сумма', type: 'number', required: true, placeholder: '5900' },
      { name: 'currency', label: 'Валюта', type: 'select', default: 'RUB', options: [
        { value: 'RUB', label: 'RUB' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' },
      ] },
      { name: 'customer_id', label: 'Клиент', type: 'db-select', source: 'clients', optionValue: 'id', optionLabel: 'name', help: 'Из базы клиентов' },
      { name: 'deal_id', label: 'Сделка (опц.)', type: 'db-select', source: 'deals', optionValue: 'id', optionLabel: 'title' },
      { name: 'title', label: 'Назначение', type: 'text', placeholder: 'Услуги по счёту' },
      { name: 'due_date', label: 'Срок оплаты', type: 'date' },
      { name: 'to_email', label: 'Email для отправки (опц.)', type: 'text', placeholder: 'client@example.com' },
      { name: 'send_now', label: 'Отправить клиенту сразу', type: 'checkbox', default: '' },
    ],
    buildMessage: (v, labels) => {
      const cur = v.currency || 'RUB'
      const parts = [`Выставь счёт на сумму ${num(v.amount)} ${cur}`]
      if (labels?.customer_id) parts.push(`клиенту «${labels.customer_id}»`)
      if (labels?.deal_id) parts.push(`по сделке «${labels.deal_id}»`)
      if (v.title) parts.push(`назначение: ${v.title}`)
      if (v.due_date) parts.push(`срок оплаты ${v.due_date}`)
      let s = parts.join(', ') + '.'
      if (v.send_now === 'on') s += v.to_email ? ` Отправь клиенту на ${v.to_email}.` : ' Отправь счёт клиенту.'
      return s
    },
  },
  {
    id: 'yookassa_payment',
    label: 'Выполнить платёж (YooKassa)',
    description: 'Создать платёж в YooKassa и получить ссылку на оплату.',
    group: 'write',
    action_key: 'ms_integration_yookassa',
    workflow_id: WF.yookassa,
    operation: 'create_payment',
    confirm: true,
    fields: [
      { name: 'amount', label: 'Сумма', type: 'number', required: true, placeholder: '5900' },
      { name: 'currency', label: 'Валюта', type: 'select', default: 'RUB', options: [
        { value: 'RUB', label: 'RUB' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' },
      ] },
      { name: 'description', label: 'Описание', type: 'text', required: true, placeholder: 'Оплата подписки A1' },
      { name: 'customer_email', label: 'Email клиента', type: 'text', placeholder: 'client@example.com' },
      { name: 'return_url', label: 'URL возврата', type: 'text', default: 'https://a1.a1os.ru/payment/return' },
    ],
    buildMessage: (v) => {
      const cur = v.currency || 'RUB'
      const parts = [`Создай платёж в YooKassa на сумму ${num(v.amount)} ${cur}`]
      if (v.description) parts.push(`описание: ${v.description}`)
      if (v.customer_email) parts.push(`email клиента ${v.customer_email}`)
      return parts.join(', ') + '. Верни ссылку на оплату.'
    },
  },
  {
    id: 'record_transaction',
    label: 'Записать транзакцию',
    description: 'Зафиксировать доход или расход по счёту компании.',
    group: 'write',
    action_key: 'ops_finance',
    workflow_id: WF.ops_finance,
    operation: 'record_transaction',
    fields: [
      { name: 'direction', label: 'Тип', type: 'select', default: 'expense', options: [
        { value: 'expense', label: 'Расход' }, { value: 'income', label: 'Доход' },
      ] },
      { name: 'amount', label: 'Сумма', type: 'number', required: true, placeholder: '5000' },
      { name: 'category', label: 'Категория', type: 'text', required: true, placeholder: 'аренда / реклама / зарплата' },
      { name: 'account', label: 'Счёт', type: 'text', placeholder: 'основной' },
      { name: 'date', label: 'Дата', type: 'date' },
      { name: 'note', label: 'Комментарий', type: 'textarea' },
    ],
    buildMessage: (v) => {
      const dir = v.direction === 'income' ? 'доход' : 'расход'
      const parts = [`Запиши ${dir} на сумму ${num(v.amount)} ${'RUB'}`]
      if (v.category) parts.push(`категория ${v.category}`)
      if (v.account) parts.push(`счёт ${v.account}`)
      if (v.date) parts.push(`дата ${v.date}`)
      let s = parts.join(', ') + '.'
      if (v.note) s += ' ' + v.note
      return s
    },
  },
  {
    id: 'create_obligation',
    label: 'Создать обязательство',
    description: 'Плановое обязательство к оплате (разовое или регулярное).',
    group: 'write',
    action_key: 'ops_finance',
    workflow_id: WF.ops_finance,
    operation: 'create_obligation',
    fields: [
      { name: 'counterparty', label: 'Контрагент', type: 'text', required: true, placeholder: 'Арендодатель' },
      { name: 'amount', label: 'Сумма', type: 'number', required: true, placeholder: '50000' },
      { name: 'due_date', label: 'Срок оплаты', type: 'date' },
      { name: 'recurrence', label: 'Периодичность', type: 'select', default: 'none', options: [
        { value: 'none', label: 'Разовое' }, { value: 'monthly', label: 'Ежемесячно' }, { value: 'quarterly', label: 'Ежеквартально' },
      ] },
      { name: 'note', label: 'Комментарий', type: 'textarea' },
    ],
    buildMessage: (v) => {
      const rec = v.recurrence === 'monthly' ? ' ежемесячно' : v.recurrence === 'quarterly' ? ' ежеквартально' : ''
      const parts = [`Создай${rec ? ' регулярное' : ''} обязательство перед «${v.counterparty}» на сумму ${num(v.amount)} RUB`]
      if (v.due_date) parts.push(`срок ${v.due_date}`)
      let s = parts.join(', ') + rec + '.'
      if (v.note) s += ' ' + v.note
      return s
    },
  },
  {
    id: 'mark_obligation_paid',
    label: 'Отметить оплату обязательства',
    description: 'Пометить обязательство как оплаченное.',
    group: 'write',
    action_key: 'ops_finance',
    workflow_id: WF.ops_finance,
    operation: 'mark_obligation_paid',
    fields: [
      { name: 'obligation', label: 'Обязательство', type: 'text', required: true, placeholder: 'Аренда офиса за июнь' },
      { name: 'amount', label: 'Сумма оплаты', type: 'number', placeholder: '50000' },
      { name: 'date', label: 'Дата оплаты', type: 'date' },
    ],
    buildMessage: (v) => {
      const parts = [`Отметь обязательство «${v.obligation}» как оплаченное`]
      if (v.amount) parts.push(`сумма ${num(v.amount)} RUB`)
      if (v.date) parts.push(`дата ${v.date}`)
      return parts.join(', ') + '.'
    },
  },
  // ——— Отчёты через ops_finance (LLM) ———
  {
    id: 'report_cashflow',
    label: 'Отчёт: движение денег (cash flow)',
    description: 'Сводка поступлений и расходов за период.',
    group: 'report',
    action_key: 'ops_finance',
    workflow_id: WF.ops_finance,
    operation: 'build_cashflow_report',
    fields: [
      { name: 'period', label: 'Период', type: 'select', default: 'month', options: [
        { value: 'month', label: 'Текущий месяц' }, { value: 'quarter', label: 'Квартал' }, { value: '30d', label: '30 дней' },
      ] },
    ],
    buildMessage: (v) => `Построй отчёт по движению денежных средств (cash flow) за ${v.period === 'quarter' ? 'квартал' : v.period === '30d' ? 'последние 30 дней' : 'текущий месяц'}.`,
  },
  {
    id: 'report_plan_fact',
    label: 'Отчёт: план/факт',
    description: 'Сравнение плановых и фактических показателей.',
    group: 'report',
    action_key: 'ops_finance',
    workflow_id: WF.ops_finance,
    operation: 'build_plan_fact_report',
    fields: [
      { name: 'period', label: 'Период', type: 'select', default: 'month', options: [
        { value: 'month', label: 'Текущий месяц' }, { value: 'quarter', label: 'Квартал' },
      ] },
    ],
    buildMessage: (v) => `Построй отчёт план/факт за ${v.period === 'quarter' ? 'квартал' : 'текущий месяц'}.`,
  },
  {
    id: 'report_expenses',
    label: 'Отчёт: расходы по категориям',
    description: 'Структура расходов за период.',
    group: 'report',
    action_key: 'ops_finance',
    workflow_id: WF.ops_finance,
    operation: 'build_expenses_report',
    fields: [
      { name: 'period', label: 'Период', type: 'select', default: 'month', options: [
        { value: 'month', label: 'Текущий месяц' }, { value: 'quarter', label: 'Квартал' }, { value: '30d', label: '30 дней' },
      ] },
    ],
    buildMessage: (v) => `Построй отчёт по расходам в разрезе категорий за ${v.period === 'quarter' ? 'квартал' : v.period === '30d' ? 'последние 30 дней' : 'текущий месяц'}.`,
  },
  {
    id: 'accounts_summary',
    label: 'Остатки по счетам',
    description: 'Текущие остатки и сводка по счетам компании.',
    group: 'report',
    action_key: 'ops_finance',
    workflow_id: WF.ops_finance,
    operation: 'accounts_summary',
    fields: [],
    buildMessage: () => 'Покажи текущие остатки и сводку по счетам компании.',
  },
]
