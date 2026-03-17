'use client';

import { useState, useMemo } from 'react';
import {
    useExpenditures,
    useExpenseCategories,
    useCreateExpenditure,
    useUpdateExpenditure,
    useDeleteExpenditure
} from '@/hooks/queries/finance';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Card,
    Title,
    Text,
    Metric,
    Grid,
    AreaChart,
    Badge,
    Flex,
    Icon,
    TabGroup,
    TabList,
    Tab,
    Color
} from '@tremor/react';
import {
    Loader2,
    Plus,
    Trash2,
    Edit,
    TrendingDown,
    Wallet,
    Calendar,
    Search,
    Filter,
    ArrowUpRight
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { toast } from 'sonner';

export default function ExpenditurePage() {
    const { data: expenditures, isLoading: loadingExps } = useExpenditures();
    const { data: categories, isLoading: loadingCats } = useExpenseCategories();

    const createExpMutation = useCreateExpenditure();
    const updateExpMutation = useUpdateExpenditure();
    const deleteExpMutation = useDeleteExpenditure();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [categoryId, setCategoryId] = useState('');
    const [payee, setPayee] = useState('');
    const [description, setDescription] = useState('');

    const resetForm = () => {
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setCategoryId('');
        setPayee('');
        setDescription('');
        setEditingId(null);
    };

    const handleOpenEdit = (exp: any) => {
        setEditingId(exp.id);
        setAmount(exp.amount.toString());
        setDate(new Date(exp.date).toISOString().split('T')[0]);
        setCategoryId(exp.expense_category_id);
        setPayee(exp.payee || '');
        setDescription(exp.description || '');
        setIsModalOpen(true);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !categoryId || !date) return;

        const payload = {
            amount: Number(amount),
            expense_category_id: categoryId,
            date,
            payee,
            description
        };

        if (editingId) {
            updateExpMutation.mutate(
                { id: editingId, data: payload },
                {
                    onSuccess: () => {
                        toast.success('Expenditure updated successfully');
                        setIsModalOpen(false);
                        resetForm();
                    }
                }
            );
        } else {
            createExpMutation.mutate(payload, {
                onSuccess: () => {
                    toast.success('Expenditure recorded successfully');
                    setIsModalOpen(false);
                    resetForm();
                }
            });
        }
    };

    const handleDelete = (id: string) => {
        if (!confirm('Are you sure you want to delete this record?')) return;
        deleteExpMutation.mutate(id, {
            onSuccess: () => toast.success('Record deleted')
        });
    };

    // Analytics Calculation
    const stats = useMemo(() => {
        if (!expenditures) return { total: 0, thisMonth: 0, trend: [] };

        const now = new Date();
        const thisMonthRange = { start: startOfMonth(now), end: endOfMonth(now) };

        const total = expenditures.reduce((acc, curr) => acc + Number(curr.amount), 0);
        const thisMonth = expenditures
            .filter(exp => isWithinInterval(new Date(exp.date), thisMonthRange))
            .reduce((acc, curr) => acc + Number(curr.amount), 0);

        // Simple monthly trend for last 6 months
        const trend = Array.from({ length: 6 }).map((_, i) => {
            const d = subMonths(now, 5 - i);
            const range = { start: startOfMonth(d), end: endOfMonth(d) };
            const mTotal = expenditures
                .filter(exp => isWithinInterval(new Date(exp.date), range))
                .reduce((acc, curr) => acc + Number(curr.amount), 0);
            return {
                Month: format(d, 'MMM'),
                'Amount Spent': mTotal
            };
        });

        return { total, thisMonth, trend };
    }, [expenditures]);

    const filteredExps = useMemo(() => {
        if (!expenditures) return [];
        return expenditures.filter(exp =>
            (exp.payee?.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (exp.description?.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [expenditures, searchQuery]);

    if (loadingExps || loadingCats) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }

    const categoryMap = categories?.reduce((acc, cat) => {
        acc[cat.id] = cat.name;
        return acc;
    }, {} as Record<string, string>) || {};

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Stats Overview */}
            <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
                <Card decoration="top" decorationColor="rose" className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm transition-all hover:shadow-md">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Total Expenditures</Text>
                            <Metric className="mt-1 font-bold">${stats.total.toLocaleString()}</Metric>
                        </div>
                        <Icon icon={Wallet} color="rose" variant="light" size="lg" />
                    </Flex>
                </Card>
                <Card decoration="top" decorationColor="amber" className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm transition-all hover:shadow-md">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Spent This Month</Text>
                            <Metric className="mt-1 font-bold">${stats.thisMonth.toLocaleString()}</Metric>
                        </div>
                        <Icon icon={TrendingDown} color="amber" variant="light" size="lg" />
                    </Flex>
                </Card>
                <Card decoration="top" decorationColor="blue" className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm transition-all hover:shadow-md">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Active Categories</Text>
                            <Metric className="mt-1 font-bold">{categories?.length || 0}</Metric>
                        </div>
                        <Icon icon={Filter} color="blue" variant="light" size="lg" />
                    </Flex>
                </Card>
            </Grid>

            {/* Trend Chart */}
            <Card className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm">
                <Title className="text-gray-700">Spending Patterns (Last 6 Months)</Title>
                <AreaChart
                    className="mt-6 h-64"
                    data={stats.trend}
                    index="Month"
                    categories={['Amount Spent']}
                    colors={['rose']}
                    valueFormatter={(num) => `$${num.toLocaleString()}`}
                    showAnimation={true}
                />
            </Card>

            {/* Main Content Interface */}
            <div className="bg-white/80 backdrop-blur-md rounded-xl border border-gray-100 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gray-50/30">
                    <Flex justifyContent="between" className="gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by payee or description..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button
                            onClick={() => { resetForm(); setIsModalOpen(true); }}
                            className="bg-primary hover:bg-primary/90 text-white transition-all shadow-lg shadow-primary/20"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Record Expense
                        </Button>
                    </Flex>
                </div>

                <div className="overflow-x-auto min-h-64">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow>
                                <TableHead className="w-40">Date</TableHead>
                                <TableHead>Detail / Purpose</TableHead>
                                <TableHead>Payee</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredExps.length > 0 ? (
                                filteredExps.map((exp) => (
                                    <TableRow key={exp.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-gray-600 font-medium">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {format(new Date(exp.date), 'MMM dd, yyyy')}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <Badge color="zinc" className="mb-1 rounded-sm">
                                                    {categoryMap[exp.expense_category_id] || 'N/A'}
                                                </Badge>
                                                <div className="text-gray-900 font-medium flex items-center gap-1">
                                                    {exp.description || 'No description'}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-gray-600 font-medium">
                                            {exp.payee || <span className="text-gray-300">N/A</span>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="text-rose-600 font-bold bg-rose-50 px-2.5 py-1 rounded-md text-sm border border-rose-100">
                                                ${Number(exp.amount).toLocaleString()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenEdit(exp)}
                                                    className="w-8 h-8 hover:bg-amber-50 hover:text-amber-600 transition-all"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(exp.id)}
                                                    className="w-8 h-8 hover:bg-rose-50 hover:text-rose-600 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-20">
                                        <div className="flex flex-col items-center gap-3 text-gray-400">
                                            <Wallet className="w-12 h-12 opacity-20" />
                                            <p className="text-lg font-medium">No results found</p>
                                            <Text>Try adjusting your search or record a new expense.</Text>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Slide-over/Dialog Form */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-lg bg-white/95 backdrop-blur-xl border-gray-100 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            {editingId ? <Edit className="w-6 h-6 text-amber-500" /> : <Plus className="w-6 h-6 text-primary" />}
                            {editingId ? 'Edit Expenditure' : 'Record Expenditure'}
                        </DialogTitle>
                        <DialogDescription>
                            Enter the details of the outgoing payment below. This will update the monthly reports.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSave} className="space-y-6 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Expense Category</label>
                            <select
                                className="flex w-full rounded-lg border border-gray-200 bg-white/50 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                required
                            >
                                <option value="" disabled>Select a category...</option>
                                {categories?.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Amount ($)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-gray-200 bg-white/50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Transaction Date</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white/50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Payee (Vendor/Staff)</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white/50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                value={payee}
                                onChange={(e) => setPayee(e.target.value)}
                                placeholder="Who received the funds?"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Description / Purpose</label>
                            <textarea
                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white/50 text-sm min-h-24 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Provide more context about this expense..."
                            />
                        </div>

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-lg border-gray-200 hover:bg-gray-50">
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={createExpMutation.isPending || updateExpMutation.isPending || !amount || !categoryId || !date}
                                className="rounded-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 min-w-32"
                            >
                                {(createExpMutation.isPending || updateExpMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingId ? 'Update Record' : 'Record Expense'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
