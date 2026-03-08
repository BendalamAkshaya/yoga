-- SQL Script to set up standard judge accounts (10 Judges for Individual Events)
-- RUN THIS IN THE SUPABASE SQL EDITOR

DO $$
DECLARE
    new_user_id UUID;
    judge_emails TEXT[] := ARRAY[
        'cj@yoga.com', 
        'd1@yoga.com', 'd2@yoga.com', 'd3@yoga.com', 'd4@yoga.com', 'd5@yoga.com',
        't1@yoga.com', 'e1@yoga.com',
        'sa1@yoga.com', 'sm1@yoga.com'
    ];
    judge_roles public.app_role[] := ARRAY[
        'chief_judge'::public.app_role,
        'd_judge'::public.app_role, 'd_judge'::public.app_role, 'd_judge'::public.app_role, 'd_judge'::public.app_role, 'd_judge'::public.app_role,
        't_judge'::public.app_role, 'e_judge'::public.app_role,
        'scorer'::public.app_role, 'stage_manager'::public.app_role
    ];
    judge_names TEXT[] := ARRAY[
        'Chief Judge',
        'D1 Judge', 'D2 Judge', 'D3 Judge', 'D4 Judge', 'D5 Judge',
        'Time Judge', 'Evaluator (E Judge)',
        'Scorer Cum Announcer', 'Stage Manager'
    ];
    i INTEGER;
BEGIN
    FOR i IN 1..array_length(judge_emails, 1) LOOP
        -- Check if user exists
        SELECT id INTO new_user_id FROM auth.users WHERE email = judge_emails[i];
        
        IF new_user_id IS NULL THEN
            -- Create Auth User
            INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
            VALUES (
                '00000000-0000-0000-0000-000000000000',
                gen_random_uuid(),
                'authenticated',
                'authenticated',
                judge_emails[i],
                crypt('Judge@123', gen_salt('bf')),
                now(),
                now(),
                now(),
                '{"provider":"email","providers":["email"]}',
                format('{"full_name":"%s"}', judge_names[i])::jsonb,
                now(),
                now(),
                '',
                '',
                '',
                ''
            )
            RETURNING id INTO new_user_id;

            -- Assign App Role
            INSERT INTO public.user_roles (user_id, role)
            VALUES (new_user_id, judge_roles[i]);
        END IF;
    END LOOP;
END $$;
