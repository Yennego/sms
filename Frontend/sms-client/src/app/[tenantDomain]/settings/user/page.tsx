'use client';

// Your profile: who you are at this school (name, sign-in, phone, roles), with editing your photo,
// name and phone number, changing your password, and links to your alert and signature settings.
// Students and parents can't change their name (the dialog says to ask the school office).

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bell, ChevronRight, KeyRound, PenLine, Pencil } from 'lucide-react';

import { ChangePasswordDialog, UpdateProfileDialog, isNameLocked } from '@/components/settings/user-profile-dialogs';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { roleLabel } from '@/config/permission-catalogue';
import { navigationFor, roleNames } from '@/config/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium sm:col-span-2">{value}</dd>
    </div>
  );
}

export default function UserSettingsPage() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [activeDialog, setActiveDialog] = React.useState<'password' | 'profile' | null>(null);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const initials = `${user?.firstName?.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}`.toUpperCase();
  const roles = roleNames(user).map(roleLabel);
  const links = [
    { label: 'Notification settings', description: 'Which alerts you also get by email', href: '/settings/notifications', icon: Bell },
    ...(user && navigationFor(user).signs
      ? [{ label: 'My signature', description: 'The signature printed on report cards you sign', href: '/settings/signature', icon: PenLine }]
      : []),
  ];

  return (
    <PageShell
      title="Your profile"
      description={`Your details at ${tenant?.name || 'your school'}.`}
      primaryAction={
        <Button className="min-h-11 md:min-h-9" onClick={() => setActiveDialog('profile')} disabled={!user}>
          <Pencil aria-hidden="true" />
          Edit profile
        </Button>
      }
      secondaryActions={
        <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setActiveDialog('password')} disabled={!user}>
          <KeyRound aria-hidden="true" />
          Change password
        </Button>
      }
      className="max-w-4xl"
    >
      {!user ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <section aria-label="Your details" className="rounded-xl border bg-card p-4 md:p-6">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xl font-semibold text-primary-foreground">
              {user.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded photo on another host
                <img src={user.profileImage} alt="" className="size-full object-cover" />
              ) : (
                <span aria-hidden="true">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{fullName || user.username || user.email}</p>
              {roles.length ? <p className="text-sm text-muted-foreground">{roles.join(', ')}</p> : null}
            </div>
          </div>

          <dl className="mt-4 divide-y border-t">
            <Detail
              label="Name"
              value={
                <>
                  {fullName || 'Not recorded'}
                  {isNameLocked(user) ? (
                    <span className="block text-sm font-normal text-muted-foreground">
                      To correct your name, ask the school office.
                    </span>
                  ) : null}
                </>
              }
            />
            {user.username ? <Detail label="Username" value={user.username} /> : null}
            <Detail label="Email" value={user.email || 'No email: you sign in with your username'} />
            <Detail label="Phone" value={user.phone || 'Not added'} />
            <Detail label="School" value={tenant?.name || '—'} />
          </dl>
        </section>
      )}

      <section aria-label="Your settings">
        <ul className="grid gap-3 sm:grid-cols-2">
          {links.map(({ label, description, href, icon: Icon }) => (
            <li key={href}>
              <Link
                href={`/${tenantDomain}${href}`}
                className="flex h-full min-h-11 items-start gap-3 rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{label}</span>
                  <span className="block text-sm text-muted-foreground">{description}</span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ChangePasswordDialog isOpen={activeDialog === 'password'} onClose={() => setActiveDialog(null)} />
      <UpdateProfileDialog isOpen={activeDialog === 'profile'} onClose={() => setActiveDialog(null)} />
    </PageShell>
  );
}
