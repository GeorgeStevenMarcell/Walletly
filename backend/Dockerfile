# ── Deps stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN apk add --no-cache wget tini   # wget for healthcheck, tini as PID 1
WORKDIR /app

# Least-privilege user
RUN addgroup -S walletly && adduser -S walletly -G walletly

COPY --chown=walletly:walletly --from=deps /app/node_modules ./node_modules
COPY --chown=walletly:walletly . .

USER walletly
EXPOSE 4000

# tini handles signals correctly so Node exits cleanly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
