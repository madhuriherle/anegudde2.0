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
import { Label } from '../components/ui/Label';
import { DetailItem } from '../components/ui/DetailItem';
import { formatCurrency } from '../utils/currency';
import { DeletionWarningDialog } from '../components/ui/DeletionWarningDialog';
import { cn } from '../utils/cn';

const itemSchema = z.object({
  item_name: z.string().min(1, 'Name is required'),
  category_id: z.coerce.number().optional().nullable(),
  unit_id: z.coerce.number().min(1, 'Unit is required'),
  opening_stock: z.coerce.string().default('0'),
  current_stock: z.coerce.string().default('0'),
  default_price: z.coerce.number().default(0),
  min_stock_level: z.coerce.number().min(0, 'Cannot be negative'),
  max_stock_level: z.coerce.number().min(0, 'Cannot be negative'),
  status: z.coerce.number().default(1),
});

type ItemFormValues = z.infer<typeof itemSchema>;

const ItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [usageDetails, setUsageDetails] = useState<string[]>([]);

  // Filter States
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState('');

  // Fetch Data
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', search, page, pageSize],
    queryFn: async () => {
      const params: any = { 
        page,
        page_size: pageSize,
        q: search,
        status: null 
      };
      const res = await api.get('/items/list_items', { params });
      return res.data;
    },
  });

  const items = useMemo(() => itemsData?.items ?? [], [itemsData]);

  const { data: categoriesData } = useQuery({
    queryKey: ['item-categories-list'],
    queryFn: async () => (await api.get('/item-categories/list_categories')).data,
  });
  const categories = useMemo(() => {
    const list = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.items ?? []);
    return [...list].sort((a: any, b: any) =>
      String(a.category_name || '').localeCompare(String(b.category_name || ''), undefined, { sensitivity: 'base' })
    );
  }, [categoriesData]);

  const { data: units } = useQuery({
    queryKey: ['units-list'],
    queryFn: async () => (await api.get('/units/list_units', { params: { page_size: 1000 } })).data,
  });
  const unitOptions = useMemo(() => {
    const list = Array.isArray(units) ? units : (units?.items ?? []);
    return [...list].sort((a: any, b: any) =>
      String(a.unit_name || '').localeCompare(String(b.unit_name || ''), undefined, { sensitivity: 'base' })
    );
  }, [units]);

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema) as any,
  });

  // Mutations
  const mutation = useMutation({
    mutationFn: async (payload: ItemFormValues & { id?: number; isEditMode?: boolean }) => {
      const { id, isEditMode, ...data } = payload;
      if (isEditMode && id) return api.put(`/items/update_item/${id}`, data);
      return api.post('/items/create_item', data);
    },
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess(variables?.isEditMode ? 'Item updated' : 'Item added');
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
      setDeleteWarningOpen(false);
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
        opening_stock: String(item.opening_stock ?? '0'),
        current_stock: String(item.current_stock ?? '0'),
        default_price: Number(item.default_price ?? 0),
        min_stock_level: Number(item.min_stock_level ?? 0),
        max_stock_level: Number(item.max_stock_level ?? 0),
      });
    } else {
      reset({
        item_name: '',
        category_id: 0,
        unit_id: 0,
        opening_stock: '0',
        current_stock: '0',
        default_price: 0,
        min_stock_level: 0,
        max_stock_level: 0,
        status: 1,
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingItem(null);
  };

  const handleView = (item: any) => {
    setViewingItem(item);
    setViewDialogOpen(true);
  };

  const handleDeleteClick = async (item: any) => {
    try {
      const res = await api.get('/system/check_usage', {
        params: { entity_type: 'item', entity_id: item.id }
      });
      
      if (res.data.has_usage) {
        setUsageDetails(res.data.details);
        setItemToDelete(item);
        setDeleteWarningOpen(true);
      } else {
        const confirmed = await showConfirm(
          'Delete Item',
          `Are you sure you want to delete "${item.item_name}"?`
        );
        if (confirmed) {
          deleteMutation.mutate(item.id);
        }
      }
    } catch {
      showError('Failed to check item usage');
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'item_name',
      header: 'Item Name',
      cell: (i) => <span className="text-text-main font-medium">{i.getValue() as string}</span>,
    },
    {
      accessorKey: 'current_stock',
      header: 'Current Stock',
      cell: (i) => (
        <span className={`font-bold ${Number(i.getValue()) <= Number(i.row.original.min_stock_level) ? 'text-error' : 'text-primary'}`}>
          {Number(i.getValue() || 0).toFixed(3)} {i.row.original.unit?.unit_code}
        </span>
      ),
    },
    {
      accessorKey: 'default_price',
      header: 'Current Price',
      cell: (i) => formatCurrency(i.getValue() as number),
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
          <button onClick={() => handleDeleteClick(info.row.original)} className="action-btn-delete">Delete</button>
          <button onClick={() => navigate(`/items/${info.row.original.id}/history`)} className="action-btn-view bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">History</button>
        </div>
      )
    }
  ], [navigate, statusMutation]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Item Management</h2>
        <Button onClick={() => handleOpen()} className="text-text-main font-bold">Add New Item</Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 w-full sm:w-72">
              <Label className="text-text-main">Search</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-text-main"
                placeholder="Search items..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable 
        columns={columns} 
        data={items} 
        loading={itemsLoading} 
        manualPagination
        pageCount={itemsData?.total_pages || 0}
        pageIndex={page - 1}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
        totalCount={itemsData?.total || 0}
      />

      <DeletionWarningDialog 
        open={deleteWarningOpen}
        onOpenChange={setDeleteWarningOpen}
        onConfirm={() => deleteMutation.mutate(itemToDelete?.id)}
        isPending={deleteMutation.isPending}
        title="Delete Item with Stock/History?"
        description={`"${itemToDelete?.item_name}" is currently referenced in your records.`}
        consequences={[
          ...usageDetails,
          "This item will be hidden from selection, but its past history remains in reports.",
          "Any remaining stock for this item will effectively be archived."
        ]}
      />

      {/* Item View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl border-border-temple">
          <DialogHeader>
            <DialogTitle>Item Details</DialogTitle>
            <DialogDescription className="sr-only">Viewing item properties</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-1 mt-4">
            <DetailItem label="Item Name" value={viewingItem?.item_name} />
            <DetailItem label="Category" value={viewingItem?.category?.category_name} />
            <DetailItem label="Unit" value={`${viewingItem?.unit?.unit_name} (${viewingItem?.unit?.unit_code})`} />
            <DetailItem label="Opening Stock" value={`${Number(viewingItem?.opening_stock || 0).toFixed(3)} ${viewingItem?.unit?.unit_code || ''}`} />
            <DetailItem 
              label="Current Stock" 
              value={`${Number(viewingItem?.current_stock || 0).toFixed(3)} ${viewingItem?.unit?.unit_code || ''}`} 
              valueClassName={cn(
                "font-bold",
                Number(viewingItem?.current_stock) <= Number(viewingItem?.min_stock_level) ? 'text-error' : 'text-primary'
              )} 
            />
            <DetailItem label="Current Rate" value={formatCurrency(viewingItem?.default_price || 0)} />
            <DetailItem label="Min. Stock Alert" value={`${Number(viewingItem?.min_stock_level || 0).toFixed(3)} ${viewingItem?.unit?.unit_code || ''}`} />
          </div>

          <DialogFooter>
            <Button onClick={() => setViewDialogOpen(false)} className="px-10 h-10 font-bold text-white bg-primary hover:bg-secondary rounded-lg">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-xl overflow-hidden max-h-[90vh] border-border-temple">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            <DialogDescription className="sr-only">Item details form</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((data) => mutation.mutate({ ...data, id: editingItem?.id, isEditMode: Boolean(editingItem) }))} className="bg-white flex flex-col" autoComplete="off">
            <div className="space-y-4 px-6 pt-4 pb-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <Label className="text-text-main">Item Name *</Label>
                  <Input {...register('item_name')} className="text-text-main" />
                  {errors.item_name && <p className="text-xs text-red-500">{errors.item_name.message}</p>}
                </div>

                <div>
                  <Label className="text-text-main">Category *</Label>
                  <Controller
                    name="category_id"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} className="text-text-main">
                        <option value="">Select Category</option>
                        {categories?.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.category_name}</option>
                        ))}
                      </Select>
                    )}
                  />
                  {errors.category_id && <p className="text-xs text-red-500">{errors.category_id.message}</p>}
                </div>

                <div>
                  <Label className="text-text-main">Unit *</Label>
                  <Controller
                    name="unit_id"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} className="text-text-main">
                        <option value="">Select Unit</option>
                        {unitOptions.map((u: any) => (
                          <option key={u.id} value={u.id}>{u.unit_name} ({u.unit_code})</option>
                        ))}
                      </Select>
                    )}
                  />
                  {errors.unit_id && <p className="text-xs text-red-500">{errors.unit_id.message}</p>}
                </div>

                <div>
                  <Label className="text-text-main">Minimum Stock Alert</Label>
                  <Input
                    {...register('min_stock_level')}
                    className="text-text-main"
                    onFocus={(e) => {
                      if (e.target.value === '0') {
                        setValue('min_stock_level', '' as any);
                      }
                    }}
                  />
                  {errors.min_stock_level && <p className="text-xs text-red-500">{errors.min_stock_level.message}</p>}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-3 p-6 border-t border-border-temple/40 bg-gray-50">
              <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ItemsPage;
