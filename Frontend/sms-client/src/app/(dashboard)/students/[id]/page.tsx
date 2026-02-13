'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStudentService } from '@/services/api/student-service';
import { Student } from '@/types/student';

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;
  
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  
  const studentService = useStudentService();
  
  useEffect(() => {
    const fetchStudent = async () => {
      try {
        setLoading(true);
        const data = await studentService.getStudentById(studentId);
        setStudent(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch student:', err);
        setError('Failed to load student details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    if (studentId) {
      fetchStudent();
    }
  }, [studentId, studentService]);
  
  const handleStatusChange = async () => {
    if (!student || !newStatus) return;
    
    try {
      const updatedStudent = await studentService.updateStudentStatus(
        student.id,
        newStatus,
        statusReason || undefined
      );
      
      setStudent(updatedStudent);
      setShowStatusModal(false);
      setNewStatus('');
      setStatusReason('');
    } catch (err) {
      console.error('Failed to update student status:', err);
      alert('Failed to update student status. Please try again.');
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
        <p className="mt-2 text-gray-500">Loading student details...</p>
      </div>
    );
  }
  
  if (error || !student) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error || 'Student not found'}</p>
        </div>
        <button
          onClick={() => router.push('/students')}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Back to Students
        </button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Student Details</h1>
        <div className="flex space-x-4">
          <button
            onClick={() => {
              setNewStatus('');
              setStatusReason('');
              setShowStatusModal(true);
            }}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md"
          >
            Change Status
          </button>
          <Link
            href={`/students/${student.id}/edit`}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Edit Student
          </Link>
          <Link
            href="/students"
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
          >
            Back to List
          </Link>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden mb-6">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Personal Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="font-medium">{student.firstName} {student.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{student.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date of Birth</p>
                  <p className="font-medium">{student.date_of_birth || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Gender</p>
                  <p className="font-medium">{student.gender || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Blood Group</p>
                  <p className="font-medium">{student.blood_group || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nationality</p>
                  <p className="font-medium">{student.nationality || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Religion</p>
                  <p className="font-medium">{student.religion || 'Not specified'}</p>
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Academic Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Admission Number</p>
                  <p className="font-medium">{student.admission_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Roll Number</p>
                  <p className="font-medium">{student.roll_number || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Grade</p>
                  <p className="font-medium">{student.grade || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Section</p>
                  <p className="font-medium">{student.section || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Admission Date</p>
                  <p className="font-medium">{student.admission_date || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      student.status === 'active' ? 'bg-green-100 text-green-800' :
                      student.status === 'graduated' ? 'bg-blue-100 text-blue-800' :
                      student.status === 'withdrawn' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {student.status}
                    </span>
                  </p>
                </div>
                {student.status === 'graduated' && (
                  <div>
                    <p className="text-sm text-gray-500">Graduation Date</p>
                    <p className="font-medium">{student.graduation_date || 'Not specified'}</p>
                  </div>
                )}
                {student.status === 'withdrawn' && (
                  <div>
                    <p className="text-sm text-gray-500">Withdrawal Reason</p>
                    <p className="font-medium">{student.withdrawal_reason || 'Not specified'}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Contact Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{student.address || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">City</p>
                  <p className="font-medium">{student.city || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">County</p>
                  <p className="font-medium">{student.county || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Country</p>
                  <p className="font-medium">{student.country || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">WhatsApp Number</p>
                  <p className="font-medium">{student.whatsapp_number || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Emergency Contact</p>
                  <p className="font-medium">{student.emergency_contact || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Change Student Status</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Select Status</option>
                <option value="active">Active</option>
                <option value="graduated">Graduated</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            
            {(newStatus === 'withdrawn' || newStatus === 'suspended') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows={3}
                  placeholder={`Reason for ${newStatus === 'withdrawn' ? 'withdrawal' : 'suspension'}...`}
                />
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowStatusModal(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={!newStatus}
                className={`px-4 py-2 rounded-md text-white ${
                  !newStatus ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}