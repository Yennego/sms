import React, { useState, useEffect } from 'react';
import { X, Save, Box, Activity, NotebookIcon } from 'lucide-react';
import { TeacherSubjectAssignment, TeacherSubjectAssignmentUpdate } from '@/types/teacher-subject-assignment';
import { useUpdateAssignment } from '@/hooks/queries/teacher-assignments';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EditTeacherAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    assignment: TeacherSubjectAssignment | null;
    teacherName: string;
    subjectName: string;
    className: string;
}

export const EditTeacherAssignmentModal: React.FC<EditTeacherAssignmentModalProps> = ({
    isOpen,
    onClose,
    assignment,
    teacherName,
    subjectName,
    className,
}) => {
    const [room, setRoom] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const updateMutation = useUpdateAssignment();

    useEffect(() => {
        if (isOpen && assignment) {
            setRoom(assignment.room || '');
            setIsActive(assignment.is_active ?? true);
            setNotes(assignment.notes || '');
        }
    }, [isOpen, assignment]);

    const handleSave = async () => {
        if (!assignment) return;

        setLoading(true);
        try {
            const updateData: TeacherSubjectAssignmentUpdate = {
                room: room || undefined,
                is_active: isActive,
                notes: notes || undefined,
            };

            await updateMutation.mutateAsync({
                id: assignment.id,
                data: updateData,
            });

            toast.success('Assignment updated successfully');
            onClose();
        } catch (error: any) {
            console.error('Update failed:', error);
            toast.error(error.message || 'Failed to update assignment');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !assignment) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Edit Assignment</h2>
                        <p className="text-xs text-gray-500">{subjectName} • {className}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 mb-2">
                        <p className="text-xs text-blue-700">
                            Editing allocation for <span className="font-bold">{teacherName}</span>
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="room" className="text-sm font-semibold flex items-center gap-2">
                                <Box className="h-4 w-4 text-gray-400" />
                                Room / Location
                            </Label>
                            <Input
                                id="room"
                                placeholder="e.g. Room 204, Lab A..."
                                value={room}
                                onChange={(e) => setRoom(e.target.value)}
                                className="h-10 border-gray-200 focus:border-blue-500"
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="space-y-0.5">
                                <Label htmlFor="active-status" className="text-sm font-semibold flex items-center gap-2">
                                    <Activity className={`h-4 w-4 ${isActive ? 'text-green-500' : 'text-gray-400'}`} />
                                    Active Status
                                </Label>
                                <p className="text-xs text-gray-500">Enable or disable this assignment</p>
                            </div>
                            <Switch
                                id="active-status"
                                checked={isActive}
                                onCheckedChange={setIsActive}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes" className="text-sm font-semibold flex items-center gap-2">
                                <NotebookIcon className="h-4 w-4 text-gray-400" />
                                Internal Notes
                            </Label>
                            <Textarea
                                id="notes"
                                placeholder="Optional notes for this assignment..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[100px] border-gray-200 focus:border-blue-500 resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t bg-gray-50/50 flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]"
                    >
                        {loading ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
