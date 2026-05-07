import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/Dialog';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { DetailItem } from '../components/ui/DetailItem';

const formSchema = z.object({
  usage_date: z.string().min(1, 'Date is required'),
  regular_cooking_persons: z.coerce.number().min(0).default(0),
  additional_cooking_persons: z.coerce.number().min(0).default(0),
  regular_cleaning_persons: z.coerce.number().min(0).default(0),
  additional_cleaning_persons: z.coerce.number().min(0).default(0),
  regular_serving_persons: z.coerce.number().min(0).default(0),
  additional_serving_persons: z.coerce.number().min(0).default(0),
  raw_items: z.record(
    z.string(),
    z.object({
      quantity_used: z.coerce.number().min(0).default(0),
      qty_returned: z.coerce.number().min(0).default(0),
    })
  ).default({}),
  wastage_items: z.record(z.string(), z.coerce.number().min(0).default(0)).default({}),
}).superRefine((data, ctx) => {
  const hasRaw = Object.values(data.raw_items || {}).some((v: any) => Number(v.quantity_used || 0) > 0 || Number(v.qty_returned || 0) > 0);
  const hasWastage = Object.values(data.wastage_items || {}).some((v: any) => Number(v || 0) > 0);
  if (!hasRaw && !hasWastage) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter at least one raw quantity or one wastage quantity', path: ['raw_items'] });
  }
  Object.entries(data.raw_items || {}).forEach(([id, row]: any) => {
    if (Number(row.qty_returned || 0) > Number(row.quantity_used || 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Returned cannot exceed used for raw item ${id}`, path: ['raw_items', id, 'qty_returned'] });
    }
  });
});

type FormValues = z.infer<typeof formSchema>;

const ConsumptionsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();
  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingConsumption, setViewingConsumption] = useState<any>(null);
  const [status, setStatus] = useState<string>('all');
  const [searchField, setSearchField] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: consumptions, isLoading: consumptionsLoading } = useQuery({
    queryKey: ['consumptions', search, status, searchField],
    queryFn: async () => {
      const params: any = { q: search, page_size: 1000 };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      if (searchField !== 'all') params.search_field = searchField;
      return (await api.get('/consumptions/list_consumptions', { params })).data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => (await api.get('/items/list_items')).data,
  });

  const { data: menuItems } = useQuery({
    queryKey: ['menu-items-list'],
    queryFn: async () => (await api.get('/menu-items/list_menu_items')).data,
  });

  const buildRawDefaults = () =>
    Object.fromEntries((items || []).map((it: any) => [String(it.id), { quantity_used: 0, qty_returned: 0 }]));
  const buildWastageDefaults = () =>
    Object.fromEntries((menuItems || []).map((it: any) => [String(it.id), 0]));

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      usage_date: new Date().toISOString().split('T')[0],
      regular_cooking_persons: 0,
      additional_cooking_persons: 0,
      regular_cleaning_persons: 0,
      additional_cleaning_persons: 0,
      regular_serving_persons: 0,
      additional_serving_persons: 0,
      raw_items: {},
      wastage_items: {},
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const rawRows = Object.entries(data.raw_items || {})
        .map(([id, row]: any) => ({
          item_id: Number(id),
          quantity_used: Number(row.quantity_used || 0),
          qty_returned: Number(row.qty_returned || 0),
        }))
        .filter((r) => r.quantity_used > 0 || r.qty_returned > 0);

      const wastageRows = Object.entries(data.wastage_items || {})
        .map(([id, qty]) => ({
          menu_item_id: Number(id),
          quantity: Number(qty || 0),
        }))
        .filter((r) => r.quantity > 0);

      const calls: Promise<any>[] = [];
      if (rawRows.length > 0) {
        calls.push(api.post('/consumptions/create_consumption', {
          usage_date: data.usage_date,
          regular_cooking_persons: Number(data.regular_cooking_persons || 0),
          additional_cooking_persons: Number(data.additional_cooking_persons || 0),
          regular_cleaning_persons: Number(data.regular_cleaning_persons || 0),
          additional_cleaning_persons: Number(data.additional_cleaning_persons || 0),
          regular_serving_persons: Number(data.regular_serving_persons || 0),
          additional_serving_persons: Number(data.additional_serving_persons || 0),
          anna_remained: 0,
          saru_remained: 0,
          huli_remained: 0,
          payas_remained: 0,
          people_served: null,
          items: rawRows,
          user_id: user?.id,
          status: 1,
        }));
      }
      if (wastageRows.length > 0) {
        calls.push(api.post('/wastages/create_wastage', {
          wastage_date: data.usage_date,
          reason: 'Combined consumption entry',
          user_id: user?.id,
          status: 1,
          items: wastageRows,
        }));
      }
      await Promise.all(calls);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['wastages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Combined entry saved');
      setOpen(false);
      reset({
        usage_date: new Date().toISOString().split('T')[0],
        regular_cooking_persons: 0,
        additional_cooking_persons: 0,
        regular_cleaning_persons: 0,
        additional_cleaning_persons: 0,
        regular_serving_persons: 0,
        additional_serving_persons: 0,
        raw_items: buildRawDefaults(),
        wastage_items: buildWastageDefaults(),
      });
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Failed to save entry');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/consumptions/delete_consumption/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Usage record deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const openNew = () => {
    reset({
      usage_date: new Date().toISOString().split('T')[0],
      regular_cooking_persons: 0,
      additional_cooking_persons: 0,
      regular_cleaning_persons: 0,
      additional_cleaning_persons: 0,
      regular_serving_persons: 0,
      additional_serving_persons: 0,
      raw_items: buildRawDefaults(),
      wastage_items: buildWastageDefaults(),
    });
    setOpen(true);
  };

  const handleView = async (consumption: any) => {
    try {
      const res = await api.get(`/consumptions/get_consumption/${consumption.id}`);
      setViewingConsumption(res.data);
      setViewDialogOpen(true);
    } catch {
      showError('Failed to fetch record details');
    }
  };

  const onSubmit = async (data: FormValues) => {
    const confirmed = await showConfirm('Confirm Save', 'Save this combined consumption + wastage entry?');
    if (confirmed) saveMutation.mutate(data);
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'usage_date', header: 'Date' },
    { id: 'raw_count', header: 'Raw Rows', cell: (i) => i.row.original.items?.length || 0 },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          <button
            onClick={async () => {
              const ok = await showConfirm('Delete Record', 'Delete this usage record?');
              if (ok) deleteMutation.mutate(info.row.original.id);
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
        <h2 className="text-text-main">Consumption Logs</h2>
        <Button onClick={openNew} className="text-text-main">New Combined Entry</Button>
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
                <option value="item">Item Name</option>
                <option value="id">Record ID</option>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-text-main">Search</Label>
              <Input placeholder="Search usage records..." value={search} onChange={(e) => setSearch(e.target.value)} className="text-text-main" />
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={consumptions || []} loading={consumptionsLoading} />

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh] border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">Usage Summary</DialogTitle>
            <DialogDescription className="sr-only">Consumption details</DialogDescription>
          </DialogHeader>
          <div className="space-y-0 mt-4 px-2">
            <DetailItem label="Usage Date" value={viewingConsumption?.usage_date} />
            <DetailItem label="Recorded By" value={viewingConsumption?.user?.full_name} />
          </div>
          <DialogFooter className="mt-6">
            <Button onClick={() => setViewDialogOpen(false)} className="text-text-main">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(val) => !val && setOpen(false)}>
        <DialogContent className="max-w-6xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>New Combined Entry</DialogTitle>
            <DialogDescription className="sr-only">Create consumption and wastage entry</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="temple-form-section">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                <div className="space-y-1">
                  <Label className="temple-label">Usage Date *</Label>
                  <Input type="date" {...register('usage_date')} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label">Regular Cooking</Label>
                  <Input type="text" {...register('regular_cooking_persons')} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label">Additional Cooking</Label>
                  <Input type="text" {...register('additional_cooking_persons')} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label">Regular Cleaning</Label>
                  <Input type="text" {...register('regular_cleaning_persons')} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label">Additional Cleaning</Label>
                  <Input type="text" {...register('additional_cleaning_persons')} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label">Regular Serving</Label>
                  <Input type="text" {...register('regular_serving_persons')} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label">Additional Serving</Label>
                  <Input type="text" {...register('additional_serving_persons')} className="h-8 text-xs" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="temple-form-section">
                <h4 className="temple-section-header mt-0">Raw Items (From DB)</h4>
                <div className="max-h-[45vh] overflow-y-auto pr-2 space-y-2">
                  {(items || []).filter((i: any) => i.status === 1).map((item: any) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-6 text-xs text-text-main">{item.item_name} ({item.unit?.unit_code})</div>
                      <div className="col-span-3">
                        <Label className="text-[10px]">Used</Label>
                        <Input type="text" className="h-8 text-xs" {...register(`raw_items.${item.id}.quantity_used` as const)} />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-[10px]">Returned</Label>
                        <Input type="text" className="h-8 text-xs" {...register(`raw_items.${item.id}.qty_returned` as const)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="temple-form-section">
                <h4 className="temple-section-header mt-0">Wastage Menu Items (From DB)</h4>
                <div className="max-h-[45vh] overflow-y-auto pr-2 space-y-2">
                  {(menuItems || []).filter((m: any) => m.status === 1).map((menu: any) => (
                    <div key={menu.id} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-8 text-xs text-text-main">{menu.dish_name} ({menu.unit?.unit_code})</div>
                      <div className="col-span-4">
                        <Label className="text-[10px]">Qty</Label>
                        <Input type="text" className="h-8 text-xs" {...register(`wastage_items.${menu.id}` as const)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {errors.raw_items?.message && <p className="text-xs text-error">{errors.raw_items.message as string}</p>}
            {Object.keys(errors).length > 0 && !errors.raw_items?.message && <p className="text-xs text-error">Please correct invalid values.</p>}

            <DialogFooter className="gap-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2]">Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="w-28 h-10 text-text-main">
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsumptionsPage;
