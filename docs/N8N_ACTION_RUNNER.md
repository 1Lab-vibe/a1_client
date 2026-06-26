# Спринт 0 — запуск действий отдела из веба (`runAction`)

Цель: кнопка «Запуск» в карточках действий (раздел OPS, любой отдел) реально вызывает соответствующий workflow-обработчик в prod n8n. Раньше кнопка была `disabled` — бэкенд-контракта на запуск не существовало.

Источник правды на клиенте: [`src/api/n8n.ts`](../src/api/n8n.ts) (`runAction`, `getActionResult`), [`src/hooks/useActionRunner.ts`](../src/hooks/useActionRunner.ts), [`src/components/OpsDepartmentView.tsx`](../src/components/OpsDepartmentView.tsx).

---

## Архитектура

```
Клиент (кнопка «Запуск»)
   │  action: "runAction"  (+ session, HMAC)
   ▼
Главный роутер n8n (Webhook → Switch по action)   ← ДОБАВИТЬ 1 ветку
   │  ветка "runAction"  → Execute Workflow
   ▼
a1_action_runner  (workflows/a1_action_runner.json)
   │  Switch: approval / run / error
   ▼
Execute Workflow (workflowId = action.workflow_id)  ← динамически, любой обработчик
```

Все исполнения проходят через **одну** новую ветку Switch в главном роутере и один workflow `a1_action_runner`. Внутри раннера обработчик вызывается **динамически по `workflow_id`** из карточки действия — поэтому новые action handlers работают без правки свитча.

Карточки действий уже приходят из `getOpsDepartment` с полями `action_key`, `workflow_id`, `handler_ref`, `risk_level`, `requires_human_approval` — клиент передаёт их в `runAction`.

---

## Контракт

### `runAction` (запуск)

**Запрос (тело до HMAC):**

```json
{
  "action": "runAction",
  "payload": {
    "action_key": "issue_invoice",
    "workflow_id": "8zwRIxxijdq2JDDu",
    "department": "finances",
    "params": {},
    "confirmed": false,
    "idempotency_key": "uuid"
  },
  "company_id": "...", "token": "...", "user_id": "..."
}
```

**Ответ — синхронно (готово сразу):**

```json
{ "ok": true, "status": "done", "result": { ... }, "text": "Счёт выставлен", "attachments": [] }
```

**Ответ — отложенно (долгий обработчик):**

```json
{ "ok": true, "status": "processing", "request_id": "..." }
```

Клиент опрашивает `getActionResult` каждые ~1.5 с до ~90 с (см. `useActionRunner`).

**Ответ — нужно подтверждение** (если `requires_human_approval` и `confirmed` ещё не пришёл):

```json
{ "ok": false, "status": "needs_approval", "message": "..." }
```

**Ответ — ошибка:**

```json
{ "ok": false, "status": "error", "error": "текст ошибки" }
```

Клиент терпим к форматам: `status` может быть `done|processing|pending|queued|needs_approval|error|failed`; текст берётся из `text`/`message`/`output`; вложения из `attachments`/`files`. Поддерживается обёртка `{ ok, data: {...} }`.

### Параметры режима и конверт хендлера

`runAction` принимает `operation` и `params` (значения формы режима). Раннер (нода **Build handler envelope**) оборачивает их в конверт, который читают хендлеры:

```json
{
  "workflow_id": "...",
  "company_id": "...", "user_id": "...", "token": "...",
  "action_key": "...", "operation": "create_payment",
  "action": { "action_key": "...", "company_id": "...", "params": { "operation": "...", "payload": { ...params } } },
  "params": { "operation": "...", "payload": { ...params } },
  "payload": { ...params },
  "paymentRequest": { ...params }
}
```

Поэтому из формы достаточно прислать `params` (поля режима):
- **issue_invoice** читает `action.params.payload.{amount, customer_id, deal_id, currency, due_date, to_email, send_now, title}`.
- **yookassa** читает `payload.operation` (`create_payment`|`get_payment`|`create_invoice`) + `payload.{amount, currency, description, customer_email, return_url}`.
- **ops_finance** (LLM) читает `payload.user_message` — для него клиент собирает текст-запрос из полей (`buildMessage` в `src/config/financeModes.ts`); операция выбирается LLM. Текст результата раннер берёт из `result.llm_output.final_response`.

