export type UserRole = 'master' | 'user';
export type UserStatus = 'active' | 'pending' | 'rejected';

export interface UserAccount {
  username: string;
  email?: string;
  uid?: string;
  passwordHash?: string;
  salt?: string;
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
  thumbnail_url?: string;
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
  status: 'pending' | 'accepted' | 'declined' | 'left' | 'active';
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
  accepted_by?: Record<string, 'pending' | 'accepted' | 'declined' | 'left' | string>;
  created_at: string;
  updated_at?: string;
  can_write?: boolean;
  canWrite?: boolean;
  role?: 'editor' | 'viewer' | string;
  // Optional legacy fields for backward compatibility during runtime migrations
  invited_user?: string;
  status?: 'pending' | 'accepted' | 'declined' | 'left' | 'active';
  can_see_members?: boolean;
  can_manage_members?: boolean;
}

export interface PublicFileShare {
  id: string;
  owner: string;
  file_path: string;
  created_at: string;
}


export interface SystemConfig {
  maintenance: boolean;
  updatedAt?: string;
}

export type ViewMode = 'grid' | 'list';
export type NavigationTab = 'my-drive' | 'shared' | 'admin' | 'cinema' | 'cinema-tv';
