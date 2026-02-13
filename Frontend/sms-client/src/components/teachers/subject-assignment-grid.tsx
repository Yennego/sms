import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, GraduationCap, Users, User, UserPlus, Trash2, Edit } from 'lucide-react';
import { ClassSubjectAssignment } from '@/types/teacher-subject-assignment';
import { Teacher } from '@/types/teacher';

interface SubjectAssignmentGridProps {
    assignments: ClassSubjectAssignment[];
    teachers: Teacher[];
    onAssign: (assignment: ClassSubjectAssignment) => void;
    onUnassign: (assignment: ClassSubjectAssignment) => void;
    isLoading: boolean;
    searchTerm?: string;
}

export const SubjectAssignmentGrid: React.FC<SubjectAssignmentGridProps> = ({
    assignments,
    onAssign,
    onUnassign,
    isLoading,
    searchTerm = ''
}) => {
    const filtered = assignments.filter(a =>
        !searchTerm ||
        `${a.grade_name} ${a.section_name} ${a.subject_name} ${a.teacher_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
        // Sort by Grade then Section then Subject
        const gradeCompare = a.grade_name.localeCompare(b.grade_name);
        if (gradeCompare !== 0) return gradeCompare;
        const sectionCompare = a.section_name.localeCompare(b.section_name);
        if (sectionCompare !== 0) return sectionCompare;
        return a.subject_name.localeCompare(b.subject_name);
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-20 bg-gray-50 border border-gray-100 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (filtered.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed">
                <BookOpen className="h-10 w-10 mb-3 opacity-20" />
                <p>No subject slots found matching "{searchTerm}"</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {filtered.map((slot, index) => (
                <Card
                    key={slot.id || `slot-${index}`}
                    className={`overflow-hidden transition-all duration-200 border-0 ring-1 ${slot.is_assigned
                            ? 'ring-blue-100 bg-white'
                            : 'ring-gray-100 bg-gray-50/10'
                        }`}
                >
                    <CardContent className="p-0">
                        <div className="flex items-center p-4 gap-4">
                            {/* Academic Context */}
                            <div className="flex-1 min-w-0 flex items-center gap-6">
                                <div className="space-y-1 min-w-[120px]">
                                    <div className="flex items-center gap-1.5 text-blue-600">
                                        <GraduationCap className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">{slot.grade_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-500">
                                        <Users className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold">Section {slot.section_name}</span>
                                    </div>
                                </div>

                                <div className="space-y-1 flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-gray-900 truncate">
                                        {slot.subject_name}
                                    </h4>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-[0.1em]">
                                        Academic Subject Slot
                                    </p>
                                </div>
                            </div>

                            {/* Teacher Allocation */}
                            <div className="flex items-center gap-6 min-w-[300px]">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${slot.is_assigned ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-300'
                                        }`}>
                                        {slot.is_assigned ? <User className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-bold truncate ${slot.is_assigned ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                            {slot.teacher_name || 'Unassigned'}
                                        </p>
                                        <Badge
                                            className={`text-[9px] font-black uppercase tracking-wider px-1.5 h-4 border-0 ${slot.is_assigned ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                                                }`}
                                        >
                                            {slot.is_assigned ? 'Assigned' : 'Vacant'}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    {slot.is_assigned ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-2 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100"
                                                onClick={() => onAssign(slot)}
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                                <span className="text-xs">Reassign</span>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => onUnassign(slot)}
                                                title="Unassign Subject"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            size="sm"
                                            className="h-8 gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm"
                                            onClick={() => onAssign(slot)}
                                        >
                                            <UserPlus className="h-3.5 w-3.5" />
                                            <span className="text-xs">Assign Teacher</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
