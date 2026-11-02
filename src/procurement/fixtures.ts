import type { Attribute, Product, Result } from './contract'

export const observed = '2026-10-01T09:00:00+03:00'
const attr = (
  key: string,
  label: string,
  value: number | null,
  unit: string | null = null,
): Attribute => ({
  key,
  label,
  value,
  unit,
  status: value === null ? 'unknown' : 'known',
})
const make = (
  id: string,
  article: string,
  name: string | null,
  amount: string | null,
  attributes: Attribute[],
  category = 'grinder',
): Product => ({
  product_id: id,
  article,
  name,
  brand: 'ДемоИнструмент',
  category_paths: [
    [
      { id: 'tools', label: 'Инструмент' },
      { id: category, label: category === 'grinder' ? 'УШМ' : 'Гайковёрты' },
    ],
  ],
  attributes,
  issues:
    name === null
      ? [
          {
            code: 'MISSING_NAME',
            message: 'В прайсе нет названия',
            severity: 'warning',
          },
        ]
      : [],
  offer: {
    offer_id: `offer_${id}`,
    source_id: 'demo-a',
    source_name: 'Тестовый прайс А',
    article,
    price: amount ? { amount, currency: 'RUB' } : null,
    price_role: 'Розничная',
    unit: 'шт',
    pack_quantity: '1',
    vat_basis: 'НДС включён',
    comparable_unit_price: amount ? { amount, currency: 'RUB' } : null,
    comparison_status: amount ? 'comparable' : 'unavailable',
    stock: { quantity: id === 'p1' ? '0' : null, unit: 'шт', as_of: observed },
    source_ref: {
      file_name: 'Демонстрация.xlsx',
      sheet: 'Тестовые товары',
      row: Number(id.slice(1)) + 1,
      observed_at: observed,
    },
    issues: amount
      ? []
      : [
          {
            code: 'UNKNOWN_PRICE',
            severity: 'warning',
            message: 'Цена неизвестна; запросите уточнение',
          },
        ],
  },
})
const grinder = [
  attr('disc_diameter_mm', 'Диаметр диска', 125, 'мм'),
  attr('voltage_v', 'Напряжение', 21, 'В'),
  attr('power_w', 'Мощность', null, 'Вт'),
  attr('battery_count', 'Число АКБ', 2),
  attr('battery_capacity_ah', 'Ёмкость АКБ', 4, 'А·ч'),
  {
    key: 'charger',
    label: 'Зарядное устройство',
    value: true,
    unit: null,
    status: 'known' as const,
  },
]
export const products: Product[] = [
  make('p1', 'AC-AG1252', 'УШМ 125 мм, 21 В, 2 АКБ — тест', '7800.00', grinder),
  make(
    'p2',
    '000125',
    'УШМ 125 мм, без АКБ — тест',
    '4200.00',
    grinder.map((a) => (a.key === 'battery_count' ? { ...a, value: 0 } : a)),
  ),
  make('p3', 'DEMO-NOPRICE', 'УШМ с неизвестной ценой — тест', null, grinder),
  make('p4', '000083', null, '6000.00', grinder),
  make(
    'p5',
    'DEMO-CONFLICT',
    'УШМ: конфликт диаметра — тест',
    '7100.00',
    grinder.map((a) =>
      a.key === 'disc_diameter_mm'
        ? {
            ...a,
            value: null,
            status: 'conflicting',
            source_values: [125, 150],
          }
        : a,
    ),
  ),
  make(
    'p6',
    'DEMO-WRENCH',
    'Гайковёрт — тест',
    '9800.00',
    [
      attr('tightening_torque_nm', 'Момент затяжки', 400, 'Н·м'),
      attr('breakaway_torque_nm', 'Момент срыва', 650, 'Н·м'),
      attr('battery_count', 'Число АКБ', null),
    ],
    'wrench',
  ),
]
products[4].issues = [
  {
    code: 'CONFLICT',
    severity: 'warning',
    message: 'Диаметр в названии и параметрах различается: 125 / 150 мм',
  },
]
products.push({
  ...products[0],
  offer: {
    ...products[0].offer,
    offer_id: 'offer_p1_b',
    source_id: 'demo-b',
    source_name: 'Тестовый прайс Б',
    price: { amount: '8200.00', currency: 'RUB' },
    comparable_unit_price: { amount: '8200.00', currency: 'RUB' },
  },
})
export const facets: Result<'catalog.facets'> = {
  kind: 'catalog.facets',
  categories: [
    { path: products[0].category_paths[0] },
    { path: products[5].category_paths[0] },
  ],
  brands: ['ДемоИнструмент'],
  sources: [
    { id: 'demo-a', label: 'Тестовый прайс А' },
    { id: 'demo-b', label: 'Тестовый прайс Б' },
  ],
  attributes: [...grinder, ...products[5].attributes]
    .filter((a, i, all) => all.findIndex((b) => a.key === b.key) === i)
    .map((a) => ({
      key: a.key,
      label: a.label,
      type: a.key === 'charger' ? 'boolean' : 'number',
      unit: a.unit,
      operators: a.key === 'charger' ? ['eq'] : ['eq', 'gte', 'lte'],
    })),
  capabilities: {
    catalog_search: true,
    request_parse: true,
    analysis: true,
    market_reference: false,
    export: true,
    upload: {
      enabled: true,
      extensions: ['.xlsx', '.xls', '.csv'],
      max_size_bytes: 5 * 1024 * 1024,
      max_files: 1,
    },
    unavailable_reasons: {
      market_reference: 'Поиск интернет-цены пока не подключён',
    },
  },
}
export const demoText =
  'AC-AG1252;2;шт\nDEMO-ANALOG;1;шт\nDEMO-CONFLICT;1;шт\nНЕИЗВЕСТНЫЙ;3;шт'
