-- KeepGoing Personal Coach Dashboard
-- Migration 001: Initial Schema
-- Apply this in the Supabase SQL Editor

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DAILY CHECK-INS
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_checkins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  energy smallint CHECK (energy BETWEEN 1 AND 10),
  mood smallint CHECK (mood BETWEEN 1 AND 10),
  stress smallint CHECK (stress BETWEEN 1 AND 10),
  soreness smallint CHECK (soreness BETWEEN 1 AND 10),
  motivation smallint CHECK (motivation BETWEEN 1 AND 10),
  digestion smallint CHECK (digestion BETWEEN 1 AND 10),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- ============================================================
-- WEIGHT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS weight_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  weight_kg numeric(5,2) NOT NULL,
  waist_cm numeric(5,1),
  body_fat_percent numeric(4,1),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- FOOD LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS food_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack','other')),
  description text NOT NULL,
  estimated_calories integer,
  protein_g numeric(6,1),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  confidence text CHECK (confidence IN ('low','medium','high')),
  digestion_note text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ACTIVITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  activity_type text NOT NULL,
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  duration_minutes numeric(8,2),
  distance_km numeric(8,3),
  elevation_gain_m integer,
  avg_hr integer,
  max_hr integer,
  avg_power integer,
  calories integer,
  perceived_effort smallint CHECK (perceived_effort BETWEEN 1 AND 10),
  difficulty_note text,
  weather_temp_c numeric(4,1),
  weather_wind_kph numeric(5,1),
  source_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- HEALTH METRICS
-- ============================================================
CREATE TABLE IF NOT EXISTS health_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  sleep_minutes integer,
  deep_sleep_minutes integer,
  rem_sleep_minutes integer,
  resting_hr integer,
  hrv_ms numeric(6,2),
  vo2max numeric(4,1),
  steps integer,
  active_energy_kcal integer,
  respiratory_rate numeric(4,1),
  source text NOT NULL DEFAULT 'manual',
  source_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, source)
);

-- ============================================================
-- GOLF ROUNDS
-- ============================================================
CREATE TABLE IF NOT EXISTS golf_rounds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  course_name text NOT NULL,
  holes smallint NOT NULL DEFAULT 18,
  score integer,
  stableford_points integer,
  walking boolean NOT NULL DEFAULT true,
  duration_minutes numeric(8,2),
  perceived_focus smallint CHECK (perceived_focus BETWEEN 1 AND 10),
  perceived_fatigue smallint CHECK (perceived_fatigue BETWEEN 1 AND 10),
  notes text,
  linked_activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- AI INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  related_date date,
  related_activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- WEEKLY REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  summary text,
  training_summary text,
  nutrition_summary text,
  recovery_summary text,
  recommendations text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- ============================================================
-- DATA SOURCES
-- ============================================================
CREATE TABLE IF NOT EXISTS data_sources (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','error')),
  last_sync_at timestamptz,
  config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, source)
);
