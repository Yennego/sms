// When a school's platform billing keeps someone out (phase7-design.md §8 "Refusals").
//
// The backend refuses with 403, the header X-School-Billing-Status (read_only, suspended or
// dormant) and `detail` set to the banner's line. A blocked change is shown as that line; a refused
// sign-in or session refresh (suspended school, non-admin) signs the user out and the login page
// shows the line.
import { getCurrentContext } from '@/utils/cookie-manager';
import { currentSchoolSlug } from '@/utils/tenant-utils';

/** Lower case: how fetch and axios name response headers. */
export const BILLING_STATUS_HEADER = 'x-school-billing-status';

const SIGN_OUT_KEY = 'billingSignOut';

/** The refusal's text from a response body ({detail} from the backend, {message} from our routes). */
export function billingDetail(data: unknown, fallback = "Your school's account is suspended. Ask the school office."): string {
  const body = (data ?? {}) as { detail?: unknown; message?: unknown };
  if (typeof body.detail === 'string' && body.detail) return body.detail;
  if (typeof body.message === 'string' && body.message) return body.message;
  return fallback;
}

/** The message the login page shows once after a billing sign-out (null when there is none). */
export function takeBillingSignOut(): string | null {
  try {
    const message = sessionStorage.getItem(SIGN_OUT_KEY);
    if (message) sessionStorage.removeItem(SIGN_OUT_KEY);
    return message;
  } catch {
    return null;
  }
}

let signingOut = false;

/** End the session (cookies cleared by /api/auth/logout) and open the school's login page with `message`. */
export async function signOutForBilling(message: string): Promise<void> {
  if (typeof window === 'undefined' || signingOut) return;
  signingOut = true;
  try {
    sessionStorage.setItem(SIGN_OUT_KEY, message);
  } catch {
    // The login page then shows no reason; signing out still matters more
  }
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Context': getCurrentContext() },
  }).catch(() => undefined);
  const school = currentSchoolSlug();
  window.location.href = school ? `/${school}/login` : '/login';
}

/** The billing status that refused a request (an AppError from the api client), or null. */
export function billingBlock(error: unknown): string | null {
  const original = (error as { originalError?: { response?: { headers?: Record<string, unknown> } } } | null)
    ?.originalError;
  const value = original?.response?.headers?.[BILLING_STATUS_HEADER];
  return typeof value === 'string' && value ? value : null;
}
