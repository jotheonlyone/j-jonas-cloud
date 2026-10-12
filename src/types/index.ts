export type UserRole = 'master' | 'user';
export type UserStatus = 'active' | 'pending' | 'rejected';

export interface UserAccount {
  username: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  status: UserStatus;
  quota_gb: number;
  createdAt: string;
}

export interface FileItemData {
  name: string;
  type: 'file' | 'folder';
  size: number;
  modified: string;
  mime_type?: string;
  path?: string;
}

export interface StorageUsage {
  used_bytes: number;
  used_gb: number;
}

export interface FolderShare {
  id: string;
  folder_path: string;
  folder_name: string;
  owner: string;
  invited_user: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface SystemConfig {
  maintenance: boolean;
  updatedAt?: string;
}

export type ViewMode = 'grid' | 'list';
export type NavigationTab = 'my-drive' | 'shared' | 'admin' | 'cinema';
