import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, FileText, X } from 'lucide-react';

import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { DetailItem } from '../components/ui/DetailItem';
import { cn } from '../utils/cn';
import { formatDate } from '../utils/date';

const PurchaseReturnsPage = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();

  const [isAdding, setIsAdding] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedBill, setSelectedBill] = useState('');
  const [returnItems, setReturnItems] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterDate, setFilterDate] = useState('');
  const [editingReturnId, setEditingReturnId] = useState(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingReturn, setViewingReturn] = useState(null);

  // Data Fetching
  const { data: returns, isLoading } = useQuery({
    queryKey: ['purchase-returns', filterDate],
    queryFn: async () => {
      const res = await api.get('/purchases/list_returns', {
        params: filterDate ? { q: filterDate } : undefined
      });
      return res.data;
    }
  });

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
      const res = await api.get(`/purchases/vendor_bills/${selectedVendor}`);
      return res.data;
    },
    enabled: !!selectedVendor
  });

  const { data: billItems } = useQuery({
    queryKey: ['bill-items', selectedBill],
    queryFn: async () => {
      if (!selectedBill) return [];
      const res = await api.get(`/purchases/bill_items/${selectedBill}`);
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
    setReturnDate(new Date().toISOString().split('T')[0]);
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

    if (originalItem && numQty > originalItem.quantity) {
      await showError(`Cannot return more than purchased (${originalItem.quantity})`);
      // Clear the wrongly entered field after user clicks OK
      setReturnItems((prev) => prev.map((ri) =>
      ri.item_id === itemId ? { ...ri, return_qty: '' } : ri
      ));
      return;
    }

    setReturnItems((prev) => prev.map((ri) =>
    ri.item_id === itemId ? { ...ri, return_qty: qty } : ri
    ));
  };

  const handleSubmit = async () => {
    const validItems = returnItems.filter((ri) => (parseFloat(ri.return_qty) || 0) > 0);

    // Check for any item exceeding purchased quantity
    const exceedingItems = normalizedReturnItems.filter((ri) => (parseFloat(ri.return_qty) || 0) > ri.quantity);
    if (exceedingItems.length > 0) {
      showError(`Cannot return more than purchased for: ${exceedingItems.map((i) => i.item_name).join(', ')}`);
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
    header: 'Remarks'
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
          <button
        onClick={() => openEdit(info.row.original)}
        className="action-btn-edit">
        
            Edit
          </button>
          <button
        onClick={async () => {
          const ok = await showConfirm('Delete Return', 'Are you sure you want to delete this purchase return?');
          if (ok) deleteMutation.mutate(info.row.original.id);
        }}
        className="action-btn-delete">
        
            Delete
          </button>
        </div>

  }],
  [deleteMutation, showConfirm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Purchase Returns</h2>
        <Button
          onClick={() => {
            resetForm();
            setIsAdding(true);
          }}
          className="flex items-center gap-2">
          
          Record Return
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 rounded-xl border border-border-temple bg-white p-4 shadow-sm">
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
      </div>

      <div className="rounded-xl border border-border-temple overflow-hidden bg-white">
        <DataTable columns={columns} data={returns?.items || []} loading={isLoading} />
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent
          className="max-w-5xl max-h-[85vh] flex flex-col border-border-temple overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}>
          
          <DialogHeader>
            <DialogTitle className="text-text-main font-temple">
              {editingReturnId ? 'Edit Purchase Return' : 'New Purchase Return'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4 pr-1">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Card className="xl:col-span-1 border-border-temple">
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-medium">Return Date *</Label>
                    <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="h-10 text-text-main" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-medium">Select Vendor *</Label>
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
                      <Label className="text-text-main font-medium">Select Bill / Invoice *</Label>
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
                    <Label className="text-text-main font-medium">Remarks</Label>
                    <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason for return..." className="h-10 text-text-main" />
                  </div>
                </CardContent>
              </Card>

              <Card className="xl:col-span-2 border-border-temple">
                <CardContent className="p-6">
                  <h3 className="text-base font-bold text-primary uppercase tracking-widest mb-6">Return Items</h3>
                  {selectedBill ?
                  <div className="space-y-6">
                      <div className="flex flex-wrap gap-2 p-3 bg-bg-temple/20 rounded-lg border border-border-temple/40">
                        <p className="w-full text-base font-bold text-text-main/70 uppercase tracking-widest mb-1">Add Items from Bill:</p>
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

                      <div className="rounded-xl border border-border-temple overflow-hidden shadow-sm">
                        <table className="w-full text-base">
                          <thead className="bg-bg-temple border-b border-border-temple">
                            <tr>
                              <th className="text-left px-4 py-3 font-bold text-text-main">Item</th>
                              <th className="text-right px-4 py-3 font-bold text-text-main">Purchased Qty</th>
                              <th className="text-right px-4 py-3 font-bold text-text-main w-32">Return Qty</th>
                              <th className="text-right px-4 py-3 font-bold text-text-main">Price</th>
                              <th className="text-right px-4 py-3 font-bold text-text-main">Total</th>
                              <th className="w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-temple/40">
                            {normalizedReturnItems.map((ri) => {
                            const isInvalid = (parseFloat(ri.return_qty) || 0) > ri.quantity;
                            return (
                              <tr key={ri.item_id} className={cn("bg-white hover:bg-bg-temple/5 transition-colors", isInvalid && "bg-red-50/50")}>
                                  <td className="px-4 py-3 font-medium text-text-main">{ri.item_name}</td>
                                  <td className="text-right px-4 py-3 text-text-main/70">{ri.quantity} {ri.unit_name}</td>
                                  <td className="px-4 py-3">
                                    <Input
                                    type="text"
                                    inputMode="decimal"
                                    className={cn(
                                      "w-full text-right h-9 border-primary/30 focus:border-primary font-bold",
                                      isInvalid && "border-red-500 focus:border-red-600 text-red-600"
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
                                        Max: {ri.quantity}
                                      </p>
                                  }
                                  </td>
                                  <td className="text-right px-4 py-3 text-text-main font-medium">₹{parseFloat(ri.price).toLocaleString()}</td>
                                  <td className="text-right px-4 py-3 font-bold text-text-main">
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

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                        <div className="flex flex-col">
                          <span className="text-base font-bold text-text-main/70 uppercase tracking-widest">Total Return Amount</span>
                          <span className="text-3xl font-black text-primary">
                            ₹{normalizedReturnItems.reduce((acc, curr) => acc + (parseFloat(curr.return_qty) || 0) * curr.price, 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div> :

                  <div className="flex flex-col items-center justify-center h-64 text-text-main/30 border-2 border-dashed border-border-temple/60 rounded-xl bg-bg-temple/5">
                      <FileText className="w-16 h-16 mb-3 opacity-20" />
                      <p className="font-bold uppercase tracking-widest text-base">Please select a vendor and bill first</p>
                    </div>
                  }
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter className="gap-3 mt-8">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAdding(false)}
              className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2] font-bold">
              
              Cancel
            </Button>
            <Button
              className="w-32 h-10 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest shadow-lg border-none"
              onClick={handleSubmit}
              disabled={mutation.isPending || normalizedReturnItems.length === 0}>
              
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[1600px] max-w-[92vw] max-h-[92vh] overflow-hidden border-border-temple bg-[#FDFBF7]">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main font-temple text-2xl">Purchase Return Details</DialogTitle>
          </DialogHeader>
          {viewingReturn &&
          <div className="py-4 max-h-[calc(92vh-155px)] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* Left Side: Original Purchase Details */}
                <Card className="border border-[#D8C8B8] shadow-sm bg-white overflow-hidden flex flex-col h-full min-w-0">
                  <div className="bg-[#F6EEDF] px-6 py-3 border-b border-[#D8C8B8]">
                    <h3 className="text-base font-black text-primary uppercase tracking-widest">Original Purchase</h3>
                  </div>
                  <CardContent className="p-0 flex-1 flex flex-col">
                    <div className="flex flex-col gap-1 p-6 bg-white border-b border-gray-100 min-h-[200px]">
                      <DetailItem className="text-base" label="Invoice No" value={viewingReturn.purchase_entry?.bill_no || 'N/A'} valueClassName="font-bold text-[#5D4037]" />
                      <DetailItem className="text-base" label="Purchase Date" value={viewingReturn.purchase_entry ? formatDate(viewingReturn.purchase_entry.purchase_date) : 'N/A'} />
                      <DetailItem className="text-base" label="Bill Amount" value={viewingReturn.purchase_entry ? `₹${parseFloat(viewingReturn.purchase_entry.total_amount).toLocaleString()}` : 'N/A'} valueClassName="font-bold text-[#5D4037]" />
                      <DetailItem className="text-base" label="Vendor" value={viewingReturn.vendor?.vendor_name || 'N/A'} />
                    </div>
                    <div className="flex-1 overflow-auto bg-gray-50/30">
                      <table className="min-w-[620px] w-full text-base text-left table-fixed">
                        <thead className="bg-[#FAF7F2] border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 font-bold text-[#7A5C4D]">Item</th>
                            <th className="px-6 py-3 font-bold text-[#7A5C4D] text-right w-28">Qty</th>
                            <th className="px-6 py-3 font-bold text-[#7A5C4D] text-right w-32">Price</th>
                            <th className="px-6 py-3 font-bold text-[#7A5C4D] text-right w-36">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(viewingReturn.items || []).map((it) =>
                        <tr key={it.id} className="bg-white">
                              <td className="px-6 py-4 text-[#3E2723] font-medium truncate" title={it.item_name}>{it.item_name || 'N/A'}</td>
                              <td className="px-6 py-4 text-[#5D4037] text-right">
                                {it.original_purchase_qty !== null ? `${parseFloat(it.original_purchase_qty).toFixed(3)} ${it.unit || ''}` : 'N/A'}
                              </td>
                              <td className="px-6 py-4 text-[#5D4037] text-right">₹{it.original_purchase_price !== null ? parseFloat(it.original_purchase_price).toLocaleString() : parseFloat(it.price).toLocaleString()}</td>

                              <td className="px-6 py-4 text-[#3E2723] font-bold text-right">
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
                  <div className="bg-[#F6EEDF] px-6 py-3 border-b border-[#D8C8B8] flex justify-between items-center">
                    <h3 className="text-base font-black text-primary uppercase tracking-widest">Return Entry</h3>
                    <span className="text-sm font-bold bg-[#5D4037] text-white px-3 py-1 rounded-full tracking-wider">RETURNED</span>
                  </div>
                  <CardContent className="p-0 flex-1 flex flex-col">
                    <div className="flex flex-col gap-1 p-6 bg-white border-b border-gray-100 min-h-[200px]">
                      <DetailItem className="text-base" label="Return Date" value={formatDate(viewingReturn.return_date)} />
                      <DetailItem className="text-base" label="Total Refund" value={`₹${parseFloat(viewingReturn.total_return_amount).toLocaleString()}`} valueClassName="font-bold text-[#5D4037]" />
                      <DetailItem className="text-base" label="Remarks" value={viewingReturn.remarks || 'None'} />
                    </div>
                    <div className="flex-1 overflow-auto bg-gray-50/30">
                      <table className="min-w-[620px] w-full text-base text-left table-fixed">
                        <thead className="bg-[#FAF7F2] border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 font-bold text-[#7A5C4D]">Item</th>
                            <th className="px-6 py-3 font-bold text-[#7A5C4D] text-right w-28">Qty</th>
                            <th className="px-6 py-3 font-bold text-[#7A5C4D] text-right w-32">Price</th>
                            <th className="px-6 py-3 font-bold text-[#7A5C4D] text-right w-36">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(viewingReturn.items || []).map((it) =>
                        <tr key={it.id} className="bg-white">
                              <td className="px-6 py-4 text-[#3E2723] font-medium truncate" title={it.item_name}>{it.item_name || 'N/A'}</td>
                              <td className="px-6 py-4 text-[#5D4037] text-right">{parseFloat(it.quantity).toFixed(3)} {it.unit || ''}</td>
                              <td className="px-6 py-4 text-[#5D4037] text-right">₹{parseFloat(it.price).toLocaleString()}</td>
                              <td className="px-6 py-4 text-[#3E2723] font-bold text-right">₹{parseFloat(it.line_total).toLocaleString()}</td>
                            </tr>
                        )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>
          }
          <DialogFooter className="border-t border-border-temple/40 pt-4">
            <Button onClick={() => setViewDialogOpen(false)} className="bg-primary hover:bg-secondary text-white px-10 border-none shadow-none uppercase font-black tracking-widest h-12 rounded-xl">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

};

export default PurchaseReturnsPage;