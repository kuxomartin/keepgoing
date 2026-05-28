// Mock data used as fallback when the database has no real rows yet.
// All IDs are URL-safe strings. user_id = 'demo' (never written to DB).

import { subDays, format } from 'date-fns'
import type {
  WeightLog,
  HealthMetrics,
  Activity,
  FoodLog,
  DailyCheckin,
} from '@/types/database'

const today = new Date()
const d = (daysAgo: number) => format(subDays(today, daysAgo), 'yyyy-MM-dd')
const dt = (daysAgo: number, hour = 8) =>
  subDays(today, daysAgo).toISOString().replace('T', `T${String(hour).padStart(2, '0')}:00:00`)

// ───────────────────────────────────────────────
// WEIGHT LOGS — 14 days
// ───────────────────────────────────────────────
export const mockWeightLogs: WeightLog[] = [
  { id: 'w-1',  user_id: 'demo', date: d(0),  weight_kg: 82.4, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(0) },
  { id: 'w-2',  user_id: 'demo', date: d(1),  weight_kg: 82.7, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(1) },
  { id: 'w-3',  user_id: 'demo', date: d(2),  weight_kg: 82.5, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(2) },
  { id: 'w-4',  user_id: 'demo', date: d(3),  weight_kg: 83.1, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(3) },
  { id: 'w-5',  user_id: 'demo', date: d(4),  weight_kg: 82.9, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(4) },
  { id: 'w-6',  user_id: 'demo', date: d(5),  weight_kg: 83.3, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(5) },
  { id: 'w-7',  user_id: 'demo', date: d(6),  weight_kg: 83.0, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(6) },
  { id: 'w-8',  user_id: 'demo', date: d(7),  weight_kg: 83.4, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(7) },
  { id: 'w-9',  user_id: 'demo', date: d(8),  weight_kg: 83.2, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(8) },
  { id: 'w-10', user_id: 'demo', date: d(9),  weight_kg: 83.6, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(9) },
  { id: 'w-11', user_id: 'demo', date: d(10), weight_kg: 83.5, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(10) },
  { id: 'w-12', user_id: 'demo', date: d(11), weight_kg: 83.8, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(11) },
  { id: 'w-13', user_id: 'demo', date: d(12), weight_kg: 83.7, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(12) },
  { id: 'w-14', user_id: 'demo', date: d(13), weight_kg: 84.0, waist_cm: null, body_fat_percent: null, notes: null, created_at: dt(13) },
]

