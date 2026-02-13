import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Teacher } from '@/types/teacher';
import { useAssignSponsor } from '@/hooks/queries/teacher-assignments';
import { toast } from 'sonner';

interface AssignSponsorModalProps {
    isOpen: boolean;
    onClose: () => void;
    sectionId: string | null;
    sectionName: string;
    currentTeacherId: string | null;
    teachers: Teacher[];
}

export const AssignSponsorModal: React.FC<AssignSponsorModalProps> = ({
    isOpen,
    onClose,
    sectionId,
    sectionName,
    currentTeacherId,
    teachers,
}) => {
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>(currentTeacherId || '');
    const [loading, setLoading] = useState(false);
    const assignMutation = useAssignSponsor();

    const handleSave = async () => {
        if (!sectionId || !selectedTeacherId) return;

        setLoading(true);
        try {
            await assignMutation.mutateAsync({
                sectionId,
                teacherId: selectedTeacherId
            });
            toast.success('Class Sponsor assigned successfully');
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'Failed to assign class sponsor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Assign Class Sponsor</DialogTitle>
                    <DialogDescription>
                        Select a teacher to be the sponsor for <strong>{sectionName}</strong>.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="teacher">Teacher</Label>
                        <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select teacher..." />
                            </SelectTrigger>
                            <SelectContent>
                                {teachers.map(t => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.first_name} {t.last_name} ({t.employee_id})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading || !selectedTeacherId}>
                        {loading ? 'Saving...' : 'Save Assignment'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
