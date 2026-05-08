import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Eye,
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
import { InlineStatusSelect } from '../components/ui/InlineStatusSelect';
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

const unitSchema = z.object({
  unit_name: z.string().min(1, 'Name is required'),
  unit_code: z.string().min(1, 'Code is required'),
  status: z.coerce.number().default(1),
});

type UnitFormValues = z.infer<typeof unitSchema>;

const UnitsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingUnit, setViewingUnit] = useState<any>(null);

  // Fetch Data
  const { data: units, isLoading } = useQuery({
    queryKey: ['units', search, pageSize, status],
    queryFn: async () => {
      const params: any = { q: search, page_size: pageSize };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      const res = await api.get('/units/list_units', { params });
      return res.data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users/list_users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema) as any,
  });

  const mutation = useMutation({
    mutationFn: async (payload: UnitFormValues & { id?: number; isEditMode?: boolean }) => {
      const { id, isEditMode, ...data } = payload;
      if (isEditMode && !id) {
        throw new Error('Missing unit ID for update');
      }
      if (id) return api.put(`/units/update_unit/${id}`, data);
      return api.post('/units/create_unit', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      showSuccess(editingUnit ? 'Unit updated' : 'Unit added');
      handleClose();
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Operation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/units/delete_unit/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      showSuccess('Unit deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: number }) => api.put(`/units/update_unit/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      showSuccess('Status updated successfully');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Status update failed'),
  });

  const handleOpen = (unit: any = null) => {
    setEditingUnit(unit);
    if (unit) reset(unit);
    else reset({ unit_name: '', unit_code: '', status: 1 });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingUnit(null);
  };

  const handleView = (unit: any) => {
    setViewingUnit(unit);
    setViewDialogOpen(true);
  };

  const onSubmit = async (data: UnitFormValues) => {
    const confirmed = await showConfirm(
      editingUnit ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingUnit ? 'update' : 'save'} this unit?`
    );

    if (confirmed) {
      mutation.mutate({ ...data, id: editingUnit?.id, isEditMode: Boolean(editingUnit) });
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { 
      accessorKey: 'id', 
      header: 'ID', 
    },
    { 
      accessorKey: 'unit_name', 
      header: 'Unit Name', 
    },
    { 
      accessorKey: 'unit_code', 
      header: 'Code', 
    },
    { 
      accessorKey: 'status', 
      header: 'Status', 
      cell: info => (
        <InlineStatusSelect
          value={Number(info.getValue() ?? 1)}
          disabled={statusMutation.isPending}
          onChange={(nextStatus) => statusMutation.mutate({ id: info.row.original.id, status: nextStatus })}
        />
      )
    },
    {
      id: 'actions',
      header: () => <div className="text-center">Actions</div>,
      cell: info => (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          <button onClick={() => handleOpen(info.row.original)} className="action-btn-edit">Edit</button>
          <button
            onClick={async () => {
              const confirmed = await showConfirm('Delete Unit', `Are you sure you want to delete unit "${info.row.original.unit_name}"?`);
              if (confirmed) {
                deleteMutation.mutate(info.row.original.id);
              }
            }}
            className="action-btn-delete"
          >
            Delete
          </button>
        </div>
      )
    }
  ], [deleteMutation, showConfirm, statusMutation]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Units of Measurement</h2>
        </div>
        <Button 
          onClick={() => handleOpen()}
          className="text-text-main font-bold px-6"
        >
       
          Add Unit
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
                  placeholder="Search units..."
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
        data={units || []}
        loading={isLoading}
      />

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">Unit Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-0 mt-4">
            <DetailItem label="Unit Name" value={viewingUnit?.unit_name} />
            <DetailItem label="Unit Code" value={viewingUnit?.unit_code} />
          </div>
          <DialogFooter className="mt-6 border-t border-border-temple/40 pt-4">
            <Button onClick={() => setViewDialogOpen(false)} className="bg-primary hover:bg-secondary text-white px-10">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-md border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">
              {editingUnit ? 'Edit Unit' : 'New Unit'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4 pb-0">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-text-main">Unit Name *</Label>
                <Input {...register('unit_name')} placeholder="e.g. Kilogram" className="text-text-main" />
                {errors.unit_name && <p className="text-xs text-red-500">{errors.unit_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Unit Code *</Label>
                <Input {...register('unit_code')} placeholder="e.g. KG" className="text-text-main" />
                {errors.unit_code && <p className="text-xs text-red-500">{errors.unit_code.message}</p>}
              </div>
            </div>
            <DialogFooter className="gap-3">              <Button type="button" variant="ghost" onClick={handleClose} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2]">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                className="w-28 h-10 text-text-main"
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

export default UnitsPage;





