'use client';

// School settings: one place that links to every settings page, grouped by what they're for.
// Cards for an area the school has switched off are left out.

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Bell, Building2, CalendarCheck, ChevronRight, CreditCard, History, MailCheck, Palette, ShieldCheck,
  UserCog, Users, type LucideIcon,
} from 'lucide-react';

import { PageShell } from '@/components/ui/page-shell';
import { useTenantFeatures } from '@/hooks/use-tenant-features';

interface SettingsLink {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  feature?: string;
}

const SECTIONS: { id: string; title: string; links: SettingsLink[] }[] = [
  {
    id: 'school',
    title: 'Your school',
    links: [
      {
        title: 'School profile',
        description: 'Logo, address, motto, contacts, principal and seal printed on report cards',
        href: '/settings/school-profile',
        icon: Building2,
      },
      { title: 'Logo and colours', description: 'How the school looks in the app', href: '/settings/tenant', icon: Palette },
      { title: 'Billing', description: 'Amount due, invoices, receipts and the data export', href: '/settings/billing', icon: CreditCard },
    ],
  },
  {
    id: 'people',
    title: 'People and access',
    links: [
      { title: 'Users', description: 'Everyone who signs in, new staff accounts and password resets', href: '/admin/users', icon: Users },
      { title: 'Roles', description: 'What each role allows at your school', href: '/admin/roles', icon: ShieldCheck },
      { title: 'Role assignment', description: 'Give roles to your staff', href: '/admin/role-assignment', icon: UserCog },
    ],
  },
  {
    id: 'rules',
    title: 'School rules',
    links: [
      {
        title: 'Attendance rules',
        description: 'School days, late and cut-off times, holidays',
        href: '/settings/attendance',
        icon: CalendarCheck,
        feature: 'enable_attendance',
      },
    ],
  },
  {
    id: 'records',
    title: 'Alerts and records',
    links: [
      { title: 'Notification settings', description: 'Which alerts you also get by email', href: '/settings/notifications', icon: Bell },
      { title: 'Delivery log', description: 'Alert emails sent, waiting and failed', href: '/settings/deliveries', icon: MailCheck },
      { title: 'Audit log', description: 'Who added, changed or deleted what, and when', href: '/admin/activity-logs', icon: History },
    ],
  },
];

export default function SettingsPage() {
  // Inside the school's address (/{school}/settings/...), not the bare /settings/...
  const params = useParams();
  const school = params?.tenantDomain as string;
  const { isFeatureEnabled } = useTenantFeatures();

  const sections = SECTIONS.map((s) => ({
    ...s,
    links: s.links.filter((l) => !l.feature || isFeatureEnabled(l.feature)),
  })).filter((s) => s.links.length > 0);

  return (
    <PageShell title="School settings" description="How your school is set up in the app, who can do what, and its records.">
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`settings-${section.id}`} className="space-y-3">
          <h2 id={`settings-${section.id}`} className="text-base font-semibold">
            {section.title}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.links.map(({ title, description, href, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={`/${school}${href}`}
                  className="flex h-full min-h-11 items-start gap-3 rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{title}</span>
                    <span className="block text-sm text-muted-foreground">{description}</span>
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PageShell>
  );
}
