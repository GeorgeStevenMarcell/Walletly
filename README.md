# Walletly 💳

A mobile-first PWA for budget tracking, shared wallets, and spending analytics.

## Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 18 + Vite (PWA) |
| Backend   | Node.js 20 + Express |
| Database  | PostgreSQL 16 |
| Cache     | Redis 7 (sessions + API cache + rate limiting) |
| Proxy     | Nginx 1.25 (static files + reverse proxy) |
| Tunnel    | Cloudflare Tunnel (cloudflared) |
| Runtime   | Docker + Docker Compose |

## Quick Start

```bash
# 1. Clone and enter the project
git clone <your-repo> walletly && cd walletly

# 2. Create your .env file
cp .env.example .env

# 3. Fill in secrets (open .env and edit the CHANGE_ME values)
#    Minimum required:
#      POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, SESSION_SECRET
nano .env

# 4. Build and start all services
docker compose up -d --build

# 5. Open http://localhost:8082 in your browser
```

> **First run** takes ~2 minutes to build the frontend and pull images.
> Subsequent starts are instant since layers are cached.

## Services & Ports

| Service      | Internal Port | Exposed Port | Notes |
|--------------|--------------|-------------|-------|
| nginx        | 80           | **8082**    | Entry point — serves frontend + proxies /api |
| backend      | 4000         | (none)      | Only reachable via nginx |
| postgres     | 5432         | 5432        | Remove port in production |
| redis        | 6379         | 6379        | Remove port in production |
| cloudflared  | —            | (none)      | Cloudflare Tunnel — exposes app publicly |

## Project Structure

```
walletly/
├── docker-compose.yml
├── .env.example
├── postgres/
│   └── init.sql              # Schema — runs once on first boot
├── nginx/
│   ├── nginx.conf
│   ├── conf.d/
│   │   ├── walletly.conf         # HTTP virtual host
│   │   └── walletly_locations.conf.inc  # Proxy + static + SPA fallback
│   └── certs/                # Place TLS certs here (see HTTPS section)
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js           # Express entry point
│       ├── schemas.js         # Zod validation schemas
│       ├── db/
│       │   ├── postgres.js    # pg connection pool
│       │   └── redis.js       # ioredis + cache helpers
│       ├── middleware/
│       │   ├── auth.js        # JWT verify + wallet membership
│       │   ├── validate.js    # Zod schema middleware
│       │   └── rateLimit.js   # Redis-backed rate limiting
│       └── routes/
│           ├── auth.js        # POST /register, POST /login
│           ├── wallets.js     # Wallet CRUD + member management
│           ├── transactions.js
│           └── budgets.js     # Categories + budgets + stats
└── frontend/
    ├── Dockerfile
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── api.js             # Fetch wrapper for all endpoints
        ├── App.jsx            # Root — AuthProvider → WalletShell → pages
        ├── context/
        │   ├── AuthContext.jsx
        │   ├── WalletContext.jsx
        │   └── NavigationContext.jsx
        └── pages/
            # Dashboard, Transactions, Budget, MonthlyRecap, Settings
```

## API Reference

All routes except `/api/auth/*` require `Authorization: Bearer <token>`.

### Auth
```
POST /api/auth/register   { username, password, displayName }
POST /api/auth/login      { username, password }
```

### Wallets
```
GET    /api/wallets
POST   /api/wallets                          { name }
PATCH  /api/wallets/:id                      { name }
DELETE /api/wallets/:id
PATCH  /api/wallets/:id/settings             { monthStartDay, dayStartHour }
POST   /api/wallets/:id/members              { username }
DELETE /api/wallets/:id/members/:userId
```

### Transactions
```
GET    /api/wallets/:id/transactions         ?from=&to=&type=&limit=&offset=
POST   /api/wallets/:id/transactions         { type, amount, categoryId, note, txnDate }
PATCH  /api/wallets/:id/transactions/:txnId  { amount, categoryId, note, txnDate }
DELETE /api/wallets/:id/transactions/:txnId
```

### Categories
```
GET    /api/wallets/:id/categories
POST   /api/wallets/:id/categories           { type, label, icon, color }
DELETE /api/wallets/:id/categories/:catId
```

### Budgets
```
GET    /api/wallets/:id/budgets              ?period=YYYY-MM
PUT    /api/wallets/:id/budgets              { categoryId, amount, period }
DELETE /api/wallets/:id/budgets/:budgetId
```

### Stats
```
GET    /api/wallets/:id/stats                ?from=YYYY-MM-DD&to=YYYY-MM-DD
```

## Development (without Docker)

```bash
# Terminal 1 — start Postgres + Redis only
docker compose up -d postgres redis

# Terminal 2 — backend
cd backend && npm install && npm run dev
# Runs at http://localhost:4000

# Terminal 3 — frontend
cd frontend && npm install && npm run dev
# Runs at http://localhost:5173 with /api proxied to :4000
```

## Redeploying

When making changes, rebuild only what changed:

```bash
# Backend change
docker compose up -d --build backend && docker compose restart nginx

# Frontend change
docker compose up -d --build frontend && docker compose restart nginx

# Both
docker compose up -d --build backend frontend && docker compose restart nginx
```

> **Note:** Always restart nginx after rebuilding backend or frontend — nginx caches the upstream IP and the frontend static volume.

## HTTPS / TLS

Option A — Cloudflare Tunnel (recommended, already configured):
1. Set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`
2. The `cloudflared` service handles HTTPS termination automatically

Option B — Self-managed TLS:
1. Obtain certificates (e.g. via Certbot / Let's Encrypt)
2. Copy `fullchain.pem` and `privkey.pem` to `nginx/certs/`
3. Uncomment the HTTPS server block in `nginx/conf.d/walletly.conf`
4. Set `ALLOWED_ORIGINS=https://your.domain.com` in `.env`
5. `docker compose up -d nginx`

## Security Notes

- Passwords hashed with bcrypt (cost factor 12)
- JWT + Redis-backed sessions (dual auth layer)
- Rate limiting: 10 req/15min on auth routes, 200 req/15min on API (Redis-backed, separate counters)
- All non-auth API endpoints require wallet membership verification
- Nginx hides server version and sets security headers via Helmet
- Backend runs as non-root user inside Docker
- Never expose `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, or `SESSION_SECRET`
