import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import type { UserAccount, FolderShare, SystemConfig, UserStatus } from '../types';

// Provided production configuration for J.Jonas Cloud
const firebaseConfig = {
  apiKey: "AIzaSyAXpnLXZQ6-2rDk8QurxWUbI-NcGkrOWls",
  authDomain: "j-jonas-cloud.firebaseapp.com",
  projectId: "j-jonas-cloud",
  storageBucket: "j-jonas-cloud.firebasestorage.app",
  messagingSenderId: "529931933015",
  appId: "1:529931933015:web:4d9d7e9e5b95ff863fda12",
  measurementId: "G-PV4CFHJ394"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

// Client-side SHA-256 with salt helper
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}:j_jonas_cloud_secret_v1`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

// Local storage fallback sync to ensure offline / fallback functionality if Firestore rules block or offline
const LOCAL_USERS_KEY = 'jjcloud_users_store';
const LOCAL_SHARES_KEY = 'jjcloud_shares_store';
const LOCAL_CONFIG_KEY = 'jjcloud_system_config';

function getLocalUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUsers(users: UserAccount[]) {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed saving local users fallback', err);
  }
}

function getLocalShares(): FolderShare[] {
  try {
    const raw = localStorage.getItem(LOCAL_SHARES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalShares(shares: FolderShare[]) {
  try {
    localStorage.setItem(LOCAL_SHARES_KEY, JSON.stringify(shares));
  } catch (err) {
    console.error('Failed saving local shares fallback', err);
  }
}

// ==========================================
// USER AUTHENTICATION & MANAGEMENT
// ==========================================

export async function registerUser(usernameRaw: string, passwordRaw: string): Promise<{
  success: boolean;
  user?: UserAccount;
  error?: string;
  isFirstMaster?: boolean;
}> {
  const username = usernameRaw.trim().toLowerCase();
  if (!username || username.length < 3) {
    return { success: false, error: 'Benutzername muss mindestens 3 Zeichen lang sein.' };
  }
  if (!passwordRaw || passwordRaw.length < 6) {
    return { success: false, error: 'Passwort muss mindestens 6 Zeichen lang sein.' };
  }

  try {
    // 1. Check if user already exists in Firestore
    const userDocRef = doc(db, 'users', username);
    let existingDoc;
    try {
      existingDoc = await getDoc(userDocRef);
    } catch (fsErr) {
      console.warn('Firestore getDoc check error, checking local fallback:', fsErr);
    }

    if (existingDoc && existingDoc.exists()) {
      return { success: false, error: 'Dieser Benutzername ist bereits vergeben.' };
    }

    // Also check local cache
    const localUsers = getLocalUsers();
    if (localUsers.some(u => u.username.toLowerCase() === username)) {
      return { success: false, error: 'Dieser Benutzername ist bereits vergeben.' };
    }

    // 2. Determine if this is the very first user (Master-Account)
    let isMaster = false;
    try {
      const allUsersSnap = await getDocs(collection(db, 'users'));
      isMaster = allUsersSnap.empty;
    } catch {
      isMaster = localUsers.length === 0;
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(passwordRaw, salt);

    const newUser: UserAccount = {
      username,
      passwordHash,
      salt,
      role: isMaster ? 'master' : 'user',
      status: isMaster ? 'active' : 'pending',
      quota_gb: isMaster ? 1000 : 100, // Master gets 1000GB, regular gets 100GB default
      createdAt: new Date().toISOString(),
    };

    // Save to Firestore
    try {
      await setDoc(userDocRef, {
        ...newUser,
        serverTime: serverTimestamp(),
      });
    } catch (fsErr) {
      console.warn('Could not write to Firestore directly, saving to local fallback store:', fsErr);
    }

    // Always keep local store in sync
    localUsers.push(newUser);
    saveLocalUsers(localUsers);

    return {
      success: true,
      user: newUser,
      isFirstMaster: isMaster,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.';
    return { success: false, error: message };
  }
}

export async function loginUser(usernameRaw: string, passwordRaw: string): Promise<{
  success: boolean;
  user?: UserAccount;
  error?: string;
  pendingApproval?: boolean;
}> {
  const username = usernameRaw.trim().toLowerCase();
  if (!username || !passwordRaw) {
    return { success: false, error: 'Bitte Benutzername und Passwort eingeben.' };
  }

  try {
    let userData: UserAccount | null = null;

    // Try Firestore first
    try {
      const userDocRef = doc(db, 'users', username);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        userData = userSnap.data() as UserAccount;
      }
    } catch (fsErr) {
      console.warn('Firestore read error during login, falling back to local store:', fsErr);
    }

    // Fallback to local store if not found in Firestore
    if (!userData) {
      const localUsers = getLocalUsers();
      const found = localUsers.find(u => u.username.toLowerCase() === username);
      if (found) {
        userData = found;
      }
    }

    if (!userData) {
      return { success: false, error: 'Benutzername oder Passwort ist falsch.' };
    }

    // Check password
    const checkHash = await hashPassword(passwordRaw, userData.salt);
    if (checkHash !== userData.passwordHash) {
      return { success: false, error: 'Benutzername oder Passwort ist falsch.' };
    }

    // Check account status
    if (userData.status === 'pending') {
      return {
        success: false,
        pendingApproval: true,
        error: 'Dein Account wartet noch auf Freischaltung durch den Administrator.',
      };
    }

    if (userData.status === 'rejected') {
      return {
        success: false,
        error: 'Dein Account wurde vom Administrator abgelehnt.',
      };
    }

    return {
      success: true,
      user: userData,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login fehlgeschlagen.';
    return { success: false, error: message };
  }
}

/**
 * Ändert das Passwort eines Nutzers nach Validierung des aktuellen Passworts.
 */
export async function changePassword(
  usernameRaw: string,
  currentPasswordRaw: string,
  newPasswordRaw: string
): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
  const username = usernameRaw.trim().toLowerCase();
  if (!currentPasswordRaw) {
    return { success: false, error: 'Bitte gib dein aktuelles Passwort ein.' };
  }
  if (!newPasswordRaw || newPasswordRaw.length < 6) {
    return { success: false, error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.' };
  }

  try {
    let userData: UserAccount | null = null;
    const userDocRef = doc(db, 'users', username);

    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        userData = snap.data() as UserAccount;
      }
    } catch (err) {
      console.warn('Firestore read error during changePassword:', err);
    }

    if (!userData) {
      const localUsers = getLocalUsers();
      userData = localUsers.find(u => u.username.toLowerCase() === username) || null;
    }

    if (!userData) {
      return { success: false, error: 'Benutzerkonto nicht gefunden.' };
    }

    // Verify current password
    const currentHash = await hashPassword(currentPasswordRaw, userData.salt);
    if (currentHash !== userData.passwordHash) {
      return { success: false, error: 'Das aktuelle Passwort ist nicht korrekt.' };
    }

    // Generate new salt and new hash
    const newSalt = generateSalt();
    const newHash = await hashPassword(newPasswordRaw, newSalt);

    const updatedUser: UserAccount = {
      ...userData,
      salt: newSalt,
      passwordHash: newHash,
    };

    try {
      await updateDoc(userDocRef, {
        salt: newSalt,
        passwordHash: newHash,
      });
    } catch (err) {
      console.warn('Firestore update password error, updating local:', err);
    }

    // Update local cache
    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.username.toLowerCase() === username);
    if (idx !== -1) {
      localUsers[idx] = updatedUser;
      saveLocalUsers(localUsers);
    }

    return { success: true, user: updatedUser };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Passwortänderung fehlgeschlagen.';
    return { success: false, error: msg };
  }
}

/**
 * Ändert den Benutzernamen eines Nutzers, prüft ob frei und aktualisiert Firestore.
 */
export async function changeUsername(
  oldUsernameRaw: string,
  newUsernameRaw: string
): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
  const oldUsername = oldUsernameRaw.trim().toLowerCase();
  const newUsername = newUsernameRaw.trim().toLowerCase();

  if (oldUsername === newUsername) {
    return { success: false, error: 'Der neue Benutzername ist identisch mit dem aktuellen.' };
  }
  if (!newUsername || newUsername.length < 3) {
    return { success: false, error: 'Der neue Benutzername muss mindestens 3 Zeichen lang sein.' };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(newUsername)) {
    return { success: false, error: 'Der Benutzername darf nur Buchstaben, Zahlen, Punkte, Binde- und Unterstriche enthalten.' };
  }

  try {
    // Check if new username is taken in Firestore
    const newDocRef = doc(db, 'users', newUsername);
    let newDocSnap;
    try {
      newDocSnap = await getDoc(newDocRef);
    } catch {}

    if (newDocSnap && newDocSnap.exists()) {
      return { success: false, error: `Der Benutzername "${newUsername}" ist bereits vergeben.` };
    }

    // Also check local cache
    const localUsers = getLocalUsers();
    if (localUsers.some(u => u.username.toLowerCase() === newUsername)) {
      return { success: false, error: `Der Benutzername "${newUsername}" ist bereits vergeben.` };
    }

    // Get current user doc
    const oldDocRef = doc(db, 'users', oldUsername);
    let userData: UserAccount | null = null;
    try {
      const snap = await getDoc(oldDocRef);
      if (snap.exists()) {
        userData = snap.data() as UserAccount;
      }
    } catch {}

    if (!userData) {
      userData = localUsers.find(u => u.username.toLowerCase() === oldUsername) || null;
    }

    if (!userData) {
      return { success: false, error: 'Benutzerkonto nicht gefunden.' };
    }

    const updatedUser: UserAccount = {
      ...userData,
      username: newUsername,
    };

    // Save under new doc ID and delete old doc ID
    try {
      await setDoc(newDocRef, updatedUser);
      await deleteDoc(oldDocRef);
    } catch (err) {
      console.warn('Firestore changeUsername error, updating local:', err);
    }

    // Update in local store
    const idx = localUsers.findIndex(u => u.username.toLowerCase() === oldUsername);
    if (idx !== -1) {
      localUsers[idx] = updatedUser;
    } else {
      localUsers.push(updatedUser);
    }
    saveLocalUsers(localUsers);

    // Update any shares
    try {
      const localShares = getLocalShares();
      let sharesChanged = false;
      localShares.forEach(s => {
        if (s.owner.toLowerCase() === oldUsername) {
          s.owner = newUsername;
          sharesChanged = true;
        }
        if (s.invited_user.toLowerCase() === oldUsername) {
          s.invited_user = newUsername;
          sharesChanged = true;
        }
      });
      if (sharesChanged) saveLocalShares(localShares);
    } catch {}

    return { success: true, user: updatedUser };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Namensänderung fehlgeschlagen.';
    return { success: false, error: msg };
  }
}

export async function getAllUsers(): Promise<UserAccount[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    if (!snap.empty) {
      const users = snap.docs.map(d => d.data() as UserAccount);
      saveLocalUsers(users);
      return users;
    }
  } catch (fsErr) {
    console.warn('Firestore read all users error:', fsErr);
  }
  return getLocalUsers();
}

export async function updateUserStatus(username: string, status: UserStatus, quota_gb = 100): Promise<boolean> {
  try {
    const userDocRef = doc(db, 'users', username);
    await updateDoc(userDocRef, { status, quota_gb });
  } catch (err) {
    console.warn('Firestore update status failed, updating local:', err);
  }

  const localUsers = getLocalUsers();
  const index = localUsers.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  if (index !== -1) {
    localUsers[index].status = status;
    localUsers[index].quota_gb = quota_gb;
    saveLocalUsers(localUsers);
  }
  return true;
}

export async function updateUserQuota(username: string, quota_gb: number): Promise<boolean> {
  try {
    const userDocRef = doc(db, 'users', username);
    await updateDoc(userDocRef, { quota_gb });
  } catch (err) {
    console.warn('Firestore update quota failed, updating local:', err);
  }

  const localUsers = getLocalUsers();
  const index = localUsers.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  if (index !== -1) {
    localUsers[index].quota_gb = quota_gb;
    saveLocalUsers(localUsers);
  }
  return true;
}

export async function deleteUser(username: string): Promise<boolean> {
  const normUser = username.toLowerCase();
  try {
    const userDocRef = doc(db, 'users', normUser);
    await deleteDoc(userDocRef);
  } catch (err) {
    console.warn('Firestore delete user failed:', err);
  }

  const localUsers = getLocalUsers().filter(u => u.username.toLowerCase() !== normUser);
  saveLocalUsers(localUsers);

  // Clean up shares
  try {
    const localShares = getLocalShares().filter(
      s => s.owner.toLowerCase() !== normUser && s.invited_user.toLowerCase() !== normUser
    );
    saveLocalShares(localShares);
  } catch {}

  return true;
}

// ==========================================
// SYSTEM CONFIGURATION & MAINTENANCE MODE
// ==========================================

export async function getMaintenanceMode(): Promise<boolean> {
  try {
    const configDocRef = doc(db, 'system', 'config');
    const snap = await getDoc(configDocRef);
    if (snap.exists()) {
      return Boolean(snap.data()?.maintenance);
    }
  } catch (err) {
    console.warn('Firestore config read error:', err);
  }
  try {
    const local = localStorage.getItem(LOCAL_CONFIG_KEY);
    return local ? JSON.parse(local).maintenance : false;
  } catch {
    return false;
  }
}

export async function setMaintenanceMode(maintenance: boolean): Promise<boolean> {
  try {
    const configDocRef = doc(db, 'system', 'config');
    await setDoc(configDocRef, {
      maintenance,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore set maintenance failed:', err);
  }
  try {
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify({ maintenance, updatedAt: new Date().toISOString() }));
  } catch {}
  return true;
}

export function subscribeMaintenanceMode(callback: (maintenance: boolean) => void): () => void {
  try {
    const configDocRef = doc(db, 'system', 'config');
    const unsubscribe = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        callback(Boolean(snap.data()?.maintenance));
      } else {
        getMaintenanceMode().then(callback);
      }
    }, (error) => {
      console.warn('Maintenance subscription error, using polling fallback:', error);
      getMaintenanceMode().then(callback);
    });
    return unsubscribe;
  } catch {
    getMaintenanceMode().then(callback);
    return () => {};
  }
}

// ==========================================
// SHARED FOLDERS WORKFLOW
// ==========================================

export async function createFolderShare(
  folder_path: string,
  folder_name: string,
  owner: string,
  invited_user_raw: string
): Promise<{ success: boolean; error?: string; share?: FolderShare }> {
  const invited_user = invited_user_raw.trim().toLowerCase();

  if (invited_user === owner.toLowerCase()) {
    return { success: false, error: 'Du kannst einen Ordner nicht mit dir selbst teilen.' };
  }

  // Check if target user exists and is active
  let userExists = false;
  let userActive = false;

  try {
    const userDocRef = doc(db, 'users', invited_user);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      userExists = true;
      userActive = (snap.data() as UserAccount).status === 'active';
    }
  } catch {
    // fallback check
    const localUsers = getLocalUsers();
    const found = localUsers.find(u => u.username.toLowerCase() === invited_user);
    if (found) {
      userExists = true;
      userActive = found.status === 'active';
    }
  }

  if (!userExists) {
    return { success: false, error: `Benutzer "${invited_user}" wurde nicht gefunden.` };
  }
  if (!userActive) {
    return { success: false, error: `Benutzer "${invited_user}" ist noch nicht aktiv freigeschaltet.` };
  }

  const shareId = `${owner}_${invited_user}_${encodeURIComponent(folder_path)}_${Date.now()}`;
  const share: FolderShare = {
    id: shareId,
    folder_path,
    folder_name,
    owner,
    invited_user,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  try {
    const shareDocRef = doc(db, 'shares', shareId);
    await setDoc(shareDocRef, share);
  } catch (err) {
    console.warn('Firestore share write failed, using local store:', err);
  }

  const localShares = getLocalShares();
  localShares.push(share);
  saveLocalShares(localShares);

  return { success: true, share };
}

export async function getSharesForInvitedUser(username: string): Promise<FolderShare[]> {
  const normalized = username.toLowerCase();
  try {
    const q = query(collection(db, 'shares'), where('invited_user', '==', normalized));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as FolderShare));
    }
  } catch (err) {
    console.warn('Firestore get shares for user error:', err);
  }

  return getLocalShares().filter(s => s.invited_user.toLowerCase() === normalized);
}

export async function getSharesByOwner(username: string): Promise<FolderShare[]> {
  const normalized = username.toLowerCase();
  try {
    const q = query(collection(db, 'shares'), where('owner', '==', normalized));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as FolderShare));
    }
  } catch (err) {
    console.warn('Firestore get shares by owner error:', err);
  }

  return getLocalShares().filter(s => s.owner.toLowerCase() === normalized);
}

export async function respondToShare(shareId: string, status: 'accepted' | 'declined'): Promise<boolean> {
  try {
    const shareDocRef = doc(db, 'shares', shareId);
    if (status === 'declined') {
      await deleteDoc(shareDocRef);
    } else {
      await updateDoc(shareDocRef, { status });
    }
  } catch (err) {
    console.warn('Firestore respond to share error:', err);
  }

  const localShares = getLocalShares();
  const index = localShares.findIndex(s => s.id === shareId);
  if (index !== -1) {
    if (status === 'declined') {
      localShares.splice(index, 1);
    } else {
      localShares[index].status = status;
    }
    saveLocalShares(localShares);
  }
  return true;
}
