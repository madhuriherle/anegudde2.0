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
import { Textarea } from '../components/ui/Textarea';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/Dialog';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { DetailItem } from '../components/ui/DetailItem';
import { ReceiptViewerDialog } from '../components/ui/ReceiptViewerDialog';
import { formatDate } from '../utils/date';
import { formatQuantityWithUnit } from '../utils/quantity';
import { Plus, Trash, Trash2, Search, X, ReceiptText } from 'lucide-react';

import { usePermission } from '../hooks/usePermission';

const formSchema = z.object({
  donation_type: z.coerce.number().min(1, 'Donation type is required'),
  donation_date: z.string().min(1, 'Date is required'),
  devotee_name: z.string().min(1, 'Devotee name is required'),
  phone_number: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
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
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('donations.write');
  const canDelete = hasPermission('donations.delete');

  const [open, setOpen] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [editingDonation, setEditingDonation] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingDonation, setViewingDonation] = useState(null);
  const donationDetailsBodyRef = useRef(null);
  const [devoteeDetailsOpen, setDevoteeDetailsOpen] = useState(false);
  const [selectedDevoteeDonation, setSelectedDevoteeDonation] = useState(null);
  const [matchedDevotee, setMatchedDevotee] = useState(null);
  const [devoteeMatchOpen, setDevoteeMatchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [donationPrefixInput, setDonationPrefixInput] = useState('');
  
  // Receipt Viewer State
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [viewingReceiptId, setViewingReceiptId] = useState(null);
  const [viewingReceiptNumber, setViewingReceiptNumber] = useState('');

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
  const annadanaDonationType = useMemo(
    () => donationTypes.find((type) => String(type.type_name || '').trim().toLowerCase() === 'annadana donation'),
    [donationTypes]
  );
  const { data: donationsData, isLoading: donationsLoading } = useQuery({
    queryKey: ['donations', searchTerm, page, pageSize, annadanaDonationType?.id],
    queryFn: async () => {
      const params = { page, page_size: pageSize };
      if (searchTerm) params.q = searchTerm;
      if (annadanaDonationType?.id) params.donation_type_id = annadanaDonationType.id;
      return (await api.get('/donations/list_donations', { params })).data;
    },
    enabled: donationTypes.length > 0
  });
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
      const serial = (i.serial_numbers || [])
        .find((s) => Number(s?.status ?? 1) === 1)?.serial_number;
      if (serial) map.set(i.id, serial);
    });
    return map;
  }, [items]);

  const { register, handleSubmit, reset, control, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
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
      items: [{ search_id: '', item_id: 0, quantity: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchedDonationType = watch('donation_type');

  const resetDonationForm = () => {
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
      items: [{ search_id: '', item_id: 0, quantity: 0 }]
    });
  };

  useEffect(() => {
    if (!viewDialogOpen) return;
    requestAnimationFrame(() => {
      if (donationDetailsBodyRef.current) {
        donationDetailsBodyRef.current.scrollTop = 0;
      }
    });
  }, [viewDialogOpen, viewingDonation?.id]);

  useEffect(() => {
    const prefix = donationTypePrefixById.get(Number(watchedDonationType));
    if (prefix !== undefined) {
      setDonationPrefixInput(prefix);
    } else if (!watchedDonationType) {
      setDonationPrefixInput('');
    }
  }, [donationTypePrefixById, watchedDonationType]);

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

  const handleOpenReceipt = (donation) => {
    setViewingReceiptId(donation.id);
    setViewingReceiptNumber(donation.receipt_display_number || donation.id);
    setReceiptViewerOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const cleanedItems = payload.items.map(({ item_id, quantity }) => ({
        item_id,
        quantity
      }));
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
    setConfirmingSave(true);
    const confirmed = await showConfirm(
      `${action} Donation`,
      `Are you sure you want to ${action.toLowerCase()} this donation record?`
    );
    setConfirmingSave(false);
    if (confirmed) {
      saveMutation.mutate(data);
    } else {
      // Ensure popup-cancel keeps user on the same prefilled form.
      setOpen(true);
      reset(data);
    }
  };

  const columns = useMemo(() => [
  {
    accessorKey: 'receipt_display_number',
    header: 'Receipt No',
    cell: (info) => <span className="text-text-main font-normal">{info.getValue() || '-'}</span>
  },
  {
    accessorKey: 'donation_date',
    header: 'Date',
    cell: (i) => formatDate(i.getValue())
  },
  {
    accessorKey: 'devotee_name',
    header: 'Devotee Name',
    cell: (info) =>
    <button
      type="button"
      onClick={() => {
        setSelectedDevoteeDonation(info.row.original);
        setDevoteeDetailsOpen(true);
      }}
      className="font-normal text-text-main hover:text-primary hover:underline">
      {info.getValue() || '-'}
    </button>
  },
  {
    accessorKey: 'phone_number',
    header: 'Mobile Number',
    cell: (info) =>
    <button
      type="button"
      onClick={() => {
        setSelectedDevoteeDonation(info.row.original);
        setDevoteeDetailsOpen(true);
      }}
      className="font-normal text-text-main hover:text-primary hover:underline">
      {info.getValue() || '-'}
    </button>
  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: (info) =>
    <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handleOpenReceipt(info.row.original)}
            className="action-btn-receipt"
          >
            Receipt
          </button>
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          {canWrite && <button onClick={() => handleEdit(info.row.original)} className="action-btn-edit">Edit</button>}
          {canDelete && <button
        onClick={async () => {
          const confirmed = await showConfirm('Delete Donation', `Are you sure? This will reverse the stock update.`);
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
        <h2 className="page-title">Donations</h2>
        {canWrite && <Button onClick={() => {
          setEditingDonation(null);
          resetDonationForm();
          setOpen(true);
        }} className="flex items-center gap-2">
          Record New Donation
        </Button>}
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
                  className="pl-10 h-10 text-text-main" />
                
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

      <Dialog open={devoteeDetailsOpen} onOpenChange={setDevoteeDetailsOpen}>
        <DialogContent className="max-w-xl !flex !flex-col !p-0 border-border-temple shadow-2xl bg-white overflow-hidden">
          <DialogHeader className="!m-0 border-b border-border-temple/40 !px-8 !py-6 shrink-0 bg-[#F3E8D4]">
            <DialogTitle className="text-xl text-text-main font-temple">Devotee Details</DialogTitle>
            <DialogDescription className="sr-only">Phone number and address details for the selected devotee.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 px-8 py-8 custom-scrollbar">
            {selectedDevoteeDonation &&
              <div className="space-y-4">
                <DetailItem label="Devotee Name" value={selectedDevoteeDonation.devotee_name} valueClassName="font-bold" />
                <DetailItem label="Phone Number" value={selectedDevoteeDonation.phone_number} />
                <DetailItem
                  label="Address"
                  value={[
                    selectedDevoteeDonation.address,
                    selectedDevoteeDonation.city,
                    selectedDevoteeDonation.state,
                    selectedDevoteeDonation.pincode
                  ].filter(Boolean).join(', ')}
                />
                <DetailItem label="Email" value={selectedDevoteeDonation.email} />
              </div>
            }
          </div>
          <DialogFooter className="!p-6 !m-0 border-t border-border-temple/40 flex justify-end shrink-0 bg-[#F3E8D4]">
            <Button onClick={() => setDevoteeDetailsOpen(false)} className="px-8 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-lg">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[98vw] max-w-6xl max-h-[94vh] !flex !flex-col overflow-hidden border-border-temple shadow-2xl !p-0 bg-white">
          <DialogHeader className="!m-0 border-b border-border-temple/40 !px-8 !py-6 shrink-0 bg-[#F3E8D4]">
            <DialogTitle className="text-xl text-text-main font-temple">Donation Details</DialogTitle>
            <DialogDescription className="sr-only">Detailed breakdown of the selected donation.</DialogDescription>
          </DialogHeader>
          <div ref={donationDetailsBodyRef} className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar bg-white">
            {viewingDonation &&
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Left Column: Devotee Details */}
                <div className="temple-form-section">
                  <h4 className="temple-section-header mt-0 text-lg tracking-wider">Devotee Information</h4>
                  <div className="grid grid-cols-1 gap-y-0.5">
                    <DetailItem label="Receipt No" value={viewingDonation.receipt_display_number} />
                    <DetailItem label="Devotee Name" value={viewingDonation.devotee_name} />
                    <DetailItem label="Date" value={formatDate(viewingDonation.donation_date)} />
                    <DetailItem label="Donation Type" value={donationTypeNameById.get(Number(viewingDonation.donation_type)) || 'General Donation'} />
                    <DetailItem label="Phone" value={viewingDonation.phone_number} />
                    <DetailItem label="Email" value={viewingDonation.email} />
                    <DetailItem label="Address" value={viewingDonation.address} />
                    <DetailItem label="City" value={viewingDonation.city} />
                    <DetailItem label="State" value={viewingDonation.state} />
                    <DetailItem label="Pincode" value={viewingDonation.pincode} />
                    <DetailItem label="Remarks" value={viewingDonation.remarks} />
                  </div>
                </div>

                {/* Right Column: Donated Items */}
                <div className="temple-form-section">
                  <h4 className="temple-section-header mt-0 text-lg tracking-wider">Donated Items</h4>
                  <div className="overflow-hidden">
                    <table className="w-full text-sm text-left border-collapse">
                      <tbody className="divide-y divide-border-temple/10">
                        {(viewingDonation.items || []).map((it) =>
                          <tr key={it.id} className="hover:bg-bg-temple/10 transition-colors">
                            <td className="px-0 py-4 text-text-main font-medium">{it.item?.item_name}</td>
                            <td className="px-0 py-4 text-text-main text-right font-medium">
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
          <DialogFooter className="!py-3 !px-6 !mx-0 !mb-0 border-t border-border-temple/40 !flex !flex-row !items-center !justify-end shrink-0 bg-[#F3E8D4]">
            <Button onClick={() => setViewDialogOpen(false)} className="px-6 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold border-none shadow-sm">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={open}
        onOpenChange={(val) => {
          if (!val) {
            if (confirmingSave) {
              // Ignore close events while confirm popup is active.
              return;
            }
            setOpen(false);
            setEditingDonation(null);
            resetDonationForm();
            return;
          }
          setOpen(true);
        }}
      >
        <DialogContent className="w-[98vw] max-w-4xl max-h-[96vh] p-0 overflow-hidden border-border-temple shadow-2xl flex flex-col">
          <DialogHeader className="m-0">
            <DialogTitle className="text-xl text-text-main font-temple">
              {editingDonation ? 'Edit Donation Entry' : 'Record New Donation'}
            </DialogTitle>
            <DialogDescription className="sr-only">Form to record devotee details and donated items.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col overflow-hidden flex-1">
            {/* Scrollable Form Body */}
            <div className="bg-white space-y-10 px-8 py-8 overflow-y-auto custom-scrollbar flex-1">
              {/* Devotee Details Fields */}
              <div className="space-y-5">
                {/* Row 1: Date & Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                {/* Row 2: Mobile & Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Mobile Number *</Label>
                    <Input
                      {...register('phone_number')}
                      maxLength={10}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="h-11 text-base text-text-main"
                    />
                    {errors.phone_number && <p className="text-xs text-error font-medium">{errors.phone_number.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Devotee Name *</Label>
                    <Input {...register('devotee_name')} className="h-11 text-base text-text-main" />
                    {errors.devotee_name && <p className="text-xs text-error font-medium">{errors.devotee_name.message}</p>}
                  </div>
                </div>

                {devoteeMatchOpen && matchedDevotee &&
                  <div className="rounded-xl border border-[#E7D8CC] bg-[#FFFDFB] p-4 shadow-sm animate-in fade-in slide-in-from-top-1">
                    <div className="flex justify-between items-start mb-3">
                      <p className="text-sm font-bold text-primary">Existing Devotee Found</p>
                      <X className="h-4 w-4 cursor-pointer text-text-light hover:text-text-main" onClick={closeDevoteeMatch} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      {[
                        ['Name', matchedDevotee.devotee_name],
                        ['Phone', matchedDevotee.phone_number],
                        ['Email', matchedDevotee.email],
                        ['City', matchedDevotee.city],
                        ['State', matchedDevotee.state],
                        ['Pincode', matchedDevotee.pincode]
                      ].map(([label, value]) =>
                        <div key={label} className="rounded-lg border border-[#F0E4D8] bg-white px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-text-light">{label}</p>
                          <p className="mt-0.5 font-semibold text-text-main break-words">{value || '-'}</p>
                        </div>
                      )}
                      <div className="md:col-span-3 rounded-lg border border-[#F0E4D8] bg-white px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-text-light">Address</p>
                        <p className="mt-0.5 font-semibold text-text-main break-words">{matchedDevotee.address || '-'}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={useMatchedDevotee} className="bg-primary text-white font-bold h-8">Use Details</Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={enterNewDevotee}
                        className="h-8 border border-[#D9C8AF] bg-white px-4 text-text-main hover:bg-bg-temple font-bold"
                      >
                        Clear & Enter New
                      </Button>
                    </div>
                  </div>
                }

                {/* Row 3: Email & Address */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Email</Label>
                    <Input {...register('email')} className="h-11 text-base text-text-main" />
                    {errors.email && <p className="text-xs text-error font-medium">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Address</Label>
                    <Input {...register('address')} className="h-11 text-base text-text-main" />
                  </div>
                </div>

                {/* Row 4: City & State */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                </div>

                {/* Row 5: Pincode & Remarks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Pincode</Label>
                    <Input {...register('pincode')} className="h-11 text-base text-text-main" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Remarks</Label>
                    <Textarea 
                      {...register('remarks')} 
                      className="min-h-[80px] text-base text-text-main resize-none" 
                      placeholder="Add any additional notes here..."
                    />
                  </div>
                </div>
              </div>

              {/* Donated Items Section */}
              <div className="space-y-6 pt-4">
                <div className="flex items-center gap-3 border-b border-border-temple/40 pb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <ReceiptText size={20} />
                  </div>
                  <h4 className="text-lg font-bold text-secondary font-temple">Donated Items</h4>
                </div>

                <div className="rounded-xl border border-border-temple/40 bg-white shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[140px_1fr_140px_80px] gap-4 items-center bg-bg-temple/60 px-6 py-4 border-b border-border-temple/40">
                    <div className="text-sm font-bold uppercase tracking-wider text-text-main">Item Code</div>
                    <div className="text-sm font-bold uppercase tracking-wider text-text-main">Item Name *</div>
                    <div className="text-sm font-bold uppercase tracking-wider text-text-main text-center">Quantity *</div>
                    <div className="text-sm font-bold uppercase tracking-wider text-text-main text-center">Action</div>
                  </div>
                  <div className="divide-y divide-border-temple/20">
                    {fields.map((field, index) =>
                      <div key={field.id} className="grid grid-cols-[140px_1fr_140px_80px] gap-4 items-start px-6 py-5 hover:bg-bg-temple/10 transition-colors">
                        <Input
                          type="text"
                          className="h-11 text-base text-center text-text-main font-normal"
                          {...register(`items.${index}.search_id`)}
                          placeholder="Code"
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
                        <div className="space-y-1.5">
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
                          {errors.items?.[index]?.item_id && <p className="text-[10px] text-error font-bold">Required</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Input
                            type="text"
                            inputMode="decimal"
                            {...register(`items.${index}.quantity`)}
                            onFocus={(e) => {
                              if (e.target.value === '0') {
                                setValue(`items.${index}.quantity`, '');
                              }
                            }}
                            className="h-11 text-base font-normal text-center text-text-main"
                            placeholder="0.000"
                          />
                          {errors.items?.[index]?.quantity && <p className="text-[10px] text-error font-bold text-center">{errors.items[index]?.quantity?.message}</p>}
                        </div>
                        <div className="flex justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            className="h-10 w-10 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => append({ search_id: '', item_id: 0, quantity: 0 })}
                    className="h-10 text-base font-bold border-primary text-primary hover:bg-primary hover:text-white transition-colors">
                    <Plus className="h-4 w-4 mr-1" /> Add Item
                  </Button>
                  
                  {errors.items?.message && <p className="text-sm text-error font-black uppercase tracking-widest">{errors.items.message}</p>}
                </div>
              </div>
            </div>

            {/* Standard Footer Bar */}
            <DialogFooter className="gap-3 !m-0 bg-[#F3E8D4] shrink-0 !p-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setEditingDonation(null);
                  resetDonationForm();
                }}
                className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2] font-bold"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="w-32 h-10 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg border-none">
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ReceiptViewerDialog
        open={receiptViewerOpen}
        onOpenChange={setReceiptViewerOpen}
        donationId={viewingReceiptId}
        receiptNumber={viewingReceiptNumber}
      />

    </div>);

};

export default DonationsPage;
