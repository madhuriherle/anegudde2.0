import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Trash2,
  Plus
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
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
  DialogDescription
} from '../components/ui/Dialog';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { DetailItem } from '../components/ui/DetailItem';

const consumptionItemSchema = z.object({
  item_id: z.coerce.number().min(1, 'Item is required'),
  quantity_used: z.coerce.number().min(0.001, 'Min quantity is 0.001'),
});

const consumptionSchema = z.object({
  chef_id: z.coerce.number().min(1, 'Chef is required'),
  usage_date: z.string().min(1, 'Date is required'),
  people_served: z.coerce.number().optional().or(z.null()),
  items: z.array(consumptionItemSchema).min(1, 'At least one item is required'),
});

type ConsumptionFormValues = z.infer<typeof consumptionSchema>;

const ConsumptionsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [status, setStatus] = useState<string>('all');
  const [searchField, setSearchField] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingConsumption, setEditingConsumption] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingConsumption, setViewingConsumption] = useState<any>(null);

  const { data: consumptions, isLoading: consumptionsLoading } = useQuery({
    queryKey: ['consumptions', search, status, searchField],
    queryFn: async () => {
      const params: any = { q: search, page_size: 1000 };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      if (searchField !== 'all') params.search_field = searchField;
      const res = await api.get('/consumptions/list_consumptions', { params });
      return res.data;
    },
  });

  const { data: chefs } = useQuery({
    queryKey: ['chefs-list'],
    queryFn: async () => (await api.get('/chefs/list_chefs', { params: { page_size: 1000 } })).data,
  });

  const chefOptions = useMemo(() => {
    if (Array.isArray(chefs)) return chefs;
    if (Array.isArray((chefs as any)?.items)) return (chefs as any).items;
    return [];
  }, [chefs]);

  const { data: items } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => (await api.get('/items/list_items')).data,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users/list_users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<ConsumptionFormValues>({
    resolver: zodResolver(consumptionSchema) as any,
    defaultValues: {
      usage_date: new Date().toISOString().split('T')[0],
      chef_id: 0,
      people_served: 0,
      items: [{ item_id: 0, quantity_used: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');

  const mutation = useMutation({
    mutationFn: async (data: ConsumptionFormValues) => {
      const normalizedPayload = {
        ...data,
        people_served: data.people_served === undefined ? null : Number(data.people_served),
        chef_id: Number(data.chef_id),
        items: (data.items || []).map((it: any) => ({
          item_id: Number(it.item_id),
          quantity_used: Number(it.quantity_used),
        })),
      };
      if (editingConsumption) {
        return api.put(`/consumptions/update_consumption/${editingConsumption.id}`, { ...normalizedPayload, user_id: user?.id, status: 1 });
      }
      return api.post('/consumptions/create_consumption', { ...normalizedPayload, user_id: user?.id, status: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      showSuccess(editingConsumption ? 'Usage record updated' : 'Usage record saved');
      handleClose();
    },
    onError: (err: any) => {
        showError(err.response?.data?.detail || 'Failed to save record');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/consumptions/delete_consumption/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      showSuccess('Usage record deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const handleOpen = async (consumption: any = null) => {
    if (consumption) {
      try {
        const res = await api.get(`/consumptions/get_consumption/${consumption.id}`);
        const fullData = res.data;
        setEditingConsumption(fullData);
        reset({
          usage_date: fullData.usage_date,
          chef_id: fullData.chef_id,
          people_served: fullData.people_served || 0,
          items: fullData.items.map((item: any) => ({
            item_id: item.item_id,
            quantity_used: item.quantity_used
          })),
        });
      } catch (err) {
        showError('Failed to fetch record details');
        return;
      }
    } else {
      setEditingConsumption(null);
      reset({
        usage_date: new Date().toISOString().split('T')[0],
        chef_id: 0,
        people_served: 0,
        items: [{ item_id: 0, quantity_used: 0 }],
      });
    }
    setOpen(true);
  };

  const handleView = async (consumption: any) => {
    try {
      const res = await api.get(`/consumptions/get_consumption/${consumption.id}`);
      setViewingConsumption(res.data);
      setViewDialogOpen(true);
    } catch (err) {
      showError('Failed to fetch record details');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEditingConsumption(null);
  };

  const onSubmit = async (data: ConsumptionFormValues) => {
    const confirmed = await showConfirm(
      editingConsumption ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingConsumption ? 'update' : 'save'} this usage record?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'entryId',
      header: 'ID',
      cell: info => <span className="text-text-main">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'usage_date',
      header: 'Date',
      cell: info => <span className="text-text-main">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'chef_id',
      header: 'Chef',
      cell: info => {
        const chef = chefOptions?.find((c: any) => c.id === info.getValue());
        return <span className="text-text-main">{chef ? (chef.chef_name || chef.name) : info.getValue() as string}</span>;
      }
    },
    {
      accessorKey: 'item_id',
      header: 'Item',
      cell: info => {
        const item = items?.find((i: any) => i.id === info.getValue());
        return <span className="text-text-main">{item ? item.item_name : info.getValue() as string}</span>;
      }
    },
    {
      accessorKey: 'quantity_used',
      header: 'Qty Used',
      cell: info => {
        const item = items?.find((i: any) => i.id === info.row.original.item_id);
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-text-main">{info.getValue() as number}</span>
            <span className="text-text-main">{item?.unit?.unit_code}</span>
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: "Actions",
      cell: info => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleView(info.row.original.entry)} className="action-btn-view">View</button>
          <button onClick={() => handleOpen(info.row.original.entry)} className="action-btn-edit">Edit</button>
          <button
            onClick={async () => {
              const confirmed = await showConfirm('Delete Record', `Are you sure you want to delete this usage record?`);
              if (confirmed) {
                deleteMutation.mutate(info.row.original.entry.id);
              }
            }}
            className="action-btn-delete"
          >
            Delete
          </button>
        </div>
      )
    }
  ], [chefOptions, items, deleteMutation, showConfirm]);

  const flattenedRows = useMemo(() => {
    if (!consumptions) return [];
    return consumptions.flatMap((c: any) => 
      c.items.map((item: any) => ({
        ...item,
        id: `c${c.id}-i${item.id}`,
        entryId: c.id,
        usage_date: c.usage_date,
        chef_id: c.chef_id,
        people_served: c.people_served,
        entry: c
      }))
    );
  }, [consumptions]);

    return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-text-main">Consumption Logs</h2>
        </div>
        <Button onClick={() => handleOpen()} className="text-text-main">
          New Entry
        </Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-text-main">Status</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main">Search Type</Label>
              <Select value={searchField} onChange={(e) => setSearchField(e.target.value)}>
                <option value="all">All Fields</option>
                <option value="chef">Chef Name</option>
                <option value="item">Item Name</option>
                <option value="id">Record ID</option>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-text-main">Search</Label>
              <div className="relative">
                <Input 
                  placeholder="Search usage records..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-text-main"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable 
        columns={columns} 
        data={flattenedRows} 
        loading={consumptionsLoading} 
      />

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh] border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">Usage Summary</DialogTitle>
            <DialogDescription className="sr-only">
              Detailed breakdown of items consumed and recorded in this entry.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-0 mt-4 px-2">
            <DetailItem label="Usage Date" value={viewingConsumption?.usage_date} />
            <DetailItem label="Chef in Charge" value={chefOptions?.find((c: any) => c.id === viewingConsumption?.chef_id)?.chef_name} />
            <DetailItem label="People Served" value={viewingConsumption?.people_served} />
            <DetailItem label="Recorded By" value={viewingConsumption?.user?.full_name} />
            
            <div className="pt-8 pb-3">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.2em] flex items-center gap-1">
                Items Consumed
              </span>
            </div>
            
            <div className="rounded-lg border border-border-temple/40 overflow-hidden">
               <table className="w-full text-[11px]">
                  <thead className="bg-gray-50 text-text-light font-bold uppercase tracking-widest">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Quantity</th>
                      <th className="px-3 py-2 text-right">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-temple/40">
                    {viewingConsumption?.items?.map((item: any, idx: number) => {
                      const itemData = items?.find((i: any) => i.id === item.item_id);
                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-normal text-gray-700">{itemData?.item_name}</td>
                          <td className="px-3 py-2 text-right font-normal text-gray-700">{item.quantity_used}</td>
                          <td className="px-3 py-2 text-right font-bold text-text-light">{itemData?.unit?.unit_code}</td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
            </div>
          </div>
          
          <DialogFooter className="mt-8 border-t border-border-temple/40 pt-4">
            <Button onClick={() => setViewDialogOpen(false)} className="bg-primary hover:bg-secondary text-white px-10">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingConsumption ? 'Edit Usage Record' : 'Log New Consumption'}</DialogTitle>
            <DialogDescription className="sr-only">
              {editingConsumption ? 'Update the details of an existing usage record.' : 'Enter details for daily item consumption in the kitchen.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(onSubmit)} className="temple-form">
            <div className="temple-form-section">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="temple-label">Chef In Charge *</Label>
                  <Controller
                    name="chef_id"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} className="temple-input">
                        <option value="">Select Chef</option>
                        {chefOptions.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.chef_name || c.name}</option>
                        ))}
                      </Select>
                    )}
                  />
                  {errors.chef_id && <p className="text-xs font-medium text-error ml-1">{errors.chef_id.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="temple-label">Usage Date *</Label>
                  <Input type="date" {...register('usage_date')} className="temple-input" />
                  {errors.usage_date && <p className="text-xs font-medium text-error ml-1">{errors.usage_date.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="temple-label">People Served</Label>
                  <Input type="number" {...register('people_served')} placeholder="Count" className="temple-input" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h4 className="temple-section-header flex items-center gap-2 mt-0">
                  Consumed Items List
                </h4>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="temple-form-section relative group">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                      <div className="sm:col-span-8 space-y-2">
                        <Label className="temple-label">Item Name *</Label>
                        <Controller
                          name={`items.${index}.item_id` as const}
                          control={control}
                          render={({ field: itemField }) => (
                            <Select {...itemField} className="temple-input">
                              <option value="">Select Item</option>
                              {items?.filter((i: any) => i.status === 1 || watchedItems?.[index]?.item_id === i.id).map((i: any) => (
                                <option key={i.id} value={i.id}>{i.item_name} ({i.unit?.unit_code})</option>
                              ))}
                            </Select>
                          )}
                        />
                      </div>
                      <div className="sm:col-span-3 space-y-2">
                        <Label className="temple-label">Qty Used *</Label>
                        <Input type="number" step="0.001" {...register(`items.${index}.quantity_used` as const)} className="temple-input" />
                      </div>
                      <div className="sm:col-span-1 flex justify-end pb-1">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-10 w-10 text-error hover:bg-error/10 rounded-xl"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end px-1 pt-2">
                <Button type="button" size="sm" variant="outline" onClick={() => append({ item_id: 0, quantity_used: 0 })} className="h-9 gap-2 font-bold text-xs rounded-xl border-primary/20 text-primary hover:bg-primary/5">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>

            <DialogFooter className="gap-3">
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

export default ConsumptionsPage;









