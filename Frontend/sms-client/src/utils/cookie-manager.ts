import cookies from 'js-cookie';

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

  
  if (pathname.startsWith('/super-admin')) {
    return 'SUPER_ADMIN';
  }
  
  // Check if we're in a tenant context (subdomain or tenant path)
  const hasSubdomain = hostname.split('.').length > 2 && !hostname.includes('localhost');
  const hasTenantPath = pathname.match(/^\/[a-zA-Z0-9-]+\/(dashboard|login)/);
  
  if (hasSubdomain || hasTenantPath) {
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
  set: (key: string, value: string, options?: cookies.CookieAttributes, namespace?: CookieNamespace) => {
    const namespacedKey = getNamespacedKey(key, namespace);
    cookies.set(namespacedKey, value, options);
  },
  
  get: (key: string, namespace?: CookieNamespace): string | undefined => {
    const namespacedKey = getNamespacedKey(key, namespace);
    return cookies.get(namespacedKey);
  },
  
  remove: (key: string, namespace?: CookieNamespace) => {
    const namespacedKey = getNamespacedKey(key, namespace);
    cookies.remove(namespacedKey);
  },
  
  // Clear all cookies for a specific context
  clearContext: (namespace: CookieNamespace) => {
    const prefix = COOKIE_NAMESPACES[namespace];
    const allCookies = cookies.get();
    
    Object.keys(allCookies).forEach(cookieName => {
      if (cookieName.startsWith(prefix)) {
        cookies.remove(cookieName);
      }
    });
  },
  
  // Clear problematic 'default' tenant cookies
  clearDefaultTenantCookies: () => {
    // Clear any tenant cookies that might have 'default' value
    const allCookies = cookies.get();
    
    Object.entries(allCookies).forEach(([cookieName, cookieValue]) => {
      // Remove any tenant-related cookies with 'default' value
      if ((cookieName.includes('tenantId') || cookieName.startsWith('tn_')) && 
          cookieValue === 'default') {
        console.log(`Clearing problematic cookie: ${cookieName}=${cookieValue}`);
        cookies.remove(cookieName);
      }
    });
  },
};