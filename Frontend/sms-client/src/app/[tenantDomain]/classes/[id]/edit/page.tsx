'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useClassService } from '@/services/api/class-service';
import { useTeacherService } from '@/services/api/teacher-service';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import { useSectionService } from '@/services/api/section-service';
import { useSubjectService } from '@/services/api/subject-service';
import { useTenantNavigation } from '@/hooks/use-tenant';
import { Class, ClassUpdate } from '@/types/class';
import { Teacher } from '@/types/teacher';
import { AcademicGrade } from '@/types/academic-grade';
import { Section } from '@/types/section';
import { Subject } from '@/types/subject';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function EditClassPage() {
  const router = useRouter();
  const params = useParams();
  const { createTenantPath } = useTenantNavigation();
  const classService = useClassService();
  const teacherService = useTeacherService();
  const gradeService = useAcademicGradeService();
  const sectionService = useSectionService();
  const subjectService = useSubjectService();

  const classId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [grades, setGrades] = useState<AcademicGrade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');

  const [formData, setFormData] = useState<ClassUpdate>({
    name: '',
    academic_year: '',
    description: '',
    room: '',
    is_active: true,
    start_date: '',
    end_date: '',
    grade_id: '',
    section_id: '',
    subject_id: '',
    teacher_id: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [cls, ts, gs, subs] = await Promise.all([
          classService.getClassById(classId),
          teacherService.getTeachers(),
          gradeService.getActiveGrades(),
          subjectService.getActiveSubjects(),
        ]);

        setTeachers(ts);
        setGrades(gs);
        setSubjects(subs);

        if (cls.grade_id) {
          setSelectedGradeId(cls.grade_id);
          const secs = await sectionService.getSectionsByGrade(cls.grade_id);
          setSections(secs);
        }

        setFormData({
          name: cls.name || '',
          academic_year: cls.academic_year || '',
          description: cls.description || '',
          room: cls.room || '',
          is_active: !!cls.is_active,
          start_date: cls.start_date || '',
          end_date: cls.end_date || '',
          grade_id: cls.grade_id || '',
          section_id: cls.section_id || '',
          subject_id: cls.subject_id || '',
          teacher_id: cls.teacher_id || ''
        });
      } catch (err) {
        console.error('Error initializing edit page:', err);
        toast.error('Failed to load class');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [classId]);

  useEffect(() => {
    if (selectedGradeId) {
      sectionService.getSectionsByGrade(selectedGradeId)
        .then(secs => setSections(secs))
        .catch(err => {
          console.error('Error fetching sections:', err);
          toast.error('Failed to fetch sections');
        });
    } else {
      setSections([]);
      setFormData(prev => ({ ...prev, section_id: '' }));
    }
  }, [selectedGradeId, sectionService]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) newErrors.name = 'Class name is required';
    if (!formData.teacher_id) newErrors.teacher_id = 'Teacher is required';
    if (!formData.grade_id) newErrors.grade_id = 'Grade is required';
    if (!formData.section_id) newErrors.section_id = 'Section is required';
    if (!formData.subject_id) newErrors.subject_id = 'Subject is required';
    if (!formData.start_date) newErrors.start_date = 'Start date is required';
    if (formData.end_date && formData.start_date && new Date(formData.end_date) <= new Date(formData.start_date)) {
      newErrors.end_date = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof ClassUpdate, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleGradeChange = (gradeId: string) => {
    setSelectedGradeId(gradeId);
    handleInputChange('grade_id', gradeId);
    handleInputChange('section_id', '');
  };

  const handleCancel = () => {
    router.push(createTenantPath(`/classes/${classId}`));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    try {
      setLoading(true);
      await classService.updateClass(classId, formData);
      toast.success('Class updated successfully');
      router.push(createTenantPath(`/classes/${classId}`));
    } catch (error) {
      console.error('Error updating class:', error);
      toast.error('Failed to update class');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading class...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Class</h1>
          <p className="text-gray-600 mt-1">Update class information and assignments</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Class Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
                {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label htmlFor="academic_year">Academic Year *</Label>
                <Input
                  id="academic_year"
                  value={formData.academic_year || ''}
                  onChange={(e) => handleInputChange('academic_year', e.target.value)}
                  placeholder="e.g., 2024-2025"
                />
                {errors.academic_year && <p className="text-red-600 text-sm mt-1">{errors.academic_year}</p>}
              </div>

              <div>
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date || ''}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                />
                {errors.start_date && <p className="text-red-600 text-sm mt-1">{errors.start_date}</p>}
              </div>

              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date || ''}
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                />
                {errors.end_date && <p className="text-red-600 text-sm mt-1">{errors.end_date}</p>}
              </div>

              <div>
                <Label htmlFor="room">Room</Label>
                <Input
                  id="room"
                  value={formData.room || ''}
                  onChange={(e) => handleInputChange('room', e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 mt-6">
                <Switch
                  checked={!!formData.is_active}
                  onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                />
                <Label>Active</Label>
              </div>
            </div>

            {/* Teacher / Grade / Section / Subject */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="teacher">Teacher *</Label>
                <Select
                  value={formData.teacher_id || ''}
                  onValueChange={(val) => handleInputChange('teacher_id', val)}
                >
                  <SelectTrigger id="teacher">
                    <SelectValue placeholder="Select a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {[t.first_name, t.last_name].filter(Boolean).join(' ') || t.email || `Teacher ${t.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.teacher_id && <p className="text-red-600 text-sm mt-1">{errors.teacher_id}</p>}
              </div>

              <div>
                <Label htmlFor="grade">Grade *</Label>
                <Select
                  value={formData.grade_id || ''}
                  onValueChange={(val) => handleGradeChange(val)}
                >
                  <SelectTrigger id="grade">
                    <SelectValue placeholder="Select a grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.grade_id && <p className="text-red-600 text-sm mt-1">{errors.grade_id}</p>}
              </div>

              <div>
                <Label htmlFor="section">Section *</Label>
                <Select
                  value={formData.section_id || ''}
                  onValueChange={(val) => handleInputChange('section_id', val)}
                >
                  <SelectTrigger id="section">
                    <SelectValue placeholder="Select a section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.section_id && <p className="text-red-600 text-sm mt-1">{errors.section_id}</p>}
              </div>

              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Select
                  value={formData.subject_id || ''}
                  onValueChange={(val) => handleInputChange('subject_id', val)}
                >
                  <SelectTrigger id="subject">
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subject_id && <p className="text-red-600 text-sm mt-1">{errors.subject_id}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={handleCancel}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}