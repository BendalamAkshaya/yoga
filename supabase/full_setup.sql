-- FULL DATABASE SETUP FOR YOGA COMPETITION SCORING SYSTEM

-- 1. Create enums
CREATE TYPE public.app_role AS ENUM ('tsr_admin', 'chief_judge', 'd_judge', 't_judge', 'e_judge', 'stage_manager', 'scorer');
CREATE TYPE public.event_type AS ENUM ('individual', 'pair');
CREATE TYPE public.event_round AS ENUM ('semi', 'final');
CREATE TYPE public.athlete_status AS ENUM ('waiting', 'performing', 'completed', 'absent');
CREATE TYPE public.asana_type AS ENUM ('compulsory', 'optional');

-- 2. Create tables
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE public.asanas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asana_code TEXT NOT NULL UNIQUE,
  asana_name TEXT NOT NULL,
  image_url TEXT,
  base_value NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  type asana_type NOT NULL DEFAULT 'compulsory',
  event_type event_type NOT NULL DEFAULT 'individual',
  CONSTRAINT compulsory_base_value CHECK (type = 'optional' OR base_value = 1.0)
);


CREATE TABLE public.event_asanas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  asana_code TEXT REFERENCES public.asanas(asana_code) ON DELETE CASCADE NOT NULL,
  UNIQUE(event_id, asana_code)
);

CREATE TABLE public.athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age INT,
  gender TEXT,
  district TEXT,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  optional_asana1 TEXT,
  optional_asana2 TEXT,
  optional_asana3 TEXT,
  status athlete_status NOT NULL DEFAULT 'waiting',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role app_role NOT NULL,
  judge_label TEXT,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE public.penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES public.athletes(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  penalty_value NUMERIC(4,2) NOT NULL DEFAULT 0,
  reason TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_asanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;

-- 4. Helper Functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 5. RLS Policies
CREATE POLICY "Viewable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

CREATE POLICY "Profiles viewable" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Events viewable" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage events" ON public.events FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

CREATE POLICY "Asanas viewable" ON public.asanas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage asanas" ON public.asanas FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

CREATE POLICY "Event Asanas viewable" ON public.event_asanas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage event asanas" ON public.event_asanas FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

CREATE POLICY "Athletes viewable" ON public.athletes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage athletes" ON public.athletes FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));
CREATE POLICY "SM update athletes" ON public.athletes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'stage_manager'));

CREATE POLICY "Judges viewable" ON public.judges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage judges" ON public.judges FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

CREATE POLICY "Scores viewable" ON public.scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Judges insert scores" ON public.scores FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.judges WHERE id = judge_id AND user_id = auth.uid()));
CREATE POLICY "Judges update scores" ON public.scores FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.judges WHERE id = judge_id AND user_id = auth.uid()));
CREATE POLICY "Admins manage scores" ON public.scores FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

CREATE POLICY "Penalties viewable" ON public.penalties FOR SELECT TO authenticated USING (true);
CREATE POLICY "E judges insert penalties" ON public.penalties FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'e_judge'));
CREATE POLICY "Chief judge update penalties" ON public.penalties FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'chief_judge'));
CREATE POLICY "Admins manage penalties" ON public.penalties FOR ALL USING (public.has_role(auth.uid(), 'tsr_admin'));

-- 6. Triggers
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scores_updated_at BEFORE UPDATE ON public.scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.athletes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.penalties;
