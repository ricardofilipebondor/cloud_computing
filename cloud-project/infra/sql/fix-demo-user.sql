-- Run once if login with demo@streamsync.ai / demo123 fails
UPDATE users
SET password_hash = '$2a$10$mVe7AQ775Nf2WW0LuK5Hru/HFzcFX4CjVxALr88uNyABc1KgWPSf.'
WHERE email = 'demo@streamsync.ai';
