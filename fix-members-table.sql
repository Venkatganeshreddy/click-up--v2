-- Fix members table for custom authentication flow
-- This ensures all members can login even without Supabase Auth users

-- NOTE: Members are created with status='pending' and automatically
-- set to 'active' on their first successful login

-- 1. View pending members (haven't logged in yet)
SELECT email, name, role, status, created_at
FROM members
WHERE status = 'pending'
ORDER BY created_at DESC;

-- 2. Ensure all members have passwords stored
-- (No action needed if passwords already exist)

-- 3. View all members and their auth status
SELECT
  id,
  email,
  name,
  role,
  status,
  user_id,
  CASE
    WHEN user_id IS NULL THEN 'No Auth User (Custom Auth)'
    ELSE 'Has Auth User'
  END as auth_status,
  created_at
FROM members
ORDER BY created_at DESC;

-- 4. Fix specific member if needed (replace email)
-- UPDATE members
-- SET status = 'active', user_id = NULL
-- WHERE email = 'your-email@example.com';

-- 5. Check members table schema
-- \d members

-- 6. Create a new member manually (if needed)
/*
INSERT INTO members (
  email,
  name,
  role,
  status,
  workspace_id,
  space_id,
  user_id,
  joined_at,
  default_password,
  current_password,
  password_changed
) VALUES (
  'newuser@example.com',
  'New User',
  'member',
  'active',
  NULL,
  NULL,
  NULL,
  NOW(),
  'YourPassword123',
  'YourPassword123',
  false
);
*/
