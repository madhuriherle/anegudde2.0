import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

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
  DialogDescription } from
'../components/ui/Dialog';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { DetailItem } from '../components/ui/DetailItem';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';
import { formatQuantityWithUnit } from '../utils/quantity';
import { DeletionWarningDialog } from '../components/ui/DeletionWarningDialog';
import { cn } from '../utils/cn';
import { usePermission } from '../hooks/usePermission';

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
  serial_number: z.string().optional().nullable()
});



const ItemsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('items.write');
  const canDelete = hasPermission('items.delete');

  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [priceHistoryItem, setPriceHistoryItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [usageDetails, setUsageDetails] = useState([]);

  // Filter States
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Fetch Data
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', search, page, pageSize, selectedCategory],
    queryFn: async () => {
      const params = {
        page,
        page_size: pageSize,
        q: search,
        sort_by: 'item_name',
        sort_order: 'asc'
      };
      if (selectedCategory) params.category_id = Number(selectedCategory);
      const res = await api.get('/items/list_items', { params });
      return res.data;
    }
  });

  const items = useMemo(() => {
    const list = itemsData?.items ?? [];
    return [...list].sort((a, b) => {
      const aStatus = Number(a?.status ?? 0);
      const bStatus = Number(b?.status ?? 0);
      if (aStatus !== bStatus) return bStatus - aStatus; // Active first
      return String(a?.item_name || '').localeCompare(String(b?.item_name || ''), undefined, { sensitivity: 'base' });
    });
  }, [itemsData]);

  const { data: categoriesData } = useQuery({
    queryKey: ['item-categories-list'],
    queryFn: async () => (await api.get('/item-categories/list_categories')).data
  });
  const categories = useMemo(() => {
    const list = Array.isArray(categoriesData) ? categoriesData : categoriesData?.items ?? [];
    return [...list].sort((a, b) =>
    String(a.category_name || '').localeCompare(String(b.category_name || ''), undefined, { sensitivity: 'base' })
    );
  }, [categoriesData]);

  const { data: units } = useQuery({
    queryKey: ['units-list'],
    queryFn: async () => (await api.get('/units/list_units', { params: { page_size: 1000 } })).data
  });
  const unitOptions = useMemo(() => {
    const list = Array.isArray(units) ? units : units?.items ?? [];
    return [...list].sort((a, b) =>
    String(a.unit_name || '').localeCompare(String(b.unit_name || ''), undefined, { sensitivity: 'base' })
    );
  }, [units]);

  const todayDate = useMemo(() => new Date().toISOString().split('T')[0], []);
  const { data: todaySummaryData } = useQuery({
    queryKey: ['canteen-summary', todayDate],
    queryFn: async () => {
      const res = await api.get('/reports/get_canteen_summary', { params: { date: todayDate } });
      return res.data;
    }
  });
  const todayOpeningByItemId = useMemo(() => {
    const map = new Map();
    (todaySummaryData?.rows || []).forEach((row) => {
      map.set(Number(row.item_id), Number(row.opening_balance || 0));
    });
    return map;
  }, [todaySummaryData]);

  const { data: priceHistory, isLoading: priceHistoryLoading } = useQuery({
    queryKey: ['item-prices', priceHistoryItem?.id],
    queryFn: async () => {
      const res = await api.get(`/items/get_price_history/${priceHistoryItem.id}`);
      return res.data;
    },
    enabled: priceHistoryOpen && !!priceHistoryItem?.id
  });
  const priceHistoryRows = useMemo(() => priceHistory || [], [priceHistory]);
  const latestPriceRow = useMemo(() => priceHistoryRows[0] || null, [priceHistoryRows]);

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(itemSchema)
  });

  // Mutations
  const mutation = useMutation({
    mutationFn: async (payload) => {
      const { id, isEditMode, ...data } = payload;
      if (isEditMode && id) return api.put(`/items/update_item/${id}`, data);
      return api.post('/items/create_item', data);
    },
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess(variables?.isEditMode ? 'Item updated' : 'Item added');
      handleClose();
    },
    onError: (err) => {
      showError(err.response?.data?.detail || 'Operation failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/items/delete_item/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Item deleted');
      setDeleteWarningOpen(false);
    },
    onError: (err) => showError(err.response?.data?.detail || 'Delete failed')
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => api.put(`/items/update_item/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Status updated successfully');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Status update failed')
  });

  const handleOpen = (item = null) => {
    setEditingItem(item);
    if (item) {
      reset({
        ...item,
        opening_stock: String(item.opening_stock ?? '0'),
        current_stock: String(item.current_stock ?? '0'),
        default_price: Number(item.default_price ?? 0),
        min_stock_level: Number(item.min_stock_level ?? 0),
        max_stock_level: Number(item.max_stock_level ?? 0),
        serial_number: item.serial_numbers?.[0]?.serial_number || ''
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
        serial_number: ''
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingItem(null);
  };

  const handleView = (item) => {
    setViewingItem(item);
    setViewDialogOpen(true);
  };

  const handlePriceHistory = (item) => {
    setPriceHistoryItem(item);
    setPriceHistoryOpen(true);
  };

  const handleDeleteClick = async (item) => {
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

  const onSubmit = async (data) => {
    const confirmed = await showConfirm(
      editingItem ? 'Confirm Update' : 'Confirm Save',
      `Are you sure you want to ${editingItem ? 'update' : 'save'} this item?`
    );

    if (confirmed) {
      mutation.mutate({ ...data, id: editingItem?.id, isEditMode: Boolean(editingItem) });
    }
  };

  const columns = useMemo(() => [
  {
    id: 'item_code',
    header: 'Item Code',
    cell: (i) => <span className="text-text-main">{i.row.original?.serial_numbers?.[0]?.serial_number || '-'}</span>
  },
  {
    accessorKey: 'item_name',
    header: 'Item Name',
    cell: (i) => <span className="text-text-main font-normal">{i.getValue()}</span>
  },
  {
    id: 'category',
    header: 'Category',
    cell: (i) =>
    <span className="text-text-main">
          {i.row.original?.category?.category_name || 'Uncategorized'}
        </span>

  },
  {
    accessorKey: 'current_stock',
    header: 'Current Stock',
    cell: (i) =>
    <span className={cn(
      "font-normal",
      Number(i.getValue()) <= Number(i.row.original.min_stock_level) ? 'text-error' : 'text-text-main'
    )}>
          {Number(i.getValue() || 0).toFixed(3)} {i.row.original.unit?.unit_code}
        </span>

  },
  {
    accessorKey: 'default_price',
    header: 'Current Price',
    cell: (i) =>
    <button
      type="button"
      onClick={() => handlePriceHistory(i.row.original)}
      className="px-2 py-1 rounded-md text-text-main font-normal text-sm hover:bg-gray-100 hover:text-primary transition-all active:scale-95 whitespace-nowrap">
      
          {formatCurrency(i.getValue())}
        </button>

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
          `Are you sure you want to ${Number(nextStatus) === 1 ? 'activate' : 'deactivate'} "${info.row.original.item_name}"?`
        );
        if (confirmed) statusMutation.mutate({ id: info.row.original.id, status: nextStatus });
      }} />


  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: (info) =>
    <div className="flex items-center justify-center gap-2">
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          {canWrite && <button onClick={() => handleOpen(info.row.original)} className="action-btn-edit">Edit</button>}
          {canDelete && <button onClick={() => handleDeleteClick(info.row.original)} className="action-btn-delete">Delete</button>}
          <button onClick={() => navigate(`/items/rawitem/${info.row.original.id}/history`)} className="action-btn-view bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">History</button>
        </div>

  }],
  [navigate, statusMutation, showConfirm, canWrite, canDelete]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Item Management</h2>
        {canWrite && <Button onClick={() => handleOpen()} className="text-text-main font-bold">Add New Item</Button>}
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 w-full sm:w-72">
              <Label className="text-text-main">Search</Label>
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="text-text-main"
                placeholder="Search items..." />
              
            </div>
            <div className="space-y-1.5 w-full sm:w-72">
              <Label className="text-text-main">Category</Label>
              <Select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="text-text-main">
                
                <option value="">All Categories</option>
                {categories?.map((c) =>
                <option key={c.id} value={c.id}>{c.category_name}</option>
                )}
              </Select>
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
        totalCount={itemsData?.total || 0} />
      

      <Dialog open={priceHistoryOpen} onOpenChange={setPriceHistoryOpen}>
        <DialogContent className="max-w-3xl !flex !flex-col !p-0 border-border-temple shadow-2xl bg-white overflow-hidden">
          <DialogHeader className="!m-0 border-b border-border-temple/40 !px-8 !py-6 shrink-0 bg-[#F3E8D4]">
            <DialogTitle className="text-xl text-text-main font-temple">
              Price History: {priceHistoryItem?.item_name || ''}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Viewing item price history.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 p-8 bg-white space-y-6 overflow-y-auto custom-scrollbar">
            {latestPriceRow && (
              <div className="flex flex-col items-end pb-2">
                <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Latest Price ({formatDate(latestPriceRow.purchase_date)})</span>
                <span className="text-2xl font-black text-primary">
                  {formatCurrency(latestPriceRow.price)}
                </span>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-border-temple/40 shadow-sm bg-white">
              <table className="w-full table-auto text-left text-base border-collapse">
                <tbody className="divide-y divide-border-temple/10">
                  {priceHistoryLoading ?
                  <tr>
                      <td colSpan={3} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <span className="text-sm text-text-light uppercase tracking-widest">Loading history...</span>
                        </div>
                      </td>
                    </tr> :
                  priceHistoryRows.length === 0 ?
                  <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-text-main/60 text-sm italic">No price history records found.</td>
                    </tr> :

                  priceHistoryRows.map((row, idx) =>
                  <tr key={`${row.purchase_date}-${idx}`} className="hover:bg-bg-temple/5 transition-colors">
                        <td className="px-6 py-4 text-text-main whitespace-nowrap">
                          <span className="text-base font-medium">{formatDate(row.purchase_date)}</span>
                        </td>
                        <td className="px-6 py-4 text-text-main whitespace-normal break-words">{row.vendor_name || '-'}</td>
                        <td className="px-6 py-4 text-right text-text-main font-semibold whitespace-nowrap">{formatCurrency(row.price)}</td>
                      </tr>
                  )
                  }
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="!p-6 !m-0 border-t border-border-temple/40 flex justify-end shrink-0 bg-[#F3E8D4]">
            <Button onClick={() => setPriceHistoryOpen(false)} className="px-8 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white border-none shadow-lg">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        "Any remaining stock for this item will effectively be archived."]
        } />
      

      {/* Item View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl !flex !flex-col !p-0 border-border-temple shadow-2xl bg-white overflow-hidden">
          <DialogHeader className="!m-0 border-b border-border-temple/40 !px-8 !py-6 shrink-0 bg-[#F3E8D4]">
            <DialogTitle>Item Details</DialogTitle>
            <DialogDescription className="sr-only">Viewing item properties</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 space-y-6 px-8 py-8 overflow-y-auto custom-scrollbar">
            <div className="space-y-1">
              <DetailItem label="Item ID" value={viewingItem?.id} />
              <DetailItem label="Item Name" value={viewingItem?.item_name} />
              <DetailItem label="Item Code" value={viewingItem?.serial_numbers?.[0]?.serial_number || '-'} />
              <DetailItem label="Category" value={viewingItem?.category?.category_name} />
              <DetailItem label="Unit" value={`${viewingItem?.unit?.unit_name} (${viewingItem?.unit?.unit_code})`} />
              <DetailItem
                label="Today Opening Stock"
                value={formatQuantityWithUnit(todayOpeningByItemId.get(Number(viewingItem?.id)) ?? 0, viewingItem?.unit)} />
              
              <DetailItem
                label="Current Stock"
                value={formatQuantityWithUnit(viewingItem?.current_stock || 0, viewingItem?.unit)}
                valueClassName={cn(
                  "font-bold",
                  Number(viewingItem?.current_stock) <= Number(viewingItem?.min_stock_level) ? 'text-error' : 'text-text-main'
                )} />
              
              <DetailItem label="Current Rate" value={formatCurrency(viewingItem?.default_price || 0)} />
              <DetailItem label="Min. Stock Alert" value={formatQuantityWithUnit(viewingItem?.min_stock_level || 0, viewingItem?.unit)} />
            </div>
          </div>

          <DialogFooter className="!p-6 !m-0 border-t border-border-temple/40 flex justify-end shrink-0 bg-[#F3E8D4]">
            <Button onClick={() => setViewDialogOpen(false)} className="px-8 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-lg">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(val) => {
        if (!val && !mutation.isPending) {
          handleClose();
        }
      }}>
        <DialogContent
          className="max-w-2xl !p-0 overflow-hidden border-border-temple shadow-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}>
          
          <DialogHeader className="shrink-0 bg-[#F3E8D4] border-b border-border-temple/40 !p-6 !m-0">
            <DialogTitle className="text-text-main font-temple text-xl font-normal">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </DialogTitle>
            <DialogDescription className="sr-only">Item details form</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white flex flex-col" autoComplete="off">
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-text-main font-normal">Item Name *</Label>
                  <Input {...register('item_name')} placeholder="Enter item name" className="h-11 text-base text-text-main" />
                  {errors.item_name && <p className="text-xs text-red-500 font-bold uppercase">{errors.item_name.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-text-main font-normal">Item Code</Label>
                  <Input {...register('serial_number')} placeholder="Enter item code" className="h-11 text-base text-text-main" />
                  {errors.serial_number && <p className="text-xs text-red-500 font-bold uppercase">{errors.serial_number.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-text-main font-normal">Category *</Label>
                  <Controller
                    name="category_id"
                    control={control}
                    render={({ field }) =>
                    <Select
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="h-11 text-base text-text-main">
                      
                        <option value="">Select Category</option>
                        {categories?.map((c) =>
                      <option key={c.id} value={c.id}>{c.category_name}</option>
                      )}
                      </Select>
                    } />
                  
                  {errors.category_id && <p className="text-xs text-red-500 font-bold uppercase">{errors.category_id.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-text-main font-normal">Unit *</Label>
                  <Controller
                    name="unit_id"
                    control={control}
                    render={({ field }) =>
                    <Select {...field} className="h-11 text-base text-text-main">
                        <option value="">Select Unit</option>
                        {unitOptions.map((u) =>
                      <option key={u.id} value={u.id}>{u.unit_name} ({u.unit_code})</option>
                      )}
                      </Select>
                    } />
                  
                  {errors.unit_id && <p className="text-xs text-red-500 font-bold uppercase">{errors.unit_id.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-text-main font-normal">Minimum Stock Alert</Label>
                  <Input
                    {...register('min_stock_level')}
                    className="h-11 text-base text-text-main"
                    onFocus={(e) => {
                      if (e.target.value === '0') {
                        setValue('min_stock_level', '');
                      }
                    }} />
                  
                  {errors.min_stock_level && <p className="text-xs text-red-500 font-bold uppercase">{errors.min_stock_level.message}</p>}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-3 !p-6 !m-0 border-t border-border-temple/40 bg-[#F3E8D4] shrink-0">
              <Button type="button" variant="ghost" onClick={handleClose} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2] font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="w-32 h-10 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg border-none">
                {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>);

};

export default ItemsPage;
