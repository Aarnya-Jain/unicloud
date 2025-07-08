# Supabase Integration for Cloud Account Management

This document explains how the Google Drive integration now works with Supabase to provide individual user account management.

## Overview

The application now stores all connected cloud accounts (Google Drive) in a Supabase database table called `connected_accounts`. This ensures that:

1. **Each user has their own individual accounts** - No mixing of accounts between users
2. **Accounts persist across sessions** - Accounts are loaded when users log in
3. **Secure storage** - Access tokens are stored securely in Supabase
4. **Centralized management** - All account operations go through Supabase

## Database Setup

### 1. Table Structure

Your `connected_accounts` table should have the following structure:

```sql
- id: UUID (Primary Key, auto-generated)
- user_id: UUID (references auth.users, links to logged-in user)
- provider: TEXT (either 'google' or 'dropbox')
- provider_account_id: TEXT (unique ID from the provider)
- account_name: TEXT (display name from the provider)
- account_email: TEXT (email address from the provider)
- account_picture: TEXT (profile picture URL for Google, optional)
- access_token: TEXT (OAuth access token)
- refresh_token: TEXT (for future use, optional)
- created_at: TIMESTAMP WITH TIME ZONE (auto-generated)
- updated_at: TIMESTAMP WITH TIME ZONE (auto-updated)
```

### 2. Required Setup

If you haven't already, run these commands in your Supabase SQL editor:

```sql
-- Enable Row Level Security
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own connected accounts" ON connected_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connected accounts" ON connected_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connected accounts" ON connected_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connected accounts" ON connected_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Add unique constraint to prevent duplicate accounts
ALTER TABLE connected_accounts 
ADD CONSTRAINT unique_user_provider_account 
UNIQUE(user_id, provider, provider_account_id);
```

### 3. Verify Your Setup

Run the verification script `verify_table_structure.sql` in your Supabase SQL editor to ensure everything is set up correctly.

## How It Works

### 1. User Authentication
- Users log in through Supabase Auth
- The `currentUser` object contains the user's Supabase ID

### 2. Account Connection Flow

#### Google Drive:
1. User clicks "Add Google Drive" button
2. Google OAuth flow is initiated
3. After successful authentication, `connectAndSaveGoogleAccount()` is called
4. Account data is saved to Supabase `connected_accounts` table
5. Account is also stored locally for immediate use

### 3. Account Loading
- When a user logs in, `loadConnectedAccounts()` is called
- This fetches all connected accounts for the current user from Supabase
- Accounts are separated by provider and stored in the respective global objects
- The UI is updated to show all connected accounts

### 4. Account Management
- Users can view all their connected accounts in the main dashboard
- Each account shows provider icon, name, email, and management buttons
- "Manage" button switches to the appropriate tab and account
- "Remove" button deletes the account from both Supabase and local storage

## Key Functions

### Supabase Functions (`supabase_data.js`)

- `loadConnectedAccounts()` - Loads all accounts for the current user
- `connectAndSaveGoogleAccount(googleAuthData)` - Saves Google account to Supabase
- `removeAccountFromSupabase(provider, providerAccountId)` - Removes account from Supabase
- `displayAllAccounts(accounts)` - Displays accounts in the main UI
- `manageAccount(provider, providerAccountId)` - Switches to manage specific account

### Integration Points

#### Google Drive (`google.js`):
- Modified `addAccountButton.onclick` to call `connectAndSaveGoogleAccount()`
- Modified `removeGoogleAccount()` to call `removeAccountFromSupabase()`
- Accounts are loaded from Supabase on initialization

## Security Features

1. **Row Level Security (RLS)** - Users can only access their own accounts
2. **Cascade Deletion** - When a user is deleted, their accounts are automatically removed
3. **Unique Constraints** - Prevents duplicate accounts per user per provider
4. **Token Storage** - Access tokens are stored securely in the database

## Environment Variables

Make sure you have these environment variables set:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Usage Flow

1. **User Registration/Login**: User creates account or logs in through Supabase
2. **Add Cloud Accounts**: User clicks "Add Google Drive" or "Add Dropbox" buttons
3. **OAuth Flow**: User authorizes the application with their cloud provider
4. **Account Storage**: Account details are saved to Supabase
5. **Account Management**: User can view, manage, and remove accounts
6. **Session Persistence**: Accounts are automatically loaded on subsequent logins

## Benefits

1. **Multi-User Support**: Each user has their own isolated account list
2. **Data Persistence**: Accounts survive browser sessions and device changes
3. **Security**: Proper authentication and authorization
4. **Scalability**: Can handle multiple users and multiple accounts per user
5. **Centralized Management**: All account operations go through Supabase

## Troubleshooting

### Common Issues:

1. **"Authentication error"**: User needs to log in again
2. **"Failed to save account to database"**: Check Supabase connection and table setup
3. **Accounts not loading**: Check RLS policies and user authentication
4. **Duplicate accounts**: Check unique constraints in the database

### Debug Steps:

1. Check browser console for errors
2. Verify Supabase connection in Network tab
3. Check Supabase logs for database errors
4. Verify RLS policies are correctly set up
5. Ensure environment variables are properly configured
6. Run the verification script to check table structure

### Missing Columns

If you're missing any columns, add them with:

```sql
-- Add provider_account_id if missing
ALTER TABLE connected_accounts ADD COLUMN provider_account_id TEXT;

-- Add account_picture if missing
ALTER TABLE connected_accounts ADD COLUMN account_picture TEXT;

-- Add refresh_token if missing
ALTER TABLE connected_accounts ADD COLUMN refresh_token TEXT;

-- Add updated_at if missing
ALTER TABLE connected_accounts ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
``` 