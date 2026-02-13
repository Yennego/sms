'use client';

import PermissionGuard from '@/components/auth/permission-guard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import React, { useEffect, useMemo, useState } from 'react';
import { useUserService } from '@/services/api/user-service';
import { User } from '@/types/auth';

export default function AdminUsersPage() {
  const userService = useUserService();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await userService.getUsers(0, 100);
        if (!cancelled) setUsers(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        console.error('Failed to load users:', err);
        const msg = err instanceof Error ? err.message : 'Failed to load users';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userService]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      [u.email, u.first_name, u.last_name, u.role, ...(u.roles?.map(r => r.name) || [])]
        .filter(Boolean)
        .some(val => String(val).toLowerCase().includes(q))
    );
  }, [users, search]);

  return (
    <PermissionGuard requiredRole="admin" requiredPermissions={['manage_users']} fallback={<div>Access denied</div>}>
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>Manage tenant users</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button>Create User</Button>
          </CardContent>
        </Card>

        {loading && <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading users…</div>}
        {error && <div className="rounded-md border p-4 text-sm text-red-500">{error}</div>}
        {!loading && !error && (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{(u.roles?.map(r => r.name).join(', ')) || u.role || '—'}</TableCell>
                    <TableCell>{u.isActive ? 'Active' : 'Inactive'}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">No users match your search.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
