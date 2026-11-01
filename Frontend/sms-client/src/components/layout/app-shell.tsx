'use client';

// The app's frame (docs/remodel/04-design-brief.md §5): a sidebar on desks, a bottom bar with
// "More" on phones, the user menu in the top bar, and the current area's pages as tabs above the
// content. Schools and the platform share the frame; menus come from src/config/navigation.ts.
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
  Bell, ChevronDown, KeyRound, LogOut, MoreHorizontal, PenLine, School, Settings, ShieldCheck, UserCog, type LucideIcon,
} from 'lucide-react';
import { BillingBanner } from '@/components/billing/billing-banner';
import { InboxBell } from '@/components/communication/inbox-bell';
import { Sheet } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useTenantFeatures } from '@/hooks/use-tenant-features';
import { cn } from '@/lib/utils';
import {
  PLATFORM_NAVIGATION, locate, navigationFor, schoolRelativePath, visibleAreas, type NavArea,
} from '@/config/navigation';

const PHONE_BAR_ITEMS = 5;
const DEFAULT_BRAND = '#4f46e5';

interface MenuLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface ShellFrameProps {
  title: string;
  logo?: string | null;
  brand: string;
  areas: NavArea[];
  /** School-relative path of the current page, matched against the areas' tab paths */
  currentPath: string;
  /** Turns a tab path into a link */
  linkFor: (path: string) => string;
  userMenu: MenuLink[];
  /** Controls in the top bar before the user menu (the school's inbox bell) */
  headerActions?: ReactNode;
  /** A line under the top bar (the school's billing status) */
  banner?: ReactNode;
  children: ReactNode;
}

function Mark({ logo, className }: { logo?: string | null; className?: string }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element -- school logos are arbitrary external URLs
    <img src={logo} alt="" className={cn('h-8 w-8 rounded-md bg-white object-contain', className)} />
  ) : (
    <span className={cn('flex h-8 w-8 items-center justify-center rounded-md bg-white/15', className)}>
      <School className="h-5 w-5" aria-hidden />
    </span>
  );
}

