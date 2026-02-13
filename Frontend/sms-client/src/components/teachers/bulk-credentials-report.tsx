import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Download, 
  Copy, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Mail
} from 'lucide-react';
import { TeacherCreateResponse } from '@/types/teacher';

interface BulkCredentialsReportProps {
  teachers: TeacherCreateResponse[];
  onClose: () => void;
}

export function BulkCredentialsReport({ teachers, onClose }: BulkCredentialsReportProps) {
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [copiedItems, setCopiedItems] = useState<Record<string, boolean>>({});

  const teachersWithPasswords = teachers.filter(t => t.generated_password);
  const teachersWithoutPasswords = teachers.filter(t => !t.generated_password);

  const togglePasswordVisibility = (teacherId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [teacherId]: !prev[teacherId]
    }));
  };

  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => ({ ...prev, [itemId]: true }));
      setTimeout(() => {
        setCopiedItems(prev => ({ ...prev, [itemId]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Name', 'Email', 'Employee ID', 'Generated Password', 'WhatsApp', 'Status'].join(','),
      ...teachersWithPasswords.map(teacher => [
        `"${teacher.first_name} ${teacher.last_name}"`,
        teacher.email,
        teacher.employee_id,
        teacher.generated_password || '',
        teacher.whatsapp_number || '',
        'Password Generated'
      ].join(',')),
      ...teachersWithoutPasswords.map(teacher => [
        `"${teacher.first_name} ${teacher.last_name}"`,
        teacher.email,
        teacher.employee_id,
        'N/A',
        teacher.whatsapp_number || '',
        'Password Not Generated'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `teacher-credentials-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const printContent = `
      <html>
        <head>
          <title>Teacher Credentials Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; }
            .teacher-card { border: 1px solid #ddd; margin-bottom: 15px; padding: 15px; }
            .credentials { background: #fff3cd; padding: 10px; margin-top: 10px; }
            .warning { background: #f8d7da; padding: 10px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Teacher Credentials Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="summary">
            <h3>Summary</h3>
            <p>Total Teachers Created: ${teachers.length}</p>
            <p>Passwords Generated: ${teachersWithPasswords.length}</p>
            <p>Manual Password Setup Required: ${teachersWithoutPasswords.length}</p>
          </div>
          
          ${teachersWithPasswords.map(teacher => `
            <div class="teacher-card">
              <h4>${teacher.first_name} ${teacher.last_name}</h4>
              <p><strong>Email:</strong> ${teacher.email}</p>
              <p><strong>Employee ID:</strong> ${teacher.employee_id}</p>
              ${teacher.whatsapp_number ? `<p><strong>WhatsApp:</strong> ${teacher.whatsapp_number}</p>` : ''}
              <div class="credentials">
                <strong>Generated Password:</strong> ${teacher.generated_password}
                <br><small>⚠️ Please share this password securely with the teacher</small>
              </div>
            </div>
          `).join('')}
          
          ${teachersWithoutPasswords.length > 0 ? `
            <h3>Teachers Requiring Manual Password Setup</h3>
            ${teachersWithoutPasswords.map(teacher => `
              <div class="teacher-card">
                <h4>${teacher.first_name} ${teacher.last_name}</h4>
                <p><strong>Email:</strong> ${teacher.email}</p>
                <p><strong>Employee ID:</strong> ${teacher.employee_id}</p>
                <div class="warning">
                  <strong>Action Required:</strong> Password needs to be set manually
                </div>
              </div>
            `).join('')}
          ` : ''}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Teacher Credentials Report</span>
            <div className="flex space-x-2">
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={exportToPDF} variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{teachers.length}</div>
              <div className="text-sm text-blue-600">Total Teachers</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{teachersWithPasswords.length}</div>
              <div className="text-sm text-green-600">Passwords Generated</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{teachersWithoutPasswords.length}</div>
              <div className="text-sm text-orange-600">Manual Setup Required</div>
            </div>
          </div>

          {/* Teachers with Generated Passwords */}
          {teachersWithPasswords.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                Teachers with Generated Passwords
              </h3>
              <div className="space-y-4">
                {teachersWithPasswords.map((teacher) => (
                  <Card key={teacher.id} className="border-green-200">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Teacher Details</Label>
                          <div className="mt-1 space-y-1">
                            <div className="font-medium">{teacher.first_name} {teacher.last_name}</div>
                            <div className="text-sm text-gray-600">{teacher.email}</div>
                            <div className="text-sm text-gray-600">ID: {teacher.employee_id}</div>
                            {teacher.whatsapp_number && (
                              <Badge variant="outline" className="text-xs">
                                WhatsApp: {teacher.whatsapp_number}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Generated Password</Label>
                          <div className="flex items-center space-x-2 mt-1">
                            <Input
                              type={showPasswords[teacher.id] ? 'text' : 'password'}
                              value={teacher.generated_password || ''}
                              readOnly
                              className="bg-yellow-50 border-yellow-200 text-sm"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => togglePasswordVisibility(teacher.id)}
                            >
                              {showPasswords[teacher.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(teacher.generated_password || '', `password-${teacher.id}`)}
                            >
                              {copiedItems[`password-${teacher.id}`] ? <CheckCircle className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                          {teacher.whatsapp_number && (
                            <div className="mt-2">
                              <Badge variant="secondary" className="text-xs">
                                <Mail className="w-3 h-3 mr-1" />
                                Sent via WhatsApp
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Teachers without Generated Passwords */}
          {teachersWithoutPasswords.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
                Teachers Requiring Manual Password Setup
              </h3>
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  These teachers were created but passwords need to be set manually. 
                  They will need to use the &quot;Forgot Password&quot; feature to access their accounts.

                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                {teachersWithoutPasswords.map((teacher) => (
                  <Card key={teacher.id} className="border-orange-200">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{teacher.first_name} {teacher.last_name}</div>
                          <div className="text-sm text-gray-600">{teacher.email} • ID: {teacher.employee_id}</div>
                        </div>
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          Manual Setup Required
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}