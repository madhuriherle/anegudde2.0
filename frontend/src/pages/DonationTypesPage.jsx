import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useForm } from 'react-hook-form';
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

import { usePermission } from '../hooks/usePermission';
import { cn } from '../utils/cn';

const donationTypeSchema = z.object({
  type_name: z.string().min(1, 'Type name is required'),
  receipt_prefix: z.string().optional(),
  status: z.coerce.number().default(1)
});

const normalizeReceiptPrefix = (value) => {
  const prefix = String(value || '').trim().toUpperCase();
  // Don't add hyphen if it ends with special characters like } or -
  if (prefix && /[A-Z0-9]$/.test(prefix)) return `${prefix}-`;
  return prefix;
};

const DonationTypesPage = () => {
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('donation_types.write');
  const canDelete = hasPermission('donation_types.delete');

  const [editingType, setEditingType] = useState(null);

  const { data: donationTypes, isLoading } = useQuery({
    queryKey: ['donation-types'],
    queryFn: async () => (await api.get('/donation-types/list_donation_types', { params: { status: null, page_size: 1000 } })).data
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(donationTypeSchema),
    defaultValues: {
      type_name: '',
      receipt_prefix: '',
      status: 1
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
      status: type.status
    });
  };

  const handleCancel = () => {
    setEditingType(null);
    reset({ type_name: '', receipt_prefix: '', status: 1 });
  };

  const onSubmit = async (data) => {
    const isEditMode = Boolean(editingType);
    const confirmed = await showConfirm(
      isEditMode ? 'Update Donation Type' : 'Add Donation Type',
      isEditMode ? 'Update this donation type?' : 'Add this donation type?'
    );
    if (confirmed) {
      mutation.mutate({ ...data, id: editingType?.id, isEditMode });
    }
  };

  const columns = useMemo(() => [
  {
    accessorKey: 'type_name',
    header: 'Donation Type',
    cell: (info) => <span className="font-medium text-text-main">{info.getValue()}</span>
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
    cell: (info) =>
    <InlineStatusSelect
      value={Number(info.getValue() ?? 1)}
      disabled={statusMutation.isPending || !canWrite}
      onChange={async (nextStatus) => {
        const confirmed = await showConfirm(
          'Update Status',
          `Are you sure you want to ${Number(nextStatus) === 1 ? 'activate' : 'deactivate'} "${info.row.original.type_name}"?`
        );
        if (confirmed) statusMutation.mutate({ id: info.row.original.id, status: nextStatus });
      }} />


  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: (info) =>
    <div className="flex items-center justify-center gap-2">
          {canWrite && <button onClick={() => handleEdit(info.row.original)} className="action-btn-edit">Edit</button>}
          {canDelete && <button
        onClick={async () => {
          const confirmed = await showConfirm('Delete Donation Type', `Delete "${info.row.original.type_name}"? Existing donations will disable it instead.`);
          if (confirmed) deleteMutation.mutate(info.row.original.id);
        }}
        className="action-btn-delete">
        
            Delete
          </button>}
        </div>

  }],
  [statusMutation, showConfirm, deleteMutation, canWrite, canDelete]);

  const sortedTypes = useMemo(() => {
    const list = donationTypes?.items || [];
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return b.status - a.status;
      return a.type_name.localeCompare(b.type_name);
    });
  }, [donationTypes]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Manage Donation Types</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {canWrite && <div className="lg:col-span-4 space-y-2">
          <Card className="border-border-temple sticky top-6">
            <CardContent className="p-6">
              <div className="flex flex-col space-y-1.5 bg-[#F6EEDF] border-b border-[#E2D2B8] px-6 py-4 -mx-6 -mt-6 mb-6 select-none rounded-t-lg">
                <h3 className="text-[18px] font-bold text-[#2F1F14] m-0 font-temple">
                  {editingType ? 'Edit Donation Type' : 'Add Donation Type'}
                </h3>
              </div>

              <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-text-main font-medium">Donation Type *</Label>
                  <Input {...register('type_name')} className="border-border-temple/50" />
                  {errors.type_name && <p className="text-xs text-error">{errors.type_name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-text-main font-medium">Donation Code</Label>
                  <Input {...register('receipt_prefix')} placeholder="e.g. {FY}-ANN" className="border-border-temple/50 font-mono uppercase" />
                  {errors.receipt_prefix && <p className="text-xs text-error">{errors.receipt_prefix.message}</p>}
                </div>

                <div className="flex gap-3 pt-2">
                  {editingType && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleCancel}
                      className="h-11 flex-1 font-bold text-[15px] text-[#2B2B2B] hover:bg-[#F8F4EE] border border-[#E7D8CC] rounded-lg"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleSubmit(onSubmit)}
                    disabled={mutation.isPending}
                    className="h-11 flex-1 font-bold text-white text-[15px] bg-primary hover:bg-primary/90 border-none shadow-sm rounded-lg"
                  >
                    {mutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>              </form>
            </CardContent>
          </Card>
          <div className="rounded-xl border border-[#E7D8CC] bg-[#FFF9F2] px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center rounded-full bg-[#F3E8D4] border border-[#D9C8AF] px-2 py-0.5 text-[11px] font-bold text-[#6B3B24] tracking-wide">
                Format Guide
              </span>
            </div>
            <p className="text-[13px] text-[#5C4A3B] leading-relaxed">
              Use <span className="font-bold text-primary">{'{FY}'}</span> for Financial Year (e.g. 2026-27).
            </p>
            <p className="text-[13px] text-[#5C4A3B] leading-relaxed mt-1">
              Example: <span className="font-bold text-secondary">{'{FY}-ANN'}</span> {'->'} <span className="font-semibold text-[#2F1F14]">2026-27-ANN00001</span>
            </p>
          </div>
        </div>}

        <div className={cn("lg:col-span-8", !canWrite && "lg:col-span-12")}>
          <Card className="border-border-temple shadow-sm overflow-hidden">
            <DataTable columns={columns} data={sortedTypes} loading={isLoading} />
          </Card>
        </div>
      </div>
    </div>);

};

export default DonationTypesPage;
