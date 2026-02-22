# A1 Client — фронтенд для n8n

Вход по **email** (логин) и паролю; кнопка **«Запросить демо доступ»** открывает форму (имя, email, откуда узнали, регион) и отправляет заявку в n8n; в ответ ожидается **access** или **deny**. Рабочий стол: COO, Задачи, Клиенты, Настройки, Лиды, Чат.

## Запуск

```bash
npm install
npm run dev
```

Откройте http://localhost:5173

## COO (главный блок)

- Приветственный экран с **анимированной головой** на фоне сетки и текстом «Чем могу быть полезен?».
- **Голосовой ввод**: кнопка микрофона (работает в Chrome/Edge с разрешением на микрофон).
- **Текстовый ввод**: поле ввода и отправка Enter.
- Ответы n8n отображаются в виде **текста**, **изображений**, **файлов** и **графиков** (по полям `text` и `attachments` в ответе webhook).

## Блоки

- **Задачи** — таблица: тип (task_type), отдел (domain), статус (status), шаг (step_index), создана (created_at), описание (кратко из params без системных полей). Данные по webhook `action: 'getTasks'`.
- **Клиенты** — таблица с динамическими колонками по полям из n8n (обязательно `id`, остальные — любые). Клик по строке открывает редактирование всех переданных полей; сохранение уходит в n8n (`getClients`, `updateClient`).
- **Лиды** — канбан: этапы (не обработан, в работе, успешный) приходят из n8n; смена этапа отправляет `updateLead`.
- **Чат** — общий чат и личные диалоги (как в Telegram): каналы и пользователи из n8n, сообщения по выбранному чату, отправка в общий или персонально.

## Интеграция с n8n

Один webhook URL. Запросы — POST с JSON. Разделение по полю **message** (COO) или **action** (остальное).

### COO (диалог с ассистентом)

Клиент отправляет один и тот же webhook. Поддерживаются два варианта ответа.

**Вариант 1 — ответ сразу**  
- Тело запроса: `{ "message": "текст", "timestamp": 1234567890, "company_id", "token", "user_id" }`  
- Ответ: `{ "text": "...", "attachments": [{ "type": "image"|"file"|"chart", "url": "...", "name": "..." }] }`

**Вариант 2 — ответ не сразу (отложенный)**  
- Тело запроса то же.  
- Ответ n8n сразу: `{ "status": "processing", "request_id": "уникальный-id" }`.  
- Клиент раз в ~1.5 с опрашивает тот же webhook с действием получения ответа по `request_id`.  
- Запрос опроса: `{ "action": "getCOOResponse", "request_id": "тот же id", "company_id", "token", "user_id" }`.  
- Пока ответ не готов, n8n возвращает, например: `{ "status": "pending" }`.  
- Когда ответ готов: `{ "status": "ready", "text": "...", "attachments": [...] }`.  

Клиент ждёт готовности до ~90 с, затем показывает «Ответ не получен. Попробуйте позже.»  
В n8n: при длительной обработке (LLM, внешние API) верните сразу `status: "processing"` и `request_id`, сохраните задачу (очередь/БД), по готовности отдайте тот же `request_id` с `status: "ready"` и `text`/`attachments` при запросе `action: "getCOOResponse"`.

**Сообщения из n8n в COO (push, не в ответ на запрос)**  
n8n может отправлять в чат COO произвольные сообщения в любой момент (несколько сообщений с разным интервалом, не связанные с запросом пользователя).

- **Курсор — монотонный bigint (sequence).** Нельзя использовать `id > after_id` при UUID (порядок UUID не совпадает со временем). Нужен монотонный курсор: `messages.id = bigint generated always`, `after_id` тоже bigint. Так клиент гарантированно не получит дубли.
- Клиент раз в ~4 с опрашивает: `{ "action": "getCOOIncomingMessages", "payload": { "after_id": 123 } | undefined, "company_id", "token", "user_id" }`. Первый запрос — без `after_id` или без payload. `after_id` — bigint (в JSON можно числом или строкой).
- Ответ: `{ "messages": [{ "id": 124, "text": "...", "attachments": [...], "timestamp": 1234567890 }] }`. Поле `id` — bigint sequence. Отдавайте только сообщения с `id > after_id` (если передан).
- Чтобы «отправить» сообщение в COO из n8n: сохраните его в хранилище с монотонным id (bigint generated always), привязав к `user_id`/`company_id`. При опросе `getCOOIncomingMessages` возвращайте записи с `id > after_id`.

