export interface User {
  id: string;
  /** Empty for accounts without an email (they sign in with their username) */
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  first_name?: string;
  last_name?: string;
  role: string;
  roles?: { name: string }[];
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  phone?: string;
  address?: string;
  profileImage?: string;
  tenantId?: string;
  isFirstLogin?: boolean;
  lastLogin?: string;
  type?: string;
  preferences?: UserPreferences;
}

// Add this interface to define the structure of user preferences
interface UserPreferences {
  contactMethod?: 'email' | 'sms' | 'phone' | 'app';
  frequency?: 'daily' | 'weekly' | 'immediate';
  notificationTypes?: ('attendance' | 'grades' | 'behavior' | 'events' | 'emergency')[];
  language?: string;
  timeRestrictions?: {
    startTime?: string;
    endTime?: string;
  };
  [key: string]: unknown; // Allow additional properties while maintaining some type safety
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}