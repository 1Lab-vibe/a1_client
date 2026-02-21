import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { setSession, clearSession } from '../session'

const STORAGE_KEY = 'a1_auth'

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredAuth | null>(loadStored)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const data = loadStored()
    setStored(data)
    if (data) setSession(data.company_id, data.token, data.email)
    else clearSession()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    const { login: apiLogin } = await import('../api/n8n')
    const res = await apiLogin(email, password)
    if (!res.access) {
      setError('Неверный логин или пароль')
      throw new Error('Access denied')
    }
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

  const value: AuthContextValue = {
    isLoggedIn: !!stored,
    email: stored?.email ?? null,
    company_id: stored?.company_id ?? null,
    login,
    logout,
    error,
    clearError: () => setError(null),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth used outside AuthProvider')
  return ctx
}
