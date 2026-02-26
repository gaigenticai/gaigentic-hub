-- ============================================
-- GaiGentic AI Hub — Migration v4
-- Adds: trial_expires_at column for time-based trial tracking
-- ============================================

-- Add trial expiry column to users table
ALTER TABLE users ADD COLUMN trial_expires_at TEXT;

-- Backfill existing users: set trial_expires_at = created_at + 14 days
UPDATE users SET trial_expires_at = datetime(created_at, '+14 days') WHERE trial_expires_at IS NULL;

-- Index for efficient trial expiry queries
CREATE INDEX IF NOT EXISTS idx_users_trial_expires ON users(trial_expires_at);
