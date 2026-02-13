'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Settings, LogOut, Shield, Menu } from 'lucide-react';
import Link from 'next/link';

interface SuperAdminHeaderProps {
  onMenuToggle?: () => void;
}

export default function SuperAdminHeader({ onMenuToggle }: SuperAdminHeaderProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <header className="bg-card shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuToggle}
              className="md:hidden mr-3"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div className="flex-shrink-0 flex items-center">
              <Shield className="h-8 w-8 text-primary mr-3" />
              <span className="text-xl font-semibold text-primary hidden sm:block">
                Global Admin Console
              </span>
              <span className="text-lg font-semibold text-primary sm:hidden">
                Admin
              </span>
            </div>
          </div>
          <div className="flex items-center">
            <div className="ml-3 relative">
              <div>
                <Button
                  variant="ghost"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center space-x-2 px-2 py-1 rounded-lg"
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="true"
                >
                  <span className="sr-only">Open user menu</span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user?.profileImage}
                      alt={`${user?.firstName} ${user?.lastName}`}
                    />
                    <AvatarFallback>
                      {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium text-forground">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user?.email}
                    </div>
                  </div>
                </Button>
              </div>
              {isProfileMenuOpen && (
                <>
                  {/* Mobile backdrop */}
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
                      <Link href="/super-admin/profile">
                        <User className="mr-2 h-4 w-4" />
                        Your Profile
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex w-full justify-start px-4 py-2 text-sm"
                      asChild
                    >
                      <Link href="/super-admin/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        System Settings
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex w-full justify-start px-4 py-2 text-sm text-destructive hover:text-destructive"
                      onClick={logout}
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