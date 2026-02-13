'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Download, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { useTeacherService } from '@/services/api/teacher-service';
import { useTenant } from '@/hooks/use-tenant';
import { toast } from 'sonner';
import type { TeacherCreate, TeacherCreateResponse } from '@/types/teacher';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { BulkCredentialsReport } from './bulk-credentials-report';

interface BulkImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function BulkImportDialog({ isOpen, onClose, onSuccess }: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [createdTeachers, setCreatedTeachers] = useState<TeacherCreateResponse[]>([]);
  const [showCredentialsReport, setShowCredentialsReport] = useState(false);
  const { tenantId } = useTenant();
  const teacherService = useTeacherService();

  const downloadTemplate = (format: 'excel' | 'csv') => {
    const templateData = [
      {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@school.com',
        phone_number: '+1234567890',
        employee_id: 'EMP001',
        department: 'Mathematics',
        qualification: 'M.Sc Mathematics',
        joining_date: '2024-01-15',
        is_class_teacher: 'false',
        address: '123 Main St',
        city: 'New York',
        county: 'NY',
        country: 'USA',
        gender: 'male',
        whatsapp_number: '+1234567890',
        status: 'active'
      },
      {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@school.com',
        phone_number: '+1234567891',
        employee_id: 'EMP002',
        department: 'English',
        qualification: 'M.A English Literature',
        joining_date: '2024-02-01',
        is_class_teacher: 'true',
        address: '456 Oak Ave',
        city: 'Los Angeles',
        county: 'CA',
        country: 'USA',
        gender: 'female',
        whatsapp_number: '+1234567891',
        status: 'active'
      }
    ];

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Teachers');
      XLSX.writeFile(wb, 'teachers_template.xlsx');
    } else {
      const csv = Papa.unparse(templateData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'teachers_template.csv';
      link.click();
    }
    
    toast.success(`${format.toUpperCase()} template downloaded successfully`);
  };

  const parseFile = async (file: File): Promise<TeacherCreate[]> => {
    return new Promise((resolve, reject) => {
      // Check if tenant ID is available
      if (!tenantId) {
        reject(new Error('Tenant ID not available. Please refresh the page and try again.'));
        return;
      }

      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'csv') {
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              const teachers = results.data.map((row) => ({
                first_name: row.first_name?.trim(),
                last_name: row.last_name?.trim(),
                email: row.email?.trim(),
                phone_number: row.phone_number?.trim(),
                employee_id: row.employee_id?.trim(),
                department: row.department?.trim(),
                qualification: row.qualification?.trim(),
                // For CSV parsing section:
                joining_date: row.joining_date ? (() => {
                  const dateStr = row.joining_date.trim();
                  // Handle DD/MM/YYYY format
                  if (dateStr.includes('/')) {
                    const [day, month, year] = dateStr.split('/');
                    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString().split('T')[0];
                  }
                  return new Date(dateStr).toISOString().split('T')[0];
                })() : undefined,
                is_class_teacher: row.is_class_teacher === 'true',
                address: row.address?.trim(),
                city: row.city?.trim(),
                county: row.county?.trim(),
                country: row.country?.trim(),
                gender: row.gender?.trim(),
                whatsapp_number: row.whatsapp_number?.trim(),
                status: row.status?.trim() || 'active',
                password: '', // Backend will auto-generate if empty
              }));
              resolve(teachers);
            } catch {
              reject(new Error('Failed to parse CSV file'));
            }
          },
          error: (error) => reject(new Error(`CSV parsing error: ${error.message}`))
        });
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
            
            const teachers = jsonData.map((row) => ({
              first_name: String(row.first_name ?? '').trim(),
              last_name: String(row.last_name ?? '').trim(),
              email: String(row.email ?? '').trim(),
              phone_number: String(row.phone_number ?? '').trim(),
              employee_id: String(row.employee_id ?? '').trim(),
              department: String(row.department ?? '').trim(),
              qualification: String(row.qualification ?? '').trim(),
              // For Excel parsing section:
              joining_date: row.joining_date ? (() => {
                const dateStr = String(row.joining_date).trim();
                // Handle DD/MM/YYYY format
                if (dateStr.includes('/')) {
                  const [day, month, year] = dateStr.split('/');
                  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString().split('T')[0];
                }
                return new Date(dateStr).toISOString().split('T')[0];
              })() : undefined,
              is_class_teacher: String(row.is_class_teacher ?? '').toLowerCase() === 'true',
              address: String(row.address ?? '').trim(),
              city: String(row.city ?? '').trim(),
              county: String(row.county ?? '').trim(),
              country: String(row.country ?? '').trim(),
              gender: String(row.gender ?? '').trim(),
              whatsapp_number: String(row.whatsapp_number ?? '').trim(),
              status: String(row.status ?? '').trim() || 'active',
              password: '', // Backend will auto-generate if empty
              tenant_id: tenantId, // Add tenant_id from context
            }));
            resolve(teachers);
          } catch {
            reject(new Error('Failed to parse Excel file'));
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Unsupported file format. Please use CSV or Excel files.'));
      }
    });
  };

  const handleFileUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setResult(null);

    try {
      setProgress(25);
      const teachers = await parseFile(file);
      
      setProgress(50);
      const createdTeachersResponse = await teacherService.createBulkTeachers(teachers);
      
      setProgress(100);
      setCreatedTeachers(createdTeachersResponse);
      setResult({
        success: createdTeachersResponse.length,
        failed: teachers.length - createdTeachersResponse.length,
        errors: []
      });
      
      // Show credentials report if any teachers have generated passwords
      const hasGeneratedPasswords = createdTeachersResponse.some(teacher => teacher.generated_password);
      if (hasGeneratedPasswords) {
        setShowCredentialsReport(true);
      }
      
      toast.success(`Successfully imported ${createdTeachersResponse.length} teachers`);
      onSuccess();
    } catch (error: unknown) {
      console.error('Bulk import error:', error);
      setResult({
        success: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Failed to import teachers']
      });
      toast.error('Failed to import teachers');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    setCreatedTeachers([]);
    setShowCredentialsReport(false);
    onClose();
  };

  // Show credentials report if available
  if (showCredentialsReport && createdTeachers.length > 0) {
    return (
      <BulkCredentialsReport 
        teachers={createdTeachers}
        onClose={() => {
          setShowCredentialsReport(false);
          handleClose();
        }}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Teachers</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Template Download Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">1. Download Template</Label>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => downloadTemplate('excel')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Excel Template
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadTemplate('csv')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download CSV Template
              </Button>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">2. Upload Filled Template</Label>
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={isUploading}
            />
            {file && (
              <p className="text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Progress Section */}
          {isUploading && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Import Progress</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-gray-600">{progress}% complete</p>
            </div>
          )}

          {/* Results Section */}
          {result && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Import Results</Label>
              {result.success > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Successfully imported {result.success} teachers
                  </AlertDescription>
                </Alert>
              )}
              {result.failed > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to import {result.failed} teachers
                  </AlertDescription>
                </Alert>
              )}
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-600">Errors:</p>
                  {result.errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-600">• {error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isUploading}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && (
              <Button 
                onClick={handleFileUpload} 
                disabled={!file || isUploading}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {isUploading ? 'Importing...' : 'Import Teachers'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
