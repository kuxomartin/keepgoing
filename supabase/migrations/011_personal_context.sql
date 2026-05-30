-- Personal context facts: long-term profile data from DNA, lab tests,
-- bike fitting, and self-reported observations.

CREATE TABLE personal_context_facts (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category      text        NOT NULL,
  key           text        NOT NULL,
  value         jsonb       NOT NULL,
  source        text        NOT NULL,
  source_detail text,
  confidence    text,
  notes         text,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category, key, source)
);

ALTER TABLE personal_context_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_context_self"
  ON personal_context_facts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE personal_context_facts IS
  'Long-term personal context facts. Not daily log data.';
