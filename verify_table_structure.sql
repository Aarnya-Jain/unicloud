-- Verification Script for connected_accounts table
-- Run this in your Supabase SQL editor to check your table structure

-- Check if the table exists
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'connected_accounts';

-- Check all columns in the table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'connected_accounts'
ORDER BY ordinal_position;

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'connected_accounts';

-- Check RLS policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'connected_accounts';

-- Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'connected_accounts';

-- Test insert (this will fail if RLS is working correctly without auth)
-- INSERT INTO connected_accounts (user_id, provider, provider_account_id, account_name, account_email, access_token) 
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test', 'test_id', 'Test Account', 'test@example.com', 'test_token'); 