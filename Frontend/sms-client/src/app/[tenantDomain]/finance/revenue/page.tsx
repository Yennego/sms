'use client';

import {
    Card,
    Title,
    Text,
    Metric,
    Flex,
    Grid,
    AreaChart,
    DonutChart,
    Icon,
    Badge,
    ProgressBar
} from '@tremor/react';
import { useRevenueSummary, useExpenditureSummary } from '@/hooks/queries/finance';
import {
    Loader2,
    TrendingUp,
    TrendingDown,
    Activity,
    PieChart,
    ArrowUpRight,
    ArrowDownRight,
    Wallet
} from 'lucide-react';

export default function RevenueDashboard() {
    const { data: revenue, isLoading: revLoading } = useRevenueSummary();
    const { data: expenses, isLoading: expLoading } = useExpenditureSummary();

    const isLoading = revLoading || expLoading;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    const netBalance = (revenue?.total_collected || 0) - (expenses?.total_spent || 0);
    const profitMargin = revenue?.total_collected ? Math.round((netBalance / revenue.total_collected) * 100) : 0;
    const isProfitable = netBalance >= 0;

    const chartData = [
        { name: 'Collected', Value: revenue?.total_collected || 0 },
        { name: 'Pending', Value: revenue?.total_pending || 0 },
        { name: 'Expenses', Value: expenses?.total_spent || 0 }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Executive Highlights */}
            <Grid numItemsSm={1} numItemsLg={4} className="gap-6">
                <Card decoration="top" decorationColor="blue" className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm transition-all hover:shadow-md">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Projected Revenue</Text>
                            <Metric className="mt-1 font-bold text-blue-600">${revenue?.total_expected?.toLocaleString() || '0'}</Metric>
                        </div>
                        <Icon icon={Activity} color="blue" variant="light" size="lg" />
                    </Flex>
                </Card>

                <Card decoration="top" decorationColor="emerald" className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm transition-all hover:shadow-md">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Realized Revenue</Text>
                            <Metric className="mt-1 font-bold text-emerald-600">${revenue?.total_collected?.toLocaleString() || '0'}</Metric>
                        </div>
                        <Icon icon={TrendingUp} color="emerald" variant="light" size="lg" />
                    </Flex>
                </Card>

                <Card decoration="top" decorationColor="rose" className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm transition-all hover:shadow-md">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Total Outflow</Text>
                            <Metric className="mt-1 font-bold text-rose-600">${expenses?.total_spent?.toLocaleString() || '0'}</Metric>
                        </div>
                        <Icon icon={TrendingDown} color="rose" variant="light" size="lg" />
                    </Flex>
                </Card>

                <Card decoration="top" decorationColor={isProfitable ? "emerald" : "rose"} className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm transition-all hover:shadow-md">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Net Cash Flow</Text>
                            <Metric className={`mt-1 font-bold ${isProfitable ? 'text-emerald-600' : 'text-rose-600'}`}>
                                ${netBalance.toLocaleString()}
                            </Metric>
                        </div>
                        <Icon icon={Wallet} color={isProfitable ? "emerald" : "rose"} variant="light" size="lg" />
                    </Flex>
                    <Flex className="mt-4 pt-4 border-t border-gray-100/50">
                        <Badge icon={isProfitable ? ArrowUpRight : ArrowDownRight} color={isProfitable ? "emerald" : "rose"}>
                            {profitMargin}% Margin
                        </Badge>
                        <Text className="text-xs text-gray-400 font-medium">vs total collected</Text>
                    </Flex>
                </Card>
            </Grid>

            {/* Visual Analytics */}
            <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
                <Card className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm">
                    <Flex>
                        <Title className="text-gray-700">Budget Distribution</Title>
                        <Icon icon={PieChart} color="zinc" variant="simple" />
                    </Flex>
                    <DonutChart
                        className="mt-8 h-72"
                        data={chartData}
                        category="Value"
                        index="name"
                        colors={["emerald", "amber", "rose"]}
                        valueFormatter={(number: number) => `$${Intl.NumberFormat('us').format(number).toString()}`}
                        showAnimation={true}
                    />
                    <div className="mt-6 space-y-2">
                        <Flex className="text-sm">
                            <Text>Projected vs Realized</Text>
                            <Text className="font-bold">
                                {revenue?.total_expected ? Math.round((revenue.total_collected / revenue.total_expected) * 100) : 0}%
                            </Text>
                        </Flex>
                        <ProgressBar
                            value={revenue?.total_expected ? (revenue.total_collected / revenue.total_expected) * 100 : 0}
                            color="blue"
                        />
                    </div>
                </Card>

                <Card className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm">
                    <Flex>
                        <Title className="text-gray-700">Financial Performance</Title>
                        <Badge color="zinc">Real-time Data</Badge>
                    </Flex>
                    <Text className="mt-2 text-gray-400 text-sm italic">
                        Visualizing the delta between expected receivables and actual cash inflows across all categories.
                    </Text>
                    <AreaChart
                        className="mt-8 h-80"
                        data={[
                            { date: 'Initial', 'Expected': 0, 'Collected': 0 },
                            { date: 'Current', 'Expected': revenue?.total_expected || 0, 'Collected': revenue?.total_collected || 0 },
                        ]}
                        index="date"
                        categories={['Expected', 'Collected']}
                        colors={['blue', 'emerald']}
                        valueFormatter={(num: number) => `$${num.toLocaleString()}`}
                        showAnimation={true}
                        showLegend={true}
                        showYAxis={false}
                    />
                    <div className="mt-4 p-4 bg-blue-50/30 rounded-lg border border-blue-100/50">
                        <Text className="text-blue-800 text-sm">
                            <strong>Note:</strong> Transaction history mapping is being synchronized. Currently displaying cumulative balance comparisons.
                        </Text>
                    </div>
                </Card>
            </Grid>
        </div>
    );
}
