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
      className="relative z-40 transition-colors duration-200"
      style={{ backgroundColor: tenant?.primaryColor || '#ffffff' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <div className="flex items-center gap-2 overflow-hidden max-w-[200px] sm:max-w-[300px] md:max-w-[400px]">
                <div
                  className="p-1.5 rounded-md flex items-center justify-center min-w-[32px] flex-shrink-0 bg-white/10 backdrop-blur-sm"
                >
                  {tenant?.logo ? (
                    <img
                      src={tenant.logo}
                      alt={displayName || 'School Logo'}
                      className="h-8 w-auto max-w-[120px] object-contain"
                    />
                  ) : (
                    <School 
                      className="h-5 w-5 text-white" 
                    />
                  )}
                </div>
                <span
                  className="text-lg font-semibold text-white truncate flex-1"
                  title={displayName || 'School Portal'}
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
                  className="rounded-full overflow-hidden hover:bg-white/20 transition-colors"
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="true"
                >
                  <span className="sr-only">Open user menu</span>
                  <div 
                    className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white overflow-hidden ring-2 ring-white/30"
                  >
                    {user?.profileImage ? (
                      <img
                        src={user.profileImage}
                        alt={`${user.firstName} ${user.lastName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : user?.firstName ? (
                      <span className="text-xs font-bold">
                        {user.firstName.charAt(0).toUpperCase()}
                        {user.lastName?.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                </Button>
              </div>
              {isProfileMenuOpen && (
                <>
                  {/* Click-outside backdrop */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-card ring-1 ring-black ring-opacity-5 focus:outline-none z-20"
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
