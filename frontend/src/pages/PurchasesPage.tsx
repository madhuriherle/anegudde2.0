import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  Trash,
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
} from '../components/ui/Dialog';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { DetailItem } from '../components/ui/DetailItem';

// Helper to validate and transform text input to number
const numericString = z.string()
  .refine((val) => !isNaN(Number(val)) && val.trim() !== '', { message: "Must be a valid number" })
  .transform((val) => Number(val));

const purchaseItemSchema = z.object({
  item_id: z.coerce.number().min(1, 'Item is required'),
  quantity: numericString.pipe(z.number().min(0.001, 'Min quantity is 0.001')),
  price: numericString.pipe(z.number().min(0, 'Price cannot be negative')),
  search_id: z.string().optional(),
});

const purchaseSchema = z.object({
  vendor_id: z.coerce.number().min(1, 'Vendor is required'),
  purchase_date: z.string().min(1, 'Date is required'),
  bill_no: z.string().optional(), 
  invoice_amount: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), { message: "Invalid amount" })
    .transform((val) => val ? Number(val) : 0),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

const PurchasesPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<any>(null);
  const [isManualInvoiceAmount, setIsManualInvoiceAmount] = useState(false);

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['purchases', search, pageSize, fromDate, toDate],
    queryFn: async () => {
      const params: any = { q: search, page_size: pageSize };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const res = await api.get('/purchases/list_purchases', { params });
      return res.data;
    },
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: async () => (await api.get('/vendors/list_vendors')).data,
  });

  const { data: items } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => (await api.get('/items/list_items')).data,
  });

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors } } = useForm<any>({
    resolver: zodResolver(purchaseSchema) as any,
    defaultValues: {
      purchase_date: new Date().toISOString().split('T')[0],
      invoice_amount: '0',
      items: [{ item_id: '' as any, quantity: '0', price: '0', search_id: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');
  const watchedInvoiceAmount = watch('invoice_amount');
  
  const totalAmount = (watchedItems || []).reduce((sum: number, item: any) => {
    const q = Number(item.quantity) || 0;
    const p = Number(item.price) || 0;
    return sum + (q * p);
  }, 0);

  // Sync invoice_amount with totalAmount if not manually overridden
  React.useEffect(() => {
    if (!isManualInvoiceAmount) {
      setValue('invoice_amount', String(totalAmount));
    }
  }, [totalAmount, isManualInvoiceAmount, setValue]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const { id, isEditMode, ...data } = payload;
      if (isEditMode && !id) {
        throw new Error('Missing purchase ID for update');
      }
      const cleanData = {
        ...data,
        items: data.items.map(({ search_id, ...rest }: any) => rest)
      };
      if (id) {
        return api.put(`/purchases/update_purchase/${id}`, { ...cleanData, user_id: user?.id, status: 1 });
      }
      return api.post('/purchases/create_purchase', { ...cleanData, user_id: user?.id, status: 1 });
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
    mutationFn: async (id: number) => api.delete(`/purchases/delete_purchase/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      showSuccess('Purchase deleted successfully');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Failed to delete purchase'),
  });

  const handleOpen = async (purchase: any = null) => {
    setIsManualInvoiceAmount(false);
    if (purchase) {
      try {
        const res = await api.get(`/purchases/get_purchase/${purchase.id}`);
        const fullData = res.data;
        
        // Check if the saved invoice_amount is manual (different from items sum)
        const initialTotal = (fullData.items || []).reduce((s: number, i: any) => s + (Number(i.quantity) * Number(i.price)), 0);
        setIsManualInvoiceAmount(Number(fullData.invoice_amount) !== initialTotal && Number(fullData.invoice_amount) !== 0);

        setEditingPurchase(fullData);
        reset({
          purchase_date: fullData.purchase_date,
          vendor_id: fullData.vendor_id,
          bill_no: fullData.bill_no || '',
          invoice_amount: String(fullData.invoice_amount || 0),
          items: fullData.items.map((item: any) => ({
            item_id: item.item_id,
            quantity: String(item.quantity),
            price: String(item.price),
            search_id: String(item.item_id)
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
        invoice_amount: '0',
        items: [{ item_id: '' as any, quantity: '0', price: '0', search_id: '' }],
      });
    }
    setOpen(true);
  };

  const handleView = async (purchase: any) => {
    try {
      const res = await api.get(`/purchases/get_purchase/${purchase.id}`);
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
      mutation.mutate({ ...data, id: editingPurchase?.id, isEditMode: Boolean(editingPurchase) });
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'purchase_date',
      header: 'Date',
      cell: info => <span className="text-text-main">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'bill_no',
      header: 'Invoice No',
      cell: info => <span className="text-text-main font-medium">{info.getValue() as string || '-'}</span>,
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
      accessorKey: 'invoice_amount',
      header: 'Grand Total',
      cell: info => {
        const entry = info.row.original;
        const total = Number(entry.invoice_amount || entry.total_amount);
        return <span className="text-text-main font-bold text-lg">₹{total.toLocaleString()}</span>;
      }
    },
    {
      id: 'actions',
      header: "Actions",
      cell: info => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          <button onClick={() => handleOpen(info.row.original)} className="action-btn-edit">Edit</button>
          <button
            onClick={async () => {
              const confirmed = await showConfirm('Delete Purchase', `Are you sure you want to delete this purchase entry?`);
              if (confirmed) {
                deleteMutation.mutate(info.row.original.id);
              }
            }}
            className="action-btn-delete"
          >
            Delete
          </button>
        </div>
      )
    }
  ], [vendors, deleteMutation, showConfirm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-text-main text-2xl font-semibold font-temple">Purchase Entries</h2>
        </div>
        <Button onClick={() => handleOpen()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Purchase
        </Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 w-full sm:w-44">
              <Label className="text-text-main font-medium">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-text-main"
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-44">
              <Label className="text-text-main font-medium">To Date</Label>
              <Input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-text-main"
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-72">
              <Label className="text-text-main font-medium">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-main/50" />
                <Input
                  placeholder="Bill No, Vendor, or Item..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 text-text-main"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border-temple overflow-hidden bg-white">
        <DataTable 
          columns={columns} 
          data={purchases || []} 
          loading={purchasesLoading} 
        />
      </div>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main font-temple">Purchase Summary</DialogTitle>
            <DialogDescription className="sr-only">Detailed breakdown of the selected purchase entry.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-0 mt-4">
            <DetailItem label="Purchase Date" value={viewingPurchase?.purchase_date} />
            <DetailItem label="Invoice No" value={viewingPurchase?.bill_no} />
            <DetailItem label="Vendor" value={vendors?.find((v: any) => v.id === viewingPurchase?.vendor_id)?.vendor_name} />
          </div>

          <Card className="bg-bg-temple/40 border-border-temple/40 border shadow-none mt-4">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <span className="text-primary font-bold uppercase text-sm">Invoice Grand Total</span>
                <span className="text-primary font-bold text-xl">
                  ₹{Number(viewingPurchase?.invoice_amount || viewingPurchase?.total_amount).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Items Purchased</h4>
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

          <DialogFooter className="mt-8 border-t border-border-temple/40 pt-4">
            <Button onClick={() => setViewDialogOpen(false)} className="bg-primary hover:bg-secondary text-white px-10 border-none shadow-none">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto border-border-temple">
          <DialogHeader>
            <DialogTitle className="text-text-main font-temple">
              {editingPurchase ? 'Edit Purchase Entry' : 'Record New Purchase'}
            </DialogTitle>
            <DialogDescription className="sr-only">Form to record or update a purchase from a vendor.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-text-main">Select Vendor *</Label>
                <Controller
                  name="vendor_id"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} className="w-full h-10">
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
                <Input type="date" {...register('purchase_date')} className="h-10 text-text-main" />
                {errors.purchase_date && <p className="text-xs text-red-500 font-medium">{errors.purchase_date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Invoice/Bill Number</Label>
                <Input {...register('bill_no')} placeholder="e.g. INV-1234" className="h-10 text-text-main" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Total Bill Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-main/50 font-bold">₹</span>
                  <Controller
                    name="invoice_amount"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        type="text" 
                        {...field} 
                        className="pl-8 h-10 text-text-main font-bold" 
                        placeholder="0"
                        onChange={(e) => {
                          field.onChange(e);
                          setIsManualInvoiceAmount(true);
                        }}
                      />
                    )}
                  />
                </div>
                {errors.invoice_amount && <p className="text-[10px] text-red-500 font-bold uppercase">{(errors.invoice_amount as any).message}</p>}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border-temple pb-2">
                <h4 className="text-sm font-bold text-primary uppercase tracking-widest">Items in Purchase</h4>
              </div>
              
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-white p-3 rounded-lg border border-border-temple/40 shadow-sm relative">
                    <div className="sm:col-span-1 space-y-1.5">
                      {index === 0 && <Label className="text-xs font-bold uppercase text-text-main">ID</Label>}
                      <Input 
                        type="text" 
                        placeholder="ID"
                        className="h-9 text-sm text-center font-bold text-text-main border-primary/30"
                        {...register(`items.${index}.search_id` as const)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setValue(`items.${index}.search_id`, val);
                          if (val && items) {
                            const item = items.find((i: any) => String(i.id) === val);
                            if (item) {
                              setValue(`items.${index}.item_id`, item.id);
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="sm:col-span-4 space-y-1.5">
                      {index === 0 && <Label className="text-xs font-bold uppercase text-text-main">Item Name *</Label>}
                      <Controller
                        name={`items.${index}.item_id` as const}
                        control={control}
                        render={({ field: itemField }) => (
                          <Select 
                            {...itemField} 
                            className="w-full h-9 text-sm text-text-main font-bold"
                            onChange={(val) => {
                              itemField.onChange(val);
                              setValue(`items.${index}.search_id`, String(val.target.value));
                            }}
                          >
                            <option value="">Select Item</option>
                            {items?.filter((i: any) => i.status === 1 || watchedItems?.[index]?.item_id === i.id).map((i: any) => (
                              <option key={i.id} value={i.id}>{i.item_name}</option>
                            ))}
                          </Select>
                        )}
                      />
                      {errors.items?.[index]?.item_id && <p className="text-[10px] text-red-500 font-bold">Required</p>}
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      {index === 0 && <Label className="text-xs font-bold uppercase text-text-main">Qty *</Label>}
                      <Input type="text" {...register(`items.${index}.quantity` as const)} className="h-9 text-sm font-bold text-text-main" />
                      {errors.items?.[index]?.quantity && <p className="text-[10px] text-red-500 font-bold uppercase">{(errors.items[index]?.quantity as any).message}</p>}
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      {index === 0 && <Label className="text-xs font-bold uppercase text-text-main">Price *</Label>}
                      <Input type="text" {...register(`items.${index}.price` as const)} className="h-9 text-sm font-bold text-text-main" />
                      {errors.items?.[index]?.price && <p className="text-[10px] text-red-500 font-bold uppercase">{(errors.items[index]?.price as any).message}</p>}
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                       {index === 0 && <Label className="text-xs font-bold uppercase text-text-main w-full">Subtotal</Label>}
                       <div className="h-9 flex items-center">
                         <span className="font-black text-primary text-base">
                          ₹{( (Number(watchedItems?.[index]?.quantity) || 0) * (Number(watchedItems?.[index]?.price) || 0) ).toLocaleString()}
                         </span>
                       </div>
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} disabled={fields.length === 1} className="h-9 w-9 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border-temple/40">
                <Button type="button" size="sm" variant="outline" onClick={() => append({ item_id: '' as any, quantity: '0', price: '0', search_id: '' })} className="h-10 text-xs font-bold border-primary text-primary hover:bg-primary hover:text-white transition-colors">
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
                
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-text-main uppercase tracking-widest">Grand Total:</span>
                  <span className="text-4xl font-black text-primary">
                    ₹{(Number(watchedInvoiceAmount) > 0 ? Number(watchedInvoiceAmount) : totalAmount).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-3 mt-8">
              <Button type="button" variant="ghost" onClick={handleClose} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2] font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="w-32 h-10 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest shadow-lg border-none">
                {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchasesPage;
