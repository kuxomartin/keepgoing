-- KeepGoing Personal Coach Dashboard
-- Migration 004: UNIQUE constraint on weight_logs for idempotent upserts
-- Apply AFTER 001, 002, 003

ALTER TABLE weight_logs
  ADD CONSTRAINT weight_logs_user_date_unique UNIQUE (user_id, date);
