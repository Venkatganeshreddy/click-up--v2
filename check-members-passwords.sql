-- Check member password fields
SELECT 
  email, 
  name, 
  role,
  status,
  user_id,
  CASE 
    WHEN current_password IS NULL THEN 'NULL'
    WHEN current_password = '' THEN 'EMPTY STRING'
    ELSE 'HAS VALUE (length: ' || LENGTH(current_password) || ')'
  END as current_password_status,
  CASE 
    WHEN default_password IS NULL THEN 'NULL'
    WHEN default_password = '' THEN 'EMPTY STRING'
    ELSE 'HAS VALUE (length: ' || LENGTH(default_password) || ')'
  END as default_password_status,
  password_changed,
  created_at
FROM members
ORDER BY created_at DESC
LIMIT 10;
