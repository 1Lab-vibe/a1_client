# Контракт webhook API (клиент ↔ n8n)

Один **POST** на URL из `VITE_N8N_WEBHOOK_URL` (или `/api` по умолчанию). Маршрутизация: поле **`action`** в JSON (кроме запросов COO без `action` — см. ниже).

Источник правды в коде: `src/api/n8n.ts`, `src/hooks/useN8n.ts`, `src/utils/webhookSignature.ts`.

---

## Транспорт

| Параметр | Значение |
|----------|----------|
| Метод | `POST` |
| `Content-Type` | `application/json` |

Тело: либо **plain JSON** (объект с полями ниже), либо при включённой подписи — обёртка `{ "body_b64": "<base64>" }` (см. раздел HMAC).

---

## Сессия (`company_id`, `token`, `user_id`)

Функция `buildBody()` добавляет к телу **три поля из сессии**, если пользователь залогинен:

- `company_id`
- `token`
- `user_id`

**Не добавляются** для действий: `login`, `requestDemo`, `reportFailedLogin`.

Для остальных `action` эти поля обязательны на стороне бэкенда после логина (клиент всегда шлёт их, если сессия есть).

**Особый случай COO:** запрос ответа ассистента и опрос `getCOOResponse` строят объект вручную и при наличии сессии тоже передают `company_id`, `token`, `user_id` (см. раздел COO).

---

## Режим HMAC (`VITE_A1_WEBHOOK_SECRET`)

Если секрет непустой:

**Запрос**

- Тело: `{ "body_b64": "<base64 от canonical JSON исходного объекта>" }`.
- Заголовки: `X-Timestamp`, `X-Nonce`, `X-Signature` (детали — `src/utils/webhookSignature.ts`).

**Ответ**

- Клиент может получить либо тот же JSON «как есть», либо `{ "body_b64": "..." }` + при возможности проверка по заголовкам; при неудаче верификации выполняется fallback: декод `body_b64` без проверки подписи.

**Поведение при 5xx на подписанном запросе:** один повтор того же логического тела **без** подписи (plain JSON), если повтор вернул успех.

Подробнее: `docs/DOCKER_HMAC_DEBUG.md`.

---

## Формат ответа (общие замечания)

- n8n часто отдаёт **массив** из одного элемента вместо объекта — отдельные эндпоинты это учитывают (`login`, `getCOOIncomingMessages` и т.д.).
- Ответ может быть обёрнут в `body_b64` при включённом HMAC на сервере.
- Клиент при ошибке HTTP выбрасывает исключение с кодом статуса и обрезком тела ответа (~300 символов).

---

## Список действий по `action`

Нотация: **Plain body** — объект, который подписывается/уходит как JSON (до обёртки `body_b64`). Поле `payload` опускается, если в коде передан `undefined`.

### `login`

**Сессия не добавляется** (запрос без `buildBody`).

**Тело запроса:**

```json
{
  "action": "login",
  "payload": {
    "email": "string",
    "password": "string"
  }
}
```

**Ожидаемый ответ (логика клиента):**

- Объект или массив с первым элементом-объектом.
- Поля (прямые или внутри `_wf3.access`): `access` / `allowed` → `boolean`;
- `token` (string, опционально);
- `company_id` или вложенно `user_id` как идентификатор компании;
- опционально `blocked`, `blockedUntil` / `blocked_until`.

Нормализация: `src/api/n8n.ts` → `login()`.

---

### `reportFailedLogin`

**Сессия не передаётся** (тело собирается вручную, без полей сессии).

**Тело запроса:**

```json
{
  "action": "reportFailedLogin",
  "payload": {
    "email": "string",
    "timestamp": 1730000000000,
    "userAgent": "string",
    "language": "string",
    "screenWidth": 1920,
    "screenHeight": 1080,
    "timezoneOffset": -180
  }
}
```

**Ожидаемый ответ:**

```json
{
  "blocked": false,
  "blockedUntil": 1730000000000
}
```

(`blockedUntil` опционален.)

---

### `requestDemo`

`buildBody` **не добавляет** `company_id` / `token` / `user_id`.

**Тело запроса:**

```json
{
  "action": "requestDemo",
  "payload": {
    "name": "string",
    "email": "string",
    "source": "string",
    "region": "string"
  }
}
```

