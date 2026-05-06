import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { InlineStatusSelect } from '../components/ui/InlineStatusSelect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../components/ui/Dialog';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { DetailItem } from '../components/ui/DetailItem';

const formatDateTime = (value: unknown) => {
  if (!value) return '-';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
};

const vendorSchema = z.object({
  vendor_code: z.string().optional().or(z.literal('')).or(z.null()),
  vendor_name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional().or(z.literal('')).or(z.null()),
  contact_number: z.string().regex(/^[0-9]{10}$/, 'Contact number must be exactly 10 digits'),
  address_line1: z.string().min(1, 'Address is required'),
  city: z.string().optional().or(z.literal('')).or(z.null()),
  state: z.string().optional().or(z.literal('')).or(z.null()),
  postal_code: z.string().regex(/^[0-9]{6}$/, 'Postal Code must be 6 digits').optional().or(z.literal('')).or(z.null()),
  opening_balance: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, 'Opening balance must be a number'),
  status: z.coerce.number().default(1),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

const normalizeOptionalString = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const buildVendorPayload = (data: VendorFormValues) => {
  const payload: any = {
    vendor_name: data.vendor_name?.trim(),
    contact_person: normalizeOptionalString(data.contact_person),
    contact_number: data.contact_number?.trim(),
    address_line1: data.address_line1?.trim(),
    city: normalizeOptionalString(data.city),
    state: normalizeOptionalString(data.state),
    postal_code: normalizeOptionalString(data.postal_code),
    opening_balance: data.opening_balance.trim(),
    status: Number(data.status ?? 1),
  };

  const vendorCode = normalizeOptionalString(data.vendor_code);
  if (vendorCode) payload.vendor_code = vendorCode;

  return payload;
};

const VendorsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingVendor, setViewingVendor] = useState<any>(null);

  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors', search, fromDate, toDate],
    queryFn: async () => {
      const params: any = {
        q: search,
        page_size: 1000,
      };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const res = await api.get('/vendors/list_vendors', { params });
      return res.data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users/list_users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema) as any,
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const mutation = useMutation({
    mutationFn: async (data: VendorFormValues) => {
      const payload = buildVendorPayload(data);
      if (editingVendor) {
        return api.put(`/vendors/update_vendor/${editingVendor.id}`, payload);
      }
      return api.post('/vendors/create_vendor', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      showSuccess(editingVendor ? 'Vendor updated successfully' : 'Vendor added successfully');
      handleClose();
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Operation failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/vendors/delete_vendor/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      showSuccess('Vendor deleted successfully');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: number }) =>
      api.put(`/vendors/update_vendor/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      showSuccess('Status updated successfully');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Status update failed'),
  });

  const handleOpen = (vendor: any = null) => {
    setEditingVendor(vendor);
    if (vendor) {
      reset({
        ...vendor,
        vendor_code: vendor.vendor_code ?? '',
        contact_person: vendor.contact_person ?? '',
        city: vendor.city ?? '',
        state: vendor.state ?? '',
        postal_code: vendor.postal_code ?? '',
        opening_balance: String(vendor.opening_balance ?? '0'),
      });
    } else {
      reset({
        vendor_code: '',
        vendor_name: '',
        contact_person: '',
        contact_number: '',
        address_line1: '',
        city: '',
        state: '',
        postal_code: '',
        opening_balance: '0',
        status: 1,
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingVendor(null);
  };

  const handleView = (vendor: any) => {
    setViewingVendor(vendor);
    setViewDialogOpen(true);
  };

  const onSubmit = async (data: VendorFormValues) => {
    const confirmed = await showConfirm(
      editingVendor ? 'Confirm Update' : 'Confirm Save',
      `Are you sure you want to ${editingVendor ? 'update' : 'save'} this vendor?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: info => <span className="text-text-main">{info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : '-'}</span>,
    },
    {
      accessorKey: 'vendor_name',
      header: 'Vendor Name',
      cell: info => (
        <div className="flex flex-col">
          <span className="text-text-main font-medium">{info.getValue() as string}</span>
        </div>
      ),
    },
    {
      accessorKey: 'address_line1',
      header: 'Address',
      cell: info => {
        const row = info.row.original;
        const fullAddress = [
          row.address_line1,
          row.city,
          row.state,
          row.postal_code
        ].filter(Boolean).join(', ');
        return (
          <div className="max-w-[200px] whitespace-normal leading-tight">
            <span className="text-text-main">{fullAddress}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'contact_number',
      header: 'Contact Number',
      cell: info => <span className="text-text-main">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: info => (
        <InlineStatusSelect
          value={Number(info.getValue() ?? 1)}
          disabled={statusMutation.isPending}
          onChange={(nextStatus) => statusMutation.mutate({ id: info.row.original.id, status: nextStatus })}
        />
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: info => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          <button onClick={() => handleOpen(info.row.original)} className="action-btn-edit">Edit</button>
          <button
            onClick={async () => {
              const confirmed = await showConfirm('Delete Vendor', `Are you sure you want to delete "${info.row.original.vendor_name}"?`);
              if (confirmed) deleteMutation.mutate(info.row.original.id);
            }}
            className="action-btn-delete"
          >
            Delete
          </button>
        </div>
      )
    }
  ], [deleteMutation, showConfirm, statusMutation]);

  const sortedVendors = useMemo(() => {
    if (!vendors) return [];
    return [...vendors].sort((a, b) => {
      // First sort by status: Active (1) before Disabled (0)
      if (a.status !== b.status) {
        return b.status - a.status;
      }
      // Then sort by vendor_name (A-Z)
      return a.vendor_name.localeCompare(b.vendor_name);
    });
  }, [vendors]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-text-main">Vendor Management</h2>
          </div>
        </div>
        <Button onClick={() => handleOpen()} className="bg-primary hover:bg-secondary text-white">Add New Vendor</Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 w-full sm:w-44">
              <Label className="text-text-main">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-text-main"
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-44">
              <Label className="text-text-main">To Date</Label>
              <Input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-text-main"
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-72">
              <Label className="text-text-main">Search</Label>
              <Input
                placeholder="Type to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-text-main"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={sortedVendors} loading={vendorsLoading} />

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh] border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">Vendor Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-0 mt-4">
            <DetailItem label="Vendor Name" value={viewingVendor?.vendor_name} />
            <DetailItem label="Contact Person" value={viewingVendor?.contact_person} />
            <DetailItem label="Primary Contact" value={viewingVendor?.contact_number} />
            <DetailItem label="Opening Balance" value={viewingVendor?.opening_balance} />
            <DetailItem 
              label="Address" 
              value={[
                viewingVendor?.address_line1,
                viewingVendor?.city,
                viewingVendor?.state,
                viewingVendor?.postal_code
              ].filter(Boolean).join(', ')} 
            />
          </div>
          <DialogFooter className="mt-10 border-t border-border-temple/40 pt-6">
            <Button onClick={() => setViewDialogOpen(false)} className="bg-primary hover:bg-secondary text-white px-10">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-2xl overflow-hidden max-h-[90vh] border-border-temple">
          <DialogHeader>
            <DialogTitle className="m-0 select-none text-text-main">
              {editingVendor ? 'Edit Vendor Profile' : 'Add New Vendor'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white" autoComplete="off">
            <div className="space-y-6 px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <Label className="text-text-main">Vendor Name (Shop Name) *</Label>
                <Input {...register('vendor_name')} placeholder="e.g. Laxmi Traders" className="text-text-main" />
                {errors.vendor_name && <p className="text-text-main">{errors.vendor_name.message}</p>}
              </div>

              <div>
                <Label className="text-text-main">Contact Person</Label>
                <Input {...register('contact_person')} placeholder="Individual Name" className="text-text-main" />
              </div>

              <div>
                <Label className="text-text-main">Primary Contact *</Label>
                <Input {...register('contact_number')} placeholder="10-digit mobile number" className="text-text-main" />
                {errors.contact_number && <p className="text-text-main">{errors.contact_number.message}</p>}
              </div>

              <div>
                <Label className="text-text-main">Opening Balance *</Label>
                <Input type="text" inputMode="decimal" {...register('opening_balance')} className="text-text-main" />
                {errors.opening_balance && <p className="text-text-main">{errors.opening_balance.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <Label className="text-text-main">Address Line 1 *</Label>
                <Input {...register('address_line1')} className="text-text-main" />
                {errors.address_line1 && <p className="text-text-main">{errors.address_line1.message}</p>}
              </div>
              <div>
                <Label className="text-text-main">City</Label>
                <Input {...register('city')} className="text-text-main" />
              </div>
              <div>
                <Label className="text-text-main">State</Label>
                <Input {...register('state')} className="text-text-main" />
              </div>
              <div>
                <Label className="text-text-main">Postal Code</Label>
                <Input {...register('postal_code')} className="text-text-main" />
                {errors.postal_code && <p className="text-text-main">{errors.postal_code.message}</p>}
              </div>
            </div>
            </div>

            <DialogFooter className="gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2]">
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="w-32 h-10 bg-primary hover:bg-secondary text-white font-bold">
                {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorsPage;
