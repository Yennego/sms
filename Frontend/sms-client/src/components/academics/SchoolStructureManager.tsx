'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
    Calendar,
    ChevronRight,
    ChevronDown,
    Globe,
    Lock,
    Eye,
    Clock,
    Save,
    Trash2,
    Plus,
    School,
    Loader2
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { useParams } from 'next/navigation';
import {
    useSemesters,
    useCreateSemester,
    useUpdateSemester,
    useDeleteSemester,
    useToggleSemesterPublication,
    usePeriods,
    useCreatePeriod,
    useUpdatePeriod,
    useDeletePeriod,
    useTogglePeriodPublication
} from '@/hooks/queries/semesters-periods';
import { useAcademicYearsList } from '@/hooks/queries/academic-years';
import { Semester } from '@/services/api/semester-service';
import { Period } from '@/services/api/period-service';

interface SemesterItemProps {
    semester: Semester;
    expanded: boolean;
    onToggle: () => void;
    onEdit: (sem: Semester) => void;
    onDelete: (id: string) => void;
    onTogglePublication: (id: string) => void;
    onAddPeriod: (semId: string) => void;
    onEditPeriod: (semId: string, period: Period) => void;
}

function SemesterItem({
    semester,
    expanded,
    onToggle,
    onEdit,
    onDelete,
    onTogglePublication,
    onAddPeriod,
    onEditPeriod
}: SemesterItemProps) {
    const { data: periods = [], isLoading: periodsLoading } = usePeriods(semester.id);
    const deletePeriodMutation = useDeletePeriod(semester.id);
    const togglePeriodMutation = useTogglePeriodPublication(semester.id);

    const handleDeletePeriod = async (id: string) => {
        if (!confirm('Are you sure you want to delete this period?')) return;
        try {
            await deletePeriodMutation.mutateAsync(id);
            toast.success('Period deleted');
        } catch (error) {
            toast.error('Failed to delete period');
        }
    };

    const handleTogglePeriodPublication = async (id: string) => {
        try {
            await togglePeriodMutation.mutateAsync(id);
            toast.success('Period publication status updated');
        } catch (error) {
            toast.error('Failed to update period status');
        }
    };

    return (
        <Card className="overflow-hidden border-teal-100/30">
            <CardHeader className="bg-teal-50/10 dark:bg-teal-900/10 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-8 w-8"
                            onClick={onToggle}
                        >
                            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        </Button>
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                {semester.name}
                                {semester.is_published ?
                                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Published</Badge> :
                                    <Badge variant="outline" className="text-muted-foreground">Draft</Badge>
                                }
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {format(new Date(semester.start_date), 'MMM dd, yyyy')} - {format(new Date(semester.end_date), 'MMM dd, yyyy')}
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Global Publication</span>
                            <Switch
                                checked={semester.is_published}
                                onCheckedChange={() => onTogglePublication(semester.id)}
                            />
                        </div>
                        <div className="flex items-center gap-1 ml-2 border-l pl-4">
                            <Button variant="ghost" size="sm" onClick={() => onEdit(semester)}>
                                <Save className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => onDelete(semester.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            {expanded && (
                <CardContent className="pt-6">
                    {periodsLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {periods.map(period => (
                                <div
                                    key={period.id}
                                    className="p-4 rounded-xl border border-teal-100/20 bg-teal-50/5 dark:bg-teal-900/5 relative group transition-all hover:shadow-md"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-semibold">{period.name}</h4>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(period.start_date), 'MMM dd')} - {format(new Date(period.end_date), 'MMM dd')}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            {period.is_published ?
                                                <Badge className="bg-teal-500 text-white border-none text-[10px] h-5 px-1.5">LIVE</Badge> :
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 uppercase">Hidden</Badge>
                                            }
                                            <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEditPeriod(semester.id, period)}>
                                                    <Save className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 text-red-500"
                                                    disabled={deletePeriodMutation.isPending}
                                                    onClick={() => handleDeletePeriod(period.id)}
                                                >
                                                    {deletePeriodMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-6 pt-3 border-t border-teal-100/10">
                                        <div className="flex items-center gap-2">
                                            {period.is_published ? <Eye className="h-4 w-4 text-teal-500" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                                            <span className="text-[11px] font-medium uppercase tracking-wider">
                                                {period.is_published ? 'Public' : 'Private'}
                                            </span>
                                        </div>
                                        <Switch
                                            disabled={togglePeriodMutation.isPending}
                                            checked={period.is_published}
                                            onCheckedChange={() => handleTogglePeriodPublication(period.id)}
                                            className="scale-75"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="mt-4 flex justify-center">
                        <Button variant="outline" size="sm" className="border-dashed border-teal-200 text-teal-600 hover:bg-teal-50" onClick={() => onAddPeriod(semester.id)}>
                            <Plus className="w-3 h-3 mr-1" /> Add Period
                        </Button>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

export function SchoolStructureManager() {
    const params = useParams();
    const tenantDomain = params?.tenantDomain as string;

    const { data: academicYears = [], isLoading: ayLoading } = useAcademicYearsList();
    const [selectedYearId, setSelectedYearId] = useState<string | null>(null);

    // Sync selectedYearId with current academic year
    useEffect(() => {
        if (academicYears.length > 0 && !selectedYearId) {
            const currentYear = academicYears.find((y: any) => y.is_current) || academicYears[0];
            setSelectedYearId(currentYear.id);
        }
    }, [academicYears, selectedYearId]);

    const { data: semesters = [], isLoading: semLoading } = useSemesters(selectedYearId);

    // Mutation Hooks
    const createSemesterMutation = useCreateSemester();
    const updateSemesterMutation = useUpdateSemester();
    const deleteSemesterMutation = useDeleteSemester(selectedYearId || '');
    const toggleSemesterMutation = useToggleSemesterPublication();

    const createPeriodMutation = useCreatePeriod();
    const updatePeriodMutation = useUpdatePeriod();

    const [expandedSemesters, setExpandedSemesters] = useState<Record<string, boolean>>({});

    // CRUD State
    const [isSemesterDialogOpen, setIsSemesterDialogOpen] = useState(false);
    const [isPeriodDialogOpen, setIsPeriodDialogOpen] = useState(false);
    const [editingSemester, setEditingSemester] = useState<Partial<Semester> | null>(null);
    const [editingPeriod, setEditingPeriod] = useState<Partial<Period> | null>(null);
    const [targetSemesterId, setTargetSemesterId] = useState<string | null>(null);

    const handleToggleSemester = (semId: string) => {
        setExpandedSemesters(prev => ({
            ...prev,
            [semId]: !prev[semId]
        }));
    };

    const handleToggleSemesterPublication = async (semId: string) => {
        try {
            await toggleSemesterMutation.mutateAsync(semId);
            toast.success('Semester publication status updated');
        } catch (error) {
            toast.error('Failed to update semester status');
        }
    };

    const handleSaveSemester = async () => {
        if (!selectedYearId || !editingSemester?.name || !editingSemester?.start_date || !editingSemester?.end_date) {
            toast.error('Please fill all required fields');
            return;
        }

        try {
            if (editingSemester.id) {
                await updateSemesterMutation.mutateAsync({ id: editingSemester.id, data: editingSemester });
                toast.success('Semester updated successfully');
            } else {
                await createSemesterMutation.mutateAsync({
                    academic_year_id: selectedYearId,
                    name: editingSemester.name,
                    semester_number: editingSemester.semester_number || (semesters.length + 1),
                    start_date: editingSemester.start_date,
                    end_date: editingSemester.end_date
                });
                toast.success('Semester created successfully');
            }
            setIsSemesterDialogOpen(false);
        } catch (error) {
            toast.error('Failed to save semester');
        }
    };

    const handleDeleteSemester = async (id: string) => {
        if (!confirm('Are you sure you want to delete this semester? This will delete all periods within it.')) return;
        try {
            await deleteSemesterMutation.mutateAsync(id);
            toast.success('Semester deleted');
        } catch (error) {
            toast.error('Failed to delete semester');
        }
    };

    const handleSavePeriod = async () => {
        if (!targetSemesterId || !editingPeriod?.name || !editingPeriod?.start_date || !editingPeriod?.end_date) {
            toast.error('Please fill all required fields');
            return;
        }

        try {
            if (editingPeriod.id) {
                await updatePeriodMutation.mutateAsync({ id: editingPeriod.id, data: editingPeriod });
                toast.success('Period updated successfully');
            } else {
                await createPeriodMutation.mutateAsync({
                    semester_id: targetSemesterId,
                    name: editingPeriod.name,
                    period_number: editingPeriod.period_number || 1,
                    start_date: editingPeriod.start_date,
                    end_date: editingPeriod.end_date
                });
                toast.success('Period created successfully');
            }
            setIsPeriodDialogOpen(false);
        } catch (error) {
            toast.error('Failed to save period');
        }
    };

    if (ayLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">School Structure</h2>
                    <p className="text-muted-foreground">Manage academic structures and release all student marks globally.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => {
                        setEditingSemester({ name: '', start_date: '', end_date: '', semester_number: semesters.length + 1 });
                        setIsSemesterDialogOpen(true);
                    }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Semester
                    </Button>
                    <select
                        value={selectedYearId || ''}
                        onChange={(e) => setSelectedYearId(e.target.value)}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {academicYears.map(year => (
                            <option key={year.id} value={year.id}>{year.name} {year.is_current ? '(Current)' : ''}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid gap-4">
                {semLoading ? (
                    [1, 2].map(i => <Skeleton key={i} className="h-48 w-full" />)
                ) : (
                    semesters.map(semester => (
                        <SemesterItem
                            key={semester.id}
                            semester={semester}
                            expanded={!!expandedSemesters[semester.id]}
                            onToggle={() => handleToggleSemester(semester.id)}
                            onEdit={(sem) => {
                                setEditingSemester(sem);
                                setIsSemesterDialogOpen(true);
                            }}
                            onDelete={handleDeleteSemester}
                            onTogglePublication={handleToggleSemesterPublication}
                            onAddPeriod={(semId) => {
                                setTargetSemesterId(semId);
                                setEditingPeriod({ name: '', start_date: '', end_date: '' });
                                setIsPeriodDialogOpen(true);
                            }}
                            onEditPeriod={(semId, period) => {
                                setTargetSemesterId(semId);
                                setEditingPeriod(period);
                                setIsPeriodDialogOpen(true);
                            }}
                        />
                    ))
                )}
            </div>

            {!semLoading && semesters.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-teal-100/20 rounded-2xl">
                    <School className="h-12 w-12 text-teal-200 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold">No school structure found</h3>
                    <p className="text-muted-foreground mb-6">Create an academic year to generate semesters and periods.</p>
                    <Button onClick={() => window.location.href = `/${tenantDomain}/academics/academic-years`}>
                        Manage Academic Years
                    </Button>
                </div>
            )}

            {/* Semester Dialog */}
            <Dialog open={isSemesterDialogOpen} onOpenChange={setIsSemesterDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSemester?.id ? 'Edit Semester' : 'Add New Semester'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Semester Name</Label>
                            <Input
                                placeholder="e.g., 1st Semester"
                                value={editingSemester?.name || ''}
                                onChange={(e) => setEditingSemester(prev => ({ ...prev!, name: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    value={editingSemester?.start_date?.split('T')[0] || ''}
                                    onChange={(e) => setEditingSemester(prev => ({ ...prev!, start_date: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    value={editingSemester?.end_date?.split('T')[0] || ''}
                                    onChange={(e) => setEditingSemester(prev => ({ ...prev!, end_date: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSemesterDialogOpen(false)} disabled={createSemesterMutation.isPending || updateSemesterMutation.isPending}>Cancel</Button>
                        <Button onClick={handleSaveSemester} disabled={createSemesterMutation.isPending || updateSemesterMutation.isPending}>
                            {createSemesterMutation.isPending || updateSemesterMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : 'Save Semester'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Period Dialog */}
            <Dialog open={isPeriodDialogOpen} onOpenChange={setIsPeriodDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingPeriod?.id ? 'Edit Period' : 'Add New Period'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Period Name</Label>
                            <Input
                                placeholder="e.g., Period 1"
                                value={editingPeriod?.name || ''}
                                onChange={(e) => setEditingPeriod(prev => ({ ...prev!, name: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    value={editingPeriod?.start_date?.split('T')[0] || ''}
                                    onChange={(e) => setEditingPeriod(prev => ({ ...prev!, start_date: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    value={editingPeriod?.end_date?.split('T')[0] || ''}
                                    onChange={(e) => setEditingPeriod(prev => ({ ...prev!, end_date: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPeriodDialogOpen(false)} disabled={createPeriodMutation.isPending || updatePeriodMutation.isPending}>Cancel</Button>
                        <Button onClick={handleSavePeriod} disabled={createPeriodMutation.isPending || updatePeriodMutation.isPending}>
                            {createPeriodMutation.isPending || updatePeriodMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : 'Save Period'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
