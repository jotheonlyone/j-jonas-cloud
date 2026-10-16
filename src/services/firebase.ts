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
import type { UserAccount, FolderShare, SharedMember, SystemConfig, UserStatus } from '../types';

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

export function normalizeShareDoc(data: any): FolderShare {
  if (!data || typeof data !== 'object') {
    return {
      id: `invalid_${Math.random().toString(36).slice(2)}`,
      folder_path: '',
      folder_name: 'Unbekannter Ordner',
      owner: '',
      shared_with: [],
      created_at: new Date().toISOString()
    };
  }

  const owner = (data.owner ? String(data.owner) : '').trim().toLowerCase();
  const folder_path = data.folder_path ? String(data.folder_path) : '';
  const folder_name = data.folder_name || (folder_path ? folder_path.split('/').pop() : '') || 'Ordner';
  const id = data.id || `${owner || 'unknown'}__${encodeURIComponent(folder_path || 'unknown')}`;

  let shared_with: SharedMember[] = Array.isArray(data.shared_with) ? [...data.shared_with] : [];

  // Migration from legacy invited_user if present and not yet in shared_with
  // Guarded: data.invited_user?.toLowerCase() and skip if absent/empty
  const rawInvited = (typeof data?.invited_user === 'string' ? data.invited_user : '')?.trim()?.toLowerCase() || '';
  if (rawInvited) {
    if (!shared_with.some(m => m?.username && m.username.toLowerCase() === rawInvited)) {
      const invStatus = (data.status === 'accepted' || data.status === 'active') ? 'accepted' : (data.status || 'pending');
      shared_with.push({
        username: rawInvited,
        status: invStatus,
        can_see_members: data.can_see_members ?? true,
        can_manage_members: data.can_manage_members ?? false,
        added_at: data.created_at || new Date().toISOString()
      });
    }
  }

  // Deduplicate and sanitize members: skip any incomplete entries without a valid username
  const memberMap = new Map<string, SharedMember>();
  for (const m of shared_with) {
    const u = (m && typeof m.username === 'string' ? m.username : '')?.trim()?.toLowerCase() || '';
    if (u && !memberMap.has(u)) {
      const can_see_members = m.can_see_members ?? true;
      const can_manage_members = can_see_members ? (m.can_manage_members ?? false) : false;
      // Normalize 'active' or 'accepted' to 'accepted'
      let memberStatus: 'pending' | 'accepted' | 'declined' = 'pending';
      const rawStatus = m.status || (data.status && (data.invited_user?.toLowerCase() === u || shared_with.length === 1) ? data.status : 'pending');
      if (rawStatus === 'accepted' || rawStatus === 'active') {
        memberStatus = 'accepted';
      } else if (rawStatus === 'declined') {
        memberStatus = 'declined';
      }

      memberMap.set(u, {
        username: u,
        status: memberStatus,
        can_see_members,
        can_manage_members,
        added_at: m.added_at || new Date().toISOString()
      });
    }
  }

  const finalMembers = Array.from(memberMap.values());
  const rootStatus = data.status === 'active' || data.status === 'accepted'
    ? 'accepted'
    : (data.status === 'declined' ? 'declined' : (finalMembers.some(m => m.status === 'accepted') ? 'accepted' : 'pending'));

  return {
    id,
    folder_path,
    folder_name,
    owner,
    shared_with: finalMembers,
    invited_user: rawInvited || undefined,
    status: rootStatus,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || data.created_at || new Date().toISOString(),
  };
}

