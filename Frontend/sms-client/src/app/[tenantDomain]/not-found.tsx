'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function NotFound() {
    const params = useParams();
    const tenantDomain = params?.tenantDomain as string;

    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
            <div className="bg-blue-50 p-6 rounded-full">
                <FileQuestion className="h-12 w-12 text-blue-600" />
            </div>
            <div className="space-y-2">
                <h2 className="text-3xl font-bold text-gray-900">Page Not Found</h2>
                <p className="text-gray-600 max-w-md mx-auto">
                    The page you are looking for doesn't exist or has been moved.
                </p>
            </div>
            <Link href={`/${tenantDomain}/dashboard`}>
                <Button>Return to Dashboard</Button>
            </Link>
        </div>
    );
}
