// --- data.js ---
import { createClient } from '@supabase/supabase-js'
// --- 1. Initialize Supabase Client (needs to be on this page too) ---
// Replace with your actual Project URL and Anon Key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);


// --- 2. Page Protection and User Handling ---
let currentUser = null;

supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        console.log('Welcome, user:', currentUser.email);
        // --- Call function to load user's connected accounts ---
        loadConnectedAccounts();
    } else if (event === 'SIGNED_OUT') {
        // Redirect to login if the user signs out
        window.location.href = 'login.html';
    }
});

// Initial check to see if a user is already logged in
(async () => {
    // If returning from Dropbox OAuth (access_token in URL hash), wait for Dropbox handler, then re-check session
    if (window.location.hash.includes('access_token')) {
        setTimeout(async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                currentUser = session.user;
                console.log('Session found after Dropbox OAuth. Welcome, user:', currentUser.email);
                loadConnectedAccounts();
            } else {
                alert('You must be logged in to view this page.');
                window.location.href = 'login.html';
            }
        }, 1000); // Wait 1 second for Dropbox handler to finish
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert('You must be logged in to view this page.');
        window.location.href = 'login.html';
    } else {
        currentUser = session.user;
        console.log('Session found. Welcome, user:', currentUser.email);
        // --- Call function to load user's connected accounts ---
        loadConnectedAccounts();
    }
})();


// --- 3. Logout Button Logic ---
const logoutButton = document.getElementById('logout-button'); // Make sure you have a button with this ID
if(logoutButton){
    logoutButton.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error signing out:', error);
        }
        // The onAuthStateChange listener will handle the redirect
    });
}


// --- 4. Supabase Account Management Functions ---

/**
 * Loads all connected accounts for the current user from Supabase
 * and populates the UI accordingly
 */
async function loadConnectedAccounts() {
    if (!currentUser) return;

    console.log("Fetching connected accounts for user:", currentUser.id);

    try {
        const { data, error } = await supabase
            .from('connected_accounts')
            .select('*')
            .eq('user_id', currentUser.id);

        if (error) {
            console.error('Error fetching accounts:', error);
            return;
        }

        console.log('Found accounts in Supabase:', data);
        
        // Separate accounts by provider
        const googleAccounts = {};
        const dropboxAccounts = {};
        
        data.forEach(account => {
            if (account.provider === 'google') {
                googleAccounts[account.provider_account_id] = {
                    id: account.provider_account_id,
                    name: account.account_name,
                    email: account.account_email,
                    picture: account.account_picture || '',
                    token: account.access_token,
                    addedAt: account.created_at
                };
            } else if (account.provider === 'dropbox') {
                dropboxAccounts[account.provider_account_id] = {
                    id: account.provider_account_id,
                    name: account.account_name,
                    email: account.account_email,
                    accessToken: account.access_token,
                    addedAt: account.created_at
                };
            }
        });

        // Update global account objects and localStorage
        if (window.accounts) {
            window.accounts = googleAccounts;
            localStorage.setItem('google_drive_accounts', JSON.stringify(googleAccounts));
        }
        
        if (window.aaccounts) {
            window.aaccounts = dropboxAccounts;
            localStorage.setItem('dropbox_accounts', JSON.stringify(dropboxAccounts));
        }

        // Update UI if the functions exist
        if (window.updateUI) window.updateUI();
        if (window.renderAccounts) window.renderAccounts();
        
        // Display accounts in the main accounts list
        displayAllAccounts(data);

    } catch (error) {
        console.error('Error in loadConnectedAccounts:', error);
    }
}

/**
 * Displays all connected accounts in the main accounts section
 */
function displayAllAccounts(accounts) {
    const accountsList = document.getElementById('all-accounts-list');
    if (!accountsList) return;

    if (!accounts || accounts.length === 0) {
        accountsList.innerHTML = '<p class="no-accounts">No accounts connected yet. Add your first cloud account to get started!</p>';
        return;
    }

    const accountsHTML = accounts.map(account => {
        const providerIcon = account.provider === 'google' ? 'fab fa-google' : 'fab fa-dropbox';
        const providerColor = account.provider === 'google' ? '#4285f4' : '#0061fe';
        
        return `
            <div class="account-card" style="border-left: 4px solid ${providerColor}">
                <div class="account-info">
                    <i class="${providerIcon}" style="color: ${providerColor}; font-size: 1.5em;"></i>
                    <div class="account-details">
                        <h3>${account.account_name}</h3>
                        <p>${account.account_email}</p>
                        <span class="provider-badge">${account.provider.charAt(0).toUpperCase() + account.provider.slice(1)}</span>
                    </div>
                </div>
                <div class="account-actions">
                    <button class="btn-manage" onclick="manageAccount('${account.provider}', '${account.provider_account_id}')">
                        Manage
                    </button>
                    <button class="btn-remove" onclick="removeAccountFromSupabase('${account.provider}', '${account.provider_account_id}')">
                        Remove
                    </button>
                </div>
            </div>
        `;
    }).join('');

    accountsList.innerHTML = accountsHTML;
}

/**
 * Handles the process of connecting a new Google account and saving it to Supabase.
 * This function should be called when the user clicks the "Add Google Drive" button.
 *
 * @param {object} googleAuthData - The user and token data you get from Google's successful sign-in.
 */
