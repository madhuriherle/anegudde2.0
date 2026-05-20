import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

import { usePermission } from '../hooks/usePermission';

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
      qty_returned: z.coerce.number().min(0).default(0)
    })
  ).default({}),
  wastage_items: z.record(
    z.string(),
    z.object({
      quantity: z.coerce.number().min(0).default(0),
      approx_amount: z.coerce.number().min(0).default(0)
    })
  ).default({}),
  raw_wastage_items: z.array(z.object({
    serial_id: z.string().optional().default(''),
    item_id: z.coerce.number().min(1, 'Item is required'),
    quantity: z.coerce.number().min(0.001, 'Quantity is required')
  })).default([])
}).superRefine((data, ctx) => {
  const hasRaw = Object.values(data.raw_items || {}).some((v) => Number(v.quantity_used || 0) > 0 || Number(v.qty_returned || 0) > 0);
  const hasWastage = Object.values(data.wastage_items || {}).some((v) => Number(v?.quantity || 0) > 0);
  const hasRawWastage = (data.raw_wastage_items || []).some((v) => Number(v?.quantity || 0) > 0);
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
  Object.entries(data.raw_items || {}).forEach(([id, row]) => {
    if (Number(row.qty_returned || 0) > Number(row.quantity_used || 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Returned qty cannot be more than used qty`, path: ['raw_items', id, 'qty_returned'] });
    }
  });
});



const UsageEntriesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('consumptions.write');
  const canDelete = hasPermission('consumptions.delete');

  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingConsumption, setViewingConsumption] = useState(null);
  const [viewingWastages, setViewingWastages] = useState([]);
  const [viewingAdjustments, setViewingAdjustments] = useState([]);
  const [editingConsumption, setEditingConsumption] = useState(null);
  const [editingWastageEntryId, setEditingWastageEntryId] = useState(null);
  const [customDate, setCustomDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const { data: consumptionsData, isLoading: consumptionsLoading } = useQuery({
    queryKey: ['consumptions', customDate, page, pageSize],
    queryFn: async () => {
      const params = { page, page_size: pageSize };
      if (customDate) params.q = customDate;
      return (await api.get('/daily-usage/list_consumptions', { params })).data;
    }
  });
  const filteredConsumptions = useMemo(() => {
    return consumptionsData?.items || [];
  }, [consumptionsData]);

  const { data: itemsData } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => (await api.get('/items/list_items', { params: { page_size: 1000 } })).data
  });
  const items = useMemo(
    () => Array.isArray(itemsData) ? itemsData : itemsData?.items || [],
    [itemsData]
  );
  const { data: menuItemsData } = useQuery({
    queryKey: ['menu-items-list'],
    queryFn: async () => (await api.get('/menu-items/list_menu_items', { params: { page_size: 1000 } })).data
  });
  const menuItems = useMemo(
    () => Array.isArray(menuItemsData) ? menuItemsData : menuItemsData?.items || [],
    [menuItemsData]
  );
  const activeItems = useMemo(() => (items || []).filter((i) => i.status === 1), [items]);
  const activeMenuItems = useMemo(() => menuItems.filter((m) => m.status === 1), [menuItems]);

  const displayKannadaName = (name) => String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();

  const serialToItemIdMap = useMemo(() => {
    const map = new Map();
    activeItems.forEach((i) => {
      (i.serial_numbers || []).forEach((s) => {
        const serial = String(s?.serial_number || '').trim().toLowerCase();
        if (serial) map.set(serial, i.id);
      });
    });
    return map;
  }, [activeItems]);

  const buildRawDefaults = () =>
  Object.fromEntries(activeItems.map((it) => [String(it.id), { quantity_used: 0, qty_returned: 0 }]));
  const buildWastageDefaults = () =>
  Object.fromEntries(activeMenuItems.map((it) => [String(it.id), { quantity: 0, approx_amount: 0 }]));

  const { register, handleSubmit, reset, setValue, control, watch, formState: { errors } } = useForm({
    resolver: zodResolver(formSchema),
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
    }
  });

  const { fields: rawWastageFields, append: appendRawWastage, remove: removeRawWastage } = useFieldArray({
    control,
    name: "raw_wastage_items"
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const { isEditMode: _isEditMode, ...data } = payload;
      const rawRows = Object.entries(data.raw_items || {}).
      map(([id, row]) => ({
        item_id: Number(id),
        quantity_used: Number(row.quantity_used || 0),
        qty_returned: Number(row.qty_returned || 0)
      })).
      filter((r) => r.quantity_used > 0 || r.qty_returned > 0);

      const wastageRows = Object.entries(data.wastage_items || {}).
      map(([id, row]) => ({
        menu_item_id: Number(id),
        quantity: Number(row?.quantity || 0),
        approx_amount: Number(row?.approx_amount || 0)
      })).
      filter((r) => r.quantity > 0);

      const rawWastageRows = (data.raw_wastage_items || []).
      filter((r) => r.quantity > 0 && r.item_id > 0).
      map((r) => ({
        item_id: Number(r.item_id),
        quantity: Number(r.quantity),
        approx_amount: 0
      }));

      const allWastageItems = [
      ...wastageRows,
      ...rawWastageRows];


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
        items: rawRows
      };

      if (editingConsumption?.id) {
        saveRes = await api.put(`/daily-usage/update_consumption/${editingConsumption.id}`, commonPayload);
      } else {
        saveRes = await api.post('/daily-usage/create_consumption', commonPayload);
      }

      const consumptionId = saveRes.data.id;

      // 1. Sync Stock Adjustments (Raw Items)
      const adjustmentPayload = rawWastageRows.map((r) => ({
        item_id: r.item_id,
        adjustment_date: data.usage_date,
        adjusted_qty: r.quantity, // Backend expects positive, will negate it
        reason: `Linked to Usage Entry #${consumptionId}`
      }));

      if (adjustmentPayload.length > 0 || editingConsumption?.id) {
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
          items: wastageRows
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
    onError: (err) => {
      const detail = err?.response?.data?.detail;
      const message = Array.isArray(detail) ?
      detail.map((d) => d?.msg || d?.message || String(d)).join(', ') :
      typeof detail === 'string' ? detail : detail?.message || 'Failed to save entry';
      showError(message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/daily-usage/delete_consumption/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Usage record deleted');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Delete failed')
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

  const handleEdit = async (consumption) => {
    try {
      const [consumptionRes, wastageRes, adjustmentsRes] = await Promise.all([
      api.get(`/daily-usage/get_consumption/${consumption.id}`),
      api.get('/wastages/list_wastages', { params: { page_size: 1000 } }),
      api.get('/stock-adjustments/list_adjustments', { params: { consumption_entry_id: consumption.id } })]
      );

      const full = consumptionRes.data;
      const wastageRows = Array.isArray(wastageRes.data) ?
      wastageRes.data :
      wastageRes.data?.items || [];

      const matchedWastages = wastageRows.filter((w) => w.consumption_entry_id === full.id);
      const primaryWastage = matchedWastages.length > 0 ? matchedWastages[0] : null;

      const rawDefaults = buildRawDefaults();
      (full.items || []).forEach((it) => {
        rawDefaults[String(it.item_id)] = {
          quantity_used: Number(it.quantity_used || 0),
          qty_returned: Number(it.qty_returned || 0)
        };
      });

      const wastageDefaults = buildWastageDefaults();
      // Load Menu Items Wastage
      matchedWastages.forEach((w) => {
        (w.items || []).forEach((it) => {
          if (it.menu_item_id) {
            wastageDefaults[String(it.menu_item_id)] = {
              quantity: Number(it.quantity || 0),
              approx_amount: Number(it.approx_amount || 0)
            };
          }
        });
      });

      // Load Stock Adjustments (Raw Items)
      const rawWastageToLoad = (adjustmentsRes.data || []).map((adj) => ({
        item_id: adj.item_id,
        quantity: Math.abs(Number(adj.adjusted_qty || 0)),
        serial_id: items?.find((ri) => ri.id === adj.item_id)?.serial_numbers?.[0]?.serial_number || ''
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

  const handleView = async (consumption) => {
    try {
      const [consumptionRes, wastageRes, adjustmentsRes] = await Promise.all([
      api.get(`/daily-usage/get_consumption/${consumption.id}`),
      api.get('/wastages/list_wastages', { params: { page_size: 1000 } }),
      api.get('/stock-adjustments/list_adjustments', { params: { consumption_entry_id: consumption.id } })]
      );
      const fullConsumption = consumptionRes.data;
      const wastageRows = Array.isArray(wastageRes.data) ?
      wastageRes.data :
      wastageRes.data?.items || [];

      const menuWastages = wastageRows.
      filter((w) => w.consumption_entry_id === fullConsumption.id).
      flatMap((w) => (w.items || []).filter((it) => it.menu_item_id).map((it) => ({
        entryId: w.id,
        menu_item_name: it.menu_item?.dish_name || `Dish #${it.menu_item_id}`,
        unit_name: it.menu_item?.unit?.unit_name || '',
        unit_code: it.menu_item?.unit?.unit_code || '',
        quantity: it.quantity,
        approx_amount: it.approx_amount
      })));

      const rawAdjustments = (adjustmentsRes.data || []).map((adj) => ({
        entryId: adj.id,
        menu_item_name: items?.find((i) => i.id === adj.item_id)?.item_name || `Item #${adj.item_id}`,
        unit_name: items?.find((i) => i.id === adj.item_id)?.unit?.unit_name || '',
        unit_code: items?.find((i) => i.id === adj.item_id)?.unit?.unit_code || '',
        quantity: Math.abs(adj.adjusted_qty),
        approx_amount: null
      }));

      setViewingConsumption(fullConsumption);
      setViewingWastages(menuWastages);
      setViewingAdjustments(rawAdjustments);
      setViewDialogOpen(true);
    } catch {
      showError('Failed to fetch record details');
    }
  };

  const onSubmit = async (data) => {
    const confirmed = await showConfirm('Confirm Save', 'Save this combined consumption + wastage entry?');
    if (confirmed) saveMutation.mutate({ ...data, isEditMode: Boolean(editingConsumption) });
  };

  const columns = useMemo(() => [
  {
    accessorKey: 'usage_date',
    header: 'Date',
    cell: (i) => formatDate(i.getValue())
  },
  {
    id: 'total_cooking',
    header: 'Total Cooking Persons',
    cell: (i) =>
    Number(i.row.original.regular_cooking_persons || 0) +
    Number(i.row.original.additional_cooking_persons || 0)
  },
  {
    id: 'total_serving',
    header: 'Total Serving Persons',
    cell: (i) =>
    Number(i.row.original.regular_serving_persons || 0) +
    Number(i.row.original.additional_serving_persons || 0)
  },
  {
    id: 'total_cleaning',
    header: 'Total Cleaning Persons',
    cell: (i) =>
    Number(i.row.original.regular_cleaning_persons || 0) +
    Number(i.row.original.additional_cleaning_persons || 0)
  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: (info) =>
    <div className="flex items-center justify-center gap-2">
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          {canWrite && <button onClick={() => handleEdit(info.row.original)} className="action-btn-edit">Edit</button>}
          {canDelete && <button
        onClick={async () => {
          const confirmed = await showConfirm('Delete Entry', `Are you sure? This cannot be undone.`);
          if (confirmed) deleteMutation.mutate(info.row.original.id);
        }}
        className="action-btn-delete">
        
            Delete
          </button>}
        </div>

  }],
  [deleteMutation, showConfirm, canWrite, canDelete]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Daily Usage Entry</h2>
        {canWrite && <Button onClick={openNew} className="text-text-main">Add Usage Entry</Button>}
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
                className="text-text-main" />
              
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
        totalCount={consumptionsData?.total || 0} />
      

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[1840px] max-w-[96vw] max-h-[94vh] overflow-hidden border-border-temple p-0">
          <DialogHeader className="border-b border-border-temple/40 px-6 py-4 m-0">
            <DialogTitle className="text-text-main">Usage Summary</DialogTitle>
            <DialogDescription className="sr-only">Usage details</DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(94vh-150px)] overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-12 gap-6 items-start">
            <div className="temple-form-section min-w-0 2xl:col-span-3">
              <div className="pb-3">
                <span className="text-lg font-bold text-primary uppercase tracking-wider">Daily Service Details</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-4 text-base text-text-main">
                <div className="font-semibold">Usage Date</div><div className="text-right whitespace-nowrap">{formatDate(viewingConsumption?.usage_date)}</div>
                <div className="font-semibold">Regular Cooking Persons</div><div className="text-right">{Number(viewingConsumption?.regular_cooking_persons || 0)}</div>
                <div className="font-semibold">Additional Cooking Persons</div><div className="text-right">{Number(viewingConsumption?.additional_cooking_persons || 0)}</div>
                <div className="font-semibold">Total Cooking Persons</div><div className="text-right">{Number(viewingConsumption?.regular_cooking_persons || 0) + Number(viewingConsumption?.additional_cooking_persons || 0)}</div>
                <div className="font-semibold">Regular Serving Persons</div><div className="text-right">{Number(viewingConsumption?.regular_serving_persons || 0)}</div>
                <div className="font-semibold">Additional Serving Persons</div><div className="text-right">{Number(viewingConsumption?.additional_serving_persons || 0)}</div>
                <div className="font-semibold">Total Serving Persons</div><div className="text-right">{Number(viewingConsumption?.regular_serving_persons || 0) + Number(viewingConsumption?.additional_serving_persons || 0)}</div>
                <div className="font-semibold">Regular Cleaning Persons</div><div className="text-right">{Number(viewingConsumption?.regular_cleaning_persons || 0)}</div>
                <div className="font-semibold">Additional Cleaning Persons</div><div className="text-right">{Number(viewingConsumption?.additional_cleaning_persons || 0)}</div>
                <div className="font-semibold">Total Cleaning Persons</div><div className="text-right">{Number(viewingConsumption?.regular_cleaning_persons || 0) + Number(viewingConsumption?.additional_cleaning_persons || 0)}</div>
                <div className="font-semibold">No. of times cooked</div><div className="text-right">{viewingConsumption?.times_cooked ?? 0}</div>
              </div>
            </div>

            <div className="contents">
            <div className="temple-form-section min-w-0 2xl:col-span-3">
              <div className="pb-2">
                <span className="text-lg font-bold text-primary uppercase tracking-wider">Raw Usage Items</span>
              </div>
              <div className="rounded-md border border-border-temple overflow-hidden mt-1">
                <table className="w-full text-base text-left">
                  <thead className="bg-bg-temple text-text-main uppercase text-base font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3 border-b border-border-temple">Item</th>
                      <th className="px-4 py-3 border-b border-border-temple text-right">Used</th>
                      <th className="px-4 py-3 border-b border-border-temple text-right">Returned</th>
                    </tr>
                  </thead>
                  </table>
                <div>
                <table className="w-full text-base text-left">
                  <tbody className="divide-y divide-border-temple/40">
                    {(viewingConsumption?.items || []).filter((item) => Number(item.quantity_used || 0) > 0 || Number(item.qty_returned || 0) > 0).length === 0 ?
                          <tr>
                        <td colSpan={3} className="px-4 py-3 text-text-main/60 text-center text-sm">No raw items</td>
                      </tr> :

                          (viewingConsumption?.items || []).
                          filter((item) => Number(item.quantity_used || 0) > 0 || Number(item.qty_returned || 0) > 0).
                          map((item) =>
                          <tr key={item.id} className="hover:bg-bg-temple/30">
                          <td className="px-3 py-2 text-text-main">
                            <span className="text-base font-normal">
                              {displayKannadaName(item.item?.item_name || items?.find((it) => it.id === item.item_id)?.item_name || `Unknown Item (${item.item_id})`)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-text-main whitespace-nowrap">
                            {formatQuantityWithUnit(
                                item.quantity_used || 0,
                                item.item?.unit || items?.find((it) => it.id === item.item_id)?.unit
                              )}
                          </td>
                          <td className="px-3 py-2 text-right text-text-main whitespace-nowrap">
                            {formatQuantityWithUnit(
                                item.qty_returned || 0,
                                item.item?.unit || items?.find((it) => it.id === item.item_id)?.unit
                              )}
                          </td>
                        </tr>
                          )
                          }
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <div className="temple-form-section min-w-0 2xl:col-span-3">
              <div className="pb-2">
                <span className="text-lg font-bold text-primary uppercase tracking-wider">Wastage Entries</span>
              </div>
              <div className="rounded-md border border-border-temple overflow-hidden mt-1">
                <table className="w-full text-base text-left">
                  <thead className="bg-bg-temple text-text-main uppercase text-base font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3 border-b border-border-temple">Menu Item</th>
                      <th className="px-4 py-3 border-b border-border-temple text-right">Qty</th>
                      <th className="px-4 py-3 border-b border-border-temple text-right whitespace-nowrap">Approx Amt</th>
                    </tr>
                  </thead>
                  </table>
                <div>
                <table className="w-full text-base text-left">
                  <tbody className="divide-y divide-border-temple/40">
                    {viewingWastages.filter((w) => Number(w.quantity || 0) > 0).length === 0 ?
                          <tr>
                        <td colSpan={3} className="px-4 py-3 text-text-main/60 text-center text-sm">No linked wastage rows</td>
                      </tr> :

                          viewingWastages.
                          filter((w) => Number(w.quantity || 0) > 0).
                          map((w, idx) =>
                          <tr key={`${w.entryId}-${idx}`} className="hover:bg-bg-temple/30">
                          <td className="px-3 py-2 text-text-main">
                            <span className="text-base font-normal">
                              {displayKannadaName(w.menu_item_name)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-text-main whitespace-nowrap">
                            {formatQuantityWithUnit(w.quantity || 0, { unit_name: w.unit_name, unit_code: w.unit_code })}
                          </td>
                          <td className="px-3 py-2 text-right text-text-main whitespace-nowrap">
                            {w.approx_amount != null ? formatCurrency(Number(w.approx_amount || 0)) : '-'}
                          </td>
                        </tr>
                          )
                          }
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <div className="temple-form-section min-w-0 2xl:col-span-3">
            <div className="pb-2">
              <span className="text-lg font-bold text-primary uppercase tracking-wider">Stock Adjustments</span>
            </div>
            <div className="rounded-md border border-border-temple overflow-hidden mt-1 text-base">
              <div className="grid grid-cols-[1fr_auto] bg-bg-temple text-text-main uppercase text-xs font-bold tracking-wider border-b border-border-temple">
                <div className="px-4 py-3">Item</div>
                <div className="px-4 py-3 text-right whitespace-nowrap">Adjustment Qty</div>
              </div>
              <div>
              {viewingAdjustments.filter((a) => Number(a.quantity || 0) > 0).length === 0 ?
                      <div className="px-4 py-3 text-text-main/60 text-center text-sm">No stock adjustments</div> :

                      viewingAdjustments.
                      filter((a) => Number(a.quantity || 0) > 0).
                      map((a, idx) =>
                      <div
                        key={`${a.entryId}-${idx}`}
                        className="flex items-center justify-between gap-4 px-3 py-2 border-b border-border-temple/40 last:border-b-0 hover:bg-bg-temple/30">
                        
                      <span className="text-base font-normal text-text-main">{displayKannadaName(a.menu_item_name)}</span>
                      <span className="text-base font-semibold text-text-main whitespace-nowrap">
                        {formatQuantityWithUnit(a.quantity || 0, { unit_name: a.unit_name, unit_code: a.unit_code })}
                      </span>
                    </div>
                      )
                      }
              </div>
            </div>
            </div>
            </div>
          </div>
          </div>
          <DialogFooter className="m-0">
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
          className="w-[1760px] max-w-[94vw] max-h-[96vh] overflow-hidden p-0"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}>
          
          <DialogHeader className="m-0">
            <DialogTitle className="text-2xl font-bold font-temple">{editingConsumption ? 'Edit Usage Entry' : 'Add Usage Entry'}</DialogTitle>
            <DialogDescription className="sr-only">Create consumption and wastage entry</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-white px-6 pt-4 max-h-[calc(96vh-150px)] overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-10 gap-4 items-start min-h-[56vh]">
              <div className="temple-form-section min-w-0 2xl:col-span-3">
                <h4 className="temple-section-header mt-0 text-lg uppercase tracking-wider">Daily Service Details</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-[1fr_220px] items-center gap-3">
                  <Label className="temple-label leading-tight">Date *</Label>
                  <Input type="date" {...register('usage_date')} readOnly className="h-10 text-base bg-gray-100 cursor-not-allowed" />
                </div>
                <div className="grid grid-cols-[1fr_220px] items-center gap-3">
                  <Label className="temple-label leading-tight">No. of times cooked</Label>
                  <Input
                        type="text"
                        {...register('times_cooked')}
                        className="h-10 text-base"
                        onFocus={(e) => {
                          if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                            setValue('times_cooked', '');
                          }
                        }} />
                      
                </div>
                <div className="grid grid-cols-[1fr_220px] items-center gap-3">
                  <Label className="temple-label leading-tight">Regular Cooking Persons</Label>
                  <Input
                        type="text"
                        {...register('regular_cooking_persons')}
                        className="h-10 text-base"
                        onFocus={(e) => {
                          if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                            setValue('regular_cooking_persons', '');
                          }
                        }} />
                      
                </div>
                <div className="grid grid-cols-[1fr_220px] items-center gap-3">
                  <Label className="temple-label leading-tight">Additional Cooking Persons</Label>
                  <Input
                        type="text"
                        {...register('additional_cooking_persons')}
                        className="h-10 text-base"
                        onFocus={(e) => {
                          if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                            setValue('additional_cooking_persons', '');
                          }
                        }} />
                      
                </div>
                <div className="grid grid-cols-[1fr_220px] items-center gap-3">
                  <Label className="temple-label leading-tight">Regular Serving Persons</Label>
                  <Input
                        type="text"
                        {...register('regular_serving_persons')}
                        className="h-10 text-base"
                        onFocus={(e) => {
                          if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                            setValue('regular_serving_persons', '');
                          }
                        }} />
                      
                </div>
                <div className="grid grid-cols-[1fr_220px] items-center gap-3">
                  <Label className="temple-label leading-tight">Additional Serving Persons</Label>
                  <Input
                        type="text"
                        {...register('additional_serving_persons')}
                        className="h-10 text-base"
                        onFocus={(e) => {
                          if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                            setValue('additional_serving_persons', '');
                          }
                        }} />
                      
                </div>
                <div className="grid grid-cols-[1fr_220px] items-center gap-3">
                  <Label className="temple-label leading-tight">Regular Cleaning Persons</Label>
                  <Input
                        type="text"
                        {...register('regular_cleaning_persons')}
                        className="h-10 text-base"
                        onFocus={(e) => {
                          if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                            setValue('regular_cleaning_persons', '');
                          }
                        }} />
                      
                </div>
                <div className="grid grid-cols-[1fr_220px] items-center gap-3">
                  <Label className="temple-label leading-tight">Additional Cleaning Persons</Label>
                  <Input
                        type="text"
                        {...register('additional_cleaning_persons')}
                        className="h-10 text-base"
                        onFocus={(e) => {
                          if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                            setValue('additional_cleaning_persons', '');
                          }
                        }} />
                      
                </div>
                </div>
              </div>

              <div className="temple-form-section min-w-0 2xl:col-span-3">
                <h4 className="temple-section-header mt-0 text-lg uppercase tracking-wider">Item usage</h4>
                <div className="grid grid-cols-12 gap-2 mb-1 px-1 border-b border-border-temple/10 pb-1">
                  <div className="col-span-6"></div>
                  <div className="col-span-3 text-base font-bold text-text-main uppercase">Used</div>
                  <div className="col-span-3 text-base font-bold text-text-main uppercase">Returned</div>
                </div>
                <div className="pr-2 space-y-2">
                  {(items || []).filter((i) => i.status === 1).map((item) => {
                      const itemError = errors.raw_items?.[item.id];
                      return (
                        <div key={item.id} className="grid grid-cols-12 gap-2 items-center min-h-[32px]">
                        <div className="col-span-6 text-base font-medium text-text-main leading-6">
                          {item.item_name}{item.unit?.unit_code ? ` (${item.unit.unit_code})` : ''}
                        </div>
                        <div className="col-span-3">
                          <Input
                              type="text"
                              className={cn("h-10 text-base", itemError?.quantity_used && "border-red-500")}
                              {...register(`raw_items.${item.id}.quantity_used`)}
                              onFocus={(e) => {
                                if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                                  setValue(`raw_items.${item.id}.quantity_used`, '');
                                }
                              }} />
                            
                        </div>
                        <div className="col-span-3">
                          <Input
                              type="text"
                              className={cn("h-10 text-base", itemError?.qty_returned && "border-red-500 bg-red-50")}
                              {...register(`raw_items.${item.id}.qty_returned`)}
                              onFocus={(e) => {
                                if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                                  setValue(`raw_items.${item.id}.qty_returned`, '');
                                }
                              }} />
                            
                          {itemError?.qty_returned &&
                            <p className="text-sm text-red-500 font-black leading-tight mt-0.5 uppercase">Exceeds Used</p>
                            }
                        </div>
                      </div>);

                    })}
                </div>
              </div>

              <div className="temple-form-section min-w-0 xl:col-span-2 2xl:col-span-4">
                <h4 className="temple-section-header mt-0 text-lg uppercase tracking-wider">Menu Item Wastage</h4>
                <div className="grid grid-cols-12 gap-2 mb-1 px-1 border-b border-border-temple/10 pb-1">
                  <div className="col-span-6"></div>
                  <div className="col-span-3 text-base font-bold text-text-main uppercase">Qty</div>
                  <div className="col-span-3 text-base font-bold text-text-main uppercase">Approx Amt</div>
                </div>
                <div className="pr-2 space-y-3">
                  {/* Menu Items Wastage */}
                  <div className="space-y-2">
                    {(menuItems || []).filter((m) => m.status === 1).map((menu) =>
                      <div key={menu.id} className="grid grid-cols-12 gap-2 items-center min-h-[32px]">
                        <div className="col-span-6 text-base font-medium text-text-main leading-6">
                          {menu.dish_name}{menu.unit?.unit_code ? ` (${menu.unit.unit_code})` : ''}
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="text"
                            className="h-10 text-base"
                            {...register(`wastage_items.${menu.id}.quantity`)}
                            onFocus={(e) => {
                              if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                                setValue(`wastage_items.${menu.id}.quantity`, '');
                              }
                            }} />
                          
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="text"
                            className="h-10 text-base"
                            {...register(`wastage_items.${menu.id}.approx_amount`)}
                            onFocus={(e) => {
                              if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                                setValue(`wastage_items.${menu.id}.approx_amount`, '');
                              }
                            }} />
                          
                        </div>
                      </div>
                      )}
                  </div>

                  {/* Raw Items Wastage */}
                  <div className="space-y-2 mt-6 pt-2">
                    <h5 className="text-lg font-bold uppercase tracking-wider text-primary">Stock Adjustment</h5>
                    {rawWastageFields.length > 0 &&
                      <div className="grid grid-cols-12 gap-2 items-center px-2">
                        <div className="col-span-4">
                          <Label className="text-sm block">Item Code</Label>
                        </div>
                        <div className="col-span-4">
                          <Label className="text-sm block">Item Name</Label>
                        </div>
                        <div className="col-span-3">
                          <Label className="text-sm block">Adjustment Qty</Label>
                        </div>
                        <div className="col-span-1" />
                      </div>
                      }
                    {rawWastageFields.map((field, index) =>
                      <div key={field.id} className="grid grid-cols-12 gap-2 items-center bg-bg-temple/20 p-2 rounded border border-border-temple/20 min-h-[42px]">
                        <div className="col-span-4">
                          <Input
                            type="text"
                            className="h-10 text-base bg-white"

                            {...register(`raw_wastage_items.${index}.serial_id`)}
                            onChange={(e) => {
                              const serialRaw = e.target.value || '';
                              const normalized = serialRaw.trim().toLowerCase();
                              const matchedItemId = serialToItemIdMap.get(normalized) || 0;

                              setValue(`raw_wastage_items.${index}.serial_id`, serialRaw);

                              if (normalized && matchedItemId > 0) {
                                // Match found: Update selection
                                setValue(`raw_wastage_items.${index}.item_id`, matchedItemId, { shouldValidate: true });
                              } else if (!normalized || !matchedItemId) {
                                // No match or empty: CLEAR selection
                                setValue(`raw_wastage_items.${index}.item_id`, 0, { shouldValidate: true });
                              }
                            }} />
                          
                        </div>
                        <div className="col-span-4">
                          <Controller
                            name={`raw_wastage_items.${index}.item_id`}
                            control={control}
                            render={({ field: selectField }) =>
                            <Select
                              {...selectField}
                              className="h-10 text-base bg-white">
                              
                                <option value={0} disabled hidden>Select Item</option>
                                {activeItems.map((i) =>
                              <option key={i.id} value={i.id}>{i.item_name}</option>
                              )}
                              </Select>
                            } />
                          
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="text"
                            className="h-10 w-full text-base bg-white"
                            {...register(`raw_wastage_items.${index}.quantity`)}
                            onFocus={(e) => {
                              if (e.target.value === '0') {
                                setValue(`raw_wastage_items.${index}.quantity`, '');
                              }
                            }} />
                          
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRawWastage(index)}
                            className="h-10 w-10 p-0 text-error hover:bg-error/10">
                            
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      )}
                  </div>

                  <div className="pt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => appendRawWastage({ serial_id: '', item_id: 0, quantity: 0 })}
                        className="h-10 px-3 text-sm bg-primary-main/20 text-primary-main hover:bg-primary-main/30 border border-primary-main/30 font-bold">
                        
                      <Plus className="w-4 h-4 mr-1" />
                      Raw Item
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Robust Error Display */}
            {Object.keys(errors).length > 0 &&
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-700 font-black mb-2 uppercase tracking-[0.2em]">Validation Alerts ({Object.keys(errors).length})</p>
                <ul className="space-y-1.5">
                  {Object.entries(errors).map(([key, error]) => {
                    const messages = [];

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
                      Object.entries(error).forEach(([id, itemErr]) => {
                        if (id === 'message' || id === 'root' || id === 'types') return;

                        // Find the item name for either Usage or Wastage list
                        const itemName = items?.find((i) => String(i.id) === id)?.item_name ||
                        menuItems?.find((m) => String(m.id) === id)?.dish_name;

                        // Extract the error message from the nested structure
                        const actualErr = itemErr.qty_returned || itemErr.quantity_used || itemErr.quantity || itemErr.approx_amount || itemErr;
                        if (actualErr?.message) {
                          messages.push(
                            itemName ? <><strong className="uppercase">{itemName}</strong>: {actualErr.message}</> : actualErr.message
                          );
                        }
                      });
                    }

                    return messages.map((m, i) =>
                    <li key={`${key}-${i}`} className="text-sm text-red-600 font-bold flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-red-600" />
                        {m}
                      </li>
                    );
                  })}
                </ul>
              </div>
              }

            </div>

            <DialogFooter className="gap-3 m-0">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2]">Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="w-28 h-10 text-text-main">
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>);

};

export default UsageEntriesPage;
