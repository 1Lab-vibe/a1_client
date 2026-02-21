/**
 * Сессия для передачи с каждым webhook (company_id, token, user_id).
 * user_id — email при входе. Устанавливается при входе, очищается при выходе.
 */

export interface Session {
  company_id: string
  token: string
  user_id: string
}

let currentSession: Session | null = null

export function setSession(company_id: string, token: string, user_id: string): void {
  currentSession = { company_id, token, user_id }
}

export function clearSession(): void {
  currentSession = null
}

export function getSession(): Session | null {
  return currentSession
}
