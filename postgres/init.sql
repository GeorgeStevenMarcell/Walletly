-- ─────────────────────────────────────────────────────────────────────────────
--  Walletly — PostgreSQL Schema
--  Executed once automatically on first container start.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum types ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE category_type    AS ENUM ('expense','income');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('expense','income');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      TEXT        UNIQUE NOT NULL CHECK (length(username) BETWEEN 3 AND 32),
    display_name  TEXT        NOT NULL,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Wallets ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             TEXT        NOT NULL,
    owner_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_start_day  SMALLINT    NOT NULL DEFAULT 1
                                 CHECK (month_start_day BETWEEN 1 AND 28),
    day_start_hour   SMALLINT    NOT NULL DEFAULT 0
                                 CHECK (day_start_hour  BETWEEN 0 AND 23),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Wallet members ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_members (
    wallet_id  UUID        NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    joined_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (wallet_id, user_id)
);

-- ── Categories ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id   UUID          NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type        category_type NOT NULL,
    label       TEXT          NOT NULL,
    icon        TEXT          NOT NULL DEFAULT '📦',
    color       TEXT          NOT NULL DEFAULT '#6b7280',
    sort_order  SMALLINT      NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Budgets ───────────────────────────────────────────────────────────────────
-- One row per (wallet, category, billing period).
-- `period` = 'YYYY-MM' matching the cycle-start month.
CREATE TABLE IF NOT EXISTS budgets (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id    UUID        NOT NULL REFERENCES wallets(id)    ON DELETE CASCADE,
    category_id  UUID        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount       BIGINT      NOT NULL CHECK (amount >= 0),   -- IDR, integer
    period       CHAR(7)     NOT NULL,                        -- e.g. '2026-03'
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (wallet_id, category_id, period)
);

-- ── Transactions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id           UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id    UUID             NOT NULL REFERENCES wallets(id)    ON DELETE CASCADE,
    user_id      UUID             NOT NULL REFERENCES users(id),
    category_id  UUID             REFERENCES categories(id)          ON DELETE SET NULL,
    type         transaction_type NOT NULL,
    amount       BIGINT           NOT NULL CHECK (amount > 0),       -- IDR, always positive
    note         TEXT,
    txn_date     DATE             NOT NULL,
    created_at   TIMESTAMPTZ      DEFAULT NOW(),
    updated_at   TIMESTAMPTZ      DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_txn_wallet_date     ON transactions  (wallet_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_txn_wallet_type     ON transactions  (wallet_id, type);
CREATE INDEX IF NOT EXISTS idx_txn_category        ON transactions  (category_id);
CREATE INDEX IF NOT EXISTS idx_cat_wallet          ON categories    (wallet_id, type);
CREATE INDEX IF NOT EXISTS idx_budget_wallet_period ON budgets      (wallet_id, period);
CREATE INDEX IF NOT EXISTS idx_wm_user             ON wallet_members(user_id);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','wallets','budgets','transactions'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
       CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t,t,t,t
    );
  END LOOP;
END $$;
