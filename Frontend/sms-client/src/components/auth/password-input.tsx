'use client';

import { forwardRef, useState, type ComponentProps } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'> & {
  /** Show the lock icon on the left (sign-in style forms) */
  withIcon?: boolean;
};

/** Password field with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, withIcon = false, disabled, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const Toggle = visible ? EyeOff : Eye;

    return (
      <div className="relative">
        {withIcon && <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={cn(withIcon && 'pl-10', 'pr-11', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          <Toggle className="h-4 w-4" />
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';
