'use client';

import PermissionGuard from '@/components/auth/permission-guard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import React, { useState } from 'react';

export default function AdminTenantsPage() {
  const [search, setSearch] = useState('');
  return (
    <PermissionGuard requiredRole="admin" requiredPermissions={['manage_tenants']} fallback={<div>Access denied</div>}>
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tenants</CardTitle>
            <CardDescription>Manage tenant settings</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input placeholder="Search tenants…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </CardContent>
        </Card>
        <div className="rounded-md border p-4 text-sm text-muted-foreground">Tenants list will appear here.</div>
      </div>
    </PermissionGuard>
  );
}