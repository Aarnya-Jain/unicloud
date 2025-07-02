// --- auth.js ---
import { createClient } from '@supabase/supabase-js'
// --- 1. Initialize Supabase Client ---
// Replace with your actual Project URL and Anon Key
const supabaseUrl = 'https://qiwwgrzqnefbxdyfxept.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpd3dncnpxbmVmYnhkeWZ4ZXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NTAyMDUsImV4cCI6MjA2NzAyNjIwNX0.KBFc76jX1OISXN2l3WxutaS55U5_ma6U4A2YwdtjYnc'; // PASTE YOUR PUBLIC ANON KEY HERE
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