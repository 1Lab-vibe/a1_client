async (page) => {
  let started = 0
  const requests = []
  await page.route('**/api/procurement/command', async route => {
    const cmd = route.request().postDataJSON()
    requests.push(cmd)
    const lookup = cmd.action === 'catalog.search' && cmd.payload.query === 'Диск для плитки 125 мм'
    const dataCmd = lookup ? { ...cmd, payload: { ...cmd.payload, query: '' } } : cmd
    const result = await page.evaluate(async command => (await import('/tests/procurement-http-fixture.ts')).handle(command), dataCmd)
    if (lookup && cmd.payload.mode === 'intelligent') {
      if (!started) started = Date.now()
      const pending = Date.now() - started < 2000
      Object.assign(result.body.data, {
        search_mode: 'intelligent', ...(pending ? { reference_status: 'pending' } : {}),
        interpreted_query: { summary: 'Подбор алмазных дисков для плитки' },
        intelligence: { status: pending ? 'pending' : 'completed', web_enabled: cmd.payload.web_enabled, candidate_count: 12, shortlist_limited: false, checked_at: null, requirements: [{ label: 'Диаметр', value: '125 мм', evidence: '125 мм' }], search_queries: ['диск алмазный'] },
        web_offers: pending || !cmd.payload.web_enabled ? [] : [{ article: 'TEST-125', name: 'Тестовый алмазный диск 125 мм', brand: 'Тест', seller: 'Тестовый источник', url: 'https://example.test/disc', price: { amount: '750.00', currency: 'RUB' }, unit: 'шт', vat_basis: 'unknown', available: false, condition: 'new', match_type: 'analog', explanation: 'Вариант для проверки комплектации', observed_at: '2026-11-06T12:00:00Z' }],
        market_references: [],
      })
    }
    return route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body) })
  })
  await page.getByRole('textbox', { name: 'Артикул, название или характеристики' }).fill('Диск для плитки 125 мм')
  await page.getByRole('button', { name: 'Найти', exact: true }).click()
  await page.getByText('Интеллектуальный подбор выполняется…').waitFor()
  await page.getByText('Тестовый алмазный диск 125 мм', { exact: true }).waitFor()
  if (await page.getByRole('link', { name: 'Открыть источник цены и характеристик' }).getAttribute('href') !== 'https://example.test/disc') throw new Error('Source URL lost')
  await page.getByText('Как понят запрос', { exact: true }).click()
  await page.getByText('Диаметр: 125 мм', { exact: true }).waitFor()
  await page.screenshot({ path: 'output/playwright/intelligent-search.png', fullPage: true })
  await page.getByLabel('Искать модели и цены в интернете').uncheck()
  await page.getByRole('heading', { name: 'Варианты из интернета' }).waitFor({ state: 'hidden' })
  await page.getByLabel('Режим поиска').selectOption('catalog')
  await page.waitForTimeout(300)
  const last = requests.filter(r => r.action === 'catalog.search').at(-1)
  if (last.payload.mode !== 'catalog' || last.payload.web_enabled !== false) throw new Error('Mode/web toggle not sent')
  console.log('Intelligent UI: pending -> completed, source/price, requirements, web off and catalogue mode passed')
}
