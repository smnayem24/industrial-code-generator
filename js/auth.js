/**
 * ==========================================================================
 * INDUSTRIAL CODE & LABEL GENERATOR - FIREBASE AUTHENTICATION & WHITELIST
 * Features:
 *   - Firebase Web SDK Authentication (Google 1-Click & Email/Password)
 *   - Strict Email Whitelist Security (Unauthorized accounts are rejected)
 *   - Persistent Login State (Local Storage)
 *   - Modern Industrial Glassmorphic Lock Screen
 *   - Local Developer / Preview Fallback Mode
 * ==========================================================================
 */

window.LabelApp = window.LabelApp || {};
LabelApp.Auth = {};

// --------------------------------------------------------------------------
// ENVIRONMENT CONFIGURATION: LOADED FROM js/env.js (or .env via build-env.js)
// --------------------------------------------------------------------------
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

window.WHITELISTED_EMAILS = window.WHITELISTED_EMAILS || [];

// Current Auth State
LabelApp.Auth.state = {
  isConfigured: false,
  currentUser: null,
  isBypassed: false
};

/**
 * Initialize Firebase and Authentication Listeners
 */
LabelApp.Auth.init = function() {
  const cfg = window.FIREBASE_CONFIG;
  const isPlaceholder = !cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY' || cfg.apiKey.includes('YOUR_');

  const banner = document.getElementById('authConfigBanner');
  const lockCard = document.getElementById('authCard');
  const wrap = document.querySelector('.wrap');

  if (isPlaceholder) {
    LabelApp.Auth.state.isConfigured = false;
    if (banner) banner.style.display = 'block';
    console.warn('[LabelApp.Auth] Firebase is not yet configured. Please supply your API keys in js/auth.js.');
    return;
  }

  if (banner) banner.style.display = 'none';
  LabelApp.Auth.state.isConfigured = true;

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(cfg);
    }

    // Set local persistence so user doesn't need to log in repeatedly
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    // Real-time auth state listener
    firebase.auth().onAuthStateChanged((user) => {
      LabelApp.Auth.handleAuthState(user);
    });
  } catch (err) {
    console.error('[LabelApp.Auth] Initialization error:', err);
    LabelApp.Auth.showStatus('Firebase initialization error: ' + err.message, 'error');
  }
};

/**
 * Handle Auth State changes (Login, Logout, Whitelist Verification)
 */
LabelApp.Auth.handleAuthState = async function(user) {
  const overlay = document.getElementById('authOverlay');
  const wrap = document.querySelector('.wrap');
  const userPill = document.getElementById('authEmailDisplay');
  const statusBar = document.getElementById('authStatusBar');

  if (!user) {
    // Logged out
    LabelApp.Auth.state.currentUser = null;
    if (wrap) {
      wrap.classList.add('app-locked');
    }
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.classList.remove('fade-out');
    }
    if (statusBar) statusBar.style.display = 'none';
    LabelApp.Auth.clearStatus();
    return;
  }

  // Check Whitelist Security
  const email = (user.email || '').toLowerCase().trim();
  const whitelist = (window.WHITELISTED_EMAILS || []).map(e => (e || '').toLowerCase().trim()).filter(Boolean);

  if (whitelist.length > 0 && !whitelist.includes(email)) {
    // ACCESS DENIED: Account is NOT authorized!
    console.warn(`[LabelApp.Auth] Unauthorized access attempt by: ${email}`);
    LabelApp.Auth.showStatus(
      `⛔ Access Denied: "${email}" is not authorized. This terminal is strictly private.`,
      'error'
    );
    // Automatically sign out unauthorized user
    await firebase.auth().signOut();
    return;
  }

  // ACCESS GRANTED
  LabelApp.Auth.state.currentUser = user;
  if (userPill) {
    userPill.textContent = user.email || 'Authorized Operator';
  }
  if (statusBar) {
    statusBar.style.display = 'flex';
  }

  LabelApp.Auth.showStatus(`✅ Welcome, ${user.displayName || user.email}! Unlocking terminal...`, 'success');

  setTimeout(() => {
    if (overlay) {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 350);
    }
    if (wrap) {
      wrap.classList.remove('app-locked');
    }
    LabelApp.Auth.clearStatus();
  }, 400);
};

/**
 * Sign in with Google (1-Click)
 */
