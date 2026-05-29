-- Migration 009: Add source column to food_logs
-- Tracks where a food log entry came from (manual, historical_import, etc.)
ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS source text;
