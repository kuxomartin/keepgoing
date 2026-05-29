-- Migration 010: coffee_logs
-- Separate table for coffee tracking — not mixed with food calories.

CREATE TABLE IF NOT EXISTS coffee_logs (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consumed_at  timestamptz  NOT NULL,
  date         date         NOT NULL,
  coffee_type  text         NOT NULL,
  cups         numeric(4,2) NOT NULL DEFAULT 1,
  caffeine_mg  int,
  notes        text,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE coffee_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coffee_logs_self"
  ON coffee_logs FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
