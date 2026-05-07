import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Trash,
  Search
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
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
  DialogFooter 
} from '../components/ui/Dialog';
import { Select } from '../components/ui/Select';
import { DetailItem } from '../components/ui/DetailItem';

const wastageItemSchema = z.object({
  menu_item_id: z.coerce.number().min(1, 'Dish is required'),
  quantity: z.coerce.number().min(0.001, 'Quantity is required'),
});

const wastageSchema = z.object({
  wastage_date: z.string().min(1, 'Date is required'),
  reason: z.string().min(1, 'Reason is required'),
  items: z.array(wastageItemSchema).min(1, 'At least one item is required'),
});

type WastageFormValues = z.infer<typeof wastageSchema>;

const WastagesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingWastage, setEditingWastage] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingWastage, setViewingWastage] = useState<any>(null);

  // Fetch Data
  const { data: wastages, isLoading: wastagesLoading } = useQuery({
    queryKey: ['wastages', search, pageSize, status],
    queryFn: async () => {
      const params: any = { 
        q: search, 
        page_size: pageSize,
      };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      
      const res = await api.get('/wastages/list_wastages', { params });
      return res.data;
    },
  });

  const { data: menuItems } = useQuery({
    queryKey: ['menu-items-list'],
    queryFn: async () => (await api.get('/menu-items/list_menu_items')).data,
  });

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<WastageFormValues>({
    resolver: zodResolver(wastageSchema) as any,
    defaultValues: {
        items: [{ menu_item_id: '' as any, quantity: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const watchedItems = watch('items');

// Mutations
const mutation = useMutation({
  mutationFn: async (payloadWithId: WastageFormValues & { id?: number; isEditMode?: boolean }) => {
    const { id, isEditMode, ...data } = payloadWithId;
    if (isEditMode && !id) {
      throw new Error('Missing wastage ID for update');
    }
    const payload = {
      ...data,
      status: 1,
    };
    if (id) return api.put(`/wastages/update_wastage/${id}`, payload);
    return api.post('/wastages/create_wastage', payload);
  },
  onSuccess: () => {    queryClient.invalidateQueries({ queryKey: ['wastages'] });
    showSuccess(editingWastage ? 'Wastage updated' : 'Wastage recorded');
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
    mutationFn: async (id: number) => api.delete(`/wastages/delete_wastage/${id}`),    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wastages'] });
      showSuccess('Wastage deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const handleOpen = async (wastage: any = null) => {
    if (wastage) {
      try {
        const res = await api.get(`/wastages/get_wastage/${wastage.id}`);
        const fullData = res.data;
        setEditingWastage(fullData);
        reset({
          wastage_date: fullData.wastage_date,
          reason: fullData.reason || '',
          items: fullData.items.map((item: any) => ({
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
          })),
        });
      } catch (err) {
        showError('Failed to fetch wastage details');
        return;
      }
    } else {
      setEditingWastage(null);
      reset({
        wastage_date: new Date().toISOString().split('T')[0],
        reason: '',
        items: [{ menu_item_id: '' as any, quantity: 0 }],
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingWastage(null);
  };

  const handleView = async (wastage: any) => {
    try {
      const res = await api.get('/wastages/get_wastage/' + wastage.id);
      setViewingWastage(res.data);
      setViewDialogOpen(true);
    } catch (err) {
      showError('Failed to fetch wastage details');
    }
  };

  const onSubmit = async (data: WastageFormValues) => {
    const confirmed = await showConfirm(
      editingWastage ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingWastage ? 'update' : 'record'} this wastage?`
    );

    if (confirmed) {
      mutation.mutate({ ...data, id: editingWastage?.id, isEditMode: Boolean(editingWastage) });
    }
  };

  // Flattened items for DataTable
  const flattenedRows = useMemo(() => {
    if (!wastages) return [];
    const rows: any[] = [];
    wastages.forEach((w: any) => {
      w.items.forEach((item: any) => {
        rows.push({
          id: `${w.id}-${item.id}`,
          entryId: w.id,
          wastage_date: w.wastage_date,
          menu_item_id: item.menu_item_id,
          dish_name: item.menu_item?.dish_name || 'Unknown',
          quantity: item.quantity,
          unit: item.menu_item?.unit?.unit_code || '',
          reason: w.reason,
          status: w.status,
          raw_wastage: w
        });
      });
    });
    return rows;
  }, [wastages]);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { 
      accessorKey: 'entryId', 
      header: 'Entry ID', 
    },
    { 
      accessorKey: 'wastage_date', 
      header: 'Date', 
    },
    { 
      accessorKey: 'dish_name', 
      header: 'Dish Name', 
    },
    { 
      accessorKey: 'quantity', 
      header: 'Qty Wasted', 
      cell: info => (
        <span className="font-bold text-red-600">
          {info.getValue() as number} {info.row.original.unit}
        </span>
      )
    },
    { 
      accessorKey: 'reason', 
      header: 'Reason', 
    },
    {
      id: 'actions',
      header: "Actions",
      cell: info => (
        <div className="flex items-center justify-end gap-2 px-4">
          <button onClick={() => handleView(info.row.original.raw_wastage)} className="action-btn-view">View</button>
          <button onClick={() => handleOpen(info.row.original.raw_wastage)} className="action-btn-edit">Edit</button>
          <button
            onClick={async () => {
              const confirmed = await showConfirm('Delete Record', `Are you sure you want to delete this wastage record?`);
              if (confirmed) {
                deleteMutation.mutate(info.row.original.entryId);
              }
            }}
            className="action-btn-delete"
          >
            Delete
          </button>
        </div>
      ),
    },
  ], [deleteMutation, showConfirm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Trash className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-text-main">Wastage Records (Prepared Dishes)</h2>
          </div>
        </div>
        <Button 
          onClick={() => handleOpen()}
          className="text-text-main font-bold px-6"
        >
          <Plus className="w-4 h-4 mr-2" />
          Record Wastage
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
              <Label className="text-text-main">Status</Label>
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
                  placeholder="Search by reason or dish..."
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
        data={flattenedRows}
        loading={wastagesLoading}
      />

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-xl border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">Wastage Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-0 mt-4">
            <DetailItem label="Wastage Date" value={viewingWastage?.wastage_date} />
            <DetailItem label="Reason" value={viewingWastage?.reason} />
            <DetailItem label="Recorded By" value={viewingWastage?.user?.full_name} />

            <div className="pt-6 pb-2">
              <span className="text-sm font-bold text-text-main">Wasted Dishes List</span>
            </div>
            <div className="rounded-md border border-border-temple overflow-hidden mt-1">
              <table className="w-full text-sm text-left">
                <thead className="bg-bg-temple text-text-main uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3 border-b border-border-temple">Dish Name</th>
                    <th className="px-4 py-3 border-b border-border-temple text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-temple/40">
                  {viewingWastage?.items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-bg-temple/30">
                      <td className="px-4 py-3 text-text-main">{item.menu_item?.dish_name}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">
                        {item.quantity} {item.menu_item?.unit?.unit_code}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        <DialogContent className="max-w-2xl border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">
              {editingWastage ? 'Edit Wastage Record' : 'Record New Wastage'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-text-main">Date *</Label>
                <Input {...register('wastage_date')} type="date" className="text-text-main" />
                {errors.wastage_date && <p className="text-xs text-red-500">{errors.wastage_date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Reason/Remarks *</Label>
                <Input {...register('reason')} placeholder="e.g. Spilled, Burnt" className="text-text-main" />
                {errors.reason && <p className="text-xs text-red-500">{errors.reason.message}</p>}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Wasted Items (Prepared Dishes)</h4>
              <div className="p-4 bg-bg-temple border border-border-temple rounded-lg space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                    <div className="flex-1 w-full space-y-1.5">
                      <Label className="text-[11px] text-text-main uppercase">{index === 0 && "Select Dish"}</Label>
                      <Controller
                        name={`items.${index}.menu_item_id` as const}
                        control={control}
                        render={({ field: itemField }) => (
                          <Select 
                            value={itemField.value?.toString()} 
                            onChange={(e) => itemField.onChange(Number(e.target.value))}
                          >
                            <option value="">Select a dish</option>
                            {menuItems?.filter((i: any) => i.status === 1 || watchedItems?.[index]?.menu_item_id === i.id).map((i: any) => (
                              <option key={i.id} value={i.id}>{i.dish_name}</option>
                            ))}
                          </Select>
                        )}
                      />
                    </div>
                    <div className="w-full sm:w-32 space-y-1.5">
                      <Label className="text-[11px] text-text-main uppercase">{index === 0 && "Qty"}</Label>
                      <div className="relative">
                        <Input 
                          {...register(`items.${index}.quantity` as const)} 
                          type="number" 
                          step="0.001"
                          placeholder="0.00"
                          className="pr-10 text-text-main"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-bold">
                          {menuItems?.find((mi: any) => mi.id === watchedItems?.[index]?.menu_item_id)?.unit?.unit_code || ''}
                        </span>
                      </div>
                    </div>
                    <Button 
                      type="button"
                      variant="ghost" 
                      onClick={() => remove(index)} 
                      disabled={fields.length === 1}
                      className="h-10 w-10 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                
                <Button 
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ menu_item_id: '' as any, quantity: 0 })}
                  className="text-primary border-primary/20 hover:bg-primary/5"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another Dish
                </Button>
              </div>
            </div>

            <DialogFooter className="gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2]">
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

export default WastagesPage;




