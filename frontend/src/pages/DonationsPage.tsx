import React, { useMemo, useState, useEffect } from 'react';
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
import { DetailItem } from '../components/ui/DetailItem';
import { formatDate } from '../utils/date';
import { formatQuantityWithUnit } from '../utils/quantity';
import { cn } from '../utils/cn';
import { Plus, Trash2, Search } from 'lucide-react';

const formSchema = z.object({
  donation_type: z.coerce.number().default(1),
  donation_date: z.string().min(1, 'Date is required'),
  devotee_name: z.string().min(1, 'Devotee name is required'),
  phone_number: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(z.object({
    item_id: z.coerce.number().min(1, 'Item is required'),
    quantity: z.coerce.number().min(0.001, 'Quantity is required'),
  })).min(1, 'At least one item is required'),
});

type FormValues = z.infer<typeof formSchema>;

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

const DonationsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();
  const [open, setOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingDonation, setViewingDonation] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const { data: donationsData, isLoading: donationsLoading } = useQuery({
    queryKey: ['donations', searchTerm, page, pageSize],
    queryFn: async () => {
      const params: any = { page, page_size: pageSize };
      if (searchTerm) params.q = searchTerm;
      return (await api.get('/donations/list_donations', { params })).data;
    },
  });

  const { data: itemsData } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => (await api.get('/items/list_items', { params: { page_size: 1000 } })).data,
  });

  const items = useMemo(
    () => (Array.isArray(itemsData) ? itemsData : (itemsData?.items || [])),
    [itemsData]
  );
  const activeItems = useMemo(() => (items || []).filter((i: any) => i.status === 1), [items]);

  const { register, handleSubmit, reset, control, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      donation_date: toDateInputValue(new Date()),
      donation_type: 1,
      devotee_name: '',
      phone_number: '',
      email: '',
      address: '',
      city: '',
      state: 'Karnataka',
      pincode: '',
      remarks: '',
      items: [{ item_id: 0, quantity: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Auto-fill logic based on phone number
  const watchedPhone = watch('phone_number');
  useEffect(() => {
    if (watchedPhone?.length === 10 && !editingDonation) {
      const fetchDevotee = async () => {
        try {
          const res = await api.get(`/donations/get_devotee_by_phone/${watchedPhone}`);
          const d = res.data;
          if (d) {
            setValue('devotee_name', d.devotee_name);
            setValue('email', d.email || '');
            setValue('address', d.address || '');
            setValue('city', d.city || '');
            setValue('state', d.state || 'Karnataka');
            setValue('pincode', d.pincode || '');
            showSuccess(`Found existing devotee: ${d.devotee_name}`);
          }
        } catch (err) {
          // If not found, it's a new devotee, ignore 404
        }
      };
      fetchDevotee();
    }
  }, [watchedPhone, setValue, editingDonation, showSuccess]);

  const saveMutation = useMutation({
    mutationFn: async (payload: FormValues) => {
      if (editingDonation) {
        return await api.put(`/donations/update_donation/${editingDonation.id}`, {
          ...payload,
          user_id: user?.id,
        });
      }
      return await api.post('/donations/create_donation', {
        ...payload,
        user_id: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess(editingDonation ? 'Donation record updated' : 'Donation record saved');
      setOpen(false);
      setEditingDonation(null);
      reset();
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Failed to save donation');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/donations/delete_donation/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Donation record deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const handleView = async (donation: any) => {
    try {
      const res = await api.get(`/donations/get_donation/${donation.id}`);
      setViewingDonation(res.data);
      setViewDialogOpen(true);
    } catch {
      showError('Failed to fetch donation details');
    }
  };

  const handleEdit = (donation: any) => {
    setEditingDonation(donation);
    reset({
      donation_date: donation.donation_date,
      donation_type: donation.donation_type || 1,
      devotee_name: donation.devotee_name,
      phone_number: donation.phone_number,
      email: donation.email || '',
      address: donation.address || '',
      city: donation.city || '',
      state: donation.state || 'Karnataka',
      pincode: donation.pincode || '',
      remarks: donation.remarks || '',
      items: (donation.items || []).map((it: any) => ({
        item_id: it.item_id,
        quantity: it.quantity,
      })),
    });
    setOpen(true);
  };

  const onSubmit = async (data: FormValues) => {
    const action = 'Save';
    const confirmed = await showConfirm(
      `${action} Donation`,
      `Are you sure you want to ${action.toLowerCase()} this donation record?`
    );
    if (confirmed) {
      saveMutation.mutate(data);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'donation_date',
      header: 'Date',
      cell: (i) => formatDate(i.getValue() as string),
    },
    {
      accessorKey: 'devotee_name',
      header: 'Devotee Name',
    },
    {
      accessorKey: 'phone_number',
      header: 'Phone Number',
    },
    {
      accessorKey: 'address',
      header: 'Address',
      cell: info => (
        <span className="block max-w-[420px] truncate text-text-normal" title={[
          info.row.original.address,
          info.row.original.city,
          info.row.original.state,
          info.row.original.pincode,
        ].filter(Boolean).join(', ') || '-'}>
          {[
            info.row.original.address,
            info.row.original.city,
            info.row.original.state,
            info.row.original.pincode,
          ].filter(Boolean).join(', ') || '-'}
        </span>
      ),
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
              const confirmed = await showConfirm('Delete Donation', `Are you sure? This will reverse the stock update.`);
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
        <h2 className="page-title">Donations</h2>
        <Button onClick={() => {
          setEditingDonation(null);
          reset({
            donation_date: toDateInputValue(new Date()),
            donation_type: 1,
            devotee_name: '',
            phone_number: '',
            email: '',
            address: '',
            city: '',
            state: 'Karnataka',
            pincode: '',
            remarks: '',
            items: [{ item_id: 0, quantity: 0 }],
          });
          setOpen(true);
        }} className="flex items-center gap-2">
          Record New Donation
        </Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-end gap-4">
            <div className="space-y-1.5 flex-1 max-w-md">
              <Label className="text-text-main font-medium">Search Devotee</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-main/40" />
                <Input
                  placeholder="Name, phone or remarks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
          data={donationsData?.items || []}
          loading={donationsLoading}
          manualPagination
          pageCount={donationsData?.total_pages || 0}
          pageIndex={page - 1}
          pageSize={pageSize}
          onPageChange={(p) => setPage(p)}
          totalCount={donationsData?.total || 0}
        />
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main font-temple">Donation Details</DialogTitle>
            <DialogDescription className="sr-only">Detailed breakdown of the selected donation.</DialogDescription>
          </DialogHeader>
          {viewingDonation && (
            <div className="space-y-6 mt-4">
              <div className="space-y-0 px-1">
                <DetailItem label="Devotee Name" value={viewingDonation.devotee_name} />
                <DetailItem label="Date" value={formatDate(viewingDonation.donation_date)} />
                <DetailItem label="Phone" value={viewingDonation.phone_number} />
                <DetailItem label="Email" value={viewingDonation.email} />
                <DetailItem label="Address" value={viewingDonation.address} />
                <DetailItem label="City" value={viewingDonation.city} />
                <DetailItem label="State" value={viewingDonation.state} />
                <DetailItem label="Pincode" value={viewingDonation.pincode} />
                <DetailItem label="Remarks" value={viewingDonation.remarks} />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Donated Items</h4>
                <div className="rounded-lg border border-border-temple overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-bg-temple border-b border-border-temple">
                      <tr>
                        <th className="px-4 py-2 font-bold text-text-main">Item</th>
                        <th className="px-4 py-2 font-bold text-text-main text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-temple/40">
                      {(viewingDonation.items || []).map((it: any) => (
                        <tr key={it.id} className="bg-white">
                          <td className="px-4 py-2 text-text-main">{it.item?.item_name}</td>
                          <td className="px-4 py-2 text-text-main text-right font-medium">
                            {formatQuantityWithUnit(it.quantity, it.item?.unit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="mt-8 border-t border-border-temple/40 pt-4">
            <Button onClick={() => setViewDialogOpen(false)} className="bg-primary hover:bg-secondary text-white px-10 border-none shadow-none">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-border-temple">
          <DialogHeader>
            <DialogTitle className="text-text-main font-temple">
              {editingDonation ? 'Edit Donation Entry' : 'Record New Donation'}
            </DialogTitle>
            <DialogDescription className="sr-only">Form to record devotee details and donated items.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-text-main">Mobile Number *</Label>
                <Input {...register('phone_number')} placeholder="Contact Number" className="h-10 text-text-main" />
                {errors.phone_number && <p className="text-xs text-error font-medium">{errors.phone_number.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Devotee Name *</Label>
                <Input {...register('devotee_name')} placeholder="Full Name" className="h-10 text-text-main" />
                {errors.devotee_name && <p className="text-xs text-error font-medium">{errors.devotee_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Email</Label>
                <Input {...register('email')} placeholder="Optional" className="h-10 text-text-main" />
                {errors.email && <p className="text-xs text-error font-medium">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Address</Label>
                <Input {...register('address')} placeholder="Devotee's address" className="h-10 text-text-main" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">City</Label>
                <Input {...register('city')} placeholder="City" className="h-10 text-text-main" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">State</Label>
                <Select {...register('state')} className="h-10 text-text-main">
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Pincode</Label>
                <Input {...register('pincode')} placeholder="Pincode" className="h-10 text-text-main" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main">Remarks</Label>
                <Input {...register('remarks')} placeholder="Any additional notes" className="h-10 text-text-main" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2">
                <h4 className="text-sm font-bold text-primary uppercase tracking-widest">Donated Items</h4>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-3 items-end bg-white p-3 rounded-lg border border-border-temple/40 shadow-sm relative">
                    <div className="col-span-7 space-y-1.5">
                      <Label className="text-xs font-bold text-text-main">Item</Label>
                      <Controller
                        name={`items.${index}.item_id`}
                        control={control}
                        render={({ field: selectField }) => (
                          <Select {...selectField} className="h-9 text-sm">
                            <option value={0} disabled>Select Item</option>
                            {activeItems.map((i: any) => (
                              <option key={i.id} value={i.id}>{i.item_name}</option>
                            ))}
                          </Select>
                        )}
                      />
                    </div>
                    <div className="col-span-4 space-y-1.5">
                      <Label className="text-xs font-bold text-text-main">Quantity</Label>
                      <Input 
                        type="text"
                        inputMode="decimal"
                        {...register(`items.${index}.quantity`, {
                          onChange: (e) => {
                            const val = e.target.value;
                            if (val !== '' && !/^\d*\.?\d*$/.test(val)) {
                              e.target.value = val.slice(0, -1);
                            }
                          }
                        })} 
                        onFocus={(e) => {
                          if (e.target.value === '0') {
                            setValue(`items.${index}.quantity` as any, '' as any);
                          }
                        }}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => remove(index)}
                        className="h-9 w-9 p-0 text-error hover:bg-error/10"
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {errors.items?.[index] && (
                      <div className="col-span-12">
                        <p className="text-[10px] text-error font-bold uppercase">
                          {errors.items[index]?.item_id?.message || errors.items[index]?.quantity?.message}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <Button 
                  type="button" 
                  size="sm" 
                  variant="outline" 
                  onClick={() => append({ item_id: 0, quantity: 0 })}
                  className="h-10 text-xs font-bold border-primary text-primary hover:bg-primary hover:text-white"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              </div>
              {errors.items?.message && <p className="text-xs text-error font-bold mt-2">{errors.items.message}</p>}
            </div>

            <DialogFooter className="gap-3 mt-8">
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); setEditingDonation(null); }} className="w-28 h-10 bg-white border border-border-temple text-text-main hover:bg-bg-temple font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="w-32 h-10 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest shadow-lg border-none">
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DonationsPage;
