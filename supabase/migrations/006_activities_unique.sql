-- KeepGoing — Migration 006: unique constraint on activities
-- Enables idempotent upsert by (user_id, external_id, source) for Strava imports.
-- NULLs in external_id are non-equal in Postgres, so manually-entered activities
-- (external_id IS NULL) are unaffected by this constraint.
-- Run AFTER 005_google_sheet_imports.sql

ALTER TABLE activities
  ADD CONSTRAINT activities_user_external_source_unique
    UNIQUE (user_id, external_id, source);
