"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import cookies from 'js-cookie';
import { User } from '@/types/auth';
import { contextualCookies, getCurrentContext } from '@/utils/cookie-manager';
import axios from 'axios';

type AuthContextType = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresPasswordChange: boolean;
  selectedTenantId: string | null;
  setSelectedTenant: (tenantId: string | null) => void;
  login: (email: string, password: string, tenantId?: string) => Promise<{ requiresPasswordChange?: boolean, user?: User, access_token?: string, refresh_token?: string }>;
  logout: (options?: { redirectTo?: string }) => void;
  refreshAccessToken: () => Promise<string | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  prepareAuthHeaders: () => Promise<Record<string, string> | null>;
  validateTokenBeforeRequest: () => Promise<boolean>;
  refetchUser: () => Promise<void>;
  updateUser: (userId: string, data: any) => Promise<void>;
  isLoggingOut: boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const isValidating = useRef(false);
  const isFetchingUser = useRef(false);

  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const [selectedTenantIdState, setSelectedTenantIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return contextualCookies.get('selectedTenantId', 'SUPER_ADMIN') || null;
    }
    return null;
  });

  const router = useRouter();

  const setSelectedTenant = useCallback((tenantId: string | null) => {
    setSelectedTenantIdState(tenantId);
    if (tenantId) {
      contextualCookies.set('selectedTenantId', tenantId, { expires: 7 }, 'SUPER_ADMIN');
    } else {
      contextualCookies.remove('selectedTenantId', 'SUPER_ADMIN');
    }
  }, []);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setRequiresPasswordChange(false);
    setSelectedTenantIdState(null);

    // Clear all known cookie contexts
    contextualCookies.clearContext('DEFAULT');
    contextualCookies.clearContext('SUPER_ADMIN');
    contextualCookies.clearContext('TENANT');

    // Remove general cookies (fallback)
    cookies.remove('accessToken');
    cookies.remove('refreshToken');
    cookies.remove('tenantId');
    cookies.remove('selectedTenantId');

    // Clear localStorage
    localStorage.removeItem('userTenantId');
    localStorage.removeItem('superAdminTenantId');
    localStorage.removeItem('selectedTenantId');
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const context = getCurrentContext();
    const storedRefreshToken = contextualCookies.get('refreshToken', context);

    if (!storedRefreshToken) return null;

    const tenantId = contextualCookies.get('tenantId', context);

    try {
      const response = await axios.post('/api/auth/refresh',
        { refresh_token: storedRefreshToken },
        {
          headers: {
            'Authorization': `Bearer ${storedRefreshToken}`,
            ...(tenantId && { 'X-Tenant-ID': tenantId }),
          },
          timeout: 90000,
        }
      );

      const data = response.data;

      contextualCookies.set('accessToken', data.access_token, { expires: 1 / 24 }, context);
      contextualCookies.set('refreshToken', data.refresh_token, { expires: 7 }, context);
      
      // Update states
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);

      return data.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      if (!(error instanceof TypeError && error.message.includes('fetch'))) {
        if (axios.isAxiosError(error) &&
          !error.message.includes('timeout') &&
          !error.message.includes('Network Error')) {
          clearAuthState();
        }
      }
      return null;
    }
  }, [clearAuthState]);

  useEffect(() => {
    if (isFetchingUser.current || user) return;

    const loadAuthData = async () => {
      if (isFetchingUser.current || user || isLoggingOut) {
        if (!user && !isLoggingOut) setIsLoading(false);
        return;
      }
      isFetchingUser.current = true;
      setIsLoading(true);

      try {
        const currentContext = getCurrentContext();
        let storedAccessToken = contextualCookies.get('accessToken', currentContext);
        let storedRefreshToken = contextualCookies.get('refreshToken', currentContext);

        if (!storedAccessToken) {
          const saToken = contextualCookies.get('accessToken', 'SUPER_ADMIN');
          if (saToken) {
            storedAccessToken = saToken;
            storedRefreshToken = contextualCookies.get('refreshToken', 'SUPER_ADMIN');
          }
        }

        if (storedAccessToken && storedRefreshToken) {
          setAccessToken(storedAccessToken);
          setRefreshToken(storedRefreshToken);

          try {
            const fetchUserWithRetry = async (token: string, retries = 3): Promise<Response> => {
              for (let i = 0; i < retries; i++) {
                try {
                  const res = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  if (res.ok || res.status === 401) return res;
                  // If 5xx error, wait and retry
                  if (res.status >= 500) {
                    console.warn(`[Auth] /api/auth/me returned ${res.status}, retrying (${i + 1}/${retries})...`);
                    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
                    continue;
                  }
                  return res;
                } catch (err) {
                  console.warn(`[Auth] Network error fetching user, retrying (${i + 1}/${retries})...`, err);
                  if (i === retries - 1) throw err;
                  await new Promise(r => setTimeout(r, 1000 * (i + 1)));
                }
              }
              throw new Error('Max retries exceeded fetching user data');
            };

            const response = await fetchUserWithRetry(storedAccessToken);

            if (!response.ok) {
              if (response.status === 401) {
                const newAccessToken = await refreshAccessToken();
                if (newAccessToken) {
                  const refreshedResponse = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${newAccessToken}` }
                  });
                  if (!refreshedResponse.ok) throw new Error('Failed to fetch user after refresh');
                  const refreshedUserData = await refreshedResponse.json();
                  setUser(refreshedUserData as User);
                } else {
                  clearAuthState();
                }
              } else {
                throw new Error('Failed to fetch user data');
              }
            } else {
              const userData = await response.json();
              setUser(userData as User);
            }
          } catch (error) {
            console.error('Failed fetching user, trying to refresh token', error);
            clearAuthState();
          }
        }
      } catch (e) {
        console.error("Error in auth data loading logic", e);
        clearAuthState();
      } finally {
        setIsLoading(false);
        isFetchingUser.current = false;
      }
    };

    loadAuthData();
  }, [refreshAccessToken, clearAuthState, user, isLoggingOut]);

  useEffect(() => {
    if (!accessToken) return;

    const interval = setInterval(async () => {
      if (isValidating.current) return;

      try {
        isValidating.current = true;
        const currentContext = getCurrentContext();
        const tenantId = contextualCookies.get('tenantId', currentContext);
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            ...(tenantId && { 'X-Tenant-ID': tenantId }),
          },
          signal: AbortSignal.timeout(5000)
        });

        if (!response.ok && response.status === 401) {
          const newToken = await refreshAccessToken();
          if (!newToken) clearAuthState();
        }
      } catch (error) {
        console.error('Token validation failed:', error);
      } finally {
        isValidating.current = false;
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [accessToken, refreshAccessToken, clearAuthState]);

  const login = async (email: string, password: string, explicitTenantId?: string): Promise<{ requiresPasswordChange?: boolean, user?: User, access_token?: string, refresh_token?: string }> => {
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const currentContext = getCurrentContext();
      const tenantId = explicitTenantId || contextualCookies.get('tenantId', currentContext);

      const headers: { [key: string]: string } = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      if (tenantId) headers['X-Tenant-ID'] = tenantId;

      const response = await axios.post('/api/auth/login', formData, {
        headers,
        timeout: 90000,
      });

      const data = response.data;

      if (data.requires_password_change) {
        setRequiresPasswordChange(true);
        return { requiresPasswordChange: true };
      }

      const tempAxios = axios.create();
      const userResponse = await tempAxios.get('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
          ...(tenantId && { 'X-Tenant-ID': tenantId }),
        },
        timeout: 90000,
      });

      const userData = userResponse.data;
      setUser(userData);

      const isSuperAdmin = userData.roles && userData.roles.some((r: { name: string }) =>
        r.name === 'superadmin' || r.name === 'super-admin'
      );

      const tokenStorageContext = isSuperAdmin ? 'SUPER_ADMIN' : 'DEFAULT';

      contextualCookies.set('accessToken', data.access_token, { expires: 1 }, tokenStorageContext);
      if (data.refresh_token) {
        contextualCookies.set('refreshToken', data.refresh_token, { expires: 7 }, tokenStorageContext);
      }

      if (!isSuperAdmin && userData.tenant_id && userData.tenant_id !== 'None') {
        contextualCookies.set('tenantId', userData.tenant_id, { expires: 7 }, 'DEFAULT');
      }

      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);

      return { ...data, user: userData };

    } catch (error) {
      console.error('Login API error:', error);
      clearAuthState();
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const currentContext = getCurrentContext();
      const tenantId = contextualCookies.get('tenantId', currentContext);
      await axios.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          ...(tenantId && { 'X-Tenant-ID': tenantId }),
        },
        timeout: 90000,
      });

      setRequiresPasswordChange(false);
      await refetchUser();
    } catch (error) {
      console.error('Password change failed:', error);
      throw error;
    }
  };

  const updateUser = async (userId: string, data: any) => {
    try {
      const currentContext = getCurrentContext();
      const tenantId = contextualCookies.get('tenantId', currentContext);
      await axios.put(`/api/v1/auth/users/${userId}`, data, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          ...(tenantId && { 'X-Tenant-ID': tenantId }),
        },
        timeout: 90000,
      });

      await refetchUser();
    } catch (error) {
      console.error('User update failed:', error);
      throw error;
    }
  };

  const refetchUser = async () => {
    if (!accessToken) return;
    try {
      const currentContext = getCurrentContext();
      const tenantId = contextualCookies.get('tenantId', currentContext);
      const userResponse = await axios.get('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          ...(tenantId && { 'X-Tenant-ID': tenantId }),
        },
        timeout: 90000,
      });
      setUser(userResponse.data);
    } catch (error) {
      console.error('Failed to refetch user data:', error);
    }
  };

  const logout = useCallback(async (options?: { redirectTo?: string }) => {
    try {
      setIsLoggingOut(true);

      if (accessToken) {
        const currentContext = getCurrentContext();
        const tenantId = contextualCookies.get('tenantId', currentContext);

        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...(tenantId && { 'X-Tenant-ID': tenantId }),
          },
        }).catch(err => console.error('Backend logout error:', err));
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Get tenant domain BEFORE clearing auth state
      const currentContext = getCurrentContext();
      const tenantDomain = contextualCookies.get('currentTenantDomain', currentContext) || localStorage.getItem('currentTenantDomain');
      const isSA = window.location.pathname.startsWith('/super-admin');

      clearAuthState();
      await new Promise(resolve => setTimeout(resolve, 50));

      if (options?.redirectTo) {
        router.push(options.redirectTo);
        return;
      }

      if (isSA) {
        router.push('/super-admin/login');
      } else if (tenantDomain) {
        router.push(`/${tenantDomain}/login`);
      } else {
        router.push('/login');
      }
    }
  }, [router, clearAuthState, accessToken]);

  const validateTokenBeforeRequest = async () => {
    if (!accessToken) return false;
    if (isValidating.current) return true;
    isValidating.current = true;

    try {
      const tokenParts = accessToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        const expiry = payload.exp * 1000;
        if (Date.now() >= expiry - 60000) {
          const newToken = await refreshAccessToken();
          return !!newToken;
        }
      }
      return true;
    } catch (error) {
      console.error('Error validating token:', error);
      const newToken = await refreshAccessToken();
      return !!newToken;
    } finally {
      isValidating.current = false;
    }
  };

  const prepareAuthHeaders = async () => {
    const isValid = await validateTokenBeforeRequest();
    if (!isValid) return null;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
    };

    const currentContext = getCurrentContext();
    const tenantId = contextualCookies.get('tenantId', currentContext);
    const isSA = user?.roles?.some((r: any) => r.name === 'superadmin' || r.name === 'super-admin');

    if (tenantId && !isSA) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return headers;
  };

  const pathname = usePathname();
  useEffect(() => {
    setIsLoggingOut(false);
  }, [pathname]);

  useEffect(() => {
    const minutesVal = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES) || 15;
    const idleTimeoutMs = minutesVal * 60 * 1000;
    const lastActiveRef = { current: Date.now() };
    const activityHandler = () => { lastActiveRef.current = Date.now(); };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, activityHandler, { passive: true }));

    const interval = setInterval(() => {
      if (!accessToken) return;
      if (Date.now() - lastActiveRef.current > idleTimeoutMs) {
        const isSA = user?.roles?.some((r: any) => r.name === 'superadmin' || r.name === 'super-admin');
        const tid = contextualCookies.get('tenantId', getCurrentContext());
        const target = (tid && !isSA) ? `/${tid}/session-expired` : '/session-expired';
        logout({ redirectTo: target });
      }
    }, 30000);

    return () => {
      events.forEach(e => window.removeEventListener(e, activityHandler));
      clearInterval(interval);
    };
  }, [accessToken, logout, user]);

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      refreshToken,
      isAuthenticated: !!user && !!accessToken,
      isLoading,
      requiresPasswordChange,
      selectedTenantId: selectedTenantIdState,
      setSelectedTenant,
      login,
      logout,
      refreshAccessToken,
      changePassword,
      prepareAuthHeaders,
      validateTokenBeforeRequest,
      refetchUser,
      updateUser,
      isLoggingOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