**Ожидаемый ответ (логика клиента):**

- `access` или `result`: `'access' | 'deny'` (если нет — считается `'deny'`);
- опционально `message`: `string`.

---

### `getTasks`

**Тело:** `{ "action": "getTasks", "company_id", "token", "user_id" }`

**Ответ:** клиент типизирует как `{ tasks: Task[] }`. Фактическую форму n8n лучше держать согласованной с типом `Task` в `src/types.ts`.

---

### `getClients`

**Тело:** `{ "action": "getClients", ...сессия }`

**Ответ:** произвольный JSON; клиент **выдёргивает** массив клиентов эвристикой (массив объектов с `id` / `name` / `primary_email`, вложенные массивы, строка-JSON). Итог: `{ clients: Client[] }`.

---

### `updateClient`

**Тело:** `{ "action": "updateClient", "payload": <Client>, ...сессия }`

`Client` — объект с обязательным `id` и прочими полями (`src/types.ts`).

**Ответ:** `{ client: Client }` (как возвращает `request()`; n8n должен вернуть совместимую структуру).

---

### `getLeads`

**Тело:** `{ "action": "getLeads", ...сессия }`

**Ответ:** гибкий: объект с `leads` / `items` / `data` / `body`, массив, массив из одного объекта и т.д. Клиент извлекает `leads[]` и `stages[]` (см. `extractLeadsArray` / `extractStagesArray`). События лидов: `events`, `history`, опечатка `evants`.

---

### `updateLead`

**Тело:** `{ "action": "updateLead", "payload": <Lead>, ...сессия }`

**Ответ:** `{ lead: Lead }`.

---

### `getDeals`

**Тело:** `{ "action": "getDeals", ...сессия }`

**Ответ:** `{ deals: Deal[]; stages: { id, title, order }[] }` (ожидание клиента).

---

### `updateDeal`

**Тело:** `{ "action": "updateDeal", "payload": <Deal>, ...сессия }`

**Ответ:** `{ deal: Deal }`.

---

### `getInvoices`

**Тело:** `{ "action": "getInvoices", ...сессия }`

**Ответ:** `{ invoices: Invoice[]; stages: { id, title, order }[] }`.

---

### `updateInvoice`

**Тело:** `{ "action": "updateInvoice", "payload": <Invoice>, ...сессия }`

**Ответ:** `{ invoice: Invoice }`.

---

### `getBlockData`

**Тело:**

```json
{
  "action": "getBlockData",
  "payload": { "viewId": "string" },
  "...": "сессия"
}
```

**Ответ:** `Record<string, unknown>` (произвольный объект).

---

### `getDashboard`

**Тело:**

```json
{
  "action": "getDashboard",
  "payload": { "template": "default" },
  "...": "сессия"
}
```

(`template` по умолчанию в коде — `"default"`.)

**Ответ:** `Record<string, unknown>`.

---

### `getChatData`

**Тело:** `{ "action": "getChatData", ...сессия }`

**Ответ:** `{ channels: ChatChannel[]; users: ChatUser[] }`.

---

### `getChatMessages`

**Тело:**

```json
{
  "action": "getChatMessages",
  "payload": { "chatId": "string", "chatType": "channel" | "user" },
  "...": "сессия"
}
```

**Ответ:** `{ messages: ChatMessage[] }`.

---

### `sendChatMessage`

**Тело:**

```json
{
  "action": "sendChatMessage",
  "payload": {
    "chatId": "string",
    "chatType": "channel" | "user",
    "text": "string",
    "attachments": []
  },
  "...": "сессия"
}
```

(`attachments` опционально.)

**Ответ:** `{ message: ChatMessage }`.

---

### `sendChatFile`

**Тело:**

```json
{
  "action": "sendChatFile",
  "payload": {
    "chatId": "string",
    "chatType": "channel" | "user",
    "fileName": "string",
    "mimeType": "string",
    "contentBase64": "string"
  },
  "...": "сессия"
}
```

**Ответ:** `{ message: ChatMessage }`.

---

### `getConfig`

**Тело:** `{ "action": "getConfig", ...сессия }`

**Ответ:** либо `{ "config": { ... } }`, либо сам объект конфига на корне — клиент нормализует в `CompanyConfig`.

---

### `updateConfig`