export function consolidateFolderShares(shares: any[]): FolderShare[] {
  const map = new Map<string, FolderShare>();
  for (const raw of (shares || [])) {
    if (!raw) continue;
    try {
      const normalized = normalizeShareDoc(raw);
      if (!normalized || !normalized.id) continue;
      const normalizePath = (p: string) => (p || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
      const key = `${(normalized.owner || '').toLowerCase()}::${normalizePath(normalized.folder_path || '')}`;
      if (!map.has(key)) {
        map.set(key, normalized);
      } else {
        const existing = map.get(key)!;
        const incomingTime = new Date(normalized.updated_at || normalized.created_at || 0).getTime();
        const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
        const incomingIsNewer = incomingTime >= existingTime;

        if (incomingIsNewer) {
          // Incoming from server or fresh update is newer: prioritize incoming
          for (const oldM of existing.shared_with) {
            if (oldM?.username && !normalized.shared_with.some(nm => nm?.username?.toLowerCase() === oldM.username.toLowerCase())) {
              normalized.shared_with.push(oldM);
            }
          }
          map.set(key, normalized);
        } else {
          // Existing is newer, but merge any accepted statuses
          for (const m of normalized.shared_with) {
            if (!m || !m.username) continue;
            const found = existing.shared_with.find(em => em && em.username?.toLowerCase() === m.username.toLowerCase());
            if (!found) {
              existing.shared_with.push(m);
            } else {
              if (m.status === 'accepted') found.status = 'accepted';
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error consolidating share item, skipping corrupt entry:', err);
    }
  }
  return Array.from(map.values());
}

function getLocalShares(): FolderShare[] {
  try {
    const raw = localStorage.getItem(LOCAL_SHARES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return consolidateFolderShares(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function saveLocalShares(shares: FolderShare[]) {
  try {
    const consolidated = consolidateFolderShares(shares);
    localStorage.setItem(LOCAL_SHARES_KEY, JSON.stringify(consolidated));
  } catch (err) {
    console.error('Failed saving local shares fallback', err);
  }
}

function updateLocalShare(share: FolderShare) {
  try {
    const local = getLocalShares();
    const normalizePath = (p: string) => (p || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
    const key = `${share.owner.toLowerCase()}::${normalizePath(share.folder_path)}`;
    const idx = local.findIndex(s => s && `${s.owner.toLowerCase()}::${normalizePath(s.folder_path)}` === key);
    if (idx !== -1) {
      local[idx] = share;
    } else {
      local.push(share);
    }
    // Directly save without letting older timestamp re-overwrite
    localStorage.setItem(LOCAL_SHARES_KEY, JSON.stringify(local));
  } catch (err) {
    console.warn('Failed to update local share cache:', err);
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
        s.shared_with?.forEach(m => {
          if (m.username.toLowerCase() === oldUsername) {
            m.username = newUsername;
            sharesChanged = true;
          }
        });
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
    const localShares = getLocalShares()
      .filter(s => s.owner.toLowerCase() !== normUser)
      .map(s => {
        s.shared_with = s.shared_with.filter(m => m.username.toLowerCase() !== normUser);
        return s;
      })
      .filter(s => s.shared_with.length > 0);
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

export function getSharedFolderDocId(owner: string, folder_path: string): string {
  const cleanPath = (folder_path || '').trim().replace(/^\/+|\/+$/g, '');
  return `${owner.trim().toLowerCase()}__${encodeURIComponent(cleanPath)}`;
}

export async function createFolderShare(
  folder_path: string,
  folder_name: string,
  ownerRaw: string,
  invited_user_raw: string,
  permissions?: { can_see_members?: boolean; can_manage_members?: boolean }
): Promise<{ success: boolean; error?: string; share?: FolderShare }> {
  const owner = ownerRaw.trim().toLowerCase();
  const invited_user = invited_user_raw.trim().toLowerCase();

  if (invited_user === owner) {
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

  const shareDocId = getSharedFolderDocId(owner, folder_path);

  // Enforce permission rules: can_manage_members requires can_see_members!
  const can_see_members = permissions?.can_see_members ?? true;
  const can_manage_members = can_see_members ? (permissions?.can_manage_members ?? false) : false;

  const newMember: SharedMember = {
    username: invited_user,
    status: 'pending',
    can_see_members,
    can_manage_members,
    added_at: new Date().toISOString(),
  };

  // Check existing shared folder in local store or Firestore
  let existingShare: FolderShare | null = null;
  const localShares = getLocalShares();
  const localIdx = localShares.findIndex(
    s => s.owner.toLowerCase() === owner && s.folder_path === folder_path
  );
  if (localIdx !== -1) {
    existingShare = localShares[localIdx];
  }

  if (!existingShare) {
    try {
      const shareDocRef = doc(db, 'shares', shareDocId);
      const snap = await getDoc(shareDocRef);
      if (snap.exists()) {
        existingShare = normalizeShareDoc({ ...snap.data(), id: snap.id });
      }
    } catch (err) {
      console.warn('Firestore check existing share doc error:', err);
    }
  }

  let finalShare: FolderShare;

  if (existingShare) {
    // Check if user is already invited or has access
    const existingMemberIdx = existingShare.shared_with.findIndex(
      m => m && m.username && m.username.toLowerCase() === invited_user
    );

    if (existingMemberIdx !== -1) {
      return {
        success: false,
        error: `@${invited_user} ist bereits für diesen Ordner freigegeben oder eingeladen.`,
      };
    }

    existingShare.shared_with.push(newMember);
    existingShare.folder_name = folder_name || existingShare.folder_name;
    existingShare.updated_at = new Date().toISOString();
    finalShare = existingShare;
  } else {
    finalShare = {
      id: shareDocId,
      folder_path,
      folder_name,
      owner,
      shared_with: [newMember],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Save to Firestore with shared_users array for indexing
  try {
    const shareDocRef = doc(db, 'shares', shareDocId);
    await setDoc(shareDocRef, {
      ...finalShare,
      shared_users: finalShare.shared_with.filter(m => m && m.username).map(m => m.username.toLowerCase()),
    });
  } catch (err) {
    console.warn('Firestore share write failed, using local store:', err);
  }

  // Update local store
  if (localIdx !== -1) {
    localShares[localIdx] = finalShare;
  } else {
    localShares.push(finalShare);
  }
  saveLocalShares(localShares);

  return { success: true, share: finalShare };
}


export async function updateMemberPermissions(
  folder_path: string,
  ownerRaw: string,
  targetUsernameRaw: string,
  permissions: { can_see_members: boolean; can_manage_members: boolean }
): Promise<{ success: boolean; error?: string; share?: FolderShare }> {
  const owner = ownerRaw.trim().toLowerCase();
  const targetUsername = targetUsernameRaw.trim().toLowerCase();
  const normalizePath = (p: string) => (p || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  const normalizedFolderPath = normalizePath(folder_path);
  const calculatedDocId = getSharedFolderDocId(owner, folder_path);

  // WICHTIGE ABHÄNGIGKEIT: Schalter 2 kann NUR aktiviert werden, wenn Schalter 1 aktiv ist!
  // Wird Schalter 1 deaktiviert, schaltet sich Schalter 2 automatisch mit aus.
  const can_see_members = Boolean(permissions.can_see_members);
  const can_manage_members = can_see_members ? Boolean(permissions.can_manage_members) : false;

  let currentShare: FolderShare | null = null;
  let targetDocId = calculatedDocId;

  // 1. Fetch the freshest share document from Firestore first
  try {
    const snap = await getDoc(doc(db, 'shares', calculatedDocId));
    if (snap.exists()) {
      currentShare = normalizeShareDoc({ ...snap.data(), id: snap.id });
      targetDocId = snap.id;
    } else {
      const q = query(collection(db, 'shares'), where('owner', '==', owner));
      const qSnap = await getDocs(q);
      for (const d of qSnap.docs) {
        const dData = d.data();
        if (normalizePath(dData.folder_path || '') === normalizedFolderPath) {
          currentShare = normalizeShareDoc({ ...dData, id: d.id });
          targetDocId = d.id;
          break;
        }
      }
    }
  } catch (err) {
    console.warn('Firestore get share doc error:', err);
  }

  // Fallback to local store if Firestore did not return the share
  if (!currentShare) {
    const localShares = getLocalShares();
    currentShare = localShares.find(
      s => s.owner.toLowerCase() === owner && normalizePath(s.folder_path) === normalizedFolderPath
    ) || null;
  }

  if (!currentShare) {
    return { success: false, error: 'Geteilter Ordner wurde nicht gefunden.' };
  }

  const member = currentShare.shared_with.find(m => m && m.username && m.username.toLowerCase() === targetUsername);
  if (!member) {
    return { success: false, error: `Mitglied @${targetUsername} wurde in diesem Ordner nicht gefunden.` };
  }

  member.can_see_members = can_see_members;
  member.can_manage_members = can_manage_members;
  currentShare.updated_at = new Date().toISOString();

  // 2. Persist immediately to Firestore
  try {
    const shareDocRef = doc(db, 'shares', targetDocId);
    await setDoc(shareDocRef, {
      ...currentShare,
      shared_users: currentShare.shared_with.filter(m => m && m.username).map(m => m.username.toLowerCase()),
      updated_at: currentShare.updated_at,
    }, { merge: true });

    if (targetDocId !== calculatedDocId) {
      try {
        await setDoc(doc(db, 'shares', calculatedDocId), {
          ...currentShare,
          shared_users: currentShare.shared_with.filter(m => m && m.username).map(m => m.username.toLowerCase()),
          updated_at: currentShare.updated_at,
        }, { merge: true });
      } catch {}
    }
  } catch (err) {
    console.warn('Firestore update member permissions error:', err);
  }

  // 3. Persist to local store
  updateLocalShare(currentShare);

  // 4. Also notify backend API (PATCH /api/shares/permissions) if in browser
  if (typeof window !== 'undefined') {
    try {
      fetch('/api/shares/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: folder_path,
          owner,
          username: targetUsername,
          permissions: { can_see_members, can_manage_members },
        }),
      }).catch((apiErr) => {
        console.warn('Backend API permissions sync warning (non-fatal):', apiErr);
      });
    } catch {}
  }

  return { success: true, share: currentShare };
}

export async function deleteFolderShareMember(
  folder_path: string,
  ownerRaw: string,
  targetUsernameRaw: string,
  shareId?: string
): Promise<boolean> {
  const owner = ownerRaw.trim().toLowerCase();
  const targetUsername = targetUsernameRaw.trim().toLowerCase();
  const normalizePath = (p: string) => (p || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  const normalizedFolderPath = normalizePath(folder_path);
  const calculatedDocId = getSharedFolderDocId(owner, folder_path);

  const localShares = getLocalShares();
  let currentShare: FolderShare | null = null;
  let targetDocId = shareId || calculatedDocId;

  // 1. Check local shares by ID first, then by owner/folder_path
  if (shareId) {
    currentShare = localShares.find(s => s.id === shareId) || null;
  }
  if (!currentShare) {
    currentShare = localShares.find(
      s => s.owner.toLowerCase() === owner && normalizePath(s.folder_path) === normalizedFolderPath
    ) || null;
  }
  if (!currentShare) {
    currentShare = localShares.find(s => s.id === calculatedDocId) || null;
  }

  // 2. Check Firestore by shareId
  if (shareId) {
    try {
      const snap = await getDoc(doc(db, 'shares', shareId));
      if (snap.exists()) {
        currentShare = normalizeShareDoc({ ...snap.data(), id: snap.id });
        targetDocId = snap.id;
      }
    } catch (err) {
      console.warn('Firestore fetch share by shareId error:', err);
    }
  }

  // 3. Check Firestore by calculatedDocId if not found yet
  if (!currentShare) {
    try {
      const snap = await getDoc(doc(db, 'shares', calculatedDocId));
      if (snap.exists()) {
        currentShare = normalizeShareDoc({ ...snap.data(), id: snap.id });
        targetDocId = snap.id;
      }
    } catch (err) {
      console.warn('Firestore fetch share by calculatedDocId error:', err);
    }
  }

  // 4. Query Firestore if still not found
  if (!currentShare) {
    try {
      const q = query(
        collection(db, 'shares'),
        where('owner', '==', owner)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const data = d.data();
        if (normalizePath(data.folder_path || '') === normalizedFolderPath) {
          currentShare = normalizeShareDoc({ ...data, id: d.id });
          targetDocId = d.id;
          break;
        }
      }
    } catch (err) {
      console.warn('Firestore query share doc error:', err);
    }
  }

  // If share was found, remove the target user
  if (currentShare) {
    currentShare.shared_with = (currentShare.shared_with || []).filter(
      m => m && m.username && m.username.toLowerCase() !== targetUsername
    );
    currentShare.updated_at = new Date().toISOString();

    if (currentShare.shared_with.length === 0) {
      // If no members remain, delete document
      try {
        await deleteDoc(doc(db, 'shares', targetDocId));
      } catch (err) {
        console.warn('Firestore delete empty share doc error:', err);
      }
      if (targetDocId !== calculatedDocId) {
        try {
          await deleteDoc(doc(db, 'shares', calculatedDocId));
        } catch {}
      }
    } else {
      // Update with new members and shared_users
      try {
        const updatedDocData: any = {
          ...currentShare,
          shared_users: currentShare.shared_with.filter(m => m && m.username).map(m => m.username.toLowerCase()),
        };
        // Clean legacy invited_user if it matched target
        if (currentShare.invited_user && currentShare.invited_user?.toLowerCase() === targetUsername) {
          delete updatedDocData.invited_user;
        }
        await setDoc(doc(db, 'shares', targetDocId), updatedDocData, { merge: true });
      } catch (err) {
        console.warn('Firestore update share after member delete error:', err);
      }
    }
  } else if (shareId) {
    // Attempt direct delete or doc update by shareId anyway
    try {
      const snap = await getDoc(doc(db, 'shares', shareId));
      if (snap.exists()) {
        const data = snap.data();
        const members = (data.shared_with || []).filter(
          (m: any) => m && (m.username || '').toLowerCase() !== targetUsername
        );
        if (members.length === 0) {
          await deleteDoc(doc(db, 'shares', shareId));
        } else {
          await setDoc(doc(db, 'shares', shareId), {
            ...data,
            shared_with: members,
            shared_users: members.map((m: any) => (m.username || '').toLowerCase()),
            updated_at: new Date().toISOString(),
          }, { merge: true });
        }
      }
    } catch {}
  }

  // 5. Clean up any legacy or duplicate documents matching invited_user == targetUsername
  try {
    const legacyQ = query(
      collection(db, 'shares'),
      where('invited_user', '==', targetUsername)
    );
    const legacySnap = await getDocs(legacyQ);
    for (const d of legacySnap.docs) {
      const dData = d.data();
      if (
        (shareId && d.id === shareId) ||
        (dData.owner && dData.owner.toLowerCase() === owner && normalizePath(dData.folder_path || '') === normalizedFolderPath)
      ) {
        await deleteDoc(d.ref);
      }
    }
  } catch {}

  // 6. Synchronize local store: remove user from any matching shares
  const updatedLocal = localShares
    .map(s => {
      if (!s) return null;
      const matchId = (shareId && s.id === shareId) || s.id === targetDocId || s.id === calculatedDocId;
      const matchOwnerAndPath =
        (s.owner?.toLowerCase() || '') === owner && normalizePath(s.folder_path) === normalizedFolderPath;
      if (matchId || matchOwnerAndPath) {
        s.shared_with = (s.shared_with || []).filter(
          m => m && m.username && m.username.toLowerCase() !== targetUsername
        );
        if (s.invited_user && s.invited_user?.toLowerCase() === targetUsername) {
          delete s.invited_user;
        }
        s.updated_at = new Date().toISOString();
      }
      return s;
    })
    .filter(Boolean) as FolderShare[];

  saveLocalShares(updatedLocal);
  return true;
}

export async function leaveSharedFolder(
  shareId: string,
  folder_path: string,
  owner: string,
  username: string
): Promise<boolean> {
  return deleteFolderShareMember(folder_path, owner, username, shareId);
}

export async function deleteFolderShare(
  shareIdOrPath: string,
  owner?: string,
  targetUsername?: string
): Promise<boolean> {
  if (owner && targetUsername) {
    return deleteFolderShareMember(shareIdOrPath, owner, targetUsername, shareIdOrPath);
  }

  // Deletion by shareId
  try {
    const shareDocRef = doc(db, 'shares', shareIdOrPath);
    await deleteDoc(shareDocRef);
  } catch (err) {
    console.warn('Firestore delete share error:', err);
  }

  // Also try deleting by folder_path query
  try {
    const q = query(collection(db, 'shares'), where('folder_path', '==', shareIdOrPath));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  } catch {}

  const localShares = getLocalShares();
  const remaining = localShares.filter(
    s => s && s.id !== shareIdOrPath && s.folder_path !== shareIdOrPath
  );
  saveLocalShares(remaining);
  return true;
}

export async function renameSharedFolder(
  shareId: string,
  newFolderName: string,
  newFolderPath?: string
): Promise<boolean> {
  const localShares = getLocalShares();
  const index = localShares.findIndex(s => s.id === shareId);
  let share = index !== -1 ? localShares[index] : null;

  if (!share) {
    try {
      const snap = await getDoc(doc(db, 'shares', shareId));
      if (snap.exists()) {
        share = normalizeShareDoc({ ...snap.data(), id: snap.id });
      }
    } catch (err) {
      console.warn('Firestore fetch share for rename error:', err);
    }
  }

  if (!share) return false;

  share.folder_name = newFolderName;
  if (newFolderPath) {
    share.folder_path = newFolderPath;
  }
  share.updated_at = new Date().toISOString();

  try {
    const shareDocRef = doc(db, 'shares', shareId);
    await setDoc(shareDocRef, {
      ...share,
      shared_users: share.shared_with.map(m => m.username.toLowerCase()),
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore rename share error:', err);
  }

  if (index !== -1) {
    localShares[index] = share;
  } else {
    localShares.push(share);
  }
  saveLocalShares(localShares);
  return true;
}

export async function respondToShare(
  shareId: string,
  status: 'accepted' | 'declined',
  usernameRaw?: string
): Promise<boolean> {
  const targetUser = (usernameRaw || '').trim().toLowerCase();
  const normalizePath = (p: string) => (p || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  let currentShare: FolderShare | null = null;
  let targetDocId = shareId;

  // 1. Fetch document directly from Firestore by shareId
  try {
    const snap = await getDoc(doc(db, 'shares', shareId));
    if (snap.exists()) {
      currentShare = normalizeShareDoc({ ...snap.data(), id: snap.id });
      targetDocId = snap.id;
    }
  } catch (err) {
    console.warn('Firestore get share to respond error:', err);
  }

  // 2. If shareId has owner__path format, try fetching by normalized calculated doc id
  if (!currentShare && shareId.includes('__')) {
    const [ownerPart, ...pathParts] = shareId.split('__');
    const rawPath = pathParts.join('__');
    let decodedPath = rawPath;
    try { decodedPath = decodeURIComponent(rawPath); } catch {}
    const calcId = getSharedFolderDocId(ownerPart, decodedPath);
    if (calcId !== shareId) {
      try {
        const snap = await getDoc(doc(db, 'shares', calcId));
        if (snap.exists()) {
          currentShare = normalizeShareDoc({ ...snap.data(), id: snap.id });
          targetDocId = snap.id;
        }
      } catch {}
    }
  }

  // 3. Search Firestore by query (shared_users array-contains targetUser)
  if (!currentShare && targetUser) {
    try {
      const q = query(collection(db, 'shares'), where('shared_users', 'array-contains', targetUser));
      const qSnap = await getDocs(q);
      for (const d of qSnap.docs) {
        const dData = d.data();
        if (
          d.id === shareId ||
          (shareId.includes('__') && d.id.toLowerCase().includes(shareId.toLowerCase()))
        ) {
          currentShare = normalizeShareDoc({ ...dData, id: d.id });
          targetDocId = d.id;
          break;
        }
      }
    } catch {}
  }

  // 4. Fallback to local shares if Firestore fetch failed or offline
  if (!currentShare) {
    const localShares = getLocalShares();
    currentShare = localShares.find(s => s.id === shareId) || null;
    if (!currentShare && shareId.includes('__')) {
      const [ownerPart, ...pathParts] = shareId.split('__');
      const rawPath = pathParts.join('__');
      let decodedPath = rawPath;
      try { decodedPath = decodeURIComponent(rawPath); } catch {}
      currentShare = localShares.find(
        s => (s.owner || '').toLowerCase() === ownerPart.toLowerCase() &&
             normalizePath(s.folder_path) === normalizePath(decodedPath)
      ) || null;
    }
  }

  if (!currentShare) return false;

  let member = currentShare.shared_with.find(m =>
    m && m.username && (targetUser ? m.username.toLowerCase() === targetUser : m.status === 'pending')
  );

  if (!member && targetUser && currentShare.invited_user && currentShare.invited_user.toLowerCase() === targetUser) {
    member = {
      username: targetUser,
      status: 'pending',
      can_see_members: true,
      can_manage_members: false,
      added_at: currentShare.created_at || new Date().toISOString(),
    };
    currentShare.shared_with.push(member);
  }

  if (member) {
    if (status === 'declined') {
      currentShare.shared_with = currentShare.shared_with.filter(m => m !== member && m.username.toLowerCase() !== targetUser);
      currentShare.status = 'declined';
    } else {
      member.status = 'accepted';
      currentShare.status = 'accepted';
    }
    currentShare.updated_at = new Date().toISOString();
  }

  const calculatedDocId = getSharedFolderDocId(currentShare.owner, currentShare.folder_path);

  if (currentShare.shared_with.length === 0) {
    try {
      await deleteDoc(doc(db, 'shares', targetDocId));
    } catch (err) {
      console.warn('Firestore delete empty share on decline error:', err);
    }
    if (targetDocId !== calculatedDocId) {
      try {
        await deleteDoc(doc(db, 'shares', calculatedDocId));
      } catch {}
    }
    const localShares = getLocalShares().filter(s => s.id !== shareId && s.id !== targetDocId && s.id !== calculatedDocId);
    saveLocalShares(localShares);
  } else {
    try {
      const updatedData = {
        ...currentShare,
        status: currentShare.status,
        shared_users: currentShare.shared_with.filter(m => m && m.username).map(m => m.username.toLowerCase()),
        updated_at: currentShare.updated_at,
      };
      await setDoc(doc(db, 'shares', targetDocId), updatedData, { merge: true });

      if (targetDocId !== calculatedDocId) {
        try {
          await setDoc(doc(db, 'shares', calculatedDocId), updatedData, { merge: true });
        } catch {}
      }
    } catch (err) {
      console.warn('Firestore update share on response error:', err);
    }
    updateLocalShare(currentShare);
  }

  // 5. Also notify backend API (POST /api/shares/respond) if in browser
  if (typeof window !== 'undefined') {
    try {
      fetch('/api/shares/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, status, username: targetUser }),
      }).catch((apiErr) => {
        console.warn('Backend API share respond sync warning (non-fatal):', apiErr);
      });
    } catch {}
  }

  return true;
}

export async function getSharedFolder(folder_path: string, ownerRaw: string): Promise<FolderShare | null> {
  const owner = ownerRaw.trim().toLowerCase();
  const normalizePath = (p: string) => (p || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  const normalizedFolderPath = normalizePath(folder_path);
  const shareDocId = getSharedFolderDocId(owner, folder_path);

  // 1. Always query Firestore first for fresh statuses & permissions!
  try {
    const snap = await getDoc(doc(db, 'shares', shareDocId));
    if (snap.exists()) {
      const fresh = normalizeShareDoc({ ...snap.data(), id: snap.id });
      updateLocalShare(fresh);
      return fresh;
    }

    const q = query(collection(db, 'shares'), where('owner', '==', owner));
    const snapQ = await getDocs(q);
    for (const d of snapQ.docs) {
      const data = d.data();
      if (normalizePath(data.folder_path || '') === normalizedFolderPath) {
        const fresh = normalizeShareDoc({ ...data, id: d.id });
        updateLocalShare(fresh);
        return fresh;
      }
    }

    // Additional scan across shares
    const qAll = query(collection(db, 'shares'));
    const allSnap = await getDocs(qAll);
    for (const d of allSnap.docs) {
      const data = d.data();
      if (
        (data.owner || '').toLowerCase() === owner &&
        normalizePath(data.folder_path || '') === normalizedFolderPath
      ) {
        const fresh = normalizeShareDoc({ ...data, id: d.id });
        updateLocalShare(fresh);
        return fresh;
      }
    }
  } catch (err) {
    console.warn('Firestore getSharedFolder error, falling back to local cache:', err);
  }

  // 2. Fallback to local cache
  const local = getLocalShares().find(
    s => s.owner.toLowerCase() === owner && normalizePath(s.folder_path) === normalizedFolderPath
  );
  return local || null;
}

export async function getSharesForFolder(folder_path: string, owner: string): Promise<FolderShare[]> {
  const single = await getSharedFolder(folder_path, owner);
  return single ? [single] : [];
}

export async function getSharesForInvitedUser(usernameRaw: string): Promise<FolderShare[]> {
  const normalized = (usernameRaw || '').trim().toLowerCase();
  if (!normalized) return [];
  const serverResults: FolderShare[] = [];
  let firestoreSuccess = false;

  try {
    const q1 = query(collection(db, 'shares'), where('shared_users', 'array-contains', normalized));
    const snap1 = await getDocs(q1);
    snap1.docs.forEach(d => {
      const docData = d.data();
      if (docData) serverResults.push(normalizeShareDoc({ ...docData, id: d.id }));
    });
    firestoreSuccess = true;
  } catch (err) {
    console.warn('Firestore get shares for user (array-contains) error:', err);
  }

  // Legacy fallback query
  try {
    const q2 = query(collection(db, 'shares'), where('invited_user', '==', normalized));
    const snap2 = await getDocs(q2);
    snap2.docs.forEach(d => {
      const docData = d.data();
      if (docData) serverResults.push(normalizeShareDoc({ ...docData, id: d.id }));
    });
    firestoreSuccess = true;
  } catch {
    // ignore
  }

  if (firestoreSuccess) {
    const consolidated = consolidateFolderShares(serverResults);
    const normalizePath = (p: string) => (p || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
    const serverKeys = new Set(consolidated.map(s => `${s.owner.toLowerCase()}::${normalizePath(s.folder_path)}`));
    const remainingLocal = getLocalShares().filter(s => !serverKeys.has(`${s.owner.toLowerCase()}::${normalizePath(s.folder_path)}`));
    saveLocalShares([...remainingLocal, ...consolidated]);
    return consolidated;
  }

  // Local store fallback
  const local = getLocalShares().filter(s =>
    s && (
      (s.invited_user && s.invited_user?.toLowerCase() === normalized) ||
      (Array.isArray(s.shared_with) && s.shared_with.some(m => m?.username && m.username?.toLowerCase() === normalized))
    )
  );
  return consolidateFolderShares(local);
}

export async function getSharesByOwner(usernameRaw: string): Promise<FolderShare[]> {
  const normalized = (usernameRaw || '').trim().toLowerCase();
  if (!normalized) return [];
  const serverResults: FolderShare[] = [];
  let firestoreSuccess = false;

  try {
    const q = query(collection(db, 'shares'), where('owner', '==', normalized));
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      const docData = d.data();
      if (docData) serverResults.push(normalizeShareDoc({ ...docData, id: d.id }));
    });
    firestoreSuccess = true;
  } catch (err) {
    console.warn('Firestore get shares by owner error:', err);
  }

  if (firestoreSuccess) {
    const consolidated = consolidateFolderShares(serverResults);
    const remainingLocal = getLocalShares().filter(s => s && s.owner && s.owner.toLowerCase() !== normalized);
    saveLocalShares([...remainingLocal, ...consolidated]);
    return consolidated;
  }

  // Local store fallback
  const local = getLocalShares().filter(s => s && s.owner && s.owner?.toLowerCase() === normalized);
  return consolidateFolderShares(local);
}


