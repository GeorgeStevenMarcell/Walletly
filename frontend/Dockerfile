# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Copy dist to shared volume via shell ────────────────────────────
# The built files are copied to /app/dist.
# docker-compose mounts frontend_dist to /app/dist so nginx can serve them.
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/dist /app/dist
# Keep container alive briefly so docker can copy the volume, then exit cleanly
CMD ["sh", "-c", "echo 'Frontend build complete.' && exit 0"]