Каталог финансовых режимов и их поля: `src/config/financeModes.ts`; UI — `src/components/FinanceView.tsx`.

### `getActionResult` (опрос отложенного запуска)

**Запрос:** `{ "action": "getActionResult", "payload": { "request_id": "..." }, ...session }`

**Ответ:** тот же набор полей, что у `runAction` (`status: "processing"` пока не готово, затем `done`/`error`).

> Для демо проще всего отвечать **синхронно** (`status: "done"`). `getActionResult` нужен только если обработчик долгий (YooKassa, Sber, Яндекс.Директ) и вы решите ставить его в очередь.

---

## Что сделать в n8n

### 1. Импортировать `a1_action_runner`

Workflows → Import from File → [`workflows/a1_action_runner.json`](../workflows/a1_action_runner.json). Активировать.

Внутри:
- **Normalize input** — достаёт `action_key`, `workflow_id`, `department`, `params`, `confirmed`, сессию; решает гейт `run`/`approval`/`error`.
- **Gate** (Switch) — три выхода: `run`, `approval`, ошибка (fallback).
- **Run handler workflow** — Execute Workflow с динамическим `workflowId = {{ $json.workflow_id }}` (`continueOnFail`).
- **Shape result** — приводит ответ обработчика к `{ ok, status, result, text }`.

> Если конкретный обработчик ждёт особую форму входа — добавьте перед его вызовом маппинг (или Switch по `department`/`action_key`). По умолчанию раннер передаёт `{ action_key, department, params, company_id, token, user_id }`.

### 2. Добавить ветку в главный роутер

В workflow с основным webhook, в Switch по `body.action`:

1. Новый выход с условием `action === "runAction"` → нода **Execute Workflow** → `a1_action_runner` (режим: дождаться результата).
2. Результат раннера → ваша существующая нода ответа (HMAC-подпись + Respond to Webhook) — так же, как для `getDeals`/`getInvoices`.
3. (Опционально, для отложенного режима) выход `action === "getActionResult"` → чтение результата по `request_id` из вашего хранилища очереди.

### 3. Approval / risk

Действия с `requires_human_approval: true` или `risk_level: "high"` клиент запускает **только после подтверждения** в модалке и шлёт `confirmed: true`. Раннер дополнительно страхует: при `requires_human_approval && !confirmed` возвращает `needs_approval`. Для надёжной защиты сверяйте право на стороне бэкенда (роль из сессии), а не только по флагу клиента.

---

## Известные workflow_id обработчиков (для проверки)

| Отдел | action_key | workflow_id | risk | approval |
|-------|-----------|-------------|------|----------|
| finances | issue_invoice | 8zwRIxxijdq2JDDu | medium | нет |
| finances | ms_integration_yookassa | ic2ycjtwKCWfgjDq | high | да |
| finances | ms_integration_sber_business | gs7gpQpUDJ5tfoSN | high | да |
| finances | ops_billing_executor | DzoH2vZG04lZvUsE | medium | нет |
| finances | ops_erp_reconciliation | bxGtdE1vhaHJd5Ma | low | нет |
| finances | ops_finance | qD172IZJGkaQCW6c | medium | нет |
| sales | lead_creation | FKAELVdLqPQCbWGH | medium | нет |
| sales | sales_manager / sales_ops | y7zsYXBZHXRJ7zdg | low | нет |
| sales | dadata_find_party | 9uPId6cTXwQ4JN1p | low | нет |

(Полный список приходит динамически в `getOpsDepartment` → `actions[]`.)

---

## Проверка после внедрения

1. OPS → Финансы → карточка «ERP reconciliation» (risk low) → «Запуск» → тост «Действие выполнено», данные отдела обновляются.
2. Карточка «YooKassa» (high + approval) → «Запуск» → модалка подтверждения → после «Запустить» уходит `confirmed: true`.
3. Если обработчик долгий — раннер возвращает `processing` + `request_id`, клиент сам опрашивает результат.
