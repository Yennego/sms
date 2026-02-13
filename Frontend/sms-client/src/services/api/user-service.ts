import { useApiClient } from './api-client';
import { User } from '@/types/auth';

export interface UserUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  profile_picture?: string;
}

export function useUserService() {
  const apiClient = useApiClient();
  
  return {
    // List users (tenant-scoped)
    getUsers: async (skip: number = 0, limit: number = 100): Promise<User[]> => {
      return apiClient.get<User[]>(`/auth/users?skip=${skip}&limit=${limit}`);
    },

    // List active users
    getActiveUsers: async (skip: number = 0, limit: number = 100): Promise<User[]> => {
      return apiClient.get<User[]>(`/auth/users/active?skip=${skip}&limit=${limit}`);
    },

    // Get one user
    getUserById: async (userId: string) => {
      return apiClient.get<User>(`/auth/users/${userId}`);
    },

    // Delete user
    deleteUser: async (userId: string) => {
      return apiClient.delete(`/auth/users/${userId}`);
    },

    // Create user (payload shape aligns with backend contract)
    createUser: async (payload: Record<string, unknown>) => {
      return apiClient.post(`/auth/users`, payload);
    },

    updateProfile: async (userId: string, userData: UserUpdate) => {
      return apiClient.put<User>(`/auth/users/${userId}`, userData);
    },
    
    changePassword: async (currentPassword: string, newPassword: string) => {
      return apiClient.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
    }
  };
}
