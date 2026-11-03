'use client';

// Void a semester bill with a reason (approve_financial_transactions). The bill stays on the
// statement marked Void and no longer counts. The server refuses while payments still count
// against the bill: those payments have to be voided first. We say so up front, and when it
// refuses, its message is shown as given and the dialog stays open.
import * as React from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { errorMessage } from '@/components/students/format';
import { CURRENCIES, type Invoice } from '@/services/api/fees-service';
import { anyPositive, errorStatus, formatMoney, isPositive } from './money';
import { useVoidInvoice } from './queries';

export function VoidInvoiceDialog({
  invoice,
  onOpenChange,
}: {
  invoice: Invoice | null;
  onOpenChange: (open: boolean) => void;
}) {
  const voidInvoice = useVoidInvoice();
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');
  const id = React.useId();

  React.useEffect(() => {
    if (invoice) {
      setReason('');
      setError('');
    }
  }, [invoice]);

  const name = invoice?.semester_name || 'semester';
  const paid = invoice
    ? CURRENCIES.filter((c) => isPositive(invoice.paid?.[c]))
        .map((c) => formatMoney(invoice.paid?.[c], c))
        .join(' and ')
    : '';
  const hasPayments = Boolean(invoice && anyPositive(invoice.paid));

  const confirm = async () => {
    if (!invoice) return;
    const text = reason.trim();
    if (text.length < 3) {
      setError('Say why this invoice is being voided, e.g. "Issued to the wrong class".');
      throw new Error('reason required');
    }
    try {
      await voidInvoice.mutateAsync({ id: invoice.id, reason: text });
      notify.success(`${name} invoice voided`, {
        description: 'It stays on the statement marked Void. The balance has been updated.',
      });
    } catch (e) {
      const msg = errorMessage(
        e,
        errorStatus(e) === 409
          ? 'Payments are recorded against this invoice. Void those payments first.'
          : "Couldn't void this invoice. Check your connection and try again."
      );
      setError(msg);
      notify.error(msg);
      throw e;
    }
  };

  return (
    <ConfirmDialog
      open={Boolean(invoice)}
      onOpenChange={onOpenChange}
      title={`Void the ${name} invoice?`}
      description="It will no longer count toward the balance. It stays on the statement marked Void."
      confirmLabel="Void invoice"
      destructive
      loading={voidInvoice.isPending}
      onConfirm={confirm}
    >
      <div className="grid gap-3">
        {hasPayments ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {paid} is paid on this invoice. An invoice with payments can&apos;t be voided: void those payments
            first (open each receipt under Payments), then void the invoice.
          </p>
        ) : null}
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
            placeholder="e.g. Issued to the wrong class."
          />
          {error ? (
            <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </ConfirmDialog>
  );
}
