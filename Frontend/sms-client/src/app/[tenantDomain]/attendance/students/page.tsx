'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, User } from 'lucide-react';
import { useStudentService } from '@/services/api/student-service';
import { Student } from '@/types/student';

export default function AttendanceStudentsPage() {
  const router = useRouter();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user, isLoading: authLoading } = useAuth();
  const { getStudents } = useStudentService();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const loadStudents = async () => {
      if (!tenant?.id) return;
      
      try {
        setLoading(true);
        const studentsData = await getStudents();
        setStudents(studentsData);
        setFilteredStudents(studentsData);
      } catch (error) {
        console.error('Error loading students:', error);
      } finally {
        setLoading(false);
      }
    };

    if (tenant?.id && user) {
      loadStudents();
    }
  }, [tenant?.id, user, getStudents]);

  useEffect(() => {
    const filtered = students.filter(student => 
      student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredStudents(filtered);
  }, [searchTerm, students]);

  const hasPermission = userRole === 'admin' || userRole === 'teacher';

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
          <p className="text-gray-700">You &#39;don&#39;t have permission to view student records.</p>
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
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Student Attendance Records</h1>
          <p className="text-gray-600 mt-1">
            View individual student attendance history
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search students by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Students Grid */}
      {loading ? (
        <div className="text-center py-8">
          <p>Loading students...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => (
            <Card 
              key={student.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(`/${tenant?.domain}/attendance/students/${student.id}`)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  {student.firstName} {student.lastName}
                </CardTitle>
                <CardDescription>
                  Student ID: {student.studentId}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Click to view detailed attendance history
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredStudents.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-gray-500">No students found matching your search.</p>
        </div>
      )}
    </div>
  );
}