// ───────────────────────────────────────────────
// HEALTH METRICS — 14 days
// ───────────────────────────────────────────────
export const mockHealthMetrics: HealthMetrics[] = [
  { id: 'm-1',  user_id: 'demo', date: d(0),  sleep_minutes: 430, deep_sleep_minutes: 80,  rem_sleep_minutes: 95,  resting_hr: 54, hrv_ms: 68, vo2max: 52.1, steps: 9200,  active_energy_kcal: 580, resting_energy_kcal: 1780, respiratory_rate: 14.2, source: 'mock', source_payload: null, created_at: dt(0) },
  { id: 'm-2',  user_id: 'demo', date: d(1),  sleep_minutes: 385, deep_sleep_minutes: 65,  rem_sleep_minutes: 80,  resting_hr: 58, hrv_ms: 52, vo2max: 52.1, steps: 7400,  active_energy_kcal: 420, resting_energy_kcal: 1750, respiratory_rate: 14.8, source: 'mock', source_payload: null, created_at: dt(1) },
  { id: 'm-3',  user_id: 'demo', date: d(2),  sleep_minutes: 465, deep_sleep_minutes: 95,  rem_sleep_minutes: 110, resting_hr: 52, hrv_ms: 74, vo2max: 52.1, steps: 11800, active_energy_kcal: 720, resting_energy_kcal: 1750, respiratory_rate: 13.9, source: 'mock', source_payload: null, created_at: dt(2) },
  { id: 'm-4',  user_id: 'demo', date: d(3),  sleep_minutes: 410, deep_sleep_minutes: 70,  rem_sleep_minutes: 90,  resting_hr: 55, hrv_ms: 61, vo2max: 52.1, steps: 8500,  active_energy_kcal: 510, resting_energy_kcal: 1750, respiratory_rate: 14.5, source: 'mock', source_payload: null, created_at: dt(3) },
  { id: 'm-5',  user_id: 'demo', date: d(4),  sleep_minutes: 340, deep_sleep_minutes: 55,  rem_sleep_minutes: 70,  resting_hr: 63, hrv_ms: 44, vo2max: 52.1, steps: 6100,  active_energy_kcal: 380, resting_energy_kcal: 1750, respiratory_rate: 15.2, source: 'mock', source_payload: null, created_at: dt(4) },
  { id: 'm-6',  user_id: 'demo', date: d(5),  sleep_minutes: 490, deep_sleep_minutes: 100, rem_sleep_minutes: 120, resting_hr: 51, hrv_ms: 79, vo2max: 52.1, steps: 12500, active_energy_kcal: 780, resting_energy_kcal: 1750, respiratory_rate: 13.6, source: 'mock', source_payload: null, created_at: dt(5) },
  { id: 'm-7',  user_id: 'demo', date: d(6),  sleep_minutes: 450, deep_sleep_minutes: 88,  rem_sleep_minutes: 105, resting_hr: 53, hrv_ms: 71, vo2max: 52.1, steps: 10200, active_energy_kcal: 640, resting_energy_kcal: 1750, respiratory_rate: 14.1, source: 'mock', source_payload: null, created_at: dt(6) },
  { id: 'm-8',  user_id: 'demo', date: d(7),  sleep_minutes: 395, deep_sleep_minutes: 68,  rem_sleep_minutes: 85,  resting_hr: 57, hrv_ms: 56, vo2max: 52.1, steps: 8900,  active_energy_kcal: 550, resting_energy_kcal: 1750, respiratory_rate: 14.6, source: 'mock', source_payload: null, created_at: dt(7) },
  { id: 'm-9',  user_id: 'demo', date: d(8),  sleep_minutes: 420, deep_sleep_minutes: 75,  rem_sleep_minutes: 95,  resting_hr: 55, hrv_ms: 64, vo2max: 52.1, steps: 9600,  active_energy_kcal: 600, resting_energy_kcal: 1750, respiratory_rate: 14.3, source: 'mock', source_payload: null, created_at: dt(8) },
  { id: 'm-10', user_id: 'demo', date: d(9),  sleep_minutes: 480, deep_sleep_minutes: 92,  rem_sleep_minutes: 115, resting_hr: 52, hrv_ms: 76, vo2max: 52.1, steps: 11200, active_energy_kcal: 700, resting_energy_kcal: 1750, respiratory_rate: 13.8, source: 'mock', source_payload: null, created_at: dt(9) },
  { id: 'm-11', user_id: 'demo', date: d(10), sleep_minutes: 360, deep_sleep_minutes: 58,  rem_sleep_minutes: 75,  resting_hr: 61, hrv_ms: 47, vo2max: 52.1, steps: 6800,  active_energy_kcal: 410, resting_energy_kcal: 1750, respiratory_rate: 15.0, source: 'mock', source_payload: null, created_at: dt(10) },
  { id: 'm-12', user_id: 'demo', date: d(11), sleep_minutes: 445, deep_sleep_minutes: 85,  rem_sleep_minutes: 100, resting_hr: 54, hrv_ms: 69, vo2max: 52.1, steps: 10500, active_energy_kcal: 660, resting_energy_kcal: 1750, respiratory_rate: 14.2, source: 'mock', source_payload: null, created_at: dt(11) },
  { id: 'm-13', user_id: 'demo', date: d(12), sleep_minutes: 415, deep_sleep_minutes: 72,  rem_sleep_minutes: 92,  resting_hr: 56, hrv_ms: 60, vo2max: 52.1, steps: 8800,  active_energy_kcal: 540, resting_energy_kcal: 1750, respiratory_rate: 14.4, source: 'mock', source_payload: null, created_at: dt(12) },
  { id: 'm-14', user_id: 'demo', date: d(13), sleep_minutes: 500, deep_sleep_minutes: 105, rem_sleep_minutes: 125, resting_hr: 50, hrv_ms: 82, vo2max: 52.1, steps: 13100, active_energy_kcal: 810, resting_energy_kcal: 1750, respiratory_rate: 13.5, source: 'mock', source_payload: null, created_at: dt(13) },
]

