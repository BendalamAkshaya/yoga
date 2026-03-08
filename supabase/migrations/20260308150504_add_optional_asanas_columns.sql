-- Migration to add optional_asana4 and optional_asana5 support for Specialized Individual events

ALTER TABLE public.athletes
ADD COLUMN IF NOT EXISTS optional_asana4 TEXT,
ADD COLUMN IF NOT EXISTS optional_asana5 TEXT;
