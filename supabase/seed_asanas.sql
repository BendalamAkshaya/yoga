-- COMPREHENSIVE ASANA SEED SCRIPT
-- Strictly following 7-asana logic (5 compulsory + 2 optional for Semi, 4+3 for Final)

-- Clear existing to avoid conflicts during manual setup
TRUNCATE TABLE public.asanas CASCADE;

-- 1. INDIVIDUAL COMPULSORY ASANAS (Example Codes)
-- Compulsory asanas ALWAYS have base_value = 1.00
INSERT INTO public.asanas (asana_code, asana_name, type, base_value, event_type, image_url) VALUES
('C101', 'Surya Namaskar', 'compulsory', 1.00, 'individual', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=200'),
('C102', 'Vrikshasana (Tree)', 'compulsory', 1.00, 'individual', 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=200'),
('C103', 'Trikonasana (Triangle)', 'compulsory', 1.00, 'individual', 'https://plus.unsplash.com/premium_photo-1681022527718-81786d787ec0?auto=format&fit=crop&q=80&w=200'),
('C104', 'Virabhadrasana (Warrior)', 'compulsory', 1.00, 'individual', 'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?auto=format&fit=crop&q=80&w=200'),
('C105', 'Padahastasana', 'compulsory', 1.00, 'individual', 'https://images.unsplash.com/photo-1599447421416-3414502d18a5?auto=format&fit=crop&q=80&w=200'),
('C106', 'Bhujangasana (Cobra)', 'compulsory', 1.00, 'individual', 'https://images.unsplash.com/photo-1588282322699-391d572c5a27?auto=format&fit=crop&q=80&w=200'),
('C107', 'Dhanurasana (Bow)', 'compulsory', 1.00, 'individual', 'https://images.unsplash.com/photo-1573590330099-d6c7355ec585?auto=format&fit=crop&q=80&w=200');

-- 2. INDIVIDUAL OPTIONAL ASANAS (Example Codes)
-- Optional asanas carry Base Value multipliers (0.80 - 1.00)
INSERT INTO public.asanas (asana_code, asana_name, type, base_value, event_type, image_url) VALUES
('O201', 'Shirshasana (Headstand)', 'optional', 1.00, 'individual', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=200'),
('O202', 'Bakasana (Crow)', 'optional', 0.95, 'individual', 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=200'),
('O203', 'Mayurasana (Peacock)', 'optional', 1.00, 'individual', 'https://plus.unsplash.com/premium_photo-1681022527718-81786d787ec0?auto=format&fit=crop&q=80&w=200'),
('O204', 'Paschimottanasana', 'optional', 0.85, 'individual', 'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?auto=format&fit=crop&q=80&w=200'),
('O205', 'Ustrasana (Camel)', 'optional', 0.90, 'individual', 'https://images.unsplash.com/photo-1599447421416-3414502d18a5?auto=format&fit=crop&q=80&w=200'),
('O206', 'Chakrasana (Wheel)', 'optional', 0.95, 'individual', 'https://images.unsplash.com/photo-1588282322699-391d572c5a27?auto=format&fit=crop&q=80&w=200'),
('O207', 'Kukkutasana', 'optional', 1.00, 'individual', 'https://images.unsplash.com/photo-1573590330099-d6c7355ec585?auto=format&fit=crop&q=80&w=200');

-- 3. PAIR COMPETITION ASANAS (Placeholder)
INSERT INTO public.asanas (asana_code, asana_name, type, base_value, event_type, image_url) VALUES
('P301', 'Pair Balance A', 'compulsory', 1.00, 'pair', NULL),
('P302', 'Pair Balance B', 'optional', 0.90, 'pair', NULL);