function ShellFrame({ title, logo, brand, areas, currentPath, linkFor, userMenu, headerActions, banner, children }: ShellFrameProps) {
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const current = locate(areas, currentPath);
  const isActive = (area: NavArea) => current?.area.key === area.key;

  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '';
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const phoneItems = areas.length > PHONE_BAR_ITEMS ? areas.slice(0, PHONE_BAR_ITEMS - 1) : areas;
  const moreItems = areas.length > PHONE_BAR_ITEMS ? areas.slice(PHONE_BAR_ITEMS - 1) : [];
  const moreActive = moreItems.some(isActive);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50" style={{ ['--school-primary' as string]: brand }}>
      {/* Desk: sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex" aria-label="Main">
        <div className="flex h-16 items-center gap-3 px-4 text-white" style={{ backgroundColor: brand }}>
          <Mark logo={logo} />
          <span className="truncate font-semibold" title={title}>{title}</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {areas.map((area) => {
            const Icon = area.icon;
            const active = isActive(area);
            return (
              <Link
                key={area.key}
                href={linkFor(area.tabs[0].path)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  active ? 'text-white' : 'text-slate-700 hover:bg-slate-100',
                )}
                style={active ? { backgroundColor: brand } : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {area.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            <Mark logo={logo} className="text-white" />
            <span className="truncate font-semibold text-slate-900">{title}</span>
          </div>
          <p className="hidden truncate text-lg font-semibold text-slate-900 lg:block">{current?.area.label ?? ''}</p>

          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            <Menu as="div" className="relative">
              <MenuButton className="flex min-h-11 items-center gap-2 rounded-full pl-1 pr-2 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-primary)]">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: brand }}
                >
                  {initials}
                </span>
                <span className="hidden max-w-40 truncate text-sm font-medium text-slate-700 sm:block">{userName}</span>
                <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden />
                <span className="sr-only">Open the user menu</span>
              </MenuButton>
              <MenuItems
                anchor="bottom end"
                className="z-50 mt-2 w-60 rounded-lg border border-slate-200 bg-white p-1 shadow-lg focus:outline-none"
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                </div>
                <div className="my-1 h-px bg-slate-100" />
                {userMenu.map(({ label, href, icon: Icon }) => (
                  <MenuItem key={href}>
                    <Link
                      href={href}
                      className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-slate-700 data-[focus]:bg-slate-100"
                    >
                      <Icon className="h-4 w-4" aria-hidden /> {label}
                    </Link>
                  </MenuItem>
                ))}
                <div className="my-1 h-px bg-slate-100" />
                <MenuItem>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm text-red-600 data-[focus]:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden /> Sign out
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          </div>
        </header>

        {banner}

        {/* The current area's pages */}
        {current && current.area.tabs.length > 1 && (
          <nav aria-label={`${current.area.label} pages`} className="shrink-0 border-b border-slate-200 bg-white">
            <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
              {current.area.tabs.map((t) => {
                const active = t.path === current.tab.path;
                return (
                  <li key={t.path} className="shrink-0">
                    <Link
                      href={linkFor(t.path)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium',
                        active ? 'border-[var(--school-primary)] text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800',
                      )}
                    >
                      {t.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20 lg:pb-0">
          <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
        </div>

        {/* Phone: bottom bar */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <ul className="flex">
            {phoneItems.map((area) => {
              const Icon = area.icon;
              const active = isActive(area);
              return (
                <li key={area.key} className="min-w-0 flex-1">
                  <Link
                    href={linkFor(area.tabs[0].path)}
                    aria-current={active ? 'page' : undefined}
                    className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs', active ? 'font-semibold' : 'text-slate-500')}
                    style={active ? { color: brand } : undefined}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                    <span className="max-w-full truncate px-1">{area.label}</span>
                  </Link>
                </li>
              );
            })}
            {moreItems.length > 0 && (
              <li className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  aria-current={moreActive ? 'page' : undefined}
                  className={cn('flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs', moreActive ? 'font-semibold' : 'text-slate-500')}
                  style={moreActive ? { color: brand } : undefined}
                >
                  <MoreHorizontal className="h-5 w-5" aria-hidden />
                  More
                </button>
              </li>
            )}
          </ul>
        </nav>

        <Sheet open={moreOpen} onOpenChange={setMoreOpen} side="bottom" title="More">
          <ul className="space-y-1">
            {moreItems.map((area) => {
              const Icon = area.icon;
              return (
                <li key={area.key}>
                  <Link
                    href={linkFor(area.tabs[0].path)}
                    onClick={() => setMoreOpen(false)}
                    aria-current={isActive(area) ? 'page' : undefined}
                    className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-slate-800 hover:bg-slate-100"
                  >
                    <Icon className="h-5 w-5" aria-hidden /> {area.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Sheet>
      </div>
    </div>
  );
}

/** A school's pages: `/{school}/...`, menus by the user's role, the school's name and colours. */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { tenant } = useTenant();
  const { isFeatureEnabled } = useTenantFeatures();

  const slug = pathname.split('/')[1] || '';
  const linkFor = (path: string) => `/${slug}${path}`;
  const nav = useMemo(() => navigationFor(user), [user]);
  const areas = useMemo(() => visibleAreas(nav, isFeatureEnabled), [nav, isFeatureEnabled]);

  const title = tenant?.name && tenant.name !== 'Loading...' ? tenant.name : 'School portal';
  const brand = tenant?.primaryColor || DEFAULT_BRAND;

  // The gate scanner is a full-screen tool: no menus, just a way out
  if (nav.bare) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="flex items-center justify-between px-4 py-2 text-white" style={{ backgroundColor: brand }}>
          <span className="flex min-w-0 items-center gap-2 truncate font-semibold">
            <Mark logo={tenant?.logo} className="h-7 w-7" />
            {title}
          </span>
          <button
            type="button"
            onClick={() => logout()}
            className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm hover:bg-white/15"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>
        {children}
      </div>
    );
  }

  const userMenu: MenuLink[] = [
    { label: 'Your profile', href: linkFor('/settings/user'), icon: UserCog },
    { label: 'Change password', href: linkFor('/change-password'), icon: KeyRound },
    { label: 'Notification settings', href: linkFor('/settings/notifications'), icon: Bell },
    ...(nav.signs ? [{ label: 'My signature', href: linkFor('/settings/signature'), icon: PenLine }] : []),
    ...(nav.settings ?? []).map((s) => ({ label: s.label, href: linkFor(s.path), icon: Settings })),
  ];

  return (
    <ShellFrame
      title={title}
      logo={tenant?.logo}
      brand={brand}
      areas={areas}
      currentPath={schoolRelativePath(pathname)}
      linkFor={linkFor}
      userMenu={userMenu}
      headerActions={<InboxBell href={linkFor('/inbox')} active={schoolRelativePath(pathname) === '/inbox'} />}
      banner={
        <BillingBanner
          billingHref={linkFor('/settings/billing')}
          onBillingPage={schoolRelativePath(pathname).startsWith('/settings/billing')}
        />
      }
    >
      {children}
    </ShellFrame>
  );
}

/** The platform operator's pages (`/platform/...`). */
export function PlatformShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const userMenu: MenuLink[] = [
    { label: 'Your profile', href: '/platform/profile', icon: UserCog },
    { label: 'Roles and permissions', href: '/platform/roles-permissions', icon: ShieldCheck },
  ];
  return (
    <ShellFrame
      title="Platform"
      brand="#0f172a"
      areas={PLATFORM_NAVIGATION.areas}
      currentPath={pathname}
      linkFor={(path) => path}
      userMenu={userMenu}
    >
      {children}
    </ShellFrame>
  );
}
