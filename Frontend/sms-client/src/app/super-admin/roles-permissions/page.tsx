'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Users, Shield, Save } from 'lucide-react';
import { useSuperAdminApiClient } from '@/services/api/super-admin-api-client';
import { useToast } from '@/hooks/use-toast';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: Permission[];
  created_at: string;
  updated_at: string;
}

interface Permission {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  roles?: Role[];
  created_at: string;
  updated_at: string;
}

interface RoleCreate {
  name: string;
  description?: string;
}

interface PermissionCreate {
  name: string;
  description?: string;
}

export default function RolePermissionManagementPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [isCreatePermissionOpen, setIsCreatePermissionOpen] = useState(false);
  const [isAssignRoleOpen, setIsAssignRoleOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<RoleCreate>({ name: '', description: '' });
  const [newPermission, setNewPermission] = useState<PermissionCreate>({ name: '', description: '' });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);

  const apiClient = useSuperAdminApiClient();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rolesData, permissionsData, usersData] = await Promise.all([
        apiClient.get<Role[]>('/super-admin/roles'),  // Changed from /auth/roles
        apiClient.get<Permission[]>('/super-admin/permissions'),  // Changed from /auth/permissions
        apiClient.get<User[]>('/super-admin/users')
      ]);
      
      setRoles(rolesData);
      setPermissions(permissionsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load roles and permissions data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRole = async () => {
    try {
      const createdRole = await apiClient.post<Role>('/super-admin/roles', newRole);  // Changed from /auth/roles
      setRoles([...roles, createdRole]);
      setNewRole({ name: '', description: '' });
      setIsCreateRoleOpen(false);
      toast({
        title: 'Success',
        description: 'Role created successfully'
      });
    } catch (error) {
      console.error('Error creating role:', error);
      toast({
        title: 'Error',
        description: 'Failed to create role',
        variant: 'destructive'
      });
    }
  };

  const handleCreatePermission = async () => {
    try {
      const createdPermission = await apiClient.post<Permission>('/super-admin/permissions', newPermission);  // Changed from /auth/permissions
      setPermissions([...permissions, createdPermission]);
      setNewPermission({ name: '', description: '' });
      setIsCreatePermissionOpen(false);
      toast({
        title: 'Success',
        description: 'Permission created successfully'
      });
    } catch (error) {
      console.error('Error creating permission:', error);
      toast({
        title: 'Error',
        description: 'Failed to create permission',
        variant: 'destructive'
      });
    }
  };

  const handleAssignPermissionsToRole = async (roleId: string, permissionNames: string[]) => {
    try {
      await apiClient.post(`/super-admin/roles/${roleId}/permissions`, permissionNames);
      // Reload role data to get updated permissions
      const updatedRole = await apiClient.get<Role>(`/super-admin/roles/${roleId}`);
      setRoles(roles.map(role => role.id === roleId ? updatedRole : role));
      if (selectedRole?.id === roleId) {
        setSelectedRole(updatedRole);
      }
      toast({
        title: 'Success',
        description: 'Permissions assigned to role successfully'
      });
    } catch (error) {
      console.error('Error assigning permissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign permissions to role',
        variant: 'destructive'
      });
    }
  };

  const handleAssignRolesToUser = async (userId: string, roleIds: string[]) => {
    try {
      await apiClient.post(`/super-admin/users/${userId}/roles`, roleIds);  // Changed from /auth/users
      // Reload users data
      const usersData = await apiClient.get<User[]>('/super-admin/users');
      setUsers(usersData);
      setIsAssignRoleOpen(false);
      setSelectedUser(null);
      setSelectedUserRoles([]);
      toast({
        title: 'Success',
        description: 'Roles assigned to user successfully'
      });
    } catch (error) {
      console.error('Error assigning roles:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign roles to user',
        variant: 'destructive'
      });
    }
  };

  const handleRoleSelect = async (role: Role) => {
    setSelectedRole(role);
    try {
      const rolePermissions = await apiClient.get<Permission[]>(`/super-admin/roles/${role.id}/permissions`);  // Changed from /auth/roles
      setSelectedPermissions(rolePermissions.map(p => p.name));
    } catch (error) {
      console.error('Error loading role permissions:', error);
    }
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setSelectedUserRoles(user.roles?.map(r => r.id) || []);
    setIsAssignRoleOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading roles and permissions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Role & Permission Management</h1>
        <div className="flex gap-2">
          <Dialog open={isCreateRoleOpen} onOpenChange={setIsCreateRoleOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Role</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="roleName">Role Name</Label>
                  <Input
                    id="roleName"
                    value={newRole.name}
                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                    placeholder="Enter role name"
                  />
                </div>
                <div>
                  <Label htmlFor="roleDescription">Description</Label>
                  <Textarea
                    id="roleDescription"
                    value={newRole.description}
                    onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                    placeholder="Enter role description"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateRoleOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRole} disabled={!newRole.name}>
                    Create Role
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreatePermissionOpen} onOpenChange={setIsCreatePermissionOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Shield className="h-4 w-4 mr-2" />
                Create Permission
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Permission</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="permissionName">Permission Name</Label>
                  <Input
                    id="permissionName"
                    value={newPermission.name}
                    onChange={(e) => setNewPermission({ ...newPermission, name: e.target.value })}
                    placeholder="Enter permission name"
                  />
                </div>
                <div>
                  <Label htmlFor="permissionDescription">Description</Label>
                  <Textarea
                    id="permissionDescription"
                    value={newPermission.description}
                    onChange={(e) => setNewPermission({ ...newPermission, description: e.target.value })}
                    placeholder="Enter permission description"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreatePermissionOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreatePermission} disabled={!newPermission.name}>
                    Create Permission
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="roles" className="space-y-6">
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="user-assignments">User Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Role List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>System Roles ({roles.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedRole?.id === role.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleRoleSelect(role)}
                    >
                      <div className="font-medium">{role.name}</div>
                      {role.description && (
                        <div className="text-sm text-gray-500 mt-1">{role.description}</div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary">
                          {role.permissions?.length || 0} permissions
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Role Details & Permissions */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedRole ? `${selectedRole.name} Permissions` : 'Select a Role'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedRole ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Role Information</h4>
                      <p className="text-sm text-gray-600">{selectedRole.description || 'No description'}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Assign Permissions</h4>
                      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                        {permissions.map((permission) => (
                          <div key={permission.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={permission.id}
                              checked={selectedPermissions.includes(permission.name)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPermissions([...selectedPermissions, permission.name]);
                                } else {
                                  setSelectedPermissions(selectedPermissions.filter(p => p !== permission.name));
                                }
                              }}
                            />
                            <Label htmlFor={permission.id} className="text-sm">
                              {permission.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <Button
                        className="mt-4"
                        onClick={() => handleAssignPermissionsToRole(selectedRole.id, selectedPermissions)}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Permissions
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    Select a role from the list to view and manage its permissions
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>System Permissions ({permissions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell className="font-medium">{permission.name}</TableCell>
                      <TableCell>{permission.description || 'No description'}</TableCell>
                      <TableCell>{new Date(permission.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user-assignments">
          <Card>
            <CardHeader>
              <CardTitle>User Role Assignments ({users.length} users)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Current Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.roles?.map((role) => (
                            <Badge key={role.id} variant="secondary">
                              {role.name}
                            </Badge>
                          )) || <span className="text-gray-500">No roles</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'destructive'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUserSelect(user)}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Manage Roles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Role Assignment Dialog */}
      <Dialog open={isAssignRoleOpen} onOpenChange={setIsAssignRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign Roles to {selectedUser?.first_name} {selectedUser?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Roles</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-64 overflow-y-auto">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`user-role-${role.id}`}
                      checked={selectedUserRoles.includes(role.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUserRoles([...selectedUserRoles, role.id]);
                        } else {
                          setSelectedUserRoles(selectedUserRoles.filter(r => r !== role.id));
                        }
                      }}
                    />
                    <Label htmlFor={`user-role-${role.id}`} className="text-sm">
                      {role.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAssignRoleOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedUser && handleAssignRolesToUser(selectedUser.id, selectedUserRoles)}
              >
                Assign Roles
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}