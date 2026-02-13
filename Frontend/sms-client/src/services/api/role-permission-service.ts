import { ApiClient } from './api-client';

export interface RoleCreate {
  name: string;
  description?: string;
  permissions?: string[];
}

export interface RoleUpdate {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
}

export class RolePermissionService {
  private apiClient: ApiClient;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  // Role management
  async getRoles(): Promise<Role[]> {
    return this.apiClient.get<Role[]>('/auth/roles');
  }

  async createRole(roleData: RoleCreate): Promise<Role> {
    return this.apiClient.post<Role>('/auth/roles', roleData);
  }

  async updateRole(roleId: string, roleData: RoleUpdate): Promise<Role> {
    return this.apiClient.put<Role>(`/auth/roles/${roleId}`, roleData);
  }

  async deleteRole(roleId: string): Promise<void> {
    return this.apiClient.delete<void>(`/auth/roles/${roleId}`);
  }

  // Permission management
  async getPermissions(): Promise<Permission[]> {
    return this.apiClient.get<Permission[]>('/auth/permissions');
  }

  async createPermission(permission: { name: string; description?: string }): Promise<Permission> {
    return this.apiClient.post<Permission>('/auth/permissions', permission);
  }

  async updatePermission(permissionId: string, payload: { name?: string; description?: string }): Promise<Permission> {
    return this.apiClient.put<Permission>(`/auth/permissions/${permissionId}`, payload);
  }
  async deletePermission(permissionId: string): Promise<void> {
    return this.apiClient.delete<void>(`/auth/permissions/${permissionId}`);
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    return this.apiClient.get<Permission[]>(`/auth/roles/${roleId}/permissions`);
  }

  // Note: backend expects permission names
  async assignPermissionsToRole(roleId: string, permissionNames: string[]): Promise<void> {
    return this.apiClient.post<void>(`/auth/roles/${roleId}/permissions`, { permission_names: permissionNames });
  }

  // User role assignment
  async getUserRoles(userId: string): Promise<Role[]> {
    return this.apiClient.get<Role[]>(`/auth/users/${userId}/roles`);
  }

  async assignRolesToUser(userId: string, roleIds: string[]): Promise<void> {
    return this.apiClient.post<void>(`/auth/users/${userId}/roles`, { role_ids: roleIds });
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    return this.apiClient.delete<void>(`/auth/users/${userId}/roles/${roleId}`);
  }

  async setRolePermissions(roleId: string, permissionNames: string[]): Promise<void> {
    return this.apiClient.put<void>(`/auth/roles/${roleId}/permissions`, { permission_names: permissionNames });
  }
}