// ───────────────────────────────────────────────
// ACTIVITIES
// ───────────────────────────────────────────────
export const mockActivities: Activity[] = [
  {
    id: 'a-1', user_id: 'demo', source: 'manual', external_id: null,
    activity_type: 'ride', title: 'Morning ride — hills',
    start_time: dt(1, 7), duration_minutes: 95, distance_km: 42.3,
    elevation_gain_m: 580, avg_hr: 152, max_hr: 174, avg_power: 210,
    calories: 1050, perceived_effort: 8, difficulty_note: null,
    weather_temp_c: 18, weather_wind_kph: 15,
    source_payload: null, created_at: dt(1),
  },
  {
    id: 'a-2', user_id: 'demo', source: 'manual', external_id: null,
    activity_type: 'ride', title: 'Recovery spin',
    start_time: dt(3, 8), duration_minutes: 55, distance_km: 22.1,
    elevation_gain_m: 120, avg_hr: 128, max_hr: 148, avg_power: 155,
    calories: 490, perceived_effort: 4, difficulty_note: null,
    weather_temp_c: 20, weather_wind_kph: 8,
    source_payload: null, created_at: dt(3),
  },
  {
    id: 'a-3', user_id: 'demo', source: 'manual', external_id: null,
    activity_type: 'ride', title: 'Long endurance — Saturday',
    start_time: dt(6, 9), duration_minutes: 180, distance_km: 88.5,
    elevation_gain_m: 920, avg_hr: 145, max_hr: 168, avg_power: 195,
    calories: 2100, perceived_effort: 7, difficulty_note: null,
    weather_temp_c: 28, weather_wind_kph: 22,
    source_payload: null, created_at: dt(6),
  },
  {
    id: 'a-4', user_id: 'demo', source: 'manual', external_id: null,
    activity_type: 'ride', title: 'Intervals — felt rough',
    start_time: dt(4, 17), duration_minutes: 70, distance_km: 30.8,
    elevation_gain_m: 310, avg_hr: 138, max_hr: 182, avg_power: 235,
    calories: 820, perceived_effort: 9, difficulty_note: 'Legs were heavy, struggled to hit targets',
    weather_temp_c: 26, weather_wind_kph: 5,
    source_payload: null, created_at: dt(4),
  },
  {
    id: 'a-5', user_id: 'demo', source: 'manual', external_id: null,
    activity_type: 'ride', title: 'Commute + extra loop',
    start_time: dt(8, 7), duration_minutes: 48, distance_km: 19.4,
    elevation_gain_m: 180, avg_hr: 135, max_hr: 155, avg_power: 175,
    calories: 420, perceived_effort: 5, difficulty_note: null,
    weather_temp_c: 16, weather_wind_kph: 12,
    source_payload: null, created_at: dt(8),
  },
  {
    id: 'a-6', user_id: 'demo', source: 'manual', external_id: null,
    activity_type: 'badminton', title: 'Badminton — club session',
    start_time: dt(5, 19), duration_minutes: 75, distance_km: null,
    elevation_gain_m: null, avg_hr: 148, max_hr: 172, avg_power: null,
    calories: 640, perceived_effort: 7, difficulty_note: null,
    weather_temp_c: null, weather_wind_kph: null,
    source_payload: null, created_at: dt(5),
  },
  {
    id: 'a-7', user_id: 'demo', source: 'manual', external_id: null,
    activity_type: 'golf', title: 'Golf — 18 holes walking',
    start_time: dt(7, 10), duration_minutes: 245, distance_km: 8.2,
    elevation_gain_m: 55, avg_hr: 98, max_hr: 118, avg_power: null,
    calories: 890, perceived_effort: 4, difficulty_note: null,
    weather_temp_c: 22, weather_wind_kph: 10,
    source_payload: null, created_at: dt(7),
  },
]

// ───────────────────────────────────────────────
// FOOD LOGS
// ───────────────────────────────────────────────
export const mockFoodLogs: FoodLog[] = [
  { id: 'f-1',  user_id: 'demo', date: d(0), eaten_at: dt(0, 8),  meal_type: 'breakfast', description: 'Oats with banana and honey', estimated_calories: 380, protein_g: 12, carbs_g: 68, fat_g: 6, confidence: 'high', digestion_note: null, image_url: null, created_at: dt(0, 8) },
  { id: 'f-2',  user_id: 'demo', date: d(0), eaten_at: dt(0, 13), meal_type: 'lunch', description: 'Chicken breast, rice, broccoli', estimated_calories: 520, protein_g: 42, carbs_g: 55, fat_g: 10, confidence: 'high', digestion_note: null, image_url: null, created_at: dt(0, 13) },
  { id: 'f-3',  user_id: 'demo', date: d(0), eaten_at: dt(0, 19), meal_type: 'dinner', description: 'Salmon, sweet potato, salad', estimated_calories: 620, protein_g: 38, carbs_g: 52, fat_g: 18, confidence: 'medium', digestion_note: null, image_url: null, created_at: dt(0, 19) },
  { id: 'f-4',  user_id: 'demo', date: d(1), eaten_at: dt(1, 8),  meal_type: 'breakfast', description: 'Scrambled eggs on sourdough toast', estimated_calories: 430, protein_g: 24, carbs_g: 42, fat_g: 16, confidence: 'high', digestion_note: null, image_url: null, created_at: dt(1, 8) },
  { id: 'f-5',  user_id: 'demo', date: d(1), eaten_at: dt(1, 11), meal_type: 'snack', description: 'Energy bar on the bike', estimated_calories: 220, protein_g: 5, carbs_g: 44, fat_g: 4, confidence: 'medium', digestion_note: null, image_url: null, created_at: dt(1, 11) },
  { id: 'f-6',  user_id: 'demo', date: d(1), eaten_at: dt(1, 14), meal_type: 'lunch', description: 'Protein shake + banana', estimated_calories: 350, protein_g: 32, carbs_g: 38, fat_g: 6, confidence: 'high', digestion_note: null, image_url: null, created_at: dt(1, 14) },
  { id: 'f-7',  user_id: 'demo', date: d(1), eaten_at: dt(1, 20), meal_type: 'dinner', description: 'Pasta bolognese (large portion)', estimated_calories: 780, protein_g: 35, carbs_g: 98, fat_g: 22, confidence: 'low', digestion_note: null, image_url: null, created_at: dt(1, 20) },
  { id: 'f-8',  user_id: 'demo', date: d(3), eaten_at: dt(3, 8),  meal_type: 'breakfast', description: 'Greek yogurt, granola, berries', estimated_calories: 340, protein_g: 18, carbs_g: 48, fat_g: 8, confidence: 'high', digestion_note: null, image_url: null, created_at: dt(3, 8) },
  { id: 'f-9',  user_id: 'demo', date: d(3), eaten_at: dt(3, 13), meal_type: 'lunch', description: 'Tuna salad with wholegrain bread', estimated_calories: 460, protein_g: 36, carbs_g: 45, fat_g: 12, confidence: 'medium', digestion_note: null, image_url: null, created_at: dt(3, 13) },
  { id: 'f-10', user_id: 'demo', date: d(3), eaten_at: dt(3, 20), meal_type: 'dinner', description: 'Steak, green beans, mashed potato', estimated_calories: 680, protein_g: 45, carbs_g: 48, fat_g: 20, confidence: 'medium', digestion_note: 'Felt heavy after', image_url: null, created_at: dt(3, 20) },
]

