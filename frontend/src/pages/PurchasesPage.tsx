import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Eye,
  Save,
  Trash,
  Info,
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
} from '../components/ui/Dialog';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { DetailItem } from '../components/ui/DetailItem';

const purchaseItemSchema = z.object({
  item_id: z.coerce.number().min(1, 'Item is required'),
  quantity: z.coerce.number().min(0.001, 'Min quantity is 0.001'),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
});

const purchaseSchema = z.object({
  vendor_id: z.coerce.number().min(1, 'Vendor is required'),
  purchase_date: z.string().min(1, 'Date is required'),
  bill_no: z.string().optional(), 
  invoice_amount: z.coerce.number().min(0, 'Invoice amount cannot be negative').optional(),
  sgst: z.coerce.number().min(0, 'SGST cannot be negative').default(0),
  cgst: z.coerce.number().min(0, 'CGST cannot be negative').default(0),
  igst: z.coerce.number().min(0, 'IGST cannot be negative').default(0),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

const PurchasesPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [searchField, setSearchField] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<any>(null);

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['purchases', search, pageSize, status, searchField],
    queryFn: async () => {
      const params: any = { q: search, page_size: pageSize };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      if (searchField !== 'all') params.search_field = searchField;
      const res = await api.get('/purchases', { params });
      return res.data;
    },
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: async () => (await api.get('/vendors')).data,
  });

  const { data: items } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => (await api.get('/items')).data,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      purchase_date: new Date().toISOString().split('T')[0],
      items: [{ item_id: '' as any, quantity: 0, price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');
  const totalAmount = watchedItems?.reduce((sum, item) => sum + (item.quantity * item.price || 0), 0) || 0;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingPurchase) {
        return api.put(`/purchases/${editingPurchase.id}`, { ...data, user_id: user?.id, status: 1 });
      }
      return api.post('/purchases', { ...data, user_id: user?.id, status: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      showSuccess(editingPurchase ? 'Purchase updated successfully' : 'Purchase recorded successfully');
      handleClose();
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Failed to save purchase');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/purchases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      showSuccess('Purchase deleted successfully');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Failed to delete purchase'),
  });

  const handleOpen = async (purchase: any = null) => {
    if (purchase) {
      try {
        const res = await api.get(`/purchases/${purchase.id}`);
        const fullData = res.data;
        setEditingPurchase(fullData);
        reset({
          purchase_date: fullData.purchase_date,
          vendor_id: fullData.vendor_id,
          bill_no: fullData.bill_no || '',
          invoice_amount: fullData.invoice_amount || 0,
          sgst: fullData.sgst || 0,
          cgst: fullData.cgst || 0,
          igst: fullData.igst || 0,
          items: fullData.items.map((item: any) => ({
            item_id: item.item_id,
            quantity: item.quantity,
            price: item.price
          })),
        });
      } catch (err) {
        showError('Failed to fetch purchase details');
        return;
      }
    } else {
      setEditingPurchase(null);
      reset({
        purchase_date: new Date().toISOString().split('T')[0],
        vendor_id: '' as any,
        bill_no: '',
        invoice_amount: 0,
        sgst: 0,
        cgst: 0,
        igst: 0,
        items: [{ item_id: '' as any, quantity: 0, price: 0 }],
      });
    }
    setOpen(true);
  };

  const handleView = async (purchase: any) => {
    try {
      const res = await api.get(`/purchases/${purchase.id}`);
      setViewingPurchase(res.data);
      setViewDialogOpen(true);
    } catch (err) {
      showError('Failed to fetch purchase details');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEditingPurchase(null);
  };

  const onSubmit = async (data: PurchaseFormValues) => {
    const confirmed = await showConfirm(
      editingPurchase ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingPurchase ? 'update' : 'save'} this purchase?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const flattenedRows = useMemo(() => {
    if (!purchases) return [];
    return purchases.flatMap((p: any) => 
      p.items.map((item: any) => ({
        ...item,
        uniqueId: `p${p.id}-i${item.id}`,
        entryId: p.id,
        purchase_date: p.purchase_date,
        vendor_id: p.vendor_id,
        bill_no: p.bill_no,
        entry: p 
      }))
    );
  }, [purchases]);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'entryId',
      header: 'ID',
      cell: info => <span className="text-text-main font-mono">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'purchase_date',
      header: 'Date',
      cell: info => <span className="text-text-main">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'bill_no',
      header: 'Invoice No',
      cell: info => <span className="text-text-main">{info.getValue() as string || '-'}</span>,
    },
    {
      accessorKey: 'vendor_id',
      header: 'Vendor',
      cell: info => {
        const vendor = vendors?.find((v: any) => v.id === info.getValue());
        return <span className="text-text-main">{vendor ? vendor.vendor_name : (info.getValue() as string)}</span>;
      }
    },
    {
      accessorKey: 'item_id',
      header: 'Item',
      cell: info => {
        const item = items?.find((i: any) => i.id === info.getValue());
        return <span className="text-text-main">{item ? item.item_name : (info.getValue() as string)}</span>;
      }
    },
    {
      accessorKey: 'quantity',
      header: () => <div className="text-right">Qty</div>,
      cell: info => <div className="text-right text-text-main">{info.getValue() as string}</div>,
    },
    {
      accessorKey: 'price',
      header: () => <div className="text-right">Price</div>,
      cell: info => <div className="text-right text-text-main">₹{Number(info.getValue()).toLocaleString()}</div>,
    },
    {
      accessorKey: 'line_total',
      header: () => <div className="text-right">Total</div>,
      cell: info => <div className="text-right font-bold text-primary-main">₹{Number(info.getValue()).toLocaleString()}</div>,
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: info => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleView(info.row.original.entry)} className="h-8 w-8 p-0">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleOpen(info.row.original.entry)} className="h-8 w-8 p-0">
            <Edit className="h-4 w-4 text-blue-600" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={async () => {
              const confirmed = await showConfirm('Delete Purchase', `Are you sure you want to delete this purchase entry?`);
              if (confirmed) {
                deleteMutation.mutate(info.row.original.entry.id);
              }
            }} 
            className="h-8 w-8 p-0"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      )
    }
  ], [vendors, items, deleteMutation, showConfirm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-text-main text-2xl font-semibold font-temple">Purchase Entries</h2>
          <p className="text-text-main/70">Record and track inventory purchases from vendors.</p>
        </div>
        <Button onClick={() => handleOpen()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Purchase
        </Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
             <div className="space-y-1.5">
              <Label className="text-text-main font-medium">Rows</Label>
              <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main font-medium">Status Filter</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main font-medium">Search Type</Label>
              <Select value={searchField} onChange={(e) => setSearchField(e.target.value)}>
                <option value="all">All Fields</option>
                <option value="bill_no">Bill No</option>
                <option value="vendor">Vendor</option>
                <option value="item">Item Name</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main font-medium">Quick Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-main/50" />
                <Input 
                  placeholder="Search purchases..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border-temple overflow-hidden bg-white">
        <DataTable 
          columns={columns} 
          data={flattenedRows} 
          loading={purchasesLoading} 
        />
      </div>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-border-temple">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-text-main font-temple">Purchase Summary</DialogTitle>
              <Badge>#{viewingPurchase?.id}</Badge>
            </div>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-x-6">
              <DetailItem label="Purchase Date" value={viewingPurchase?.purchase_date} />
              <DetailItem label="Invoice No" value={viewingPurchase?.bill_no} />
              <DetailItem label="Vendor" value={vendors?.find((v: any) => v.id === viewingPurchase?.vendor_id)?.vendor_name} />
              <DetailItem label="Recorded By" value={viewingPurchase?.user?.full_name} />
            </div>

            <Card className="bg-bg-temple/40 border-border-temple/40 border shadow-none">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-main font-medium uppercase text-xs tracking-wider">Items Subtotal</span>
                  <span className="text-text-main">₹{Number(viewingPurchase?.total_amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-main font-medium uppercase text-xs tracking-wider">SGST / CGST / IGST</span>
                  <span className="text-text-main">
                    ₹{Number(viewingPurchase?.sgst || 0).toLocaleString()} / ₹{Number(viewingPurchase?.cgst || 0).toLocaleString()} / ₹{Number(viewingPurchase?.igst || 0).toLocaleString()}
                  </span>
                </div>
                <div className="pt-2 border-t border-border-temple flex justify-between items-center">
                  <span className="text-primary-main font-bold uppercase text-sm">Invoice Grand Total</span>
                  <span className="text-primary-main font-bold text-xl">
                    ₹{Number(viewingPurchase?.invoice_amount || (Number(viewingPurchase?.total_amount) + Number(viewingPurchase?.sgst||0) + Number(viewingPurchase?.cgst||0) + Number(viewingPurchase?.igst||0))).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-primary-main uppercase tracking-wider">Items Purchased</h4>
              <div className="rounded-lg border border-border-temple overflow-hidden">
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
                    {viewingPurchase?.items?.map((item: any, idx: number) => (
                      <tr key={idx} className="bg-white">
                        <td className="px-4 py-2 text-text-main">{items?.find((i: any) => i.id === item.item_id)?.item_name}</td>
                        <td className="px-4 py-2 text-text-main text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-text-main text-right">₹{Number(item.price).toLocaleString()}</td>
                        <td className="px-4 py-2 text-text-main text-right font-medium">₹{Number(item.line_total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2 mt-6">
              <h4 className="text-sm font-bold text-text-main/60 uppercase tracking-wider px-1">Audit Information</h4>
              <div className="bg-bg-temple/20 p-4 rounded-lg border border-border-temple/40 grid grid-cols-2 gap-x-6">
                <DetailItem label="Created At" value={viewingPurchase?.created_at ? new Date(viewingPurchase.created_at).toLocaleString() : '-'} />
                <DetailItem label="Created By" value={users?.find((u: any) => u.id === viewingPurchase?.created_by)?.full_name || viewingPurchase?.user?.full_name || '-'} />
                <DetailItem label="Last Updated" value={viewingPurchase?.updated_at ? new Date(viewingPurchase.updated_at).toLocaleString() : '-'} />
                <DetailItem label="Updated By" value={users?.find((u: any) => u.id === viewingPurchase?.updated_by)?.full_name || '-'} />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-8">
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-border-temple">
          <DialogHeader>
            <DialogTitle className="text-text-main font-temple">
              {editingPurchase ? 'Edit Purchase Entry' : 'Record New Purchase'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-text-main">Select Vendor *</Label>
                <Controller
                  name="vendor_id"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} className="w-full">
                      <option value="">Choose Vendor</option>
                      {vendors?.filter((v: any) => v.status === 1 || v.id === editingPurchase?.vendor_id).map((v: any) => (
                        <option key={v.id} value={v.id}>{v.vendor_name} ({v.vendor_code})</option>
                      ))}
                    </Select>
                  )}
                />
                {errors.vendor_id && <p className="text-xs text-red-500 font-medium">{errors.vendor_id.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Purchase Date *</Label>
                <Input type="date" {...register('purchase_date')} />
                {errors.purchase_date && <p className="text-xs text-red-500 font-medium">{errors.purchase_date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Invoice/Bill Number</Label>
                <Input {...register('bill_no')} placeholder="e.g. INV-1234" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-text-main font-bold">Total Invoice Amount (Manual Override)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-main/50 font-bold">₹</span>
                  <Input type="number" step="0.01" {...register('invoice_amount')} className="pl-8" placeholder="Enter total bill amount" />
                </div>
                <p className="text-[10px] text-text-main/40 uppercase tracking-tight">Leave zero to auto-calculate from items + taxes</p>
              </div>

              <div className="md:col-span-2 grid grid-cols-3 gap-4 bg-bg-temple/20 p-4 rounded-lg border border-border-temple/40">
                <div className="space-y-1.5">
                  <Label className="text-text-main text-xs font-bold uppercase">SGST Amount</Label>
                  <Input type="number" step="0.01" {...register('sgst')} className="bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-text-main text-xs font-bold uppercase">CGST Amount</Label>
                  <Input type="number" step="0.01" {...register('cgst')} className="bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-text-main text-xs font-bold uppercase">IGST Amount</Label>
                  <Input type="number" step="0.01" {...register('igst')} className="bg-white" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border-temple pb-2">
                <h4 className="text-sm font-bold text-primary-main uppercase tracking-widest">Items in Purchase</h4>
                <Button type="button" size="sm" variant="outline" onClick={() => append({ item_id: '' as any, quantity: 0, price: 0 })} className="h-8 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              </div>
              
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-white p-3 rounded-lg border border-border-temple/40 shadow-sm relative">
                    <div className="sm:col-span-5 space-y-1.5">
                      {index === 0 && <Label className="text-xs font-bold uppercase text-text-main/60">Item Name *</Label>}
                      <Controller
                        name={`items.${index}.item_id` as const}
                        control={control}
                        render={({ field: itemField }) => (
                          <Select {...itemField} className="w-full h-9 text-sm">
                            <option value="">Select Item</option>
                            {items?.filter((i: any) => i.status === 1 || watchedItems?.[index]?.item_id === i.id).map((i: any) => (
                              <option key={i.id} value={i.id}>{i.item_name}</option>
                            ))}
                          </Select>
                        )}
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      {index === 0 && <Label className="text-xs font-bold uppercase text-text-main/60 text-right">Qty *</Label>}
                      <Input type="number" step="0.001" {...register(`items.${index}.quantity` as const)} className="h-9 text-sm text-right" />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      {index === 0 && <Label className="text-xs font-bold uppercase text-text-main/60 text-right">Price *</Label>}
                      <Input type="number" step="0.01" {...register(`items.${index}.price` as const)} className="h-9 text-sm text-right" />
                    </div>
                    <div className="sm:col-span-2 flex flex-col items-end gap-1.5 h-9 justify-center">
                       {index === 0 && <span className="text-[10px] font-bold uppercase text-text-main/40 absolute -top-1 right-12">Subtotal</span>}
                       <span className="font-bold text-text-main text-sm">₹{(watchedItems?.[index]?.quantity * watchedItems?.[index]?.price || 0).toLocaleString()}</span>
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} disabled={fields.length === 1} className="h-9 w-9 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-primary-main p-6 rounded-xl shadow-inner text-white space-y-4">
              <div className="flex justify-between items-center opacity-80 text-sm">
                <span>ITEMS SUBTOTAL</span>
                <span className="font-bold">₹{totalAmount.toLocaleString()}</span>
              </div>
              
              {(Number(watch('sgst')) > 0 || Number(watch('cgst')) > 0 || Number(watch('igst')) > 0) && (
                <div className="flex gap-6 py-2 px-4 bg-white/10 rounded-lg text-xs font-medium">
                  {Number(watch('sgst')) > 0 && <span>SGST: ₹{Number(watch('sgst')).toLocaleString()}</span>}
                  {Number(watch('cgst')) > 0 && <span>CGST: ₹{Number(watch('cgst')).toLocaleString()}</span>}
                  {Number(watch('igst')) > 0 && <span>IGST: ₹{Number(watch('igst')).toLocaleString()}</span>}
                </div>
              )}

              <div className="pt-4 border-t border-white/20 flex justify-between items-end">
                <div>
                  <h5 className="font-bold text-lg leading-none uppercase tracking-tighter">Grand Total</h5>
                  <p className="text-[10px] text-white/60 mt-1 uppercase">
                    {Number(watch('invoice_amount')) > 0 ? '(Using Manual Invoice Override)' : '(Auto-calculated Total)'}
                  </p>
                </div>
                <div className="text-4xl font-black">
                  ₹{Number(watch('invoice_amount') || (totalAmount + Number(watch('sgst')||0) + Number(watch('cgst')||0) + Number(watch('igst')||0))).toLocaleString()}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-3">
              <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="flex items-center gap-2">
                {mutation.isPending ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : <Save className="h-4 w-4" />}
                {editingPurchase ? 'Update Purchase' : 'Save Purchase'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchasesPage;
