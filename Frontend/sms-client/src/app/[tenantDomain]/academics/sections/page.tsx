'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Users, BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { useEnrollmentGrades } from '@/hooks/queries/enrollments';
import { useSectionsByGrade, useCreateSection, useUpdateSection, useDeleteSection } from '@/hooks/queries/sections';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { toast } from 'sonner';

export default function SectionsPage() {
  const { data: grades = [], isLoading: gradesLoading } = useEnrollmentGrades();
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');

  // Auto-select first grade if none selected
  React.useEffect(() => {
    if (grades.length > 0 && !selectedGradeId) {
      setSelectedGradeId(grades[0].id);
    }
  }, [grades, selectedGradeId]);

  const { data: apiSections = [], isLoading: sectionsLoading } = useSectionsByGrade(selectedGradeId);
  const createMutation = useCreateSection();
  const updateMutation = useUpdateSection();
  const deleteMutation = useDeleteSection();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<any | null>(null);
  const [formData, setFormData] = useState({ name: '', capacity: '', description: '' });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<any | null>(null);

  const sections = useMemo(() => apiSections.map((s: any) => ({
    id: s.id,
    name: s.name,
    gradeId: s.grade_id,
    gradeName: s.grade_name,
    capacity: s.capacity,
    description: s.description,
    studentCount: s.student_count || 0,
    classCount: s.class_count || 0
  })), [apiSections]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGradeId) {
      toast.error('Please select a grade first');
      return;
    }
    const payload = {
      name: formData.name,
      grade_id: selectedGradeId,
      capacity: formData.capacity ? parseInt(formData.capacity, 10) : undefined,
      description: formData.description || undefined
    };

    try {
      if (editingSection) {
        await updateMutation.mutateAsync({ id: editingSection.id, data: payload });
        toast.success('Section updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Section created');
      }
      setIsDialogOpen(false);
      setEditingSection(null);
      setFormData({ name: '', capacity: '', description: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save section');
    }
  };

  const handleEdit = (section: any) => {
    setEditingSection(section);
    setFormData({
      name: section.name,
      capacity: section.capacity ? String(section.capacity) : '',
      description: section.description ?? ''
    });
    setIsDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!sectionToDelete) return;
    try {
      await deleteMutation.mutateAsync(sectionToDelete.id);
      toast.success('Section deleted');
      setIsDeleteDialogOpen(false);
      setSectionToDelete(null);
    } catch (err) {
      toast.error('Failed to delete section');
    }
  };

  const isLoading = gradesLoading || (selectedGradeId && sectionsLoading);

  if (isLoading && grades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="text-gray-500 animate-pulse">Loading academic structure...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sections</h1>
          <p className="text-muted-foreground mt-1 text-sm">Organize groups of students within each grade level</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-muted-foreground">Grade:</Label>
            <Select value={selectedGradeId} onValueChange={setSelectedGradeId}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                {grades.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => {
            setEditingSection(null);
            setFormData({ name: '', capacity: '', description: '' });
            setIsDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Section
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-purple-50/30 border-purple-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-sm font-medium text-purple-600">Total Sections</p><p className="text-2xl font-bold">{sections.length}</p></div>
            <BookOpen className="w-8 h-8 text-purple-500 opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-blue-50/30 border-blue-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-sm font-medium text-blue-600">Current Grade</p><p className="text-xl font-bold truncate max-w-[150px]">{grades.find(g => g.id === selectedGradeId)?.name ?? 'None'}</p></div>
            <Users className="w-8 h-8 text-blue-500 opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-green-50/30 border-green-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-sm font-medium text-green-600">Total Students</p><p className="text-2xl font-bold">{sections.reduce((sum, s) => sum + s.studentCount, 0)}</p></div>
            <Users className="w-8 h-8 text-green-500 opacity-50" />
          </CardContent>
        </Card>
      </div>

      {sectionsLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="text-sm text-muted-foreground">Fetching sections...</p>
        </div>
      ) : sections.length === 0 ? (
        <Card className="border-dashed border-2 py-20 bg-muted/10">
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground opacity-20" />
            <div>
              <h3 className="font-semibold text-lg">No sections in this grade</h3>
              <p className="text-muted-foreground text-sm max-w-xs">Create your first section to start enrolling students.</p>
            </div>
            <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="mt-2">Create Section</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => (
            <Card key={section.id} className="hover:shadow-md transition-all group border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{section.name}</CardTitle>
                    <CardDescription className="text-xs uppercase font-medium tracking-wider">
                      {section.gradeName}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    CAP: {section.capacity ?? '∞'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground italic line-clamp-2 min-h-[40px]">
                  {section.description || 'No section notes.'}
                </p>
                <div className="flex items-center gap-4 text-xs font-medium py-2 border-y border-muted/50">
                  <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-blue-500" /> <span>{section.studentCount} Students</span></div>
                  <div className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-purple-500" /> <span>{section.classCount} Subjects</span></div>
                </div>
                <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(section)} className="flex-1 h-8 text-xs">
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setSectionToDelete(section); setIsDeleteDialogOpen(true); }} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingSection ? 'Edit Section' : 'Create Section'}</DialogTitle>
            <DialogDescription>Add a new student group to {grades.find(g => g.id === selectedGradeId)?.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Section Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Alpha, A, or Blue" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capacity">Capacity (Optional)</Label>
              <Input id="capacity" type="number" value={formData.capacity} onChange={(e) => setFormData(p => ({ ...p, capacity: e.target.value }))} placeholder="30" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Brief details about this section..." />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingSection ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={isDeleteDialogOpen}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Section"
        message={`Delete section ${sectionToDelete?.name}? This cannot be undone.`}
        confirmButtonText="Delete"
        confirmButtonColor="red"
      />
    </div>
  );
}