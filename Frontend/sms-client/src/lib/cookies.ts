import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { cookies } from 'next/headers';

/**
 * Helper function to get namespaced cookies from Next.js cookie store
 * @param cookieStore - The Next.js cookie store from cookies()
 * @param key - The cookie key to retrieve
 * @param namespace - The namespace prefix (e.g., 'tn_', 'sa_', '')
 * @returns The cookie value or undefined if not found
 */
export function getNamespacedCookie(
  cookieStore: ReadonlyRequestCookies, 
  key: string, 
  namespace: string = 'tn_'
): string | undefined {
  return cookieStore.get(`${namespace}${key}`)?.value;
}

export async function getNamespacedCookieAsync(
  key: string, 
  namespace: string = 'tn_'
): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(`${namespace}${key}`)?.value;
}

/**
 * Helper function to validate UUID format
 * @param str - String to validate
 * @returns True if the string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Get tenant UUID by domain from backend API
 * @param domain - The tenant domain to resolve
 * @returns Promise resolving to tenant UUID or null
 */
export async function getTenantUUIDByDomain(domain: string): Promise<string | null> {
  try {
    const response = await fetch(`${process.env.BACKEND_API_URL}/tenants/resolve/${domain}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.tenant_id || null;
  } catch (error) {
    console.error('Error resolving tenant UUID:', error);
    return null;
  }
}