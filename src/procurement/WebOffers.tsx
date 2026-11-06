import type { MarketVariant, WebOffer } from './contract'
import { safeUrl } from './client'
import { dateText, moneyText } from './ui'
import s from './Procurement.module.css'

export function WebOffers({ offers, references = [], enabled = true, pending = false }: {
  offers: WebOffer[]; references?: MarketVariant[]; enabled?: boolean; pending?: boolean
}) {
  if (!enabled && !offers.length) return null
  return <section className={s.panel} aria-label="Варианты из интернета">
    <h3>Варианты из интернета</h3>
    <p>Цены магазинов для сравнения. Для закупки выбирайте предложения из наших прайсов ниже; совместимость и комплектацию нужно проверить.</p>
    {pending && <p role="status">Ищем модели, артикулы и цены по источникам…</p>}
    {!pending && !offers.length && <p>Проверяемых интернет-предложений не найдено. Уточните модель или характеристики.</p>}
    {offers.map((offer) => {
      const url = safeUrl(offer.url)
      const reference = references.find(r => r.article === offer.article && r.brand === offer.brand)
      return <article className={s.panel} key={offer.url}>
        <strong>{offer.name}</strong>
        <p><code>{offer.article}</code> · {offer.brand} · {offer.match_type === 'exact' ? 'Исходная модель' : 'Вариант для сравнения'}</p>
        <p>{moneyText(offer.price)} · {offer.seller} · {offer.unit ?? 'Единица не указана'}</p>
        <p>{offer.explanation}</p>
        <small>{offer.available ? 'Наличие указано в источнике' : 'Наличие требует уточнения'} · {offer.vat_basis === 'unknown' ? 'НДС не подтверждён' : offer.vat_basis === 'included' ? 'НДС включён' : 'Без НДС'} · Проверено {dateText(offer.observed_at)}</small>
        {reference?.mean_price && <p>Средняя по этой модели: {moneyText(reference.mean_price)} · независимых источников: {reference.independent_source_count}</p>}
        {url && <a href={url} target="_blank" rel="noopener noreferrer">Открыть источник цены и характеристик</a>}
      </article>
    })}
  </section>
}
