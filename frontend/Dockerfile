# Build della SPA React (npm 11, la stessa versione con cui è generato package-lock.json)
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY public ./public
COPY src ./src
RUN npm run build

# Distribuzione con nginx (utente non privilegiato), che fa anche da reverse proxy verso il backend
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 8080
