-- Migration: add age_group and event_category to events table
-- This enables auto-loading compulsory asanas for Traditional events based on age group + round

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS age_group TEXT,
  ADD COLUMN IF NOT EXISTS event_category TEXT NOT NULL DEFAULT 'traditional';

COMMENT ON COLUMN public.events.age_group IS 'Age group: sub_junior, junior, senior, senior_a, senior_b, senior_c';
COMMENT ON COLUMN public.events.event_category IS 'Event category: traditional, specialized_individual, pair';
