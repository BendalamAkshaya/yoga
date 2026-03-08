-- Migration to add email column to judges table
ALTER TABLE public.judges ADD COLUMN IF NOT EXISTS email TEXT;

-- Update the full_setup.sql for new installations
-- Note: full_setup.sql is also updated in the next step.
