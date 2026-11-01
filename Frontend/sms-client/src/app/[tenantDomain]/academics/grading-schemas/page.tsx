'use client';

import React from 'react';
import { GradingSchemaManager } from '@/components/academics/grading/GradingSchemaManager';
import { PassMarkCard } from '@/components/report-cards/pass-mark-card';

export default function GradingSchemasPage() {
    return (
        <div className="container mx-auto space-y-6 py-6">
            <PassMarkCard />
            <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Category weights decide period grades: each category&rsquo;s score is the average of its
                assessments in the period, weighted as set below. Categories with no assessments in a period
                are left out and the other weights scaled up to 100.
            </p>
            <GradingSchemaManager />
        </div>
    );
}
