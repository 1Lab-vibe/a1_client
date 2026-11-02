async (page) => {
  let submitted = null
  const note = 'Прошу уточнить сроки поставки. Адрес доставки: Москва'
  await page.route('**/api/procurement/command', async (route) => {
    const cmd = route.request().postDataJSON()
    if (cmd.action === 'analysis.start') submitted = cmd.payload
    const result = await page.evaluate(async (command) => (await import('/tests/procurement-http-fixture.ts')).handle(command), cmd)
    const parsed = result.body.data?.parsed_request
    if (parsed) {
      parsed.notes = note
      parsed.lines.push({ ...parsed.lines[0], line_id: 'missing-name', position: 5, original_text: '', article: null, quantity: '5.000', unit: 'шт', parse_issues: ['Наименование товара отсутствует'] })
    }
    return route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body) })
  })
  await page.getByRole('button', { name: /^Новая заявка/ }).click()
  await page.getByRole('textbox', { name: 'Список товаров', exact: true }).fill(await page.evaluate(async () => (await import('/src/procurement/fixtures.ts')).demoText))
  await page.getByRole('button', { name: 'Распознать список', exact: true }).click()
  await page.getByText('Проверьте распознанные строки · 5', { exact: true }).waitFor({ timeout: 15000 })
  const notes = page.getByLabel('Условия и примечания к заявке', { exact: true })
  if (await notes.inputValue() !== note) throw new Error('Parsed delivery notes missing')
  await page.getByText('Наименование товара отсутствует', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Проанализировать заявку', exact: true }).click()
  if (submitted) throw new Error('Missing-name position was submitted')
  await notes.fill(note + '\nДоставка включается в счет')
  await page.reload()
  await page.getByRole('button', { name: /^Новая заявка/ }).click()
  if (await notes.inputValue() !== note + '\nДоставка включается в счет') throw new Error('Notes were lost on reload')
  await page.getByLabel('Описание 5', { exact: true }).fill('Уточнённый товар')
  await page.getByRole('button', { name: 'Проанализировать заявку', exact: true }).click()
  await page.getByRole('button', { name: 'Результат', exact: true }).waitFor()
  await page.waitForTimeout(300)
  if (submitted?.notes !== note + '\nДоставка включается в счет') throw new Error('Analysis payload lost notes')
  console.log('PASS: notes separated, editable, persisted and sent to analysis; nameless row blocks analysis')
}
