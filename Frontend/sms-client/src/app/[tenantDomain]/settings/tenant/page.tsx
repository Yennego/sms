'use client';

import { useState, useEffect } from 'react';
import { useTenant } from '@/hooks/use-tenant';
import { useTenantService } from '@/services/api/tenant-service';
import PermissionGuard from '@/components/auth/permission-guard';
import ImageUpload from '@/components/common/ImageUpload';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function TenantSettingsPage() {
  const { tenant, refreshTenant } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const tenantService = useTenantService();

  // Form state
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [logo, setLogo] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#1E40AF');

  // Initialize form with tenant data
  useEffect(() => {
    if (tenant) {
      setName(tenant.name || '');
      setDomain(tenant.domain || '');
      setSubdomain(tenant.subdomain || '');
      setLogo(tenant.logo || '');
      setPrimaryColor(tenant.primaryColor || '#3B82F6');
      setSecondaryColor(tenant.secondaryColor || '#1E40AF');
    }
  }, [tenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenant?.id) {
      toast.error('No tenant context available');
      return;
    }

    setIsLoading(true);
    try {
      // Use the tenant admin-accessible endpoint
      await tenantService.updateOwnTenant({
        name,
        domain,
        subdomain,
        logo,
        primaryColor,
        secondaryColor,
      });
      toast.success('School settings updated successfully');
      // Refresh tenant context to reflect changes
      if (refreshTenant) {
        refreshTenant();
      }
    } catch (error: any) {
      console.error('Failed to save tenant settings:', error);
      // Show user-friendly error message
      if (error?.message?.includes('permission') || error?.message?.includes('privileges') || error?.message?.includes('403')) {
        toast.error('You do not have permission to update school settings. Please contact your administrator.');
      } else if (error?.message) {
        toast.error(error.message);
      } else {
        toast.error('Failed to save settings. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PermissionGuard requiredRole="admin" fallback={<div className="p-6 text-center text-muted-foreground">You do not have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">School Settings</h1>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Logo Upload Card */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>School Logo</CardTitle>
                <CardDescription>Upload your school's logo image</CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUpload
                  value={logo}
                  onChange={setLogo}
                  folder="logos"
                  aspectRatio="square"
                  placeholder="Click or drag to upload logo"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Recommended: 200x200px, PNG or JPG
                </p>
              </CardContent>
            </Card>

            {/* Settings Form Card */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>School Configuration</CardTitle>
                <CardDescription>Manage your school's branding and configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">School/Organization Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter school name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="Enter domain (e.g., example.com)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subdomain">Subdomain</Label>
                    <Input
                      id="subdomain"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      placeholder="Enter subdomain (e.g., school)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logoUrl">Logo URL (optional)</Label>
                    <Input
                      id="logoUrl"
                      value={logo}
                      onChange={(e) => setLogo(e.target.value)}
                      placeholder="Or paste a logo URL"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        id="primaryColor"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        placeholder="#3B82F6"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        id="secondaryColor"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        placeholder="#1E40AF"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </PermissionGuard>
  );
}