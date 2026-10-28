"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import cookies from 'js-cookie';
import { User } from '@/types/auth';
import { contextualCookies, getCurrentContext } from '@/utils/cookie-manager';
import { currentSchoolSlug } from '@/utils/tenant-utils';
import axios from 'axios';

// The session lives in httpOnly cookies set by the /api/auth routes. This context never sees a
// token: it asks /api/auth/me who is signed in, and /api/auth/refresh to extend the session.

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresPasswordChange: boolean;
  selectedTenantId: string | null;
  setSelectedTenant: (tenantId: string | null) => void;
  login: (email: string, password: string, tenantId?: string) => Promise<{ requiresPasswordChange?: boolean, user?: User }>;
  logout: (options?: { redirectTo?: string }) => void;
  /** Extend the session with the httpOnly refresh cookie; false when the session is over. */
  refreshAccessToken: () => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refetchUser: () => Promise<void>;
  updateUser: (userId: string, data: any) => Promise<void>;
  isLoggingOut: boolean;
  hasInitialized: boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Headers that tell the server routes which session (sa_ / tn_ / default) this page uses. */
function contextHeaders(): Record<string, string> {
  const context = getCurrentContext();
  const tenantId = contextualCookies.get('tenantId', context);
  return {
    'X-Auth-Context': context,
    ...(tenantId && { 'X-Tenant-ID': tenantId }),
  };
}

