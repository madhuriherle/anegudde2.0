import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Eye,
  Phone,
  Store,
  MapPin,
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { cn } from '../utils/cn';
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
  DialogDescription
} from '../components/ui/Dialog';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { Label } from '../components/ui/Label';
import { DetailItem } from '../components/ui/DetailItem';

// Zod Schema for Validation
const vendorSchema = z.object({
  vendor_code: z.string().optional().or(z.literal('')).or(z.null()),
  vendor_name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional().or(z.literal('')).or(z.null()),
  contact_number: z.string().regex(/^[0-9]{8,15}$/, 'Contact number must be between 8 and 15 digits'),
  alternate_contact_number: z.string().optional().or(z.literal('')).or(z.null()),
  email: z.string().email('Invalid email format').optional().or(z.literal('')).or(z.null()),
  address_line1: z.string().min(1, 'Address is required'),
  address_line2: z.string().optional().or(z.literal('')).or(z.null()),
  city: z.string().optional().or(z.literal('')).or(z.null()),
  state: z.string().optional().or(z.literal('')).or(z.null()),
  postal_code: z.string().regex(/^[0-9]{6}$/, 'Postal Code must be 6 digits').optional().or(z.literal('')).or(z.null()),
  gst_number: z.string().optional().or(z.literal('')).or(z.null()),
  pan_number: z.string().optional().or(z.literal('')).or(z.null()),
  opening_balance: z.coerce.number().min(0, 'Cannot be negative'),
  current_balance: z.coerce.number().optional().default(0),
  credit_limit: z.coerce.number().min(0, 'Cannot be negative').optional().or(z.literal('')).or(z.null()),
  notes: z.string().optional().or(z.literal('')).or(z.null()),
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
    alternate_contact_number: normalizeOptionalString(data.alternate_contact_number),
    email: normalizeOptionalString(data.email),
    address_line1: data.address_line1?.trim(),
    address_line2: normalizeOptionalString(data.address_line2),
    city: normalizeOptionalString(data.city),
    state: normalizeOptionalString(data.state),
    postal_code: normalizeOptionalString(data.postal_code),
    gst_number: normalizeOptionalString(data.gst_number),
    pan_number: normalizeOptionalString(data.pan_number),
    opening_balance: Number(data.opening_balance || 0),
    credit_limit: data.credit_limit === '' || data.credit_limit === null || data.credit_limit === undefined ? null : Number(data.credit_limit),
    notes: normalizeOptionalString(data.notes),
    status: Number(data.status ?? 1),
  };

  const vendorCode = normalizeOptionalString(data.vendor_code);
  if (vendorCode) payload.vendor_code = vendorCode;

  return payload;
};

const VendorsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [status, setStatus] = useState<string>('all');
  const [searchField, setSearchField] = useState<string>('all');
  const [search, setSearch] = useState('');
  
  const [open, setOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingVendor, setViewingVendor] = useState<any>(null);

  // Fetch Vendors
  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors', search, status, searchField],
    queryFn: async () => {
      const params: any = { 
        q: search, 
        page_size: 1000,
      };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      if (searchField !== 'all') params.search_field = searchField;
      
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
  });

  // Create/Update Mutation
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

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/vendors/delete_vendor/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      showSuccess('Vendor deleted successfully');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const handleOpen = (vendor: any = null) => {
    setEditingVendor(vendor);
    if (vendor) {
      reset({
        ...vendor,
        vendor_code: vendor.vendor_code ?? '',
        contact_person: vendor.contact_person ?? '',
        alternate_contact_number: vendor.alternate_contact_number ?? '',
        email: vendor.email ?? '',
        address_line2: vendor.address_line2 ?? '',
        city: vendor.city ?? '',
        state: vendor.state ?? '',
        postal_code: vendor.postal_code ?? '',
        gst_number: vendor.gst_number ?? '',
        pan_number: vendor.pan_number ?? '',
        notes: vendor.notes ?? '',
        opening_balance: vendor.opening_balance ?? 0,
        credit_limit: vendor.credit_limit ?? 0,
      });
    } else {
      reset({
        vendor_code: '',
        vendor_name: '',
        contact_person: '',
        contact_number: '',
        alternate_contact_number: '',
        email: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        gst_number: '',
        pan_number: '',
        opening_balance: 0,
        current_balance: 0,
        credit_limit: 0,
        notes: '',
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
      editingVendor ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingVendor ? 'update' : 'save'} this vendor?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: info => <span className="text-text-main">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'vendor_name',
      header: 'Vendor Name',
      cell: info => (
        <div className="flex flex-col">
          <span className="text-text-main">{info.getValue() as string}</span>
        </div>
      ),
    },
    {
      accessorKey: 'contact_number',
      header: 'Contact',
      cell: info => (
        <div className="flex items-center gap-1.5">
          <span className="text-text-main">{info.getValue() as string}</span>
        </div>
      ),
    },
    {
      accessorKey: 'current_balance',
      header: 'Balance',
      cell: info => {
        const val = info.getValue() as number;
        return (
          <span className="text-text-main">
            {'\u20B9'}{val.toLocaleString()}
          </span>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: info => (
        <Badge>
          {info.getValue() === 1 ? 'Active' : 'Disabled'}
        </Badge>
      )
    },
    {
      id: 'actions',
      header: () => <div className="text-left">Actions</div>,
      cell: info => (
        <div className="flex items-center gap-4">
          <button 
            onClick={() => handleView(info.row.original)}
            className="text-text-main"
          >
            View
          </button>
          <button 
            onClick={() => handleOpen(info.row.original)}
            className="text-text-main"
          >
            Edit
          </button>
          <button 
            onClick={async () => {
              const confirmed = await showConfirm('Delete Vendor', `Are you sure you want to delete "${info.row.original.vendor_name}"?`);
              if (confirmed) {
                deleteMutation.mutate(info.row.original.id);
              }
            }}
            className="text-text-main"
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
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-text-main">Vendor Management</h2>
            <p className="text-text-main">Manage vendor profiles and monitor outstanding balances.</p>
          </div>
        </div>
        <Button onClick={() => handleOpen()} className="text-text-main">
          Add New Vendor
        </Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
             <div className="space-y-1.5">
              <Label className="text-text-main">Status</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main">Search Type</Label>
              <Select value={searchField} onChange={(e) => setSearchField(e.target.value)}>
                <option value="all">All Fields</option>
                <option value="name">Name</option>
                <option value="code">Code</option>
                <option value="contact">Contact</option>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-text-main">Search</Label>
              <div className="relative">
                <Input 
                  placeholder="Type to search..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-text-main"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable 
        columns={columns} 
        data={vendors || []} 
        loading={vendorsLoading} 
      />

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh] border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-text-main">Vendor Profile</DialogTitle>
              <Badge>
                {viewingVendor?.status === 1 ? 'Active' : 'Disabled'}
              </Badge>
            </div>
          </DialogHeader>
          <div className="space-y-0 mt-4">
            <DetailItem label="Vendor ID" value={viewingVendor?.id} />
            <DetailItem label="Vendor Code" value={viewingVendor?.vendor_code} />
            <DetailItem label="Vendor Name" value={viewingVendor?.vendor_name} />
            <DetailItem label="Contact Person" value={viewingVendor?.contact_person} />
            <DetailItem label="Primary Contact" value={viewingVendor?.contact_number} />
            <DetailItem label="Alternate Contact" value={viewingVendor?.alternate_contact_number} />
            <DetailItem label="Email Address" value={viewingVendor?.email} />
            <DetailItem label="Current Balance" value={`₹${Number(viewingVendor?.current_balance || 0).toLocaleString()}`} />
            <DetailItem label="Opening Balance" value={`₹${Number(viewingVendor?.opening_balance || 0).toLocaleString()}`} />
            <DetailItem label="Credit Limit" value={viewingVendor?.credit_limit != null ? `₹${Number(viewingVendor?.credit_limit).toLocaleString()}` : '-'} />
            <DetailItem label="GST Number" value={viewingVendor?.gst_number} />
            <DetailItem label="PAN Number" value={viewingVendor?.pan_number} />
            <DetailItem label="Notes" value={viewingVendor?.notes} />
            
            <div className="pt-8 pb-3">
              <span className="text-text-main">Address Details</span>
            </div>
            <div className="p-4 bg-bg-temple border border-border-temple text-text-main leading-relaxed">
              {viewingVendor?.address_line1}
              {viewingVendor?.address_line2 && <><br/>{viewingVendor.address_line2}</>}
              {(viewingVendor?.city || viewingVendor?.state) && <><br/>{viewingVendor?.city}, {viewingVendor?.state} {viewingVendor?.postal_code}</>}
            </div>

            <div className="pt-10 pb-3">
              <span className="text-text-main">System Audit Info</span>
            </div>
            <div className="grid grid-cols-2 gap-x-8">
                <DetailItem label="Created At" value={viewingVendor?.created_at ? new Date(viewingVendor.created_at).toLocaleString() : '-'} />
                <DetailItem label="Created By" value={users?.find((u: any) => u.id === viewingVendor?.created_by)?.username} />
                <DetailItem label="Updated At" value={viewingVendor?.updated_at ? new Date(viewingVendor.updated_at).toLocaleString() : '-'} />
                <DetailItem label="Updated By" value={users?.find((u: any) => u.id === viewingVendor?.updated_by)?.username} />
            </div>
          </div>
          <DialogFooter className="mt-10 border-t border-border-temple/40 pt-6">
            <Button onClick={() => setViewDialogOpen(false)} className="text-text-main">Close Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh] border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">
              {editingVendor ? 'Edit Vendor Profile' : 'Add New Vendor'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4" autoComplete="off">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div className="md:col-span-2">
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
                <Input {...register('contact_number')} placeholder="Mobile Number" className="text-text-main" />
                {errors.contact_number && <p className="text-text-main">{errors.contact_number.message}</p>}
              </div>

              <div>
                <Label className="text-text-main">Alternate Contact</Label>
                <Input {...register('alternate_contact_number')} placeholder="Secondary Number" className="text-text-main" />
              </div>

              <div>
                <Label className="text-text-main">Email Address</Label>
                <Input {...register('email')} type="email" placeholder="email@example.com" className="text-text-main" />
                {errors.email && <p className="text-text-main">{errors.email.message}</p>}
              </div>

              <div>
                <Label className="text-text-main">GST Number</Label>
                <Input {...register('gst_number')} placeholder="GSTIN" className="text-text-main" />
                {errors.gst_number && <p className="text-text-main">{errors.gst_number.message}</p>}
              </div>

              <div>
                <Label className="text-text-main">PAN Number</Label>
                <Input {...register('pan_number')} placeholder="PAN" className="text-text-main" />
              </div>
            </div>

            <div>
              <h4 className="text-text-main">Financial Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <Label className="text-text-main">Opening Balance *</Label>
                  <Input 
                    type="number" 
                    {...register('opening_balance')} 
                    readOnly={!!editingVendor}
                    className="text-text-main bg-bg-temple"
                  />
                </div>
                <div>
                  <Label className="text-text-main">Current Balance</Label>
                  <Input 
                    type="number" 
                    value={editingVendor?.current_balance ?? 0}
                    readOnly
                    className="text-text-main bg-bg-temple"
                  />
                </div>
                <div>
                  <Label className="text-text-main">Credit Limit</Label>
                  <Input
                    type="number"
                    {...register('credit_limit')}
                    placeholder="Max limit"
                    className="text-text-main"
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-text-main">Address & Location</h4>
              <div className="space-y-4">
                <div>
                  <Label className="text-text-main">Address Line 1 *</Label>
                  <Input {...register('address_line1')} className="text-text-main" />
                </div>
                <div className="grid grid-cols-3 gap-4">
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
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-text-main">Notes</Label>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Any additional vendor notes..."
                className="flex w-full border border-border-temple bg-white px-3 py-2 text-text-main focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
               <div className="space-y-0.5">
                  <Label className="text-text-main">Active Status</Label>
               </div>
               <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Switch 
                    checked={field.value === 1} 
                    onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} 
                  />
                )}
              />
            </div>

            <DialogFooter className="pt-6 border-t border-border-temple/40 gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} className="text-text-main">Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="text-text-main">
                {mutation.isPending ? 'Saving...' : editingVendor ? 'Update Vendor' : 'Save Vendor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorsPage;
