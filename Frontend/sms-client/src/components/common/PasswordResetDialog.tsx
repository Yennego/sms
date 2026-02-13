import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface PasswordResetDialogProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    userEmail?: string;
    userType: 'Student' | 'Teacher' | 'Parent' | 'User';
    onReset: (userId: string, newPassword: string, newEmail?: string) => Promise<void>;
}

export function PasswordResetDialog({
    isOpen,
    onClose,
    userId,
    userName,
    userEmail,
    userType,
    onReset
}: PasswordResetDialogProps) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newEmail, setNewEmail] = useState(userEmail || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword && newPassword.length < 8) {
            toast.error('Password must be at least 8 characters long');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        try {
            setIsLoading(true);
            await onReset(userId, newPassword, newEmail !== userEmail ? newEmail : undefined);
            toast.success(`${userType} credentials updated successfully`);
            onClose();

            // Reset form
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error('Password reset failed:', error);
            toast.error(error.message || 'Failed to reset credentials');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <KeyRound className="h-5 w-5 text-indigo-600" />
                        Reset Credentials
                    </DialogTitle>
                    <DialogDescription>
                        Update login credentials for <strong>{userName}</strong>.
                        Leave password blank if you only want to update the email.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-500" />
                            Email Address
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="user@example.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading || (!newPassword && newEmail === userEmail)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                'Update Credentials'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
