import Cookies from 'js-cookie';

// Cookie namespaces for different contexts
export const COOKIE_NAMESPACES = {
  SUPER_ADMIN: 'sa_',
  TENANT: 'tn_',
  DEFAULT: ''
} as const;

type CookieNamespace = keyof typeof COOKIE_NAMESPACES;

// Determine context based on current URL
export function getCurrentContext(): CookieNamespace {
  if (typeof window === 'undefined') return 'DEFAULT';

  const pathname = window.location.pathname;
  const hostname = window.location.hostname;

  // List of reserved top-level paths that are NOT tenant specific
  const reservedPaths = ['super-admin', 'api', '_next', 'static', 'public', 'favicon.ico'];
  
  const pathSegments = pathname.split('/').filter(Boolean);
  const firstSegment = pathSegments[0]?.toLowerCase();

  if (firstSegment && reservedPaths.includes(firstSegment)) {
    // Check for super-admin specifically
    if (firstSegment === 'super-admin') return 'SUPER_ADMIN';
    return 'DEFAULT';
  }

  // Check if we're in a tenant context (subdomain or has initial segment that isn't reserved)
  const hasSubdomain = hostname.split('.').length > 2 && !hostname.includes('localhost') && !hostname.includes('vercel.app');
  
  // If we have at least one segment and it's not reserved, and it's not a top-level public page like /login
  const publicTopLevel = ['login', 'register', 'session-expired', 'forgot-password'];
  const isTenantPath = firstSegment && !publicTopLevel.includes(firstSegment);

  if (hasSubdomain || isTenantPath) {
    return 'TENANT';
  }

  return 'DEFAULT';
}

// Get namespaced cookie name
export function getNamespacedKey(key: string, namespace?: CookieNamespace): string {
  const context = namespace || getCurrentContext();
  const prefix = COOKIE_NAMESPACES[context];
  return `${prefix}${key}`;
}

// Context-aware cookie operations
export const contextualCookies = {
  set: (key: string, value: string, options?: Cookies.CookieAttributes, namespace?: CookieNamespace) => {
    const namespacedKey = getNamespacedKey(key, namespace);
    const cookieOptions = { path: '/', ...options };
    Cookies.set(namespacedKey, value, cookieOptions);
  },

  get: (key: string, namespace?: CookieNamespace): string | undefined => {
    const namespacedKey = getNamespacedKey(key, namespace);
    return Cookies.get(namespacedKey);
  },

  remove: (key: string, namespace?: CookieNamespace) => {
    const namespacedKey = getNamespacedKey(key, namespace);
    Cookies.remove(namespacedKey);
  },

  // Clear all cookies for a specific context
  clearContext: (namespace: CookieNamespace) => {
    const prefix = COOKIE_NAMESPACES[namespace];
    const allCookies = Cookies.get();

    Object.keys(allCookies).forEach(cookieName => {
      if (cookieName.startsWith(prefix)) {
        Cookies.remove(cookieName);
      }
    });
  },

  // Clear problematic 'default' tenant cookies
  clearDefaultTenantCookies: () => {
    // Clear any tenant cookies that might have 'default' value
    const allCookies = Cookies.get();

    Object.entries(allCookies).forEach(([cookieName, cookieValue]) => {
      // Remove any tenant-related cookies with 'default' value
      if ((cookieName.includes('tenantId') || cookieName.startsWith('tn_')) &&
        cookieValue === 'default') {
        console.log(`Clearing problematic cookie: ${cookieName}=${cookieValue}`);
        Cookies.remove(cookieName);
      }
    });
  },
};