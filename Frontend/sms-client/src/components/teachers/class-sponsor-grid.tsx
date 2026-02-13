import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Users, Edit3, UserPlus, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import { ClassSponsor } from '@/types/teacher-subject-assignment';
import { Teacher } from '@/types/teacher';

interface ClassSponsorGridProps {
    sponsors: ClassSponsor[];
    teachers: Teacher[];
    onAssignSponsor: (sectionId: string, currentTeacherId: string | null) => void;
    isLoading: boolean;
    searchTerm?: string;
}

export const ClassSponsorGrid: React.FC<ClassSponsorGridProps> = ({
    sponsors,
    onAssignSponsor,
    isLoading,
    searchTerm = ''
}) => {
    const filtered = sponsors.filter(s =>
        !searchTerm ||
        `${s.grade_name} ${s.section_name} ${s.teacher_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-[160px] bg-gray-50 border border-gray-100 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (filtered.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <Users className="h-12 w-12 mb-4 opacity-10" />
                <p className="text-sm font-medium">
                    {searchTerm ? `No matches found for "${searchTerm}"` : "No class sponsors to display"}
                </p>
                {searchTerm && (
                    <Button
                        variant="link"
                        size="sm"
                        className="text-blue-500 mt-2"
                        onClick={() => window.location.reload()}
                    >
                        Clear filters
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((sponsor) => (
                <Card
                    key={sponsor.section_id}
                    className={`group relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 border-0 ring-1 shadow-sm ${sponsor.is_assigned
                            ? 'ring-blue-100/80 bg-white'
                            : 'ring-gray-100 bg-gray-50/20'
                        }`}
                >
                    {/* Visual Accent */}
                    <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${sponsor.is_assigned ? 'bg-blue-500' : 'bg-gray-300'
                        }`} />

                    <CardContent className="p-6 flex flex-col h-full">
                        {/* Header Area */}
                        <div className="flex justify-between items-start gap-4 mb-6">
                            <div className="space-y-1.5 min-w-0">
                                <div className="flex items-center gap-2 text-blue-600/80">
                                    <Users className="h-3.5 w-3.5" />
                                    <span className="text-[11px] font-bold uppercase tracking-[0.1em]">
                                        {sponsor.grade_name}
                                    </span>
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-900 tracking-tight truncate">
                                    Section {sponsor.section_name}
                                </h3>
                            </div>

                            <Badge
                                className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border-0 ${sponsor.is_assigned
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'bg-gray-100 text-gray-500'
                                    }`}
                            >
                                {sponsor.is_assigned ? (
                                    <div className="flex items-center gap-1">
                                        <CheckCircle2 className="h-2.5 w-2.5" />
                                        Assigned
                                    </div>
                                ) : 'Vacant'}
                            </Badge>
                        </div>

                        {/* Teacher Info Area */}
                        <div className="relative mt-auto pt-6 border-t border-gray-50 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center transition-all duration-300 ${sponsor.is_assigned
                                        ? 'bg-white border border-blue-100 shadow-sm text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600'
                                        : 'bg-white border border-dashed border-gray-200 text-gray-300'
                                    }`}>
                                    {sponsor.is_assigned
                                        ? <User className="h-5 w-5" />
                                        : <UserPlus className="h-5 w-5" />
                                    }
                                </div>
                                <div className="space-y-0.5 min-w-0">
                                    <p className={`text-sm font-bold truncate transition-colors ${sponsor.is_assigned ? 'text-gray-900 group-hover:text-blue-700' : 'text-gray-400 italic'
                                        }`}>
                                        {sponsor.teacher_name || 'Assign a sponsor'}
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        <Info className="h-3 w-3 text-gray-300" />
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">
                                            Lead Class Advisor
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <Button
                                size="icon"
                                variant="ghost"
                                className={`h-9 w-9 rounded-xl shrink-0 border border-transparent transition-all hover:bg-white hover:border-gray-100 hover:shadow-sm ${sponsor.is_assigned
                                        ? 'text-gray-400 hover:text-blue-600'
                                        : 'text-gray-300 hover:text-blue-600'
                                    }`}
                                onClick={() => onAssignSponsor(sponsor.section_id, sponsor.teacher_id)}
                            >
                                <Edit3 className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