async function connectAndSaveGoogleAccount(googleAuthData) {
    // --- Pre-check: Ensure a Supabase user is logged in ---
    if (!currentUser) {
        alert("Authentication error: Please log in again to connect an account.");
        return;
    }

    console.log("Starting to save Google Account for Supabase user:", currentUser.id);

    // --- 1. Prepare the data object for Supabase ---
    const newCloudAccount = {
        user_id: currentUser.id,             // Links this entry to the logged-in Supabase user
        provider: 'google',
        provider_account_id: googleAuthData.id,          // The unique ID for the user FROM GOOGLE
        account_name: googleAuthData.name,         // The user's name FROM GOOGLE
        account_email: googleAuthData.email,       // The user's email FROM GOOGLE
        account_picture: googleAuthData.picture,   // The user's profile picture FROM GOOGLE
        access_token: googleAuthData.access_token, // The access token FROM GOOGLE
        // If you have a refresh token from Google, you would add it here:
        // refresh_token: googleAuthData.refresh_token 
    };

    // --- 2. Insert the new row into the 'connected_accounts' table ---
    const { data, error } = await supabase
        .from('connected_accounts')
        .insert([newCloudAccount]);

    // --- 3. Handle the result ---
    if (error) {
        console.error('Error saving account to Supabase:', error);
        // This can happen if, for example, the RLS policy fails.
        alert('Failed to connect Google account: ' + error.message);
        return false;
    } else {
        console.log('Google account saved successfully!', data);
        alert('Google Drive account has been successfully connected!');
        
        // Refresh the accounts list
        await loadConnectedAccounts();
        return true;
    }
}

/**
 * Handles the process of connecting a new Dropbox account and saving it to Supabase.
 * This function should be called when the user clicks the "Add Dropbox" button.
 *
 * @param {object} dropboxAuthData - The user and token data you get from Dropbox's successful sign-in.
 */
async function connectAndSaveDropboxAccount(dropboxAuthData) {
    // --- Pre-check: Ensure a Supabase user is logged in ---
    if (!currentUser) {
        alert("Authentication error: Please log in again to connect an account.");
        return;
    }

    console.log("Starting to save Dropbox Account for Supabase user:", currentUser.id);

    // --- 1. Prepare the data object for Supabase ---
    const newCloudAccount = {
        user_id: currentUser.id,             // Links this entry to the logged-in Supabase user
        provider: 'dropbox',
        provider_account_id: dropboxAuthData.id,          // The unique ID for the user FROM DROPBOX
        account_name: dropboxAuthData.name,         // The user's name FROM DROPBOX
        account_email: dropboxAuthData.email,       // The user's email FROM DROPBOX
        access_token: dropboxAuthData.access_token, // The access token FROM DROPBOX
    };

    // --- 2. Insert the new row into the 'connected_accounts' table ---
    const { data, error } = await supabase
        .from('connected_accounts')
        .insert([newCloudAccount]);

    // --- 3. Handle the result ---
    if (error) {
        console.error('Error saving account to Supabase:', error);
        alert('Failed to connect Dropbox account: ' + error.message);
        return false;
    } else {
        console.log('Dropbox account saved successfully!', data);
        alert('Dropbox account has been successfully connected!');
        
        // Refresh the accounts list
        await loadConnectedAccounts();
        return true;
    }
}

/**
 * Removes an account from Supabase
 */
async function removeAccountFromSupabase(provider, providerAccountId) {
    if (!currentUser) {
        alert("Authentication error: Please log in again.");
        return;
    }

    if (!confirm(`Are you sure you want to remove this ${provider} account?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('connected_accounts')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('provider', provider)
            .eq('provider_account_id', providerAccountId);

        if (error) {
            console.error('Error removing account from Supabase:', error);
            alert('Failed to remove account: ' + error.message);
        } else {
            console.log('Account removed from Supabase successfully');
            alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} account removed successfully!`);
            
            // Refresh the accounts list
            await loadConnectedAccounts();
        }
    } catch (error) {
        console.error('Error in removeAccountFromSupabase:', error);
        alert('Error removing account: ' + error.message);
    }
}

/**
 * Manages an account by switching to the appropriate tab and account
 */
function manageAccount(provider, providerAccountId) {
    if (provider === 'google') {
        // Switch to Google Drive tab
        const googleTab = document.querySelector('[onclick*="google-drive"]');
        if (googleTab) {
            googleTab.click();
        }
        
        // Switch to the specific account if the function exists
        if (window.switchGoogleAccount) {
            window.switchGoogleAccount(providerAccountId);
        }
    } else if (provider === 'dropbox') {
        // Switch to Dropbox tab
        const dropboxTab = document.querySelector('[onclick*="dropbox"]');
        if (dropboxTab) {
            dropboxTab.click();
        }
        
        // Switch to the specific account if the function exists
        if (window.switchDropboxAccount) {
            window.switchDropboxAccount(providerAccountId);
        }
    }
}

// --- 5. Make functions globally available ---
window.connectAndSaveGoogleAccount = connectAndSaveGoogleAccount;
window.connectAndSaveDropboxAccount = connectAndSaveDropboxAccount;
window.removeAccountFromSupabase = removeAccountFromSupabase;
window.manageAccount = manageAccount;
window.loadConnectedAccounts = loadConnectedAccounts;