'use client';

import { useState, useMemo } from 'react';
import {
    useStudentFees,
    useRecordPayment,
    useRevenueSummary,
    useUpdateStudentFee,
    useDeleteStudentFee,
    useCreateStudentFee,
    useBulkCreateStudentFees,
    useFeeStructures,
    useExportFeesXlsx,
    useExportFeesPdf
} from '@/hooks/queries/finance';
import { useStudents } from '@/hooks/queries/students';
import { useToast } from '@/hooks/use-toast';
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
    Badge,
    Flex,
    Icon,
    ProgressBar
} from '@tremor/react';
import {
    Loader2,
    CreditCard,
    Search,
    Filter,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    AlertCircle,
    Calendar,
    Download,
    Eye,
    Trash2,
    Edit,
    PlusCircle,
    UserPlus,
    Plus,
    Trash
} from 'lucide-react';
import { toast } from 'sonner';

export default function FeesCollectionPage() {
    const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
    const [selectedFee, setSelectedFee] = useState<any | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isBulkAssign, setIsBulkAssign] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Payment Form
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('CASH');

    // Assignment Form
    const [assignStudentId, setAssignStudentId] = useState('');
    const [assignStructureId, setAssignStructureId] = useState('');
    const [assignAmount, setAssignAmount] = useState('');
    const [isInstallmentPlan, setIsInstallmentPlan] = useState(false);
    const [installments, setInstallments] = useState<{ amount: string, due_date: string }[]>([]);

    const { data: fees, isLoading: loadingFees } = useStudentFees();
    const { data: revenueSummary, isLoading: loadingSummary } = useRevenueSummary();
    const { data: students } = useStudents(selectedGradeId ? { grade: selectedGradeId } : undefined);
    const { data: structures } = useFeeStructures();

    const recordPaymentMutation = useRecordPayment();
    const updateFeeMutation = useUpdateStudentFee();
    const deleteFeeMutation = useDeleteStudentFee();
    const assignFeeMutation = useCreateStudentFee();
    const bulkAssignFeeMutation = useBulkCreateStudentFees();
    const exportXlsxMutation = useExportFeesXlsx();
    const exportPdfMutation = useExportFeesPdf();
    const { toast } = useToast();

    const filteredFees = useMemo(() => {
        if (!fees) return [];
        return fees.filter(fee => {
            const matchesSearch = (fee.student_name || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'ALL' || fee.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [fees, searchQuery, statusFilter]);

    const handleExport = async (format: 'pdf' | 'xlsx') => {
        try {
            const mutation = format === 'xlsx' ? exportXlsxMutation : exportPdfMutation;
            const blob = await mutation.mutateAsync();

            // 1. Convert blob to ArrayBuffer for analysis
            const buffer = await blob.arrayBuffer();
            let bytes = new Uint8Array(buffer);
            
            const checkSignatures = (data: Uint8Array) => {
                const isPdf = data[0] === 0x25 && data[1] === 0x50;
                const isXlsx = data[0] === 0x50 && data[1] === 0x4B;
                return { isPdf, isXlsx };
            };

            let { isPdf, isXlsx } = checkSignatures(bytes);

            // 2. Base64-JSON Awareness: Handle the new "Bulletproof" transport model
            if (!isPdf && !isXlsx) {
                const text = new TextDecoder().decode(bytes);
                try {
                    const json = JSON.parse(text);
                    if (json.file_content) {
                        // Decode Base64 content back to binary
                        const binaryString = window.atob(json.file_content);
                        const restoredBytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            restoredBytes[i] = binaryString.charCodeAt(i);
                        }
                        bytes = restoredBytes;
                        const check = checkSignatures(bytes);
                        isPdf = check.isPdf;
                        isXlsx = check.isXlsx;
                    }
                } catch (e) {
                    // Not a valid JSON or not our special Base64 format, continue to legacy/error checks
                }
            }

            // 3. Legacy Defensive: Check for raw JSON-wrapped binary (The "Shadow Serializer" Issue)
            if (!isPdf && !isXlsx) {
                const text = new TextDecoder().decode(bytes.slice(0, 2000));
                if (text.trim().startsWith('"')) {
                    try {
                        const fullText = new TextDecoder().decode(bytes);
                        const unquoted = JSON.parse(fullText);
                        if (typeof unquoted === 'string') {
                            const restoredBytes = new Uint8Array(unquoted.length);
                            for (let i = 0; i < unquoted.length; i++) {
                                restoredBytes[i] = unquoted.charCodeAt(i) & 0xff;
                            }
                            const check = checkSignatures(restoredBytes);
                            if (check.isPdf || check.isXlsx) {
                                bytes = restoredBytes;
                                isPdf = check.isPdf;
                                isXlsx = check.isXlsx;
                            }
                        }
                    } catch (e) { /* Fallback */ }
                }
            }

            // 4. Download Execution
            if (isPdf || isXlsx) {
                const finalBlob = new Blob([bytes], { 
                    type: isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                });
                const url = window.URL.createObjectURL(finalBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `student_fees_${new Date().getTime()}.${isPdf ? 'pdf' : 'xlsx'}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                return;
            }

            // 5. Error Fallback
            const errorText = new TextDecoder().decode(bytes.slice(0, 2000));
            try {
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.detail || errorData.message || 'Export failed on server');
            } catch (jsonErr) {
                if (errorText.includes('<!DOCTYPE html>') || errorText.includes('<html')) {
                    throw new Error('Server returned an error page. Please contact support.');
                }
                throw new Error('Export failed: Unexpected response format');
            }
        } catch (error: any) {
            console.error('Export error:', error);
            toast({
                title: "Export Failed",
                description: error.message || "An error occurred during export.",
                variant: "destructive",
            });
        }
    };

    const stats = useMemo(() => {
        if (!revenueSummary) return { rate: 0, pending: 0, collected: 0 };
        const total = revenueSummary.total_expected || 1;
        const rate = (revenueSummary.total_collected / total) * 100;
        return {
            rate: Math.round(rate),
            pending: revenueSummary.total_pending,
            collected: revenueSummary.total_collected
        };
    }, [revenueSummary]);

    if (loadingFees || loadingSummary) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }

    const handleStructureChange = (id: string) => {
        setAssignStructureId(id);
        const structure = structures?.find(s => s.id === id);
        if (structure) {
            setAssignAmount(structure.amount.toString());

            // Reset installments with the default structure due date
            setInstallments([{ amount: structure.amount.toString(), due_date: structure.due_date }]);

            // Clear students when structure change if not bulk
            if (!isBulkAssign) {
                setAssignStudentId('');
            }
            // Set grade ID for filtering students
            const structAny = structure as any;
            setSelectedGradeId(structAny.grade_id || null);
        } else {
            setSelectedGradeId(null);
            setInstallments([]);
        }
    };

    const handleAssignFee = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate installments
        if (isInstallmentPlan) {
            const totalInst = installments.reduce((sum, inst) => sum + Number(inst.amount), 0);
            if (Math.abs(totalInst - Number(assignAmount)) > 0.01) {
                toast.error(`Installment total ($${totalInst}) must match fee amount ($${assignAmount})`);
                return;
            }
        }

        const payload: any = {
            fee_structure_id: assignStructureId,
            installments: isInstallmentPlan ? installments.map(i => ({
                amount: Number(i.amount),
                due_date: i.due_date
            })) : undefined
        };

        if (isBulkAssign) {
            try {
                const res = await bulkAssignFeeMutation.mutateAsync(payload);
                toast.success(`Broadcasting complete: ${res.count} fees assigned, ${res.skipped} already assigned.`);
                setIsAssignModalOpen(false);
                resetAssignForm();
            } catch (error) {
                toast.error('Failed to perform bulk assignment');
            }
        } else {
            if (!assignStudentId || !assignStructureId || !assignAmount) {
                toast.error('Please fill all required fields for single assignment.');
                return;
            }
            payload.student_id = assignStudentId;
            payload.total_amount = Number(assignAmount);
            payload.balance = Number(assignAmount);

            try {
                await assignFeeMutation.mutateAsync(payload);
                toast.success('Fee successfully assigned to student');
                setIsAssignModalOpen(false);
                resetAssignForm();
            } catch (error) {
                toast.error('Failed to assign fee');
            }
        }
    };

    const resetAssignForm = () => {
        setAssignStudentId('');
        setAssignStructureId('');
        setAssignAmount('');
        setIsInstallmentPlan(false);
        setInstallments([]);
        setIsBulkAssign(false);
        setSelectedGradeId(null);
    };
    const handleAddInstallment = () => {
        const lastDate = installments.length > 0 ? installments[installments.length - 1].due_date : new Date().toISOString().split('T')[0];
        setInstallments([...installments, { amount: '', due_date: lastDate }]);
    };

    const handleRemoveInstallment = (index: number) => {
        setInstallments(installments.filter((_, i) => i !== index));
    };

    const handleUpdateInstallment = (index: number, field: string, value: string) => {
        const newInst = [...installments];
        newInst[index] = { ...newInst[index], [field]: value };
        setInstallments(newInst);
    };


    const handleRecordPayment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFee || !paymentAmount) return;

        recordPaymentMutation.mutate(
            {
                student_fee_id: selectedFee.id,
                amount_paid: Number(paymentAmount),
                payment_method: paymentMethod,
            },
            {
                onSuccess: () => {
                    toast.success('Payment recorded successfully');
                    setSelectedFee(null);
                    setPaymentAmount('');
                }
            }
        );
    };

    const handleDelete = (id: string) => {
        if (!confirm('Are you sure you want to delete this fee record?')) return;
        deleteFeeMutation.mutate(id, {
            onSuccess: () => toast.success('Record deleted')
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Quick Stats */}
            <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
                <Card decoration="top" decorationColor="emerald" className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm transition-all hover:shadow-md">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Total Collected</Text>
                            <Metric className="mt-1 font-bold text-emerald-600">${stats.collected.toLocaleString()}</Metric>
                        </div>
                        <Icon icon={CheckCircle2} color="emerald" variant="light" size="lg" />
                    </Flex>
                    <Flex className="mt-4">
                        <Text className="truncate text-gray-500">Collection Rate</Text>
                        <Text className="font-bold">{stats.rate}%</Text>
                    </Flex>
                    <ProgressBar value={stats.rate} color="emerald" className="mt-2" />
                </Card>

                <Card decoration="top" decorationColor="rose" className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm transition-all hover:shadow-md">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Outstanding Balance</Text>
                            <Metric className="mt-1 font-bold text-rose-600">${stats.pending.toLocaleString()}</Metric>
                        </div>
                        <Icon icon={AlertCircle} color="rose" variant="light" size="lg" />
                    </Flex>
                </Card>

                <Card decoration="top" decorationColor="blue" className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm transition-all hover:shadow-md">
                    <Flex alignItems="start">
                        <div>
                            <Text className="text-gray-500 font-medium tracking-tight">Active Invoices</Text>
                            <Metric className="mt-1 font-bold">{fees?.length || 0}</Metric>
                        </div>
                        <Icon icon={Clock} color="blue" variant="light" size="lg" />
                    </Flex>
                </Card>
            </Grid>

            {/* Collection Interface */}
            <div className="bg-white/80 backdrop-blur-md rounded-xl border border-gray-100 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gray-50/30">
                    <Flex justifyContent="between" className="gap-4 flex-col sm:flex-row">
                        <div className="relative flex-1 max-w-md w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by student name..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <select
                                className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="ALL">All Status</option>
                                <option value="PAID">Paid</option>
                                <option value="PARTIAL">Partial</option>
                                <option value="PENDING">Pending</option>
                            </select>
                            <Button
                                onClick={() => setIsAssignModalOpen(true)}
                                className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                            >
                                <PlusCircle className="w-4 h-4 mr-2" />
                                Assign Fee
                            </Button>
                            <div className="flex bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
                                <Button
                                    variant="ghost"
                                    className="h-9 px-3 text-gray-600 hover:text-primary hover:bg-gray-50 rounded-none border-r border-gray-100 flex items-center"
                                    onClick={() => handleExport('xlsx')}
                                    disabled={exportXlsxMutation.isPending}
                                >
                                    {exportXlsxMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                    <span className="text-xs font-semibold">XLSX</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="h-9 px-3 text-gray-600 hover:text-primary hover:bg-gray-50 rounded-none flex items-center"
                                    onClick={() => handleExport('pdf')}
                                    disabled={exportPdfMutation.isPending}
                                >
                                    {exportPdfMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                    <span className="text-xs font-semibold">PDF</span>
                                </Button>
                            </div>
                        </div>
                    </Flex>
                </div>

                <div className="overflow-x-auto min-h-64">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow>
                                <TableHead>Student Info</TableHead>
                                <TableHead>Fee Type</TableHead>
                                <TableHead className="text-right">Expected</TableHead>
                                <TableHead className="text-right">Paid</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredFees.length > 0 ? (
                                filteredFees.map((fee) => (
                                    <TableRow key={fee.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900 leading-none mb-1">{fee.student_name || 'Anonymous Student'}</span>
                                                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">ID: {fee.student_id.split('-')[0]}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge color="zinc" className="rounded-sm">
                                                {fee.category_name || 'Institutional Fee'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-gray-600">
                                            ${Number(fee.total_amount).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-emerald-600">
                                            ${Number(fee.amount_paid).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`font-bold px-2 py-1 rounded-md text-sm border ${Number(fee.balance) > 0 ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'
                                                }`}>
                                                ${Number(fee.balance).toLocaleString()}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                color={fee.status === 'PAID' ? 'emerald' : fee.status === 'PARTIAL' ? 'amber' : 'rose'}
                                                className="uppercase text-[10px] font-bold"
                                            >
                                                {fee.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => { setSelectedFee(fee); setPaymentAmount(fee.balance.toString()); }}
                                                    disabled={fee.status === 'PAID'}
                                                    className="w-8 h-8 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-30"
                                                >
                                                    <CreditCard className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(fee.id)}
                                                    className="w-8 h-8 hover:bg-rose-50 hover:text-rose-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-20 text-gray-400 font-medium">
                                        No fee records match your criteria
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Payment Modal */}
            <Dialog open={!!selectedFee} onOpenChange={(open) => !open && setSelectedFee(null)}>
                <DialogContent className="sm:max-w-lg bg-white/95 backdrop-blur-xl border-gray-100 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <CreditCard className="w-6 h-6 text-primary" />
                            Record Fee Payment
                        </DialogTitle>
                        <DialogDescription>
                            Confirming payment for <span className="font-bold text-gray-900">{selectedFee?.student_name}</span>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 my-4">
                        <Flex>
                            <Text className="text-emerald-800 font-medium">Remaining Balance:</Text>
                            <Title className="text-emerald-600 font-bold">${selectedFee?.balance.toLocaleString()}</Title>
                        </Flex>
                    </div>

                    <form onSubmit={handleRecordPayment} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Payment Amount ($)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={selectedFee?.balance}
                                    required
                                    className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-gray-200 bg-white/50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Payment Method</label>
                            <select
                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white/50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                            >
                                <option value="CASH">Cash</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                                <option value="CHEQUE">Cheque</option>
                                <option value="CARD">Credit/Debit Card</option>
                            </select>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setSelectedFee(null)} className="rounded-lg border-gray-200">
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={recordPaymentMutation.isPending || !paymentAmount}
                                className="rounded-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 min-w-32"
                            >
                                {recordPaymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm Receipt
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Assign Fee Modal */}
            <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
                <DialogContent className="sm:max-w-lg bg-white/95 backdrop-blur-xl border-gray-100 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <UserPlus className="w-6 h-6 text-primary" />
                            Assign New Student Fee
                        </DialogTitle>
                        <DialogDescription>
                            Create a new fee record for a student based on existing fee structures.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleAssignFee} className="space-y-6 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Fee Structure</label>
                            <select
                                required
                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                value={assignStructureId}
                                onChange={(e) => handleStructureChange(e.target.value)}
                            >
                                <option value="">Select a structure...</option>
                                {structures?.map(struct => (
                                    <option key={struct.id} value={struct.id}>
                                        {struct.amount.toLocaleString()} - {struct.due_date} ({(struct as any).grade_name || 'All'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center justify-between bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-2">
                                <PlusCircle className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-semibold text-blue-900">Bulk Assignment</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-bold text-blue-400">Apply to entire Grade</span>
                                <button
                                    type="button"
                                    onClick={() => setIsBulkAssign(!isBulkAssign)}
                                    className={`w-10 h-5 rounded-full transition-all duration-300 relative ${isBulkAssign ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${isBulkAssign ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>

                        {!isBulkAssign && (
                            <div className="space-y-2 animate-in fade-in duration-300">
                                <label className="text-sm font-semibold text-gray-700">Select Student</label>
                                <select
                                    required
                                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    value={assignStudentId}
                                    onChange={(e) => setAssignStudentId(e.target.value)}
                                >
                                    <option value="">Choose a student...</option>
                                    {students?.items?.map((student: any) => (
                                        <option key={student.id} value={student.id}>
                                            {student.firstName} {student.lastName} ({student.admission_number || student.id.split('-')[0]})
                                        </option>
                                    ))}
                                </select>
                                {selectedGradeId && (
                                    <p className="text-[10px] text-gray-400 px-1 font-medium">Filtering students by selected structure's grade level.</p>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Total Amount ($)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    value={assignAmount}
                                    onChange={(e) => setAssignAmount(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Installment Plan Section */}
                        <div className="space-y-4 pt-2">
                            <Flex justifyContent="between" alignItems="center">
                                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-primary" />
                                    Installment Plan
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-bold text-gray-400">Enable plan</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsInstallmentPlan(!isInstallmentPlan)}
                                        className={`w-10 h-5 rounded-full transition-all duration-300 relative ${isInstallmentPlan ? 'bg-primary' : 'bg-gray-200'}`}
                                    >
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${isInstallmentPlan ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>
                            </Flex>

                            {isInstallmentPlan && (
                                <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100 animate-in slide-in-from-top-2 duration-300">
                                    {installments.map((inst, idx) => (
                                        <div key={idx} className="flex gap-2 items-end group">
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase px-1">Amount</label>
                                                <input
                                                    type="number"
                                                    placeholder="Amount"
                                                    required
                                                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-xs focus:ring-1 focus:ring-primary/20 outline-none"
                                                    value={inst.amount}
                                                    onChange={(e) => handleUpdateInstallment(idx, 'amount', e.target.value)}
                                                />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase px-1">Due Date</label>
                                                <input
                                                    type="date"
                                                    required
                                                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-xs focus:ring-1 focus:ring-primary/20 outline-none"
                                                    value={inst.due_date}
                                                    onChange={(e) => handleUpdateInstallment(idx, 'due_date', e.target.value)}
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="w-8 h-8 text-rose-500 hover:bg-rose-50 rounded-lg mb-0.5"
                                                onClick={() => handleRemoveInstallment(idx)}
                                            >
                                                <Trash className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-dashed border-gray-300 text-gray-500 hover:text-primary hover:border-primary/50 text-[11px] font-bold py-1"
                                        onClick={handleAddInstallment}
                                    >
                                        <Plus className="w-3 h-3 mr-1" />
                                        Add Installment
                                    </Button>
                                    <div className="flex justify-between items-center px-2 pt-2 border-t border-gray-200 mt-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scheduled Total</span>
                                        <span className={`text-sm font-bold ${Math.abs(installments.reduce((s, i) => s + Number(i.amount), 0) - Number(assignAmount)) < 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            ${installments.reduce((s, i) => s + Number(i.amount || 0), 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)} className="rounded-lg">
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    assignFeeMutation.isPending ||
                                    bulkAssignFeeMutation.isPending ||
                                    (!isBulkAssign && !assignStudentId) ||
                                    !assignStructureId ||
                                    (isInstallmentPlan && Math.abs(installments.reduce((s, i) => s + Number(i.amount || 0), 0) - Number(assignAmount)) > 0.01)
                                }
                                className="rounded-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 min-w-32"
                            >
                                {(assignFeeMutation.isPending || bulkAssignFeeMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isBulkAssign ? 'Bulk Assign' : 'Assign Fee'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
