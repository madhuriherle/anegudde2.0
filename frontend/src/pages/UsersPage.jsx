import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';

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

import { usePermission } from '../hooks/usePermission';

const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().regex(/^[0-9]{8,15}$/, 'Phone number must be between 8 and 15 digits').optional().or(z.literal('')),
  role_id: z.coerce.number().min(1, 'Role is required'),
  status: z.coerce.number().default(1)
});



const UsersPage = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('users.write');
  const canDelete = hasPermission('users.delete');

  // Filter States
  const pageSize = 50;
  const status = 'all';
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Fetch Data
  const { data: users, isLoading } = useQuery({
    queryKey: ['users', search, pageSize, status],
    queryFn: async () => {
      const params = { q: search, page_size: pageSize };
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
    resolver: zodResolver(userSchema)
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

  const handleOpen = (userData = null) => {
    setEditingUser(userData);
    if (userData) {
      reset({ ...userData, password: '' });
    } else {
      reset({ username: '', password: '', full_name: '', email: '', phone: '', role_id: '', status: 1 });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingUser(null);
  };

  const onSubmit = async (data) => {
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
    accessorKey: 'full_name',
    header: 'Full Name'
  },
  {
    accessorKey: 'email',
    header: 'Email'
  },
  {
    accessorKey: 'phone',
    header: 'Phone'
  },
  {
    accessorKey: 'role_id',
    header: 'Role',
    cell: (info) => {
      const role = roles?.find((r) => r.id === info.getValue());
      return role ? role.role_name : info.getValue();
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
        <div>
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
          <div className="grid gap-4">
            <div className="space-y-1.5 w-full sm:max-w-xs">
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
        loading={isLoading} />
      

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
                <Label className="text-text-main">{editingUser ? "Password" : "Password *"}</Label>
                <Input {...register('password')} type="password" className="text-text-main" />
                {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-text-main">Full Name *</Label>
                <Input {...register('full_name')} className="text-text-main" />
                {errors.full_name && <p className="text-xs text-red-500">{errors.full_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Email Address</Label>
                <Input {...register('email')} type="email" className="text-text-main" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Phone Number</Label>
                <Input {...register('phone')} className="text-text-main" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-text-main">Role *</Label>
                <Controller
                  name="role_id"
                  control={control}
                  render={({ field }) =>
                  <Select value={field.value?.toString()} onChange={(e) => field.onChange(Number(e.target.value))}>
                      <option value="" disabled hidden>Select a role</option>
                      {roles?.map((r) =>
                    <option key={r.id} value={r.id}>{r.role_name}</option>
                    )}
                    </Select>
                  } />
                
              </div>
            </div>
            <DialogFooter className="gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2]">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="w-28 h-10 text-text-main">
                
                {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>);

};

export default UsersPage;
