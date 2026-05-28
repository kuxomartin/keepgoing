-- Migration 008: Add resting_energy_kcal to health_metrics
-- Apple Health exports both active and resting (BMR) calorie data.
-- This column stores the resting/basal metabolic energy expenditure per day.
ALTER TABLE health_metrics ADD COLUMN IF NOT EXISTS resting_energy_kcal integer;
