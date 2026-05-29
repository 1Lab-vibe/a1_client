import { Building2, CircleDot, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import type { ViewId } from '../types'
import styles from './AppHeader.module.css'

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  coo: { title: 'COO', subtitle: 'Операционный ассистент и входящие сообщения' },
  'crm/dashboard': { title: 'Дашборд CRM', subtitle: 'Продажи, лиды, клиенты и активность за период' },
  'crm/leads': { title: 'Лиды', subtitle: 'Воронка и история обработки обращений' },
  'crm/deals': { title: 'Сделки', subtitle: 'Стадии, суммы и следующие действия' },
  'crm/clients': { title: 'Клиенты', subtitle: 'Единая база компаний и контактов' },
  'crm/invoices': { title: 'Счета', subtitle: 'Статусы выставления и оплаты' },
  reports: { title: 'Отчеты', subtitle: 'Периоды, графики и управленческие срезы' },
  'ops/tasks': { title: 'Задачи', subtitle: 'Операционные задачи и статусы исполнения' },
  'ops/finances': { title: 'Финансы', subtitle: 'Денежные показатели и контроль платежей' },
  'ops/marketing': { title: 'Маркетинг', subtitle: 'Кампании, источники и интеграции' },
  'ops/accounting': { title: 'Бухгалтерия', subtitle: 'Документы, счета и сверки' },
  'ops/hr': { title: 'HR', subtitle: 'Команда, найм и внутренние процессы' },
  'ops/legal': { title: 'Юр. служба', subtitle: 'Договоры, риски и согласования' },
  'ops/supply': { title: 'Снабжение', subtitle: 'Закупки и поставщики' },
  'ops/logistics': { title: 'Логистика', subtitle: 'Отгрузки, доставки и статусы' },
  'ops/it': { title: 'IT', subtitle: 'Доступы, инфраструктура и инциденты' },
  chat: { title: 'Чат', subtitle: 'Внутренние каналы и диалоги' },
  'settings/configuration': { title: 'Настройки', subtitle: 'Конфиг компании без ручного JSON' },
  'settings/onboarding': { title: 'Онбординг', subtitle: 'Пошаговая подготовка компании к прод-работе' },
  'settings/crm': { title: 'Настройки CRM', subtitle: 'Стадии, поля, источники и правила' },
  'settings/policies': { title: 'Политики', subtitle: 'Правила обработки и эскалаций' },
  'settings/prompts': { title: 'Промпты', subtitle: 'Поведение COO и системные инструкции' },
  'settings/handlers': { title: 'Хендлеры', subtitle: 'Маршрутизация событий и действий' },
  'settings/integrations': { title: 'Интеграции', subtitle: 'Подключения, health-check и синхронизация' },
  'settings/users': { title: 'Пользователи', subtitle: 'Роли и доступы по компаниям' },
  'settings/permissions': { title: 'Права доступа', subtitle: 'Матрица разрешений и owner/admin/member' },
  'settings/action_templates': { title: 'Шаблоны действий', subtitle: 'Готовые сценарии COO' },
  'settings/letter_templates': { title: 'Шаблоны писем', subtitle: 'Письма, автоответы и уведомления' },
}

export function getViewTitle(viewId: ViewId): string {
  return VIEW_TITLES[viewId]?.title ?? String(viewId)
}

export function AppHeader({ viewId }: { viewId: ViewId }) {
  const { companies, selectedCompany, selectCompany, logout } = useAuth()
  const meta = VIEW_TITLES[viewId] ?? { title: String(viewId), subtitle: 'Рабочий раздел A1 COO OS' }
  const list = companies.length ? companies : selectedCompany ? [selectedCompany] : []

  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <div className={styles.signal}>
          <CircleDot aria-hidden />
          <span>prod console</span>
        </div>
        <h1>{meta.title}</h1>
        <p>{meta.subtitle}</p>
      </div>

      <div className={styles.controls}>
        <label className={styles.companyControl}>
          <Building2 aria-hidden />
          <select
            value={selectedCompany?.company_id ?? ''}
            onChange={(event) => selectCompany(event.target.value)}
            title="Компания"
          >
            {list.map((company) => (
              <option key={company.company_id} value={company.company_id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.roleBadge} title="Секреты скрыты, доступ только по компании">
          <ShieldCheck aria-hidden />
          <span>{selectedCompany?.role ?? 'owner'}</span>
        </div>
        <button type="button" className={styles.iconBtn} onClick={logout} title="Выйти">
          <LogOut aria-hidden />
        </button>
      </div>
    </header>
  )
}
