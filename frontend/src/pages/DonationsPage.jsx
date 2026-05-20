import React, { useMemo, useState, useEffect } from 'react';
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
import { DetailItem } from '../components/ui/DetailItem';
import { formatDate } from '../utils/date';
import { formatQuantityWithUnit } from '../utils/quantity';
import { cn } from '../utils/cn';
import { Plus, Trash2, Search } from 'lucide-react';

const formSchema = z.object({
  donation_type: z.coerce.number().min(1, 'Donation type is required'),
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
    search_id: z.string().optional(),
    item_id: z.coerce.number().min(1, 'Item is required'),
    quantity: z.coerce.number().min(0.001, 'Quantity is required')
  })).min(1, 'At least one item is required')
});



const toDateInputValue = (date) => {
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
'Puducherry'];


const DonationsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();
  const [open, setOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingDonation, setViewingDonation] = useState(null);
  const [matchedDevotee, setMatchedDevotee] = useState(null);
  const [devoteeMatchOpen, setDevoteeMatchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [donationPrefixInput, setDonationPrefixInput] = useState('');

  const { data: donationsData, isLoading: donationsLoading } = useQuery({
    queryKey: ['donations', searchTerm, page, pageSize],
    queryFn: async () => {
      const params = { page, page_size: pageSize };
      if (searchTerm) params.q = searchTerm;
      return (await api.get('/donations/list_donations', { params })).data;
    }
  });

  const { data: itemsData } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => (await api.get('/items/list_items', { params: { page_size: 1000 } })).data
  });

  const { data: donationTypesData } = useQuery({
    queryKey: ['donation-types'],
    queryFn: async () => (await api.get('/donation-types/list_donation_types', { params: { status: null, page_size: 1000 } })).data
  });

  const items = useMemo(
    () => Array.isArray(itemsData) ? itemsData : itemsData?.items || [],
    [itemsData]
  );
  const activeItems = useMemo(() => (items || []).filter((i) => i.status === 1), [items]);
  const donationTypes = useMemo(() => donationTypesData?.items || [], [donationTypesData]);
  const activeDonationTypes = useMemo(() => donationTypes.filter((type) => Number(type.status) === 1), [donationTypes]);
  const donationTypeNameById = useMemo(() => {
    const map = new Map();
    donationTypes.forEach((type) => map.set(Number(type.id), type.type_name));
    return map;
  }, [donationTypes]);
  const donationTypeByPrefix = useMemo(() => {
    const map = new Map();
    activeDonationTypes.forEach((type) => {
      const prefix = String(type.receipt_prefix || '').trim().toUpperCase();
      if (prefix) map.set(prefix, type);
    });
    return map;
  }, [activeDonationTypes]);
  const donationTypePrefixById = useMemo(() => {
    const map = new Map();
    donationTypes.forEach((type) => map.set(Number(type.id), type.receipt_prefix || ''));
    return map;
  }, [donationTypes]);

  const serialToItemIdMap = useMemo(() => {
    const map = new Map();
    items.forEach((i) => {
      (i.serial_numbers || []).forEach((s) => {
        const serial = String(s?.serial_number || '').trim().toLowerCase();
        if (serial) map.set(serial, i.id);
      });
    });
    return map;
  }, [items]);

  const itemCodeByItemIdMap = useMemo(() => {
    const map = new Map();
    items.forEach((i) => {
      const serial = (i.serial_numbers || []).
      find((s) => Number(s?.status ?? 1) === 1)?.serial_number;
      if (serial) map.set(i.id, serial);
    });
    return map;
  }, [items]);

  const { register, handleSubmit, reset, control, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      donation_date: toDateInputValue(new Date()),
      donation_type: 0,
      devotee_name: '',
      phone_number: '',
      email: '',
      address: '',
      city: '',
      state: 'Karnataka',
      pincode: '',
      remarks: '',
      items: [{ item_id: 0, quantity: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchedItemsList = watch('items');
  const watchedDonationType = watch('donation_type');

  useEffect(() => {
    const prefix = donationTypePrefixById.get(Number(watchedDonationType));
    if (prefix !== undefined) {
      setDonationPrefixInput(prefix);
    } else if (!watchedDonationType) {
      setDonationPrefixInput('');
    }
  }, [donationTypePrefixById, watchedDonationType]);

  // Initialize search_ids when items load or change
  useEffect(() => {
    if (activeItems.length > 0 && watchedItemsList) {
      watchedItemsList.forEach((item, index) => {
        if (item.item_id && !item.search_id) {
          const code = itemCodeByItemIdMap.get(item.item_id);
          if (code) {
            setValue(`items.${index}.search_id`, code);
          }
        }
      });
    }
  }, [activeItems, watchedItemsList, itemCodeByItemIdMap, setValue]);

  // Suggest existing devotee details based on phone number.
  const watchedPhone = watch('phone_number');

  useEffect(() => {
    if (open && watchedPhone?.length === 10 && !editingDonation) {
      const fetchDevotee = async () => {
        try {
          const res = await api.get(`/donations/get_devotee_by_phone/${watchedPhone}`);
          const d = res.data;
          if (d) {
            setMatchedDevotee(d);
            setDevoteeMatchOpen(true);
          }
        } catch (err) {
          // If not found, it's a new devotee, ignore 404
        }
      };
      fetchDevotee();
    } else {
      setMatchedDevotee(null);
      setDevoteeMatchOpen(false);
    }
  }, [open, watchedPhone, setValue, editingDonation]);

  const closeDevoteeMatch = () => {
    setDevoteeMatchOpen(false);
    setMatchedDevotee(null);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }, 0);
  };

  const useMatchedDevotee = () => {
    if (!matchedDevotee) return;
    setValue('devotee_name', matchedDevotee.devotee_name);
    setValue('email', matchedDevotee.email || '');
    setValue('address', matchedDevotee.address || '');
    setValue('city', matchedDevotee.city || '');
    setValue('state', matchedDevotee.state || 'Karnataka');
    setValue('pincode', matchedDevotee.pincode || '');
    closeDevoteeMatch();
  };

  const enterNewDevotee = () => {
    setValue('devotee_name', '');
    setValue('email', '');
    setValue('address', '');
    setValue('city', '');
    setValue('state', 'Karnataka');
    setValue('pincode', '');
    closeDevoteeMatch();
  };

  const handleViewReceipt = async (donationId) => {
    try {
      const response = await api.get(`/donations/get_receipt_pdf/${donationId}`, {
        responseType: 'blob'
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    } catch (err) {
      showError('Failed to load receipt');
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      // Remove search_id before sending to backend
      const cleanedItems = payload.items.map(({ item_id, quantity }) => ({ item_id, quantity }));
      if (editingDonation) {
        return await api.put(`/donations/update_donation/${editingDonation.id}`, {
          ...payload,
          items: cleanedItems,
          user_id: user?.id
        });
      }
      return await api.post('/donations/create_donation', {
        ...payload,
        items: cleanedItems,
        user_id: user?.id
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess(editingDonation ? 'Donation record updated' : 'Donation record saved');
      
      const savedDonation = response.data;
      if (!editingDonation && savedDonation?.id) {
        handleViewReceipt(savedDonation.id);
      }

      setOpen(false);
      setEditingDonation(null);
      reset();
    },
    onError: (err) => {
      showError(err.response?.data?.detail || 'Failed to save donation');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/donations/delete_donation/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Donation record deleted');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Delete failed')
  });

  const handleView = async (donation) => {
    try {
      const res = await api.get(`/donations/get_donation/${donation.id}`);
      setViewingDonation(res.data);
      setViewDialogOpen(true);
    } catch {
      showError('Failed to fetch donation details');
    }
  };

  const handleEdit = (donation) => {
    setDevoteeMatchOpen(false);
    setMatchedDevotee(null);
    setEditingDonation(donation);
    reset({
      donation_date: donation.donation_date,
      donation_type: donation.donation_type || 0,
      devotee_name: donation.devotee_name,
      phone_number: donation.phone_number,
      email: donation.email || '',
      address: donation.address || '',
      city: donation.city || '',
      state: donation.state || 'Karnataka',
      pincode: donation.pincode || '',
      remarks: donation.remarks || '',
      items: (donation.items || []).map((it) => {
        const itemObj = items.find((i) => i.id === it.item_id);
        const code = itemObj?.serial_numbers?.[0]?.serial_number || '';
        return {
          search_id: code,
          item_id: it.item_id,
          quantity: it.quantity
        };
      })
    });
    setOpen(true);
  };

  const handleDonationTypeChange = (event) => {
    const donationTypeId = Number(event.target.value);
    setValue('donation_type', donationTypeId);
    setDonationPrefixInput(donationTypePrefixById.get(donationTypeId) || '');
  };

  const handleDonationPrefixChange = (event) => {
    const nextPrefix = event.target.value.toUpperCase();
    setDonationPrefixInput(nextPrefix);

    const matchedType = donationTypeByPrefix.get(nextPrefix.trim());
    if (matchedType) {
      setValue('donation_type', Number(matchedType.id));
    }
  };

  const onSubmit = async (data) => {
    const action = 'Save';
    const confirmed = await showConfirm(
      `${action} Donation`,
      `Are you sure you want to ${action.toLowerCase()} this donation record?`
    );
    if (confirmed) {
      saveMutation.mutate(data);
    }
  };

  const columns = useMemo(() => [
  {
    accessorKey: 'receipt_display_number',
    header: 'Receipt No',
    cell: (info) => <span className="text-text-main font-black">{info.getValue() || '-'}</span>
  },
  {
    accessorKey: 'donation_date',
    header: 'Date',
    cell: (i) => formatDate(i.getValue())
  },
  {
    accessorKey: 'donation_type',
    header: 'Type',
    cell: (info) => {
      const val = info.getValue();
      return (
        <span className={cn(
          "px-2.5 py-1 rounded-full text-sm font-bold uppercase",
          val === 2 ? "bg-emerald-100 text-emerald-700" :
          val === 3 ? "bg-amber-100 text-amber-700" :
          val === 4 ? "bg-purple-100 text-purple-700" :
          "bg-blue-100 text-blue-700"
        )}>
            {donationTypeNameById.get(Number(val)) || 'General Donation'}
          </span>);

    }
  },
  {
    accessorKey: 'devotee_name',
    header: 'Devotee Name'
  },
  {
    accessorKey: 'phone_number',
    header: 'Phone Number'
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: (info) =>
    <span className="block max-w-[420px] truncate text-text-normal" title={[
    info.row.original.address,
    info.row.original.city,
    info.row.original.state,
    info.row.original.pincode].
    filter(Boolean).join(', ') || '-'}>
          {[
      info.row.original.address,
      info.row.original.city,
      info.row.original.state,
      info.row.original.pincode].
      filter(Boolean).join(', ') || '-'}
        </span>

  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: (info) =>
    <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handleViewReceipt(info.row.original.id)}
            className="action-btn-receipt"
          >
            Receipt
          </button>
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          <button onClick={() => handleEdit(info.row.original)} className="action-btn-edit">Edit</button>
          <button
        onClick={async () => {
          const confirmed = await showConfirm('Delete Donation', `Are you sure? This will reverse the stock update.`);
          if (confirmed) deleteMutation.mutate(info.row.original.id);
        }}
        className="action-btn-delete">
        
            Delete
          </button>
        </div>

  }],
  [deleteMutation, donationTypeNameById, showConfirm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Donations</h2>
        <Button onClick={() => {
          setEditingDonation(null);
          reset({
            donation_date: toDateInputValue(new Date()),
            donation_type: 0,
            devotee_name: '',
            phone_number: '',
            email: '',
            address: '',
            city: '',
            state: 'Karnataka',
            pincode: '',
            remarks: '',
            items: [{ item_id: 0, quantity: 0 }]
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
                  className="pl-10 text-text-main" />
                
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
          totalCount={donationsData?.total || 0} />
        
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[98vw] max-w-[1600px] !flex !flex-col !p-0 !max-h-[96vh] border-border-temple">
          <DialogHeader className="!m-0 !mt-0 !mb-0 border-b border-border-temple/40 !px-8 !py-6">
            <DialogTitle className="text-2xl text-text-main font-temple">Donation Details</DialogTitle>
            <DialogDescription className="sr-only">Detailed breakdown of the selected donation.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar bg-white">
            {viewingDonation &&
              <div className="flex flex-col lg:flex-row gap-12 items-start">
                {/* Left Column: Devotee Details */}
                <div className="flex-1 space-y-6 w-full">
                  <div className="flex items-center justify-between border-b border-border-temple/40 pb-2">
                    <h4 className="text-lg font-bold text-primary uppercase tracking-widest">Devotee Details</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                    <DetailItem className="md:col-span-2" label="Receipt No" value={viewingDonation.receipt_display_number} />
                    <DetailItem className="md:col-span-2" label="Devotee Name" value={viewingDonation.devotee_name} />
                    <DetailItem label="Date" value={formatDate(viewingDonation.donation_date)} />
                    <DetailItem label="Donation Type" value={donationTypeNameById.get(Number(viewingDonation.donation_type)) || 'General Donation'} />
                    <DetailItem label="Phone" value={viewingDonation.phone_number} />
                    <DetailItem label="Email" value={viewingDonation.email} />
                    <DetailItem label="Address" value={viewingDonation.address} />
                    <DetailItem label="City" value={viewingDonation.city} />
                    <DetailItem label="State" value={viewingDonation.state} />
                    <DetailItem label="Pincode" value={viewingDonation.pincode} />
                    <DetailItem className="md:col-span-2" label="Remarks" value={viewingDonation.remarks} />
                  </div>
                </div>

                {/* Right Column: Donated Items */}
                <div className="flex-1 space-y-6 w-full">
                  <div className="flex items-center justify-between border-b border-border-temple/40 pb-2">
                    <h4 className="text-lg font-bold text-primary uppercase tracking-widest">Donated Items</h4>
                  </div>
                  <div className="rounded-xl border border-border-temple overflow-hidden shadow-sm">
                    <table className="w-full text-lg text-left">
                      <thead className="bg-[#F6EEDF] border-b border-border-temple">
                        <tr>
                          <th className="px-6 py-4 font-bold text-text-main">Item Name</th>
                          <th className="px-6 py-4 font-bold text-text-main text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-temple/30">
                        {(viewingDonation.items || []).map((it) =>
                          <tr key={it.id} className="bg-white hover:bg-bg-temple/20 transition-colors">
                            <td className="px-6 py-4 text-text-main font-medium">{it.item?.item_name}</td>
                            <td className="px-6 py-4 text-text-main text-right font-black">
                              {formatQuantityWithUnit(it.quantity, it.item?.unit)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            }
          </div>
          <DialogFooter className="!m-0 !mt-0 !space-x-0 !p-6 border-t border-border-temple/40">
            <Button onClick={() => setViewDialogOpen(false)} className="bg-primary hover:bg-secondary text-white px-12 h-12 border-none shadow-md font-black uppercase tracking-widest rounded-xl text-lg">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[98vw] max-w-[1600px] max-h-[96vh] overflow-y-auto border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-2xl text-text-main font-temple">
              {editingDonation ? 'Edit Donation Entry' : 'Record New Donation'}
            </DialogTitle>
            <DialogDescription className="sr-only">Form to record devotee details and donated items.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-6">
            <div className="flex flex-col lg:flex-row gap-12 items-start">
              {/* Left Column: Devotee Details */}
              <div className="flex-1 space-y-6 w-full">
                <div className="flex items-center justify-between border-b border-border-temple/40 pb-2">
                  <h4 className="text-lg font-bold text-primary uppercase tracking-widest">Devotee Details</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-text-main font-bold">Donation Date *</Label>
                      <Input type="date" {...register('donation_date')} className="h-11 text-base text-text-main" />
                      {errors.donation_date && <p className="text-xs text-error font-medium">{errors.donation_date.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-text-main font-bold">Donation Type *</Label>
                      <Select {...register('donation_type')} onChange={handleDonationTypeChange} className="h-11 text-base text-text-main">
                        <option value={0}>Select Donation Type</option>
                        {activeDonationTypes.map((type) =>
                          <option key={type.id} value={type.id}>{type.type_name}</option>
                        )}
                      </Select>
                      {errors.donation_type && <p className="text-xs text-error font-medium">{errors.donation_type.message}</p>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Mobile Number *</Label>
                    <Input {...register('phone_number')} className="h-11 text-base text-text-main" />
                    {errors.phone_number && <p className="text-xs text-error font-medium">{errors.phone_number.message}</p>}
                  </div>
                  {devoteeMatchOpen && matchedDevotee &&
                  <div className="md:col-span-2 rounded-lg border border-border-temple bg-[#FFF8F0] p-4 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                      <DetailItem className="grid-cols-[110px_16px_1fr]" label="Name" value={matchedDevotee.devotee_name} />
                      <DetailItem className="grid-cols-[110px_16px_1fr]" label="Phone" value={matchedDevotee.phone_number} />
                      <DetailItem className="grid-cols-[110px_16px_1fr]" label="Email" value={matchedDevotee.email} />
                      <DetailItem className="grid-cols-[110px_16px_1fr]" label="Address" value={matchedDevotee.address} />
                      <DetailItem className="grid-cols-[110px_16px_1fr]" label="City" value={matchedDevotee.city} />
                      <DetailItem className="grid-cols-[110px_16px_1fr]" label="State" value={matchedDevotee.state} />
                      <DetailItem className="grid-cols-[110px_16px_1fr]" label="Pincode" value={matchedDevotee.pincode} />
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-3">
                      <Button type="button" onClick={useMatchedDevotee} className="h-10 px-6 bg-primary hover:bg-secondary text-white font-bold">
                        Fill Details
                      </Button>
                      <Button type="button" variant="ghost" onClick={enterNewDevotee} className="h-10 px-5 bg-white border border-border-temple text-text-main hover:bg-bg-temple font-bold">
                        Clear & Enter New
                      </Button>
                    </div>
                  </div>
                  }
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Devotee Name *</Label>
                    <Input {...register('devotee_name')} className="h-11 text-base text-text-main" />
                    {errors.devotee_name && <p className="text-xs text-error font-medium">{errors.devotee_name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Email</Label>
                    <Input {...register('email')} className="h-11 text-base text-text-main" />
                    {errors.email && <p className="text-xs text-error font-medium">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Address</Label>
                    <Input {...register('address')} className="h-11 text-base text-text-main" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">City</Label>
                    <Input {...register('city')} className="h-11 text-base text-text-main" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">State</Label>
                    <Select {...register('state')} className="h-11 text-base text-text-main">
                      {INDIAN_STATES.map((state) =>
                        <option key={state} value={state}>{state}</option>
                      )}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Pincode</Label>
                    <Input {...register('pincode')} className="h-11 text-base text-text-main" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Remarks</Label>
                    <Input {...register('remarks')} className="h-11 text-base text-text-main" />
                  </div>
                </div>
              </div>

              {/* Right Column: Donated Items */}
              <div className="flex-1 space-y-6 w-full">
                <div className="flex items-center justify-between border-b border-border-temple/40 pb-2">
                  <h4 className="text-lg font-bold text-primary uppercase tracking-widest">Donated Items</h4>
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                  {fields.map((field, index) =>
                    <div key={field.id} className="grid grid-cols-12 gap-4 items-end bg-white p-4 rounded-xl border border-border-temple/40 shadow-sm relative hover:border-primary/30 transition-colors">
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-base font-bold text-text-main">Code</Label>
                        <Input
                          type="text"
                          className="h-11 text-base text-center font-bold text-text-main border-primary/30 px-1"
                          {...register(`items.${index}.search_id`)}
                          onChange={(e) => {
                            const val = String(e.target.value || '').trim().toLowerCase();
                            setValue(`items.${index}.search_id`, e.target.value);
                            if (val) {
                              const matchedId = serialToItemIdMap.get(val);
                              const isActive = activeItems.some((ai) => Number(ai.id) === Number(matchedId));
                              if (matchedId && isActive) {
                                setValue(`items.${index}.item_id`, matchedId);
                              } else {
                                setValue(`items.${index}.item_id`, 0);
                              }
                            } else {
                              setValue(`items.${index}.item_id`, 0);
                            }
                          }} />
                      </div>
                      <div className="col-span-6 space-y-1.5">
                        <Label className="text-base font-bold text-text-main">Item Name</Label>
                        <Controller
                          name={`items.${index}.item_id`}
                          control={control}
                          render={({ field: selectField }) =>
                            <Select
                              {...selectField}
                              className="h-11 text-base"
                              onChange={(e) => {
                                const itemId = Number(e.target.value);
                                selectField.onChange(e);
                                const code = itemCodeByItemIdMap.get(itemId);
                                if (code) {
                                  setValue(`items.${index}.search_id`, code);
                                }
                              }}>
                              <option value={0} disabled>Select Item</option>
                              {activeItems.map((i) =>
                                <option key={i.id} value={i.id}>{i.item_name}</option>
                              )}
                            </Select>
                          } />
                      </div>
                      <div className="col-span-3 space-y-1.5">
                        <Label className="text-base font-bold text-text-main">Quantity</Label>
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
                              setValue(`items.${index}.quantity`, '');
                            }
                          }}
                          className="h-11 text-lg font-black text-primary" />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="h-11 w-11 p-0 text-error hover:bg-error/10 rounded-full"
                          disabled={fields.length === 1}>
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                      {errors.items?.[index] &&
                        <div className="col-span-12">
                          <p className="text-[11px] text-error font-black uppercase tracking-wider">
                            {errors.items[index]?.item_id?.message || errors.items[index]?.quantity?.message}
                          </p>
                        </div>
                      }
                    </div>
                  )}
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => append({ item_id: 0, quantity: 0 })}
                    className="h-10 text-base font-bold border-primary text-primary hover:bg-primary hover:text-white">
                    <Plus className="h-3 w-3 mr-1" /> Add Item
                  </Button>
                </div>
                {errors.items?.message && <p className="text-sm text-error font-black mt-2 uppercase tracking-widest">{errors.items.message}</p>}
              </div>
            </div>

            <DialogFooter className="gap-4 mt-8 border-t border-border-temple/40 pt-8">
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); setEditingDonation(null); }} className="w-36 h-12 bg-white border-2 border-border-temple text-text-main hover:bg-bg-temple font-black uppercase tracking-widest rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="w-48 h-12 bg-primary hover:bg-secondary text-white font-black uppercase tracking-widest shadow-xl border-none rounded-xl text-lg">
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>);

};

export default DonationsPage;
