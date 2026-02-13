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
import { Label } from '@/components/ui/label';
import { useSubmissionService, type Submission } from '@/services/api/submission-service';
import { toast } from 'sonner';
import { Loader2, FileText, ExternalLink, MessageSquare, CheckCircle2 } from 'lucide-react';

interface ViewSubmissionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    submission: Submission;
    studentName: string;
    onGraded?: () => void;
}

export function ViewSubmissionDialog({
    isOpen,
    onClose,
    submission,
    studentName,
    onGraded
}: ViewSubmissionDialogProps) {
    const { gradeSubmission } = useSubmissionService();
    const [isGrading, setIsGrading] = useState(false);
    const [feedback, setFeedback] = useState(submission.feedback || '');
    const [score, setScore] = useState<string>(submission.score !== undefined ? String(submission.score) : '');

    const handleSaveGrade = async () => {
        const numScore = parseFloat(score);
        if (isNaN(numScore)) {
            toast.error('Please enter a valid numeric score');
            return;
        }

        setIsGrading(true);
        try {
            await gradeSubmission(submission.id, {
                score: numScore,
                feedback
            });

            // Clear cache to ensure fresh data appears everywhere
            const { clearGlobalCache } = await import('@/services/api/api-client');
            clearGlobalCache();

            toast.success('Submission graded successfully!');
            onGraded?.();
            onClose();
        } catch (err: any) {
            console.error('Grading failed:', err);
            toast.error(err?.message || 'Failed to update grade');
        } finally {
            setIsGrading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-indigo-600" />
                        Submission: {studentName}
                    </DialogTitle>
                    <DialogDescription>
                        Submitted on {new Date(submission.submitted_at).toLocaleString()}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto py-6 space-y-6">
                    {/* Student Content */}
                    <div className="space-y-3">
                        <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Student's Work</Label>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap min-h-[100px]">
                            {submission.content || 'No text content provided.'}
                        </div>
                    </div>

                    {/* Attachment */}
                    {submission.attachment_url && (
                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attachment</Label>
                            <a
                                href={submission.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-xl group hover:bg-indigo-100 transition-colors"
                            >
                                <span className="text-sm font-medium text-indigo-700 truncate mr-2">
                                    {submission.attachment_url}
                                </span>
                                <ExternalLink className="h-4 w-4 text-indigo-400 group-hover:text-indigo-600" />
                            </a>
                        </div>
                    )}

                    <hr className="border-slate-100" />

                    {/* Feedback Form */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="score" className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-slate-400" />
                                    Awarded Score
                                </Label>
                                <input
                                    id="score"
                                    type="number"
                                    step="0.5"
                                    placeholder="0.0"
                                    value={score}
                                    onChange={(e) => setScore(e.target.value)}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="feedback" className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-slate-400" />
                                Teacher Feedback
                            </Label>
                            <Textarea
                                id="feedback"
                                placeholder="Add comments or instructions for the student..."
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                className="min-h-[100px] focus-visible:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="pt-4 border-t border-slate-100">
                    <Button variant="outline" onClick={onClose} disabled={isGrading}>
                        Close
                    </Button>
                    <Button
                        onClick={handleSaveGrade}
                        disabled={isGrading}
                        className="bg-indigo-600 hover:bg-indigo-700 font-bold"
                    >
                        {isGrading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Confirm Grade'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
