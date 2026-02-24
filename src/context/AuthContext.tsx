import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { setSession, clearSession } from '../session'
import { formatDate } from '../utils/dateFormat'

const STORAGE_KEY = 'a1_auth'
const BLOCKED_UNTIL_KEY = 'a1_blocked_until'

interface StoredAuth {
  token: string
  email: string
  company_id: string
}

interface AuthContextValue {
  isLoggedIn: boolean
  email: string | null
  company_id: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  error: string | null
  clearError: () => void
  /** Время окончания блокировки (timestamp ms) или null. Блокировка по IP при превышении лимита неудачных попыток. */
  blockedUntil: number | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as StoredAuth
    if (data.token && data.email && data.company_id) return data
  } catch {
    // ignore
  }
  return null
}

function saveStored(token: string, email: string, company_id: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, email, company_id }))
}

function clearStored() {
  localStorage.removeItem(STORAGE_KEY)
}

function getBlockedUntil(): number | null {
  try {
    const raw = localStorage.getItem(BLOCKED_UNTIL_KEY)
    if (!raw) return null
    const t = Number(raw)
    if (!Number.isFinite(t)) return null
    if (Date.now() >= t) {
      localStorage.removeItem(BLOCKED_UNTIL_KEY)
      return null
    }
    return t
  } catch {
    return null
  }
}

function setBlockedUntil(ts: number) {
  localStorage.setItem(BLOCKED_UNTIL_KEY, String(ts))
}

function clearBlockedUntil() {
  localStorage.removeItem(BLOCKED_UNTIL_KEY)
}

function getClientDataForFailedLogin(): { userAgent: string; language: string; screenWidth: number; screenHeight: number; timezoneOffset: number } {
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    language: typeof navigator !== 'undefined' ? navigator.language : '',
    screenWidth: typeof screen !== 'undefined' ? screen.width : 0,
    screenHeight: typeof screen !== 'undefined' ? screen.height : 0,
    timezoneOffset: typeof Date !== 'undefined' ? -new Date().getTimezoneOffset() : 0,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredAuth | null>(loadStored)
  const [error, setError] = useState<string | null>(null)
  const [blockedUntil, setBlockedUntilState] = useState<number | null>(() => getBlockedUntil())

  useEffect(() => {
    const data = loadStored()
    setStored(data)
    if (data) setSession(data.company_id, data.token, data.email)
    else clearSession()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const until = getBlockedUntil()
      if (!until) setBlockedUntilState(null)
      else setBlockedUntilState(until)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    const { login: apiLogin, reportFailedLogin } = await import('../api/n8n')
    const res = await apiLogin(email, password)
    if (!res.access) {
      let blocked = res.blocked ?? false
      let until = res.blockedUntil
      if (!blocked || until == null) {
        const report = await reportFailedLogin(email, getClientDataForFailedLogin())
        blocked = report.blocked
        until = report.blockedUntil
      }
      if (blocked && until != null) {
        setBlockedUntil(until)
        setBlockedUntilState(until)
        setError(`Вход заблокирован до ${formatDate(until)}`)
      } else {
        setError('Неверный логин или пароль')
      }
      throw new Error('Access denied')
    }
    clearBlockedUntil()
    setBlockedUntilState(null)
    const token = res.token ?? 'ok'
    const company_id = res.company_id ?? ''
    saveStored(token, email, company_id)
    setSession(company_id, token, email)
    setStored({ token, email, company_id })
  }, [])

  const logout = useCallback(() => {
    clearStored()
    clearSession()
    setStored(null)
  }, [])

  const value: AuthContextValue = useMemo(
    () => ({
      isLoggedIn: !!stored,
      email: stored?.email ?? null,
      company_id: stored?.company_id ?? null,
      login,
      logout,
      error,
      clearError: () => setError(null),
      blockedUntil,
    }),
    [stored, login, logout, error, blockedUntil]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth used outside AuthProvider')
  return ctx
}
