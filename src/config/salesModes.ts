/**
 * Режимы блока «Продажи». Все идут в LLM-движок ops_sales (workflow y7zsYXBZHXRJ7zdg),
 * операция передаётся в operation (state_engine|recovery_engine|reports), а из полей формы
 * собирается текст-запрос (buildMessage → params.user_message).
 */

import type { ActionMode } from './modeTypes'

const WF_SALES = 'y7zsYXBZHXRJ7zdg'

export const SALES_MODES: ActionMode[] = [
  {
    id: 'process_deal',
    label: 'Обработать сделку',
    description: 'Sales Manager анализирует сделку и предлагает следующий шаг / готовит ответ клиенту.',
    group: 'work',
    action_key: 'sales_ops',
    workflow_id: WF_SALES,
    operation: 'state_engine',
    fields: [
      { name: 'deal_id', label: 'Сделка', type: 'db-select', source: 'deals', optionValue: 'id', optionLabel: 'title', help: 'Из воронки' },
      { name: 'instruction', label: 'Что сделать', type: 'textarea', required: true, placeholder: 'Подготовь следующий шаг и черновик ответа клиенту' },
    ],
    buildMessage: (v, labels) => {
      const parts = ['Обработай сделку как Sales Manager']
      if (labels?.deal_id) parts.push(`сделка «${labels.deal_id}»`)
      let s = parts.join(', ') + '.'
      if (v.instruction) s += ' ' + v.instruction
      return s
    },
  },
  {
    id: 'reactivate',
    label: 'Реактивация лида',
    description: 'Повторно вовлечь «остывший» лид: подготовить касание и сообщение.',
    group: 'work',
    action_key: 'sales_ops',
    workflow_id: WF_SALES,
    operation: 'recovery_engine',
    fields: [
      { name: 'lead_id', label: 'Лид', type: 'db-select', source: 'leads', optionValue: 'id', optionLabel: 'title' },
      { name: 'note', label: 'Контекст / повод', type: 'textarea', placeholder: 'Скидка к концу месяца, новый кейс и т.п.' },
    ],
    buildMessage: (v, labels) => {
      const parts = ['Реактивируй лид (recovery)']
      if (labels?.lead_id) parts.push(`лид «${labels.lead_id}»`)
      let s = parts.join(', ') + '.'
      if (v.note) s += ' Повод: ' + v.note
      return s
    },
  },
  {
    id: 'sales_report',
    label: 'Отчёт по продажам',
    description: 'Сводка: воронка, выручка, конверсия за период.',
    group: 'report',
    action_key: 'sales_ops',
    workflow_id: WF_SALES,
    operation: 'reports',
    fields: [
      { name: 'period', label: 'Период', type: 'select', default: 'month', options: [
        { value: 'month', label: 'Текущий месяц' }, { value: 'quarter', label: 'Квартал' }, { value: '30d', label: '30 дней' },
      ] },
    ],
    buildMessage: (v) => `Сделай сводный отчёт по продажам за ${v.period === 'quarter' ? 'квартал' : v.period === '30d' ? 'последние 30 дней' : 'текущий месяц'}: воронка, выручка, конверсия.`,
  },
]
