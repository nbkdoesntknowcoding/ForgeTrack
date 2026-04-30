-- ForgeTrack seed data
-- Run AFTER schema.sql on a fresh Supabase project.

-- Clear existing data
TRUNCATE public.attendance, public.materials, public.import_log, public.sessions, public.students, auth.users RESTART IDENTITY CASCADE;

-- Students
INSERT INTO public.students (name, usn, branch_code, admission_number, email) VALUES
('Abhishek Sharma', '4SH24CS001', 'CS', '24CS001', 'abhishek@forge.local'),
('Divya Kulkarni', '4SH24CS002', 'AI', '24CS002', 'divya@forge.local'),
('Ravi Kumar', '4SH24CS003', 'CS', '24CS003', 'ravi@forge.local'),
('Aditi Rao', '4SH24IS001', 'IS', '24IS001', 'aditi@forge.local'),
('Nikhil Singh', '4SH24CS004', 'CS', '24CS004', 'nikhil@forge.local'),
('Priya M', '4SH24AI001', 'AI', '24AI001', 'priya@forge.local'),
('Rahul K', '4SH24CS005', 'CS', '24CS005', 'rahul@forge.local'),
('Sneha Desai', '4SH24IS002', 'IS', '24IS002', 'sneha@forge.local'),
('Arjun P', '4SH24CS006', 'CS', '24CS006', 'arjun@forge.local'),
('Meghana Bhat', '4SH24AI002', 'AI', '24AI002', 'meghana@forge.local'),
('Karthik S', '4SH24CS007', 'CS', '24CS007', 'karthik@forge.local'),
('Anjali V', '4SH24IS003', 'IS', '24IS003', 'anjali@forge.local'),
('Sanjay R', '4SH24CS008', 'CS', '24CS008', 'sanjay@forge.local'),
('Pooja Hegde', '4SH24AI003', 'AI', '24AI003', 'pooja@forge.local'),
('Vikram T', '4SH24CS009', 'CS', '24CS009', 'vikram@forge.local'),
('Swathi N', '4SH24IS004', 'IS', '24IS004', 'swathi@forge.local'),
('Kiran B', '4SH24CS010', 'CS', '24CS010', 'kiran@forge.local'),
('Rashmi C', '4SH24AI004', 'AI', '24AI004', 'rashmi@forge.local'),
('Vinay K', '4SH24CS011', 'CS', '24CS011', 'vinay@forge.local'),
('Neha M', '4SH24IS005', 'IS', '24IS005', 'neha@forge.local'),
('Gautam S', '4SH24CS012', 'CS', '24CS012', 'gautam@forge.local'),
('Kavya R', '4SH24AI005', 'AI', '24AI005', 'kavya@forge.local'),
('Tarun V', '4SH24CS013', 'CS', '24CS013', 'tarun@forge.local'),
('Shruthi P', '4SH24IS006', 'IS', '24IS006', 'shruthi@forge.local'),
('Siddharth M', '4SH24CS014', 'CS', '24CS014', 'siddharth@forge.local');

-- Auth users (raw insert with bcrypt). Token fields default to '' (empty string)
-- and not NULL — current GoTrue scans these as Go strings during sign-in and 500s
-- with "Database error querying schema" if they are NULL. Default password: 'password123'.
DO $$
DECLARE
    mentor1_id UUID := gen_random_uuid();
    mentor2_id UUID := gen_random_uuid();
    student1_id UUID := gen_random_uuid();
    student2_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at, aud, role,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token,
        email_change_token_new, email_change_token_current, email_change,
        phone_change, phone_change_token, reauthentication_token
    ) VALUES
    (mentor1_id,  'nischay@theboringpeople.in', crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
    (mentor2_id,  'varun@theboringpeople.in',   crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
    (student1_id, '4SH24CS001@forge.local',     crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
    (student2_id, '4SH24CS002@forge.local',     crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', '');

    INSERT INTO public.users (id, email, role, display_name, student_id) VALUES
    (mentor1_id,  'nischay@theboringpeople.in', 'mentor',  'Nischay', NULL),
    (mentor2_id,  'varun@theboringpeople.in',   'mentor',  'Varun',   NULL),
    (student1_id, '4SH24CS001@forge.local',     'student', 'Abhishek Sharma', 1),
    (student2_id, '4SH24CS002@forge.local',     'student', 'Divya Kulkarni',  2);
END $$;

-- Sessions
INSERT INTO public.sessions (date, topic, month_number, duration_hours, session_type) VALUES
('2025-08-05', '8-Layer AI Stack',          4, 2.0, 'offline'),
('2025-08-10', 'ReAct Agent Pattern',       4, 2.0, 'offline'),
('2025-08-15', 'pgvector RAG',              4, 2.0, 'offline'),
('2025-08-20', 'Tiered Autonomy Multi-Agent', 4, 2.0, 'online'),
('2025-08-25', 'LLM fine-tuning mechanics', 4, 2.0, 'offline'),
('2025-09-02', 'Supabase Edge Functions',   5, 2.0, 'offline'),
('2025-09-07', 'Next.js RSC',               5, 2.0, 'offline'),
('2025-09-12', 'State machines in UI',      5, 2.0, 'online'),
('2025-09-17', 'Tailwind Design Systems',   5, 2.0, 'offline'),
('2025-09-22', 'Postgres scaling and RLS',  5, 2.0, 'offline'),
('2025-10-05', 'Redis caching strategies',  6, 2.0, 'offline'),
('2025-10-10', 'Kafka core concepts',       6, 2.0, 'offline'),
('2025-10-15', 'Kubernetes for AI platforms', 6, 2.5, 'online'),
('2025-10-20', 'Multi-tenant architecture', 6, 2.0, 'offline'),
('2025-10-25', 'Zero-trust security in API', 6, 2.0, 'offline');

-- Materials
INSERT INTO public.materials (session_id, title, type, url, description) VALUES
(1, '8-Layer Stack Slides',      'slides',    'https://docs.google.com/presentation/d/dummy1', 'Primary lecture slides'),
(1, 'Session 1 Recording',       'recording', 'https://youtube.com/watch?v=dummy1',            'Class recording'),
(2, 'ReAct Agent Architecture',  'document',  'https://docs.google.com/document/d/dummy2',     'Reading material for ReAct'),
(3, 'pgvector repo',             'link',      'https://github.com/pgvector/pgvector',          'Official pgvector documentation for RAG');

-- ImportLog
INSERT INTO public.import_log (filename, uploaded_by, total_rows, imported_rows, skipped_rows, status) VALUES
('month3_attendance.csv', 'Nischay', 100, 95, 5, 'completed'),
('month2_exports.xlsx',   'Varun',   100, 100, 0, 'completed');

-- Attendance: ~80% present rate across 25 students × 15 sessions
DO $$
DECLARE
    sid INTEGER;
    sessid INTEGER;
    is_present BOOLEAN;
BEGIN
    FOR sessid IN 1..15 LOOP
        FOR sid IN 1..25 LOOP
            is_present := random() < 0.8;
            INSERT INTO public.attendance (student_id, session_id, present, marked_by)
            VALUES (sid, sessid, is_present, 'Nischay')
            ON CONFLICT (student_id, session_id) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
