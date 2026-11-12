'use client';

// A student hands in work for an assignment: their answer or a note, and/or a link to a file.

import * as React from 'react';
import { Loader2, Send } from 'lucide-react';

import { useSubmitWork } from '@/components/assignments/queries';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import type { Assignment } from '@/services/api/assignment-service';

export function SubmitWorkDialog({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const submit = useSubmitWork();
  const [content, setContent] = React.useState('');
  const [link, setLink] = React.useState('');
  const [error, setError] = React.useState('');

  const handIn = async () => {
    if (!content.trim() && !link.trim()) {
      setError('Write your answer or add a link to your work.');
      return;
    }
    setError('');
    try {
      await submit.mutateAsync({ assignment_id: assignment.id, content: content.trim(), attachment_url: link.trim() });
      notify.success(`Your work for ${assignment.title} is handed in.`);
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "Your work wasn't handed in. Check your connection and try again."));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !submit.isPending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">Hand in {assignment.title}</DialogTitle>
          <DialogDescription>Your teacher sees this once you hand it in. You can&apos;t change it afterwards.</DialogDescription>
        </DialogHeader>
        <div className="my-4 grid gap-4">
          <FormField label="Your answer or a note for your teacher" error={error || undefined}>
            <Textarea className="min-h-32 text-base md:text-sm" value={content} onChange={(e) => setContent(e.target.value)} />
          </FormField>
          <FormField label="Link to your work (optional)" description="For example a Google Drive or Dropbox link.">
            <Input
              type="url"
              inputMode="url"
              className="h-11 text-base md:h-9 md:text-sm"
              placeholder="https://"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </FormField>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={onClose} disabled={submit.isPending}>
            Cancel
          </Button>
          <Button className="min-h-11 md:min-h-9" onClick={handIn} disabled={submit.isPending}>
            {submit.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            Hand in work
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
