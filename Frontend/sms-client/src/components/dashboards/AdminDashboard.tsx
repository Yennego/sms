'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, GraduationCap, School, AlertCircle, TrendingUp, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAdminDashboardStats } from '@/hooks/queries/dashboard';

export default function AdminDashboard() {
  // Use TanStack Query with 3s refetch interval for "real-time" updates
  const {
    data: dashboardData,
    isLoading,
    isFetching,
    error: queryError
  } = useAdminDashboardStats({
    refetchInterval: 3000 // Poll every 3 seconds for real-time feel
  });

  // Prepare data for charts (Moved before early returns to comply with Rules of Hooks)
  const chartsData = useMemo(() => {
    if (!dashboardData) return { userDistribution: [], activity: [], growth: [] };

    return {
      userDistribution: [
        { name: 'Students', value: dashboardData.students.total, color: '#0088FE' },
        { name: 'Teachers', value: dashboardData.teachers.total, color: '#00C49F' },
        { name: 'Other Users', value: dashboardData.users.total - dashboardData.students.total - dashboardData.teachers.total, color: '#FFBB28' }
      ],
      activity: [
        { name: 'Active Students', value: dashboardData.students.active },
        { name: 'Inactive Students', value: dashboardData.students.inactive },
        { name: 'Active Teachers', value: dashboardData.teachers.active },
        { name: 'Inactive Teachers', value: dashboardData.teachers.inactive }
      ],
      growth: [
        {
          name: 'Students',
          growth: dashboardData.students.growth_rate,
          newUsers: dashboardData.students.new_this_month
        },
        {
          name: 'Teachers',
          growth: dashboardData.teachers.total > 0 ? Math.round((dashboardData.teachers.new_this_month / dashboardData.teachers.total) * 100) : 0,
          newUsers: dashboardData.teachers.new_this_month
        }
      ]
    };
  }, [dashboardData]);

  if (isLoading && !dashboardData) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>{queryError instanceof Error ? queryError.message : 'Failed to load dashboard data'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dashboardData || !chartsData) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Activity className={`h-4 w-4 ${isFetching ? 'text-blue-500 animate-pulse' : ''}`} />
          <span>{isFetching ? 'Refreshing…' : 'Live Data'}</span>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{dashboardData.students.total}</div>
            <div className="flex items-center space-x-2 text-xs">
              <TrendingUp className={`h-3 w-3 ${dashboardData.students.growth_rate > 0 ? 'text-green-500' : 'text-red-500'}`} />
              <span className={dashboardData.students.growth_rate > 0 ? 'text-green-600' : 'text-red-600'}>
                {dashboardData.students.growth_rate > 0 ? '+' : ''}{dashboardData.students.growth_rate}% from last month
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboardData.students.active} active • {dashboardData.students.inactive} inactive
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{dashboardData.teachers.total}</div>
            <p className="text-xs text-green-600">
              +{dashboardData.teachers.new_this_month} new this month
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboardData.teachers.active} active • {dashboardData.teachers.inactive} inactive
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{dashboardData.classes.total}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.classes.active} active • {dashboardData.classes.inactive} inactive
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{dashboardData.users.total}</div>
            <p className="text-xs text-orange-600">
              {dashboardData.users.recent_logins} recent logins
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboardData.users.active} active users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>User Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartsData.userDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${percent !== undefined ? (percent * 100).toFixed(0) : '0'}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartsData.userDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Activity Status Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Activity Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData.activity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Growth Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Monthly Growth & New Registrations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.growth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="newUsers" fill="#8884d8" name="New Users" />
                <Bar yAxisId="right" dataKey="growth" fill="#82ca9d" name="Growth Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
