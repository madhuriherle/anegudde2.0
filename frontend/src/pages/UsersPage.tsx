import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Eye,
  Save,
  Users,
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../components/ui/Dialog';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { DetailItem } from '../components/ui/DetailItem';

const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().regex(/^[0-9]{8,15}$/, 'Phone number must be between 8 and 15 digits').optional().or(z.literal('')),
  role_id: z.coerce.number().min(1, 'Role is required'),
  status: z.coerce.number().default(1),
});

type UserFormValues = z.infer<typeof userSchema>;

const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<any>(null);

  // Fetch Data
  const { data: users, isLoading } = useQuery({
    queryKey: ['users', search, pageSize, status],
    queryFn: async () => {
      const params: any = { q: search, page_size: pageSize };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      const res = await api.get('/users/list_users', { params });
      return res.data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/users/roles');
      return res.data;
    },
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      if (editingUser) {
        return api.put(`/users/${editingUser.id}`, data);
      }
      return api.post('/users/create_user', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess(editingUser ? 'User updated' : 'User created');
      handleClose();
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Operation failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess('User deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const handleOpen = (userData: any = null) => {
    setEditingUser(userData);
    if (userData) {
      reset({ ...userData, password: '' });
    } else {
      reset({ username: '', password: '', full_name: '', email: '', phone: '', role_id: '' as any, status: 1 });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingUser(null);
  };

  const handleView = (userData: any) => {
    setViewingUser(userData);
    setViewDialogOpen(true);
  };

  const onSubmit = async (data: UserFormValues) => {
    const confirmed = await showConfirm(
      editingUser ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingUser ? 'update' : 'save'} this user?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { 
      accessorKey: 'id', 
      header: 'ID', 
    },
    { 
      accessorKey: 'username', 
      header: 'Username', 
    },
    { 
      accessorKey: 'full_name', 
      header: 'Full Name', 
    },
    { 
      accessorKey: 'role_id', 
      header: 'Role', 
      cell: info => {
        const role = roles?.find((r: any) => r.id === info.getValue());
        return role ? role.role_name : (info.getValue() as string);
      }
    },
    { 
      accessorKey: 'status', 
      header: 'Status', 
      cell: info => (
        <Badge>
          {info.getValue() === 1 ? 'Active' : 'Disabled'}
        </Badge>
      )
    },
    {
      id: 'actions',
      header: () => <div className="text-right px-4">Actions</div>,
      cell: info => (
        <div className="flex justify-end gap-2 px-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => handleView(info.row.original)}
            className="h-8 w-8 p-0"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => handleOpen(info.row.original)}
            className="h-8 w-8 p-0"
          >
            <Edit className="w-4 h-4 text-primary" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={async () => {
              const confirmed = await showConfirm('Delete User', `Are you sure you want to delete user "${info.row.original.username}"?`);
              if (confirmed) {
                deleteMutation.mutate(info.row.original.id);
              }
            }}
            className="h-8 w-8 p-0"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      ),
    },
  ], [roles, deleteMutation, showConfirm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-text-main">User Management</h2>
            <p className="text-sm text-text-main/70">Manage system users and their roles.</p>
          </div>
        </div>
        <Button 
          onClick={() => handleOpen()}
          className="text-text-main font-bold px-6"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New User
        </Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-text-main">Rows</Label>
              <Select value={pageSize.toString()} onChange={(e) => setPageSize(Number(e.target.value))}>
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main">Status Filter</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-text-main">Quick Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 text-text-main"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={users || []}
        loading={isLoading}
      />

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-text-main">User Details</DialogTitle>
              <Badge>
                {viewingUser?.status === 1 ? 'Active' : 'Disabled'}
              </Badge>
            </div>
          </DialogHeader>
          <div className="space-y-0 mt-4">
            <DetailItem label="Username" value={viewingUser?.username} />
            <DetailItem label="Full Name" value={viewingUser?.full_name} />
            <DetailItem label="Email" value={viewingUser?.email} />
            <DetailItem label="Phone" value={viewingUser?.phone} />
            <DetailItem label="Role" value={roles?.find((r: any) => r.id === viewingUser?.role_id)?.role_name} />

            <div className="pt-6 pb-2">
              <span className="text-sm font-bold text-text-main">Audit Information</span>
            </div>
            <div className="p-4 bg-bg-temple border border-border-temple rounded-md space-y-0">
              <DetailItem 
                label="Created At" 
                value={viewingUser?.created_at ? new Date(viewingUser.created_at).toLocaleString() : '-'} 
              />
              <DetailItem 
                label="Last Updated" 
                value={viewingUser?.updated_at ? new Date(viewingUser.updated_at).toLocaleString() : '-'} 
              />
            </div>
          </div>
          <DialogFooter className="mt-6 border-t border-border-temple/40 pt-4">
            <Button onClick={() => setViewDialogOpen(false)} className="text-text-main">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-2xl border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">
              {editingUser ? 'Edit User' : 'New User'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-text-main">Username *</Label>
                <Input {...register('username')} placeholder="e.g. johndoe" className="text-text-main" disabled={!!editingUser} />
                {errors.username && <p className="text-xs text-red-500">{errors.username.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">{editingUser ? "Password (Leave blank to keep same)" : "Password *"}</Label>
                <Input {...register('password')} type="password" placeholder="••••••••" className="text-text-main" />
                {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-text-main">Full Name *</Label>
                <Input {...register('full_name')} placeholder="e.g. John Doe" className="text-text-main" />
                {errors.full_name && <p className="text-xs text-red-500">{errors.full_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Email Address</Label>
                <Input {...register('email')} type="email" placeholder="john@example.com" className="text-text-main" />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Phone Number</Label>
                <Input {...register('phone')} placeholder="e.g. 9876543210" className="text-text-main" />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-text-main">Role *</Label>
                <Controller
                  name="role_id"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value?.toString()} onChange={(e) => field.onChange(Number(e.target.value))}>
                      <option value="">Select a role</option>
                      {roles?.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.role_name}</option>
                      ))}
                    </Select>
                  )}
                />
                {errors.role_id && <p className="text-xs text-red-500">{errors.role_id.message}</p>}
              </div>
              
              <div className="flex items-center justify-between p-3 bg-bg-temple border border-border-temple rounded-md md:col-span-2">
                <Label className="text-text-main font-bold">Active Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Switch 
                      checked={field.value === 1} 
                      onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} 
                    />
                  )}
                />
              </div>
            </div>
            <DialogFooter className="pt-4 border-t border-border-temple/40 gap-2">
              <Button type="button" variant="ghost" onClick={handleClose} className="text-text-main">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                className="text-text-main font-bold"
              >
                <Save className="w-4 h-4 mr-2" />
                {mutation.isPending ? 'Saving...' : editingUser ? 'Update User' : 'Save User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
