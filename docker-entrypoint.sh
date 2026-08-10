#!/bin/sh
set -e
HTML=/usr/share/nginx/html

# Генерируем публичный config без секретов. HMAC выполняется только A1 API.
if [ -f /etc/nginx/config.template.js ]; then
  envsubst '${VITE_N8N_WEBHOOK_URL}' < /etc/nginx/config.template.js > "$HTML/config.js"
fi
# config.json — приложение подгружает по fetch (обход кэша); значения в base64, чтобы не ломать JSON
url_b64=""
[ -n "$VITE_N8N_WEBHOOK_URL" ] && url_b64=$(printf '%s' "$VITE_N8N_WEBHOOK_URL" | base64 -w 0 2>/dev/null || printf '%s' "$VITE_N8N_WEBHOOK_URL" | base64)
printf '{"VITE_N8N_WEBHOOK_URL_B64":"%s"}\n' "$url_b64" > "$HTML/config.json"

# Диагностика публичного URL и server-side режима подписи.
url_set="false"
[ -n "$VITE_N8N_WEBHOOK_URL" ] && url_set="true"
printf '{"signing":"server-side","url_set":%s}\n' "$url_set" > "$HTML/config-status.json"

exec nginx -g "daemon off;"
