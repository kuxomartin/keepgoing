-- Migration 007: Add eaten_at timestamp to food_logs
-- Lets users record the exact time a meal was eaten, not just the date.

ALTER TABLE food_logs
  ADD COLUMN IF NOT EXISTS eaten_at timestamptz;

-- Backfill existing rows using the date column + a sensible default hour per meal type
UPDATE food_logs
SET eaten_at = (date || ' ' ||
  CASE meal_type
    WHEN 'breakfast' THEN '08:00:00'
    WHEN 'lunch'     THEN '12:30:00'
    WHEN 'dinner'    THEN '19:00:00'
    WHEN 'snack'     THEN '16:00:00'
    ELSE                  '12:00:00'
  END
)::timestamptz
WHERE eaten_at IS NULL;
