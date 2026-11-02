async (page) => {
  await page
    .getByRole('combobox', { name: 'Режим', exact: true })
    .selectOption('mock')
  await page.getByRole('button', { name: /^Новая заявка/ }).click()
  while (await page.getByRole('button', { name: /^Удалить строку/ }).count())
    await page
      .getByRole('button', { name: /^Удалить строку/ })
      .first()
      .click()
  await page
    .getByLabel('Файл заявки', { exact: true })
    .setInputFiles({
      name: 'bad.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('test'),
    })
  await page
    .getByText('Неподдерживаемый формат файла', { exact: true })
    .waitFor()
  await page
    .getByLabel('Файл заявки', { exact: true })
    .setInputFiles({
      name: 'Тест.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('demo'),
    })
  await page
    .getByText('Проверьте распознанные строки · 4', { exact: true })
    .waitFor({ timeout: 15000 })
  await page.reload()
  await page.getByRole('button', { name: /^Новая заявка/ }).click()
  await page
    .getByText('Проверьте распознанные строки · 4', { exact: true })
    .waitFor()
  await page
    .getByRole('textbox', { name: 'Название заявки', exact: true })
    .fill('DEMO-FAIL')
  await page
    .getByRole('button', { name: 'Проанализировать заявку', exact: true })
    .click()
  await page
    .getByText('Тестовая ошибка обработки заявки', { exact: true })
    .waitFor()
  if (await page.locator('main tbody tr').count())
    throw new Error('Failed job shown as successful result')
  await page.getByRole('button', { name: /^Новая заявка/ }).click()
  await page
    .getByRole('textbox', { name: 'Название заявки', exact: true })
    .fill('Проверка смены компании')
  await page
    .getByRole('button', { name: 'Проанализировать заявку', exact: true })
    .click()
  await page.getByRole('combobox').first().selectOption('demo-company-b')
  await page.getByRole('button', { name: 'Результат', exact: true }).click()
  await page
    .getByText('Запустите анализ или откройте задание из истории.', {
      exact: true,
    })
    .waitFor()
  await page.getByRole('button', { name: 'Новая заявка', exact: true }).click()
  await page
    .getByText('Проверьте распознанные строки · 0', { exact: true })
    .waitFor()
  console.log(
    'PASS: upload validation, simulated file parse, draft reload without duplication, failed job, company switch during processing',
  )
}
