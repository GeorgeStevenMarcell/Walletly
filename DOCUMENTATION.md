# Walletly — Technical Documentation

> A full-stack budget tracking Progressive Web App built with React, Express, PostgreSQL, and Redis, orchestrated via Docker Compose.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & System Design](#2-architecture--system-design)
3. [Directory Structure](#3-directory-structure)
4. [Database Schema](#4-database-schema)
5. [Backend API](#5-backend-api)
6. [Backend Middleware & Services](#6-backend-middleware--services)
7. [Frontend Architecture](#7-frontend-architecture)
8. [State Management](#8-state-management)
9. [PWA & Service Worker](#9-pwa--service-worker)
10. [Caching Strategy](#10-caching-strategy)
11. [Security Model](#11-security-model)
12. [Infrastructure & Deployment](#12-infrastructure--deployment)
13. [Design Patterns](#13-design-patterns)
14. [Environment Configuration](#14-environment-configuration)

---

## 1. Project Overview

**Walletly** is a collaborative budget tracking application designed for shared wallets. Users can create wallets, invite members, track expenses and income, set budgets per category, and view spending reports — all from a mobile-first PWA that works offline.

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite | React 18, Vite 5 |
| Backend | Express.js (Node.js) | Express 4, Node 20 |
| Database | PostgreSQL | 16 (Alpine) |
| Cache / Rate Limit | Redis | 7 (Alpine) |
| Reverse Proxy | Nginx | 1.25 (Alpine) |
| Tunnel (optional) | Cloudflare Tunnel | Latest |
| Orchestration | Docker Compose | v2 |

### Key Features

- Multi-wallet support with shared access (invite by username)
- Combined "All Wallets" view with per-wallet exclude toggles
- Configurable billing periods (custom month start day & day start hour)
- Budget tracking per category per period
- Offline-capable PWA with service worker caching
- IDR currency formatting (integer amounts, no decimals)
- Custom category icons (emoji) and colors

---

## 2. Architecture & System Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser / PWA                       │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  React SPA (Vite build)                             │ │
│  │  ├── AuthContext (JWT token management)              │ │
│  │  ├── WalletContext (wallet + transaction state)      │ │
│  │  ├── NavigationContext (page routing)                │ │
│  │  └── Service Worker (offline caching)               │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / HTTP
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Nginx (Reverse Proxy + Static Server)                   │
│  ├── /api/* → proxy_pass → backend:4000                  │
│  ├── static assets → cache 1 year                        │
│  └── /* → SPA fallback (index.html)                      │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Express.js Backend (port 4000)                          │
│  ├── Helmet (security headers)                           │
│  ├── CORS (origin whitelist)                             │
│  ├── Compression (gzip)                                  │
│  ├── Morgan (HTTP logging)                               │
│  ├── Rate Limiter (Redis-backed)                         │
│  ├── JWT Authentication                                  │
│  ├── Zod Validation                                      │
│  └── Route Handlers                                      │
│       ├── /api/auth/*                                    │
│       ├── /api/wallets/*                                 │
│       ├── /api/wallets/:id/transactions/*                │
│       ├── /api/wallets/:id/categories/*                  │
│       ├── /api/wallets/:id/budgets/*                     │
│       └── /api/wallets/:id/stats                         │
└───────────┬──────────────────────┬───────────────────────┘
            │                      │
            ▼                      ▼
┌────────────────────┐  ┌──────────────────────┐
│  PostgreSQL 16     │  │  Redis 7             │
│  ├── users         │  │  ├── Cache (TTL)     │
│  ├── wallets       │  │  ├── Rate limits     │
│  ├── wallet_members│  │  └── Sessions        │
│  ├── categories    │  └──────────────────────┘
│  ├── transactions  │
│  └── budgets       │
└────────────────────┘
```

### Request Flow

1. **Browser** sends request to **Nginx** on port 8082
2. **Nginx** routes `/api/*` to the Express backend; all other paths serve the static SPA build with fallback to `index.html`
3. **Express** middleware pipeline: Helmet → CORS → Compression → Morgan → Rate Limiter → JWT Auth → Zod Validation → Route Handler
4. Route handlers query **PostgreSQL** (via parameterized queries) and use **Redis** as a cache-aside layer
5. Responses flow back through Nginx to the browser

### Service Startup Order

```
postgres + redis (health checks: pg_isready / redis-cli ping)
    └── backend (health check: wget /health)
            └── frontend (builds, then exits) + nginx
                    └── cloudflared (optional tunnel)
```

---

## 3. Directory Structure

```
Walletly/
├── docker-compose.yml              # Full stack orchestration
├── .env                            # Secrets (git-ignored)
├── .env.example                    # Environment template
├── CLAUDE.md                       # AI assistant instructions
├── README.md                       # Project README
│
├── backend/
│   ├── Dockerfile                  # Multi-stage Node.js 20 build
│   ├── package.json
│   └── src/
│       ├── index.js                # Express app: middleware + route mounting
│       ├── startup.js              # Env validation + graceful shutdown
│       ├── schemas.js              # Zod validation schemas (all endpoints)
│       ├── db/
│       │   ├── postgres.js         # Pool + query() + withTransaction()
│       │   └── redis.js            # Client + cached() + invalidate()
│       ├── middleware/
│       │   ├── auth.js             # authenticate() + requireWalletMember()
│       │   ├── rateLimit.js        # authLimiter (10/15m) + apiLimiter (200/15m)
│       │   └── validate.js         # validate(schema) + validateQuery(schema)
│       └── routes/
│           ├── auth.js             # POST /register, /login
│           ├── wallets.js          # Wallet CRUD + settings + members
│           ├── transactions.js     # Transaction CRUD + filtering
│           └── budgets.js          # Categories + budgets + stats
│
├── frontend/
│   ├── Dockerfile                  # Multi-stage Vite build
│   ├── vite.config.js              # Build config + dev proxy
│   ├── package.json
│   ├── public/
│   │   ├── manifest.json           # PWA manifest
│   │   ├── sw.js                   # Service worker
│   │   ├── offline.html            # Offline fallback page
│   │   └── icons/                  # PWA icons (SVG)
│   └── src/
│       ├── main.jsx                # React root + SW registration
│       ├── App.jsx                 # Root component + page router
│       ├── api.js                  # Centralized fetch client (JWT handling)
│       ├── context/
│       │   ├── AuthContext.jsx     # Auth state (login/register/signOut)
│       │   ├── WalletContext.jsx   # Wallet data + transactions + API helpers
│       │   └── NavigationContext.jsx # Page routing state
│       ├── hooks/
│       │   ├── useToast.jsx        # Toast notification system
│       │   └── useInstallPrompt.js # PWA install prompt
│       ├── pages/
│       │   ├── AuthScreen.jsx      # Login / register form
│       │   ├── Dashboard.jsx       # Home: balance, charts, wallet switcher
│       │   ├── Transactions.jsx    # Transaction list + filter + edit
│       │   ├── BudgetPage.jsx      # Budget overview + category list
│       │   ├── BudgetDetail.jsx    # Single budget detail
│       │   ├── MonthlyRecap.jsx    # Monthly reports
│       │   └── SettingsPage.jsx    # Wallet/member/category management
│       ├── components/
│       │   ├── BottomNav.jsx       # 5-tab navigation bar
│       │   ├── FAB.jsx             # Floating action button
│       │   ├── AddTxnSheet.jsx     # Add transaction modal
│       │   ├── SpendChart.jsx      # Spending chart by category
│       │   ├── LoadingScreen.jsx   # Loading + error states
│       │   ├── Toast.jsx           # Toast notification display
│       │   ├── ConfirmDialog.jsx   # Confirmation modal
│       │   └── ErrorBoundary.jsx   # React error boundary
│       ├── constants/
│       │   └── index.js            # Defaults, palettes, nav items
│       ├── utils/
│       │   ├── period.js           # Billing period calculations
│       │   └── format.js           # Currency + date formatting
│       └── styles/
│           └── tokens.js           # Design tokens (colors, spacing)
│
├── nginx/
│   ├── nginx.conf                  # Global settings + security headers
│   ├── conf.d/
│   │   ├── walletly.conf           # Virtual hosts (HTTP + optional HTTPS)
│   │   └── walletly_locations.conf.inc  # Shared location rules
│   └── certs/                      # Optional SSL certificates
│
└── postgres/
    ├── init.sql                    # Full database schema
    └── migrations/
        └── 001_add_exclude_combined.sql
```

---

## 4. Database Schema

### Entity Relationship Diagram

```
┌──────────┐       ┌────────────────┐       ┌──────────┐
│  users   │───────│ wallet_members │───────│ wallets  │
│          │  1:N  │                │  N:1  │          │
│ id (PK)  │       │ wallet_id (PK) │       │ id (PK)  │
│ username │       │ user_id   (PK) │       │ name     │
│ display_ │       │ exclude_       │       │ owner_id │
│   name   │       │   combined     │       │ month_   │
│ password │       │ joined_at      │       │ start_day│
│   _hash  │       └────────────────┘       │ day_     │
└──────────┘                                │ start_hr │
     │                                      └──────────┘
     │ 1:N                                       │ 1:N
     ▼                                           ▼
┌──────────────┐                         ┌────────────┐
│ transactions │                         │ categories │
│              │                         │            │
│ id (PK)      │    N:1                  │ id (PK)    │
│ wallet_id    │◄────────────────────────│ wallet_id  │
│ user_id      │                         │ type       │
│ category_id  │────────────────────────►│ label      │
│ type         │    N:1 (nullable)       │ icon       │
│ amount       │                         │ color      │
│ note         │                         │ sort_order │
│ txn_date     │                         └────────────┘
└──────────────┘                               │ 1:N
                                               ▼
                                        ┌────────────┐
                                        │  budgets   │
                                        │            │
                                        │ id (PK)    │
                                        │ wallet_id  │
                                        │ category_id│
                                        │ amount     │
                                        │ period     │
                                        │ UNIQUE(w,  │
                                        │   c, p)    │
                                        └────────────┘
```

### Table Definitions

#### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| username | TEXT | UNIQUE, NOT NULL, 3–32 chars |
| display_name | TEXT | NOT NULL |
| password_hash | TEXT | NOT NULL (bcrypt) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

#### `wallets`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| name | TEXT | NOT NULL |
| owner_id | UUID | FK → users(id) ON DELETE CASCADE |
| month_start_day | SMALLINT | DEFAULT 1, CHECK 1–28 |
| day_start_hour | SMALLINT | DEFAULT 0, CHECK 0–23 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

#### `wallet_members` (junction table)
| Column | Type | Constraints |
|--------|------|-------------|
| wallet_id | UUID | PK, FK → wallets(id) ON DELETE CASCADE |
| user_id | UUID | PK, FK → users(id) ON DELETE CASCADE |
| exclude_combined | BOOLEAN | NOT NULL, DEFAULT false |
| joined_at | TIMESTAMPTZ | DEFAULT NOW() |

#### `categories`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| wallet_id | UUID | FK → wallets(id) ON DELETE CASCADE |
| type | category_type | ENUM('expense', 'income') |
| label | TEXT | NOT NULL |
| icon | TEXT | DEFAULT '📦' |
| color | TEXT | DEFAULT '#6b7280' |
| sort_order | SMALLINT | DEFAULT 0 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

#### `transactions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| wallet_id | UUID | FK → wallets(id) ON DELETE CASCADE |
| user_id | UUID | FK → users(id) |
| category_id | UUID | FK → categories(id) ON DELETE SET NULL, NULLABLE |
| type | transaction_type | ENUM('expense', 'income') |
| amount | BIGINT | NOT NULL, CHECK > 0 |
| note | TEXT | NULLABLE |
| txn_date | DATE | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

#### `budgets`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| wallet_id | UUID | FK → wallets(id) ON DELETE CASCADE |
| category_id | UUID | FK → categories(id) ON DELETE CASCADE |
| amount | BIGINT | NOT NULL |
| period | CHAR(7) | NOT NULL (YYYY-MM format) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| | | UNIQUE(wallet_id, category_id, period) |

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| idx_txn_wallet_date | (wallet_id, txn_date DESC) | Fast transaction listing by date |
| idx_txn_wallet_type | (wallet_id, type) | Filter transactions by type |
| idx_txn_category | (category_id) | Join transactions → categories |
| idx_cat_wallet | (wallet_id, type) | List categories per wallet |
| idx_budget_wallet_period | (wallet_id, period) | Budget lookup per period |
| idx_wm_user | (user_id) | List wallets for a user |

### Triggers

All mutable tables have a `set_updated_at()` trigger that auto-updates the `updated_at` column on every `INSERT` or `UPDATE`.

### Custom Types (ENUMs)

- `category_type`: `'expense'` | `'income'`
- `transaction_type`: `'expense'` | `'income'`

---

## 5. Backend API

### Authentication

| Method | Endpoint | Rate Limit | Body | Response |
|--------|----------|------------|------|----------|
| POST | `/api/auth/register` | 10/15min | `{username, password, displayName}` | `{token, user}` |
| POST | `/api/auth/login` | 10/15min | `{username, password}` | `{token, user}` |

On registration, the server automatically creates a default wallet and populates it with 8 expense categories and 5 income categories.

### Wallets

| Method | Endpoint | Auth | Body/Query | Response |
|--------|----------|------|------------|----------|
| GET | `/api/wallets` | JWT | — | Array of wallets with `period_balance`, `members[]`, `exclude_combined` |
| POST | `/api/wallets` | JWT | `{name}` | Created wallet |
| PATCH | `/api/wallets/:id` | JWT + Owner | `{name}` | Updated wallet |
| DELETE | `/api/wallets/:id` | JWT + Owner | — | `{ok: true}` |
| PATCH | `/api/wallets/:id/settings` | JWT + Member | `{monthStartDay?, dayStartHour?}` | Updated wallet |
| PATCH | `/api/wallets/:id/exclude-combined` | JWT + Member | `{exclude: bool}` | `{exclude_combined}` |
| POST | `/api/wallets/:id/members` | JWT + Owner | `{username}` | `{ok: true}` |
| DELETE | `/api/wallets/:id/members/:userId` | JWT + Owner/Self | — | `{ok: true}` |

### Transactions

| Method | Endpoint | Auth | Body/Query | Response |
|--------|----------|------|------------|----------|
| GET | `/api/wallets/:id/transactions` | JWT + Member | `?from=&to=&type=&limit=500&offset=0` | `{data, pagination}` |
| POST | `/api/wallets/:id/transactions` | JWT + Member | `{type, amount, categoryId?, note?, txnDate}` | Created transaction |
| PATCH | `/api/wallets/:id/transactions/:txnId` | JWT + Member | `{amount?, categoryId?, note?, txnDate?}` | Updated transaction |
| DELETE | `/api/wallets/:id/transactions/:txnId` | JWT + Member | — | 204 No Content |

### Categories

| Method | Endpoint | Auth | Body | Response |
|--------|----------|------|------|----------|
| GET | `/api/wallets/:id/categories` | JWT + Member | — | Array of categories |
| POST | `/api/wallets/:id/categories` | JWT + Member | `{type, label, icon?, color?, sortOrder?}` | Created category |
| PATCH | `/api/wallets/:id/categories/:catId` | JWT + Member | `{label?, icon?, color?}` | Updated category |
| DELETE | `/api/wallets/:id/categories/:catId` | JWT + Member | — | `{ok: true}` |

### Budgets

| Method | Endpoint | Auth | Body/Query | Response |
|--------|----------|------|------------|----------|
| GET | `/api/wallets/:id/budgets` | JWT + Member | `?period=YYYY-MM` | Array of budgets (joined with category) |
| PUT | `/api/wallets/:id/budgets` | JWT + Member | `{categoryId, amount, period}` | Upserted budget |
| DELETE | `/api/wallets/:id/budgets/:budgetId` | JWT + Member | — | `{ok: true}` |

### Stats

| Method | Endpoint | Auth | Query | Response |
|--------|----------|------|-------|----------|
| GET | `/api/wallets/:id/stats` | JWT + Member | `?from=YYYY-MM-DD&to=YYYY-MM-DD` | Array of `{type, category_id, category_label, total, count}` |

### Health Check

| Method | Endpoint | Auth | Response |
|--------|----------|------|----------|
| GET | `/health` | None | `{status: "ok"}` (pings DB + Redis) |

---

## 6. Backend Middleware & Services

### Middleware Pipeline

```
Request
  │
  ├─ helmet()                    # Security headers (CSP, HSTS, etc.)
  ├─ cors({ origins })           # CORS with origin whitelist
  ├─ compression()               # Gzip response compression
  ├─ morgan("combined")          # HTTP request logging
  ├─ express.json({ limit })     # Body parsing
  ├─ express-session(redis)      # Session store (Redis-backed)
  │
  ├─ /api/auth/* ──► authLimiter (10 req / 15 min / IP)
  ├─ /api/*      ──► apiLimiter  (200 req / 15 min / IP)
  │
  ├─ authenticate()              # JWT verification → req.user
  ├─ requireWalletMember()       # Wallet membership check → req.walletId
  ├─ validate(schema)            # Zod body validation
  ├─ validateQuery(schema)       # Zod query validation
  │
  └─ Route Handler
```

### `authenticate(req, res, next)`
Extracts the `Bearer` token from the `Authorization` header, verifies it with `jsonwebtoken`, and attaches `req.user = { id, username }`.

### `requireWalletMember(req, res, next)`
Queries `wallet_members` to verify the authenticated user is a member of the wallet specified in `req.params.walletId`. Sets `req.walletId` on success.

### `validate(zodSchema)` / `validateQuery(zodSchema)`
Parses `req.body` or `req.query` through a Zod schema. Returns 400 with validation errors on failure; replaces `req.body`/`req.query` with the parsed (coerced, trimmed) result on success.

### PostgreSQL Service (`db/postgres.js`)
- **Connection Pool**: Max 20 connections, 30s idle timeout, 5s connection timeout
- **`query(text, params)`**: Parameterized query execution
- **`withTransaction(fn)`**: Wraps `fn` in `BEGIN`/`COMMIT` with `ROLLBACK` on error

### Redis Service (`db/redis.js`)
- **Client**: ioredis with exponential retry and ready-check
- **`cached(key, ttl, loader)`**: Cache-aside — returns cached value if present, otherwise calls `loader()`, caches the result, and returns it. Falls back to `loader()` if Redis is unavailable.
- **`invalidate(pattern)`**: Deletes all keys matching a pattern using `SCAN` (non-blocking). Supports wildcards (e.g., `wallet:abc:budgets:*`).

---

## 7. Frontend Architecture

### Component Hierarchy

```
<ErrorBoundary>
  <ToastProvider>
    <AuthProvider>
      <NavigationProvider>
        <WalletProvider>
          <App>
            ├── <AuthScreen />          (if not logged in)
            └── <WalletShell>           (if logged in)
                ├── <Page />            (routed by NavigationContext)
                │   ├── Dashboard
                │   ├── Transactions
                │   ├── BudgetPage / BudgetDetail
                │   ├── MonthlyRecap
                │   └── SettingsPage
                ├── <BottomNav />
                ├── <FAB />
                ├── <AddTxnSheet />     (modal)
                ├── <ConfirmDialog />   (modal)
                └── <Toast />
          </App>
        </WalletProvider>
      </NavigationProvider>
    </AuthProvider>
  </ToastProvider>
</ErrorBoundary>
```

### Page Routing

Navigation is handled via React context (no React Router). The `NavigationContext` holds a `page` string, and `App.jsx` maps it to the corresponding component:

```js
const PAGES = {
  dashboard:    Dashboard,
  transactions: Transactions,
  budget:       BudgetPage,
  recap:        MonthlyRecap,
  settings:     SettingsPage,
};
```

The `BottomNav` component renders 5 tabs that call `setPage()` on tap.

### API Client (`api.js`)

A centralized fetch wrapper that:
1. Prepends the base URL (`VITE_API_URL` or `/api`)
2. Attaches the JWT from `localStorage` as a `Bearer` token
3. Handles 204 (returns `null`), 401 (clears token + reloads), and non-2xx (throws `Error` with server message)
4. Exports an `api` object with typed methods for every endpoint

### Utilities

| Module | Functions | Purpose |
|--------|-----------|---------|
| `utils/period.js` | `todayStr()`, `getPeriodKey()`, `getCurrentPeriodKey()`, `periodLabel()`, `getPeriodDates()`, `shiftPeriodKey()`, `getPeriodSpend()` | Billing period calculations based on configurable month start day |
| `utils/format.js` | `fmt()`, `fmtShort()`, `fmtDate()` | IDR currency formatting (Intl.NumberFormat) and date display |
| `styles/tokens.js` | Design tokens | Colors (`#0a0f1e` bg, `#22d3ee` accent), spacing, safe-area insets |

---

## 8. State Management

### Pattern: React Context + Lifting State

Walletly uses the **Provider Pattern** with three React Contexts that form a hierarchy:

```
AuthContext (auth state)
  └── WalletContext (wallet + transaction + category + budget state)
        └── NavigationContext (UI page state)
```

### AuthContext

| State | Type | Purpose |
|-------|------|---------|
| `authUser` | `{id, username, displayName} \| null` | Current user |

| Method | Description |
|--------|-------------|
| `login(username, password)` | Authenticates, stores JWT + user in localStorage |
| `register(username, password, displayName)` | Creates account, auto-logs in |
| `signOut()` | Clears token + user from localStorage |

**Persistence**: `walletly_token` and `walletly_user` in localStorage. On mount, reads stored values to restore session without re-authentication.

### WalletContext

The largest and most complex context. Manages all wallet-scoped data.

| State | Type | Source |
|-------|------|--------|
| `wallets` | `Wallet[]` | `GET /api/wallets` |
| `activeWalletId` | `string \| null` | localStorage `walletly_active_wallet` |
| `transactions` | `Transaction[]` | `GET /api/wallets/:id/transactions` (3-month window) |
| `categories` | `Category[]` | `GET /api/wallets/:id/categories` |
| `budgets` | `Budget[]` | `GET /api/wallets/:id/budgets` |
| `loading` | `boolean` | Loading state |
| `loadError` | `string \| null` | Error message |

**Derived state** (computed on every render):
- `wallet` — enriched active wallet object with formatted transactions, category maps, budget maps, member info, and settings
- `user` — `{ name, wallets: [...ids] }`
- `session` — `{ id, username, walletId }`

**Data flow**:
1. `authUser` changes → fetch wallets
2. `activeWalletId` changes → fetch transactions + categories + budgets in parallel
3. API helpers (add/edit/delete) → call backend → refresh relevant state slice

### NavigationContext

Simple page state: `{ page, setPage }`. No URL routing — the entire app runs as a single-page shell with programmatic page switching.

---

## 9. PWA & Service Worker

### Web App Manifest (`manifest.json`)

```json
{
  "name": "Walletly",
  "short_name": "Walletly",
  "display": "standalone",
  "background_color": "#0a0f1e",
  "theme_color": "#22d3ee",
  "orientation": "portrait",
  "categories": ["finance"]
}
```

Icons are SVG (192px, 512px, maskable 512px) for crisp rendering at all densities.

### Service Worker Strategy (`sw.js`)

| Request Type | Strategy | Fallback |
|-------------|----------|----------|
| `/api/*` | **Network-first** | Returns 503 JSON error if offline |
| Static assets (JS, CSS, fonts, images) | **Cache-first** | Fetch + update cache in background |
| HTML navigation | **Network-first** | `/offline.html` if offline |

**Cache versioning**: Cache name includes a version string. On activate, old caches are purged.

### Install Prompt

The `useInstallPrompt` hook captures the `beforeinstallprompt` event and provides a `promptInstall()` function for a custom install button in the UI.

---

## 10. Caching Strategy

### Redis Cache-Aside Pattern

```
Client Request
    │
    ▼
┌──────────────┐     HIT      ┌───────┐
│ Check Redis  │──────────────►│ Return│
│ cached(key)  │               │ cached│
└──────┬───────┘               └───────┘
       │ MISS
       ▼
┌──────────────┐
│ Query        │
│ PostgreSQL   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Store in     │
│ Redis (TTL)  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Return data  │
└──────────────┘
```

### Cache Keys & TTLs

| Resource | Key Pattern | TTL | Invalidated On |
|----------|------------|-----|----------------|
| Categories | `wallet:{id}:categories` | 300s | Category create/update/delete |
| Budgets | `wallet:{id}:budgets:{period}` | 120s | Budget upsert/delete, category delete |
| Stats | `wallet:{id}:stats:{from}:{to}` | 60s | (TTL-based expiry only) |

### Invalidation

Write operations invalidate relevant cache keys using `SCAN`-based pattern deletion. Wildcard patterns (e.g., `wallet:abc:budgets:*`) clear all budget periods for a wallet at once.

### Fallback Behavior

If Redis is unavailable, `cached()` falls back to calling the loader function directly (queries PostgreSQL), ensuring the app remains functional without caching.

---

## 11. Security Model

### Authentication & Authorization

| Layer | Mechanism |
|-------|-----------|
| Password storage | bcrypt (12 salt rounds) |
| Session tokens | JWT (HS256, 7-day expiry by default) |
| Token transport | `Authorization: Bearer <token>` header |
| Wallet access | `requireWalletMember()` middleware — every wallet-scoped route verifies membership |
| Owner-only actions | Additional ownership checks for rename, delete, invite, remove-member |

### HTTP Security Headers (via Helmet)

- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` — restricts script/style/font origins

### Rate Limiting

| Scope | Limit | Window | Store |
|-------|-------|--------|-------|
| Auth routes (`/api/auth/*`) | 10 requests | 15 minutes | Redis (separate instance) |
| API routes (`/api/*`) | 200 requests | 15 minutes | Redis (separate instance) |

Auth and API rate limiters use **separate Redis store instances** to prevent counter interference.

### Input Validation

All request bodies and query parameters are validated through **Zod schemas** before reaching route handlers. This prevents:
- SQL injection (combined with parameterized queries)
- Type coercion attacks
- Oversized inputs

### CORS

Origin whitelist configured via `ALLOWED_ORIGINS` environment variable. Only listed origins can make cross-origin requests.

### Container Security

The backend Docker image runs as a non-root `walletly` user.

---

## 12. Infrastructure & Deployment

### Docker Compose Services

| Service | Base Image | Ports | Volumes | Health Check |
|---------|-----------|-------|---------|-------------|
| postgres | postgres:16-alpine | 5432 (dev) | `postgres_data`, `init.sql` | `pg_isready` |
| redis | redis:7-alpine | 6379 (dev) | `redis_data` | `redis-cli ping` |
| backend | node:20-alpine | 4000 (internal) | — | `wget /health` |
| frontend | node:20-alpine → alpine | — | `frontend_dist` (output) | exit 0 |
| nginx | nginx:1.25-alpine | 8082→80 | configs + `frontend_dist` | `wget /health` |
| cloudflared | cloudflare/cloudflared | — | — | — |

### Build Process

**Backend** (multi-stage):
1. Install dependencies (`npm ci --omit=dev`)
2. Copy source
3. Switch to non-root user
4. Start with `node src/index.js`

**Frontend** (multi-stage):
1. `npm ci` + `npm run build` (Vite production build)
2. Copy `dist/` to a minimal Alpine image
3. Container exits after copying to shared volume

**Nginx** serves the frontend dist volume and proxies `/api/*` to the backend.

### Nginx Configuration

- **Upstream**: `backend:4000` with keepalive 32 connections
- **Static assets**: Cached for 1 year (`Cache-Control: public, max-age=31536000, immutable`)
- **SPA fallback**: `try_files $uri /index.html` for client-side routing
- **API proxy**: `proxy_pass http://backend/api/` with forwarded headers
- **Gzip**: Enabled for text, CSS, JS, JSON, SVG (level 5, min 1KB)
- **ETag**: Disabled to prevent stale cached responses

### Optional HTTPS

Place `fullchain.pem` and `privkey.pem` in `nginx/certs/` and uncomment the HTTPS server block in `walletly.conf`.

### Optional Public Access

Configure `CLOUDFLARE_TUNNEL_TOKEN` for public access via Cloudflare Tunnel without exposing ports.

---

## 13. Design Patterns

### Backend Patterns

| Pattern | Where | Description |
|---------|-------|-------------|
| **Repository / Data Access Layer** | `db/postgres.js` | Centralized `query()` and `withTransaction()` functions abstract away the pg pool |
| **Cache-Aside** | `db/redis.js` | `cached(key, ttl, loader)` — check cache first, fallback to DB, store result |
| **Middleware Chain** | `middleware/*.js` | Express middleware for cross-cutting concerns (auth, validation, rate limiting) |
| **Schema Validation** | `schemas.js` | Zod schemas colocated in one file, used via `validate()` middleware |
| **Resource-Scoped Routes** | `routes/*.js` | All routes nested under `/wallets/:walletId` — wallet membership enforced at middleware level |
| **Upsert** | `budgets.js` PUT | `INSERT ... ON CONFLICT DO UPDATE` for idempotent budget creation |
| **Graceful Shutdown** | `startup.js` | Listens for SIGTERM/SIGINT, drains connections, closes pools |
| **Default Data Seeding** | `auth.js` register | On user creation, auto-creates wallet + default categories in a transaction |

### Frontend Patterns

| Pattern | Where | Description |
|---------|-------|-------------|
| **Provider Pattern** | `context/*.jsx` | Three nested React Contexts provide global state without prop drilling |
| **Derived State** | `WalletContext.jsx` | The `wallet` object is computed from raw state on every render — no redundant state |
| **Optimistic Updates** | `WalletContext.jsx` | `deleteTransaction` removes from local state immediately, then confirms with server |
| **API Client Singleton** | `api.js` | Single `request()` function handles auth, errors, and token refresh for all endpoints |
| **Container/Presentational** | Pages vs Components | Pages contain logic and state; components are reusable UI elements |
| **Custom Hooks** | `hooks/*.js` | `useToast()` and `useInstallPrompt()` encapsulate side effects |
| **Error Boundary** | `ErrorBoundary.jsx` | Catches render errors and displays fallback UI |
| **Cache-First Service Worker** | `sw.js` | Static assets served from cache; API calls go network-first |
| **Lazy Data Fetching** | `WalletContext.jsx` | Data is fetched only when `activeWalletId` changes — no unnecessary network calls |
| **Combined View Aggregation** | `Dashboard.jsx` | Fetches and merges data from multiple wallets in parallel, with category deduplication by `label+type` |

### Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Integer amounts (BIGINT)** | IDR has no decimal places; avoids floating-point precision issues |
| **UUID primary keys** | Globally unique, no sequential ID leakage, safe for distributed systems |
| **JWT (stateless auth)** | No server-side session lookup required; works across multiple backend instances |
| **Redis for rate limiting** | Distributed rate limiting that works across backend instances |
| **Separate rate limiter stores** | Auth and API limiters use independent Redis stores to prevent counter conflicts |
| **Wallet-scoped routes** | All data access goes through `/wallets/:walletId`, enforcing authorization at the routing level |
| **No client-side router** | Simple context-based page state; the app is a single SPA shell with no URLs to manage |
| **Cache-aside over write-through** | Simpler implementation; writes invalidate cache, next read repopulates — acceptable for this workload |
| **Per-user exclude_combined** | Stored in `wallet_members` (not localStorage) so the preference syncs across devices and survives logout |
| **Custom billing periods** | `month_start_day` + `day_start_hour` enable pay-cycle-aligned budgeting |

---

## 14. Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Runtime mode | `production` |
| `POSTGRES_DB` | Database name | `walletly` |
| `POSTGRES_USER` | Database user | `walletly` |
| `POSTGRES_PASSWORD` | Database password | (secret) |
| `REDIS_PASSWORD` | Redis password | (secret) |
| `JWT_SECRET` | JWT signing secret | (random 64-char string) |
| `JWT_EXPIRES_IN` | Token expiry duration | `7d` |
| `SESSION_SECRET` | Express session secret | (random 64-char string) |
| `ALLOWED_ORIGINS` | CORS allowed origins | `https://walletly.example.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Frontend API base URL | `/api` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare tunnel token | (disabled) |

### Development Ports

| Service | Port |
|---------|------|
| Nginx (host) | 8082 |
| Backend (internal) | 4000 |
| Frontend dev server | 5173 |
| PostgreSQL (dev) | 5432 |
| Redis (dev) | 6379 |
