# Блокировка входа по IP (n8n)

Клиент при неудачном логине вызывает `reportFailedLogin` и ожидает от бэкенда учёт попыток по IP и при необходимости блокировку.

## Правила блокировки (по IP за последние 24 часа)

| Неудачных попыток | Блокировка   |
|-------------------|--------------|
| 3                 | 30 минут     |
| 6 и более         | 3 часа       |
| 10 и более        | 24 часа      |

## Действия n8n

### 1. Обработка `action: 'reportFailedLogin'`

- **Вход:** тело запроса содержит `payload`: `email`, `userAgent`, `language`, `screenWidth`, `screenHeight`, `timezoneOffset`, `timestamp` (пароль не передаётся).
- **IP:** брать из заголовков запроса (например `X-Forwarded-For` или `req.connection.remoteAddress`).
- **Логика:**
  - Хранить по каждому IP список меток времени неудачных попыток за последние 24 ч (или счётчик с TTL).
  - После каждой неудачной попытки увеличивать счётчик для этого IP (в окне 24 ч).
  - По счётчику определить длительность блокировки: 3 → 30 мин, 6 → 3 ч, 10 → 24 ч.
  - Если порог достигнут: сохранить для IP время разблокировки `blockedUntil` (timestamp ms), отправить вебхук **block** с данными клиента (см. ниже).
- **Ответ:** `{ "blocked": true, "blockedUntil": <timestamp ms> }` или `{ "blocked": false }`.

### 2. Вебхук при блокировке (command: block)

При первом срабатывании блокировки для данного IP отправить вебхук с:

- **command:** `block`
- **Данные клиента (пример):** `email`, `ip`, `userAgent`, `language`, `screenWidth`, `screenHeight`, `timezoneOffset`, `timestamp`, `blockedUntil`, `attemptCount`.

### 3. Обработка `action: 'login'` (опционально)

- Если для IP уже действует блокировка (текущее время < `blockedUntil`), можно сразу вернуть:  
  `{ "access": false, "blocked": true, "blockedUntil": <timestamp> }`  
  без проверки пароля.

## Формат запроса reportFailedLogin (от клиента)

```json
{
  "action": "reportFailedLogin",
  "payload": {
    "email": "user@example.com",
    "userAgent": "...",
    "language": "ru-RU",
    "screenWidth": 1920,
    "screenHeight": 1080,
    "timezoneOffset": -180,
    "timestamp": 1739123456789
  }
}
```

Ответ при блокировке:

```json
{
  "blocked": true,
  "blockedUntil": 1739125256789
}
```
