'use client';

import React from 'react';
import { ActivityLogList } from '@/components/admin/ActivityLogList';

export default function ActivityLogsPage() {
    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">System Audit Logs</h1>
                <p className="text-muted-foreground">
                    Review and audit all administrative changes made within your school's portal.
                </p>
            </div>

            <ActivityLogList />
        </div>
    );
}
