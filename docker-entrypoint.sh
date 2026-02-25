#!/bin/sh
set -e
HTML=/usr/share/nginx/html

# Генерируем config.js из шаблона и переменных окружения (для HMAC и webhook URL в проде)
if [ -f /etc/nginx/config.template.js ]; then
  envsubst '${VITE_A1_WEBHOOK_SECRET} ${VITE_N8N_WEBHOOK_URL}' < /etc/nginx/config.template.js > "$HTML/config.js"
fi

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
