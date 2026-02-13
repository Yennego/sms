'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp, Plus, Edit, Trash2, Users, BookOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { useGrades, useCreateGrade, useUpdateGrade, useDeleteGrade } from '@/hooks/queries/academic-grades';
import { useSections } from '@/hooks/queries/sections';
import type { AcademicGrade } from '@/types/academic-grade';

interface GradeDisplay {
  id: string;
  name: string;
  level: number;
  description: string;
  ageRange: string;
  totalStudents: number;
  totalSections: number;
  totalSubjects: number;
  isActive: boolean;
}

export default function GradesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeDisplay | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    level: '',
    description: '',
    ageRange: ''
  });

  // Delete confirm state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [gradeToDelete, setGradeToDelete] = useState<GradeDisplay | null>(null);

  // TanStack Query Hooks
  const { data: apiGrades = [], isLoading: gradesLoading, error: gradesError } = useGrades();
  const { data: sectionsData } = useSections();
  const sections = sectionsData?.sections || [];

  const createMutation = useCreateGrade();
  const updateMutation = useUpdateGrade();
  const deleteMutation = useDeleteGrade();

  // Transform API grades to display format
  const grades: GradeDisplay[] = useMemo(() => {
    return (apiGrades || []).map((g: AcademicGrade) => {
      const gradeSections = sections.filter(s => s.grade_id === g.id);
      return {
        id: g.id,
        name: g.name,
        level: g.sequence,
        description: g.description ?? '',
        ageRange: g.age_range ?? '',
        totalStudents: 0, // Would need enrollment queries to compute
        totalSections: gradeSections.length,
        totalSubjects: 0, // Would need class/subject queries to compute
        isActive: g.is_active
      };
    }).sort((a, b) => a.level - b.level);
  }, [apiGrades, sections]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        sequence: parseInt(formData.level, 10) || 0,
        age_range: formData.ageRange || undefined,
        is_active: editingGrade ? editingGrade.isActive : true
      };

      if (editingGrade) {
        await updateMutation.mutateAsync({ id: editingGrade.id, data: payload });
        toast.success('Grade updated successfully');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Grade created successfully');
      }

      setIsDialogOpen(false);
      setEditingGrade(null);
      setFormData({ name: '', level: '', description: '', ageRange: '' });
    } catch (error: any) {
      console.error('Error saving grade:', error);
      toast.error(error?.message || 'Failed to save grade.');
    }
  };

  const promptDelete = (grade: GradeDisplay) => {
    setGradeToDelete(grade);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!gradeToDelete) return;

    try {
      await deleteMutation.mutateAsync(gradeToDelete.id);
      toast.success('Grade deleted successfully');
      setIsDeleteDialogOpen(false);
      setGradeToDelete(null);
    } catch (error: any) {
      console.error('Error deleting grade:', error);
      toast.error(error?.message || 'Failed to delete grade.');
    }
  };

  const handleEdit = (grade: GradeDisplay) => {
    setEditingGrade(grade);
    setFormData({
      name: grade.name,
      level: grade.level.toString(),
      description: grade.description,
      ageRange: grade.ageRange
    });
    setIsDialogOpen(true);
  };

  const totalStudents = grades.reduce((sum, grade) => sum + grade.totalStudents, 0);
  const totalSections = grades.reduce((sum, grade) => sum + grade.totalSections, 0);

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  if (gradesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (gradesError) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-red-500">Failed to load grades: {(gradesError as Error).message}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Academic Grades</h1>
          <p className="text-gray-600 mt-1">
            Manage grade levels and academic standards
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingGrade(null);
            setFormData({ name: '', level: '', description: '', ageRange: '' });
            setIsDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Grade
        </Button>
      </div>

      {/* Grade Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingGrade ? 'Edit Grade' : 'Add New Grade'}
            </DialogTitle>
            <DialogDescription>
              Configure the grade level details and requirements.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Grade Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Grade 1, Kindergarten"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="level">Grade Level/Sequence</Label>
                <Input
                  id="level"
                  type="number"
                  value={formData.level}
                  onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
                  placeholder="e.g., 1, 2, 3"
                  min="0"
                  max="100"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ageRange">Age Range</Label>
                <Input
                  id="ageRange"
                  value={formData.ageRange}
                  onChange={(e) => setFormData(prev => ({ ...prev, ageRange: e.target.value }))}
                  placeholder="e.g., 6-7 years"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this grade level"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isMutating}>
                Cancel
              </Button>
              <Button type="submit" disabled={isMutating || !formData.name}>
                {isMutating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingGrade ? 'Update Grade' : 'Create Grade'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Grades</p>
                <p className="text-2xl font-bold">{grades.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-2xl font-bold">{totalStudents}</p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sections</p>
                <p className="text-2xl font-bold">{totalSections}</p>
              </div>
              <BookOpen className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grades List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {grades.map((grade) => (
          <Card key={grade.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    {grade.name}
                  </CardTitle>
                  <CardDescription>
                    Level {grade.level} {grade.ageRange && `• ${grade.ageRange}`}
                  </CardDescription>
                </div>
                <Badge variant={grade.isActive ? "default" : "secondary"}>
                  {grade.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">{grade.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Students:</span>
                    <span className="font-semibold">{grade.totalStudents}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Sections:</span>
                    <span className="font-semibold">{grade.totalSections}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Subjects:</span>
                    <span className="font-semibold">{grade.totalSubjects}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(grade)}
                    className="flex-1"
                    disabled={isMutating}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => promptDelete(grade)}
                    className="text-red-600 hover:text-red-700"
                    disabled={isMutating}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {
        grades.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Grades Configured</h3>
              <p className="text-gray-600 mb-4">
                Create grade levels to organize your academic structure.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Grade
              </Button>
            </CardContent>
          </Card>
        )
      }

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteDialogOpen}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Grade"
        message={`Are you sure you want to delete ${gradeToDelete?.name}? This action cannot be undone.`}
        confirmButtonText="Delete"
        confirmButtonColor="red"
      />
    </div >
  );
}
