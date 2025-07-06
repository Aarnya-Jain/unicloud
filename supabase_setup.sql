-- Supabase Table Setup for Connected Accounts
-- Run this in your Supabase SQL editor

-- IMPORTANT: Make sure your connected_accounts table has ALL these columns:
-- - id (UUID, Primary Key)
-- - user_id (UUID, references auth.users)
-- - provider (TEXT - 'google' or 'dropbox')
-- - provider_account_id (TEXT - unique ID from the provider)
-- - account_name (TEXT)
-- - account_email (TEXT)
-- - account_picture (TEXT, optional - for Google profile pictures)
-- - access_token (TEXT)
-- - refresh_token (TEXT, optional)
-- - created_at (TIMESTAMP WITH TIME ZONE)
-- - updated_at (TIMESTAMP WITH TIME ZONE)

-- If you're missing the provider_account_id column, add it with:
-- ALTER TABLE connected_accounts ADD COLUMN provider_account_id TEXT;

-- Create the connected_accounts table (if not already created)
CREATE TABLE IF NOT EXISTS connected_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'dropbox')),
    provider_account_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_email TEXT NOT NULL,
    account_picture TEXT, -- For Google profile pictures
    access_token TEXT NOT NULL,
    refresh_token TEXT, -- For future use with refresh tokens
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure each user can only have one account per provider per provider_account_id
    UNIQUE(user_id, provider, provider_account_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id ON connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_provider ON connected_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_provider_account_id ON connected_accounts(provider_account_id);

-- Enable Row Level Security (RLS)
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own connected accounts
CREATE POLICY "Users can view their own connected accounts" ON connected_accounts
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own connected accounts
CREATE POLICY "Users can insert their own connected accounts" ON connected_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own connected accounts
CREATE POLICY "Users can update their own connected accounts" ON connected_accounts
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own connected accounts
CREATE POLICY "Users can delete their own connected accounts" ON connected_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_connected_accounts_updated_at 
    BEFORE UPDATE ON connected_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create a view for easier querying
CREATE OR REPLACE VIEW user_connected_accounts AS
SELECT 
    ca.id,
    ca.user_id,
    ca.provider,
    ca.provider_account_id,
    ca.account_name,
    ca.account_email,
    ca.account_picture,
    ca.created_at,
    ca.updated_at
FROM connected_accounts ca
WHERE ca.user_id = auth.uid();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON connected_accounts TO authenticated;
GRANT SELECT ON user_connected_accounts TO authenticated; 