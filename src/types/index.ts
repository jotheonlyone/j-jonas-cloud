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
  id?: string;
  name: string;
  type: 'file' | 'folder';
  size: number;
  modified: string;
  mime_type?: string;
  path?: string;
  owner?: string;
  metadata?: {
    description?: string;
    [key: string]: any;
  };
}

export interface StorageUsage {
  used_bytes: number;
  used_gb: number;
  limit_gb?: number;
  limit_bytes?: number;
}

export interface SharedMember {
  username: string;
  status: 'pending' | 'accepted' | 'declined' | 'active';
  can_see_members: boolean;
  can_manage_members: boolean;
  can_write?: boolean;
  canWrite?: boolean;
  role?: 'editor' | 'viewer' | string;
  added_at: string;
}

export interface FolderShare {
  id: string;
  folder_path: string;
  folder_name: string;
  owner: string;
  shared_with: SharedMember[];
  created_at: string;
  updated_at?: string;
  can_write?: boolean;
  canWrite?: boolean;
  role?: 'editor' | 'viewer' | string;
  // Optional legacy fields for backward compatibility during runtime migrations
  invited_user?: string;
  status?: 'pending' | 'accepted' | 'declined' | 'active';
  can_see_members?: boolean;
  can_manage_members?: boolean;
}


export interface SystemConfig {
  maintenance: boolean;
  updatedAt?: string;
}

export type ViewMode = 'grid' | 'list';
export type NavigationTab = 'my-drive' | 'shared' | 'admin' | 'cinema' | 'cinema-tv';
