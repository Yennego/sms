'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, BarChart3, TrendingUp, Users, ShieldAlert, DollarSign, CreditCard } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { useAuth } from '@/hooks/use-auth';
import { useSuperAdminService } from '@/services/api/super-admin-service';
import {
  useSuperAdminTenantStats,
  useSuperAdminUserStats,
  useSuperAdminSystemMetrics,
  useSuperAdminRecentTenants,
  useSuperAdminUserList,
  useSuperAdminRoles,
  useSuperAdminRoleStatistics,
  useSuperAdminRevenueByTenant
} from '@/hooks/queries/super-admin';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';
import { UserWithRoles } from '@/services/api/super-admin-service';

// Dynamic role type - no longer static
type UserRole = string;

export default function SuperAdminDashboard() {
  const { user: currentUser } = useAuth();

  // nuqs URL state
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''));
  const [userRole, setUserRole] = useQueryState('role', parseAsString.withDefault('all'));
  const [dateRange, setDateRange] = useQueryState('range', parseAsString.withDefault('all'));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const usersPerPage = 10;

  // TanStack Query Hooks
  const { data: tenantStats, isLoading: tenantLoading } = useSuperAdminTenantStats();
  const { data: userStats, isLoading: userLoading } = useSuperAdminUserStats();

  // Memoize options to prevent infinite refetch loops
  const systemMetricsOptions = React.useMemo(() => ({ refetchInterval: 30000 }), []);
  const { data: systemMetrics, isLoading: systemLoading } = useSuperAdminSystemMetrics(systemMetricsOptions);

  const { data: recentTenants, isLoading: recentLoading } = useSuperAdminRecentTenants();
  const { data: roles, isLoading: rolesLoading } = useSuperAdminRoles();
  const { data: roleStats, isLoading: roleStatsLoading } = useSuperAdminRoleStatistics();
  const { data: revenueByTenant, isLoading: revenueLoading } = useSuperAdminRevenueByTenant();

  // Fetch users with a high limit for the overview table/analytics
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useSuperAdminUserList({ limit: 1000 });

  const isLoading = tenantLoading || userLoading || systemLoading || recentLoading || rolesLoading || usersLoading || roleStatsLoading || revenueLoading;

  const usersList = React.useMemo(() => users?.items || [], [users]);

  // Filter functions with null safety
  const filteredUsers = React.useMemo(() => {
    return usersList.filter((user: UserWithRoles) => {
      const matchesSearch = search === '' ||
        (user.first_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (user.last_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (user.email?.toLowerCase() || '').includes(search.toLowerCase());

      const matchesRole = userRole === 'all' ||
        (user.roles && user.roles.some((role: any) => role.name === userRole));

      return matchesSearch && matchesRole;
    });
  }, [usersList, search, userRole]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const startIndex = (page - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const currentUsers = React.useMemo(() => filteredUsers.slice(startIndex, endIndex), [filteredUsers, startIndex, endIndex]);

  // TanStack Table Setup
  const columnHelper = createColumnHelper<UserWithRoles>();

  const getRoleBadgeColor = React.useCallback((roleName: string) => {
    const roleColors: { [key: string]: string } = {
      'super-admin': 'bg-red-100 text-red-800',
      'admin': 'bg-blue-100 text-blue-800',
      'financial-admin': 'bg-green-100 text-green-800',
      'academic-admin': 'bg-purple-100 text-purple-800',
      'tenant-admin': 'bg-orange-100 text-orange-800',
      'registrar': 'bg-indigo-100 text-indigo-800',
      'teacher': 'bg-yellow-100 text-yellow-800',
      'student': 'bg-gray-100 text-gray-800',
      'parent': 'bg-pink-100 text-pink-800',
      'counselor': 'bg-teal-100 text-teal-800',
      'accountant': 'bg-cyan-100 text-cyan-800'
    };
    return roleColors[roleName] || 'bg-gray-100 text-gray-800';
  }, []);

  const columns = React.useMemo(() => [
    columnHelper.accessor(row => `${row.first_name || ''} ${row.last_name || ''}`.trim(), {
      id: 'name',
      header: 'Name',
      cell: info => <span className="font-medium text-gray-900">{info.getValue() || 'Unnamed User'}</span>,
    }),
    columnHelper.accessor('email', {
      header: 'Email',
    }),
    columnHelper.accessor('roles', {
      header: 'Roles',
      cell: info => (
        <div className="flex flex-wrap gap-1">
          {(info.getValue() || []).map((role) => (
            <Badge key={role.id} className={getRoleBadgeColor(role.name)}>
              {role.displayName || role.name}
            </Badge>
          ))}
        </div>
      ),
    }),
    columnHelper.accessor('is_active', {
      header: 'Status',
      cell: info => (
        <Badge variant={info.getValue() ? 'default' : 'secondary'}>
          {info.getValue() ? 'Active' : 'Inactive'}
        </Badge>
      ),
    }),
  ], [columnHelper, getRoleBadgeColor]);

  const table = useReactTable({
    data: currentUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Pagination handlers
  const goToPage = React.useCallback((newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  }, [setPage, totalPages]);

  const goToPreviousPage = React.useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    }
  }, [page, setPage]);

  const goToNextPage = React.useCallback(() => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  }, [page, totalPages, setPage]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="text-muted-foreground animate-pulse">Loading SaaS insights...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Welcome, {currentUser?.firstName || 'User'}!</h1>
        <Button onClick={() => refetchUsers()}>Refresh Data</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search Users</Label>
              <Input
                id="search"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div>
              <Label htmlFor="userRole">User Role</Label>
              <Select value={userRole} onValueChange={(value) => {
                setUserRole(value);
                setPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {Array.isArray(roles) && roles.map((role: any) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name.charAt(0).toUpperCase() + role.name.slice(1).replace('-', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dateRange">Date Range</Label>
              <Select value={dateRange} onValueChange={(value) => setDateRange(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenantStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 font-medium">{tenantStats?.active || 0} active</span>, {tenantStats?.inactive || 0} inactive
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {userStats?.avgPerTenant || 0} avg per tenant
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{tenantStats?.growthRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {tenantStats?.newThisMonth || 0} new tenants (30d)
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-orange-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Logins</CardTitle>
            <ShieldAlert className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats?.recentLogins || 0}</div>
            <p className="text-xs text-muted-foreground">
              Users active in last 24h
            </p>
          </CardContent>
        </Card>

        {/* New Revenue Card */}
        <Card className="hover:shadow-md transition-shadow border-green-100 bg-green-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              ${systemMetrics?.revenue_metrics?.total_monthly_revenue?.toLocaleString() || '0.00'}
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <p className="text-[10px] text-muted-foreground flex justify-between">
                <span>Flat Rate:</span>
                <span className="font-semibold">${systemMetrics?.revenue_metrics?.flat_rate_revenue?.toLocaleString() || '0.00'}</span>
              </p>
              <p className="text-[10px] text-muted-foreground flex justify-between">
                <span>Per User:</span>
                <span className="font-semibold">${systemMetrics?.revenue_metrics?.per_user_revenue?.toLocaleString() || '0.00'}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Growth Trends</CardTitle>
          <CardDescription>Cumulative tenant registrations over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={systemMetrics?.tenantGrowth || []}>
              <defs>
                <linearGradient id="colorTenants" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#666', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#666', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Area
                type="monotone"
                dataKey="tenants"
                stroke="#0ea5e9"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorTenants)"
                name="Total Tenants"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Tenant</CardTitle>
            <CardDescription>Monthly revenue breakdown per tenant (excludes admins/no-role)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Billable Users</TableHead>
                    <TableHead className="text-right">Monthly Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueByTenant?.map((tenant) => (
                    <TableRow key={tenant.tenant_id}>
                      <TableCell className="font-medium">{tenant.tenant_name}</TableCell>
                      <TableCell className="capitalize">{tenant.plan_type.replace('_', ' ')} (${tenant.plan_amount})</TableCell>
                      <TableCell className="text-right">{tenant.billable_users}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        ${tenant.monthly_revenue.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!revenueByTenant || revenueByTenant.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        No revenue data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Role Distribution (moved inside the grid) */}
        <Card>
          <CardHeader>
            <CardTitle>User Role Distribution</CardTitle>
            <CardDescription>Breakdown of users by role (Total: {userStats?.total || 0})</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {Array.isArray(roleStats) && roleStats.map((stat) => (
                <div key={stat.name} className="text-center p-3 border rounded-lg bg-gray-50/50">
                  <div className="text-xl font-bold">{stat.count}</div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.name.replace('-', ' ')}</div>
                  <div className="text-[10px] text-muted-foreground">{stat.percentage.toFixed(1)}%</div>
                </div>
              ))}
              {userStats && userStats.usersWithoutRoles > 0 && (
                <div className="text-center p-3 border rounded-lg bg-orange-50/50 border-orange-100">
                  <div className="text-xl font-bold text-orange-700">{userStats.usersWithoutRoles}</div>
                  <div className="text-xs font-medium text-orange-600 uppercase tracking-wider">No Role assigned</div>
                  <div className="text-[10px] text-orange-500">
                    {((userStats.usersWithoutRoles / (userStats.total || 1)) * 100).toFixed(1)}% (Not Billable)
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table and Recent Tenants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users Table with Pagination */}
        <Card>
          <CardHeader>
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
            <CardDescription>Detailed user information with role assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Table */}
              <div className="max-h-96 overflow-auto">
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
                    {table.getRowModel().rows.map(row => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map(cell => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousPage}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    <div className="flex items-center space-x-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => {
                          // Show first page, last page, current page, and pages around current
                          return p === 1 ||
                            p === totalPages ||
                            Math.abs(p - page) <= 1;
                        })
                        .map((p, index, array) => {
                          // Add ellipsis if there's a gap
                          const prevPage = array[index - 1];
                          const showEllipsis = prevPage && p - prevPage > 1;

                          return (
                            <React.Fragment key={p}>
                              {showEllipsis && (
                                <span className="px-2 text-muted-foreground">...</span>
                              )}
                              <Button
                                variant={page === p ? "default" : "outline"}
                                size="sm"
                                onClick={() => goToPage(p)}
                                className="w-8 h-8 p-0"
                              >
                                {p}
                              </Button>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      disabled={page === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Tenants */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Tenants</CardTitle>
            <CardDescription>Latest tenant registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.isArray(recentTenants) && recentTenants.slice(0, 5).map((tenant) => (
                <div key={tenant.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{tenant.name}</div>
                    <div className="text-sm text-muted-foreground">{tenant.domain}</div>
                  </div>
                  <Badge variant={tenant.isActive ? 'default' : 'secondary'}>
                    {tenant.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}