### Задачи, клиенты, лиды, чат (по action)

Все запросы приходят с полем **action** и при необходимости **payload**.

| action | Назначение | Ответ |
|--------|------------|--------|
| `getTasks` | Список задач | `{ "tasks": [{ "id", "task_type", "domain", "status", "step_index", "created_at", "params" }] }`. Колонка «Описание» собирается из `params` кратко, без системных ключей (id, _id, created_at и т.п.). |
| `getClients` | Список клиентов | Массив клиентов: `{ "clients": [...] }`, или `{ "data": [...] }`, или `{ "items": [...] }`, или массив в корне ответа. Колонки и форма редактирования — по полям из ответа. |
| `updateClient` | Сохранить клиента | тело: `{ "action": "updateClient", "payload": <Client> }`, ответ: `{ "client": <Client> }` |
| `getConfig` | Конфиг компании | `{ "config": { "ключ": "значение", ... } }` или объект конфига в корне. Используется в разделе «Настройки». |
| `updateConfig` | Сохранить конфиг | тело: `{ "action": "updateConfig", "payload": <config> }`, ответ: обновлённый конфиг. |
| `getLeads` | Лиды и этапы | `{ "leads": [...], "stages": [{ "id", "title", "order" }] }`. Этапы по умолчанию: не обработан, в работе, успешный. |
| `updateLead` | Сменить этап лида | тело: `{ "action": "updateLead", "payload": <Lead> }`, ответ: `{ "lead": <Lead> }` |
| `getChatData` | Каналы и пользователи | `{ "channels": [{ "id", "name", "isGeneral?" }], "users": [{ "id", "name" }] }` |
| `getChatMessages` | Сообщения чата | тело: `{ "action": "getChatMessages", "payload": { "chatId", "chatType": "channel"|"user" } }`, ответ: `{ "messages": [...] }` |
| `sendChatMessage` | Отправить сообщение | тело: `{ "action": "sendChatMessage", "payload": { "chatId", "chatType", "text" } }`, ответ: `{ "message": { "id", "chatId", "senderId", "senderName", "text", "timestamp" } }` |

### Вход и демо-доступ

| action | Назначение | Ответ |
|--------|------------|--------|
| `login` | Вход | тело: `{ "action": "login", "payload": { "email", "password" } }`. Ответ: `{ "access": true, "token": "...", "company_id": "..." }`. При успешном входе n8n должен вернуть **company_id** и **token** — они сохраняются и передаются в теле **каждого** последующего webhook-запроса (задачи, клиенты, лиды, чат, COO) на протяжении сессии. |
| `requestDemo` | Заявка на демо | тело: `{ "action": "requestDemo", "payload": { "name", "email", "source", "region" } }`. Ответ: `{ "access": "access" }` или `{ "access": "deny" }` (или поле `result` вместо `access`). |

В n8n в одном workflow можно разветвить по `body.message` (COO) и `body.action` (остальные методы).

URL webhook в `.env`: `VITE_N8N_WEBHOOK_URL=https://ваш-n8n/webhook/xxx`  
Либо без переменной — тогда запросы идут на `/api` (proxy в `vite.config.ts` → `http://localhost:5678/webhook`).

## Установка в Docker (Traefik)

Требуется внешняя сеть **traefik-public** (создаётся Traefik).

1. Создайте сеть, если её ещё нет:
   ```bash
   docker network create traefik-public
   ```

2. В каталоге проекта создайте `.env` (или задайте переменные в окружении):
   ```env
   # Домен для Traefik (обязательно для доступа по имени)
   TRAEFIK_HOST=a1.example.com
   # URL webhook n8n — подставляется в фронт при сборке образа
   VITE_N8N_WEBHOOK_URL=https://n8n.example.com/webhook/xxx
   ```

3. Сборка и запуск:
   ```bash
   docker compose build
   docker compose up -d
   ```

Контейнер будет в сети `traefik-public` с лейблами Traefik; роутер по умолчанию слушает `web` и правило `Host(\`$TRAEFIK_HOST\`)`. Для HTTPS и Let's Encrypt раскомментируйте закомментированные лейблы в `docker-compose.yml` и задайте `TRAEFIK_HOST`.

## Сборка

```bash
npm run build
```

Результат в папке `dist/`.
