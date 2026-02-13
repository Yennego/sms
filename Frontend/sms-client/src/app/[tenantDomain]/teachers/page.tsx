'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenantNavigation } from '@/hooks/use-tenant';
import TeacherList from '@/components/teachers/teacher-list';
import TeacherForm from '@/components/teachers/teacher-form';
import BulkImportDialog from '@/components/teachers/bulk-import-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Plus, FileText } from 'lucide-react';
import { useCreateTeacher, useDeleteTeacher, useUpdateTeacher } from '@/hooks/queries/teachers';
import { toast } from 'sonner';
import type { Teacher } from '@/types/teacher';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { useQueryClient } from '@tanstack/react-query';
import { PasswordResetDialog } from '@/components/common/PasswordResetDialog';
import { TeacherUpdate } from '@/types/teacher';


export default function TeachersPage() {
  const router = useRouter();
  const { createTenantPath } = useTenantNavigation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [viewingTeacher, setViewingTeacher] = useState<Teacher | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);
  const [resettingTeacher, setResettingTeacher] = useState<Teacher | null>(null);


  const queryClient = useQueryClient();
  const deleteTeacherMutation = useDeleteTeacher();
  const updateTeacherMutation = useUpdateTeacher();

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
    toast.success("Teacher created successfully");
  };

  const handleEditSuccess = () => {
    setEditingTeacher(null);
    toast.success("Teacher updated successfully");
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
  };

  const handleView = (teacher: Teacher) => {
    setViewingTeacher(teacher);
  };

  const handleDelete = (teacher: Teacher) => {
    setDeletingTeacher(teacher);
  };

  const handleAddNew = () => {
    // Determine if we use dialog or page. The code uses dialog for now via the button trigger below which sets open state.
    // The previous implementation had a direct router.push on handleAddNew which seemed contradictory to the DialogTrigger.
    // Let's stick to the Dialog workflow as it's cleaner for simple forms.
    // Wait, the 'Add New Teacher' button used DialogTrigger, but handleAddNew was passed to TeacherList 'onAdd'.
    // The TeacherList onAdd prop calls this function.
    // So if user clicks 'Add New Teacher' on the top right (DialogTrigger), it opens dialog.
    // If user clicks 'Add New Teacher' in empty state (TeacherList onAdd), it calls this function.
    // We should make consistency. Let's open the dialog in both cases.
    setIsCreateDialogOpen(true);
  };

  const handleBulkRequest = () => {
    setIsBulkImportOpen(true);
  };

  const handleBulkImportSuccess = () => {
    setIsBulkImportOpen(false);
    queryClient.invalidateQueries({ queryKey: ['teachers'] }); // Invalidate manually as import might not use hook
    toast.success("Teachers imported successfully");
  };

  const confirmDelete = async () => {
    if (!deletingTeacher) return;

    deleteTeacherMutation.mutate(deletingTeacher.id, {
      onSuccess: () => {
        setDeletingTeacher(null);
        toast.success("Teacher deleted successfully");
      },
      onError: (error: any) => {
        console.error('Error deleting teacher:', error);
        const status = error?.statusCode || error?.response?.status;
        if (status === 409) {
          const msg = error?.message || error?.response?.data?.detail || "Cannot delete teacher due to active assignments.";
          toast.error(msg);
        } else {
          toast.error("Failed to delete teacher");
        }
      }
    });
  };

  const handleStatusToggle = async (teacher: Teacher) => {
    const newStatus = teacher.status === 'active' ? 'inactive' : 'active';
    updateTeacherMutation.mutate({ id: teacher.id, teacher: { status: newStatus } }, {
      onSuccess: () => {
        toast.success("Teacher status updated successfully");
      },
      onError: (error) => {
        console.error('Failed to update teacher status:', error);
        toast.error("Failed to update teacher status");
      }
    });
  };

  const handleResetPassword = (teacher: Teacher) => {
    setResettingTeacher(teacher);
  };

  const handlePasswordResetSubmit = async (userId: string, newPassword: string, newEmail?: string) => {
    try {
      const updatePayload: TeacherUpdate = {};
      if (newPassword) updatePayload.password = newPassword;
      if (newEmail) updatePayload.email = newEmail;

      await updateTeacherMutation.mutateAsync({
        id: userId,
        teacher: updatePayload
      });
    } catch (error) {
      throw error;
    }
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
              <Button
                variant="black"
                className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg px-6 py-2.5 font-medium"
              >
                <Plus className="h-4 w-4" />
                Add New Teacher
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
                <DialogDescription>Fill out the details to add a new teacher.</DialogDescription>
              </DialogHeader>
              <TeacherForm
                onSave={handleCreateSuccess}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={!!editingTeacher} onOpenChange={(open) => !open && setEditingTeacher(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Teacher</DialogTitle>
                <DialogDescription>Update the teacher’s information and status.</DialogDescription>
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

          <Dialog open={!!viewingTeacher} onOpenChange={(open) => !open && setViewingTeacher(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Teacher Details</DialogTitle>
                <DialogDescription>Read-only view of the teacher’s profile.</DialogDescription>
              </DialogHeader>
              {viewingTeacher && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-medium">Name:</label>
                      <p>{viewingTeacher.first_name} {viewingTeacher.last_name}</p>
                    </div>
                    <div>
                      <label className="font-medium">Email:</label>
                      <p>{viewingTeacher.email}</p>
                    </div>
                    <div>
                      <label className="font-medium">Employee ID:</label>
                      <p>{viewingTeacher.employee_id}</p>
                    </div>
                    <div>
                      <label className="font-medium">Department:</label>
                      <p>{viewingTeacher.department}</p>
                    </div>
                    <div>
                      <label className="font-medium">Status:</label>
                      <p className={`capitalize ${viewingTeacher.status === 'active' ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {viewingTeacher.status}
                      </p>
                    </div>
                    {viewingTeacher.qualification && (
                      <div>
                        <label className="font-medium">Qualification:</label>
                        <p>{viewingTeacher.qualification}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onSuccess={handleBulkImportSuccess}
      />

      {/* Edit Teacher Dialog - REDUNDANT: ALREADY RENDERED IN HEADER BUT KEEPING FOR CONSISTENCY IF NEEDED, NO, IT IS DUPLICATE. REMOVING DUPLICATE DIALOGS IN RETURN */}
      {/* Wait, the original code had these dialogs duplicated for some reason inside the return? No, one was inside the header buttons div and another outside. 
         Let's keep the structure clean. I will remove the duplicate blocks if they exist. 
         Looking at original code, it had "Edit Teacher Dialog" and "View Teacher Dialog" completely separate from the one in the header div.
         The header div has the Create Dialog. The others were floating.
         I'll place them correctly.
      */}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deletingTeacher}
        onCancel={() => setDeletingTeacher(null)}
        onConfirm={confirmDelete}
        title="Delete Teacher"
        message={`Are you sure you want to delete ${deletingTeacher?.first_name} ${deletingTeacher?.last_name}? This action cannot be undone.`}
        confirmButtonText={deleteTeacherMutation.isPending ? "Deleting..." : "Delete"}
        cancelButtonText="Cancel"
        confirmButtonColor="red"
      />

      {/* Teacher List */}
      <TeacherList
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDelete}
        onStatusToggle={handleStatusToggle} // This needs to return Promise<void> according to PropType?
        // Wait, onStatusToggle in TeacherList is: (teacher: Teacher) => Promise<void>.
        // My handleStatusToggle is async, checking...
        onAdd={handleAddNew}
        onResetPassword={handleResetPassword}
      />

      {/* Password Reset Dialog */}
      {resettingTeacher && (
        <PasswordResetDialog
          isOpen={!!resettingTeacher}
          onClose={() => setResettingTeacher(null)}
          userId={resettingTeacher.id}
          userName={`${resettingTeacher.first_name} ${resettingTeacher.last_name}`}
          userEmail={resettingTeacher.email}
          userType="Teacher"
          onReset={handlePasswordResetSubmit}
        />
      )}
    </div>);
}
