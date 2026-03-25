-- =====================================================
-- SUPABASE SECURITY FIXES
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- ISSUE 1: Function Search Path Mutable
-- =====================================================
-- WHAT IT MEANS:
-- Functions without a fixed search_path are vulnerable to "search path injection" attacks.
-- A malicious user could create objects with the same name in a different schema
-- that gets executed instead of the intended object.
--
-- FIX: Add 'SET search_path = public' to each function to lock it to the public schema.

-- Fix update_sprint_folders_updated_at
CREATE OR REPLACE FUNCTION public.update_sprint_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix update_sprints_updated_at
CREATE OR REPLACE FUNCTION public.update_sprints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix update_docs_updated_at
CREATE OR REPLACE FUNCTION public.update_docs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix update_forms_updated_at
CREATE OR REPLACE FUNCTION public.update_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix update_doc_pages_updated_at
CREATE OR REPLACE FUNCTION public.update_doc_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix update_task_statuses_updated_at
CREATE OR REPLACE FUNCTION public.update_task_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix create_default_space_statuses (you may need to check the actual function body)
-- This is a placeholder - update with actual function body if different
CREATE OR REPLACE FUNCTION public.create_default_space_statuses()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default statuses for new space
  INSERT INTO public.task_statuses (space_id, name, color, position, status_group)
  VALUES
    (NEW.id, 'TO DO', '#6b7280', 0, 'active'),
    (NEW.id, 'IN PROGRESS', '#3b82f6', 1, 'active'),
    (NEW.id, 'REVIEW', '#8b5cf6', 2, 'active'),
    (NEW.id, 'DONE', '#22c55e', 3, 'done');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix update_form_responses_updated_at
CREATE OR REPLACE FUNCTION public.update_form_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix update_form_responses_count
CREATE OR REPLACE FUNCTION public.update_form_responses_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forms SET responses_count = responses_count + 1, updated_at = NOW() WHERE id = NEW.form_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forms SET responses_count = GREATEST(0, responses_count - 1), updated_at = NOW() WHERE id = OLD.form_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix handle_new_user (check actual function body)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.members (id, email, name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 'member')
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- =====================================================
-- ISSUE 2: RLS Policy Always True
-- =====================================================
-- WHAT IT MEANS:
-- Policies with 'USING (true)' or 'WITH CHECK (true)' allow ALL users to do ALL operations.
-- This essentially bypasses Row Level Security entirely.
--
-- FIX: Replace with proper policies that check for authenticated users.
-- For a team app, authenticated users should be able to access team data.
-- You can make these stricter later (e.g., check membership in specific spaces).

-- OPTION A: Simple fix - require authentication (recommended for now)
-- This allows all authenticated users to access all data.
-- This is appropriate for a team collaboration tool where everyone needs to see everything.

-- Drop old overly permissive policies and create proper ones

-- SPACES
DROP POLICY IF EXISTS "Allow all on spaces" ON public.spaces;
CREATE POLICY "Authenticated users can view spaces" ON public.spaces
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert spaces" ON public.spaces
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update spaces" ON public.spaces
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete spaces" ON public.spaces
  FOR DELETE USING (auth.role() = 'authenticated');

-- LISTS
DROP POLICY IF EXISTS "Allow all on lists" ON public.lists;
CREATE POLICY "Authenticated users can view lists" ON public.lists
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert lists" ON public.lists
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update lists" ON public.lists
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete lists" ON public.lists
  FOR DELETE USING (auth.role() = 'authenticated');

-- TASKS
DROP POLICY IF EXISTS "Allow all on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON public.tasks;
CREATE POLICY "Authenticated users can view tasks" ON public.tasks
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert tasks" ON public.tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update tasks" ON public.tasks
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete tasks" ON public.tasks
  FOR DELETE USING (auth.role() = 'authenticated');

-- FOLDERS
DROP POLICY IF EXISTS "Allow all on folders" ON public.folders;
CREATE POLICY "Authenticated users can view folders" ON public.folders
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert folders" ON public.folders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update folders" ON public.folders
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete folders" ON public.folders
  FOR DELETE USING (auth.role() = 'authenticated');

-- MEMBERS
DROP POLICY IF EXISTS "Allow all for members" ON public.members;
CREATE POLICY "Authenticated users can view members" ON public.members
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert members" ON public.members
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update members" ON public.members
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete members" ON public.members
  FOR DELETE USING (auth.role() = 'authenticated');

-- DOCS
DROP POLICY IF EXISTS "Allow all access to docs" ON public.docs;
CREATE POLICY "Authenticated users can view docs" ON public.docs
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert docs" ON public.docs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update docs" ON public.docs
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete docs" ON public.docs
  FOR DELETE USING (auth.role() = 'authenticated');

-- DOC_PAGES
DROP POLICY IF EXISTS "Allow all access to doc_pages" ON public.doc_pages;
CREATE POLICY "Authenticated users can view doc_pages" ON public.doc_pages
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert doc_pages" ON public.doc_pages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update doc_pages" ON public.doc_pages
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete doc_pages" ON public.doc_pages
  FOR DELETE USING (auth.role() = 'authenticated');

