-- Migration to add current_asana_index to athletes table
-- This tracks which asana is currently being performed by the athlete

ALTER TABLE public.athletes 
ADD COLUMN IF NOT EXISTS current_asana_index INT NOT NULL DEFAULT 0;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