/** The script-readable "signed in" marker set next to the httpOnly cookies (it holds no secret). */
function hasSessionMarker(): boolean {
  return ['sa_session', 'tn_session', 'session'].some(name => cookies.get(name) === '1');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const isValidating = useRef(false);
  const isFetchingUser = useRef(false);

  const [user, setUser] = useState<User | null>(null);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const refreshPromise = useRef<Promise<boolean> | null>(null);

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

  // Forget the user in this tab. The httpOnly session cookies are cleared by /api/auth/logout.
  const clearAuthState = useCallback(() => {
    setUser(null);
    setRequiresPasswordChange(false);
    setSelectedTenantIdState(null);

    contextualCookies.clearContext('DEFAULT');
    contextualCookies.clearContext('SUPER_ADMIN');
    contextualCookies.clearContext('TENANT');
    cookies.remove('tenantId');
    cookies.remove('selectedTenantId');

    localStorage.removeItem('userTenantId');
    localStorage.removeItem('superAdminTenantId');
    localStorage.removeItem('selectedTenantId');
    localStorage.removeItem('user');
  }, []);

  const refreshAccessToken = useCallback(async () => {
    // Share one refresh between callers: refresh tokens rotate, so a second call would fail
    if (refreshPromise.current) return refreshPromise.current;

    refreshPromise.current = (async () => {
      try {
        await axios.post('/api/auth/refresh', null, {
          headers: { 'X-Auth-Context': getCurrentContext() },
          timeout: 90000,
        });
        return true;
      } catch (error) {
        // Only a definite "no" from the server ends the session; network trouble doesn't
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          clearAuthState();
        }
        return false;
      } finally {
        refreshPromise.current = null;
      }
    })();

    return refreshPromise.current;
  }, [clearAuthState]);

  /** GET /api/auth/me, refreshing once on 401. Null when nobody is signed in. */
  const fetchCurrentUser = useCallback(async (): Promise<User | null> => {
    const get = async () => {
      for (let attempt = 1; ; attempt++) {
        try {
          const res = await fetch('/api/auth/me', { headers: contextHeaders(), cache: 'no-store' });
          if (res.status < 500 || attempt >= 3) return res;
          console.warn(`[Auth] /api/auth/me returned ${res.status}, retrying (${attempt}/3)...`);
        } catch (err) {
          if (attempt >= 3) throw err;
          console.warn(`[Auth] Network error fetching user, retrying (${attempt}/3)...`);
        }
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    };

    let res = await get();
    // Refresh only when a session exists (signed-out visitors just get a 401)
    if (res.status === 401 && hasSessionMarker() && (await refreshAccessToken())) {
      res = await get();
    }
    if (!res.ok) return null;
    return (await res.json()) as User;
  }, [refreshAccessToken]);

  useEffect(() => {
    if (isFetchingUser.current || user || isLoggingOut) return;

    const loadAuthData = async () => {
      isFetchingUser.current = true;
      setIsLoading(true);
      try {
        const current = await fetchCurrentUser();
        if (current) {
          setUser(current);
          setRequiresPasswordChange(!!current.isFirstLogin);
        }
      } catch (e) {
        console.error('Error loading the signed-in user', e);
      } finally {
        setIsLoading(false);
        setHasInitialized(true);
        isFetchingUser.current = false;
      }
    };

    loadAuthData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCurrentUser, isLoggingOut]);

  // Check the session every 10 minutes while signed in
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      if (isValidating.current) return;
      try {
        isValidating.current = true;
        const response = await fetch('/api/auth/me', {
          headers: contextHeaders(),
          signal: AbortSignal.timeout(5000),
        });
        if (response.status === 401 && !(await refreshAccessToken())) {
          clearAuthState();
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        isValidating.current = false;
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, refreshAccessToken, clearAuthState]);

  const login = async (email: string, password: string, explicitTenantId?: string): Promise<{ requiresPasswordChange?: boolean, user?: User }> => {
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const currentContext = getCurrentContext();
      const tenantId = explicitTenantId || contextualCookies.get('tenantId', currentContext);

      const headers: { [key: string]: string } = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Auth-Context': currentContext,
      };
      if (tenantId) headers['X-Tenant-ID'] = tenantId;

      // Sets the httpOnly session cookies; the response carries no token
      await axios.post('/api/auth/login', formData, { headers, timeout: 90000 });

      const userResponse = await axios.get('/api/auth/me', {
        headers: {
          'X-Auth-Context': currentContext,
          ...(tenantId && { 'X-Tenant-ID': tenantId }),
        },
        timeout: 90000,
      });
      const userData = userResponse.data;
      setUser(userData);

      if (userData.tenantId && userData.tenantId !== 'None' && userData.tenantId !== 'null') {
        contextualCookies.set('tenantId', userData.tenantId, { expires: 7 }, currentContext);
      }

      // First login with an admin-issued password: the backend allows nothing else until it's changed
      if (userData.isFirstLogin) {
        setRequiresPasswordChange(true);
        return { requiresPasswordChange: true, user: userData };
      }
      return { user: userData };
    } catch (error) {
      console.error('Login API error:', error);
      clearAuthState();
      throw error;
    }
  };

  const refetchUser = async () => {
    try {
      const current = await fetchCurrentUser();
      if (current) setUser(current);
    } catch (error) {
      console.error('Failed to refetch user data:', error);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await axios.post('/api/v1/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      }, {
        headers: contextHeaders(),
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
      await axios.put(`/api/v1/auth/users/${userId}`, data, {
        headers: contextHeaders(),
        timeout: 90000,
      });
      await refetchUser();
    } catch (error) {
      console.error('User update failed:', error);
      throw error;
    }
  };

  const logout = useCallback(async (options?: { redirectTo?: string }) => {
    try {
      setIsLoggingOut(true);

      // The server route revokes the tokens and clears the httpOnly cookies
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Context': getCurrentContext(),
        },
      }).catch(err => console.error('Backend logout error:', err));
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
      } else if (isSA) {
        router.push('/super-admin/login');
      } else if (tenantDomain) {
        router.push(`/${tenantDomain}/login`);
      } else {
        router.push('/login');
      }
    }
  }, [router, clearAuthState]);

  const pathname = usePathname();
  useEffect(() => {
    setIsLoggingOut(false);
  }, [pathname]);

  useEffect(() => {
    const minutesVal = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES) || 60;
    const idleTimeoutMs = minutesVal * 60 * 1000;
    const lastActiveRef = { current: Date.now() };

    const activityHandler = () => { lastActiveRef.current = Date.now(); };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, activityHandler, { passive: true }));

    const interval = setInterval(() => {
      // Only while signed in, initialised and not already logging out
      if (!user || !hasInitialized || isLoggingOut) return;

      if (Date.now() - lastActiveRef.current > idleTimeoutMs) {
        const isSA = user?.role === 'superadmin' ||
                    user?.role === 'super-admin' ||
                    user?.roles?.some((r: any) =>
                      typeof r === 'string'
                        ? (r === 'superadmin' || r === 'super-admin')
                        : (r.name === 'superadmin' || r.name === 'super-admin')
                    );

        // The school's slug (URL, then remembered domain); its id only when no slug is known
        const tid = currentSchoolSlug() || contextualCookies.get('tenantId', 'TENANT');

        const target = (tid && !isSA) ? `/${tid}/session-expired` : '/session-expired';

        console.warn(`[Auth] Idle timeout reached (${minutesVal}m). Redirecting to ${target}`);
        logout({ redirectTo: target });
      }
    }, 30000);

    return () => {
      events.forEach(e => window.removeEventListener(e, activityHandler));
      clearInterval(interval);
    };
  }, [logout, user, hasInitialized, isLoggingOut]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      requiresPasswordChange,
      selectedTenantId: selectedTenantIdState,
      setSelectedTenant,
      login,
      logout,
      refreshAccessToken,
      changePassword,
      refetchUser,
      updateUser,
      isLoggingOut,
      hasInitialized,
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