-- FORMS
DROP POLICY IF EXISTS "Allow all access to forms" ON public.forms;
CREATE POLICY "Authenticated users can view forms" ON public.forms
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Anyone can view published forms" ON public.forms
  FOR SELECT USING (status = 'active'); -- Allow public form submissions
CREATE POLICY "Authenticated users can insert forms" ON public.forms
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update forms" ON public.forms
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete forms" ON public.forms
  FOR DELETE USING (auth.role() = 'authenticated');

-- FORM_RESPONSES (needs to allow anonymous submissions)
DROP POLICY IF EXISTS "Allow all access to form_responses" ON public.form_responses;
DROP POLICY IF EXISTS "Allow all form_responses operations" ON public.form_responses;
CREATE POLICY "Authenticated users can view form_responses" ON public.form_responses
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Anyone can submit form_responses" ON public.form_responses
  FOR INSERT WITH CHECK (true); -- Allow anonymous form submissions
CREATE POLICY "Authenticated users can update form_responses" ON public.form_responses
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete form_responses" ON public.form_responses
  FOR DELETE USING (auth.role() = 'authenticated');

-- SPRINTS
DROP POLICY IF EXISTS "Allow all on sprints" ON public.sprints;
CREATE POLICY "Authenticated users can view sprints" ON public.sprints
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert sprints" ON public.sprints
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update sprints" ON public.sprints
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete sprints" ON public.sprints
  FOR DELETE USING (auth.role() = 'authenticated');

-- SPRINT_FOLDERS
DROP POLICY IF EXISTS "Allow all on sprint_folders" ON public.sprint_folders;
CREATE POLICY "Authenticated users can view sprint_folders" ON public.sprint_folders
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert sprint_folders" ON public.sprint_folders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update sprint_folders" ON public.sprint_folders
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete sprint_folders" ON public.sprint_folders
  FOR DELETE USING (auth.role() = 'authenticated');

-- SPACE_MEMBERS
DROP POLICY IF EXISTS "Allow all for space_members" ON public.space_members;
CREATE POLICY "Authenticated users can view space_members" ON public.space_members
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert space_members" ON public.space_members
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update space_members" ON public.space_members
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete space_members" ON public.space_members
  FOR DELETE USING (auth.role() = 'authenticated');

-- TASK_LISTS
DROP POLICY IF EXISTS "Allow all for task_lists" ON public.task_lists;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.task_lists;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.task_lists;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.task_lists;
CREATE POLICY "Authenticated users can view task_lists" ON public.task_lists
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert task_lists" ON public.task_lists
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update task_lists" ON public.task_lists
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete task_lists" ON public.task_lists
  FOR DELETE USING (auth.role() = 'authenticated');

-- TASK_STATUSES
DROP POLICY IF EXISTS "task_statuses_all" ON public.task_statuses;
CREATE POLICY "Authenticated users can view task_statuses" ON public.task_statuses
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert task_statuses" ON public.task_statuses
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update task_statuses" ON public.task_statuses
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete task_statuses" ON public.task_statuses
  FOR DELETE USING (auth.role() = 'authenticated');

-- STATUS_SETTINGS
DROP POLICY IF EXISTS "status_settings_all" ON public.status_settings;
CREATE POLICY "Authenticated users can view status_settings" ON public.status_settings
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert status_settings" ON public.status_settings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update status_settings" ON public.status_settings
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete status_settings" ON public.status_settings
  FOR DELETE USING (auth.role() = 'authenticated');

-- CUSTOM_FIELDS
DROP POLICY IF EXISTS "Allow all for custom_fields" ON public.custom_fields;
CREATE POLICY "Authenticated users can view custom_fields" ON public.custom_fields
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert custom_fields" ON public.custom_fields
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update custom_fields" ON public.custom_fields
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete custom_fields" ON public.custom_fields
  FOR DELETE USING (auth.role() = 'authenticated');

-- CUSTOM_FIELD_VALUES
DROP POLICY IF EXISTS "Allow all for custom_field_values" ON public.custom_field_values;
CREATE POLICY "Authenticated users can view custom_field_values" ON public.custom_field_values
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert custom_field_values" ON public.custom_field_values
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update custom_field_values" ON public.custom_field_values
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete custom_field_values" ON public.custom_field_values
  FOR DELETE USING (auth.role() = 'authenticated');


-- =====================================================
-- ISSUE 3: Leaked Password Protection Disabled
-- =====================================================
-- WHAT IT MEANS:
-- Supabase can check passwords against the HaveIBeenPwned database
-- to prevent users from using compromised passwords.
--
-- FIX: Enable this in Supabase Dashboard:
-- 1. Go to Authentication > Settings
-- 2. Scroll to "Password Security"
-- 3. Enable "Enable leaked password protection"
--
-- This cannot be done via SQL - it must be done in the Dashboard.


-- =====================================================
-- VERIFICATION
-- =====================================================
-- Run this to verify policies were created:
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
