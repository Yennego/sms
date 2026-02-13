'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Plus, Edit, Trash2, CheckCircle, AlertTriangle, Loader2, Archive } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import {
  useAcademicYearsList,
  useCreateAcademicYear,
  useUpdateAcademicYear,
  useDeleteAcademicYear,
  useSetCurrentAcademicYear,
  useArchiveAcademicYear
} from '@/hooks/queries/academic-years';

export default function AcademicYearsPage() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data: rawYears = [], isLoading } = useAcademicYearsList(includeArchived);

  const createMutation = useCreateAcademicYear();
  const updateMutation = useUpdateAcademicYear();
  const deleteMutation = useDeleteAcademicYear();
  const setCurrentMutation = useSetCurrentAcademicYear();
  const archiveMutation = useArchiveAcademicYear();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '', startDate: '', endDate: '', isCurrent: false
  });

  // Confirmation modal states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [yearToAction, setYearToAction] = useState<any | null>(null);

  const academicYears = useMemo(() => rawYears.map((ay: any) => ({
    id: ay.id,
    name: ay.name,
    startDate: ay.start_date,
    endDate: ay.end_date,
    isCurrent: ay.is_current,
    status: ay.is_current ? 'active' : (new Date(ay.start_date) > new Date() ? 'upcoming' : 'inactive'),
    totalStudents: ay.total_students || 0,
    totalClasses: ay.total_classes || 0,
    isArchived: ay.is_archived || ay.status === 'archived'
  })), [rawYears]);

  const currentYear = useMemo(() => academicYears.find(y => y.isCurrent), [academicYears]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      start_date: formData.startDate,
      end_date: formData.endDate,
      is_current: formData.isCurrent,
    };

    try {
      if (editingYear) {
        await updateMutation.mutateAsync({ id: editingYear.id, data: payload });
        toast.success('Academic year updated');
      } else {
        await createMutation.mutateAsync(payload as any);
        toast.success('Academic year created');
      }
      setIsDialogOpen(false);
      setEditingYear(null);
      setFormData({ name: '', startDate: '', endDate: '', isCurrent: false });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save academic year');
    }
  };

  const handleEdit = (year: any) => {
    setEditingYear(year);
    setIsDialogOpen(true);
    setFormData({
      name: year.name,
      startDate: year.startDate.split('T')[0],
      endDate: year.endDate.split('T')[0],
      isCurrent: year.isCurrent,
    });
  };

  const handleSetCurrent = async (id: string) => {
    try {
      await setCurrentMutation.mutateAsync(id);
      toast.success('Current academic year updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to set current year');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveMutation.mutateAsync(id);
      toast.success('Academic year archived');
      setArchiveDialogOpen(false);
      setYearToAction(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Academic year deleted');
      setDeleteDialogOpen(false);
      setYearToAction(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const promptDelete = (year: any) => {
    setYearToAction(year);
    setDeleteDialogOpen(true);
  };

  const promptArchive = (year: any) => {
    setYearToAction(year);
    setArchiveDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="text-gray-500 animate-pulse">Synchronizing academic periods...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Academic Years</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage school cycles and session periods</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 group cursor-pointer">
            <Label htmlFor="includeArchived" className="text-xs text-muted-foreground group-hover:text-foreground">Show archived</Label>
            <Switch
              id="includeArchived"
              checked={includeArchived}
              onCheckedChange={setIncludeArchived}
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingYear(null);
                setFormData({ name: '', startDate: '', endDate: '', isCurrent: false });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Session
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingYear ? 'Edit Session' : 'New Academic Session'}</DialogTitle>
                <DialogDescription>Define the start and end dates for the academic year.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Session Name</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="2024/2025" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" type="date" value={formData.startDate} onChange={(e) => setFormData(p => ({ ...p, startDate: e.target.value }))} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input id="endDate" type="date" value={formData.endDate} onChange={(e) => setFormData(p => ({ ...p, endDate: e.target.value }))} required />
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch id="isCurrent" checked={formData.isCurrent} onCheckedChange={(c) => setFormData(p => ({ ...p, isCurrent: c }))} />
                  <Label htmlFor="isCurrent">Default Session</Label>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={createMutation.isPending || updateMutation.isPending}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingYear ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editingYear ? 'Update' : 'Create'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {currentYear ? (
        <Alert className="border-green-500 bg-green-50/50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            Active Session: <strong className="text-green-900">{currentYear.name}</strong>
            <span className="mx-2 text-muted-foreground">•</span>
            {new Date(currentYear.startDate).toLocaleDateString()} - {new Date(currentYear.endDate).toLocaleDateString()}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>No active academic session. Some operations may be restricted.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {academicYears.map((year: any) => (
          <Card key={year.id} className={`${year.isCurrent ? "border-green-500 bg-green-50/20" : ""} group relative hover:shadow-lg transition-all`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {year.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {new Date(year.startDate).toLocaleDateString()} — {new Date(year.endDate).toLocaleDateString()}
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant={year.isCurrent ? "default" : (year.status === 'upcoming' ? "secondary" : "outline")} className="text-[10px] uppercase">
                    {year.isCurrent ? "Active" : year.status}
                  </Badge>
                  {year.isArchived && <Badge variant="destructive" className="text-[10px] uppercase">Archived</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><p className="text-xs text-muted-foreground font-medium">Students</p><p className="font-bold text-lg">{year.totalStudents}</p></div>
                  <div className="space-y-1"><p className="text-xs text-muted-foreground font-medium">Classes</p><p className="font-bold text-lg">{year.totalClasses}</p></div>
                </div>

                <div className="flex gap-2 pt-4 border-t opacity-40 group-hover:opacity-100 transition-opacity">
                  {!year.isArchived && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(year)} className="flex-1 px-1">
                        <Edit className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      {!year.isCurrent && (
                        <Button size="sm" variant="outline" onClick={() => handleSetCurrent(year.id)} className="flex-1 px-1">
                          Activate
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => promptArchive(year)} title="Archive">
                        <Archive className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => promptDelete(year)}
                    className="text-destructive hover:text-destructive"
                    disabled={year.isCurrent || year.isArchived}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {academicYears.length === 0 && !isLoading && (
        <Card className="border-dashed border-2 py-20 bg-muted/20">
          <CardContent className="flex flex-col items-center gap-4">
            <Calendar className="h-12 w-12 text-muted-foreground opacity-20" />
            <div className="text-center">
              <h3 className="font-semibold text-lg">No sessions configured</h3>
              <p className="text-muted-foreground max-w-xs">Define your school sessions to enable enrollment and class management.</p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} className="mt-4">Setup First Session</Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteDialogOpen}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => yearToAction && handleDelete(yearToAction.id)}
        title="Delete Academic Year"
        message={`Are you sure you want to delete ${yearToAction?.name}? This action cannot be undone.`}
        confirmButtonText={deleteMutation.isPending ? "Deleting..." : "Delete"}
        confirmButtonColor="red"
        isLoading={deleteMutation.isPending}
      />

      {/* Archive Confirmation Modal */}
      <ConfirmationModal
        isOpen={archiveDialogOpen}
        onCancel={() => setArchiveDialogOpen(false)}
        onConfirm={() => yearToAction && handleArchive(yearToAction.id)}
        title="Archive Academic Year"
        message={`Are you sure you want to archive ${yearToAction?.name}? It will become read-only.`}
        confirmButtonText={archiveMutation.isPending ? "Archiving..." : "Archive"}
        confirmButtonColor="yellow"
        isLoading={archiveMutation.isPending}
      />
    </div>
  );
}
