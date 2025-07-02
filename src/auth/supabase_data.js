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
        // loadConnectedAccounts();
    } else if (event === 'SIGNED_OUT') {
        // Redirect to login if the user signs out
        window.location.href = 'login.html';
    }
});

// Initial check to see if a user is already logged in
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        // No session found, redirect to login
        alert('You must be logged in to view this page.');
        window.location.href = 'login.html';
    } else {
        currentUser = session.user;
        console.log('Session found. Welcome, user:', currentUser.email);
        // --- Call function to load user's connected accounts ---
        // loadConnectedAccounts();
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


// --- 4. Placeholder for your app's core logic ---
async function loadConnectedAccounts() {
    if (!currentUser) return;

    console.log("Fetching connected accounts for user:", currentUser.id);

    // This is where you will fetch data from your 'connected_accounts' table
    const { data, error } = await supabase
        .from('connected_accounts')
        .select('*')
        .eq('user_id', currentUser.id);

    if (error) {
        console.error('Error fetching accounts:', error);
        return;
    }

    console.log('Found accounts:', data);
    // Code to display these accounts in your UI goes here
}