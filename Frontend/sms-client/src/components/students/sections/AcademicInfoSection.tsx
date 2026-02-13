import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
 
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface AcademicInfoData {
  admissionNumber?: string;
  rollNumber?: string;
  admissionDate?: string;
}
interface AcademicInfoSectionProps {
  formData: AcademicInfoData;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors: Record<string, string>;
}

export default function AcademicInfoSection({ 
  formData, 
  handleInputChange,
  errors 
}: AcademicInfoSectionProps) {
  const params = useParams();
  const tenantDomain = params.tenantDomain as string;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Academic Information</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="admissionNumber">Admission Number *</Label>
          <Input
            id="admissionNumber"
            name="admissionNumber"
            value={formData.admissionNumber || ''}
            onChange={handleInputChange}
            className={errors.admissionNumber ? 'border-red-500' : ''}
          />
          {errors.admissionNumber && (
            <p className="text-red-500 text-sm mt-1">{errors.admissionNumber}</p>
          )}
        </div>

        <div>
          <Label htmlFor="rollNumber">Roll Number</Label>
          <Input
            id="rollNumber"
            name="rollNumber"
            value={formData.rollNumber || ''}
            onChange={handleInputChange}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="admissionDate">Admission Date *</Label>
          <Input
            id="admissionDate"
            name="admissionDate"
            type="date"
            value={formData.admissionDate || ''}
            onChange={handleInputChange}
            className={errors.admissionDate ? 'border-red-500' : ''}
          />
          {errors.admissionDate && (
            <p className="text-red-500 text-sm mt-1">{errors.admissionDate}</p>
          )}
        </div>
      </div>

      {/* Informational message about grade/section assignment */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-800">Grade & Section Assignment</h4>
            <p className="mt-1 text-sm text-blue-700">
              Grade and section assignments are now managed through the <strong>Enrollment System</strong>. 
              After creating a student, use the Enrollment Management feature to assign them to specific 
              grades and sections for each academic year. This allows for proper tracking of student 
              progression and historical records.
            </p>
            <div className="mt-3">
              <Link href={`/${tenantDomain}/academics/enrollments`}>
                <Button variant="outline" size="sm" className="text-blue-700 border-blue-300 hover:bg-blue-100">
                  Manage Enrollments
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
