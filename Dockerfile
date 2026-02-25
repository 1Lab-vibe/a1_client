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

# Отдача статики через nginx
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA: все пути ведут на index.html
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { try_files $uri $uri/ /index.html; } \
  location /health { return 200 "ok"; add_header Content-Type text/plain; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
