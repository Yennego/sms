'use client';

import { useState } from 'react';
import { useFeeCategories, useCreateFeeCategory, useDeleteFeeCategory, useUpdateFeeCategory } from '@/hooks/queries/finance';
import { Card, Title, Text, Metric, Table, TableHead, TableRow, TableBody, TableCell, Badge, Flex, Button as TremorButton, Icon, TableHeaderCell } from '@tremor/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { PlusCircle, Trash2, Edit, Loader2, Tag } from 'lucide-react';
import { toast } from 'sonner';

export default function FeeCategoriesPage() {
    const { data: categories, isLoading } = useFeeCategories();
    const createMutation = useCreateFeeCategory();
    const updateMutation = useUpdateFeeCategory();
    const deleteMutation = useDeleteFeeCategory();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate({ name, description }, {
            onSuccess: () => {
                toast.success('Category created');
                setIsModalOpen(false);
                setName('');
                setDescription('');
            }
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory) return;
        updateMutation.mutate({ id: editingCategory.id, data: { name, description } }, {
            onSuccess: () => {
                toast.success('Category updated');
                setIsEditModalOpen(false);
                setEditingCategory(null);
                setName('');
                setDescription('');
            }
        });
    };

    const openEditModal = (cat: any) => {
        setEditingCategory(cat);
        setName(cat.name);
        setDescription(cat.description || '');
        setIsEditModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (!confirm('Are you sure? This might affect existing structures.')) return;
        deleteMutation.mutate(id, {
            onSuccess: () => toast.success('Category deleted')
        });
    };

    if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex justify-between items-center">
                <div>
                    <Title className="text-2xl font-bold">Fee Categories</Title>
                    <Text className="text-gray-500">Manage types of fees (e.g., Tuition, Library, Lab)</Text>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="bg-primary shadow-lg shadow-primary/20">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Category
                </Button>
            </div>

            <Card className="bg-white/80 backdrop-blur-md border-gray-100 shadow-xl p-0 overflow-hidden">
                <Table>
                    <TableHead className="bg-gray-50/50">
                        <TableRow>
                            <TableHeaderCell>Category Name</TableHeaderCell>
                            <TableHeaderCell>Description</TableHeaderCell>
                            <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {categories?.map((cat) => (
                            <TableRow key={cat.id} className="hover:bg-gray-50/50 transition-colors">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Tag className="w-4 h-4 text-primary" />
                                        </div>
                                        <span className="font-bold text-gray-900">{cat.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-gray-500 text-sm max-w-md truncate">
                                    {cat.description || 'No description provided'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEditModal(cat)} className="text-amber-500 hover:bg-amber-50 rounded-lg">
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)} className="text-rose-500 hover:bg-rose-50 rounded-lg">
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
                        <DialogTitle>Add Fee Category</DialogTitle>
                        <DialogDescription>Define a new type of fee that can be charged to students.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Name</label>
                            <input
                                required
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Tuition Fee"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Description</label>
                            <textarea
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-24"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Purpose of this fee..."
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createMutation.isPending} className="min-w-32 bg-primary">
                                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Category
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Fee Category</DialogTitle>
                        <DialogDescription>Modify the existing fee category details.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdate} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Name</label>
                            <input
                                required
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Tuition Fee"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Description</label>
                            <textarea
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-24"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Purpose of this fee..."
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