LabelApp.Auth.loginWithGoogle = async function() {
  if (!LabelApp.Auth.state.isConfigured) {
    LabelApp.Auth.showStatus('Please configure Firebase in js/auth.js first.', 'error');
    return;
  }

  LabelApp.Auth.showStatus('Connecting to Google Authentication...', 'info');

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await firebase.auth().signInWithPopup(provider);
  } catch (err) {
    console.error('[LabelApp.Auth] Google Login Error:', err);
    LabelApp.Auth.showStatus(LabelApp.Auth.formatErrorMessage(err), 'error');
  }
};

/**
 * Sign in with Email & Password
 */
LabelApp.Auth.loginWithEmail = async function() {
  if (!LabelApp.Auth.state.isConfigured) {
    LabelApp.Auth.showStatus('Please configure Firebase in js/auth.js first.', 'error');
    return;
  }

  const emailInput = document.getElementById('authEmailInput');
  const passInput = document.getElementById('authPassInput');
  const email = (emailInput ? emailInput.value : '').trim();
  const password = passInput ? passInput.value : '';

  if (!email || !password) {
    LabelApp.Auth.showStatus('Please enter both Email and Password.', 'error');
    return;
  }

  LabelApp.Auth.showStatus('Verifying credentials...', 'info');

  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
  } catch (err) {
    console.error('[LabelApp.Auth] Email Login Error:', err);
    LabelApp.Auth.showStatus(LabelApp.Auth.formatErrorMessage(err), 'error');
  }
};

/**
 * Sign up new operator account with Email & Password
 */
LabelApp.Auth.signupWithEmail = async function() {
  if (!LabelApp.Auth.state.isConfigured) {
    LabelApp.Auth.showStatus('Please configure Firebase in js/auth.js first.', 'error');
    return;
  }

  const emailInput = document.getElementById('authEmailInput');
  const passInput = document.getElementById('authPassInput');
  const email = (emailInput ? emailInput.value : '').trim();
  const password = passInput ? passInput.value : '';

  if (!email || !password) {
    LabelApp.Auth.showStatus('Please enter both Email and Password.', 'error');
    return;
  }

  if (password.length < 6) {
    LabelApp.Auth.showStatus('Password must be at least 6 characters long.', 'error');
    return;
  }

  LabelApp.Auth.showStatus('Registering operator account...', 'info');

  try {
    await firebase.auth().createUserWithEmailAndPassword(email, password);
  } catch (err) {
    console.error('[LabelApp.Auth] Signup Error:', err);
    LabelApp.Auth.showStatus(LabelApp.Auth.formatErrorMessage(err), 'error');
  }
};

/**
 * Sign Out / Logout
 */
LabelApp.Auth.logout = async function() {
  try {
    if (LabelApp.Auth.state.isConfigured && firebase.auth) {
      await firebase.auth().signOut();
    } else {
      // Dev bypass logout
      LabelApp.Auth.state.isBypassed = false;
      LabelApp.Auth.handleAuthState(null);
    }
  } catch (err) {
    console.error('[LabelApp.Auth] Sign out error:', err);
    alert('Sign out error: ' + err.message);
  }
};

/**
 * Local Developer / Preview Bypass (Enabled when Firebase is not yet configured)
 */
LabelApp.Auth.bypassLocal = function() {
  LabelApp.Auth.state.isBypassed = true;
  const overlay = document.getElementById('authOverlay');
  const wrap = document.querySelector('.wrap');
  const userPill = document.getElementById('authEmailDisplay');
  const statusBar = document.getElementById('authStatusBar');

  if (overlay) overlay.style.display = 'none';
  if (wrap) wrap.classList.remove('app-locked');
  if (userPill) userPill.textContent = 'Local Dev Mode';
  if (statusBar) statusBar.style.display = 'flex';
};

/**
 * UI Message Banner Helpers
 */
LabelApp.Auth.showStatus = function(msg, type) {
  const box = document.getElementById('authStatusBox');
  if (!box) return;
  box.textContent = msg;
  box.className = 'auth-status-box ' + (type || 'info');
  box.style.display = 'block';
};

LabelApp.Auth.clearStatus = function() {
  const box = document.getElementById('authStatusBox');
  if (!box) return;
  box.textContent = '';
  box.style.display = 'none';
};

/**
 * Human-friendly error translation
 */
LabelApp.Auth.formatErrorMessage = function(err) {
  const code = err.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Incorrect email or password. Please verify and try again.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'This email is already registered. Please click "Sign In" instead.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google Sign-In popup was closed before completing.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection failed. Please check your internet.';
  }
  return err.message || 'Authentication error. Please try again.';
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  LabelApp.Auth.init();
});