// ───────────────────────────────────────────────
// DAILY CHECK-INS — 14 days
// ───────────────────────────────────────────────
export const mockDailyCheckins: DailyCheckin[] = [
  { id: 'c-1',  user_id: 'demo', date: d(0),  energy: 7, mood: 8, stress: 4, soreness: 3, motivation: 8, digestion: 7, notes: null, created_at: dt(0) },
  { id: 'c-2',  user_id: 'demo', date: d(1),  energy: 6, mood: 7, stress: 5, soreness: 5, motivation: 7, digestion: 6, notes: 'Legs still sore from yesterday', created_at: dt(1) },
  { id: 'c-3',  user_id: 'demo', date: d(2),  energy: 8, mood: 8, stress: 3, soreness: 2, motivation: 9, digestion: 8, notes: null, created_at: dt(2) },
  { id: 'c-4',  user_id: 'demo', date: d(3),  energy: 7, mood: 7, stress: 4, soreness: 3, motivation: 7, digestion: 7, notes: null, created_at: dt(3) },
  { id: 'c-5',  user_id: 'demo', date: d(4),  energy: 5, mood: 6, stress: 7, soreness: 6, motivation: 5, digestion: 5, notes: 'Bad sleep, stressed about work', created_at: dt(4) },
  { id: 'c-6',  user_id: 'demo', date: d(5),  energy: 8, mood: 9, stress: 2, soreness: 2, motivation: 9, digestion: 8, notes: null, created_at: dt(5) },
  { id: 'c-7',  user_id: 'demo', date: d(6),  energy: 7, mood: 8, stress: 3, soreness: 3, motivation: 8, digestion: 7, notes: 'Good day overall', created_at: dt(6) },
  { id: 'c-8',  user_id: 'demo', date: d(7),  energy: 6, mood: 7, stress: 5, soreness: 4, motivation: 7, digestion: 6, notes: null, created_at: dt(7) },
  { id: 'c-9',  user_id: 'demo', date: d(8),  energy: 7, mood: 7, stress: 4, soreness: 3, motivation: 7, digestion: 7, notes: null, created_at: dt(8) },
  { id: 'c-10', user_id: 'demo', date: d(9),  energy: 9, mood: 9, stress: 2, soreness: 1, motivation: 9, digestion: 9, notes: 'Best day in weeks!', created_at: dt(9) },
  { id: 'c-11', user_id: 'demo', date: d(10), energy: 5, mood: 6, stress: 6, soreness: 5, motivation: 5, digestion: 6, notes: null, created_at: dt(10) },
  { id: 'c-12', user_id: 'demo', date: d(11), energy: 7, mood: 8, stress: 3, soreness: 2, motivation: 8, digestion: 7, notes: null, created_at: dt(11) },
  { id: 'c-13', user_id: 'demo', date: d(12), energy: 6, mood: 7, stress: 5, soreness: 4, motivation: 6, digestion: 6, notes: null, created_at: dt(12) },
  { id: 'c-14', user_id: 'demo', date: d(13), energy: 8, mood: 9, stress: 2, soreness: 1, motivation: 9, digestion: 8, notes: null, created_at: dt(13) },
]
