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

const menuItemSchema = z.object({
  dish_name: z.string().min(1, 'Dish name is required'),
  unit_id: z.coerce.number().min(1, 'Unit is required'),
  status: z.coerce.number().default(1),
});

type MenuItemFormValues = z.infer<typeof menuItemSchema>;

const MenuItemsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingMenuItem, setViewingMenuItem] = useState<any>(null);

  // Fetch Data
  const { data: menuItems, isLoading: menuItemsLoading } = useQuery({
    queryKey: ['menu-items', search, pageSize, status],
    queryFn: async () => {
      const params: any = { 
        q: search, 
        page_size: pageSize,
      };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      
      const res = await api.get('/menu-items/list_menu_items', { params });
      return res.data;
    },
  });

  const { data: units } = useQuery({
    queryKey: ['units-list'],
    queryFn: async () => (await api.get('/units/list_units')).data,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users/list_users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema) as any,
  });

  // Mutations
  const mutation = useMutation({
    mutationFn: async (data: MenuItemFormValues) => {
      if (editingMenuItem) return api.put(`/menu-items/${editingMenuItem.id}`, data);
      return api.post('/menu-items/create_menu_item', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showSuccess(editingMenuItem ? 'Menu item updated' : 'Menu item added');
      handleClose();
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Operation failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/menu-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showSuccess('Menu item deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const handleOpen = (item: any = null) => {
    setEditingMenuItem(item);
    if (item) reset(item);
    else reset({
      dish_name: '',
      unit_id: '' as any,
      status: 1
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingMenuItem(null);
  };

  const handleView = async (item: any) => {
    setViewingMenuItem(item);
    setViewDialogOpen(true);
  };

  const onSubmit = async (data: MenuItemFormValues) => {
    const confirmed = await showConfirm(
      editingMenuItem ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingMenuItem ? 'update' : 'save'} this menu item?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: info => <span className="text-text-main font-mono">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'dish_name',
      header: 'Dish Name',
      cell: info => <span className="text-text-main font-medium">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'unit_id',
      header: 'Unit',
      cell: info => {
        const unit = units?.find((u: any) => u.id === info.getValue());
        return <span className="text-text-main">{unit ? `${unit.unit_name} (${unit.unit_code})` : (info.getValue() as string)}</span>;
      }
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
      header: "Actions",
      cell: info => (
        <div className="flex items-center justify-end gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleView(info.row.original)}
            className="h-8 px-2"
          >
            View
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleOpen(info.row.original)}
            className="h-8 px-2"
          >
            Edit
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={async () => {
              const confirmed = await showConfirm('Delete Menu Item', `Are you sure you want to delete this menu item?`);
              if (confirmed) {
                deleteMutation.mutate(info.row.original.id);
              }
            }}
            className="h-8 px-2"
          >
            Delete
          </Button>
        </div>
      )
    }
  ], [units, deleteMutation, showConfirm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-text-main text-2xl font-semibold font-temple">Menu Items (Prepared Dishes)</h2>
        </div>
        <Button onClick={() => handleOpen()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Menu Item
        </Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
             <div className="space-y-1.5">
              <Label className="text-text-main font-medium">Rows</Label>
              <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main font-medium">Status Filter</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-text-main font-medium">Quick Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-main/50" />
                <Input 
                  placeholder="Search dishes..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border-temple overflow-hidden bg-white">
        <DataTable 
          columns={columns} 
          data={menuItems || []} 
          loading={menuItemsLoading} 
        />
      </div>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md border-border-temple">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-text-main font-temple">Menu Item Details</DialogTitle>
              <Badge variant={viewingMenuItem?.status === 1 ? 'default' : 'secondary'}>
                {viewingMenuItem?.status === 1 ? 'Active' : 'Disabled'}
              </Badge>
            </div>
          </DialogHeader>
          <div className="space-y-1 mt-4">
            <DetailItem label="Dish Name" value={viewingMenuItem?.dish_name} />
            <DetailItem label="Measurement Unit" value={viewingMenuItem?.unit ? `${viewingMenuItem.unit.unit_name} (${viewingMenuItem.unit.unit_code})` : '-'} />
            
            <div className="pt-6 pb-2">
              <h4 className="text-sm font-semibold text-text-main underline decoration-border-temple underline-offset-4 font-temple">Audit Information</h4>
            </div>
            <div className="bg-bg-temple/50 p-4 rounded-lg border border-border-temple/20 space-y-1">
              <DetailItem 
                label="Created At" 
                value={viewingMenuItem?.created_at ? new Date(viewingMenuItem.created_at).toLocaleString() : '-'} 
              />
              <DetailItem 
                label="Created By" 
                value={users?.find((u: any) => u.id === viewingMenuItem?.created_by)?.username || viewingMenuItem?.created_by} 
              />
              <DetailItem 
                label="Last Updated" 
                value={viewingMenuItem?.updated_at ? new Date(viewingMenuItem.updated_at).toLocaleString() : '-'} 
              />
              <DetailItem 
                label="Updated By" 
                value={users?.find((u: any) => u.id === viewingMenuItem?.updated_by)?.username || viewingMenuItem?.updated_by} 
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
            <DialogTitle className="text-text-main font-temple">
              {editingMenuItem ? 'Edit Menu Item' : 'Add New Menu Item'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-text-main font-medium">Dish Name *</Label>
                <Input {...register('dish_name')} placeholder="Enter dish name" />
                {errors.dish_name && <p className="text-xs text-red-500 font-medium">{errors.dish_name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-text-main font-medium">Unit *</Label>
                <Controller
                  name="unit_id"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} className="w-full">
                      <option value="">Select Unit</option>
                      {units?.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.unit_name} ({u.unit_code})</option>
                      ))}
                    </Select>
                  )}
                />
                {errors.unit_id && <p className="text-xs text-red-500 font-medium">{errors.unit_id.message}</p>}
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
                    {editingMenuItem ? 'Update Item' : 'Save Item'}
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

export default MenuItemsPage;




