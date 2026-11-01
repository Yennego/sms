'use client';

// Void a payment with a reason. The receipt keeps its number and stays visible, marked VOID.
// Who may void is decided by the server (the receiver the same day, or the principal/admin);
// when it refuses, its message is shown as given and the dialog stays open.
import * as React from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { errorMessage } from '@/components/students/format';
import type { Payment } from '@/services/api/fees-service';
import { errorStatus, formatMoney } from './money';
import { useVoidPayment } from './queries';

export function VoidPaymentDialog({
  payment,
  onOpenChange,
}: {
  payment: Payment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const voidPayment = useVoidPayment();
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');
  const id = React.useId();

  React.useEffect(() => {
    if (payment) {
      setReason('');
      setError('');
    }
  }, [payment]);

  const confirm = async () => {
    if (!payment) return;
    const text = reason.trim();
    if (text.length < 3) {
      setError('Say why this payment is being voided, e.g. "Entered twice".');
      throw new Error('reason required');
    }
    try {
      await voidPayment.mutateAsync({ id: payment.id, reason: text });
      notify.success(`Receipt ${payment.receipt_number} voided`, {
        description: 'It stays on record marked VOID. The balance has been updated.',
      });
    } catch (e) {
      const status = errorStatus(e);
      const msg = errorMessage(
        e,
        status === 403
          ? 'Only the person who recorded it can void it the same day. After that, ask the principal or administrator.'
          : "Couldn't void this payment. Check your connection and try again."
      );
      setError(msg);
      notify.error(msg);
      throw e;
    }
  };

  return (
    <ConfirmDialog
      open={Boolean(payment)}
      onOpenChange={onOpenChange}
      title={payment ? `Void receipt ${payment.receipt_number}?` : 'Void receipt?'}
      description={
        payment
          ? `${formatMoney(payment.amount, payment.currency)} from ${payment.student_name ?? 'this student'} will no longer count as paid. The receipt keeps its number and is marked VOID.`
          : undefined
      }
      confirmLabel="Void payment"
      destructive
      loading={voidPayment.isPending}
      onConfirm={confirm}
    >
      <div className="grid gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          Reason <span className="text-destructive" aria-hidden="true">*</span>
        </label>
        <Textarea
          id={id}
          rows={3}
          value={reason}
          maxLength={500}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError('');
          }}
          placeholder="e.g. Entered twice; the family paid once."
        />
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
