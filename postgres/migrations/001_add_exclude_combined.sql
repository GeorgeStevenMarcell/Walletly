-- Migration: add exclude_combined to wallet_members
ALTER TABLE wallet_members ADD COLUMN IF NOT EXISTS exclude_combined BOOLEAN NOT NULL DEFAULT false;
