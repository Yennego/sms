'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function FinanceNav({ tenantDomain }: { tenantDomain: string }) {
    const pathname = usePathname();

    const tabs = [
        { name: 'Dashboard', href: `/${tenantDomain}/finance/revenue` },
        { name: 'Student Fees', href: `/${tenantDomain}/finance/fees` },
        { name: 'Categories', href: `/${tenantDomain}/finance/categories` },
        { name: 'Structures', href: `/${tenantDomain}/finance/structures` },
        { name: 'Installments', href: `/${tenantDomain}/finance/installments` },
        { name: 'Expenditure', href: `/${tenantDomain}/finance/expenditure` },
    ];

    return (
        <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href;
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={cn(
                                "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200",
                                isActive
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            {tab.name}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
