'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, FileText, BarChart3 } from 'lucide-react';
import { useAttendanceService } from '@/services/api/attendance-service';

export default function AttendanceReportsPage() {
  const router = useRouter();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user, isLoading: authLoading } = useAuth();
  const { generateAttendanceReport } = useAttendanceService();
  const [loading, setLoading] = useState(false);

  const userRole = user?.role || 
    (Array.isArray(user?.roles) && user.roles.length > 0 ? 
      (typeof user.roles[0] === 'string' ? 
        user.roles[0] : 
        user.roles[0].name) : 
      'admin');

  useEffect(() => {
    if (!authLoading && !user) {
      if (tenant?.domain) {
        router.push(`/${tenant.domain}/login`);
      } else {
        router.push('/login');
      }
    }
  }, [user, authLoading, router, tenant]);

  const hasPermission = userRole === 'admin' || userRole === 'teacher';

  const handleGenerateReport = async (reportType: string) => {
    if (!tenant?.id) return;
    
    try {
      setLoading(true);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1); // Last month
      
      const report = await generateAttendanceReport(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        reportType
      );
      
      // Handle report download or display
      console.log('Generated report:', report);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (tenantLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          <p className="text-gray-500">Please wait...</p>
        </div>
      </div>
    );
  }

  if (!user || !hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
          <p className="text-gray-700">You &#39;don&#39;t have permission to view reports.</p>
          <Button 
            onClick={() => router.push(`/${tenant?.domain}/attendance`)} 
            className="mt-4"
          >
            Back to Attendance
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => router.push(`/${tenant?.domain}/attendance`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Attendance Reports</h1>
          <p className="text-gray-600 mt-1">
            Generate and view detailed attendance reports
          </p>
        </div>
      </div>

      {/* Report Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Daily Summary
            </CardTitle>
            <CardDescription>
              Daily attendance summary report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleGenerateReport('daily')}
              disabled={loading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              Monthly Analysis
            </CardTitle>
            <CardDescription>
              Monthly attendance analysis and trends
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleGenerateReport('monthly')}
              disabled={loading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Student Report
            </CardTitle>
            <CardDescription>
              Individual student attendance report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleGenerateReport('student')}
              disabled={loading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
