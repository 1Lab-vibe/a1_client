import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { requestDemo } from '../api/n8n'
import type { DemoRequest, DemoResult } from '../types'
import { DemoRequestModal } from './DemoRequestModal'
import styles from './LoginScreen.module.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginScreen() {
  const { login, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null)

  const emailValid = EMAIL_REGEX.test(email.trim())
  const canSubmit = emailValid && password.length > 0 && !loading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    if (!canSubmit) return
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch {
      // error set in context
    } finally {
      setLoading(false)
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
            />
          </label>
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
            {loading ? 'Вход...' : 'Войти'}
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
