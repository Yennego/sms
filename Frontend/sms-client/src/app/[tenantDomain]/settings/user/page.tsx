'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Mail, Building, Shield } from 'lucide-react';
import {
  ChangePasswordDialog,
  UpdateProfileDialog,
  NotificationPreferencesDialog
} from '@/components/settings/user-profile-dialogs';

export default function UserSettingsPage() {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const [activeDialog, setActiveDialog] = useState<'password' | 'profile' | 'notifications' | null>(null);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">User Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your personal information</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="h-24 w-24 rounded-full overflow-hidden bg-primary flex items-center justify-center text-primary-foreground text-3xl mb-4 border-2 border-primary/20 shadow-sm">
                {user?.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={`${user.firstName} ${user.lastName}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <>
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </>
                )}
              </div>
              <h3 className="text-xl font-semibold">{user?.firstName} {user?.lastName}</h3>
              <p className="text-muted-foreground">{user?.role}</p>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-3 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Full Name</p>
                    <p className="text-sm text-muted-foreground">{user?.firstName} {user?.lastName}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Mail className="h-5 w-5 mr-3 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Building className="h-5 w-5 mr-3 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Organization</p>
                    <p className="text-sm text-muted-foreground">{tenant?.name || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Shield className="h-5 w-5 mr-3 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Role</p>
                    <p className="text-sm text-muted-foreground">{user?.role}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Manage your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setActiveDialog('password')}
                >
                  Change Password
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setActiveDialog('profile')}
                >
                  Update Profile
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setActiveDialog('notifications')}
                >
                  Notification Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ChangePasswordDialog
        isOpen={activeDialog === 'password'}
        onClose={() => setActiveDialog(null)}
      />
      <UpdateProfileDialog
        isOpen={activeDialog === 'profile'}
        onClose={() => setActiveDialog(null)}
      />
      <NotificationPreferencesDialog
        isOpen={activeDialog === 'notifications'}
        onClose={() => setActiveDialog(null)}
      />
    </div>
  );
}