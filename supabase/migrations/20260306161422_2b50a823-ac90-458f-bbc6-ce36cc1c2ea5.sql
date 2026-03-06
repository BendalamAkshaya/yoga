
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('tsr_admin', 'chief_judge', 'd_judge', 't_judge', 'e_judge', 'stage_manager');

-- Create enum for event types
CREATE TYPE public.event_type AS ENUM ('individual', 'pair');

-- Create enum for event rounds
CREATE TYPE public.event_round AS ENUM ('semi', 'final');

-- Create enum for athlete status
CREATE TYPE public.athlete_status AS ENUM ('waiting', 'performing', 'completed', 'absent');

-- Create enum for asana type
CREATE TYPE public.asana_type AS ENUM ('compulsory', 'optional');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  type event_type NOT NULL DEFAULT 'individual',
  round event_round NOT NULL DEFAULT 'semi',
  no_of_asanas INT NOT NULL DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Asanas table
CREATE TABLE public.asanas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asana_code TEXT NOT NULL UNIQUE,
  asana_name TEXT NOT NULL,
  image_url TEXT,
  base_value NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  type asana_type NOT NULL DEFAULT 'compulsory'
);
ALTER TABLE public.asanas ENABLE ROW LEVEL SECURITY;

-- Athletes table
CREATE TABLE public.athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age INT,
  gender TEXT,
  district TEXT,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  optional_asana1 TEXT,
  optional_asana2 TEXT,
  status athlete_status NOT NULL DEFAULT 'waiting',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;

-- Judges table
CREATE TABLE public.judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role app_role NOT NULL,
  judge_label TEXT,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.judges ENABLE ROW LEVEL SECURITY;

-- Scores table
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES public.athletes(id) ON DELETE CASCADE NOT NULL,
  judge_id UUID REFERENCES public.judges(id) ON DELETE CASCADE NOT NULL,
  asana_code TEXT NOT NULL,
  score NUMERIC(4,2) NOT NULL DEFAULT 0,
  base_value NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  final_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  submitted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Penalties table
CREATE TABLE public.penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES public.athletes(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  penalty_value NUMERIC(4,2) NOT NULL DEFAULT 0,
  reason TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- RLS Policies

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

-- profiles
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- events
CREATE POLICY "Events viewable by authenticated" ON public.events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage events" ON public.events
  FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

-- asanas
CREATE POLICY "Asanas viewable by authenticated" ON public.asanas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage asanas" ON public.asanas
  FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

-- athletes
CREATE POLICY "Athletes viewable by authenticated" ON public.athletes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage athletes" ON public.athletes
  FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));
CREATE POLICY "Stage managers can update athletes" ON public.athletes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'stage_manager'));

-- judges
CREATE POLICY "Judges viewable by authenticated" ON public.judges
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage judges" ON public.judges
  FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

-- scores
CREATE POLICY "Scores viewable by authenticated" ON public.scores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Judges can insert scores" ON public.scores
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.judges WHERE id = judge_id AND user_id = auth.uid())
  );
CREATE POLICY "Judges can update own scores" ON public.scores
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.judges WHERE id = judge_id AND user_id = auth.uid())
  );
CREATE POLICY "Admins can manage scores" ON public.scores
  FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

-- penalties
CREATE POLICY "Penalties viewable by authenticated" ON public.penalties
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "E judges can insert penalties" ON public.penalties
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'e_judge'));
CREATE POLICY "Chief judge can update penalties" ON public.penalties
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'chief_judge'));
CREATE POLICY "Admins can manage penalties" ON public.penalties
  FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scores_updated_at BEFORE UPDATE ON public.scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.athletes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.penalties;
