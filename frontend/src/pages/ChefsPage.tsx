import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Eye,
  Save,
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from '../components/ui/Dialog';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { Label } from '../components/ui/Label';
import { DetailItem } from '../components/ui/DetailItem';

const chefSchema = z.object({
  chef_name: z.string().min(1, 'Name is required'),
  phone: z.string().regex(/^[0-9]{8,15}$/, 'Phone number must be between 8 and 15 digits').optional().or(z.literal('')),
  status: z.coerce.number().default(1),
  specialization: z.string().optional().or(z.literal('')),
});

type ChefFormValues = z.infer<typeof chefSchema>;

const ChefsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingChef, setEditingChef] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingChef, setViewingChef] = useState<any>(null);

  // Fetch Data
  const { data: chefs, isLoading } = useQuery({
    queryKey: ['chefs', search, pageSize, status],
    queryFn: async () => {
      const params: any = { q: search, page_size: pageSize };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      const res = await api.get('/chefs', { params });
      return res.data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ChefFormValues>({
    resolver: zodResolver(chefSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: ChefFormValues) => {
      const payload = {
        chef_name: data.chef_name,
        phone: data.phone || null,
        status: data.status,
        specialization: data.specialization || null,
      };
      if (editingChef) return api.put(`/chefs/${editingChef.id}`, payload);
      return api.post('/chefs', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chefs'] });
      showSuccess(editingChef ? 'Chef updated' : 'Chef added');
      handleClose();
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' 
        ? detail 
        : (Array.isArray(detail) ? detail[0]?.msg : 'Operation failed');
      showError(message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/chefs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chefs'] });
      showSuccess('Chef deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const handleOpen = (chef: any = null) => {
    setEditingChef(chef);
    if (chef) {
      reset({
        chef_name: chef.chef_name,
        phone: chef.phone || '',
        status: chef.status,
        specialization: chef.specialization || '',
      });
    } else {
      reset({ chef_name: '', phone: '', specialization: '', status: 1 });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingChef(null);
  };

  const handleView = (chef: any) => {
    setViewingChef(chef);
    setViewDialogOpen(true);
  };

  const onSubmit = async (data: ChefFormValues) => {
    const confirmed = await showConfirm(
      editingChef ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingChef ? 'update' : 'save'} this chef?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: info => <span className="text-text-main">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'chef_name',
      header: 'Chef Name',
      cell: info => <span className="text-text-main">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Phone Number',
      cell: info => <span className="text-text-main">{info.getValue() as string || '-'}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: info => (
        <Badge variant={info.getValue() === 1 ? 'default' : 'secondary'}>
          {info.getValue() === 1 ? 'Active' : 'Disabled'}
        </Badge>
      )
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: info => (
        <div className="flex items-center justify-end gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleView(info.row.original)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleOpen(info.row.original)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4 text-blue-600" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={async () => {
              const confirmed = await showConfirm('Delete Chef', `Are you sure you want to delete chef "${info.row.original.chef_name}"?`);
              if (confirmed) {
                deleteMutation.mutate(info.row.original.id);
              }
            }}
            className="h-8 w-8 p-0"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      )
    }
  ], [deleteMutation, showConfirm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-text-main text-2xl font-semibold">Chefs Management</h2>
          <p className="text-text-main/70">Manage chef profiles and specializations.</p>
        </div>
        <Button onClick={() => handleOpen()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Chef
        </Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
             <div className="space-y-1.5">
              <Label className="text-text-main">Rows</Label>
              <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-main/50" />
                <Input 
                  placeholder="Search chefs..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable 
        columns={columns} 
        data={chefs || []} 
        loading={isLoading} 
      />

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md border-border-temple">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-text-main">Chef Details</DialogTitle>
              <Badge variant={viewingChef?.status === 1 ? 'default' : 'secondary'}>
                {viewingChef?.status === 1 ? 'Active' : 'Disabled'}
              </Badge>
            </div>
          </DialogHeader>
          <div className="space-y-1 mt-4">
            <DetailItem label="Chef ID" value={viewingChef?.id} />
            <DetailItem label="Chef Name" value={viewingChef?.chef_name} />
            <DetailItem label="Phone Number" value={viewingChef?.phone} />
            <DetailItem label="Specialization" value={viewingChef?.specialization} />
            
            <div className="pt-6 pb-2">
              <h4 className="text-sm font-semibold text-text-main underline decoration-border-temple underline-offset-4">Audit Information</h4>
            </div>
            <div className="bg-bg-temple/50 p-4 rounded-lg border border-border-temple/20 space-y-1">
              <DetailItem 
                label="Created At" 
                value={viewingChef?.created_at ? new Date(viewingChef.created_at).toLocaleString() : '-'} 
              />
              <DetailItem 
                label="Created By" 
                value={users?.find((u: any) => u.id === viewingChef?.created_by)?.username || viewingChef?.created_by} 
              />
              <DetailItem 
                label="Last Updated" 
                value={viewingChef?.updated_at ? new Date(viewingChef.updated_at).toLocaleString() : '-'} 
              />
              <DetailItem 
                label="Updated By" 
                value={users?.find((u: any) => u.id === viewingChef?.updated_by)?.username || viewingChef?.updated_by} 
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-md border-border-temple">
          <DialogHeader>
            <DialogTitle className="text-text-main">
              {editingChef ? 'Edit Chef' : 'New Chef'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-text-main">Chef Name *</Label>
                <Input {...register('chef_name')} placeholder="Enter chef name" />
                {errors.chef_name && <p className="text-xs text-red-500">{errors.chef_name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-text-main">Phone Number</Label>
                <Input {...register('phone')} placeholder="Enter phone number" />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-text-main">Specialization / Notes</Label>
                <textarea
                  {...register('specialization')}
                  rows={3}
                  placeholder="Any additional notes..."
                  className="flex w-full border border-border-temple bg-white px-3 py-2 text-text-main text-sm focus:outline-none focus:ring-1 focus:ring-border-temple rounded-md"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-bg-temple/30 rounded-lg border border-border-temple/20">
                <Label className="text-text-main font-medium">Active Status</Label>
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

            <DialogFooter className="gap-3">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="flex items-center gap-2">
                {mutation.isPending ? 'Saving...' : (
                  <>
                    <Save className="h-4 w-4" />
                    {editingChef ? 'Update' : 'Save'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChefsPage;
