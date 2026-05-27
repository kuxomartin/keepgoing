-- KeepGoing Personal Coach Dashboard
-- Migration 003: Data Import Logs
-- Apply AFTER 001 and 002

CREATE TABLE IF NOT EXISTS data_import_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','partial','error')),
  rows_read integer NOT NULL DEFAULT 0,
  rows_imported integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE data_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_logs_self" ON data_import_logs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
