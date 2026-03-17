'use client';

import { useState } from 'react';
import { useFeeStructures, useFeeCategories, useCreateFeeStructure, useDeleteFeeStructure, useUpdateFeeStructure } from '@/hooks/queries/finance';
import { useGrades } from '@/hooks/queries/academic-grades';
import { useCurrentAcademicYearDetail } from '@/hooks/queries/academic-years';
import { Card, Title, Text, Table, TableHead, TableRow, TableBody, TableCell, Badge, TableHeaderCell } from '@tremor/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { PlusCircle, Trash2, Loader2, DollarSign, School, Edit } from 'lucide-react';
import { toast } from 'sonner';

export default function FeeStructuresPage() {
    const { data: structures, isLoading: loadingStructures } = useFeeStructures();
    const { data: categories } = useFeeCategories();
    const { data: grades } = useGrades();
    const { data: currentYear } = useCurrentAcademicYearDetail();

    const createMutation = useCreateFeeStructure();
    const updateMutation = useUpdateFeeStructure();
    const deleteMutation = useDeleteFeeStructure();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingStructure, setEditingStructure] = useState<any>(null);
    const [categoryId, setCategoryId] = useState('');
    const [gradeId, setGradeId] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentYear) {
            toast.error('No active academic year found');
            return;
        }
        createMutation.mutate({
            category_id: categoryId,
            academic_year_id: currentYear.id,
            grade_id: gradeId,
            amount: Number(amount),
            due_date: dueDate
        } as any, {
            onSuccess: () => {
                toast.success('Fee structure created');
                setIsModalOpen(false);
                setAmount('');
                setDueDate('');
            }
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStructure) return;
        updateMutation.mutate({
            id: editingStructure.id,
            data: {
                amount: Number(amount),
                due_date: dueDate
            }
        }, {
            onSuccess: () => {
                toast.success('Fee structure updated');
                setIsEditModalOpen(false);
                setEditingStructure(null);
                setAmount('');
                setDueDate('');
            }
        });
    };

    const openEditModal = (struct: any) => {
        setEditingStructure(struct);
        setAmount(struct.amount.toString());
        setDueDate(struct.due_date);
        setIsEditModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (!confirm('Are you sure you want to delete this pricing policy?')) return;
        deleteMutation.mutate(id, {
            onSuccess: () => toast.success('Policy deleted')
        });
    };

    const isLoading = loadingStructures;

    if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex justify-between items-center">
                <div>
                    <Title className="text-2xl font-bold">Fee Structures</Title>
                    <Text className="text-gray-500">Define pricing policies per grade level.</Text>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="bg-primary shadow-lg shadow-primary/20">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Structure
                </Button>
            </div>

            <Card className="bg-white/80 backdrop-blur-md border-gray-100 shadow-xl p-0 overflow-hidden">
                <Table>
                    <TableHead className="bg-gray-50/50">
                        <TableRow>
                            <TableHeaderCell>Category</TableHeaderCell>
                            <TableHeaderCell>Grade Level</TableHeaderCell>
                            <TableHeaderCell className="text-right">Policy Amount</TableHeaderCell>
                            <TableHeaderCell>Default Due Date</TableHeaderCell>
                            <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {structures?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-gray-400">
                                    No structures defined. Please add categories and grades first.
                                </TableCell>
                            </TableRow>
                        ) : structures?.map((struct) => (
                            <TableRow key={struct.id} className="hover:bg-gray-50/50 transition-colors">
                                <TableCell>
                                    <Badge color="zinc" className="font-bold uppercase tracking-wider text-[10px]">
                                        {(struct as any).category_name || 'Institutional'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <School className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="font-medium text-gray-700">{(struct as any).grade_name || 'All Grades'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <span className="font-bold text-gray-900">${struct.amount.toLocaleString()}</span>
                                </TableCell>
                                <TableCell className="text-gray-500 text-sm">
                                    {struct.due_date}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEditModal(struct)} className="text-amber-500 hover:bg-amber-50 rounded-lg">
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(struct.id)} className="text-rose-500 hover:bg-rose-50 rounded-lg">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Fee Structure</DialogTitle>
                        <DialogDescription>Set the required payment amount for a specific grade.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Category</label>
                                <select
                                    required
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={categoryId}
                                    onChange={e => setCategoryId(e.target.value)}
                                >
                                    <option value="">Select Category</option>
                                    {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Grade Level</label>
                                <select
                                    required
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={gradeId}
                                    onChange={e => setGradeId(e.target.value)}
                                >
                                    <option value="">Select Grade</option>
                                    {grades?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Policy Amount ($)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="number"
                                    required
                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="200"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Default Due Date</label>
                            <input
                                type="date"
                                required
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createMutation.isPending || !categoryId || !gradeId} className="min-w-32 bg-primary">
                                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Set Policy
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Fee Structure</DialogTitle>
                        <DialogDescription>
                            Modifying policy for {(editingStructure as any)?.category_name} - {(editingStructure as any)?.grade_name}.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdate} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Policy Amount ($)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="number"
                                    required
                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="200"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Default Due Date</label>
                            <input
                                type="date"
                                required
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={updateMutation.isPending} className="min-w-32 bg-primary">
                                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
