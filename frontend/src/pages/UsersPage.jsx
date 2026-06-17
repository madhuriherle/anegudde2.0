import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, Plus, Pencil, Trash2 } from 'lucide-react';

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
import { InlineStatusSelect } from '../components/ui/InlineStatusSelect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
'../components/ui/Dialog';
import { Select } from '../components/ui/Select';

import { cn } from '../utils/cn';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';

const PASSWORD_RULE_MESSAGE = 'Password must include uppercase, lowercase, number, and symbol';
const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{6,}$/;

const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().optional().or(z.literal('')),
  confirm_password: z.string().optional().or(z.literal('')),
  full_name: z.string().min(1, 'Full name is required'),
  user_code: z.string().max(20, 'User code must be 20 characters or less').optional().or(z.literal('')),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().regex(/^\+?[\d\s-]{8,15}$/, 'Invalid contact number').optional().or(z.literal('')),
  role_id: z.coerce.number().min(1, 'Role is required'),
  status: z.coerce.number().default(1)
}).refine((data) => {
  if (data.password && !passwordRule.test(data.password)) {
    return false;
  }
  return true;
}, {
  message: PASSWORD_RULE_MESSAGE,
  path: ["password"],
}).refine((data) => {
  if (data.password && data.password !== data.confirm_password) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});



const UsersPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('users.management.write');
  const canDelete = hasPermission('users.management.delete');

  // Filter States
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Fetch Data
  const { data: users, isLoading } = useQuery({
    queryKey: ['users', search, pageSize, status, page],
    queryFn: async () => {
      const params = { q: search, page_size: pageSize, page };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      const res = await api.get('/users/list_users', { params });
      return res.data;
    }
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/users/list_roles');
      return res.data;
    }
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    resolver: zodResolver(userSchema),
    mode: 'onChange'
  });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const { id, isEditMode, ...data } = payload;
      if (isEditMode && !id) {
        throw new Error('Missing user ID for update');
      }
      if (id) {
        return api.put(`/users/update_user/${id}`, data);
      }
      return api.post('/users/create_user', data);
    },
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess(variables?.isEditMode ? 'User updated' : 'User created');
      handleClose();
    },
    onError: (err) => {
      showError(err.response?.data?.detail || 'Operation failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/users/delete_user/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess('User deleted');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Delete failed')
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => api.put(`/users/update_user/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess('Status updated successfully');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Status update failed')
  });

  const [viewOpen, setViewOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);

  const handleOpen = (userData = null) => {
    setEditingUser(userData);
    if (userData) {
      reset({ ...userData, password: '', confirm_password: '' });
    } else {
      reset({ username: '', password: '', confirm_password: '', full_name: '', user_code: '', email: '', phone: '', role_id: '', status: 1 });
    }
    setOpen(true);
  };

  const handleView = (userData) => {
    setViewingUser(userData);
    setViewOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingUser(null);
  };

  const handleViewClose = () => {
    setViewOpen(false);
    setViewingUser(null);
  };

  const onSubmit = async (data) => {
    if (!editingUser && !data.password) {
      showError('Password is required');
      return;
    }

    const confirmed = await showConfirm(
      editingUser ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingUser ? 'update' : 'save'} this user?`
    );

    if (confirmed) {
      mutation.mutate({ ...data, id: editingUser?.id, isEditMode: Boolean(editingUser) });
    }
  };

  const columns = useMemo(() => [
  {
    accessorKey: 'username',
    header: 'Username'
  },
  {
    accessorKey: 'phone',
    header: 'Mobile No',
    cell: (info) => info.getValue() || '-'
  },
  {
    accessorKey: 'role_id',
    header: 'Role',
    cell: (info) => {
      const user = info.row.original;
      return user.role ? user.role.role_name : info.getValue();
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (info) =>
    <InlineStatusSelect
      value={Number(info.getValue() ?? 1)}
      disabled={statusMutation.isPending || !canWrite}
      onChange={async (nextStatus) => {
        const confirmed = await showConfirm(
          'Update Status',
          `Are you sure you want to ${Number(nextStatus) === 1 ? 'activate' : 'deactivate'} "${info.row.original.username}"?`
        );
        if (confirmed) statusMutation.mutate({ id: info.row.original.id, status: nextStatus });
      }} />


  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: (info) =>
    <div className="flex items-center justify-center gap-2 px-4">
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          {canWrite && <button onClick={() => handleOpen(info.row.original)} className="action-btn-edit">Edit</button>}
          {canDelete && <button
        onClick={async () => {
          const confirmed = await showConfirm('Delete User', `Are you sure you want to delete user "${info.row.original.username}"?`);
          if (confirmed) {
            deleteMutation.mutate(info.row.original.id);
          }
        }}
        className="action-btn-delete">
        
            Delete
          </button>}
        </div>

  }],
  [roles, showConfirm, statusMutation, canWrite, canDelete]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="page-title">User Management</h2>
        </div>
        {canWrite && <Button
          onClick={() => handleOpen()}
          className="text-text-main font-bold px-6">
          
          Add New User
        </Button>}
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-text-main">Rows</Label>
              <Select value={pageSize.toString()} onChange={(e) => setPageSize(Number(e.target.value))}>
                {[10, 20, 50, 100].map((size) =>
                <option key={size} value={size}>{size}</option>
                )}
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
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 text-text-main" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={users?.items || []}
        loading={isLoading}
        manualPagination
        pageCount={users?.total_pages || 1}
        pageIndex={page - 1}
        pageSize={pageSize}
        totalCount={users?.total || 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }} />
      
      {/* View User Dialog */}
      <Dialog open={viewOpen} onOpenChange={handleViewClose}>
        <DialogContent className="max-w-md border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">User Details</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div className="font-bold text-text-main">Username:</div>
              <div className="text-gray-700">{viewingUser?.username}</div>
              
              <div className="font-bold text-text-main">Full Name:</div>
              <div className="text-gray-700">{viewingUser?.full_name}</div>
              
              <div className="font-bold text-text-main">User Code:</div>
              <div className="text-gray-700">{viewingUser?.user_code || '-'}</div>
              
              <div className="font-bold text-text-main">Role:</div>
              <div className="text-gray-700">{viewingUser?.role?.role_name}</div>
              
              <div className="font-bold text-text-main">Phone No:</div>
              <div className="text-gray-700">{viewingUser?.phone || '-'}</div>
              
              <div className="font-bold text-text-main">Email:</div>
              <div className="text-gray-700 truncate">{viewingUser?.email || '-'}</div>
            </div>
          </div>
          <DialogFooter className="bg-[#F3E8D4]">
            <Button onClick={handleViewClose} className="bg-primary text-white font-bold border-none">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(val) => {
        if (!val && !mutation.isPending) {
          handleClose();
        }
      }}>
        <DialogContent
          className="max-w-2xl border-border-temple"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}>
          
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">
              {editingUser ? 'Edit User' : 'New User'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4 pb-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-text-main">Username *</Label>
                <Input {...register('username')} className="text-text-main" disabled={!!editingUser} />
                {errors.username && <p className="text-xs text-red-500">{errors.username.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Full Name *</Label>
                <Input {...register('full_name')} className="text-text-main" />
                {errors.full_name && <p className="text-xs text-red-500">{errors.full_name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-text-main">User Code</Label>
                <Input {...register('user_code')} className="text-text-main uppercase" placeholder="PDK" />
                {errors.user_code && <p className="text-xs text-red-500">{errors.user_code.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Email Address</Label>
                <Input {...register('email')} type="email" className="text-text-main" />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-text-main">Phone Number</Label>
                <Input {...register('phone')} className="text-text-main" />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Role *</Label>
                <Controller
                  name="role_id"
                  control={control}
                  render={({ field }) => {
                    const myRank = user?.role_rank_level ?? 99;
                    const availableRoles = roles?.filter(r => r.rank_level > myRank) || [];
                    
                    return (
                      <Select value={field.value?.toString()} onChange={(e) => field.onChange(Number(e.target.value))}>
                        <option value="" disabled hidden>Select a role</option>
                        {availableRoles.map((r) =>
                          <option key={r.id} value={r.id}>{r.role_name}</option>
                        )}
                      </Select>
                    );
                  }} />
                {errors.role_id && <p className="text-xs text-red-500">{errors.role_id.message}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-text-main">{editingUser ? "Password" : "Password *"}</Label>
                  {!editingUser && <span className="text-[10px] text-gray-400 font-medium">Aa + 1 + @</span>}
                </div>
                <Input {...register('password')} type="password" className="text-text-main" />
                {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">{editingUser ? "Confirm Password" : "Confirm Password *"}</Label>
                <Input {...register('confirm_password')} type="password" className="text-text-main" />
                {errors.confirm_password && <p className="text-xs text-red-500">{errors.confirm_password.message}</p>}
              </div>
            </div>
            <DialogFooter className="gap-3 px-6 py-4 border-t border-border-temple/40 bg-[#F3E8D4]">
              <Button type="button" variant="ghost" onClick={handleClose} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2] font-bold">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="w-28 h-10 bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-lg">
                {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>);

};

export default UsersPage;
