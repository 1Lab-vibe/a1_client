#!/bin/sh
set -e
HTML=/usr/share/nginx/html

# Генерируем config.js и config.json из env (для HMAC и webhook URL в проде)
if [ -f /etc/nginx/config.template.js ]; then
  envsubst '${VITE_A1_WEBHOOK_SECRET} ${VITE_N8N_WEBHOOK_URL}' < /etc/nginx/config.template.js > "$HTML/config.js"
fi
# config.json — приложение подгружает по fetch (обход кэша); значения в base64, чтобы не ломать JSON
secret_b64=""
url_b64=""
[ -n "$VITE_A1_WEBHOOK_SECRET" ] && secret_b64=$(printf '%s' "$VITE_A1_WEBHOOK_SECRET" | base64 -w 0 2>/dev/null || printf '%s' "$VITE_A1_WEBHOOK_SECRET" | base64)
[ -n "$VITE_N8N_WEBHOOK_URL" ] && url_b64=$(printf '%s' "$VITE_N8N_WEBHOOK_URL" | base64 -w 0 2>/dev/null || printf '%s' "$VITE_N8N_WEBHOOK_URL" | base64)
printf '{"VITE_A1_WEBHOOK_SECRET_B64":"%s","VITE_N8N_WEBHOOK_URL_B64":"%s"}\n' "$secret_b64" "$url_b64" > "$HTML/config.json"

# Диагностика: по адресу /config-status.json видно, дошли ли env до контейнера (без раскрытия секрета)
secret_len=0
[ -n "$VITE_A1_WEBHOOK_SECRET" ] && secret_len=${#VITE_A1_WEBHOOK_SECRET}
url_set="false"
[ -n "$VITE_N8N_WEBHOOK_URL" ] && url_set="true"
printf '{"secret_set":%s,"secret_length":%d,"url_set":%s}\n' \
  "$([ -n "$VITE_A1_WEBHOOK_SECRET" ] && echo true || echo false)" \
  "$secret_len" \
  "$url_set" \
  > "$HTML/config-status.json"

exec nginx -g "daemon off;"
