import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
import { InlineStatusSelect } from '../components/ui/InlineStatusSelect';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '../components/ui/Dialog';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { Label } from '../components/ui/Label';
import { DetailItem } from '../components/ui/DetailItem';

const itemSchema = z.object({
  item_name: z.string().min(1, 'Name is required'),
  category_id: z.coerce.number().min(1, 'Category is required'),
  unit_id: z.coerce.number().min(1, 'Unit is required'),
  opening_stock: z.coerce.string().regex(/^\d*\.?\d*$/, 'Must be a valid number').default('0'),
  current_stock: z.coerce.string().regex(/^\d*\.?\d*$/, 'Must be a valid number').default('0'),
  default_price: z.coerce.number().min(0, 'Cannot be negative'),
  min_stock_level: z.coerce.number().min(0, 'Cannot be negative'),
  max_stock_level: z.coerce.number().min(0, 'Cannot be negative'),
  status: z.coerce.number().default(1),
});

type ItemFormValues = z.infer<typeof itemSchema>;

const ItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<any>(null);

  // Fetch Data
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', search, fromDate, toDate],
    queryFn: async () => {
      const params: any = { 
        q: search, 
        page_size: 1000,
      };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      
      const res = await api.get('/items/list_items', { params });
      return res.data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['item-categories-list'],
    queryFn: async () => (await api.get('/item-categories/list_categories')).data,
  });

  const { data: units } = useQuery({
    queryKey: ['units-list'],
    queryFn: async () => (await api.get('/units/list_units')).data,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users/list_users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema) as any,
  });

  // Mutations
  const mutation = useMutation({
    mutationFn: async (data: ItemFormValues) => {
      if (editingItem) return api.put(`/items/update_item/${editingItem.id}`, data);
      return api.post('/items/create_item', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess(editingItem ? 'Item updated' : 'Item added');
      handleClose();
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Operation failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/items/delete_item/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Item deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: number }) => api.put(`/items/update_item/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Status updated successfully');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Status update failed'),
  });

  const handleOpen = (item: any = null) => {
    setEditingItem(item);
    if (item) {
      reset({
        ...item,
        opening_stock: item.opening_stock ?? 0,
        current_stock: item.current_stock ?? 0,
        default_price: item.default_price ?? 0,
        min_stock_level: item.min_stock_level ?? 0,
        max_stock_level: item.max_stock_level ?? 0,
      });
    } else {
      reset({
        item_name: '',
        category_id: 0,
        unit_id: 0,
        opening_stock: 0,
        current_stock: 0,
        default_price: 0,
        min_stock_level: 0,
        max_stock_level: 0,
        status: 1
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingItem(null);
  };

  const handleView = async (item: any) => {
    try {
      const res = await api.get('/items/' + item.id);
      setViewingItem(res.data);
      setViewDialogOpen(true);
    } catch (err) {
      showError('Failed to fetch item details');
    }
  };

  const onSubmit = async (data: ItemFormValues) => {
    const confirmed = await showConfirm(
      editingItem ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingItem ? 'update' : 'save'} this item?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: info => <span className="text-text-main">{new Date(info.getValue() as string).toLocaleDateString()}</span>,
    },
    {
      accessorKey: 'item_name',
      header: 'Item Name',
      cell: info => <span className="text-text-main font-medium">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'category_id',
      header: 'Category',
      cell: info => {
        const cat = categories?.find((c: any) => c.id === info.getValue());
        return <span className="text-text-main">{cat ? cat.category_name : '-'}</span>;
      }
    },
    {
      accessorKey: 'default_price',
      header: 'Standard Price',
      cell: info => <span className="text-text-main">₹{(Number(info.getValue() || 0)).toLocaleString()}</span>,
    },
    {
      accessorKey: 'current_stock',
      header: 'Current Stock',
      cell: info => {
        const row = info.row.original;
        const unit = units?.find((u: any) => u.id === row.unit_id);
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-text-main">
              {info.getValue() as string}
            </span>
            <span className="text-text-main text-xs text-secondary/70">{unit?.unit_code}</span>
          </div>
        );
      }
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
      header: "Actions",
      cell: info => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          <button onClick={() => navigate(`/items/${info.row.original.id}/history`)} className="action-btn-view">History</button>
          <button onClick={() => handleOpen(info.row.original)} className="action-btn-edit">Edit</button>
          <button
            onClick={async () => {
              const confirmed = await showConfirm('Delete Item', `Are you sure you want to delete this item?`);
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
  ], [categories, units, navigate, deleteMutation, showConfirm, statusMutation]);

    return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-text-main">Items & Stock</h2>
        </div>
        <Button onClick={() => handleOpen()} className="text-text-main">
          Add New Item
        </Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 w-full sm:w-44">
              <Label className="text-text-main font-medium">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-text-main"
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-44">
              <Label className="text-text-main font-medium">To Date</Label>
              <Input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-text-main"
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-72">
              <Label className="text-text-main font-medium">Search</Label>
              <Input
                placeholder="Item name, Category, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-text-main"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable 
        columns={columns} 
        data={items || []} 
        loading={itemsLoading} 
      />

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh] border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">Item Details</DialogTitle>
            <DialogDescription className="sr-only">
              Technical specifications and current inventory status for this item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-0 mt-4 px-2">
            <DetailItem label="Item Name" value={viewingItem?.item_name} />
            <DetailItem label="Category" value={categories?.find((c: any) => c.id === viewingItem?.category_id)?.category_name} />
            <DetailItem label="Measurement Unit" value={units?.find((u: any) => u.id === viewingItem?.unit_id)?.unit_name} />
            <DetailItem label="Standard Price" value={`₹${Number(viewingItem?.default_price || 0).toLocaleString()}`} />
            <DetailItem label="Current Stock" value={viewingItem?.current_stock} />
            <DetailItem label="Min Stock Alert" value={viewingItem?.min_stock_level} />
          </div>
          <DialogFooter className="mt-6 border-t border-border-temple/40 pt-4">
            <Button onClick={() => setViewDialogOpen(false)} className="bg-primary hover:bg-secondary text-white px-10">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            <DialogDescription className="sr-only">
              {editingItem ? 'Update the details of the existing inventory item.' : 'Create a new item in the inventory system.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="temple-form">
            <div className="temple-form-section">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="temple-label">Category *</Label>
                  <Controller
                    name="category_id"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} className="temple-input">
                        <option value="">Select Category</option>
                        {categories?.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.category_name}</option>
                        ))}
                      </Select>
                    )}
                  />
                  {errors.category_id && <p className="text-xs font-medium text-error ml-1">{errors.category_id.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="temple-label">Item Name *</Label>
                  <Input {...register('item_name')} className="temple-input" placeholder="e.g. Basmati Rice" />
                  {errors.item_name && <p className="text-xs font-medium text-error ml-1">{errors.item_name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="temple-label">Unit *</Label>
                  <Controller
                    name="unit_id"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} className="temple-input">
                        <option value="">Select Unit</option>
                        {units?.map((u: any) => (
                          <option key={u.id} value={u.id}>{u.unit_name} ({u.unit_code})</option>
                        ))}
                      </Select>
                    )}
                  />
                  {errors.unit_id && <p className="text-xs font-medium text-error ml-1">{errors.unit_id.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label className="temple-label">Opening Stock</Label>
                  <Input type="text" {...register('opening_stock')} className="temple-input" />
                  {errors.opening_stock && <p className="text-xs font-medium text-error ml-1">{errors.opening_stock.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="temple-label">Min Stock Alert Level</Label>
                  <Input type="number" {...register('min_stock_level')} className="temple-input" />
                </div>
              </div>

              {editingItem && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label className="temple-label">Current Stock</Label>
                    <Input type="text" {...register('current_stock')} className="temple-input" disabled />
                    {errors.current_stock && <p className="text-xs font-medium text-error ml-1">{errors.current_stock.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="temple-label">Standard Price (₹)</Label>
                    <Input type="number" {...register('default_price')} className="temple-input" />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-3 mt-6">
              <Button type="button" variant="ghost" onClick={handleClose} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2]">
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="w-28 h-10 text-text-main">
                {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ItemsPage;









