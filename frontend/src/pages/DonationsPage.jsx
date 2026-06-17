import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

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
import { Plus, Trash2, Search, X, ReceiptText, Settings, Check } from 'lucide-react';

import { usePermission } from '../hooks/usePermission';

const formSchema = z.object({
  donation_type: z.coerce.number().min(1, 'Donation type is required'),
  donation_mode: z.enum(['ITEM', 'AMOUNT']).default('ITEM'),
  total_gross_amount: z.coerce.number().optional().nullable(),
  amount_donation_type: z.enum(['CUSTOM', 'SPECIFIC']).optional(),
  donation_amount_master_id: z.coerce.number().optional().nullable(),
  amount_note: z.string().optional(),
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
    item_id: z.coerce.number(),
    quantity: z.coerce.number()
  })).optional()
}).superRefine((data, ctx) => {
  if (data.donation_mode === 'ITEM') {
    if (!data.items?.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'At least one item is required' });
    }
    (data.items || []).forEach((item, index) => {
      if (!item.item_id || Number(item.item_id) < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'item_id'], message: 'Item is required' });
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'quantity'], message: 'Quantity is required' });
      }
    });
    if (!data.total_gross_amount || Number(data.total_gross_amount) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['total_gross_amount'], message: 'Total gross amount is required' });
    }
  }
  if (data.donation_mode === 'AMOUNT') {
    if (!data.total_gross_amount || Number(data.total_gross_amount) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['total_gross_amount'], message: 'Amount is required' });
    }
    if (data.amount_donation_type === 'SPECIFIC' && !data.donation_amount_master_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['donation_amount_master_id'], message: 'Select a configured amount' });
    }
  }
});

const amountOptionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z.coerce.number().min(0.01, 'Amount is required'),
  description: z.string().optional(),
  status: z.coerce.number().default(1)
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
  const canAmountConfigRead = hasPermission('donations.amount_config.read');
  const canAmountConfigWrite = hasPermission('donations.amount_config.write');
  const canAmountConfigDelete = hasPermission('donations.amount_config.delete');

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
  const [amountConfigOpen, setAmountConfigOpen] = useState(false);
  const [editingAmountOption, setEditingAmountOption] = useState(null);
  const [confirmingAmountDelete, setConfirmingAmountDelete] = useState(false);

  const { data: itemsData } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => (await api.get('/items/list_items', { params: { page_size: 1000 } })).data
  });

  const { data: donationTypesData } = useQuery({
    queryKey: ['donation-types'],
    queryFn: async () => (await api.get('/donation-types/list_donation_types', { params: { status: null, page_size: 1000 } })).data
  });

  const { data: amountOptionsData } = useQuery({
    queryKey: ['donation-amount-options'],
    queryFn: async () => (await api.get('/donations/list_amount_options')).data
  });

  const items = useMemo(
    () => Array.isArray(itemsData) ? itemsData : itemsData?.items || [],
    [itemsData]
  );
  const activeItems = useMemo(() => (items || []).filter((i) => i.status === 1), [items]);
  const donationTypes = useMemo(() => donationTypesData?.items || [], [donationTypesData]);
  const activeDonationTypes = useMemo(() => (
    donationTypes.filter((type) => {
      if (Number(type.status) !== 1) return false;
      const linkedModules = type.modules || [];
      return linkedModules.length === 0 || linkedModules.some((module) =>
        String(module.name || '').trim().toLowerCase().includes('canteen')
      );
    })
  ), [donationTypes]);
  const amountOptions = useMemo(() => Array.isArray(amountOptionsData) ? amountOptionsData : [], [amountOptionsData]);
  const activeAmountOptions = useMemo(() => amountOptions.filter((option) => Number(option.status) === 1), [amountOptions]);
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
      donation_mode: 'ITEM',
      total_gross_amount: '',
      amount_donation_type: 'CUSTOM',
      donation_amount_master_id: 0,
      amount_note: '',
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
  const watchedDonationMode = watch('donation_mode');
  const watchedAmountDonationType = watch('amount_donation_type');
  const watchedAmountMasterId = watch('donation_amount_master_id');
  const selectedDonationType = useMemo(
    () => activeDonationTypes.find((type) => Number(type.id) === Number(watchedDonationType)),
    [activeDonationTypes, watchedDonationType]
  );

  const {
    register: registerAmountOption,
    handleSubmit: handleSubmitAmountOption,
    reset: resetAmountOption,
    formState: { errors: amountOptionErrors }
  } = useForm({
    resolver: zodResolver(amountOptionSchema),
    defaultValues: { title: '', amount: '', description: '', status: 1 }
  });

  const resetDonationForm = () => {
    reset({
      donation_date: toDateInputValue(new Date()),
      donation_type: 0,
      donation_mode: 'ITEM',
      total_gross_amount: '',
      amount_donation_type: 'CUSTOM',
      donation_amount_master_id: 0,
      amount_note: '',
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

  useEffect(() => {
    if (watchedDonationMode === 'AMOUNT' && watchedAmountDonationType === 'SPECIFIC' && watchedAmountMasterId) {
      const option = activeAmountOptions.find((item) => Number(item.id) === Number(watchedAmountMasterId));
      if (option) setValue('total_gross_amount', option.amount);
    }
  }, [activeAmountOptions, watchedAmountDonationType, watchedAmountMasterId, watchedDonationMode, setValue]);

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
      const cleanedItems = (payload.items || []).map(({ item_id, quantity }) => ({
        item_id,
        quantity
      }));
      const isItemDonation = payload.donation_mode === 'ITEM';
      const normalizedPayload = {
        ...payload,
        donation_mode: isItemDonation ? 0 : 1,
        total_gross_amount: payload.total_gross_amount ? Number(payload.total_gross_amount) : null,
        amount_donation_type: isItemDonation ? null : payload.amount_donation_type,
        donation_amount_master_id: isItemDonation || payload.amount_donation_type !== 'SPECIFIC' ? null : payload.donation_amount_master_id,
        amount_note: isItemDonation ? null : payload.amount_note,
        items: isItemDonation ? cleanedItems : [],
        user_id: user?.id
      };
      if (editingDonation) {
        return await api.put(`/donations/update_donation/${editingDonation.id}`, {
          ...normalizedPayload
        });
      }
      return await api.post('/donations/create_donation', {
        ...normalizedPayload
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

  const amountOptionMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingAmountOption) {
        return api.put(`/donations/update_amount_option/${editingAmountOption.id}`, payload);
      }
      return api.post('/donations/create_amount_option', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-amount-options'] });
      showSuccess(editingAmountOption ? 'Amount option updated' : 'Amount option saved');
      setEditingAmountOption(null);
      resetAmountOption({ title: '', amount: '', description: '', status: 1 });
    },
    onError: (err) => showError(err.response?.data?.detail || 'Failed to save amount option')
  });

  const deleteAmountOptionMutation = useMutation({
    mutationFn: async (id) => api.delete(`/donations/delete_amount_option/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-amount-options'] });
      showSuccess('Amount option disabled');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Failed to disable amount option')
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
      donation_mode: Number(donation.donation_mode) === 1 ? 'AMOUNT' : 'ITEM',
      total_gross_amount: donation.total_gross_amount || '',
      amount_donation_type: donation.amount_donation_type || 'CUSTOM',
      donation_amount_master_id: donation.donation_amount_master_id || 0,
      amount_note: donation.amount_note || '',
      devotee_name: donation.devotee_name,
      phone_number: donation.phone_number,
      email: donation.email || '',
      address: donation.address || '',
      city: donation.city || '',
      state: donation.state || 'Karnataka',
      pincode: donation.pincode || '',
      remarks: donation.remarks || '',
      items: (donation.items?.length ? donation.items : [{ search_id: '', item_id: 0, quantity: 0 }]).map((it) => {
        const itemObj = items.find((i) => i.id === it.item_id);
        const code = itemObj?.serial_numbers?.[0]?.serial_number || '';
        return {
          search_id: code,
          item_id: it.item_id || 0,
          quantity: it.quantity || 0
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

  const handleEditAmountOption = (option) => {
    setEditingAmountOption(option);
    resetAmountOption({
      title: option.title || '',
      amount: option.amount || '',
      description: option.description || '',
      status: Number(option.status ?? 1)
    });
  };

  const handleNewAmountOption = () => {
    setEditingAmountOption(null);
    resetAmountOption({ title: '', amount: '', description: '', status: 1 });
  };

  const onSubmitAmountOption = (data) => {
    amountOptionMutation.mutate({
      ...data,
      amount: Number(data.amount)
    });
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
        {canWrite && <div className="flex items-center gap-2">
          {(canAmountConfigRead || canAmountConfigWrite || canAmountConfigDelete) && <Button
            type="button"
            variant="outline"
            onClick={() => setAmountConfigOpen(true)}
            className="h-10 w-10 p-0"
            title="Configure specific amounts"
          >
            <Settings className="h-4 w-4" />
          </Button>}
          <Button onClick={() => {
            setEditingDonation(null);
            resetDonationForm();
            setOpen(true);
          }} className="h-10 px-5">
            Record New Donation
          </Button>
        </div>}
      </div>

      <Card className="border-border-temple shadow-sm overflow-hidden">
        <CardContent className="px-4 sm:px-6 py-4">
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

      <Card className="border-border-temple shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="border-b border-border-temple/40 bg-white px-4 py-3 sm:px-6">
            <h3 className="text-lg font-bold text-secondary font-temple">Donation Records</h3>
          </div>
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
        </CardContent>
      </Card>

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
          <DialogFooter className="!px-6 !py-4 !m-0 border-t border-border-temple/40 flex justify-end shrink-0 bg-[#F3E8D4]">
            <Button onClick={() => setDevoteeDetailsOpen(false)} className="px-6 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-md">
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
                    <DetailItem label="Donation Mode" value={Number(viewingDonation.donation_mode) === 1 ? 'Amount Donation' : 'Item Donation'} />
                    <DetailItem label="Gross Amount" value={viewingDonation.total_gross_amount ? `Rs. ${Number(viewingDonation.total_gross_amount).toFixed(2)}` : '-'} />
                    <DetailItem label="Phone" value={viewingDonation.phone_number} />
                    <DetailItem label="Email" value={viewingDonation.email} />
                    <DetailItem label="Address" value={viewingDonation.address} />
                    <DetailItem label="City" value={viewingDonation.city} />
                    <DetailItem label="State" value={viewingDonation.state} />
                    <DetailItem label="Pincode" value={viewingDonation.pincode} />
                    <DetailItem label="Remarks" value={viewingDonation.remarks} />
                  </div>
                </div>

                {/* Right Column: Donation Details */}
                <div className="temple-form-section">
                  <h4 className="temple-section-header mt-0 text-lg tracking-wider">{Number(viewingDonation.donation_mode) === 1 ? 'Amount Donation' : 'Donated Items'}</h4>
                  {Number(viewingDonation.donation_mode) === 1 ?
                    <div className="grid grid-cols-1 gap-y-0.5">
                      <DetailItem label="Amount Type" value={viewingDonation.amount_donation_type === 'SPECIFIC' ? 'Specific Amount' : 'Custom Amount'} />
                      <DetailItem label="Amount" value={viewingDonation.total_gross_amount ? `Rs. ${Number(viewingDonation.total_gross_amount).toFixed(2)}` : '-'} />
                      <DetailItem label="Note / Reason" value={viewingDonation.amount_note} />
                    </div> :
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
                  </div>}
                </div>
              </div>
            }
          </div>
          <DialogFooter className="!px-6 !py-4 !mx-0 !mb-0 border-t border-border-temple/40 !flex !flex-row !items-center !justify-end shrink-0 bg-[#F3E8D4]">
            <Button onClick={() => setViewDialogOpen(false)} className="px-6 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-md">
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
        <DialogContent className="w-[98vw] max-w-5xl max-h-[96vh] p-0 overflow-hidden border-border-temple shadow-2xl flex flex-col">
          <DialogHeader className="m-0">
            <DialogTitle className="text-xl text-text-main font-temple">
              {editingDonation ? 'Edit Donation Entry' : 'Record New Donation'}
            </DialogTitle>
            <DialogDescription className="sr-only">Form to record devotee details and donated items.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col overflow-hidden flex-1">
            {/* Scrollable Form Body */}
            <div className="bg-white space-y-10 px-8 py-8 overflow-y-auto custom-scrollbar flex-1">
              {/* Devotee Information */}
              <div className="space-y-5">
                <div className="flex items-center gap-3 border-b border-border-temple/40 pb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Search size={20} />
                  </div>
                  <h4 className="text-lg font-bold text-secondary font-temple">Devotee Information</h4>
                </div>

                {/* Row 1: Mobile & Name */}
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

                {/* Row 2: Email & Address */}
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

                {/* Row 3: City, State & Pincode */}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Pincode</Label>
                    <Input {...register('pincode')} className="h-11 text-base text-text-main" />
                  </div>
                </div>
              </div>

              {/* Donation Details */}
              <div className="space-y-5">
                <div className="flex items-center gap-3 border-b border-border-temple/40 pb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <ReceiptText size={20} />
                  </div>
                  <h4 className="text-lg font-bold text-secondary font-temple">Donation Details</h4>
                </div>

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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-text-main font-bold">Donation Mode *</Label>
                    <div className="relative grid h-12 w-full grid-cols-2 rounded-full bg-[#EFE5D8] p-1 shadow-inner">
                      <span
                        className={`absolute left-1 top-1 h-10 w-[calc(50%-4px)] rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-200 ${
                          watchedDonationMode === 'AMOUNT' ? 'translate-x-full' : 'translate-x-0'
                        }`}
                      />
                      <button
                        type="button"
                        disabled={!selectedDonationType}
                        onClick={() => setValue('donation_mode', 'ITEM')}
                        className={`relative z-10 flex items-center justify-center gap-2 rounded-full text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                          watchedDonationMode === 'ITEM' ? 'text-primary' : 'text-text-main/45'
                        }`}
                      >
                        {watchedDonationMode === 'ITEM' && <Check className="h-4 w-4" />}
                        Item Donation
                      </button>
                      <button
                        type="button"
                        disabled={!selectedDonationType}
                        onClick={() => {
                          setValue('donation_mode', 'AMOUNT');
                          setValue('items', [{ search_id: '', item_id: 0, quantity: 0 }]);
                        }}
                        className={`relative z-10 flex items-center justify-center gap-2 rounded-full text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                          watchedDonationMode === 'AMOUNT' ? 'text-primary' : 'text-text-main/45'
                        }`}
                      >
                        {watchedDonationMode === 'AMOUNT' && <Check className="h-4 w-4" />}
                        Amount Donation
                      </button>
                    </div>
                  </div>
                  {watchedDonationMode === 'ITEM' && <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Amount *</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      {...register('total_gross_amount')}
                      className="h-12 text-base text-text-main"
                      placeholder="Enter amount"
                    />
                    {errors.total_gross_amount && <p className="text-xs text-error font-medium">{errors.total_gross_amount.message}</p>}
                  </div>}
                </div>
              </div>

              {/* Dynamic Donation Area */}
              {watchedDonationMode === 'ITEM' && <div className="space-y-6 pt-4">
                <div className="flex items-center gap-3 border-b border-border-temple/40 pb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <ReceiptText size={20} />
                  </div>
                  <h4 className="text-lg font-bold text-secondary font-temple">Donated Items</h4>
                </div>

                <div className="rounded-xl border border-border-temple/40 bg-white shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[120px_1fr_150px_80px] gap-4 items-center bg-bg-temple/60 px-6 py-4 border-b border-border-temple/40">
                    <div className="text-sm font-bold uppercase tracking-wider text-text-main">Item Code</div>
                    <div className="text-sm font-bold uppercase tracking-wider text-text-main">Item Name *</div>
                    <div className="text-sm font-bold uppercase tracking-wider text-text-main text-center">Quantity *</div>
                    <div className="text-sm font-bold uppercase tracking-wider text-text-main text-center">Action</div>
                  </div>
                  <div className="divide-y divide-border-temple/20">
                    {fields.map((field, index) =>
                      <div key={field.id} className="grid grid-cols-[120px_1fr_150px_80px] gap-4 items-start px-6 py-5 hover:bg-bg-temple/10 transition-colors">
                        <Input
                          type="text"
                          className="h-11 text-base text-center text-text-main"
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
                            className="h-11 text-lg font-normal text-center text-text-main"
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
                            className="h-11 w-11 p-0 text-error hover:bg-error/5 rounded-full"
                            disabled={fields.length === 1}>
                            <Trash2 className="w-5 h-5" />
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
              </div>}

              {watchedDonationMode === 'AMOUNT' && <div className="space-y-6 pt-4">
                <div className="flex items-center gap-3 border-b border-border-temple/40 pb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <ReceiptText size={20} />
                  </div>
                  <h4 className="text-lg font-bold text-secondary font-temple">Amount Donation</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Donation Type *</Label>
                    <Select {...register('amount_donation_type')} className="h-11 text-base text-text-main">
                      <option value="CUSTOM">Custom Amount</option>
                      <option value="SPECIFIC">Specific Amount Selection</option>
                    </Select>
                  </div>
                  {watchedAmountDonationType === 'SPECIFIC' && <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Specific Amount *</Label>
                    <Select {...register('donation_amount_master_id')} className="h-11 text-base text-text-main">
                      <option value={0}>Select Amount</option>
                      {activeAmountOptions.map((option) =>
                        <option key={option.id} value={option.id}>{option.title} - Rs. {Number(option.amount).toFixed(2)}</option>
                      )}
                    </Select>
                    {errors.donation_amount_master_id && <p className="text-xs text-error font-medium">{errors.donation_amount_master_id.message}</p>}
                  </div>}
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Amount *</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      {...register('total_gross_amount')}
                      readOnly={watchedAmountDonationType === 'SPECIFIC'}
                      className="h-11 text-base text-text-main"
                    />
                    {errors.total_gross_amount && <p className="text-xs text-error font-medium">{errors.total_gross_amount.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Note / Reason</Label>
                    <Textarea {...register('amount_note')} className="min-h-[80px] text-base text-text-main resize-none" />
                  </div>
                </div>
              </div>}

              {watchedDonationMode === 'ITEM' && <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Remarks</Label>
                <Textarea
                  {...register('remarks')}
                  className="min-h-[80px] text-base text-text-main resize-none"
                  placeholder="Add any additional notes here..."
                />
              </div>}
            </div>

            {/* Standard Footer Bar */}
            <DialogFooter className="gap-3 !m-0 bg-[#F3E8D4] shrink-0 !px-6 !py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setEditingDonation(null);
                  resetDonationForm();
                }}
                className="w-32 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2] font-bold"
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

      <Dialog open={amountConfigOpen} onOpenChange={(val) => {
        if (!val && confirmingAmountDelete) return;
        setAmountConfigOpen(val);
        if (!val) handleNewAmountOption();
      }}>
        <DialogContent className="w-[98vw] max-w-7xl max-h-[92vh] !flex !flex-col overflow-hidden border-border-temple shadow-2xl bg-white">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-xl text-text-main font-temple">Specific Amount Configuration</DialogTitle>
            <DialogDescription className="sr-only">Configure predefined amount donation options.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-[0.75fr_1.75fr] gap-8 overflow-y-auto custom-scrollbar py-4">
            <form onSubmit={handleSubmitAmountOption(onSubmitAmountOption)} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Title *</Label>
                <Input {...registerAmountOption('title')} className="text-text-main" placeholder="100 Devotees - Per Day Amount" />
                {amountOptionErrors.title && <p className="text-xs text-error font-medium">{amountOptionErrors.title.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Amount *</Label>
                <Input {...registerAmountOption('amount')} inputMode="decimal" className="text-text-main" />
                {amountOptionErrors.amount && <p className="text-xs text-error font-medium">{amountOptionErrors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Description</Label>
                <Textarea {...registerAmountOption('description')} className="min-h-[80px] text-text-main resize-none" />
              </div>
              <div className="flex gap-2">
                {canAmountConfigWrite && <Button type="submit" disabled={amountOptionMutation.isPending} className="h-10 bg-primary text-white font-bold">
                  {amountOptionMutation.isPending ? 'Saving...' : 'Save'}
                </Button>}
                {canAmountConfigWrite && <Button type="button" variant="ghost" onClick={handleNewAmountOption} className="h-10 bg-white border border-[#D9C8AF] text-text-main font-bold">
                  Cancel
                </Button>}
              </div>
            </form>

            <div className="rounded-xl border border-border-temple/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bg-temple/60 text-text-main">
                  <tr>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-temple/20">
                  {activeAmountOptions.map((option) =>
                    <tr key={option.id}>
                      <td className="px-4 py-3 text-text-main font-medium whitespace-normal break-words">{option.title}</td>
                      <td className="px-4 py-3 text-right text-text-main">Rs. {Number(option.amount).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          {canAmountConfigWrite && <button type="button" onClick={() => handleEditAmountOption(option)} className="action-btn-edit">Edit</button>}
                          {canAmountConfigDelete && Number(option.status) === 1 && <button
                            type="button"
                            onClick={async () => {
                              setConfirmingAmountDelete(true);
                              const confirmed = await showConfirm('Delete Amount Option', `Delete "${option.title}"?`);
                              setConfirmingAmountDelete(false);
                              if (confirmed) deleteAmountOptionMutation.mutate(option.id);
                            }}
                            className="action-btn-delete"
                          >
                            Delete
                          </button>}
                        </div>
                      </td>
                    </tr>
                  )}
                  {activeAmountOptions.length === 0 && <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-text-main/60">No amount options configured</td>
                  </tr>}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter className="gap-3 border-t border-border-temple/40 pt-4">
            <Button type="button" onClick={() => setAmountConfigOpen(false)} className="h-10 bg-primary text-white font-bold">
              Close
            </Button>
          </DialogFooter>
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
