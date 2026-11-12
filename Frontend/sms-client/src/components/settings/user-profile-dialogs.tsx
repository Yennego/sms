'use client';

// Dialogs of "Your profile": change your password, and edit your photo, name and phone number.
// Students and parents keep the name the school recorded (the school office corrects it).

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import ImageUpload from '@/components/common/ImageUpload';
import { PASSWORD_RULES, newPasswordProblem, passwordChangeError } from '@/components/auth/change-password-form';
import { PasswordInput } from '@/components/auth/password-input';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/use-auth';
import type { User } from '@/types/auth';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputClass = 'h-11 text-base md:h-9 md:text-sm';

/** Students and parents can't change their own name. */
export function isNameLocked(user: User | null | undefined): boolean {
  const roleNames = [user?.role, user?.type, ...(user?.roles ?? []).map((r) => r?.name)];
  return roleNames.some((r) => r === 'student' || r === 'parent');
}

export function ChangePasswordDialog({ isOpen, onClose }: DialogProps) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string>();

  const save = useMutation({ mutationFn: () => changePassword(currentPassword, newPassword) });

  const close = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(undefined);
    onClose();
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }
    const problem = newPasswordProblem(newPassword, confirmPassword);
    if (problem) {
      setError(problem);
      return;
    }
    setError(undefined);
    try {
      await save.mutateAsync();
      notify.success('Password changed. Use the new one next time you sign in.');
      close();
    } catch (err) {
      setError(passwordChangeError(err));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !save.isPending && close()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSave} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Enter your current password, then the new one twice.</DialogDescription>
          </DialogHeader>
          <FormField label="Current password">
            <PasswordInput
              autoComplete="current-password"
              className={inputClass}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </FormField>
          <FormField label="New password" description={PASSWORD_RULES}>
            <PasswordInput
              autoComplete="new-password"
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </FormField>
          <FormField label="Type the new password again" error={error}>
            <PasswordInput
              autoComplete="new-password"
              className={inputClass}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={close} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11 md:min-h-9" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UpdateProfileDialog({ isOpen, onClose }: DialogProps) {
  const { user, updateUser } = useAuth();
  const nameLocked = isNameLocked(user);
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [profilePicture, setProfilePicture] = React.useState('');
  const [error, setError] = React.useState<string>();

  // Start from the saved details each time the dialog opens
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  const key = isOpen && user ? user.id : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key && user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setPhoneNumber(user.phone || '');
      setProfilePicture(user.profileImage || '');
      setError(undefined);
    }
  }

  const save = useMutation({
    mutationFn: (userId: string) =>
      updateUser(userId, {
        ...(nameLocked ? {} : { first_name: firstName.trim(), last_name: lastName.trim() }),
        phone_number: phoneNumber.trim(),
        profile_picture: profilePicture,
      }),
  });

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!nameLocked && (!firstName.trim() || !lastName.trim())) {
      setError('Enter your first and last name.');
      return;
    }
    setError(undefined);
    try {
      await save.mutateAsync(user.id);
      notify.success('Profile saved.');
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "Your profile wasn't saved. Check your connection and try again."));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <form onSubmit={onSave} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Your photo, name and phone number as the school sees them.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm font-medium">Profile photo</span>
            <ImageUpload
              value={profilePicture}
              onChange={(url: string) => setProfilePicture(url)}
              folder="profile-pictures"
              placeholder="Upload a photo"
              aspectRatio="square"
              className="h-32 w-32"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" error={error}>
              <Input
                className={inputClass}
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={nameLocked}
              />
            </FormField>
            <FormField label="Last name">
              <Input
                className={inputClass}
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={nameLocked}
              />
            </FormField>
          </div>
          {nameLocked ? (
            <p className="-mt-2 text-sm text-muted-foreground">To correct your name, ask the school office.</p>
          ) : null}
          <FormField label="Phone number">
            <Input
              type="tel"
              className={inputClass}
              autoComplete="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11 md:min-h-9" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save profile
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
