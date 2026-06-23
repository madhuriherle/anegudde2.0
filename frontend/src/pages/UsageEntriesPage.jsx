import React, { useMemo, useState, useEffect, useRef } from 'react';
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
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { QtyDisplay } from '../components/ui/QtyDisplay';
import { formatDate, getTodayDateInput } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { formatQuantityWithUnit } from '../utils/quantity';
import { cn } from '../utils/cn';
import { Plus, Trash2, Clock, History, X, Search } from 'lucide-react';

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
      quantity_used: z.coerce.number().min(0).default(0)
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
    operation: z.enum(['add', 'deduct']).default('deduct'),
    quantity: z.coerce.number().positive('Qty must be greater than 0')
  })).default([])
}).superRefine((data, ctx) => {
  const hasRaw = Object.values(data.raw_items || {}).some((v) => Number(v.quantity_used || 0) > 0);
  const hasWastage = Object.values(data.wastage_items || {}).some((v) => Number(v?.quantity || 0) > 0);
  const hasRawWastage = (data.raw_wastage_items || []).some((v) => Number(v?.quantity || 0) !== 0);
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
});



const UsageEntriesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('daily_usage.write');
  const canDelete = hasPermission('daily_usage.delete');
  const canReadUsage = hasPermission('daily_usage.read');
  const canWriteUsage = hasPermission('daily_usage.write');
  const canReadActivityLogs = hasPermission('daily_usage.read');

  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewTab, setViewTab] = useState('raw');
  const [viewingConsumption, setViewingConsumption] = useState(null);
  const [viewingWastages, setViewingWastages] = useState([]);
  const [viewingAdjustments, setViewingAdjustments] = useState([]);
  const [editingConsumption, setEditingConsumption] = useState(null);
  const [editingWastageEntryId, setEditingWastageEntryId] = useState(null);
  const [customDate, setCustomDate] = useState(getTodayDateInput());
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const activityDrawerRef = useRef(null);

  const [usageSearchQuery, setUsageSearchQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setUsageSearchQuery('');
    }
  }, [open]);

  const { data: consumptionsData, isLoading: consumptionsLoading } = useQuery({
    queryKey: ['consumptions', customDate, page, pageSize],
    queryFn: async () => {
      const params = { page, page_size: pageSize };
      if (customDate) params.q = customDate;
      return (await api.get('/daily-usage/list_consumptions', { params })).data;
    }
  });

  React.useEffect(() => {
    if (!activityExpanded) return undefined;

    const handleOutsideClick = (event) => {
      if (
        activityDrawerRef.current &&
        !activityDrawerRef.current.contains(event.target)
      ) {
        setActivityExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [activityExpanded]);

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['daily-usage-activities'],
    queryFn: async () => {
      const res = await api.get('/audit/page_activity', { params: { page: 'daily_usage', page_size: 20 } });
      return res.data?.items || [];
    },
    enabled: !!canReadActivityLogs,
    retry: false,
    refetchInterval: 15000
  });

  const getActivityMeta = (log) => {
    if (log.method === 'POST') {
      return { title: 'Usage Entry Added', verb: 'created' };
    }
    if (log.method === 'PUT') {
      return { title: 'Usage Entry Edited', verb: 'updated' };
    }
    return { title: 'Usage Entry Deleted', verb: 'deleted' };
  };

  const getActivitySentenceParts = (log) => {
    const { verb } = getActivityMeta(log);
    const actorName = log.meta?.actor_name || log.username || 'System';
    const usageDate = log.meta?.usage_date ? formatDate(log.meta.usage_date) : null;
    return { actorName, actionText: `${verb} daily usage`, targetName: usageDate, targetPrefix: ' for ' };
  };

  const formatActivityDay = (value) => {
    const activityDate = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (isSameDay(activityDate, today)) return 'Today';
    if (isSameDay(activityDate, yesterday)) return 'Yesterday';
    return activityDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const groupedActivityData = useMemo(() => {
    return (activityData || []).reduce((groups, log) => {
      const day = formatActivityDay(log.activity_at);
      if (!groups[day]) groups[day] = [];
      groups[day].push(log);
      return groups;
    }, {});
  }, [activityData]);
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
    queryKey: ['menu-items'],
    queryFn: async () => (await api.get('/menu-items/list_menu_items', { params: { page_size: 1000 } })).data
  });
  const menuItems = useMemo(
    () => Array.isArray(menuItemsData) ? menuItemsData : menuItemsData?.items || [],
    [menuItemsData]
  );
  const activeItems = useMemo(() => {
    const list = (items || []).filter((i) => i.status === 1);
    return [...list].sort((a, b) => {
      const codeA = (a.serial_numbers || []).find((s) => Number(s?.status ?? 1) === 1)?.serial_number || '';
      const codeB = (b.serial_numbers || []).find((s) => Number(s?.status ?? 1) === 1)?.serial_number || '';
      const numA = parseInt(codeA, 10);
      const numB = parseInt(codeB, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });
  }, [items]);
  const activeMenuItems = useMemo(() => menuItems.filter((m) => m.status === 1), [menuItems]);

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
  Object.fromEntries(activeItems.map((it) => [String(it.id), { quantity_used: 0 }]));
  const buildWastageDefaults = () =>
  Object.fromEntries(activeMenuItems.map((it) => [String(it.id), { quantity: 0, approx_amount: it.default_approx_amount ?? 0 }]));

  const { register, handleSubmit, reset, setValue, control, watch, formState: { errors } } = useForm({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      usage_date: getTodayDateInput(),
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
        quantity_used: Number(row.quantity_used || 0)
      })).
      filter((r) => r.quantity_used > 0);

      const wastageRows = Object.entries(data.wastage_items || {}).
      map(([id, row]) => ({
        menu_item_id: Number(id),
        quantity: Number(row?.quantity || 0),
        approx_amount: Number(row?.approx_amount || 0)
      })).
      filter((r) => r.quantity > 0);

      const rawWastageRows = (data.raw_wastage_items || []).
      filter((r) => Number(r.quantity || 0) > 0 && r.item_id > 0).
      map((r) => ({
        item_id: Number(r.item_id),
        operation: r.operation === 'deduct' ? 'deduct' : 'add',
        quantity: Math.abs(Number(r.quantity)),
        approx_amount: 0
      }));

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
        adjusted_qty: r.operation === 'deduct' ? -Math.abs(Number(r.quantity)) : Math.abs(Number(r.quantity)),
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
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showSuccess(variables?.isEditMode ? 'Entry updated' : 'Combined entry saved');
      setOpen(false);
      setEditingConsumption(null);
      setEditingWastageEntryId(null);
      reset({
        usage_date: getTodayDateInput(),
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
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showSuccess('Usage record deleted');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Delete failed')
  });

  const openNew = () => {
    setEditingConsumption(null);
    setEditingWastageEntryId(null);
    reset({
      usage_date: getTodayDateInput(),
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
      const [consumptionRes, wastageRes, adjustmentsRes] = await Promise.allSettled([
        api.get(`/daily-usage/get_consumption/${consumption.id}`),
        api.get('/wastages/list_wastages', { params: { page_size: 1000 } }),
        api.get('/stock-adjustments/list_adjustments', { params: { consumption_entry_id: consumption.id } })
      ]);

      if (consumptionRes.status !== 'fulfilled') {
        throw new Error('Failed to fetch consumption');
      }

      const full = consumptionRes.value.data;
      const wastageRows = wastageRes.status === 'fulfilled'
        ? (Array.isArray(wastageRes.value.data) ? wastageRes.value.data : wastageRes.value.data?.items || [])
        : [];

      const matchedWastages = wastageRows.filter((w) => w.consumption_entry_id === full.id);
      const primaryWastage = matchedWastages.length > 0 ? matchedWastages[0] : null;

      const rawDefaults = buildRawDefaults();
      (full.items || []).forEach((it) => {
        rawDefaults[String(it.item_id)] = {
          quantity_used: Number(it.quantity_used || 0)
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
      const adjustmentRows = adjustmentsRes.status === 'fulfilled' ? (adjustmentsRes.value.data || []) : [];
      const rawWastageToLoad = adjustmentRows.map((adj) => ({
        item_id: adj.item_id,
        operation: Number(adj.adjusted_qty || 0) < 0 ? 'deduct' : 'add',
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
      const [consumptionRes, wastageRes, adjustmentsRes] = await Promise.allSettled([
        api.get(`/daily-usage/get_consumption/${consumption.id}`),
        api.get('/wastages/list_wastages', { params: { page_size: 1000 } }),
        api.get('/stock-adjustments/list_adjustments', { params: { consumption_entry_id: consumption.id } })
      ]);

      if (consumptionRes.status !== 'fulfilled') {
        throw new Error('Failed to fetch consumption');
      }

      const fullConsumption = consumptionRes.value.data;
      const wastageRows = wastageRes.status === 'fulfilled'
        ? (Array.isArray(wastageRes.value.data) ? wastageRes.value.data : wastageRes.value.data?.items || [])
        : [];

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

      const adjustmentRows = adjustmentsRes.status === 'fulfilled' ? (adjustmentsRes.value.data || []) : [];
      const rawAdjustments = adjustmentRows.map((adj) => ({
        entryId: adj.id,
        menu_item_name: items?.find((i) => i.id === adj.item_id)?.item_name || `Item #${adj.item_id}`,
        unit_name: items?.find((i) => i.id === adj.item_id)?.unit?.unit_name || '',
        unit_code: items?.find((i) => i.id === adj.item_id)?.unit?.unit_code || '',
        quantity: Number(adj.adjusted_qty || 0),
        approx_amount: null
      }));

      setViewingConsumption(fullConsumption);
      setViewingWastages(menuWastages);
      setViewingAdjustments(rawAdjustments);
      setViewTab('raw');
      setViewDialogOpen(true);
    } catch {
      showError('Failed to fetch record details');
    }
  };

  const onSubmit = async (data) => {
    const invalidDeduction = (data.raw_wastage_items || []).find((row) => {
      if (row.operation !== 'deduct') return false;
      const item = activeItems.find((i) => i.id === Number(row.item_id));
      const available = Number(item?.current_stock || 0);
      return Number(row.quantity || 0) > available;
    });

    if (invalidDeduction) {
      const item = activeItems.find((i) => i.id === Number(invalidDeduction.item_id));
      showError(`Deduct qty exceeds available stock for ${item?.item_name || 'selected item'}`);
      return;
    }

    const confirmed = await showConfirm('Confirm Save', 'Save this combined consumption + wastage entry?');
    if (confirmed) saveMutation.mutate({ ...data, isEditMode: Boolean(editingConsumption) });
  };

  const columns = useMemo(() => [
  {
    accessorKey: 'usage_date',
    header: 'Date',
    cell: (i) => <span className="text-base text-text-main whitespace-nowrap">{formatDate(i.getValue())}</span>
  },
  {
    id: 'wastage_summary',
    header: 'Wastage',
    cell: (i) => {
      const entry = i.row.original;
      let itemsList = [];
      (entry.wastages || []).forEach((w) => {
        (w.items || []).forEach((it) => {
          const name = it.menu_item?.dish_name || it.item?.item_name || `Item #${it.item_id || it.menu_item_id}`;
          const unit = it.menu_item?.unit?.unit_code || it.item?.unit?.unit_code || '';
          const qty = Number(it.quantity);
          const amount = Number(it.approx_amount || 0);
          itemsList.push({ name, qty, unit, amount });
        });
      });
      const totalAmount = itemsList.reduce((sum, it) => sum + (it.qty * it.amount), 0);
      if (itemsList.length === 0) {
        return <span className="text-sm font-semibold text-gray-400">No Wastage</span>;
      }
      return (
        <div className="space-y-1 text-sm leading-6">
          {itemsList.map((item, idx) => (
            <div key={idx} className="flex items-baseline justify-between">
              <span className="font-medium text-gray-700">
                {item.name}
                <span className="text-gray-400 mx-1">-</span>
                <QtyDisplay qty={item.qty} unit={item.unit} />
              </span>
              <span className="font-semibold text-gray-800 ml-3">₹{(item.qty * item.amount).toFixed(0)}</span>
            </div>
          ))}
        </div>
      );
    }
  },
  {
    id: 'total_amt',
    header: 'Total',
    cell: (i) => {
      const entry = i.row.original;
      let total = 0;
      (entry.wastages || []).forEach((w) => {
        (w.items || []).forEach((it) => {
          total += Number(it.quantity || 0) * Number(it.approx_amount || 0);
        });
      });
      return <span className="text-base font-bold text-text-main">₹{total.toFixed(0)}</span>;
    }
  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: (info) => {
      const entry = info.row.original;
      return (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => handleView(entry)} className="action-btn-view">View</button>
          {canWrite && <button onClick={() => handleEdit(entry)} className="action-btn-edit">Edit</button>}
          {canDelete && <button
            onClick={async () => {
              const confirmed = await showConfirm('Delete Entry', `Are you sure? This cannot be undone.`);
              if (confirmed) deleteMutation.mutate(entry.id);
            }}
            className="action-btn-delete">
            Delete
          </button>}
        </div>
      );
    }
  }],
  [deleteMutation, showConfirm, canWrite, canDelete]);

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Daily Consumption Entry</h2>
        {canWrite && <Button onClick={openNew} className="text-text-main">Add Consumption Entry</Button>}
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
            {canReadActivityLogs && (
              <button
                onClick={() => setActivityExpanded(!activityExpanded)}
                className={cn(
                  "relative flex h-10 w-10 shrink-0 items-center justify-center self-end text-primary transition-colors hover:text-primary/80 active:scale-95 group",
                  activityExpanded && "text-primary/70"
                )}
                title={activityExpanded ? "Close History" : "View Usage History"}
              >
                <History className="w-6 h-6 transition-colors" />
              </button>
            )}
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

      {canReadActivityLogs && (
        <div className={cn(
          "fixed top-0 right-0 h-full w-[360px] max-w-[94vw] bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.08)] border-l border-border-temple/40 z-30 transition-transform duration-300 ease-out transform",
          activityExpanded ? "translate-x-0" : "translate-x-full"
        )} ref={activityDrawerRef}>
          <div className="flex h-full flex-col">
            <div className="m-0 flex items-center justify-between border-b border-border-temple/40 bg-[#FAF7F2] px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary shadow-sm border border-border-temple/40">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-secondary font-temple uppercase tracking-widest">Recent Activity</h3>
              </div>
              <button onClick={() => setActivityExpanded(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-main/40 hover:bg-white hover:text-text-main">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#FFFCF8] px-5 py-4 custom-scrollbar">
              {activityLoading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="mb-4 animate-pulse space-y-3 rounded-xl bg-white p-4 shadow-sm">
                    <div className="h-3 bg-bg-temple rounded w-3/4"></div>
                    <div className="h-2 bg-bg-temple rounded w-1/2"></div>
                  </div>
                ))
              ) : (!activityData || activityData.length === 0) ? (
                <div className="p-10 text-center space-y-2">
                  <div className="w-12 h-12 bg-bg-temple rounded-full flex items-center justify-center mx-auto opacity-40">
                    <History className="w-6 h-6 text-text-main" />
                  </div>
                  <p className="text-xs text-text-main/40 italic">No recent activities</p>
                </div>
              ) : (
                Object.entries(groupedActivityData).map(([day, logs]) => (
                  <div key={day} className="mb-5 last:mb-0">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-text-main/40">{day}</div>
                    <div className="relative divide-y divide-border-temple/40 bg-white before:absolute before:left-[14px] before:top-3 before:bottom-3 before:w-px before:bg-primary/45">
                      {logs.map((log) => {
                        const { actorName, actionText, targetName, targetPrefix } = getActivitySentenceParts(log);
                        return (
                          <div key={log.id} className="relative py-3 pl-7 pr-3 transition-colors">
                            <div className="absolute left-[14px] top-[19px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary" />
                            <div className="min-w-0 flex-1 pt-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold leading-tight text-text-main">
                                    <span className="font-bold text-primary">{actorName}</span>
                                    <span className="text-text-main"> {actionText}</span>
                                    {targetName && (
                                      <>
                                        <span className="text-text-main">{targetPrefix}</span>
                                        <span className="font-bold text-primary">{targetName}</span>
                                      </>
                                    )}
                                  </p>
                                </div>
                                <span className="shrink-0 text-[10px] font-bold text-text-main/70">
                                  {new Date(log.activity_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[1400px] max-w-[96vw] max-h-[94vh] !flex !flex-col overflow-hidden border-border-temple !p-0 shadow-2xl">
          <DialogHeader className="border-b border-border-temple/40 px-6 py-4 m-0 shrink-0 bg-[#F3E8D4]">
            <DialogTitle className="text-text-main font-temple">Consumption Summary</DialogTitle>
            <DialogDescription className="sr-only">Consumption details</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar bg-white">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              <div className="temple-form-section min-w-0">
                <div className="pb-3 border-b border-border-temple/20 mb-4">
                  <span className="text-lg font-bold text-primary">Daily Service Details</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-4 text-base text-text-main">
                  <div className="font-semibold">Consumption Date</div><div className="text-right whitespace-nowrap">{formatDate(viewingConsumption?.usage_date)}</div>
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

              <div className="min-w-0">
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setViewTab('raw')}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-bold border transition-colors",
                      viewTab === 'raw'
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-text-main border-border-temple/40 hover:bg-bg-temple/40"
                    )}
                  >
                    Raw Item Usage
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTab('wastage')}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-bold border transition-colors",
                      viewTab === 'wastage'
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-text-main border-border-temple/40 hover:bg-bg-temple/40"
                    )}
                  >
                    Item Wastage
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTab('adjustments')}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-bold border transition-colors",
                      viewTab === 'adjustments'
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-text-main border-border-temple/40 hover:bg-bg-temple/40"
                    )}
                  >
                    Stock Adjustments
                  </button>
                </div>

                <div className="rounded-xl border border-border-temple/30 overflow-hidden shadow-sm bg-white">
                  {viewTab === 'raw' && (
                    <table className="w-full text-base text-left border-collapse">
                      <tbody className="divide-y divide-border-temple/10">
                        {(viewingConsumption?.items || []).filter((item) => Number(item.quantity_used || 0) > 0).length === 0 ?
                          <tr>
                            <td colSpan={2} className="px-4 py-3 text-text-main/60 text-center text-sm italic">No raw items recorded</td>
                          </tr> :
                          (viewingConsumption?.items || []).
                            filter((item) => Number(item.quantity_used || 0) > 0).
                            map((item) =>
                              <tr key={item.id} className="hover:bg-bg-temple/5 transition-colors">
                                <td className="px-4 py-3 text-text-main">
                                  <span className="text-base font-medium">
                                    {item.item?.item_name || items?.find((it) => it.id == item.item_id)?.item_name || `Unknown Item (${item.item_id})`}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right text-text-main font-semibold">
                                  <QtyDisplay qty={item.quantity_used || 0} unit={item.item?.unit || items?.find((it) => it.id == item.item_id)?.unit} />
                                </td>
                              </tr>
                            )
                        }
                      </tbody>
                    </table>
                  )}

                  {viewTab === 'wastage' && (
                    <table className="w-full text-base text-left border-collapse">
                      <thead className="bg-bg-temple/50 text-text-main uppercase text-xs font-bold tracking-wider">
                        <tr>
                          <th className="px-4 py-2 border-b border-border-temple/20">Dish/Item Name</th>
                          <th className="px-4 py-2 border-b border-border-temple/20 text-right">Quantity</th>
                          <th className="px-4 py-2 border-b border-border-temple/20 text-right">Rate</th>
                          <th className="px-4 py-2 border-b border-border-temple/20 text-right">Total Amt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-temple/10">
                        {viewingWastages.filter((w) => Number(w.quantity || 0) > 0).length === 0 ?
                          <tr>
                            <td colSpan={4} className="px-4 py-3 text-text-main/60 text-center text-sm italic">No wastage recorded</td>
                          </tr> :
                          viewingWastages.
                            filter((w) => Number(w.quantity || 0) > 0).
                            map((w, idx) =>
                              <tr key={`${w.entryId}-${idx}`} className="hover:bg-bg-temple/5 transition-colors">
                                <td className="px-4 py-3 text-text-main">
                                  <span className="text-base font-medium">
                                    {w.menu_item_name}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right text-text-main font-semibold">
                                  <QtyDisplay qty={w.quantity || 0} unit={{ unit_name: w.unit_name, unit_code: w.unit_code }} />
                                </td>
                                <td className="px-4 py-3 text-right text-text-main">
                                  {w.approx_amount != null ? formatCurrency(Number(w.approx_amount || 0)) : '-'}
                                </td>
                                <td className="px-4 py-3 text-right text-text-main font-bold">
                                  {w.approx_amount != null ? formatCurrency(Number(w.quantity || 0) * Number(w.approx_amount || 0)) : '-'}
                                </td>
                              </tr>
                            )
                        }
                      </tbody>
                    </table>
                  )}

                  {viewTab === 'adjustments' && (
                    <table className="w-full text-base text-left border-collapse">
                      <tbody className="divide-y divide-border-temple/10">
                        {viewingAdjustments.filter((a) => Number(a.quantity || 0) !== 0).length === 0 ? (
                          <tr>
                            <td className="px-4 py-3 text-text-main/60 text-center text-sm italic">No stock adjustments</td>
                          </tr>
                        ) : (
                          viewingAdjustments
                            .filter((a) => Number(a.quantity || 0) !== 0)
                            .map((a, idx) =>
                              <tr key={`${a.entryId}-${idx}`} className="hover:bg-bg-temple/5 transition-colors">
                                <td className="px-4 py-3 text-text-main">
                                  <span className="text-base font-medium">{a.menu_item_name}</span>
                                </td>
                                <td className="px-4 py-3 text-right text-text-main font-semibold">
                                  {Number(a.quantity || 0) > 0 ? '+' : '-'} <QtyDisplay qty={Math.abs(Number(a.quantity || 0))} unit={{ unit_name: a.unit_name, unit_code: a.unit_code }} />
                                </td>
                              </tr>
                            )
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="!px-6 !py-4 !m-0 border-t border-border-temple/40 !flex !flex-row !items-center !justify-end shrink-0 bg-[#F3E8D4]">
            <Button onClick={() => setViewDialogOpen(false)} className="px-6 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-md">
              Close
            </Button>
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
          className="w-[1400px] max-w-[94vw] max-h-[96vh] overflow-hidden p-0 flex flex-col"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}>
          
          <DialogHeader className="m-0 shrink-0">
            <DialogTitle className="text-xl font-bold font-temple">{editingConsumption ? 'Edit Consumption Entry' : 'Add Consumption Entry'}</DialogTitle>
            <DialogDescription className="sr-only">Create consumption and wastage entry</DialogDescription>
          </DialogHeader>

          <form 
            onSubmit={handleSubmit(onSubmit)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                e.preventDefault();
              }
            }}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="bg-white px-6 pt-4 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
              <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-12 gap-4 items-start min-h-[56vh]">
              {canReadUsage && (
                <div className="temple-form-section min-w-0 2xl:col-span-4">
                  <h4 className="temple-section-header mt-0 text-lg tracking-wider">Daily Service Details</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-[1fr_140px] items-center gap-3">
                    <Label className="temple-label leading-tight">Date *</Label>
                    <Input type="date" {...register('usage_date')} readOnly className="h-10 text-base bg-gray-100 cursor-not-allowed" />
                  </div>
                  <div className="grid grid-cols-[1fr_140px] items-center gap-3">
                    <Label className="temple-label leading-tight">No. of times cooked</Label>
                    <Input
                          type="text"
                          {...register('times_cooked')}
                          disabled={!canWriteUsage}
                          className="h-10 text-base"
                          onFocus={(e) => {
                            if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                              setValue('times_cooked', '');
                            }
                          }} />
                        
                  </div>
                  <div className="grid grid-cols-[1fr_140px] items-center gap-3">
                    <Label className="temple-label leading-tight">Regular Cooking Persons</Label>
                    <Input
                          type="text"
                          {...register('regular_cooking_persons')}
                          disabled={!canWriteUsage}
                          className="h-10 text-base"
                          onFocus={(e) => {
                            if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                              setValue('regular_cooking_persons', '');
                            }
                          }} />
                        
                  </div>
                  <div className="grid grid-cols-[1fr_140px] items-center gap-3">
                    <Label className="temple-label leading-tight">Additional Cooking Persons</Label>
                    <Input
                          type="text"
                          {...register('additional_cooking_persons')}
                          disabled={!canWriteUsage}
                          className="h-10 text-base"
                          onFocus={(e) => {
                            if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                              setValue('additional_cooking_persons', '');
                            }
                          }} />
                        
                  </div>
                  <div className="grid grid-cols-[1fr_140px] items-center gap-3">
                    <Label className="temple-label leading-tight">Regular Serving Persons</Label>
                    <Input
                          type="text"
                          {...register('regular_serving_persons')}
                          disabled={!canWriteUsage}
                          className="h-10 text-base"
                          onFocus={(e) => {
                            if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                              setValue('regular_serving_persons', '');
                            }
                          }} />
                        
                  </div>
                  <div className="grid grid-cols-[1fr_140px] items-center gap-3">
                    <Label className="temple-label leading-tight">Additional Serving Persons</Label>
                    <Input
                          type="text"
                          {...register('additional_serving_persons')}
                          disabled={!canWriteUsage}
                          className="h-10 text-base"
                          onFocus={(e) => {
                            if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                              setValue('additional_serving_persons', '');
                            }
                          }} />
                        
                  </div>
                  <div className="grid grid-cols-[1fr_140px] items-center gap-3">
                    <Label className="temple-label leading-tight">Regular Cleaning Persons</Label>
                    <Input
                          type="text"
                          {...register('regular_cleaning_persons')}
                          disabled={!canWriteUsage}
                          className="h-10 text-base"
                          onFocus={(e) => {
                            if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                              setValue('regular_cleaning_persons', '');
                            }
                          }} />
                        
                  </div>
                  <div className="grid grid-cols-[1fr_140px] items-center gap-3">
                    <Label className="temple-label leading-tight">Additional Cleaning Persons</Label>
                    <Input
                          type="text"
                          {...register('additional_cleaning_persons')}
                          disabled={!canWriteUsage}
                          className="h-10 text-base"
                          onFocus={(e) => {
                            if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                              setValue('additional_cleaning_persons', '');
                            }
                          }} />
                        
                  </div>
                  </div>
                </div>
              )}

              {canReadUsage && (
                <div className="temple-form-section min-w-0 2xl:col-span-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h4 className="temple-section-header !m-0 text-lg tracking-wider">Item Usage</h4>
                    {/* Search Input for Item Usage */}
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                      <Input
                        type="text"
                        placeholder="Search raw items..."
                        value={usageSearchQuery}
                        onChange={(e) => setUsageSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-sm bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_100px] gap-3 mb-1 px-1 border-b border-border-temple/10 pb-1">
                    <div></div>
                    <div className="text-base font-bold text-text-main text-center">Used</div>
                  </div>
                  <div className="max-h-[480px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {activeItems
                      .filter((i) => {
                        if (!usageSearchQuery) return true;
                        const query = usageSearchQuery.toLowerCase().trim();
                        return (
                          (i.item_name || '').toLowerCase().includes(query) ||
                          (i.serial_numbers || []).some((s) => (s?.serial_number || '').toLowerCase().includes(query))
                        );
                      })
                      .map((item) => {
                        const itemError = errors.raw_items?.[item.id];
                        return (
                          <div key={item.id} className="grid grid-cols-[1fr_100px] gap-3 items-center min-h-[32px]">
                          <div className="text-base font-medium text-text-main leading-6 pr-2">
                            {item.item_name}{item.unit?.unit_code ? ` (${item.unit.unit_code})` : ''}
                          </div>
                          <div>
                            <Input
                                type="text"
                                disabled={!canWriteUsage}
                                className={cn("h-10 text-base text-center px-1", itemError?.quantity_used && "border-red-500")}
                                {...register(`raw_items.${item.id}.quantity_used`)}
                                onFocus={(e) => {
                                  if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                                    setValue(`raw_items.${item.id}.quantity_used`, '');
                                  }
                                }} />
                              
                          </div>
                        </div>);

                      })}
                  </div>
                </div>
              )}

              <div className="temple-form-section min-w-0 xl:col-span-2 2xl:col-span-4">
                {canReadUsage && (
                  <div className="mb-8">
                    <h4 className="temple-section-header mt-0 text-lg tracking-wider">Menu Item Wastage</h4>
                    <div className="grid grid-cols-[1fr_80px_110px] gap-3 mb-1 px-1 border-b border-border-temple/10 pb-1">
                      <div></div>
                      <div className="text-base font-bold text-text-main text-center">Qty</div>
                      <div className="text-base font-bold text-text-main text-center whitespace-nowrap">Rate</div>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                      <div className="space-y-2">
                        {(menuItems || []).filter((m) => m.status === 1).map((menu) => {
                          return (
                          <div key={menu.id} className="grid grid-cols-[1fr_80px_110px] gap-3 items-center min-h-[32px]">
                            <div className="text-base font-medium text-text-main leading-6 pr-2">
                              {menu.dish_name}{menu.unit?.unit_code ? ` (${menu.unit.unit_code})` : ''}
                            </div>
                            <div>
                              <Input
                                type="text"
                                disabled={!canWriteUsage}
                                className="h-10 text-base text-center px-1"
                                {...register(`wastage_items.${menu.id}.quantity`)}
                                onFocus={(e) => {
                                  if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                                    setValue(`wastage_items.${menu.id}.quantity`, '');
                                  }
                                }} />
                              
                            </div>
                            <div>
                              <Input
                                type="text"
                                disabled={!canWriteUsage}
                                className="h-10 text-base text-center px-1"
                                {...register(`wastage_items.${menu.id}.approx_amount`)}
                                onFocus={(e) => {
                                  if (!editingConsumption && (e.target.value === '0' || e.target.value === 0)) {
                                    setValue(`wastage_items.${menu.id}.approx_amount`, '');
                                  }
                                }} />
                              
                            </div>
                          </div>
                          );}
                          )}
                      </div>
                    </div>
                  </div>
                )}

                {canReadUsage && (
                  <div className="space-y-2 border-t border-border-temple/10 pt-4">
                    <h5 className="text-lg font-bold tracking-wider text-primary">Stock Adjustment</h5>
                    <div className="space-y-2">
                      {rawWastageFields.length > 0 && (
                        <div className="grid grid-cols-12 gap-2 items-center px-2">
                          <div className="col-span-2">
                            <Label className="text-base font-bold text-text-main block">Item Code</Label>
                          </div>
                          <div className="col-span-6">
                            <Label className="text-base font-bold text-text-main block">Item Name</Label>
                          </div>
                          <div className="col-span-3">
                            <Label className="text-base font-bold text-text-main block whitespace-nowrap">Adj.Qty</Label>
                          </div>
                          <div className="col-span-1" />
                        </div>
                      )}

                      {rawWastageFields.map((field, index) =>
                        <div key={field.id} className="bg-bg-temple/20 p-2 rounded border border-border-temple/20 space-y-2">
                          <div className="grid grid-cols-12 gap-2 items-center min-h-[42px]">
                          <div className="col-span-2">
                            <Input
                              type="text"
                              disabled={!canWriteUsage}
                              className="h-10 text-base bg-white"
                              {...register(`raw_wastage_items.${index}.serial_id`)}
                              onChange={(e) => {
                                const serialRaw = e.target.value || '';
                                const normalized = serialRaw.trim().toLowerCase();
                                const matchedItemId = serialToItemIdMap.get(normalized) || 0;

                                setValue(`raw_wastage_items.${index}.serial_id`, serialRaw);

                                if (normalized && matchedItemId > 0) {
                                  setValue(`raw_wastage_items.${index}.item_id`, matchedItemId, { shouldValidate: true });
                                } else if (!normalized || !matchedItemId) {
                                  setValue(`raw_wastage_items.${index}.item_id`, 0, { shouldValidate: true });
                                }
                              }}
                            />
                          </div>
                          <div className="col-span-6">
                            <Controller
                              name={`raw_wastage_items.${index}.item_id`}
                              control={control}
                              render={({ field: selectField }) =>
                                <SearchableSelect
                                  ref={selectField.ref}
                                  value={selectField.value}
                                  isDisabled={!canWriteUsage}
                                  className="text-base"
                                  onChange={(val) => {
                                    const newId = Number(val);
                                    selectField.onChange(newId);
                                    const item = activeItems.find(i => i.id === newId);
                                    const serial = item?.serial_numbers?.[0]?.serial_number || '';
                                    setValue(`raw_wastage_items.${index}.serial_id`, serial);
                                  }}
                                  options={activeItems.map((i) => ({
                                    value: i.id,
                                    label: i.item_name
                                  }))}
                                  placeholder="Search & Select Item..."
                                />
                              }
                            />
                          </div>
                          <div className="col-span-3">
                            <Input
                              type="text"
                              inputMode="decimal"
                              disabled={!canWriteUsage}
                              className="h-10 w-full text-base bg-white"
                              {...register(`raw_wastage_items.${index}.quantity`)}
                              onChange={(e) => {
                                const cleaned = (e.target.value || '').replace(/[^\d.]/g, '');
                                const normalized = cleaned.replace(/(\..*)\./g, '$1');
                                setValue(`raw_wastage_items.${index}.quantity`, normalized, { shouldValidate: true });
                              }}
                              onFocus={(e) => {
                                if (e.target.value === '0' || e.target.value === '0.0' || e.target.value === '0.00' || e.target.value === '0.000') {
                                  setValue(`raw_wastage_items.${index}.quantity`, '');
                                }
                              }}
                            />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={!canWriteUsage}
                              onClick={() => removeRawWastage(index)}
                              className="h-10 w-10 p-0 text-error hover:bg-error/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          </div>
                          <div className="px-1">
                            <Controller
                              name={`raw_wastage_items.${index}.operation`}
                              control={control}
                              render={({ field: opField }) => (
                                <div className="inline-flex rounded-full border border-border-temple/40 overflow-hidden">
                                  <button
                                    type="button"
                                    disabled={!canWriteUsage}
                                    onClick={() => opField.onChange('add')}
                                    className={cn(
                                      "px-3 py-1.5 text-xs font-bold transition-colors",
                                      opField.value === 'add'
                                        ? "bg-[#2F6B4F] text-white"
                                        : "bg-white text-[#2F6B4F] hover:bg-[#EAF6EF]"
                                    )}
                                  >
                                    {opField.value === 'add' ? '✔ Add' : '+ Add'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canWriteUsage}
                                    onClick={() => opField.onChange('deduct')}
                                    className={cn(
                                      "px-3 py-1.5 text-xs font-bold transition-colors border-l border-border-temple/40",
                                      opField.value === 'deduct'
                                        ? "bg-[#C24A2C] text-white"
                                        : "bg-white text-[#C24A2C] hover:bg-[#FDF1EA]"
                                    )}
                                  >
                                    {opField.value === 'deduct' ? '✔ Deduct' : '− Deduct'}
                                  </button>
                                </div>
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {canWriteUsage && (
                      <div className="pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => appendRawWastage({ serial_id: '', item_id: 0, operation: 'deduct', quantity: 0 })}
                            className="h-10 px-3 text-sm bg-primary-main/20 text-primary-main hover:bg-primary-main/30 border border-primary-main/30 font-bold">
                            
                          <Plus className="w-4 h-4 mr-1" />
                          Raw Item
                        </Button>
                      </div>
                    )}
                  </div>
                )}
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
                        const actualErr = itemErr.quantity_used || itemErr.quantity || itemErr.approx_amount || itemErr;
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

            <DialogFooter className="gap-3 !m-0 bg-[#F3E8D4] !px-6 !py-4 shrink-0 border-t border-border-temple/40">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2] font-bold">Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="w-32 h-10 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg border-none">
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>);

};

export default UsageEntriesPage;
