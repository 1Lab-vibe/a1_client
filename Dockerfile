# Сборка фронтенда
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Переменные Vite встраиваются в бандл при сборке — передать через --build-arg или docker-compose args
ARG VITE_N8N_WEBHOOK_URL=
ARG VITE_A1_WEBHOOK_SECRET=
ENV VITE_N8N_WEBHOOK_URL=$VITE_N8N_WEBHOOK_URL
ENV VITE_A1_WEBHOOK_SECRET=$VITE_A1_WEBHOOK_SECRET

RUN npm run build

# Метка сборки для проверки деплоя (см. /build-info.json)
RUN echo "{\"buildDate\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > /app/dist/build-info.json

# Отдача статики через nginx
FROM nginx:alpine

RUN apk add --no-cache gettext

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/public/config.template.js /etc/nginx/config.template.js

# При старте контейнера генерируем config.js из env (VITE_A1_WEBHOOK_SECRET, VITE_N8N_WEBHOOK_URL)
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# SPA: index.html без кэша — браузер всегда тянет свежую версию и новые assets
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location = /index.html { add_header Cache-Control "no-store, no-cache, must-revalidate"; try_files /index.html =404; } \
  location = /config.js { add_header Cache-Control "no-store, no-cache"; try_files /config.js =404; } \
  location = /config.json { add_header Cache-Control "no-store, no-cache"; try_files /config.json =404; } \
  location = /config-status.json { add_header Cache-Control "no-store"; try_files /config-status.json =404; } \
  location = /build-info.json { add_header Cache-Control "no-store"; try_files /build-info.json =404; } \
  location / { try_files $uri $uri/ /index.html; } \
  location /health { return 200 "ok"; add_header Content-Type text/plain; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
