-- SQL Script to set up the 'notes' table in Supabase.
-- Paste this script into your Supabase project's SQL Editor (https://supabase.com/dashboard/project/_/sql) and run it.

-- Create the notes table
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Catatan Baru',
  content TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  todo_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read/write access (since there is no user authentication configured in this app yet)
CREATE POLICY "Allow public read access" ON public.notes
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON public.notes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON public.notes
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON public.notes
  FOR DELETE USING (true);
