# ─────────────────────────────────────────────────────────────────────────
# Web Dinámica — Dockerfile del backend (NestJS + SPA en public/)
# ─────────────────────────────────────────────────────────────────────────
# Stage 1: compila con todas las devDeps (nest CLI, tsc).
# Stage 2: runtime mínimo con solo lo necesario.
#
# El front YA viene horneado en public/ (no se compila aquí). El backend
# sirve public/ como SPA y /api/v1 como API en el mismo puerto.
# ─────────────────────────────────────────────────────────────────────────

# ── Stage 1: builder ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Cachear deps: copiamos solo los manifests primero
COPY package*.json ./
RUN npm ci --include=dev --no-audit --no-fund

# Código + assets
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
COPY public ./public

RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

ENV NODE_ENV=production

# tini = init mínimo que reapa zombies y enruta señales (SIGTERM correcto)
# curl para healthchecks
RUN apk add --no-cache tini curl

WORKDIR /app

# Copiamos node_modules COMPLETO (incluye devDeps porque ts-node y typeorm-cli
# pueden ser invocados por scripts de migración / seed manuales si hace falta).
# El overhead en disco es aceptable y simplifica operación.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/nest-cli.json ./

# Las imágenes subidas van a /app/uploads (montado como volumen en compose)
RUN mkdir -p /app/uploads

EXPOSE 3000

# Healthcheck: el endpoint público de promociones siempre responde 200
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3000/api/v1/promotions/active >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
