'use client';

import { useFeeInstallments, useRevenueSummary } from '@/hooks/queries/finance';
import { Card, Title, Text, Metric, Table, TableHead, TableRow, TableBody, TableCell, Badge, Grid, Flex, Icon, ProgressBar, TableHeaderCell } from '@tremor/react';
import {
    Clock,
    CreditCard,
    Calendar,
    AlertCircle,
    Loader2,
    CheckCircle2,
    ArrowUpRight,
    Search
} from 'lucide-react';
import { useState, useMemo } from 'react';

export default function InstallmentsPage() {
    const { data: installments, isLoading } = useFeeInstallments();
    const { data: summary } = useRevenueSummary();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredInstallments = useMemo(() => {
        if (!installments) return [];
        return installments.filter(inst =>
            (inst.student_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (inst.category_name || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [installments, searchQuery]);

    const stats = useMemo(() => {
        if (!installments) return { pending: 0, overdue: 0, total: 0 };
        const now = new Date();
        return {
            pending: installments.filter(i => i.status === 'PENDING').length,
            overdue: installments.filter(i => i.status === 'PENDING' && new Date(i.due_date) < now).length,
            total: installments.length
        };
    }, [installments]);

    if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Live Stats */}
            <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
                <Card decoration="top" decorationColor="blue" className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Active Installments</Text>
                            <Metric className="mt-1 font-bold text-blue-600">{stats.total}</Metric>
                        </div>
                        <Icon icon={CreditCard} color="blue" variant="light" size="lg" />
                    </Flex>
                </Card>

                <Card decoration="top" decorationColor="amber" className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Pending Payments</Text>
                            <Metric className="mt-1 font-bold text-amber-600">{stats.pending}</Metric>
                        </div>
                        <Icon icon={Clock} color="amber" variant="light" size="lg" />
                    </Flex>
                </Card>

                <Card decoration="top" decorationColor="rose" className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Overdue</Text>
                            <Metric className="mt-1 font-bold text-rose-600">{stats.overdue}</Metric>
                        </div>
                        <Icon icon={AlertCircle} color="rose" variant="light" size="lg" />
                    </Flex>
                </Card>
            </Grid>

            {/* Installments Table */}
            <div className="bg-white/80 backdrop-blur-md rounded-xl border border-gray-100 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gray-50/30">
                    <Flex justifyContent="between" className="gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by student or category..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </Flex>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHead className="bg-gray-50/50">
                            <TableRow>
                                <TableHeaderCell>Student</TableHeaderCell>
                                <TableHeaderCell>Fee Category</TableHeaderCell>
                                <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                                <TableHeaderCell>Due Date</TableHeaderCell>
                                <TableHeaderCell>Status</TableHeaderCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredInstallments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-20 text-gray-400">
                                        No installments found
                                    </TableCell>
                                </TableRow>
                            ) : filteredInstallments.map((inst) => {
                                const isOverdue = inst.status === 'PENDING' && new Date(inst.due_date) < new Date();
                                return (
                                    <TableRow key={inst.id} className="hover:bg-gray-50/50 transition-colors">
                                        <TableCell className="font-bold text-gray-900">
                                            {inst.student_name || 'Anonymous'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge color="zinc" className="rounded-sm uppercase text-[10px]">
                                                {inst.category_name || 'Tuition'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-gray-700">
                                            ${Number(inst.amount).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-500' : 'text-gray-400'}`} />
                                                <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-gray-600'}>
                                                    {inst.due_date}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                color={inst.status === 'PAID' ? 'emerald' : isOverdue ? 'rose' : 'amber'}
                                                className="uppercase text-[10px] font-bold"
                                            >
                                                {isOverdue ? 'OVERDUE' : inst.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
