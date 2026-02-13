'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useTenantNavigation } from '@/hooks/use-tenant';

export default function NewStudentPage() {
    const router = useRouter();
    const { createTenantPath } = useTenantNavigation();

    useEffect(() => {
        // Redirect to unified Add & Enroll flow
        router.replace(createTenantPath('/academics/enrollments'));
    }, [router, createTenantPath]);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Student Creation Moved</h1>
                <p className="text-gray-600 mt-1">
                    New students are now added through the Enrollment workflow.
                </p>
            </div>
            <Button onClick={() => router.push(createTenantPath('/academics/enrollments'))}>
                Go to Add & Enroll
            </Button>
        </div>
    );
}