-- Fix member statuses: members who have logged in before (have user_id)
-- but are not currently online should be 'offline', not 'pending'.
-- 'pending' should only be for members who have NEVER logged in.

-- Set members with user_id who are currently 'pending' to 'offline'
UPDATE members
SET status = 'offline'
WHERE user_id IS NOT NULL
  AND status = 'pending';

-- Members without user_id stay as 'pending' (never logged in)
