-- KeepGoing — Migration 005: google_sheet_imports table
-- Replaces single data_sources config with a per-user multi-import config list.
-- Also adds import_id to data_import_logs for traceability.
-- Run AFTER 004_weight_logs_unique.sql

-- ── google_sheet_imports ──────────────────────────────────────────────────────
CREATE TABLE google_sheet_imports (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  spreadsheet_id  text        NOT NULL,
  sheet_name      text        NOT NULL,
  data_type       text        NOT NULL CHECK (data_type IN ('health_metrics', 'weight_logs', 'strava_activities')),
  enabled         boolean     NOT NULL DEFAULT true,
  import_priority int         NOT NULL DEFAULT 100,
  last_sync_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_sheet_imports_unique
    UNIQUE (user_id, spreadsheet_id, sheet_name, data_type)
);

ALTER TABLE google_sheet_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gsi_self" ON google_sheet_imports
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_gsi_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gsi_updated_at
  BEFORE UPDATE ON google_sheet_imports
  FOR EACH ROW EXECUTE FUNCTION update_gsi_updated_at();

-- ── data_import_logs: add import_id ──────────────────────────────────────────
ALTER TABLE data_import_logs
  ADD COLUMN IF NOT EXISTS import_id uuid
    REFERENCES google_sheet_imports(id) ON DELETE SET NULL;
