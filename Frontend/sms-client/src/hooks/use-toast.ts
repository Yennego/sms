'use client';

import { useState, useCallback } from 'react';

interface Toast {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((newToast: Toast) => {
    // Simple console log for now
    console.log(`Toast: ${newToast.title}`, newToast.description);

    if (newToast.variant === 'destructive') {
      console.error(`Error: ${newToast.title}`, newToast.description);
    }

    setToasts(prev => [...prev, newToast]);

    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 3000);
  }, []);

  // Add success and error helper methods to the toast function
  const toastObj = Object.assign(toast, {
    success: (title: string, description?: string) => toast({ title, description }),
    error: (title: string, description?: string) => toast({ title, description, variant: 'destructive' })
  });

  return { toast: toastObj, toasts };
}