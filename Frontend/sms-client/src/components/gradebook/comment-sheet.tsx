'use client';

// Edit the comment on one mark. The comment joins the unsaved changes and is sent with
// "Save scores", like the mark itself.
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Sheet } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

export interface CommentTarget {
  assessmentId: string;
  studentId: string;
  studentName: string;
  assessmentTitle: string;
  comment: string;
}

export function CommentSheet({
  target,
  readOnly,
  onClose,
  onApply,
}: {
  target: CommentTarget | null;
  readOnly: boolean;
  onClose: () => void;
  onApply: (comment: string) => void;
}) {
  const [text, setText] = React.useState('');
  // Start from the cell's comment each time a cell is opened (adjusting state during render).
  const [shownFor, setShownFor] = React.useState<CommentTarget | null>(null);
  if (target !== shownFor) {
    setShownFor(target);
    if (target) setText(target.comment);
  }

  return (
    <Sheet
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      side="bottom"
      className="mx-auto max-w-xl"
      title={readOnly ? 'Comment' : 'Comment on this mark'}
      description={target ? `${target.studentName} · ${target.assessmentTitle}` : undefined}
      footer={
        readOnly ? (
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                onApply(text.trim());
                onClose();
              }}
            >
              Use this comment
            </Button>
          </>
        )
      }
    >
      {readOnly ? (
        <p className="text-base whitespace-pre-wrap md:text-sm">{target?.comment || 'No comment.'}</p>
      ) : (
        <FormField label="Comment" description='Saved with the marks when you choose "Save scores".'>
          <Textarea rows={4} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </FormField>
      )}
    </Sheet>
  );
}
