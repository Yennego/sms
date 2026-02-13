'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TeacherList from '@/components/teachers/teacher-list';
import TeacherForm from '@/components/teachers/teacher-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Users, FileText } from 'lucide-react';
import type { Teacher } from '@/types/teacher';

export default function TeachersPage() {
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
    setRefreshKey(prev => prev + 1); // Trigger refresh of teacher list
  };

  const handleEditSuccess = () => {
    setEditingTeacher(null);
    setRefreshKey(prev => prev + 1); // Trigger refresh of teacher list
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
  };

  const handleAddNew = () => {
    router.push('/teachers/new');
  };

  const handleBulkRequest = () => {
    // TODO: Implement bulk request functionality
    console.log('Bulk request functionality to be implemented');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teachers</h1>
          <p className="text-gray-600 mt-1">Manage your school&apos;s teaching staff</p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleBulkRequest}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Bulk Request
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Teacher
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
              </DialogHeader>
              <TeacherForm
                onSave={handleCreateSuccess}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Teacher Dialog */}
      <Dialog open={!!editingTeacher} onOpenChange={(open) => !open && setEditingTeacher(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
          </DialogHeader>
          {editingTeacher && (
            <TeacherForm
              teacher={editingTeacher}
              mode="edit"
              onSave={handleEditSuccess}
              onCancel={() => setEditingTeacher(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Teacher List */}
      <TeacherList
        key={refreshKey}
        onEdit={handleEdit}
        onAdd={handleAddNew}
      />
    </div>
  );
}