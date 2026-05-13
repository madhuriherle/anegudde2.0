import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, FileText, ArrowLeft } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
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

const PurchaseReturnsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  const [isAdding, setIsAdding] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [selectedBill, setSelectedBill] = useState<string>('');
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [remarks, setRemarks] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingReturnId, setEditingReturnId] = useState<number | null>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingReturn, setViewingReturn] = useState<any>(null);

  // Data Fetching
  const { data: returns, isLoading } = useQuery({
    queryKey: ['purchase-returns'],
    queryFn: async () => {
      const res = await api.get('/purchases/list_returns');
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
    mutationFn: (payload: any) =>
      editingReturnId
        ? api.put(`/purchases/update_return/${editingReturnId}`, payload)
        : api.post('/purchases/create_return', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
      showSuccess(editingReturnId ? 'Purchase return updated' : 'Purchase return recorded');
      setIsAdding(false);
      resetForm();
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Failed to save')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/purchases/delete_return/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
      showSuccess('Purchase return deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Failed to delete')
  });

  const resetForm = () => {
    setSelectedVendor('');
    setSelectedBill('');
    setReturnItems([]);
    setRemarks('');
    setEditingReturnId(null);
    setReturnDate(new Date().toISOString().split('T')[0]);
  };

  const handleAddItem = (item: any) => {
    if (returnItems.find(ri => ri.item_id === item.item_id)) return;
    setReturnItems([...returnItems, { ...item, return_qty: 0 }]);
  };

  const openEdit = (row: any) => {
    setEditingReturnId(row.id);
    setReturnDate(new Date(row.return_date).toISOString().split('T')[0]);
    setSelectedVendor(String(row.vendor_id));
    setSelectedBill(String(row.purchase_entry_id || ''));
    setRemarks(row.remarks || '');
    setReturnItems(
      (row.items || []).map((it: any) => ({
        item_id: it.item_id,
        item_name: it.item_name,
        quantity: 0,
        unit_name: '',
        price: Number(it.price || 0),
        return_qty: Number(it.quantity || 0),
      }))
    );
    setIsAdding(true);
  };

  const handleQtyChange = (itemId: number, qty: string) => {
    const cleaned = qty.trim();
    if (cleaned !== '' && !/^\d*\.?\d*$/.test(cleaned)) {
      showError('Please enter valid numeric quantity');
      return;
    }

    if (cleaned === '') {
      setReturnItems(prev => prev.map(ri =>
        ri.item_id === itemId ? { ...ri, return_qty: '' as any } : ri
      ));
      return;
    }

    const numQty = parseFloat(qty) || 0;
    const originalItem = billItems.find((bi: any) => bi.item_id === itemId);
    
    if (originalItem && numQty > originalItem.quantity) {
      showError(`Cannot return more than purchased (${originalItem.quantity})`);
      return;
    }

    setReturnItems(prev => prev.map(ri => 
      ri.item_id === itemId ? { ...ri, return_qty: numQty } : ri
    ));
  };

  const handleSubmit = async () => {
    const validItems = returnItems.filter(ri => ri.return_qty > 0);
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
        items: validItems.map(vi => ({
          item_id: vi.item_id,
          quantity: vi.return_qty,
          price: vi.price
        }))
      });
    }
  };

  const availableBillItems = useMemo(() => {
    const selectedIds = new Set(returnItems.map((ri) => ri.item_id));
    return (billItems || []).filter((bi: any) => !selectedIds.has(bi.item_id));
  }, [billItems, returnItems]);

  const normalizedReturnItems = useMemo(() => {
    const billMap = new Map((billItems || []).map((bi: any) => [bi.item_id, bi]));
    return returnItems.map((ri: any) => {
      const bi = billMap.get(ri.item_id);
      return {
        ...ri,
        item_name: ri.item_name || bi?.item_name || 'N/A',
        quantity: bi?.quantity ?? ri.quantity ?? 0,
        unit_name: bi?.unit_name ?? ri.unit_name ?? '',
      };
    });
  }, [billItems, returnItems]);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'return_date',
      header: 'Date',
      cell: info => new Date(info.getValue() as string).toLocaleDateString()
    },
    {
      accessorKey: 'vendor.vendor_name',
      header: 'Vendor',
      cell: info => info.row.original.vendor?.vendor_name || 'N/A'
    },
    {
      accessorKey: 'total_return_amount',
      header: 'Amount',
      cell: info => `₹${parseFloat(info.getValue() as string).toLocaleString()}`
    },
    {
      accessorKey: 'remarks',
      header: 'Remarks'
    },
    {
      id: 'actions',
      header: () => <div className="text-center">Actions</div>,
      cell: info => (
        <div className="flex items-center justify-center gap-2">
          <button 
            onClick={() => {
              setViewingReturn(info.row.original);
              setViewDialogOpen(true);
            }} 
            className="action-btn-view"
          >
            View
          </button>
          <button
            onClick={() => openEdit(info.row.original)}
            className="action-btn-edit"
          >
            Edit
          </button>
          <button
            onClick={async () => {
              const ok = await showConfirm('Delete Return', 'Are you sure you want to delete this purchase return?');
              if (ok) deleteMutation.mutate(info.row.original.id);
            }}
            className="action-btn-delete"
          >
            Delete
          </button>
        </div>
      )
    }
  ], [deleteMutation, showConfirm]);

  if (isAdding) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAdding(false)}
            className="group flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6 text-text-main group-hover:-translate-x-1 transition-transform" />
          </button>
          <h2 className="page-title mb-0">{editingReturnId ? 'Edit Purchase Return' : 'New Purchase Return'}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Return Date</Label>
                <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
              </div>
              <div>
                <Label>Select Vendor</Label>
                <Select 
                  value={selectedVendor} 
                  onChange={e => {
                    setSelectedVendor(e.target.value);
                    setSelectedBill('');
                    setReturnItems([]);
                  }}
                >
                  <option value="">Select Vendor</option>
                  {vendors?.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.vendor_name}</option>
                  ))}
                </Select>
              </div>
              {selectedVendor && (
                <div>
                  <Label>Select Bill</Label>
                  <Select 
                    value={selectedBill} 
                    onChange={e => {
                      setSelectedBill(e.target.value);
                      setReturnItems([]);
                    }}
                  >
                    <option value="">Select Bill</option>
                    {bills?.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        Inv: {b.bill_no || 'N/A'} | {new Date(b.purchase_date).toLocaleDateString()} | ₹{parseFloat(b.total_amount).toLocaleString()}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div>
                <Label>Remarks</Label>
                <Input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Reason for return..." />
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4">Return Items</h3>
              {selectedBill ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 mb-6">
                    {availableBillItems.map((bi: any) => (
                      <Button 
                        key={bi.item_id} 
                        variant="ghost" 
                        size="sm" 
                        className="bg-primary/5 hover:bg-primary/10 border border-primary/20"
                        onClick={() => handleAddItem(bi)}
                      >
                        + {bi.item_name}
                      </Button>
                    ))}
                    {availableBillItems.length === 0 && (
                      <span className="text-sm text-gray-500">All bill items added</span>
                    )}
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Item</th>
                        <th className="text-right py-2">Purchased Qty</th>
                        <th className="text-right py-2">Return Qty</th>
                        <th className="text-right py-2">Price</th>
                        <th className="text-right py-2">Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalizedReturnItems.map(ri => (
                        <tr key={ri.item_id} className="border-b">
                          <td className="py-2 font-medium">{ri.item_name}</td>
                          <td className="text-right py-2 text-gray-500">{ri.quantity} {ri.unit_name}</td>
                          <td className="py-2 text-right">
                            <Input 
                              type="text"
                              inputMode="decimal"
                              className="w-24 ml-auto text-right h-8" 
                              value={ri.return_qty}
                              onFocus={() => {
                                if (Number(ri.return_qty) === 0) {
                                  setReturnItems(prev => prev.map(p =>
                                    p.item_id === ri.item_id ? { ...p, return_qty: '' as any } : p
                                  ));
                                }
                              }}
                              onChange={e => handleQtyChange(ri.item_id, e.target.value)}
                            />
                          </td>
                          <td className="text-right py-2">₹{parseFloat(ri.price).toLocaleString()}</td>
                          <td className="text-right py-2 font-bold">
                            ₹{(ri.return_qty * ri.price).toLocaleString()}
                          </td>
                          <td className="text-right pl-2">
                            <button onClick={() => setReturnItems(prev => prev.filter(p => p.item_id !== ri.item_id))}>
                              <Trash2 className="w-4 h-4 text-error" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {normalizedReturnItems.length > 0 && (
                        <tr className="bg-gray-50 font-bold">
                          <td colSpan={4} className="py-3 px-2">Total Return Amount</td>
                          <td className="text-right py-3 px-2 text-primary">
                            ₹{normalizedReturnItems.reduce((acc, curr) => acc + (curr.return_qty * curr.price), 0).toLocaleString()}
                          </td>
                          <td></td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <Button 
                    className="w-full mt-6" 
                    onClick={handleSubmit}
                    disabled={mutation.isPending || normalizedReturnItems.length === 0}
                  >
                    {editingReturnId ? 'Update Return' : 'Process Return'}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 border-2 border-dashed rounded-lg">
                  <FileText className="w-12 h-12 mb-2 opacity-20" />
                  <p>Please select a vendor and bill first</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Purchase Returns</h2>
        <Button
          onClick={() => {
            resetForm();
            setIsAdding(true);
          }}
          className="flex items-center gap-2"
        >
          Record Return
        </Button>
      </div>

      <Card>
        <DataTable columns={columns} data={returns?.items || []} loading={isLoading} />
      </Card>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Purchase Return Details</DialogTitle>
          </DialogHeader>
          {viewingReturn && (
            <div className="space-y-6 py-2 mb-6">
              <div className="space-y-0">
                <DetailItem label="Return Date" value={new Date(viewingReturn.return_date).toLocaleDateString()} />
                <DetailItem label="Vendor Name" value={viewingReturn.vendor?.vendor_name} />
                <DetailItem label="Total Amount" value={`₹${parseFloat(viewingReturn.total_return_amount).toLocaleString()}`} valueClassName="font-bold text-primary text-base" />
                <DetailItem label="Remarks" value={viewingReturn.remarks} />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Returned Items</h4>
                <div className="border rounded-lg overflow-hidden border-border-temple">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-bg-temple border-b border-border-temple">
                      <tr>
                        <th className="px-4 py-2 font-bold text-text-main">Item Name</th>
                        <th className="px-4 py-2 font-bold text-text-main text-right">Qty</th>
                        <th className="px-4 py-2 font-bold text-text-main text-right">Price</th>
                        <th className="px-4 py-2 font-bold text-text-main text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-temple/40">
                      {viewingReturn.items.map((it: any) => (
                        <tr key={it.id} className="bg-white">
                          <td className="px-4 py-2 text-text-main">{it.item_name || 'N/A'}</td>
                          <td className="px-4 py-2 text-text-main text-right">{it.quantity}</td>
                          <td className="px-4 py-2 text-text-main text-right">₹{parseFloat(it.price).toLocaleString()}</td>
                          <td className="px-4 py-2 text-text-main text-right font-medium">₹{parseFloat(it.line_total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewDialogOpen(false)} className="bg-primary hover:bg-secondary text-white px-10 border-none shadow-none">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseReturnsPage;
