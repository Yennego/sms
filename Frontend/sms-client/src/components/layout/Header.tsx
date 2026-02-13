'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { Button } from '@/components/ui/button';
import { User, Settings, LogOut, School } from 'lucide-react';
import Image from 'next/image';
import { extractTenantSubdomain } from '@/utils/tenant-utils';

export default function Header() {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { tenant } = useTenant();
  // Use tenant name from context or fallback
  const displayName = tenant?.name && tenant?.name !== 'Loading...' ? tenant.name : 'School Portal';

  return (
    <header
      className="shadow-sm border-b"
      style={{ backgroundColor: tenant?.secondaryColor || '#ffffff' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className="p-1 rounded-md bg-white/10 overflow-hidden flex items-center justify-center min-w-[32px]"
                >
                  {tenant?.logo ? (
                    <img
                      src={tenant.logo}
                      alt={displayName || 'School Logo'}
                      className="h-8 w-auto max-w-[120px] object-contain"
                    />
                  ) : (
                    <School
                      className="h-5 w-5 text-black"
                    />
                  )}
                </div>
                <span
                  className="text-lg font-semibold text-black"
                >
                  {displayName || 'School Portal'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="ml-3 relative">
              <div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="rounded-full overflow-hidden"
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="true"
                >
                  <span className="sr-only">Open user menu</span>
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground overflow-hidden">
                    {user?.profileImage ? (
                      <img
                        src={user.profileImage}
                        alt={`${user.firstName} ${user.lastName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : user?.firstName ? (
                      <>
                        {user.firstName.charAt(0).toUpperCase()}
                        {user.lastName?.charAt(0).toUpperCase()}
                      </>
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                </Button>
              </div>
              {isProfileMenuOpen && (
                <div
                  className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-card ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu"
                >
                  <Button
                    variant="ghost"
                    className="flex w-full justify-start px-4 py-2 text-sm"
                    asChild
                  >
                    <Link href={tenant?.id ? `/${tenant.domain || tenant.subdomain || extractTenantSubdomain()}/settings/user` : '/settings/user'}>
                      <User className="mr-2 h-4 w-4" />
                      Your Profile
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex w-full justify-start px-4 py-2 text-sm"
                    asChild
                  >
                    <Link href={tenant?.id ? `/${tenant.domain || tenant.subdomain || extractTenantSubdomain()}/settings/tenant` : '/settings/tenant'}>
                      <Settings className="mr-2 h-4 w-4" />
                      School Settings
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex w-full justify-start px-4 py-2 text-sm text-destructive hover:text-destructive"
                    onClick={() => logout()}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
