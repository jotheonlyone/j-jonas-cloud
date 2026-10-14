import type { UserAccount } from '../types';

export const CURRENT_USER_KEY = 'jjcloud_session_user';
export const SAVED_ACCOUNTS_KEY = 'jjcloud_saved_accounts';

/**
 * Returns all saved accounts from localStorage.
 * Automatically migrates existing single-session user if needed.
 */
export function getSavedAccounts(): UserAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    let accounts: UserAccount[] = raw ? JSON.parse(raw) : [];

    // Fallback/Migration: If saved_accounts is empty but CURRENT_USER_KEY exists
    if (!Array.isArray(accounts) || accounts.length === 0) {
      const activeRaw = localStorage.getItem(CURRENT_USER_KEY);
      if (activeRaw) {
        try {
          const activeUser: UserAccount = JSON.parse(activeRaw);
          if (activeUser && activeUser.username) {
            accounts = [activeUser];
            localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
          }
        } catch {}
      }
    }

    return Array.isArray(accounts) ? accounts : [];
  } catch (err) {
    console.warn('Failed to parse saved accounts:', err);
    return [];
  }
}

/**
 * Saves all accounts to localStorage.
 */
export function persistSavedAccounts(accounts: UserAccount[]): void {
  try {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.warn('Failed to persist saved accounts:', err);
  }
}

/**
 * Retrieves the currently active user, or falls back to the first saved account.
 */
export function getActiveUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (raw) {
      const user: UserAccount = JSON.parse(raw);
      if (user && user.username) {
        return user;
      }
    }
  } catch {}

  // Fallback to first saved account
  const saved = getSavedAccounts();
  if (saved.length > 0) {
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(saved[0]));
    } catch {}
    return saved[0];
  }

  return null;
}

/**
 * Adds or updates an account and sets it as the active session.
 */
export function saveAndActivateAccount(user: UserAccount): UserAccount[] {
  const accounts = getSavedAccounts();
  const normTarget = user.username.toLowerCase();
  const existingIdx = accounts.findIndex((a) => a.username.toLowerCase() === normTarget);

  if (existingIdx !== -1) {
    // Update existing
    accounts[existingIdx] = user;
  } else {
    // Append new
    accounts.push(user);
  }

  persistSavedAccounts(accounts);
  try {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } catch {}

  return accounts;
}

/**
 * Switches the active session to a saved account.
 */
export function switchActiveAccount(username: string): UserAccount | null {
  const accounts = getSavedAccounts();
  const found = accounts.find((a) => a.username.toLowerCase() === username.toLowerCase());

  if (found) {
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(found));
    } catch {}
    return found;
  }

  return null;
}

/**
 * Removes ONLY the active account from saved accounts.
 * Switches to the next available account if one exists, otherwise logs out.
 */
export function logoutCurrentAccount(currentUsername: string): {
  remainingAccounts: UserAccount[];
  nextUser: UserAccount | null;
} {
  const accounts = getSavedAccounts();
  const remaining = accounts.filter(
    (a) => a.username.toLowerCase() !== currentUsername.toLowerCase()
  );

  persistSavedAccounts(remaining);

  if (remaining.length > 0) {
    const nextUser = remaining[0];
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(nextUser));
    } catch {}
    return { remainingAccounts: remaining, nextUser };
  } else {
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
    } catch {}
    return { remainingAccounts: [], nextUser: null };
  }
}

/**
 * Removes all saved accounts and clears active session.
 */
export function logoutAllAccounts(): void {
  try {
    localStorage.removeItem(SAVED_ACCOUNTS_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
  } catch {}
}
