import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, User, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useTeacherSubjectAssignmentService } from '@/services/api/teacher-subject-assignment-service';
import { toast } from 'sonner';

interface Student {
    id: string;
    firstName: string;
    lastName: string;
    admission_number: string;
    gender: string;
}

interface ClassRosterModalProps {
    isOpen: boolean;
    onClose: () => void;
    classId: string | null;
    className: string;
    teacherName?: string;
}

export function ClassRosterModal({
    isOpen,
    onClose,
    classId,
    className,
    teacherName,
}: ClassRosterModalProps) {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const assignmentService = useTeacherSubjectAssignmentService();

    useEffect(() => {
        if (isOpen && classId) {
            loadStudents();
        } else {
            setStudents([]);
            setSearchTerm('');
        }
    }, [isOpen, classId]);

    const loadStudents = async () => {
        if (!classId) return;
        try {
            setLoading(true);
            const data = await assignmentService.getClassStudents(classId);
            setStudents(data);
        } catch (error) {
            console.error('Failed to load class roster:', error);
            toast.error('Failed to load student list');
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = students.filter(student =>
        student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.admission_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Class Roster</DialogTitle>
                    <DialogDescription>
                        {className} {teacherName && `• ${teacherName}`}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center space-x-2 my-2">
                    <Search className="h-4 w-4 text-gray-500" />
                    <Input
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1"
                    />
                </div>

                <div className="flex-1 min-h-[300px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <User className="h-12 w-12 mb-2 opacity-20" />
                            <p>No students found</p>
                        </div>
                    ) : (
                        <div className="h-[400px] overflow-y-auto pr-2">
                            <div className="space-y-2">
                                {filteredStudents.map((student) => (
                                    <div
                                        key={student.id}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                                    {student.firstName[0]}{student.lastName[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-medium leading-none">
                                                    {student.firstName} {student.lastName}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {student.admission_number} • {student.gender}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center text-xs text-muted-foreground mt-2 pt-2 border-t">
                    <span>Total Students: {students.length}</span>
                    <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
