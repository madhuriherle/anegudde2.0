import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/Dialog';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { formatQuantityWithUnit } from '../utils/quantity';
import { cn } from '../utils/cn';
import { Plus, Trash2 } from 'lucide-react';

const formSchema = z.object({
  usage_date: z.string().min(1, 'Date is required'),
  regular_cooking_persons: z.coerce.number().min(0).default(0),
  additional_cooking_persons: z.coerce.number().min(0).default(0),
  regular_cleaning_persons: z.coerce.number().min(0).default(0),
  additional_cleaning_persons: z.coerce.number().min(0).default(0),
  regular_serving_persons: z.coerce.number().min(0).default(0),
  additional_serving_persons: z.coerce.number().min(0).default(0),
  times_cooked: z.coerce.number().min(0).default(0),
  raw_items: z.record(
    z.string(),
    z.object({
      quantity_used: z.coerce.number().min(0).default(0),
      qty_returned: z.coerce.number().min(0).default(0),
    })
  ).default({}),
  wastage_items: z.record(
    z.string(),
    z.object({
      quantity: z.coerce.number().min(0).default(0),
      approx_amount: z.coerce.number().min(0).default(0),
    })
  ).default({}),
  raw_wastage_items: z.array(z.object({
    serial_id: z.string().optional().default(''),
    item_id: z.coerce.number().min(1, 'Item is required'),
    quantity: z.coerce.number().min(0.001, 'Quantity is required'),
  })).default([]),
}).superRefine((data, ctx) => {
  const hasRaw = Object.values(data.raw_items || {}).some((v: any) => Number(v.quantity_used || 0) > 0 || Number(v.qty_returned || 0) > 0);
  const hasWastage = Object.values(data.wastage_items || {}).some((v: any) => Number(v?.quantity || 0) > 0);
  const hasRawWastage = (data.raw_wastage_items || []).some((v: any) => Number(v?.quantity || 0) > 0);
  const hasManpower =
    Number(data.regular_cooking_persons || 0) > 0 ||
    Number(data.additional_cooking_persons || 0) > 0 ||
    Number(data.regular_serving_persons || 0) > 0 ||
    Number(data.additional_serving_persons || 0) > 0 ||
    Number(data.regular_cleaning_persons || 0) > 0 ||
    Number(data.additional_cleaning_persons || 0) > 0;
  const hasTimesCooked = Number(data.times_cooked || 0) > 0;
  if (!hasRaw && !hasWastage && !hasRawWastage && !hasManpower && !hasTimesCooked) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter at least one value before saving', path: ['raw_items'] });
  }
  Object.entries(data.raw_items || {}).forEach(([id, row]: any) => {
    if (Number(row.qty_returned || 0) > Number(row.quantity_used || 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Returned qty cannot be more than used qty`, path: ['raw_items', id, 'qty_returned'] });
    }
  });
});

type FormValues = z.infer<typeof formSchema>;

const UsageEntriesPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();
  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingConsumption, setViewingConsumption] = useState<any>(null);
  const [viewingWastages, setViewingWastages] = useState<any[]>([]);
  const [viewingAdjustments, setViewingAdjustments] = useState<any[]>([]);
  const [editingConsumption, setEditingConsumption] = useState<any>(null);
  const [editingWastageEntryId, setEditingWastageEntryId] = useState<number | null>(null);
  const [customDate, setCustomDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const { data: consumptionsData, isLoading: consumptionsLoading } = useQuery({
    queryKey: ['consumptions', customDate, page, pageSize],
    queryFn: async () => {
      const params: any = { page, page_size: pageSize };
      if (customDate) params.q = customDate;
      return (await api.get('/daily-usage/list_consumptions', { params })).data;
    },
  });
  const filteredConsumptions = useMemo(() => {
    return consumptionsData?.items || [];
  }, [consumptionsData]);

  const { data: itemsData } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => (await api.get('/items/list_items', { params: { page_size: 1000 } })).data,
  });
  const items = useMemo(
    () => (Array.isArray(itemsData) ? itemsData : (itemsData?.items || [])),
    [itemsData]
  );
  const { data: menuItemsData } = useQuery({
    queryKey: ['menu-items-list'],
    queryFn: async () => (await api.get('/menu-items/list_menu_items', { params: { page_size: 1000 } })).data,
  });
  const menuItems = useMemo(
    () => (Array.isArray(menuItemsData) ? menuItemsData : (menuItemsData?.items || [])),
    [menuItemsData]
  );
  const activeItems = useMemo(() => (items || []).filter((i: any) => i.status === 1), [items]);
  const activeMenuItems = useMemo(() => menuItems.filter((m: any) => m.status === 1), [menuItems]);

  const displayKannadaName = (name: string) => String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();

  const serialToItemIdMap = useMemo(() => {
    const map = new Map<string, number>();
    activeItems.forEach((i: any) => {
      (i.serial_numbers || []).forEach((s: any) => {
        const serial = String(s?.serial_number || '').trim().toLowerCase();
        if (serial) map.set(serial, i.id);
      });
    });
    return map;
  }, [activeItems]);

  const buildRawDefaults = () =>
    Object.fromEntries((activeItems).map((it: any) => [String(it.id), { quantity_used: 0, qty_returned: 0 }]));
  const buildWastageDefaults = () =>
    Object.fromEntries((activeMenuItems).map((it: any) => [String(it.id), { quantity: 0, approx_amount: 0 }]));

  const { register, handleSubmit, reset, setValue, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    mode: 'onChange',
    defaultValues: {
      usage_date: new Date().toISOString().split('T')[0],
      regular_cooking_persons: 0,
      additional_cooking_persons: 0,
      regular_cleaning_persons: 0,
      additional_cleaning_persons: 0,
      regular_serving_persons: 0,
      additional_serving_persons: 0,
      times_cooked: 0,
      raw_items: {},
      wastage_items: {},
      raw_wastage_items: []
    },
  });

  const { fields: rawWastageFields, append: appendRawWastage, remove: removeRawWastage } = useFieldArray({
    control,
    name: "raw_wastage_items"
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: FormValues & { isEditMode?: boolean }) => {
      const { isEditMode: _isEditMode, ...data } = payload;
      const rawRows = Object.entries(data.raw_items || {})
        .map(([id, row]: any) => ({
          item_id: Number(id),
          quantity_used: Number(row.quantity_used || 0),
          qty_returned: Number(row.qty_returned || 0),
        }))
        .filter((r) => r.quantity_used > 0 || r.qty_returned > 0);

      const wastageRows = Object.entries(data.wastage_items || {})
        .map(([id, row]: any) => ({
          menu_item_id: Number(id),
          quantity: Number(row?.quantity || 0),
          approx_amount: Number(row?.approx_amount || 0),
        }))
        .filter((r) => r.quantity > 0);

      const rawWastageRows = (data.raw_wastage_items || [])
        .filter((r) => r.quantity > 0 && r.item_id > 0)
        .map((r) => ({
          item_id: Number(r.item_id),
          quantity: Number(r.quantity),
          approx_amount: 0,
        }));

      const allWastageItems = [
        ...wastageRows,
        ...rawWastageRows
      ];

      let saveRes;
      const commonPayload = {
        usage_date: data.usage_date,
        regular_cooking_persons: Number(data.regular_cooking_persons || 0),
        additional_cooking_persons: Number(data.additional_cooking_persons || 0),
        regular_cleaning_persons: Number(data.regular_cleaning_persons || 0),
        additional_cleaning_persons: Number(data.additional_cleaning_persons || 0),
        regular_serving_persons: Number(data.regular_serving_persons || 0),
        additional_serving_persons: Number(data.additional_serving_persons || 0),
        times_cooked: Number(data.times_cooked || 0),
        user_id: user?.id,
        status: 1,
        items: rawRows,
      };

      if (editingConsumption?.id) {
        saveRes = await api.put(`/daily-usage/update_consumption/${editingConsumption.id}`, commonPayload);
      } else {
        saveRes = await api.post('/daily-usage/create_consumption', commonPayload);
      }

      const consumptionId = saveRes.data.id;

      // 1. Sync Stock Adjustments (Raw Items)
      const adjustmentPayload = rawWastageRows.map(r => ({
        item_id: r.item_id,
        adjustment_date: data.usage_date,
        adjusted_qty: r.quantity, // Backend expects positive, will negate it
        reason: `Linked to Usage Entry #${consumptionId}`
      }));
      
      if (adjustmentPayload.length > 0 || (editingConsumption?.id)) {
        // Always sync if editing to handle removals
        await api.post(`/stock-adjustments/sync_for_consumption/${consumptionId}`, adjustmentPayload);
      }

      // 2. Sync Wastage (Menu Items)
      if (wastageRows.length > 0) {
        const wastagePayload = {
          wastage_date: data.usage_date,
          consumption_entry_id: consumptionId,
          times_cooked: Number(data.times_cooked || 0),
          user_id: user?.id,
          status: 1,
          items: wastageRows,
        };

        if (editingConsumption?.id && editingWastageEntryId) {
          await api.put(`/wastages/update_wastage/${editingWastageEntryId}`, wastagePayload);
        } else {
          await api.post('/wastages/create_wastage', wastagePayload);
        }
      } else if (editingConsumption?.id && editingWastageEntryId) {
        await api.delete(`/wastages/delete_wastage/${editingWastageEntryId}`);
      }
    },
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['wastages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess(variables?.isEditMode ? 'Entry updated' : 'Combined entry saved');
      setOpen(false);
      setEditingConsumption(null);
      setEditingWastageEntryId(null);
      reset({
        usage_date: new Date().toISOString().split('T')[0],
        regular_cooking_persons: 0,
        additional_cooking_persons: 0,
        regular_cleaning_persons: 0,
        additional_cleaning_persons: 0,
        regular_serving_persons: 0,
        additional_serving_persons: 0,
        times_cooked: 0,
        raw_items: buildRawDefaults(),
        wastage_items: buildWastageDefaults(),
        raw_wastage_items: []
      });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d?.msg || d?.message || String(d)).join(', ')
        : (typeof detail === 'string' ? detail : (detail?.message || 'Failed to save entry'));
      showError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/daily-usage/delete_consumption/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Usage record deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const openNew = () => {
    setEditingConsumption(null);
    setEditingWastageEntryId(null);
    reset({
      usage_date: new Date().toISOString().split('T')[0],
      regular_cooking_persons: 0,
      additional_cooking_persons: 0,
      regular_cleaning_persons: 0,
      additional_cleaning_persons: 0,
      regular_serving_persons: 0,
      additional_serving_persons: 0,
      times_cooked: 0,
      raw_items: buildRawDefaults(),
      wastage_items: buildWastageDefaults(),
      raw_wastage_items: []
    });
    setOpen(true);
  };

  const handleEdit = async (consumption: any) => {
    try {
      const [consumptionRes, wastageRes, adjustmentsRes] = await Promise.all([
        api.get(`/daily-usage/get_consumption/${consumption.id}`),
        api.get('/wastages/list_wastages', { params: { page_size: 1000 } }),
        api.get('/stock-adjustments/list_adjustments', { params: { consumption_entry_id: consumption.id } }),
      ]);
      
      const full = consumptionRes.data;
      const wastageRows = Array.isArray(wastageRes.data)
        ? wastageRes.data
        : (wastageRes.data?.items || []);
      
      const matchedWastages = wastageRows.filter((w: any) => w.consumption_entry_id === full.id);
      const primaryWastage = matchedWastages.length > 0 ? matchedWastages[0] : null;
      
      const rawDefaults = buildRawDefaults();
      (full.items || []).forEach((it: any) => {
        rawDefaults[String(it.item_id)] = {
          quantity_used: Number(it.quantity_used || 0),
          qty_returned: Number(it.qty_returned || 0),
        };
      });

      const wastageDefaults = buildWastageDefaults();
      // Load Menu Items Wastage
      matchedWastages.forEach((w: any) => {
        (w.items || []).forEach((it: any) => {
          if (it.menu_item_id) {
            wastageDefaults[String(it.menu_item_id)] = {
              quantity: Number(it.quantity || 0),
              approx_amount: Number(it.approx_amount || 0),
            };
          }
        });
      });

      // Load Stock Adjustments (Raw Items)
      const rawWastageToLoad = (adjustmentsRes.data || []).map((adj: any) => ({
        item_id: adj.item_id,
        quantity: Math.abs(Number(adj.adjusted_qty || 0)),
        serial_id: items?.find((ri: any) => ri.id === adj.item_id)?.serial_numbers?.[0]?.serial_number || ''
      }));

      setEditingConsumption(full);
      setEditingWastageEntryId(primaryWastage?.id ?? null);
      reset({
        usage_date: full.usage_date,
        regular_cooking_persons: Number(full.regular_cooking_persons || 0),
        additional_cooking_persons: Number(full.additional_cooking_persons || 0),
        regular_cleaning_persons: Number(full.regular_cleaning_persons || 0),
        additional_cleaning_persons: Number(full.additional_cleaning_persons || 0),
        regular_serving_persons: Number(full.regular_serving_persons || 0),
        additional_serving_persons: Number(full.additional_serving_persons || 0),
        times_cooked: Number(full.times_cooked || 0),
        raw_items: rawDefaults,
        wastage_items: wastageDefaults,
        raw_wastage_items: rawWastageToLoad
      });
      setOpen(true);
    } catch {
      showError('Failed to fetch record for edit');
    }
  };

  const handleView = async (consumption: any) => {
    try {
      const [consumptionRes, wastageRes, adjustmentsRes] = await Promise.all([
        api.get(`/daily-usage/get_consumption/${consumption.id}`),
        api.get('/wastages/list_wastages', { params: { page_size: 1000 } }),
        api.get('/stock-adjustments/list_adjustments', { params: { consumption_entry_id: consumption.id } }),
      ]);
      const fullConsumption = consumptionRes.data;
      const wastageRows = Array.isArray(wastageRes.data)
        ? wastageRes.data
        : (wastageRes.data?.items || []);
      
      const menuWastages = wastageRows
        .filter((w: any) => w.consumption_entry_id === fullConsumption.id)
        .flatMap((w: any) => (w.items || []).filter((it: any) => it.menu_item_id).map((it: any) => ({
          entryId: w.id,
          menu_item_name: it.menu_item?.dish_name || `Dish #${it.menu_item_id}`,
          unit_name: it.menu_item?.unit?.unit_name || '',
          unit_code: it.menu_item?.unit?.unit_code || '',
          quantity: it.quantity,
          approx_amount: it.approx_amount,
        })));

      const rawAdjustments = (adjustmentsRes.data || []).map((adj: any) => ({
        entryId: adj.id,
        menu_item_name: items?.find((i: any) => i.id === adj.item_id)?.item_name || `Item #${adj.item_id}`,
        unit_name: items?.find((i: any) => i.id === adj.item_id)?.unit?.unit_name || '',
        unit_code: items?.find((i: any) => i.id === adj.item_id)?.unit?.unit_code || '',
        quantity: Math.abs(adj.adjusted_qty),
        approx_amount: null,
      }));

      setViewingConsumption(fullConsumption);
      setViewingWastages(menuWastages);
      setViewingAdjustments(rawAdjustments);
      setViewDialogOpen(true);
    } catch {
      showError('Failed to fetch record details');
    }
  };

  const onSubmit = async (data: FormValues) => {
    const confirmed = await showConfirm('Confirm Save', 'Save this combined consumption + wastage entry?');
    if (confirmed) saveMutation.mutate({ ...data, isEditMode: Boolean(editingConsumption) });
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'usage_date',
      header: 'Date',
      cell: (i) => formatDate(i.getValue() as string),
    },
    {
      id: 'total_cooking',
      header: 'Total Cooking Persons',
      cell: (i) =>
        Number(i.row.original.regular_cooking_persons || 0) +
        Number(i.row.original.additional_cooking_persons || 0),
    },
    {
      id: 'total_serving',
      header: 'Total Serving Persons',
      cell: (i) =>
        Number(i.row.original.regular_serving_persons || 0) +
        Number(i.row.original.additional_serving_persons || 0),
    },
    {
      id: 'total_cleaning',
      header: 'Total Cleaning Persons',
      cell: (i) =>
        Number(i.row.original.regular_cleaning_persons || 0) +
        Number(i.row.original.additional_cleaning_persons || 0),
    },
    {
      id: 'actions',
      header: () => <div className="text-center">Actions</div>,
      cell: info => (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          <button onClick={() => handleEdit(info.row.original)} className="action-btn-edit">Edit</button>
          <button
            onClick={async () => {
              const confirmed = await showConfirm('Delete Entry', `Are you sure? This cannot be undone.`);
              if (confirmed) deleteMutation.mutate(info.row.original.id);
            }}
            className="action-btn-delete"
          >
            Delete
          </button>
        </div>
      )
    }
  ], [deleteMutation, showConfirm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Daily Usage Entry</h2>
        <Button onClick={openNew} className="text-text-main">Add Usage Entry</Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1.5 w-full sm:w-56">
              <Label className="text-text-main">Date</Label>
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="text-text-main"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredConsumptions}
        loading={consumptionsLoading}
        manualPagination
        pageCount={consumptionsData?.total_pages || 0}
        pageIndex={page - 1}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
        totalCount={consumptionsData?.total || 0}
      />

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-[92vw] overflow-y-auto max-h-[92vh] border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">Usage Summary</DialogTitle>
            <DialogDescription className="sr-only">Usage details</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 px-2 items-start">
            <div className="temple-form-section h-full">
              <div className="grid grid-cols-[240px_20px_1fr] gap-y-3 text-text-main">
                <div className="font-semibold whitespace-nowrap">Usage Date</div><div>:</div><div className="whitespace-nowrap">{formatDate(viewingConsumption?.usage_date)}</div>
                <div className="font-semibold whitespace-nowrap">Regular Cooking Persons</div><div>:</div><div>{Number(viewingConsumption?.regular_cooking_persons || 0)}</div>
                <div className="font-semibold whitespace-nowrap">Additional Cooking Persons</div><div>:</div><div>{Number(viewingConsumption?.additional_cooking_persons || 0)}</div>
                <div className="font-semibold whitespace-nowrap">Total Cooking Persons</div><div>:</div><div>{Number(viewingConsumption?.regular_cooking_persons || 0) + Number(viewingConsumption?.additional_cooking_persons || 0)}</div>
                <div className="font-semibold whitespace-nowrap">Regular Serving Persons</div><div>:</div><div>{Number(viewingConsumption?.regular_serving_persons || 0)}</div>
                <div className="font-semibold whitespace-nowrap">Additional Serving Persons</div><div>:</div><div>{Number(viewingConsumption?.additional_serving_persons || 0)}</div>
                <div className="font-semibold whitespace-nowrap">Total Serving Persons</div><div>:</div><div>{Number(viewingConsumption?.regular_serving_persons || 0) + Number(viewingConsumption?.additional_serving_persons || 0)}</div>
                <div className="font-semibold whitespace-nowrap">Regular Cleaning Persons</div><div>:</div><div>{Number(viewingConsumption?.regular_cleaning_persons || 0)}</div>
                <div className="font-semibold whitespace-nowrap">Additional Cleaning Persons</div><div>:</div><div>{Number(viewingConsumption?.additional_cleaning_persons || 0)}</div>
                <div className="font-semibold whitespace-nowrap">Total Cleaning Persons</div><div>:</div><div>{Number(viewingConsumption?.regular_cleaning_persons || 0) + Number(viewingConsumption?.additional_cleaning_persons || 0)}</div>
                <div className="font-semibold whitespace-nowrap">No. of times cooked</div><div>:</div><div>{viewingConsumption?.times_cooked ?? 0}</div>
              </div>
            </div>

            <div className="contents">
            <div className="temple-form-section">
              <div className="pb-2">
                <span className="text-base font-bold text-text-main">Raw Usage Items</span>
              </div>
              <div className="rounded-md border border-border-temple overflow-hidden mt-1">
                <table className="w-full text-sm text-left">
                  <thead className="bg-bg-temple text-text-main uppercase text-xs font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3 border-b border-border-temple">Item</th>
                      <th className="px-4 py-3 border-b border-border-temple text-right">Used</th>
                      <th className="px-4 py-3 border-b border-border-temple text-right">Returned</th>
                    </tr>
                  </thead>
                  </table>
                <div className="max-h-[640px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <tbody className="divide-y divide-border-temple/40">
                    {(viewingConsumption?.items || []).filter((item: any) => Number(item.quantity_used || 0) > 0 || Number(item.qty_returned || 0) > 0).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-text-main/60 text-center">No raw items</td>
                      </tr>
                    ) : (
                      (viewingConsumption?.items || [])
                        .filter((item: any) => Number(item.quantity_used || 0) > 0 || Number(item.qty_returned || 0) > 0)
                        .map((item: any) => (
                        <tr key={item.id} className="hover:bg-bg-temple/30">
                          <td className="px-3 py-2 text-text-main">{displayKannadaName(item.item?.item_name || items?.find((it: any) => it.id === item.item_id)?.item_name || `Unknown Item (${item.item_id})`)}</td>
                          <td className="px-3 py-2 text-right text-text-main whitespace-nowrap">
                            {formatQuantityWithUnit(
                              item.quantity_used || 0,
                              item.item?.unit || items?.find((it: any) => it.id === item.item_id)?.unit
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-text-main whitespace-nowrap">
                            {formatQuantityWithUnit(
                              item.qty_returned || 0,
                              item.item?.unit || items?.find((it: any) => it.id === item.item_id)?.unit
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <div className="temple-form-section">
              <div className="pb-2">
                <span className="text-base font-bold text-text-main">Wastage Entries</span>
              </div>
              <div className="rounded-md border border-border-temple overflow-hidden mt-1">
                <table className="w-full text-sm text-left">
                  <thead className="bg-bg-temple text-text-main uppercase text-xs font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3 border-b border-border-temple">Menu Item</th>
                      <th className="px-4 py-3 border-b border-border-temple text-right">Qty</th>
                      <th className="px-4 py-3 border-b border-border-temple text-right whitespace-nowrap">Approx Amt</th>
                    </tr>
                  </thead>
                  </table>
                <div className="max-h-[640px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <tbody className="divide-y divide-border-temple/40">
                    {viewingWastages.filter((w: any) => Number(w.quantity || 0) > 0).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-text-main/60 text-center">No linked wastage rows</td>
                      </tr>
                    ) : (
                      viewingWastages
                        .filter((w: any) => Number(w.quantity || 0) > 0)
                        .map((w: any, idx: number) => (
                        <tr key={`${w.entryId}-${idx}`} className="hover:bg-bg-temple/30">
                          <td className="px-3 py-2 text-text-main">
                            {displayKannadaName(w.menu_item_name)}
                          </td>
                          <td className="px-3 py-2 text-right text-text-main whitespace-nowrap">
                            {formatQuantityWithUnit(w.quantity || 0, { unit_name: w.unit_name, unit_code: w.unit_code })}
                          </td>
                          <td className="px-3 py-2 text-right text-text-main whitespace-nowrap">
                            {w.approx_amount != null ? formatCurrency(Number(w.approx_amount || 0)) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <div className="temple-form-section">
            <div className="pb-2">
              <span className="text-base font-bold text-text-main">Stock Adjustments</span>
            </div>
            <div className="rounded-md border border-border-temple overflow-hidden mt-1 text-sm">
              <div className="grid grid-cols-[1fr_auto] bg-bg-temple text-text-main uppercase text-xs font-bold tracking-wider border-b border-border-temple">
                <div className="px-4 py-3">Item</div>
                <div className="px-4 py-3 text-right whitespace-nowrap">Adjustment Qty</div>
              </div>
              <div className="max-h-[640px] overflow-y-auto">
              {viewingAdjustments.filter((a: any) => Number(a.quantity || 0) > 0).length === 0 ? (
                <div className="px-4 py-3 text-text-main/60 text-center">No stock adjustments</div>
              ) : (
                viewingAdjustments
                  .filter((a: any) => Number(a.quantity || 0) > 0)
                  .map((a: any, idx: number) => (
                    <div
                      key={`${a.entryId}-${idx}`}
                      className="flex items-center justify-between gap-4 px-3 py-2 border-b border-border-temple/40 last:border-b-0 hover:bg-bg-temple/30"
                    >
                      <span className="text-text-main">{displayKannadaName(a.menu_item_name)}</span>
                      <span className="font-semibold text-text-main whitespace-nowrap">
                        {formatQuantityWithUnit(a.quantity || 0, { unit_name: a.unit_name, unit_code: a.unit_code })}
                      </span>
                    </div>
                  ))
              )}
              </div>
            </div>
            </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button onClick={() => setViewDialogOpen(false)} className="text-text-main">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(val) => {
        // Only allow closing if NOT loading
        if (!val && !saveMutation.isPending) {
          setOpen(false);
        }
      }}>
        <DialogContent 
          className="max-w-[92vw] overflow-y-auto max-h-[92vh]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editingConsumption ? 'Edit Usage Entry' : 'Add Usage Entry'}</DialogTitle>
            <DialogDescription className="sr-only">Create consumption and wastage entry</DialogDescription>
          </DialogHeader>

          <div className="bg-white -mx-6 px-6 pt-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-10 gap-4 items-stretch min-h-[56vh]">
              <div className="temple-form-section h-full xl:col-span-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                  <Label className="temple-label whitespace-nowrap">Date *</Label>
                  <Input type="date" {...register('usage_date')} readOnly className="h-8 text-xs bg-gray-100 cursor-not-allowed" />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label whitespace-nowrap">No. of times cooked</Label>
                  <Input 
                    type="text" 
                    {...register('times_cooked')} 
                    className="h-8 text-xs" 
                    onFocus={(e) => {
                      if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                        setValue('times_cooked', '' as any);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label whitespace-nowrap">Regular Cooking Persons</Label>
                  <Input 
                    type="text" 
                    {...register('regular_cooking_persons')} 
                    className="h-8 text-xs" 
                    onFocus={(e) => {
                      if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                        setValue('regular_cooking_persons', '' as any);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label whitespace-nowrap">Additional Cooking Persons</Label>
                  <Input 
                    type="text" 
                    {...register('additional_cooking_persons')} 
                    className="h-8 text-xs" 
                    onFocus={(e) => {
                      if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                        setValue('additional_cooking_persons', '' as any);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label whitespace-nowrap">Regular Serving Persons</Label>
                  <Input 
                    type="text" 
                    {...register('regular_serving_persons')} 
                    className="h-8 text-xs" 
                    onFocus={(e) => {
                      if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                        setValue('regular_serving_persons', '' as any);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label whitespace-nowrap">Additional Serving Persons</Label>
                  <Input 
                    type="text" 
                    {...register('additional_serving_persons')} 
                    className="h-8 text-xs" 
                    onFocus={(e) => {
                      if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                        setValue('additional_serving_persons', '' as any);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label whitespace-nowrap">Regular Cleaning Persons</Label>
                  <Input 
                    type="text" 
                    {...register('regular_cleaning_persons')} 
                    className="h-8 text-xs" 
                    onFocus={(e) => {
                      if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                        setValue('regular_cleaning_persons', '' as any);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="temple-label whitespace-nowrap">Additional Cleaning Persons</Label>
                  <Input 
                    type="text" 
                    {...register('additional_cleaning_persons')} 
                    className="h-8 text-xs" 
                    onFocus={(e) => {
                      if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                        setValue('additional_cleaning_persons', '' as any);
                      }
                    }}
                  />
                </div>
                </div>
              </div>

              <div className="temple-form-section h-full xl:col-span-3">
                <h4 className="temple-section-header mt-0 uppercase tracking-wider">Item usage</h4>
                <div className="grid grid-cols-12 gap-2 mb-1 px-1 border-b border-border-temple/10 pb-1">
                  <div className="col-span-6"></div>
                  <div className="col-span-3 text-[10px] font-bold text-text-main uppercase">Used</div>
                  <div className="col-span-3 text-[10px] font-bold text-text-main uppercase">Returned</div>
                </div>
                <div className="max-h-[45vh] overflow-y-auto pr-2 space-y-2">
                  {(items || []).filter((i: any) => i.status === 1).map((item: any) => {
                    const itemError = (errors.raw_items as any)?.[item.id];
                    return (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-center min-h-[32px]">
                        <div className="col-span-6 text-sm font-medium text-text-main leading-5">
                          {item.item_name}{item.unit?.unit_code ? ` (${item.unit.unit_code})` : ''}
                        </div>
                        <div className="col-span-3">
                          <Input 
                            type="text" 
                            className={cn("h-8 text-xs", itemError?.quantity_used && "border-red-500")} 
                            {...register(`raw_items.${item.id}.quantity_used` as const)} 
                            onFocus={(e) => {
                              if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                                setValue(`raw_items.${item.id}.quantity_used` as any, '' as any);
                              }
                            }}
                          />
                        </div>
                        <div className="col-span-3">
                          <Input 
                            type="text" 
                            className={cn("h-8 text-xs", itemError?.qty_returned && "border-red-500 bg-red-50")} 
                            {...register(`raw_items.${item.id}.qty_returned` as const)} 
                            onFocus={(e) => {
                              if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                                setValue(`raw_items.${item.id}.qty_returned` as any, '' as any);
                              }
                            }}
                          />
                          {itemError?.qty_returned && (
                             <p className="text-[8px] text-red-500 font-black leading-tight mt-0.5 uppercase tracking-tighter">Exceeds Used</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="temple-form-section h-full xl:col-span-4">
                <h4 className="temple-section-header mt-0 uppercase tracking-wider">Menu Item Wastage</h4>
                <div className="grid grid-cols-12 gap-2 mb-1 px-1 border-b border-border-temple/10 pb-1">
                  <div className="col-span-6"></div>
                  <div className="col-span-3 text-[10px] font-bold text-text-main uppercase">Qty</div>
                  <div className="col-span-3 text-[10px] font-bold text-text-main uppercase">Approx Amt</div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-3">
                  {/* Menu Items Wastage */}
                  <div className="space-y-2">
                    {(menuItems || []).filter((m: any) => m.status === 1).map((menu: any) => (
                      <div key={menu.id} className="grid grid-cols-12 gap-2 items-center min-h-[32px]">
                        <div className="col-span-6 text-sm font-medium text-text-main leading-5">
                          {menu.dish_name}{menu.unit?.unit_code ? ` (${menu.unit.unit_code})` : ''}
                        </div>
                        <div className="col-span-3">
                          <Input 
                            type="text" 
                            className="h-8 text-xs" 
                            {...register(`wastage_items.${menu.id}.quantity` as const)} 
                            onFocus={(e) => {
                              if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                                setValue(`wastage_items.${menu.id}.quantity` as any, '' as any);
                              }
                            }}
                          />
                        </div>
                        <div className="col-span-3">
                          <Input 
                            type="text" 
                            className="h-8 text-xs" 
                            {...register(`wastage_items.${menu.id}.approx_amount` as const)} 
                            onFocus={(e) => {
                              if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                                setValue(`wastage_items.${menu.id}.approx_amount` as any, '' as any);
                              }
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Raw Items Wastage */}
                  <div className="space-y-2 mt-6 pt-2">
                    <h5 className="text-xs font-bold uppercase tracking-wide text-primary">Stock Adjustment</h5>
                    {rawWastageFields.length > 0 && (
                      <div className="grid grid-cols-12 gap-2 items-center px-2">
                        <div className="col-span-4">
                          <Label className="text-[10px] block">Item Code</Label>
                        </div>
                        <div className="col-span-4">
                          <Label className="text-[10px] block">Item Name</Label>
                        </div>
                        <div className="col-span-3">
                          <Label className="text-[10px] block">Adjustment Qty</Label>
                        </div>
                        <div className="col-span-1" />
                      </div>
                    )}
                    {rawWastageFields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-12 gap-2 items-center bg-bg-temple/20 p-2 rounded border border-border-temple/20 min-h-[42px]">
                        <div className="col-span-4">
                          <Input
                            type="text"
                            className="h-8 text-[11px] bg-white"
                           
                            {...register(`raw_wastage_items.${index}.serial_id` as const)}
                            onChange={(e) => {
                              const serialRaw = e.target.value || '';
                              const normalized = serialRaw.trim().toLowerCase();
                              const matchedItemId = serialToItemIdMap.get(normalized) || 0;
                              
                              setValue(`raw_wastage_items.${index}.serial_id` as const, serialRaw);
                              
                              if (normalized && matchedItemId > 0) {
                                // Match found: Update selection
                                setValue(`raw_wastage_items.${index}.item_id` as const, matchedItemId, { shouldValidate: true });
                              } else if (!normalized || !matchedItemId) {
                                // No match or empty: CLEAR selection
                                setValue(`raw_wastage_items.${index}.item_id` as const, 0, { shouldValidate: true });
                              }
                            }}
                          />
                        </div>
                        <div className="col-span-4">
                          <Controller
                            name={`raw_wastage_items.${index}.item_id` as const}
                            control={control}
                            render={({ field: selectField }) => (
                              <Select 
                                {...selectField} 
                                className="h-8 text-[11px] bg-white"
                              >
                                <option value={0} disabled hidden>Select Item</option>
                                {activeItems.map((i: any) => (
                                  <option key={i.id} value={i.id}>{i.item_name}</option>
                                ))}
                              </Select>
                            )}
                          />
                        </div>
                        <div className="col-span-3">
                          <Input 
                            type="text" 
                            className="h-8 w-[120px] text-xs bg-white" 
                            {...register(`raw_wastage_items.${index}.quantity` as const)}
                            onFocus={(e) => {
                              if (e.target.value === '0') {
                                setValue(`raw_wastage_items.${index}.quantity` as const, '' as any);
                              }
                            }}
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeRawWastage(index)}
                            className="h-8 w-8 p-0 text-error hover:bg-error/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => appendRawWastage({ serial_id: '', item_id: 0, quantity: 0 })}
                      className="h-8 px-3 text-xs bg-primary-main/20 text-primary-main hover:bg-primary-main/30 border border-primary-main/30 font-bold"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Raw Item
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Robust Error Display */}
            {Object.keys(errors).length > 0 && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-[10px] text-red-700 font-black mb-2 uppercase tracking-[0.2em]">Validation Alerts ({Object.keys(errors).length})</p>
                <ul className="space-y-1.5">
                  {Object.entries(errors).map(([key, error]: [string, any]) => {
                    const messages: React.ReactNode[] = [];

                    // 1. Handle Field-level errors (Date, Persons, or top-level raw_items error)
                    if (error.message) {
                      messages.push(error.message);
                    }
                    
                    // 2. Handle nested Root errors (Added via superRefine)
                    if (error.root?.message) {
                      messages.push(error.root.message);
                    }

                    // 3. Handle Item-specific errors (Usage or Wastage rows)
                    if (typeof error === 'object' && key !== 'raw_wastage_items') {
                      Object.entries(error).forEach(([id, itemErr]: [string, any]) => {
                        if (id === 'message' || id === 'root' || id === 'types') return;
                        
                        // Find the item name for either Usage or Wastage list
                        const itemName = items?.find(i => String(i.id) === id)?.item_name || 
                                         menuItems?.find(m => String(m.id) === id)?.dish_name;
                        
                        // Extract the error message from the nested structure
                        const actualErr = itemErr.qty_returned || itemErr.quantity_used || itemErr.quantity || itemErr.approx_amount || itemErr;
                        if (actualErr?.message) {
                           messages.push(
                             itemName ? <><strong className="uppercase">{itemName}</strong>: {actualErr.message}</> : actualErr.message
                           );
                        }
                      });
                    }

                    return messages.map((m, i) => (
                      <li key={`${key}-${i}`} className="text-[11px] text-red-600 font-bold flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-red-600" />
                        {m}
                      </li>
                    ));
                  })}
                </ul>
              </div>
            )}

            <DialogFooter className="gap-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2]">Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="w-28 h-10 text-text-main">
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsageEntriesPage;
