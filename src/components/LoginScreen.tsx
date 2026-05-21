import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { requestDemo, requestPasswordReset } from '../api/n8n'
import { formatDate } from '../utils/dateFormat'
import type { DemoRequest, DemoResult } from '../types'
import { DemoRequestModal } from './DemoRequestModal'
import styles from './LoginScreen.module.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginScreen() {
  const { login, error, clearError, blockedUntil, pendingCompanies, completeLogin, cancelCompanySelection } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null)

  const now = Date.now()
  const isBlocked = blockedUntil != null && now < blockedUntil
  const emailValid = EMAIL_REGEX.test(email.trim())
  const canSubmit = !isBlocked && emailValid && password.length > 0 && !loading && !resetLoading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isBlocked) return
    clearError()
    if (!canSubmit) return
    setLoading(true)
    setResetMessage(null)
    try {
      await login(email.trim(), password)
    } catch {
      // error set in context
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    clearError()
    setResetMessage(null)
    if (isBlocked || !emailValid || resetLoading) return
    setResetLoading(true)
    try {
      await requestPasswordReset(email.trim())
      setResetMessage('Если аккаунт найден, временный пароль отправлен на почту.')
    } catch {
      setResetMessage('Не удалось отправить временный пароль. Попробуйте позже.')
    } finally {
      setResetLoading(false)
    }
  }

  const handleDemoSubmit = async (data: DemoRequest) => {
    setDemoResult(null)
    try {
      const res = await requestDemo(data)
      setDemoResult(res.access)
    } catch (e) {
      setDemoResult('deny')
    }
  }

  if (pendingCompanies) {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.title}>A1</h1>
          <p className={styles.subtitle}>Выберите компанию</p>
          <div className={styles.companyList}>
            {pendingCompanies.map((company) => (
              <button
                key={company.company_id}
                type="button"
                className={styles.companyBtn}
                onClick={() => completeLogin(company.company_id)}
              >
                <span>{company.name}</span>
                {company.role && <small>{company.role}</small>}
              </button>
            ))}
          </div>
          <button type="button" className={styles.demoBtn} onClick={cancelCompanySelection}>
            Назад ко входу
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>A1</h1>
        <p className={styles.subtitle}>Вход в систему</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            <span>Email (логин)</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isBlocked}
              className={email.length > 0 && !emailValid ? styles.inputError : ''}
            />
            {email.length > 0 && !emailValid && (
              <span className={styles.hint}>Введите корректный адрес почты</span>
            )}
          </label>
          <label className={styles.label}>
            <span>Пароль</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isBlocked}
            />
          </label>
          <div className={styles.secondaryActions}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={handlePasswordReset}
              disabled={isBlocked || !emailValid || resetLoading}
            >
              {resetLoading ? 'Отправляем...' : 'Забыли пароль?'}
            </button>
          </div>
          {isBlocked && (
            <div className={styles.blocked} role="alert">
              Вход временно заблокирован из‑за превышения числа неудачных попыток. Повторите попытку после {formatDate(blockedUntil!)}.
            </div>
          )}
          {error && !isBlocked && <div className={styles.error}>{error}</div>}
          {resetMessage && <div className={styles.success}>{resetMessage}</div>}
          <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
            {loading ? 'Вход...' : isBlocked ? 'Заблокировано' : 'Войти'}
          </button>
        </form>
        <button type="button" className={styles.demoBtn} onClick={() => setDemoOpen(true)}>
          Запросить демо доступ
        </button>
      </div>
      {demoOpen && (
        <DemoRequestModal
          onClose={() => {
            setDemoOpen(false)
            setDemoResult(null)
          }}
          onSubmit={handleDemoSubmit}
          result={demoResult}
        />
      )}
    </div>
  )
}
