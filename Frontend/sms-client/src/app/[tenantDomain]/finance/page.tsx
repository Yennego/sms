import { redirect } from 'next/navigation';

export default async function FinanceRootPage({ params }: { params: Promise<{ tenantDomain: string }> }) {
    const { tenantDomain } = await params;
    // Redirect base /finance to the revenue dashboard
    redirect(`/${tenantDomain}/finance/revenue`);
}
