async (page) => {
  const downloads = new Map()
  // All non-local traffic is blocked; only synthetic authentication is used.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1')
      return route.fulfill({
        body: '',
        contentType: url.pathname.endsWith('.js')
          ? 'application/javascript'
          : 'text/plain',
      })
    if (url.pathname === '/config.js')
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'window.__A1_CONFIG__={};',
      })
    if (url.pathname === '/config.json')
      return route.fulfill({ contentType: 'application/json', body: '{}' })
    if (url.pathname === '/api/procurement/command') {
      const result = await page.evaluate(async (cmd) => (await import('/tests/procurement-http-fixture.ts')).handle(cmd), route.request().postDataJSON())
      if (result.download) downloads.set(result.body.data.job_id, result.download)
      return route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body) })
    }
    if (url.pathname === '/api/procurement/files') {
      const data = await page.evaluate(async () => (await import('/tests/procurement-http-fixture.ts')).upload(JSON.parse(localStorage.getItem('a1_auth')).company_id))
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) })
    }
    if (url.pathname.startsWith('/api/procurement/download/')) {
      const file = downloads.get(url.pathname.split('/').pop())
      return route.fulfill({ body: Buffer.from(file.bytes), headers: { 'Content-Disposition': 'attachment', 'Content-Type': 'application/octet-stream' } })
    }
    if (url.pathname.startsWith('/api'))
      return route.fulfill({
        contentType: 'application/json',
        body: '{"companies":[]}',
      })
    return route.continue()
  })
  await page.goto('http://127.0.0.1:5173')
  await page.evaluate(() => {
    localStorage.setItem(
      'a1_auth',
      JSON.stringify({
        token: 'synthetic-ui-test',
        email: 'demo@example.test',
        company_id: 'demo-company-a',
        companies: [
          {
            company_id: 'demo-company-a',
            name: 'Инструменты · тест',
            token: 'synthetic-ui-test',
          },
          {
            company_id: 'demo-company-b',
            name: 'Другая компания · тест',
            token: 'synthetic-ui-test',
          },
        ],
      }),
    )
    sessionStorage.clear()
    localStorage.setItem('a1_nav_sections_v2', JSON.stringify(['coo', 'mis', 'crm', 'sales', 'reports', 'ops', 'chat', 'settings']))
  })
  await page.goto('http://127.0.0.1:5173/#/ops/supply')
  await page.reload()
  await page.getByRole('textbox', { name: 'Артикул, название или характеристики' }).waitFor()
  const labels = await page.locator('aside button').allTextContents()
  const reports = labels.findIndex((label) => label.trim() === 'Отчеты')
  if (reports < 0 || labels[reports + 1].trim() !== 'Снабжение' || labels[reports + 2].trim() !== 'OPS') throw new Error('Supply must appear between Reports and OPS for existing navigation preferences')
  if (await page.getByText('Демонстрационные данные — бэкенд не подключён', { exact: true }).count()) throw new Error('Demo banner still visible')
}
