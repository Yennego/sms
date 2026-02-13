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
    // Simple console log for now - you can enhance this later
    console.log(`Toast: ${newToast.title}`, newToast.description);
    
    // You can implement actual toast UI later
    if (newToast.variant === 'destructive') {
      console.error(`Error: ${newToast.title}`, newToast.description);
    }
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 3000);
  }, []);

  return { toast, toasts };
}