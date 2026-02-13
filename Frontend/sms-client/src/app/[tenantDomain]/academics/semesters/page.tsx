'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Plus, Edit, Trash2 } from 'lucide-react';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useSemesterService, Semester } from '@/services/api/semester-service';

export default function SemestersPage() {
  const { getAcademicYears } = useEnrollmentService();
  const { getSemesters, createSemester, updateSemester, deleteSemester, getCurrentSemester } = useSemesterService();

  // NEW: deletion modal state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [semesterToDelete, setSemesterToDelete] = useState<Semester | null>(null);

  // NEW: current semester state
  const [currentSemesterInfo, setCurrentSemesterInfo] = useState<{ current_semester?: number; semester?: number } | null>(null);
  const [years, setYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [formData, setFormData] = useState<{ name: string; startDate: string; endDate: string; semester_number?: string }>({
    name: '',
    startDate: '',
    endDate: '',
    semester_number: ''
  });
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    (async () => {
      const list = await getAcademicYears();
      setYears(list || []);
      const current = (list || []).find((y: any) => y.is_current) || list?.[0];
      if (current?.id) setSelectedYearId(current.id);

      // NEW: also fetch current semester info once
      try {
        const info = await getCurrentSemester();
        setCurrentSemesterInfo(info);
      } catch (err) {
        console.warn('Failed to load current semester info', err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedYearId) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getSemesters(selectedYearId);
        setSemesters(data || []);
      } catch (err) {
        console.error('Failed to load semesters', err);
        setErrorMessage('Failed to load semesters');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedYearId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSemester) {
        await updateSemester(editingSemester.id, {
          name: formData.name || undefined,
          start_date: formData.startDate || undefined,
          end_date: formData.endDate || undefined,
          semester_number: formData.semester_number ? parseInt(formData.semester_number, 10) : undefined
        });
      } else {
        await createSemester({
          name: formData.name,
          academic_year_id: selectedYearId,
          start_date: formData.startDate,
          end_date: formData.endDate,
          semester_number: formData.semester_number ? parseInt(formData.semester_number, 10) : 1
        } as any);
      }
      setIsDialogOpen(false);
      setEditingSemester(null);
      setFormData({ name: '', startDate: '', endDate: '', semester_number: '' });
      const refreshed = await getSemesters(selectedYearId);
      setSemesters(refreshed || []);
    } catch (err) {
      console.error('Error saving semester', err);
      setErrorMessage('Error saving semester');
    }
  };

  const handleEdit = (s: Semester) => {
    setEditingSemester(s);
    setFormData({
      name: s.name,
      startDate: s.start_date,
      endDate: s.end_date,
      semester_number: typeof s.semester_number === 'number' ? String(s.semester_number) : ''
    });
    setIsDialogOpen(true);
  };

  // REPLACED: delete flow uses modal
  const handleDelete = (s: Semester) => {
    setSemesterToDelete(s);
    setIsDeleteDialogOpen(true);
  };

  // NEW: confirm delete
  const confirmDelete = async () => {
    if (!semesterToDelete) return;
    try {
      await deleteSemester(semesterToDelete.id);
      const refreshed = await getSemesters(selectedYearId);
      setSemesters(refreshed || []);
    } catch (err) {
      console.error('Error deleting semester', err);
      setErrorMessage('Error deleting semester');
    } finally {
      setIsDeleteDialogOpen(false);
      setSemesterToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Semesters</h1>
          <p className="text-gray-600 mt-2">
            Manage semesters per academic year
          </p>
          {/* NEW: Current semester indicator */}
          {currentSemesterInfo && (
            <p className="text-sm text-gray-500 mt-1">
              Current Semester: {currentSemesterInfo.current_semester ?? currentSemesterInfo.semester ?? 'N/A'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYearId} onValueChange={setSelectedYearId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select Academic Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y.id} value={y.id}>{y.name} {y.is_current && '(Current)'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingSemester(null);
                setFormData({ name: '', startDate: '', endDate: '', semester_number: '' });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Semester
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSemester ? 'Edit Semester' : 'Add New Semester'}
                </DialogTitle>
                <DialogDescription>
                  Configure semester details in the selected academic year.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} required />
                </div>
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={formData.startDate} onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))} required />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" value={formData.endDate} onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))} required />
                </div>
                <div>
                  <Label htmlFor="semester_number">Semester Number (1 or 2)</Label>
                  <Input id="semester_number" type="number" min={1} max={4} value={formData.semester_number} onChange={(e) => setFormData(prev => ({ ...prev, semester_number: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">{editingSemester ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {semesters.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {s.name}
                  </CardTitle>
                  <CardDescription>
                    {new Date(s.start_date).toLocaleDateString()} - {new Date(s.end_date).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Badge variant={s.is_current ? 'default' : 'secondary'}>
                  {s.is_current ? 'Current' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEdit(s)} className="flex-1">
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(s)}
                  className="flex-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>

                {/* Delete confirmation modal (uses global state) */}
                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Delete Semester</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete "{semesterToDelete?.name}"? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDelete}>
                        Delete
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {semesters.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Semesters Configured</h3>
            <p className="text-gray-600 mb-4">Create your first semester for this academic year.</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Semester
            </Button>
          </CardContent>
        </Card>
      )}

      {errorMessage && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}