'use client';

// Logo and colours: the school admin's own branding. The school's name (printed on report cards and
// receipts) and its web address (in every saved link) are set by the platform operator and shown here
// read only; the address, motto and contacts are under School profile.

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2, Lock, Save } from 'lucide-react';

import ImageUpload from '@/components/common/ImageUpload';
import PermissionGuard from '@/components/auth/permission-guard';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { notify } from '@/components/ui/toaster';
import { useTenant } from '@/hooks/use-tenant';
import { useTenantService } from '@/services/api/tenant-service';

const HEX = /^#[0-9a-fA-F]{6}$/;
const inputClass = 'h-11 text-base md:h-9 md:text-sm';

function ColourField({ id, label, value, onChange, error }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <FormField label={label} error={error} id={id}>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`${label}, colour picker`}
          value={HEX.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 cursor-pointer rounded-md border p-1 md:h-9"
        />
        <Input id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} placeholder="#3B82F6" />
      </div>
    </FormField>
  );
}

function BrandingForm() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const { tenant, refreshTenant } = useTenant();
  const tenantService = useTenantService();
  const [saving, setSaving] = React.useState(false);
  const [logo, setLogo] = React.useState('');
  const [primary, setPrimary] = React.useState('#3B82F6');
  const [secondary, setSecondary] = React.useState('#1E40AF');
  const [errors, setErrors] = React.useState<{ primary?: string; secondary?: string }>({});

  React.useEffect(() => {
    if (!tenant) return;
    setLogo(tenant.logo || '');
    setPrimary(tenant.primaryColor || '#3B82F6');
    setSecondary(tenant.secondaryColor || '#1E40AF');
  }, [tenant]);

  const onSave = async () => {
    const next: typeof errors = {};
    if (!HEX.test(primary)) next.primary = 'Use a colour like #3B82F6.';
    if (!HEX.test(secondary)) next.secondary = 'Use a colour like #1E40AF.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await tenantService.updateOwnTenant({ logo, primaryColor: primary, secondaryColor: secondary });
      notify.success('Logo and colours saved.');
      refreshTenant?.();
    } catch (err) {
      notify.error(errorMessage(err, "The logo and colours weren't saved. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const address = typeof window !== 'undefined' ? `${window.location.host}/${tenant?.domain ?? tenantDomain}` : '';

  return (
    <PageShell
      title="Logo and colours"
      description="How your school looks in the app. The school's address, motto and contacts are under School profile."
      primaryAction={
        <Button className="min-h-11 md:min-h-9" onClick={onSave} disabled={saving || !tenant}>
          {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          Save logo and colours
        </Button>
      }
    >
      <section className="space-y-3 rounded-xl border bg-card p-4 md:p-6" aria-label="Name and web address">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            The school&apos;s name appears on report cards and receipts, and its web address is in every link people
            have saved. Only the platform operator changes them: contact them if they need to change.
          </p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">School name</dt>
            <dd className="font-medium">{tenant?.name ?? '–'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Web address</dt>
            <dd className="break-all font-medium">{address || '–'}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-6 rounded-xl border bg-card p-4 md:grid-cols-3 md:p-6" aria-label="Logo and colours">
        <div className="space-y-2">
          <p className="text-sm font-medium">Logo</p>
          <ImageUpload value={logo} onChange={setLogo} folder="logos" aspectRatio="square" placeholder="Choose or drop a logo" disabled={saving} />
          <p className="text-sm text-muted-foreground">A square PNG or JPG, about 200 × 200 pixels.</p>
        </div>
        <div className="grid content-start gap-4 md:col-span-2">
          <ColourField id="primary-colour" label="Main colour" value={primary} onChange={setPrimary} error={errors.primary} />
          <ColourField id="secondary-colour" label="Second colour" value={secondary} onChange={setSecondary} error={errors.secondary} />
          <p className="text-sm text-muted-foreground">
            The logo on report cards and receipts is set under{' '}
            <Link href={`/${tenantDomain}/settings/school-profile`} className="text-primary underline-offset-4 hover:underline">
              School profile
            </Link>
            .
          </p>
        </div>
      </section>
    </PageShell>
  );
}

export default function LogoAndColoursPage() {
  return (
    <PermissionGuard
      requiredPermissions={['manage_tenant_settings']}
      fallback={
        <PageShell title="Logo and colours">
          <EmptyState icon={Lock} description="Only the school's admins change the logo and colours." />
        </PageShell>
      }
    >
      <BrandingForm />
    </PermissionGuard>
  );
}
