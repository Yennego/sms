'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAssessmentService, GradeType, AssessmentCreate } from '@/services/api/assessment-service';
import { toast } from 'sonner';
import { Loader2, ClipboardCheck, Award, FileQuestion, Users, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

interface AssessmentCreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    // Pre-fill options
    selectedSubjectId?: string;
    selectedGradeId?: string;
    selectedSectionId?: string;
    selectedAcademicYearId?: string;
    teacherId?: string;
    // Lookups
    subjects?: { id: string; name: string }[];
    classes?: { id: string; grade_id: string; section_id?: string; grade_name: string; section_name?: string; subject_name?: string }[];
    academicYears?: { id: string; name: string; is_current?: boolean }[];
}

const ASSESSMENT_TYPES = [
    { value: GradeType.QUIZ, label: 'Quiz', icon: FileQuestion, description: 'Quick knowledge check' },
    { value: GradeType.TEST, label: 'Test', icon: ClipboardCheck, description: 'Major classroom assessment' },
    { value: GradeType.PARTICIPATION, label: 'Participation', icon: Users, description: 'Class engagement scoring' },
    { value: GradeType.PROJECT, label: 'Project', icon: Sparkles, description: 'Extended research work' },
    { value: GradeType.OTHER, label: 'Other', icon: Award, description: 'Custom assessment type' },
];

export function AssessmentCreatorModal({
    isOpen,
    onClose,
    onSuccess,
    selectedSubjectId,
    selectedGradeId,
    selectedSectionId,
    selectedAcademicYearId,
    teacherId,
    subjects = [],
    classes = [],
    academicYears = [],
}: AssessmentCreatorModalProps) {
    const assessmentService = useAssessmentService();
    const [loading, setLoading] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<GradeType>(GradeType.QUIZ);
    const [subjectId, setSubjectId] = useState(selectedSubjectId || '');
    const [classId, setClassId] = useState('');
    const [academicYearId, setAcademicYearId] = useState(selectedAcademicYearId || '');
    const [assessmentDate, setAssessmentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [maxScore, setMaxScore] = useState('100');

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setDescription('');
            setType(GradeType.QUIZ);
            setSubjectId(selectedSubjectId || '');
            setAcademicYearId(selectedAcademicYearId || '');
            setAssessmentDate(format(new Date(), 'yyyy-MM-dd'));
            setMaxScore('100');

            // Set default class if only one
            if (classes.length === 1) {
                setClassId(classes[0].id);
            } else {
                setClassId('');
            }

            // Set current academic year by default
            const current = academicYears.find(ay => ay.is_current);
            if (current && !selectedAcademicYearId) {
                setAcademicYearId(current.id);
            }
        }
    }, [isOpen, selectedSubjectId, selectedAcademicYearId, classes, academicYears]);

    const selectedClass = classes.find(c => c.id === classId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error('Please enter a title');
            return;
        }
        if (!subjectId) {
            toast.error('Please select a subject');
            return;
        }
        if (!classId || !selectedClass) {
            toast.error('Please select a class');
            return;
        }
        if (!academicYearId) {
            toast.error('Please select an academic year');
            return;
        }
        if (!teacherId) {
            toast.error('Teacher ID not found');
            return;
        }

        setLoading(true);

        try {
            const payload: AssessmentCreate = {
                title: title.trim(),
                description: description.trim() || undefined,
                type,
                subject_id: subjectId,
                teacher_id: teacherId,
                academic_year_id: academicYearId,
                grade_id: selectedClass.grade_id,
                section_id: selectedClass.section_id,
                assessment_date: assessmentDate,
                max_score: parseInt(maxScore) || 100,
                is_published: true, // Auto-publish so it appears in GradingHub
            };

            await assessmentService.createAssessment(payload);
            toast.success(`${ASSESSMENT_TYPES.find(t => t.value === type)?.label || 'Assessment'} created successfully!`);
            onSuccess?.();
            onClose();
        } catch (error: any) {
            console.error('Failed to create assessment:', error);
            toast.error(error?.message || 'Failed to create assessment');
        } finally {
            setLoading(false);
        }
    };

    const TypeIcon = ASSESSMENT_TYPES.find(t => t.value === type)?.icon || Award;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <TypeIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        Create New Assessment
                    </DialogTitle>
                    <DialogDescription>
                        Create a Quiz, Test, or Participation assessment for your class.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Assessment Type Selection */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-gray-500">Assessment Type</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {ASSESSMENT_TYPES.slice(0, 3).map(t => {
                                const Icon = t.icon;
                                return (
                                    <button
                                        key={t.value}
                                        type="button"
                                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${type === t.value
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                            }`}
                                        onClick={() => setType(t.value)}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="text-xs font-bold">{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {ASSESSMENT_TYPES.slice(3).map(t => {
                                const Icon = t.icon;
                                return (
                                    <button
                                        key={t.value}
                                        type="button"
                                        className={`p-2 rounded-lg border-2 flex items-center gap-2 transition-all ${type === t.value
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                            }`}
                                        onClick={() => setType(t.value)}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="text-xs font-bold">{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            placeholder={`e.g., Chapter 5 ${ASSESSMENT_TYPES.find(t => t.value === type)?.label || 'Assessment'}`}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Brief description of this assessment..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* Class & Subject Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Class / Section</Label>
                            <Select value={classId} onValueChange={setClassId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select class" />
                                </SelectTrigger>
                                <SelectContent>
                                    {classes.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.grade_name} - {c.section_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Select value={subjectId} onValueChange={setSubjectId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjects.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Date & Max Score Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">Assessment Date</Label>
                            <Input
                                id="date"
                                type="date"
                                value={assessmentDate}
                                onChange={(e) => setAssessmentDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="maxScore">Max Score</Label>
                            <Input
                                id="maxScore"
                                type="number"
                                min="1"
                                max="1000"
                                value={maxScore}
                                onChange={(e) => setMaxScore(e.target.value)}
                                placeholder="100"
                            />
                        </div>
                    </div>

                    {/* Academic Year (usually auto-selected) */}
                    {academicYears.length > 1 && (
                        <div className="space-y-2">
                            <Label>Academic Year</Label>
                            <Select value={academicYearId} onValueChange={setAcademicYearId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {academicYears.map(ay => (
                                        <SelectItem key={ay.id} value={ay.id}>
                                            {ay.name} {ay.is_current ? '(Current)' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Assessment'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
