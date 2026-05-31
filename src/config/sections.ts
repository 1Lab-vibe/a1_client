import type { NavSection } from '../types'

export const DEFAULT_SECTIONS: NavSection[] = [
  { id: 'coo', label: 'COO', icon: 'bot' },
  {
    id: 'crm',
    label: 'CRM',
    icon: 'chart',
    children: [
      { id: 'dashboard', label: 'Дашборд' },
      { id: 'leads', label: 'Лиды' },
      { id: 'deals', label: 'Сделки' },
      { id: 'clients', label: 'Клиенты' },
      { id: 'invoices', label: 'Счета' },
    ],
  },
  { id: 'reports', label: 'Отчеты', icon: 'reports' },
  {
    id: 'ops',
    label: 'OPS',
    icon: 'ops',
    children: [
      { id: 'tasks', label: 'Задачи' },
      { id: 'finances', label: 'Финансы' },
      { id: 'marketing', label: 'Маркетинг' },
      { id: 'accounting', label: 'Бухгалтерия' },
      { id: 'hr', label: 'HR' },
      { id: 'legal', label: 'Юр. служба' },
      { id: 'supply', label: 'Снабжение' },
      { id: 'logistics', label: 'Логистика' },
      { id: 'it', label: 'IT' },
    ],
  },
  { id: 'chat', label: 'Чат', icon: 'chat' },
  {
    id: 'settings',
    label: 'Настройки',
    icon: 'settings',
    children: [
      { id: 'configuration', label: 'Конфиг' },
      { id: 'onboarding', label: 'Онбординг' },
      { id: 'company', label: 'Компания' },
      { id: 'channels', label: 'Каналы' },
      { id: 'marketing', label: 'Маркетинг' },
      { id: 'products', label: 'Продукты' },
      { id: 'icp', label: 'ICP' },
      { id: 'dashboard', label: 'Дашборд' },
      { id: 'subscription', label: 'Подписка' },
      { id: 'crm', label: 'CRM' },
      { id: 'policies', label: 'Политики' },
      { id: 'prompts', label: 'Промпты' },
      { id: 'handlers', label: 'Хендлеры' },
      { id: 'integrations', label: 'Интеграции' },
      { id: 'users', label: 'Пользователи' },
      { id: 'permissions', label: 'Права доступа' },
      { id: 'action_templates', label: 'Шаблоны действий' },
      { id: 'letter_templates', label: 'Шаблоны писем' },
    ],
  },
]

const STORAGE_KEY = 'a1_nav_sections'

export function loadSectionsOrder(): NavSection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SECTIONS
    const order = JSON.parse(raw) as string[]
    if (!Array.isArray(order) || order.length === 0) return DEFAULT_SECTIONS
    const byId = new Map(DEFAULT_SECTIONS.map((s) => [s.id, s]))
    const result: NavSection[] = []
    for (const id of order) {
      const section = byId.get(id)
      if (section) result.push(section)
    }
    for (const section of DEFAULT_SECTIONS) {
      if (!result.some((item) => item.id === section.id)) result.push(section)
    }
    return result.length ? result : DEFAULT_SECTIONS
  } catch {
    return DEFAULT_SECTIONS
  }
}

export function saveSectionsOrder(sections: NavSection[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections.map((s) => s.id)))
  } catch {
    // ignore
  }
}

export function toViewId(sectionId: string, childId?: string): string {
  return childId ? `${sectionId}/${childId}` : sectionId
}
