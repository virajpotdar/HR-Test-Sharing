-- ====================================================================
-- COMMON ASSESSMENT PORTAL - SUPABASE POSTGRESQL DATABASE SCHEMA
-- ====================================================================

-- 1. Admins Table
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin', -- 'super_admin' or 'admin'
    status TEXT DEFAULT 'active', -- 'active' or 'suspended'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert Default Super Admin
INSERT INTO public.admins (email, full_name, role, status)
VALUES ('admin@testportal.com', 'System Administrator', 'super_admin', 'active')
ON CONFLICT (email) DO NOTHING;

-- 2. Admin Access Requests Table
CREATE TABLE IF NOT EXISTS public.admin_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    organization TEXT,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by TEXT
);

-- 3. Exam Configuration Table
CREATE TABLE IF NOT EXISTS public.exam_config (
    id TEXT PRIMARY KEY DEFAULT 'current-exam',
    exam_id TEXT NOT NULL DEFAULT 'common_test',
    exam_title TEXT NOT NULL DEFAULT 'Common Aptitude & Technical Assessment',
    start_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 60,
    status TEXT DEFAULT 'scheduled', -- 'scheduled', 'active', 'ended'
    active_delay_minutes INTEGER DEFAULT 5,
    active_start_time TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert Default Exam Config
INSERT INTO public.exam_config (id, exam_id, exam_title, duration_minutes, status)
VALUES ('current-exam', 'common_test', 'Common Aptitude & Technical Assessment', 60, 'scheduled')
ON CONFLICT (id) DO NOTHING;

-- 4. Question Bank Table
CREATE TABLE IF NOT EXISTS public.exam_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qid TEXT NOT NULL,
    exam_id TEXT NOT NULL DEFAULT 'common_test',
    type TEXT NOT NULL DEFAULT 'mcq_single', -- 'mcq_single', 'mcq_multi', 'short', 'code'
    question TEXT NOT NULL,
    question_img TEXT,
    options JSONB DEFAULT '[]'::jsonb,
    correct JSONB NOT NULL DEFAULT '[]'::jsonb,
    marks NUMERIC DEFAULT 1,
    negative NUMERIC DEFAULT 0,
    order_num INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON public.exam_questions(exam_id);

-- 5. Candidate Test Sessions Table
CREATE TABLE IF NOT EXISTS public.exam_sessions (
    id TEXT PRIMARY KEY, -- Session ID e.g. scholar_examId
    scholar TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    exam_id TEXT NOT NULL DEFAULT 'common_test',
    status TEXT DEFAULT 'NotStarted', -- 'NotStarted', 'Active', 'Submitted'
    violations INTEGER DEFAULT 0,
    violation_images JSONB DEFAULT '[]'::jsonb,
    score NUMERIC DEFAULT 0,
    answers JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    submit_reason TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_scholar ON public.exam_sessions(scholar);
CREATE INDEX IF NOT EXISTS idx_sessions_exam_id ON public.exam_sessions(exam_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read & write for app functionality (or use Service Role key in Render backend)
CREATE POLICY "Public Read Access" ON public.exam_config FOR SELECT USING (true);
CREATE POLICY "Public Read Access Questions" ON public.exam_questions FOR SELECT USING (true);
CREATE POLICY "Public Session Management" ON public.exam_sessions FOR ALL USING (true);
CREATE POLICY "Public Admin Requests" ON public.admin_requests FOR INSERT WITH CHECK (true);
