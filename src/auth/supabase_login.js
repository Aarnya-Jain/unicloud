// --- auth.js ---
import { createClient } from '@supabase/supabase-js'
// --- 1. Initialize Supabase Client ---
// Replace with your actual Project URL and Anon Key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);


// --- 2. Select DOM Elements ---
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const loginLink = document.querySelector('.login-link');
const signupLink = document.querySelector('.sign-up-link');
const loginSection = document.querySelector('.auth-section-login');
const signupSection = document.querySelector('.auth-section-signup');


// --- 3. Sign-Up Logic ---
signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Use the corrected IDs from the HTML
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
    });

    if (error) {
        alert('Error signing up: ' + error.message);
    }
    else {
        alert('Sign-up successful! Please check your email for a verification link.');
        signupForm.reset();
        // Show login form after successful signup
        signupSection.style.display = 'none';
        loginSection.style.display = 'block';
    }
});


// --- 4. Login Logic ---
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        alert('Error logging in: ' + error.message);
    }
    else {
        // Redirect to the data page on successful login
        window.location.href = 'data.html';
    }
});


// --- 5. Toggle between Login and Sign-Up Views ---
signupLink.addEventListener('click', (event) => {
    event.preventDefault();
    loginSection.style.display = 'none';
    signupSection.style.display = 'block';
});

loginLink.addEventListener('click', (event) => {
    event.preventDefault();
    signupSection.style.display = 'none';
    loginSection.style.display = 'block';
});