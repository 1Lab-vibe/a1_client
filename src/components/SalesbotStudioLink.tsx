import { useState } from 'react'
import { Bot } from 'lucide-react'
import { getSession } from '../session'

export function SalesbotStudioLink() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function openEditor() {
    const session = getSession()
    if (!session) { setError('Сначала войдите в А1'); return }
    setBusy(true)
    setError('')
    try {
      const response = await fetch('https://salesbot.1true.ru/api/studio/a1/session', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + session.token, 'content-type': 'application/json' },
        body: JSON.stringify({ company: session.company_id }),
      })
      const data = await response.json()
      if (!response.ok || !data.url) throw new Error(data.error || 'Не удалось открыть кабинет')
      const destination = new URL(data.url)
      if (destination.origin !== 'https://salesbot.1true.ru' || destination.pathname !== '/cabinet/') throw new Error('Некорректная ссылка кабинета')
      window.location.assign(destination.href)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Кабинет временно недоступен')
    } finally {
      setBusy(false)
    }
  }
  return <>
    <button type="button" onClick={openEditor} disabled={busy}><Bot aria-hidden /><span>{busy ? 'Открываем…' : 'Конструктор бота продаж'}</span></button>
    {error && <span role="alert">{error}</span>}
  </>
}
