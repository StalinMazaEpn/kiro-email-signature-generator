'use strict';

/**
 * Authentication module for admin panel.
 * Uses SHA-256 hash comparison with sessionStorage for session management.
 */
const Auth = (() => {
  const SESSION_KEY = 'admin_authenticated';

  // Default hash for development (password: "admin123")
  // In production, set ADMIN_PASSWORD_HASH env var and inject it into the page
  const DEFAULT_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

  /**
   * Get the expected password hash.
   * Reads from a global config if available, otherwise uses default.
   */
  function getExpectedHash() {
    if (window.ADMIN_CONFIG && window.ADMIN_CONFIG.passwordHash) {
      return window.ADMIN_CONFIG.passwordHash;
    }
    return DEFAULT_HASH;
  }

  /**
   * Hash a string using SHA-256.
   * @param {string} text
   * @returns {Promise<string>} Hex-encoded hash
   */
  async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Attempt to log in with a password.
   * @param {string} password - Plain text password
   * @returns {Promise<boolean>} True if authentication succeeded
   */
  async function login(password) {
    const hash = await sha256(password);
    const expected = getExpectedHash();

    if (hash === expected) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      return true;
    }
    return false;
  }

  /**
   * Log out the current session.
   */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  /**
   * Check if user is currently authenticated.
   * @returns {boolean}
   */
  function isAuthenticated() {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  }

  return { login, logout, isAuthenticated, sha256 };
})();