**Тело:** `{ "action": "updateConfig", "payload": <CompanyConfig>, ...сессия }`

**Ответ:** объект конфига (с полем `config` или целиком корень).

---

### `getCOOIncomingMessages`

**Тело без `after_id`:**

```json
{ "action": "getCOOIncomingMessages", "...": "сессия" }
```

**С курсором:**

```json
{
  "action": "getCOOIncomingMessages",
  "payload": { "after_id": "string" },
  "...": "сессия"
}
```

(`after_id` — строка, bigint sequence.)

**Ожидаемый ответ:**

- `{ "messages": [ COOIncomingMessage, ... ] }` **или**
- `[ { "messages": [ ... ] } ]`

Иначе клиент вернёт `{ messages: [] }`.

Тип сообщения: `src/types.ts` → `COOIncomingMessage` (`id`, `text`, `timestamp`, опционально `attachments`, `status`).

---

### `getCOOResponse`

Используется только из `useN8n` для опроса после отложенного ответа COO.

**Тело:**

```json
{
  "action": "getCOOResponse",
  "request_id": "string",
  "...": "сессия (если есть)"
}
```

**Ожидаемый ответ:**

- Пока не готово: без `status: "ready"` (клиент считает «ещё в процессе»).
- Готово: `{ "status": "ready", "text"?: "...", "message"?: "...", "output"?: "...", "attachments"?: [...], "files"?: [...] }`

Текст берётся из первого непустого из `text`, `message`, `output`. Вложения: `attachments` или `files`.

---

## COO: отправка сообщения ассистенту (без `action`)

Тот же URL и `requestWebhook()`, но тело **не** через `buildBody` и **без** поля `action`. Workflow n8n должен отличать этот запрос по наличию `message` / отсутствию `action`.

**Тело запроса:**

```json
{
  "message": "string",
  "timestamp": 1730000000000,
  "company_id": "string",
  "token": "string",
  "user_id": "string"
}
```

(Три поля сессии — только если пользователь авторизован; иначе только `message` и `timestamp`.)

**Ответ — вариант A (сразу):**

Объект с хотя бы одним из полей текста: `text` / `message` / `output`, опционально `attachments` или `files` (массив объектов с `type`: `image` | `file` | `chart`, `url`, опционально `name`).

**Ответ — вариант B (отложенно):**

```json
{
  "status": "processing",
  "request_id": "string"
}
```

Клиент опрашивает `getCOOResponse` каждые ~1.5 с, до ~90 с.

---

## Сводная таблица `action`

| `action` | `payload` / особенности |
|----------|-------------------------|
| `login` | `{ email, password }`, без сессии |
| `reportFailedLogin` | см. выше, без сессии |
| `requestDemo` | `DemoRequest`, без полей сессии |
| `getTasks` | нет |
| `getClients` | нет |
| `updateClient` | клиент целиком |
| `getLeads` | нет |
| `updateLead` | лид целиком |
| `getDeals` | нет |
| `updateDeal` | сделка |
| `getInvoices` | нет |
| `updateInvoice` | счёт |
| `getBlockData` | `{ viewId }` |
| `getDashboard` | `{ template }` |
| `runAction` | `{ action_key, workflow_id?, department?, params?, confirmed?, idempotency_key? }` — запуск действия отдела. См. `docs/N8N_ACTION_RUNNER.md` |
| `getActionResult` | `{ request_id }` — опрос отложенного `runAction` |
| `getChatData` | нет |
| `getChatMessages` | `{ chatId, chatType }` |
| `sendChatMessage` | `{ chatId, chatType, text, attachments? }` |
| `sendChatFile` | `{ chatId, chatType, fileName, mimeType, contentBase64 }` |
| `getConfig` | нет |
| `updateConfig` | объект конфига |
| `getCOOIncomingMessages` | опционально `{ after_id }` |
| `getCOOResponse` | `request_id` на **корне** тела (не внутри `payload`) |
| *(нет action)* | сообщение в COO: `message`, `timestamp` + сессия |

---

## Типы данных (кратко)

См. `src/types.ts`: `Task`, `Client`, `Lead`, `LeadStage`, `LeadEvent`, `Deal`, `Invoice`, `ChatChannel`, `ChatUser`, `ChatMessage`, `ChatAttachment`, `DemoRequest`, `COOIncomingMessage`.
