#!/bin/sh
# Генерируем config.js из шаблона и переменных окружения (для HMAC и webhook URL в проде)
if [ -f /etc/nginx/config.template.js ]; then
  envsubst '${VITE_A1_WEBHOOK_SECRET} ${VITE_N8N_WEBHOOK_URL}' < /etc/nginx/config.template.js > /usr/share/nginx/html/config.js
fi
exec nginx -g "daemon off;"
