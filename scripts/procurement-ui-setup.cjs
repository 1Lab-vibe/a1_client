async (page) => {
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
  })
  await page.goto('http://127.0.0.1:5173/#/ops/supply')
  await page.reload()
}
