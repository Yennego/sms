'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Building,
  Users,
  Settings,
  Shield,
  Lock,
  Database,
  Activity,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Global Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
  { name: 'Tenant Management', href: '/super-admin/tenants', icon: Building },
  { name: 'User Management', href: '/super-admin/users', icon: Users },
  { name: 'Roles & Permissions', href: '/super-admin/roles-permissions', icon: Shield },
  { name: 'Security & Audit', href: '/super-admin/security', icon: Lock },
  { name: 'System Settings', href: '/super-admin/settings', icon: Settings },
  { name: 'Profile', href: '/super-admin/profile', icon: User },
  { name: 'Database', href: '/super-admin/database', icon: Database },
  { name: 'System Health', href: '/super-admin/health', icon: Activity },
];

interface SuperAdminSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  isCollapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

export default function SuperAdminSidebar({ 
  isOpen = false, 
  onToggle, 
  isCollapsed = false, 
  onCollapse 
}: SuperAdminSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleCollapse = () => {
    onCollapse?.(!isCollapsed);
  };

  if (!isMounted) {
    return null;
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out md:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "flex flex-col transition-all duration-300 ease-in-out",
        "bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        // Mobile styles - fixed positioning
        "fixed inset-y-0 left-0 z-50 w-64 transform md:transform-none",
        isOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop styles - relative positioning, no margins needed
        "md:relative md:translate-x-0 md:flex-shrink-0",
        isCollapsed ? "md:w-16" : "md:w-64"
      )}>
        {/* Header */}
        <div className="flex items-center h-16 flex-shrink-0 px-4 border-b border-sidebar-border">
          {!isCollapsed && (
            <span className="text-xl font-semibold transition-opacity duration-200">
              Super Admin Portal
            </span>
          )}
          {isCollapsed && (
            <Shield className="h-8 w-8 mx-auto text-primary" />
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 flex flex-col overflow-y-auto pt-5 pb-4">
          <nav className="flex-1 px-3 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="no-underline"
                  title={isCollapsed ? item.name : undefined}
                >
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full mb-1 transition-all duration-200",
                      isCollapsed ? "justify-center px-2" : "justify-start",
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Icon className={cn(
                      "h-4 w-4 flex-shrink-0",
                      !isCollapsed && "mr-2"
                    )} />
                    {!isCollapsed && (
                      <span className="transition-opacity duration-200">
                        {item.name}
                      </span>
                    )}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Collapse Toggle (Desktop only) */}
        <div className="hidden md:block p-2 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCollapse}
            className={cn(
              "w-full transition-all duration-200",
              isCollapsed ? "justify-center px-2" : "justify-start"
            )}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-sidebar-border">
          <div className={cn(
            "flex items-center transition-all duration-200",
            isCollapsed && "justify-center"
          )}>
            <div className="h-9 w-9 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground flex-shrink-0">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </div>
            {!isCollapsed && (
              <>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-sidebar-foreground/70 truncate">
                    Super Administrator
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={logout} 
                  title="Sign out"
                  className="flex-shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
            {isCollapsed && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={logout} 
                title="Sign out"
                className="mt-2"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}