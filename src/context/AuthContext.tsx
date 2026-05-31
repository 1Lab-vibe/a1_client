import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { setSession, clearSession } from '../session'
import { formatDate } from '../utils/dateFormat'
import type { AuthCompany } from '../types'

const STORAGE_KEY = 'a1_auth'
const BLOCKED_UNTIL_KEY = 'a1_blocked_until'

interface StoredAuth {
  token: string
  email: string
  company_id: string
  companies?: AuthCompany[]
}

interface AuthContextValue {
  isLoggedIn: boolean
  email: string | null
  company_id: string | null
  companies: AuthCompany[]
  selectedCompany: AuthCompany | null
  pendingCompanies: AuthCompany[] | null
  login: (email: string, password: string) => Promise<void>
  completeLogin: (companyId: string) => void
  cancelCompanySelection: () => void
  selectCompany: (companyId: string) => void
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
    if (data.token && data.email && data.company_id) return {
      ...data,
      companies: normalizeCompanies(data.companies, data.company_id, data.token),
    }
  } catch {
    // ignore
  }
  return null
}

function saveStored(auth: StoredAuth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
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

function normalizeCompanies(companies: unknown, fallbackCompanyId?: string, fallbackToken?: string): AuthCompany[] {
  const list = Array.isArray(companies) ? companies : []
  const normalized = list
    .map((company): AuthCompany | null => {
      if (!company || typeof company !== 'object') return null
      const c = company as Record<string, unknown>
      const company_id = typeof c.company_id === 'string' ? c.company_id : typeof c.id === 'string' ? c.id : ''
      if (!company_id) return null
      return {
        company_id,
        name: typeof c.name === 'string' && c.name.trim() ? c.name : `Компания ${company_id.slice(0, 8)}`,
        role: typeof c.role === 'string' ? c.role : undefined,
        token: typeof c.token === 'string' ? c.token : fallbackToken,
        is_default: c.is_default != null ? Boolean(c.is_default) : undefined,
      }
    })
    .filter((company): company is AuthCompany => company !== null)

  if (normalized.length === 0 && fallbackCompanyId) {
    return [{ company_id: fallbackCompanyId, name: `Компания ${fallbackCompanyId.slice(0, 8)}`, token: fallbackToken, is_default: true }]
  }
  return normalized
}

function patchStoredCompanyName(auth: StoredAuth, companyId: string, name: string): StoredAuth {
  if (!companyId || !name.trim()) return auth
  const companies = normalizeCompanies(auth.companies, auth.company_id, auth.token).map((company) =>
    company.company_id === companyId ? { ...company, name: name.trim() } : company
  )
  return { ...auth, companies }
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
  const [pendingAuth, setPendingAuth] = useState<{ email: string; companies: AuthCompany[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blockedUntil, setBlockedUntilState] = useState<number | null>(() => getBlockedUntil())

  const refreshCompanies = useCallback(async () => {
    const currentStored = loadStored()
    if (!currentStored?.email || !currentStored.token || !currentStored.company_id) return
    setSession(currentStored.company_id, currentStored.token, currentStored.email)
    const { getAuthCompanies } = await import('../api/n8n')
    const res = await getAuthCompanies()
    if (res.companies.length === 0) return
    setStored((current) => {
      const base = current ?? currentStored
      const selected =
        res.companies.find((company) => company.company_id === base.company_id) ??
        res.companies.find((company) => company.is_default) ??
        res.companies[0]
      const next: StoredAuth = {
        ...base,
        token: selected.token ?? base.token,
        company_id: selected.company_id,
        companies: res.companies.map((company) => ({ ...company, token: company.token ?? base.token })),
      }
      saveStored(next)
      setSession(next.company_id, next.token, next.email)
      return next
    })
  }, [])

  useEffect(() => {
    const data = loadStored()
    setStored(data)
    if (data) setSession(data.company_id, data.token, data.email)
    else clearSession()
  }, [])

  useEffect(() => {
    if (!stored?.email || !stored.token || !stored.company_id) return
    void refreshCompanies().catch(() => {
      // Keep the existing session; company list will refresh on the next successful login.
    })
  }, [stored?.email, stored?.token, refreshCompanies])

  useEffect(() => {
    const onCompanyUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ company_id?: string; name?: string }>).detail
      const companyId = detail?.company_id
      const name = detail?.name
      if (companyId && name) {
        setStored((current) => {
          if (!current) return current
          const next = patchStoredCompanyName(current, companyId, name)
          saveStored(next)
          return next
        })
      }
      void refreshCompanies().catch(() => {
        // Local name patch above is enough until the next login if backend refresh fails.
      })
    }
    window.addEventListener('a1:company-updated', onCompanyUpdated)
    return () => window.removeEventListener('a1:company-updated', onCompanyUpdated)
  }, [refreshCompanies])


  useEffect(() => {
    const interval = setInterval(() => {
      const until = getBlockedUntil()
      if (!until) setBlockedUntilState(null)
      else setBlockedUntilState(until)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const commitAuth = useCallback((email: string, company: AuthCompany, companies: AuthCompany[]) => {
    const token = company.token ?? 'ok'
    const auth: StoredAuth = {
      token,
      email,
      company_id: company.company_id,
      companies: companies.map((c) => ({ ...c, token: c.token ?? token })),
    }
    saveStored(auth)
    setSession(company.company_id, token, email)
    setStored(auth)
    setPendingAuth(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    setPendingAuth(null)
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
    const companies = normalizeCompanies(res.companies, res.company_id, token)
    if (companies.length > 1) {
      setPendingAuth({ email, companies })
      return
    }
    const company = companies[0] ?? { company_id: res.company_id ?? '', name: res.company_id ?? '', token, is_default: true }
    commitAuth(email, company, companies.length ? companies : [company])
  }, [commitAuth])

  const completeLogin = useCallback((companyId: string) => {
    if (!pendingAuth) return
    const company = pendingAuth.companies.find((c) => c.company_id === companyId)
    if (!company) return
    commitAuth(pendingAuth.email, company, pendingAuth.companies)
  }, [commitAuth, pendingAuth])

  const cancelCompanySelection = useCallback(() => {
    setPendingAuth(null)
  }, [])

  const selectCompany = useCallback((companyId: string) => {
    setStored((current) => {
      if (!current) return current
      const companies = normalizeCompanies(current.companies, current.company_id, current.token)
      const company = companies.find((c) => c.company_id === companyId)
      if (!company) return current
      const token = company.token ?? current.token
      const next = { ...current, token, company_id: company.company_id, companies }
      saveStored(next)
      setSession(company.company_id, token, current.email)
      return next
    })
  }, [])

  const logout = useCallback(() => {
    clearStored()
    clearSession()
    setStored(null)
    setPendingAuth(null)
  }, [])

  const companies = stored ? normalizeCompanies(stored.companies, stored.company_id, stored.token) : []
  const selectedCompany = companies.find((company) => company.company_id === stored?.company_id) ?? companies[0] ?? null

  const value: AuthContextValue = useMemo(
    () => ({
      isLoggedIn: !!stored,
      email: stored?.email ?? null,
      company_id: stored?.company_id ?? null,
      companies,
      selectedCompany,
      pendingCompanies: pendingAuth?.companies ?? null,
      login,
      completeLogin,
      cancelCompanySelection,
      selectCompany,
      logout,
      error,
      clearError: () => setError(null),
      blockedUntil,
    }),
    [stored, companies, selectedCompany, pendingAuth, login, completeLogin, cancelCompanySelection, selectCompany, logout, error, blockedUntil]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth used outside AuthProvider')
  return ctx
}
