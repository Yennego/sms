'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, Plus, Edit, Trash2, Users, Clock, GraduationCap, Loader2, AlertCircle } from 'lucide-react';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { toast } from 'sonner';
import { useSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject } from '@/hooks/queries/subjects';

const subjectCategories = [
  'Core', 'Science', 'Mathematics', 'Language Arts', 'Social Studies', 'Arts', 'Physical Education', 'Technology', 'Elective'
];

export default function SubjectsPage() {
  const { data: rawSubjects = [], isLoading } = useSubjects();
  const createMutation = useCreateSubject();
  const updateMutation = useUpdateSubject();
  const deleteMutation = useDeleteSubject();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '', code: '', description: '', category: 'Uncategorized', hoursPerWeek: '0', color: 'bg-blue-500'
  });

  const subjects = useMemo(() => rawSubjects.map(s => ({
    id: s.id,
    name: s.name,
    code: s.code,
    description: s.description || '',
    category: 'Core', // Simplified for now since backend doesn't have category yet
    hoursPerWeek: s.credits || 0,
    totalTeachers: 0,
    totalClasses: 0,
    isActive: s.is_active,
    color: 'bg-blue-500'
  })), [rawSubjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      code: formData.code.toUpperCase(),
      description: formData.description || undefined,
      is_active: true,
      credits: parseInt(formData.hoursPerWeek) || 0,
    };

    try {
      if (editingSubject) {
        await updateMutation.mutateAsync({ id: editingSubject.id, data: payload });
        toast.success(`Subject "${formData.name}" updated`);
      } else {
        await createMutation.mutateAsync(payload as any);
        toast.success(`Subject "${formData.name}" created`);
      }
      setIsDialogOpen(false);
      setEditingSubject(null);
      setFormData({ name: '', code: '', description: '', category: 'Uncategorized', hoursPerWeek: '0', color: 'bg-blue-500' });
    } catch (error) {
      toast.error('Failed to save subject');
    }
  };

  const handleEdit = (subject: any) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      code: subject.code,
      description: subject.description,
      category: subject.category,
      hoursPerWeek: subject.hoursPerWeek.toString(),
      color: subject.color
    });
    setIsDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!subjectToDelete) return;
    try {
      await deleteMutation.mutateAsync(subjectToDelete.id);
      toast.success(`Subject "${subjectToDelete.name}" deleted`);
      setIsDeleteDialogOpen(false);
      setSubjectToDelete(null);
    } catch (error) {
      toast.error('Failed to delete subject');
    }
  };

  const stats = useMemo(() => ({
    total: subjects.length,
    active: subjects.filter(s => s.isActive).length,
    categories: new Set(subjects.map(s => s.category)).size,
    totalHours: subjects.reduce((acc, s) => acc + s.hoursPerWeek, 0)
  }), [subjects]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="text-gray-500 animate-pulse">Loading curriculum...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Academic Subjects</h1>
          <p className="text-muted-foreground mt-1">Manage subjects and curriculum configuration</p>
        </div>
        <Button onClick={() => {
          setEditingSubject(null);
          setFormData({ name: '', code: '', description: '', category: 'Uncategorized', hoursPerWeek: '0', color: 'bg-blue-500' });
          setIsDialogOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Subject
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50/30 border-blue-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-sm font-medium text-blue-600">Total Subjects</p><p className="text-2xl font-bold">{stats.total}</p></div>
            <BookOpen className="w-8 h-8 text-blue-500 opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-green-50/30 border-green-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-sm font-medium text-green-600">Active</p><p className="text-2xl font-bold">{stats.active}</p></div>
            <GraduationCap className="w-8 h-8 text-green-500 opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-purple-50/30 border-purple-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-sm font-medium text-purple-600">Weekly Hours</p><p className="text-2xl font-bold">{stats.totalHours}</p></div>
            <Clock className="w-8 h-8 text-purple-500 opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-orange-50/30 border-orange-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-sm font-medium text-orange-600">Categories</p><p className="text-2xl font-bold">{stats.categories}</p></div>
            <Users className="w-8 h-8 text-orange-500 opacity-50" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map((subject) => (
          <Card key={subject.id} className="group hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${subject.color}`}></div>
                  <div>
                    <CardTitle className="text-lg">{subject.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">{subject.code}</CardDescription>
                  </div>
                </div>
                <Badge variant={subject.isActive ? 'default' : 'secondary'} className="text-[10px] uppercase">
                  {subject.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] italic">
                  {subject.description || 'No description provided.'}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs border-t pt-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Hours/Week:</span><span className="font-semibold">{subject.hoursPerWeek}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Category:</span><span className="font-semibold">{subject.category}</span></div>
                </div>
                <div className="flex gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(subject)} className="flex-1">
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setSubjectToDelete(subject); setIsDeleteDialogOpen(true); }} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
            <DialogDescription>Configure curriculum requirements.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Subject Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Mathematics" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" value={formData.code} onChange={(e) => setFormData(p => ({ ...p, code: e.target.value }))} placeholder="MATH101" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hoursPerWeek">Hours per Week</Label>
              <Input id="hoursPerWeek" type="number" value={formData.hoursPerWeek} onChange={(e) => setFormData(p => ({ ...p, hoursPerWeek: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input id="description" value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingSubject ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={isDeleteDialogOpen}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Subject"
        message={`Delete ${subjectToDelete?.name}? This cannot be undone.`}
        confirmButtonText="Delete"
        confirmButtonColor="red"
      />

      {subjects.length === 0 && !isLoading && (
        <Card className="border-dashed border-2 py-20">
          <CardContent className="flex flex-col items-center gap-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground opacity-20" />
            <div className="text-center">
              <h3 className="font-semibold text-lg">No subjects found</h3>
              <p className="text-muted-foreground">Start by adding your first subject to the curriculum.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}