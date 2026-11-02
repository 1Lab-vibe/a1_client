# Сборка фронтенда
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npm run build

# Метка сборки для проверки деплоя (см. /build-info.json)
RUN echo "{\"buildDate\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > /app/dist/build-info.json

# Отдача статики через nginx
FROM nginx:alpine

RUN apk add --no-cache gettext

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/public/config.template.js /etc/nginx/config.template.js

# При старте контейнера генерируем config.js только с URL server proxy.
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# SPA: index.html без кэша — браузер всегда тянет свежую версию и новые assets
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
