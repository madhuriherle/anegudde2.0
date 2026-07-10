import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, FileText, X, Clock, History } from 'lucide-react';

import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { DetailItem } from '../components/ui/DetailItem';
import { cn } from '../utils/cn';
import { formatDate, getTodayDateInput, safeFormatTime, safeFormatDate } from '../utils/date';
import { QtyDisplay } from '../components/ui/QtyDisplay';
import { usePermission } from '../hooks/usePermission';

const PurchaseReturnsPage = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('purchase_returns.write');
  const canDelete = hasPermission('purchase_returns.delete');
  const canReadActivityLogs = hasPermission('purchase_returns.read');

  const [isAdding, setIsAdding] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedBill, setSelectedBill] = useState('');
  const [returnItems, setReturnItems] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [returnDate, setReturnDate] = useState(getTodayDateInput());
  const [filterDate, setFilterDate] = useState('');
  const [editingReturnId, setEditingReturnId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingReturn, setViewingReturn] = useState(null);

  // Data Fetching
  const { data: returns, isLoading } = useQuery({
    queryKey: ['purchase-returns', filterDate, page, pageSize],
    queryFn: async () => {
      const res = await api.get('/purchases/list_returns', {
        params: { ...(filterDate ? { q: filterDate } : {}), page, page_size: pageSize }
      });
      return res.data;
    }
  });

  const [activityExpanded, setActivityExpanded] = useState(false);
  const activityDrawerRef = useRef(null);

  useEffect(() => {
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
    queryKey: ['purchase-return-activities'],
    queryFn: async () => {
      const res = await api.get('/audit/page_activity', { params: { page: 'purchase_returns', page_size: 20 } });
      return res.data?.items || [];
    },
    enabled: !!canReadActivityLogs,
    retry: false,
    refetchInterval: 15000
  });

  const getActivityMeta = (log) => {
    if (log.method === 'POST') {
      return { title: 'Purchase Return Added', verb: 'created' };
    }
    if (log.method === 'PUT') {
      return { title: 'Purchase Return Edited', verb: 'updated' };
    }
    return { title: 'Purchase Return Deleted', verb: 'deleted' };
  };

  const getActivitySentenceParts = (log) => {
    const { verb } = getActivityMeta(log);
    const actorName = log.meta?.actor_name || log.username || 'System';
    const vendorName = log.meta?.vendor_name;
    const billNo = log.meta?.bill_no;
    const returnDate = log.meta?.return_date ? formatDate(log.meta.return_date) : null;
    const actionText = billNo ? `${verb} purchase return for Bill No. ${billNo}` : `${verb} a purchase return`;
    const targetName = vendorName || returnDate;
    const targetPrefix = vendorName ? ' from ' : ' for ';
    return { actorName, actionText, targetName, targetPrefix };
  };

  const formatActivityDay = (value) => {
    const activityDate = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (isSameDay(activityDate, today)) return 'Today';
    if (isSameDay(activityDate, yesterday)) return 'Yesterday';
    return safeFormatDate(activityDate, { day: '2-digit', month: 'short' });
  };

  const groupedActivityData = useMemo(() => {
    return (activityData || []).reduce((groups, log) => {
      const day = formatActivityDay(log.activity_at);
      if (!groups[day]) groups[day] = [];
      groups[day].push(log);
      return groups;
    }, {});
  }, [activityData]);

  const { data: vendors } = useQuery({
    queryKey: ['vendors-active'],
    queryFn: async () => {
      const res = await api.get('/vendors/list_vendors', { params: { status: 1 } });
      return res.data.items;
    }
  });

  const { data: bills } = useQuery({
    queryKey: ['vendor-bills', selectedVendor],
    queryFn: async () => {
      if (!selectedVendor) return [];
      const res = await api.get(`/purchases/list_vendor_bills/${selectedVendor}`);
      return res.data;
    },
    enabled: !!selectedVendor
  });

  const { data: billItems } = useQuery({
    queryKey: ['bill-items', selectedBill],
    queryFn: async () => {
      if (!selectedBill) return [];
      const res = await api.get(`/purchases/list_bill_items/${selectedBill}`);
      return res.data;
    },
    enabled: !!selectedBill
  });

  const mutation = useMutation({
    mutationFn: (payload) =>
    editingReturnId ?
    api.put(`/purchases/update_return/${editingReturnId}`, payload) :
    api.post('/purchases/create_return', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
      showSuccess(editingReturnId ? 'Purchase return updated' : 'Purchase return recorded');
      setIsAdding(false);
      resetForm();
    },
    onError: (err) => showError(err.response?.data?.detail || 'Failed to save')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/purchases/delete_return/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
      showSuccess('Purchase return deleted');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Failed to delete')
  });

  const resetForm = () => {
    setSelectedVendor('');
    setSelectedBill('');
    setReturnItems([]);
    setRemarks('');
    setEditingReturnId(null);
    setReturnDate(getTodayDateInput());
  };

  const handleAddItem = (item) => {
    if (returnItems.find((ri) => ri.item_id === item.item_id)) return;
    setReturnItems([...returnItems, { ...item, return_qty: 0 }]);
  };

  const openEdit = (row) => {
    setEditingReturnId(row.id);
    setReturnDate(new Date(row.return_date).toISOString().split('T')[0]);
    setSelectedVendor(String(row.vendor_id));
    setSelectedBill(String(row.purchase_entry_id || ''));
    setRemarks(row.remarks || '');
    setReturnItems(
      (row.items || []).map((it) => ({
        item_id: it.item_id,
        item_name: it.item_name,
        quantity: 0,
        unit_name: '',
        price: Number(it.price || 0),
        return_qty: Number(it.quantity || 0)
      }))
    );
    setIsAdding(true);
  };

  const handleQtyChange = async (itemId, qty) => {
    // Allow numeric characters and decimal point
    if (qty !== '' && !/^\d*\.?\d*$/.test(qty)) {
      return;
    }

    const numQty = parseFloat(qty) || 0;
    const originalItem = billItems?.find((bi) => bi.item_id === itemId);

    if (originalItem) {
      const alreadyReturned = parseFloat(originalItem.returned_quantity) || 0;
      const remaining = originalItem.quantity - alreadyReturned;

      if (numQty > remaining) {
        await showError(`Cannot return more than remaining (${remaining.toFixed(3)}). Total Purchased: ${originalItem.quantity}, Already Returned: ${alreadyReturned}`);
        // Clear the wrongly entered field after user clicks OK
        setReturnItems((prev) => prev.map((ri) =>
        ri.item_id === itemId ? { ...ri, return_qty: '' } : ri
        ));
        return;
      }
    }

    setReturnItems((prev) => prev.map((ri) =>
    ri.item_id === itemId ? { ...ri, return_qty: qty } : ri
    ));
  };

  const handleSubmit = async () => {
    const validItems = returnItems.filter((ri) => (parseFloat(ri.return_qty) || 0) > 0);

    // Check for any item exceeding purchased quantity
    const exceedingItems = normalizedReturnItems.filter((ri) => {
      const alreadyReturned = parseFloat(ri.returned_quantity) || 0;
      const remaining = ri.quantity - alreadyReturned;
      return (parseFloat(ri.return_qty) || 0) > remaining;
    });
    
    if (exceedingItems.length > 0) {
      showError(`Cannot return more than remaining for: ${exceedingItems.map((i) => i.item_name).join(', ')}`);
      return;
    }

    if (validItems.length === 0) {
      showError('Please add at least one item with a quantity to return');
      return;
    }

    const confirmed = await showConfirm('Record Return', 'Are you sure you want to process this return?');
    if (confirmed) {
      mutation.mutate({
        return_date: returnDate,
        vendor_id: parseInt(selectedVendor),
        purchase_entry_id: parseInt(selectedBill),
        remarks,
        items: validItems.map((vi) => ({
          item_id: vi.item_id,
          quantity: parseFloat(vi.return_qty),
          price: vi.price
        }))
      });
    }
  };

  const availableBillItems = useMemo(() => {
    const selectedIds = new Set(returnItems.map((ri) => ri.item_id));
    return (billItems || []).filter((bi) => !selectedIds.has(bi.item_id));
  }, [billItems, returnItems]);

  const normalizedReturnItems = useMemo(() => {
    const billMap = new Map((billItems || []).map((bi) => [bi.item_id, bi]));
    return returnItems.map((ri) => {
      const bi = billMap.get(ri.item_id);
      return {
        ...ri,
        item_name: ri.item_name || bi?.item_name || 'N/A',
        quantity: bi?.quantity ?? ri.quantity ?? 0,
        returned_quantity: bi?.returned_quantity ?? 0,
        unit_name: bi?.unit_name ?? ri.unit_name ?? ''
      };
    });
  }, [billItems, returnItems]);

  const columns = useMemo(() => [
  {
    accessorKey: 'return_date',
    header: 'Return Date',
    cell: (info) => formatDate(info.getValue())
  },
  {
    accessorKey: 'vendor.vendor_name',
    header: 'Vendor',
    cell: (info) => info.row.original.vendor?.vendor_name || 'N/A'
  },
  {
    accessorKey: 'total_return_amount',
    header: 'Amount',
    cell: (info) => `₹${parseFloat(info.getValue()).toLocaleString()}`
  },
  {
    accessorKey: 'remarks',
    header: 'Remarks',
    cell: (info) => (
      <div className="max-w-[520px] whitespace-normal break-all leading-relaxed">
        {info.getValue() || '-'}
      </div>
    )
  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: (info) =>
    <div className="flex items-center justify-center gap-2">
          <button
        onClick={() => {
          setViewingReturn(info.row.original);
          setViewDialogOpen(true);
        }}
        className="action-btn-view">
        
            View
          </button>
          {canWrite && <button
        onClick={() => openEdit(info.row.original)}
        className="action-btn-edit">
        
            Edit
          </button>}
          {canDelete && <button
        onClick={async () => {
          const ok = await showConfirm('Delete Return', 'Are you sure you want to delete this purchase return?');
          if (ok) deleteMutation.mutate(info.row.original.id);
        }}
        className="action-btn-delete">
        
            Delete
          </button>}
        </div>

  }],
  [deleteMutation, showConfirm, canWrite, canDelete]);

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Purchase Returns</h2>
        {canWrite && <Button
          onClick={() => {
            resetForm();
            setIsAdding(true);
          }}
          className="flex items-center gap-2 text-text-main">
          
          Record Return
        </Button>}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border-temple bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5 w-full sm:w-64">
          <Label className="text-text-main font-bold">Date</Label>
          <div className="relative">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-10 pr-9 text-text-main" />

            {filterDate &&
              <button
                type="button"
                aria-label="Clear date filter"
                onClick={() => setFilterDate('')}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-text-light hover:bg-bg-temple hover:text-text-main">

                <X className="h-3.5 w-3.5" />
              </button>
            }
          </div>
        </div>
        {canReadActivityLogs && (
          <button
            onClick={() => setActivityExpanded(!activityExpanded)}
            className={cn(
              "relative flex h-10 w-10 shrink-0 items-center justify-center self-end text-primary transition-colors hover:text-primary/80 active:scale-95 group",
              activityExpanded && "text-primary/70"
            )}
            title={activityExpanded ? "Close History" : "View Purchase Return History"}
          >
            <History className="w-6 h-6 transition-colors" />
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border-temple overflow-hidden bg-white">
        <DataTable
          columns={columns}
          data={returns?.items || []}
          loading={isLoading}
          manualPagination
          pageCount={returns?.total_pages || 0}
          pageIndex={page - 1}
          pageSize={pageSize}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          totalCount={returns?.total || 0}
        />
      </div>

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
                                  {safeFormatTime(log.activity_at, { hour: '2-digit', minute: '2-digit', hour12: true })}
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

      {/* Add/Edit Dialog */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent
          className="max-w-7xl max-h-[85vh] flex flex-col border-border-temple overflow-hidden !p-0 bg-white"
          onInteractOutside={(e) => e.preventDefault()}>
          
          <DialogHeader className="shrink-0 bg-[#F3E8D4] border-b border-border-temple/40 !p-6 !m-0">
            <DialogTitle className="text-text-main font-temple text-xl font-normal">
              {editingReturnId ? 'Edit Purchase Return' : 'New Purchase Return'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Card className="xl:col-span-1 border-border-temple">
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-normal">Return Date *</Label>
                    <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="h-10 text-text-main" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-normal">Select Vendor *</Label>
                    <Select
                      value={selectedVendor}
                      className="h-10 text-text-main"
                      onChange={(e) => {
                        setSelectedVendor(e.target.value);
                        setSelectedBill('');
                        setReturnItems([]);
                      }}>
                      
                      <option value="">Select Vendor</option>
                      {vendors?.map((v) =>
                      <option key={v.id} value={v.id}>{v.vendor_name}</option>
                      )}
                    </Select>
                  </div>
                  {selectedVendor &&
                  <div className="space-y-1.5">
                      <Label className="text-text-main font-normal">Select Bill / Invoice *</Label>
                      <Select
                      value={selectedBill}
                      className="h-10 text-text-main"
                      onChange={(e) => {
                        setSelectedBill(e.target.value);
                        setReturnItems([]);
                      }}>
                      
                        <option value="">Select Bill</option>
                        {bills?.map((b) =>
                      <option key={b.id} value={b.id}>
                            Inv: {b.bill_no || 'N/A'} | {formatDate(b.purchase_date)} | ₹{parseFloat(b.total_amount).toLocaleString()}
                          </option>
                      )}
                      </Select>
                    </div>
                  }
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-normal">Remarks</Label>
                    <Textarea 
                      value={remarks} 
                      onChange={(e) => setRemarks(e.target.value)} 
                      placeholder="Reason for return..." 
                      className="min-h-[120px] text-text-main resize-none" 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="xl:col-span-2 border-border-temple">
                <CardContent className="p-6">
                  <h3 className="text-base font-normal text-primary mb-6">Return Items</h3>
                  {selectedBill ?
                  <div className="space-y-6">
                      <div className="flex flex-wrap gap-2 p-3 bg-bg-temple/20 rounded-lg border border-border-temple/40">
                        <p className="w-full text-base font-normal text-text-main/70 mb-1">Add Items from Bill:</p>
                        {availableBillItems.map((bi) =>
                      <Button
                        key={bi.item_id}
                        variant="ghost"
                        size="sm"
                        className="bg-white hover:bg-bg-temple border border-border-temple/60 text-text-main text-base"
                        onClick={() => handleAddItem(bi)}>
                        
                            + {bi.item_name}
                          </Button>
                      )}
                        {availableBillItems.length === 0 &&
                      <span className="text-base text-text-main/50 italic py-1 px-2">All bill items added</span>
                      }
                      </div>

                      <div className="rounded-xl border border-border-temple overflow-x-auto shadow-sm">
                        <table className="w-full text-base">
                          <thead className="bg-bg-temple border-b border-border-temple">
                            <tr>
                              <th className="text-left px-4 py-3 font-normal text-text-main">Item</th>
                              <th className="text-right px-4 py-3 font-normal text-text-main">Purchased</th>
                              <th className="text-right px-4 py-3 font-normal text-text-main">Returned</th>
                              <th className="text-right px-4 py-3 font-normal text-text-main">Remaining</th>
                              <th className="text-right px-4 py-3 font-normal text-text-main w-32">Return Qty</th>
                              <th className="text-right px-4 py-3 font-normal text-text-main">Price</th>
                              <th className="text-right px-4 py-3 font-normal text-text-main">Total</th>
                              <th className="w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-temple/40">
                            {normalizedReturnItems.map((ri) => {
                            const alreadyReturned = parseFloat(ri.returned_quantity) || 0;
                            const remaining = ri.quantity - alreadyReturned;
                            const isInvalid = (parseFloat(ri.return_qty) || 0) > remaining;
                            return (
                              <tr key={ri.item_id} className={cn("bg-white hover:bg-bg-temple/5 transition-colors", isInvalid && "bg-red-50/50")}>
                                  <td className="px-4 py-3 text-text-main font-normal">{ri.item_name}</td>
                                  <td className="text-right px-4 py-3 text-text-main font-normal">{ri.quantity}</td>
                                  <td className="text-right px-4 py-3 text-amber-600 font-bold">{alreadyReturned > 0 ? alreadyReturned : '-'}</td>
                                  <td className="text-right px-4 py-3 text-green-600 font-bold">{remaining}</td>
                                  <td className="px-4 py-3">
                                    <Input
                                    type="text"
                                    inputMode="decimal"
                                    className={cn(
                                      "w-full text-right h-9 border-primary/30 focus:border-primary font-normal",
                                      isInvalid && "border-red-500 focus:border-red-600 text-red-600 font-bold"
                                    )}
                                    value={ri.return_qty}
                                    onFocus={() => {
                                      if (parseFloat(ri.return_qty) === 0) {
                                        setReturnItems((prev) => prev.map((p) =>
                                        p.item_id === ri.item_id ? { ...p, return_qty: '' } : p
                                        ));
                                      }
                                    }}
                                    onChange={(e) => handleQtyChange(ri.item_id, e.target.value)} />
                                  
                                    {isInvalid &&
                                  <p className="text-[10px] text-red-600 mt-1 font-bold text-right italic">
                                        Max: {remaining}
                                      </p>
                                  }
                                  </td>
                                  <td className="text-right px-4 py-3 text-text-main font-normal">₹{parseFloat(ri.price).toLocaleString()}</td>
                                  <td className="text-right px-4 py-3 text-text-main font-normal">
                                    ₹{((parseFloat(ri.return_qty) || 0) * ri.price).toLocaleString()}
                                  </td>
                                  <td className="px-2">
                                    <button
                                    onClick={() => setReturnItems((prev) => prev.filter((p) => p.item_id !== ri.item_id))}
                                    className="p-1.5 rounded-full hover:bg-red-50 text-error transition-colors">
                                    
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>);

                          })}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold text-text-main/50 uppercase tracking-widest">Total Return Amount</span>
                          <span className="text-2xl font-black text-primary">
                            ₹{normalizedReturnItems.reduce((acc, curr) => acc + (parseFloat(curr.return_qty) || 0) * curr.price, 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div> :

                  <div className="flex flex-col items-center justify-center h-64 text-text-main/30 border-2 border-dashed border-border-temple/60 rounded-xl bg-bg-temple/5">
                      <FileText className="w-16 h-16 mb-3 opacity-20" />
                      <p className="font-normal text-base">Please select a vendor and bill first</p>
                    </div>
                  }
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter className="gap-3 !m-0 bg-[#F3E8D4] !px-6 !py-4 border-t border-border-temple/40 shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAdding(false)}
              className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2] font-normal">
              Cancel
            </Button>
            <Button
              className="w-32 h-10 bg-primary hover:bg-primary/90 text-white font-normal shadow-lg border-none"
              onClick={handleSubmit}
              disabled={mutation.isPending || normalizedReturnItems.length === 0}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[1600px] max-w-[92vw] max-h-[92vh] !flex !flex-col overflow-hidden border-border-temple bg-[#FDFBF7] !p-0 shadow-2xl">
          <DialogHeader className="shrink-0 bg-[#F3E8D4] border-b border-border-temple/40 !p-6 !m-0">
            <DialogTitle className="text-text-main font-temple text-xl font-normal">Purchase Return Details</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 py-6 px-6 overflow-y-auto custom-scrollbar">
            {viewingReturn && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                
                {/* Left Side: Original Purchase Details */}
                <Card className="border border-[#D8C8B8] shadow-sm bg-white overflow-hidden flex flex-col h-full min-w-0">
                  <div className="bg-[#F6EEDF] px-6 py-3 border-b border-[#D8C8B8] h-14 flex items-center">
                    <h3 className="text-base font-normal text-primary">Original Purchase</h3>
                  </div>
                  <CardContent className="p-0 flex-1 flex flex-col">
                    <div className="flex flex-col gap-1 p-6 bg-white border-b border-gray-100 min-h-[240px]">
                      <DetailItem className="text-base font-normal" labelClassName="font-normal" label="Invoice No" value={viewingReturn.purchase_entry?.bill_no || 'N/A'} valueClassName="font-normal text-text-main" />
                      <DetailItem className="text-base font-normal" labelClassName="font-normal" label="Purchase Date" value={viewingReturn.purchase_entry ? formatDate(viewingReturn.purchase_entry.purchase_date) : 'N/A'} valueClassName="font-normal text-text-main" />
                      <DetailItem className="text-base font-normal" labelClassName="font-normal" label="Bill Amount" value={viewingReturn.purchase_entry ? `₹${parseFloat(viewingReturn.purchase_entry.total_amount).toLocaleString()}` : 'N/A'} valueClassName="font-normal text-text-main" />
                      <DetailItem className="text-base font-normal" labelClassName="font-normal" label="Vendor" value={viewingReturn.vendor?.vendor_name || 'N/A'} valueClassName="font-normal text-text-main" />
                    </div>
                    <div className="flex-1 overflow-auto bg-gray-50/30">
                      <table className="min-w-full sm:min-w-[620px] w-full text-base text-left table-auto border-collapse">
                        <thead className="bg-[#FAF7F2] border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 font-normal text-text-main">Item</th>
                            <th className="px-6 py-3 font-normal text-text-main text-right whitespace-nowrap">Qty</th>
                            <th className="px-6 py-3 font-normal text-text-main text-right whitespace-nowrap">Price</th>
                            <th className="px-6 py-3 font-normal text-text-main text-right whitespace-nowrap">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(viewingReturn.items || []).map((it) =>
                        <tr key={it.id} className="bg-white">
                              <td className="px-6 py-4 text-text-main whitespace-normal break-words font-normal" title={it.item_name}>{it.item_name || 'N/A'}</td>
                              <td className="px-6 py-4 text-text-main text-right whitespace-nowrap font-normal">
                                {it.original_purchase_qty !== null ? <QtyDisplay qty={it.original_purchase_qty} digits={3} unit={it.unit} /> : 'N/A'}
                              </td>
                              <td className="px-6 py-4 text-text-main text-right whitespace-nowrap font-normal">₹{it.original_purchase_price !== null ? parseFloat(it.original_purchase_price).toLocaleString() : parseFloat(it.price).toLocaleString()}</td>

                              <td className="px-6 py-4 text-text-main text-right whitespace-nowrap font-normal">
                                ₹{it.original_purchase_qty !== null && it.original_purchase_price !== null ? (parseFloat(it.original_purchase_qty) * parseFloat(it.original_purchase_price)).toLocaleString() : 'N/A'}
                              </td>
                            </tr>
                        )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Right Side: Return Details */}
                <Card className="border border-[#D8C8B8] shadow-sm bg-white overflow-hidden flex flex-col h-full min-w-0">
                  <div className="bg-[#F6EEDF] px-6 py-3 border-b border-[#D8C8B8] h-14 flex justify-between items-center">
                    <h3 className="text-base font-normal text-primary">Return Entry</h3>
                    <span className="text-sm font-normal bg-secondary text-white px-3 py-1 rounded-full">RETURNED</span>
                  </div>
                  <CardContent className="p-0 flex-1 flex flex-col">
                    <div className="flex flex-col gap-1 p-6 bg-white border-b border-gray-100 h-[240px]">
                      <DetailItem className="text-base font-normal" labelClassName="font-normal" label="Return Date" value={formatDate(viewingReturn.return_date)} valueClassName="font-normal text-text-main" />
                      <DetailItem className="text-base font-normal" labelClassName="font-normal" label="Total Return Amount" value={`₹${parseFloat(viewingReturn.total_return_amount).toLocaleString()}`} valueClassName="font-normal text-text-main" />
                      <DetailItem className="text-base font-normal" labelClassName="font-normal" label="Remarks" value={viewingReturn.remarks || 'None'} valueClassName="font-normal text-text-main" />
                    </div>
                    <div className="flex-1 overflow-auto bg-gray-50/30">
                      <table className="min-w-full sm:min-w-[620px] w-full text-base text-left table-auto border-collapse">
                        <thead className="bg-[#FAF7F2] border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 font-normal text-text-main">Item</th>
                            <th className="px-6 py-3 font-normal text-text-main text-right whitespace-nowrap">Qty</th>
                            <th className="px-6 py-3 font-normal text-text-main text-right whitespace-nowrap">Price</th>
                            <th className="px-6 py-3 font-normal text-text-main text-right whitespace-nowrap">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(viewingReturn.items || []).map((it) =>
                        <tr key={it.id} className="bg-white">
                              <td className="px-6 py-4 text-text-main whitespace-normal break-words font-normal" title={it.item_name}>{it.item_name || 'N/A'}</td>
                              <td className="px-6 py-4 text-text-main text-right whitespace-nowrap font-normal"><QtyDisplay qty={it.quantity} digits={3} unit={it.unit} /></td>
                              <td className="px-6 py-4 text-text-main text-right whitespace-nowrap font-normal">₹{parseFloat(it.price).toLocaleString()}</td>
                              <td className="px-6 py-4 text-text-main text-right whitespace-nowrap font-normal">₹{parseFloat(it.line_total).toLocaleString()}</td>
                            </tr>
                        )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 bg-[#F3E8D4] border-t border-border-temple/40 !px-6 !py-4 !m-0 flex justify-end">
            <Button onClick={() => setViewDialogOpen(false)} className="px-6 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-normal border-none shadow-md">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

};

export default PurchaseReturnsPage;
