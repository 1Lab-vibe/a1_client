# Диагностика server-side HMAC

Браузер больше не получает и не вычисляет HMAC-secret. Клиент отправляет обычный JSON на same-origin `POST /api`. Маршрут обслуживает A1 API, который подписывает запрос и пересылает его в n8n.

## Проверка клиента

Откройте в браузере `https://a1.a1os.ru/config-status.json`. Ожидаемый ответ:

```json
{"signing":"server-side","url_set":false}
```

В консоли браузера `__A1_DEBUG` должен показывать:

```js
{ signing: "server-side", webhookUrl: "/api" }
```

В `config.js`, `config.json`, собранных JS-файлах и environment контейнера `a1-client` не должно быть `VITE_A1_WEBHOOK_SECRET`.

## Проверка API

Переменные `A1_UI_WEBHOOK_SECRET` и `A1_UI_WEBHOOK_URL` хранятся только в server-side age+sops и передаются контейнеру `a1-api` через `sops exec-env`. Их значения нельзя выводить в логи или диагностические ответы.

Traefik направляет `Host(a1.a1os.ru) && Path(/api)` в `a1-api`. Остальные пути обслуживает статический контейнер клиента.

Контрольные сценарии:

- `POST /api` без server-side конфигурации возвращает `ui_webhook_not_configured`;
- поддельная подпись ответа n8n возвращает `webhook_response_auth_failed`;
- защищённый action без token возвращает контролируемый `auth_context_missing`;
- tenant определяется только по валидному token, а не по transport-secret или `company_id` из payload.
