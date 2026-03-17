import { ReactNode } from 'react';
import { FinanceNav } from './FinanceNav';

export default async function FinanceLayout({
    children,
    params
}: {
    children: ReactNode;
    params: Promise<{ tenantDomain: string }>;
}) {
    const resolvedParams = await params;
    const tenantDomain = resolvedParams.tenantDomain;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 xs:flex-row xs:items-center xs:justify-between">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">Finance Management</h2>
            </div>

            <FinanceNav tenantDomain={tenantDomain} />

            <div className="mt-4">
                {children}
            </div>
        </div>
    );
}
