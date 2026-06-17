import React, { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Select from 'react-select';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { InlineStatusSelect } from '../components/ui/InlineStatusSelect';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Badge } from '../components/ui/Badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/Dialog';
import { X, Plus, Info, Search } from 'lucide-react';

import { usePermission } from '../hooks/usePermission';
import { cn } from '../utils/cn';

const donationTypeSchema = z.object({
  type_name: z.string().min(1, 'Type name is required'),
  receipt_prefix: z.string().optional(),
  status: z.coerce.number().default(1),
  module_ids: z.array(z.number()).optional()
});

const normalizeReceiptPrefix = (value) => {
  const prefix = String(value || '').trim().toUpperCase();
  if (prefix && /[A-Z0-9]$/.test(prefix)) return `${prefix}-`;
  return prefix;
};

const getDonationScopeModules = (modules = []) => {
  let options = [];
  (modules || []).forEach((module) => {
    options.push({
      value: module.id,
      label: module.name,
    });
    // If this is Main Menu, also include its direct children
    if (module.name === "Main Menu" && module.submodules) {
      module.submodules.forEach(sm => {
        options.push({
          value: sm.id,
          label: `\u00A0\u00A0${sm.name}`,
        });
      });
    }
  });
  return options;
};

const DonationTypesPage = () => {
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('donation_types.write');
  const canDelete = hasPermission('donation_types.delete');

  const [open, setOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [search, setSearch] = useState('');

  const { data: donationTypes, isLoading } = useQuery({
    queryKey: ['donation-types'],
    queryFn: async () => (await api.get('/donation-types/list_donation_types', { params: { status: null, page_size: 1000 } })).data
  });

  const { data: moduleTree } = useQuery({
    queryKey: ['modules-privilege-tree'],
    queryFn: async () => {
      const response = await api.get('/modules/privilege-tree');
      return response.data;
    }
  });

  const moduleOptions = useMemo(() => {
    return getDonationScopeModules(moduleTree || []);
  }, [moduleTree]);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    resolver: zodResolver(donationTypeSchema),
    defaultValues: {
      type_name: '',
      receipt_prefix: '',
      status: 1,
      module_ids: []
    }
  });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const { id, isEditMode, ...data } = payload;
      data.receipt_prefix = normalizeReceiptPrefix(data.receipt_prefix);
      if (isEditMode && id) return api.put(`/donation-types/update_donation_type/${id}`, data);
      return api.post('/donation-types/create_donation_type', data);
    },
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['donation-types'] });
      showSuccess(variables?.isEditMode ? 'Donation type updated' : 'Donation type added');
      handleCancel();
    },
    onError: (err) => showError(err.response?.data?.detail || 'Operation failed')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/donation-types/delete_donation_type/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-types'] });
      showSuccess('Donation type removed');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Delete failed')
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => api.put(`/donation-types/update_donation_type/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-types'] });
      showSuccess('Status updated');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Status update failed')
  });

  const handleEdit = (type) => {
    setEditingType(type);
    reset({
      type_name: type.type_name,
      receipt_prefix: type.receipt_prefix,
      status: type.status,
      module_ids: (type.modules || []).map(m => m.id)
    });
    setOpen(true);
  };

  const handleCancel = () => {
    setOpen(false);
    setEditingType(null);
    reset({ type_name: '', receipt_prefix: '', status: 1, module_ids: [] });
  };

  const onSubmit = async (data) => {
    const isEditMode = Boolean(editingType);
    const confirmed = await showConfirm(
      isEditMode ? 'Update Donation Type' : 'Save Donation Type',
      isEditMode ? 'Are you sure you want to update this donation type?' : 'Are you sure you want to save this new donation type?'
    );
    if (confirmed) {
      mutation.mutate({ ...data, id: editingType?.id, isEditMode });
    }
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'type_name',
      header: 'Donation Type',
      cell: (info) => <span className="font-bold text-text-main">{info.getValue()}</span>
    },
    {
      accessorKey: 'modules',
      header: 'Linked Modules',
      cell: (info) => {
        const modules = info.getValue() || [];
        if (modules.length === 0) return <span className="text-xs text-text-main/70 font-medium">Global - All Modules</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {modules.map(m => (
              <Badge key={m.id} variant="secondary" className="bg-[#F8F4EE] text-secondary border-secondary/20 text-[10px] px-2 py-0.5">
                {m.name}
              </Badge>
            ))}
          </div>
        );
      }
    },
    {
      accessorKey: 'receipt_prefix',
      header: 'Donation Code',
      cell: (info) => {
        const val = info.getValue() || '';
        return <span className="font-mono font-black text-primary">{val.endsWith('-') ? val.slice(0, -1) : val}</span>;
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => (
        <InlineStatusSelect
          value={Number(info.getValue() ?? 1)}
          disabled={statusMutation.isPending || !canWrite}
          onChange={async (nextStatus) => {
            const confirmed = await showConfirm(
              'Update Status',
              `Are you sure you want to ${Number(nextStatus) === 1 ? 'activate' : 'deactivate'} "${info.row.original.type_name}"?`
            );
            if (confirmed) statusMutation.mutate({ id: info.row.original.id, status: nextStatus });
          }}
        />
      )
    },
    {
      id: 'actions',
      header: () => <div className="text-center">Actions</div>,
      cell: (info) => (
        <div className="flex items-center justify-center gap-2">
          {canWrite && <button onClick={() => handleEdit(info.row.original)} className="action-btn-edit">Edit</button>}
          {canDelete && (
            <button
              onClick={async () => {
                const confirmed = await showConfirm('Delete Donation Type', `Delete "${info.row.original.type_name}"? Existing donations will disable it instead.`);
                if (confirmed) deleteMutation.mutate(info.row.original.id);
              }}
              className="action-btn-delete"
            >
              Delete
            </button>
          )}
        </div>
      )
    }
  ], [statusMutation, showConfirm, deleteMutation, canWrite, canDelete]);

  const filteredAndSortedTypes = useMemo(() => {
    const list = donationTypes?.items || [];
    const filtered = list.filter(t => 
      t.type_name.toLowerCase().includes(search.toLowerCase()) || 
      (t.receipt_prefix || '').toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      if (a.status !== b.status) return b.status - a.status;
      return a.type_name.localeCompare(b.type_name);
    });
  }, [donationTypes, search]);

  const customSelectStyles = {
    control: (provided, state) => ({
      ...provided,
      borderColor: state.isFocused ? '#B08968' : 'rgba(176, 137, 104, 0.5)',
      boxShadow: state.isFocused ? '0 0 0 1px #B08968' : 'none',
      '&:hover': { borderColor: '#B08968' },
      borderRadius: '0.5rem',
      fontSize: '14px',
      minHeight: '42px'
    }),
    multiValue: (provided) => ({ ...provided, backgroundColor: '#F6EEDF', borderRadius: '4px' }),
    multiValueLabel: (provided) => ({ ...provided, color: '#5C2E1F', fontWeight: 'bold', fontSize: '12px' }),
    multiValueRemove: (provided) => ({ ...provided, color: '#5C2E1F', '&:hover': { backgroundColor: '#5C2E1F', color: 'white' } })
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Donation Types</h2>
        {canWrite && (
          <Button onClick={() => setOpen(true)} className="text-text-main font-bold px-8 h-11 border-none shadow-md">
            Add New Donation Type
          </Button>
        )}
      </div>

      <Card className="border-border-temple shadow-sm bg-white">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Quick search donation types..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 border-border-temple/50 text-text-main"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border-temple shadow-sm overflow-hidden bg-white">
        <DataTable columns={columns} data={filteredAndSortedTypes} loading={isLoading} />
      </Card>

      <Dialog open={open} onOpenChange={(val) => { if (!val && !mutation.isPending) handleCancel(); }}>
        <DialogContent
          className="max-w-2xl border-border-temple shadow-2xl bg-white"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="bg-[#F3E8D4] border-b border-border-temple/40">
            <DialogTitle>
              {editingType ? 'Edit Donation Type' : 'New Donation Type'}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6 pt-4 pb-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                e.preventDefault();
              }
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Donation Type *</Label>
                <Input {...register('type_name')} className="h-11 border-border-temple text-text-main" />
                {errors.type_name && <p className="text-xs text-error font-medium">{errors.type_name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Donation Code</Label>
                <Input {...register('receipt_prefix')} className="h-11 border-border-temple font-mono uppercase text-text-main" />
                {errors.receipt_prefix && <p className="text-xs text-error font-medium">{errors.receipt_prefix.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-text-main font-bold">Display In Modules</Label>
              <Controller
                name="module_ids"
                control={control}
                render={({ field: { value, onChange, onBlur } }) => (
                  <Select
                    isMulti
                    options={moduleOptions}
                    value={moduleOptions.filter(opt => (value || []).includes(opt.value))}
                    onChange={(selected) => onChange(selected ? selected.map(s => s.value) : [])}
                    onBlur={onBlur}
                    styles={customSelectStyles}
                    placeholder="Select where this donation type should appear..."
                    className="react-select-container"
                    classNamePrefix="react-select"
                    closeMenuOnSelect={false}
                  />
                )}
              />
              <p className="text-[11px] text-text-main mt-1 px-1">
                Leave empty for Global / Main Menu access. Select Mahaprasad Module to show only in Mahaprasad donations.
              </p>
            </div>

            <div className="bg-[#FAF7F2] border border-orange-100/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="w-3 h-3 text-primary/60" />
                <span className="text-[9px] font-black tracking-widest text-secondary uppercase">Formatting Hint</span>
              </div>
              <div className="text-[11px] text-text-main/70 leading-relaxed space-y-0.5" style={{ fontSize: '11px' }}>
                <p style={{ fontSize: '11px' }}>Custom prefix is optional. Use <code className="font-bold text-primary" style={{ fontSize: '11px' }}>{'{FY}'}</code> as a placeholder for the current Financial year.</p>
                <div className="space-y-0.5">
                  <p style={{ fontSize: '11px' }}><code className="font-bold text-text-main" style={{ fontSize: '11px' }}>{'{FY}'}-SEVA</code> → <span className="text-secondary font-bold" style={{ fontSize: '11px' }}>2026-27-SEVA00001</span></p>
                  <p style={{ fontSize: '11px' }}><code className="font-bold text-text-main" style={{ fontSize: '11px' }}>SEVA</code> → <span className="text-secondary font-bold" style={{ fontSize: '11px' }}>SEVA01</span></p>
                </div>
              </div>
            </div>

            <DialogFooter className="bg-[#F3E8D4] border-t border-border-temple/40 mt-6">
              <Button type="button" variant="ghost" onClick={handleCancel} className="w-32 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2] font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="w-32 h-10 bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-lg">
                {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DonationTypesPage;
