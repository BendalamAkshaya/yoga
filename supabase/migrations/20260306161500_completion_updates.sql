-- Add scorer role to app_role enum
ALTER TYPE public.app_role ADD VALUE 'scorer';

-- Add optional_asana3 to athletes table
ALTER TABLE public.athletes ADD COLUMN optional_asana3 TEXT;

-- Event-Asanas junction table for compulsory asanas
CREATE TABLE public.event_asanas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  asana_code TEXT REFERENCES public.asanas(asana_code) ON DELETE CASCADE NOT NULL,
  UNIQUE(event_id, asana_code)
);

-- Enable RLS
ALTER TABLE public.event_asanas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Asanas viewable by authenticated" ON public.event_asanas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage event asanas" ON public.event_asanas
  FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));
