import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Pencil, Trash2, Shield } from 'lucide-react';

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
'../components/ui/Dialog';
import { Select } from '../components/ui/Select';

import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';

const roleSchema = z.object({
  role_name: z.string().min(2, 'Role name must be at least 2 characters'),
  rank_level: z.coerce.number().min(1, 'Rank level must be at least 1'),
  is_all_access: z.boolean().default(false),
  module_id: z.coerce.number().nullable().optional(),
  status: z.coerce.number().default(1)
});

const RolesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('roles.write');
  const canDelete = hasPermission('roles.delete');

  const [open, setOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [search, setSearch] = useState('');

  const [viewOpen, setViewOpen] = useState(false);
  const [viewingRole, setViewingRole] = useState(null);

  // Fetch Roles
  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/users/list_roles');
      return res.data;
    }
  });

  // Fetch Modules for Scope dropdown
  const { data: menuRoots } = useQuery({
    queryKey: ['modules-privilege-tree'],
    queryFn: async () => {
      const res = await api.get('/modules/privilege-tree');
      return res.data;
    }
  });

  const flattenModules = (modules) => {
    let flat = [];
    (modules || []).forEach(m => {
      flat.push({ id: m.id, name: m.name, depth: 0 });
      // If this is Main Menu, also include its direct children (Canteen, Office, etc.)
      if (m.name === "Main Menu" && m.submodules) {
        m.submodules.forEach(sm => {
          flat.push({ id: sm.id, name: sm.name, depth: 1 });
        });
      }
    });
    return flat;
  };

  const moduleOptions = useMemo(() => {
    if (!menuRoots) return [];
    return flattenModules(menuRoots);
  }, [menuRoots]);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      role_name: '',
      rank_level: 99,
      is_all_access: false,
      module_id: null,
      status: 1
    }
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (editingRole) {
        return api.put(`/users/update_role/${editingRole.id}`, data);
      }
      return api.post('/users/create_role', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      showSuccess(editingRole ? 'Role updated' : 'Role created');
      handleClose();
    },
    onError: (err) => {
      showError(err.response?.data?.detail || 'Operation failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/users/delete_role/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      showSuccess('Role deleted');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Delete failed')
  });

  const handleOpen = (roleData = null) => {
    setEditingRole(roleData);
    if (roleData) {
      reset({
        role_name: roleData.role_name,
        rank_level: roleData.rank_level,
        is_all_access: roleData.is_all_access,
        module_id: roleData.module_id || '',
        status: roleData.status
      });
    } else {
      reset({ role_name: '', rank_level: 99, is_all_access: false, module_id: '', status: 1 });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingRole(null);
  };

  const handleView = (roleData) => {
    setViewingRole(roleData);
    setViewOpen(true);
  };

  const handleViewClose = () => {
    setViewOpen(false);
    setViewingRole(null);
  };

  const onSubmit = (data) => {
    // If module_id is empty string (from select), make it null
    const payload = {
        ...data,
        module_id: data.module_id === "" || data.module_id === "null" ? null : Number(data.module_id)
    };
    mutation.mutate(payload);
  };

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter(r =>
      r.role_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [roles, search]);

  const columns = useMemo(() => [
    {
      accessorKey: 'role_name',
      header: 'Role Name',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-text-main">{info.getValue()}</span>
          {info.row.original.is_all_access && (
            <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-amber-200">
              All Access
            </span>
          )}
        </div>
      )
    },
    {
      accessorKey: 'rank_level',
      header: 'Rank Level',
      cell: (info) => (
        <div className="flex items-center gap-2">
            <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold border border-blue-100">
                Rank {info.getValue()}
            </span>
        </div>
      )
    },
    {
      accessorKey: 'module_id',
      header: 'Module Scope',
      cell: (info) => {
        const moduleId = info.getValue();
        const moduleName = moduleId
          ? (moduleOptions.find(m => m.id === moduleId)?.name || `Module ${moduleId}`)
          : 'System Wide';

        return <span className="text-text-main font-medium">{moduleName}</span>;
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-center">Actions</div>,
      cell: (info) => (
        <div className="flex items-center justify-center gap-2 px-4">
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          {canWrite && (
            <button
                onClick={() => handleOpen(info.row.original)}
                className="action-btn-edit"
            >
              Edit
            </button>
          )}
          {canDelete && (
            <button
              onClick={async () => {
                const confirmed = await showConfirm(
                    'Delete Role',
                    `Are you sure you want to delete role "${info.row.original.role_name}"?`
                );
                if (confirmed) {
                  deleteMutation.mutate(info.row.original.id);
                }
              }}
              className="action-btn-delete"
            >
              Delete
            </button>
          )}
        </div>
      )
    }
  ], [moduleOptions, canWrite, canDelete, showConfirm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Role Management</h2>
          <p className="text-sm text-gray-500 mt-1">Create and manage user roles with module scoping.</p>
        </div>
        {canWrite && (
          <Button
            onClick={() => handleOpen()}
            className="text-white font-bold px-6"
          >
            Add New Role
          </Button>
        )}
      </div>

      <Card className="border-border-temple bg-white">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roles..."
              className="pl-10 text-text-main"
            />
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredRoles}
        loading={isLoading}
      />

      {/* View Role Dialog */}
      <Dialog open={viewOpen} onOpenChange={handleViewClose}>
        <DialogContent className="max-w-md border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">Role Details</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div className="font-bold text-text-main">Role Name:</div>
              <div className="text-gray-700">{viewingRole?.role_name}</div>

              <div className="font-bold text-text-main">Rank Level:</div>
              <div className="text-gray-700">{viewingRole?.rank_level}</div>

              <div className="font-bold text-text-main">All Access:</div>
              <div className="text-gray-700">{viewingRole?.is_all_access ? 'Yes' : 'No'}</div>

              <div className="font-bold text-text-main">Module Scope:</div>
              <div className="text-gray-700">
                {viewingRole?.module_id ? (moduleOptions.find(m => m.id === viewingRole.module_id)?.name || viewingRole.module_id) : 'System Wide'}
              </div>
            </div>
          </div>
          <DialogFooter className="bg-[#F3E8D4]">
            <Button onClick={handleViewClose} className="bg-primary text-white font-bold border-none">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Role Dialog */}
      <Dialog open={open} onOpenChange={(val) => {
        if (!val && !mutation.isPending) {
          handleClose();
        }
      }}>
        <DialogContent className="max-w-xl border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main text-xl">
              {editingRole ? 'Edit Role' : 'New Role'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 pt-6"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                e.preventDefault();
              }
            }}
          >
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Role Name *</Label>
                <Input {...register('role_name')} className="text-text-main h-11" />
                {errors.role_name && <p className="text-xs text-red-500">{errors.role_name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-text-main font-bold">Rank Level *</Label>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Lower is stronger (1 = Top)</span>
                </div>
                <Input {...register('rank_level')} type="number" className="text-text-main h-11" />
                {errors.rank_level && <p className="text-xs text-red-500">{errors.rank_level.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Module Scope</Label>
                <Controller
                  name="module_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value === null ? "null" : field.value?.toString()}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="h-11"
                    >
                      <option value="null">System Wide (Full Access)</option>
                      {moduleOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {'\u00A0'.repeat(m.depth * 2)}{m.name}
                        </option>
                      ))}
                    </Select>
                  )}
                />
                <p className="text-[10px] text-gray-500 mt-1 italic">
                    Restricts this role to a specific department or section.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="is_all_access"
                    {...register('is_all_access')}
                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                  />
                  <Label htmlFor="is_all_access" className="text-text-main font-bold cursor-pointer text-base">
                    Is All Access Role?
                  </Label>
                </div>
                <p className="text-[10px] text-amber-600 font-medium">
                  Warning: All-access roles bypass individual privilege checks.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-3 pt-6 border-t border-border-temple/40 bg-[#F3E8D4] -mx-6 -mb-6 px-6 pb-6 mt-4">
              <Button type="button" variant="ghost" onClick={handleClose} className="bg-white border border-[#D9C8AF] text-text-main font-bold px-8 h-11">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-primary text-white font-bold border-none px-12 h-11 shadow-lg shadow-primary/20"
              >
                {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RolesPage;
