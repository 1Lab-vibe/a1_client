async (page) => {
  const provider = 'bitrix24'
  const displayName = 'finsph_bitrix24_ru'
  let status = 'connected'
  let fail = false
  const requests = []
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.abort()
    if (url.pathname === '/config.js') return route.fulfill({ contentType: 'application/javascript', body: 'window.__A1_CONFIG__={VITE_N8N_WEBHOOK_URL:"/api"};' })
    if (url.pathname === '/config.json') return route.fulfill({ json: {} })
    if (url.pathname === '/api') {
      const body = route.request().postDataJSON()
      requests.push(body)
      if (body.action === 'getIntegrations') return route.fulfill({ json: { ok: true, data: { integrations: [{ provider_key: provider, name: displayName, connection_status: status, family: 'crm', auth_mode: 'oauth' }] } } })
      if (body.action === 'disconnectIntegration') {
        await new Promise((resolve) => setTimeout(resolve, 250))
        if (fail) return route.fulfill({ json: { ok: true, data: {} } })
        status = 'disconnected'
        return route.fulfill({ json: { ok: true, data: { provider, status } } })
      }
      if (body.action === 'startIntegrationConnect') status = 'connected'
      return route.fulfill({ json: { ok: true, data: {} } })
    }
    return route.continue()
  })
  await page.goto('http://127.0.0.1:5186')
  await page.evaluate(() => {
    localStorage.setItem('a1_auth', JSON.stringify({ token: 'synthetic-ui-test', email: 'demo@example.test', company_id: 'demo-company-a', companies: [{ company_id: 'demo-company-a', name: 'Тест', token: 'synthetic-ui-test' }] }))
  })
  await page.goto('http://127.0.0.1:5186/#/settings/integrations')
  await page.reload()
  await page.getByRole('button', { name: 'Интеграции', exact: true }).click()
  const card = page.locator('article').filter({ hasText: displayName })
  const disconnect = card.getByRole('button', { name: 'Отключить синхронизацию', exact: true })
  await disconnect.waitFor()
  if (await card.getByRole('button', { name: 'Подключить', exact: true }).count()) throw new Error('Connected card shows connect')
  await disconnect.click()
  const busy = card.getByRole('button', { name: 'Отключаем...' })
  await busy.waitFor()
  if (!(await busy.isDisabled()) || !(await card.getByRole('button', { name: 'Проверить', exact: true }).isDisabled())) throw new Error('Concurrent actions enabled')
  await card.getByRole('button', { name: 'Подключить', exact: true }).waitFor()
  const sent = requests.find((body) => body.action === 'disconnectIntegration')
  if (sent?.payload?.provider !== provider || sent.company_id !== 'demo-company-a' || sent.token !== 'synthetic-ui-test') throw new Error('Wrong provider or session')
  await page.reload()
  await page.getByRole('button', { name: 'Интеграции', exact: true }).click()
  await card.getByRole('button', { name: 'Подключить', exact: true }).click()
  await disconnect.waitFor()
  fail = true
  await disconnect.click()
  await page.getByText('Сервер не подтвердил отключение синхронизации.', { exact: false }).waitFor()
  if (await disconnect.isDisabled()) throw new Error('Cannot retry after error')
  if (await card.getByRole('button', { name: 'Подключить', exact: true }).count()) throw new Error('Failed disconnect shown as success')
  console.log('PASS: disconnect, tenant/provider payload, busy state, reload, reconnect, unsupported backend')
}
