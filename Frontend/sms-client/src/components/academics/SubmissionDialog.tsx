'use client';

import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSubmissionService } from '@/services/api/submission-service';
import { toast } from 'sonner';
import { Loader2, Send, FileUp, Link as LinkIcon } from 'lucide-react';

interface SubmissionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    assignmentId: string;
    assignmentTitle: string;
    onSuccess?: () => void;
}

export function SubmissionDialog({
    isOpen,
    onClose,
    assignmentId,
    assignmentTitle,
    onSuccess
}: SubmissionDialogProps) {
    const { submitAssignment } = useSubmissionService();
    const [submitting, setSubmitting] = useState(false);
    const [content, setContent] = useState('');
    const [attachmentUrl, setAttachmentUrl] = useState('');

    const handleSubmit = async () => {
        if (!content && !attachmentUrl) {
            toast.error('Please provide some content or an attachment link');
            return;
        }

        setSubmitting(true);
        try {
            await submitAssignment({
                assignment_id: assignmentId,
                content,
                attachment_url: attachmentUrl
            });
            toast.success('Work submitted successfully!');
            onSuccess?.();
            onClose();
            setContent('');
            setAttachmentUrl('');
        } catch (err: any) {
            console.error('Submission failed:', err);
            toast.error(err?.message || 'Failed to submit work');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-indigo-600" />
                        Submit Work
                    </DialogTitle>
                    <DialogDescription>
                        Turn in your work for <span className="font-bold text-slate-900">{assignmentTitle}</span>.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="content">Your Work / Comments</Label>
                        <Textarea
                            id="content"
                            placeholder="Write your answer or add comments for the teacher..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="min-h-[120px] focus-visible:ring-indigo-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="attachment" className="flex items-center gap-2 font-semibold">
                            <LinkIcon className="h-4 w-4 text-slate-400" />
                            Attachment (Optional Link)
                        </Label>
                        <Input
                            id="attachment"
                            placeholder="https://google.drive/..."
                            value={attachmentUrl}
                            onChange={(e) => setAttachmentUrl(e.target.value)}
                            className="focus-visible:ring-indigo-500"
                        />
                        <p className="text-[10px] text-slate-400">Provide a link to your Google Drive, Dropbox, or any external file.</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="bg-indigo-600 hover:bg-indigo-700 font-bold"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Turn In'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
