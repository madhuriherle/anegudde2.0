import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  DialogFooter,
  DialogDescription } from
'../components/ui/Dialog';
import { Label } from '../components/ui/Label';
import { DetailItem } from '../components/ui/DetailItem';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { DeletionWarningDialog } from '../components/ui/DeletionWarningDialog';
import { usePermission } from '../hooks/usePermission';
import { toDisplayCase } from '../utils/text';
import { X, Plus, Pencil, Trash2, Search } from 'lucide-react';

const vendorSchema = z.object({
  vendor_code: z.string().optional().or(z.literal('')).or(z.null()),
  vendor_name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional().or(z.literal('')).or(z.null()),
  contact_number: z.string().regex(/^\+?[\d\s-]{8,15}$/, 'Invalid contact number'),
  address_line1: z.string().min(1, 'Address is required'),
  city: z.string().optional().or(z.literal('')).or(z.null()),
  state: z.string().optional().or(z.literal('')).or(z.null()),
  postal_code: z.string().regex(/^[0-9]{6}$/, 'Postal Code must be 6 digits').optional().or(z.literal('')).or(z.null()),
  opening_balance: z.
  string().
  trim().
  regex(/^\d+(\.\d+)?$/, 'Opening balance must be a number'),
  status: z.coerce.number().default(1)
});



const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const buildVendorPayload = (data) => {
  const payload = {
    vendor_name: data.vendor_name?.trim(),
    contact_person: normalizeOptionalString(data.contact_person),
    contact_number: data.contact_number?.trim(),
    address_line1: data.address_line1?.trim(),
    city: normalizeOptionalString(data.city),
    state: normalizeOptionalString(data.state),
    postal_code: normalizeOptionalString(data.postal_code),
    opening_balance: data.opening_balance.trim(),
    status: Number(data.status ?? 1)
  };

  const vendorCode = normalizeOptionalString(data.vendor_code);
  if (vendorCode) payload.vendor_code = vendorCode;

  return payload;
};

const VendorsPage = () => {
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('vendors.write');
  const canDelete = hasPermission('vendors.delete');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [open, setOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingVendor, setViewingVendor] = useState(null);

  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);
  const [usageDetails, setUsageDetails] = useState([]);

  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors', search, page, pageSize],
    queryFn: async () => {
      const params = {
        q: search,
        page,
        page_size: pageSize
      };

      const res = await api.get('/vendors/list_vendors', { params });
      return res.data;
    }
  });

  const vendors = useMemo(() => vendorsData?.items ?? [], [vendorsData]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(vendorSchema),
    mode: 'onChange'
  });

  const mutation = useMutation({
    mutationFn: async (payloadWithId) => {
      const { id, isEditMode, ...data } = payloadWithId;
      const payload = buildVendorPayload(data);
      if (isEditMode && id) {
        return api.put(`/vendors/update_vendor/${id}`, payload);
      }
      return api.post('/vendors/create_vendor', payload);
    },
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      showSuccess(variables?.isEditMode ? 'Vendor updated successfully' : 'Vendor added successfully');
      setOpen(false);
    },
    onError: (err) => {
      showError(err.response?.data?.detail || 'Operation failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/vendors/delete_vendor/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      showSuccess('Vendor deleted successfully');
      setDeleteWarningOpen(false);
    },
    onError: (err) => showError(err.response?.data?.detail || 'Delete failed')
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) =>
    api.put(`/vendors/update_vendor/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      showSuccess('Status updated successfully');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Status update failed')
  });

  const handleOpen = (vendor = null) => {
    setEditingVendor(vendor);
    if (vendor) {
      reset({
        ...vendor,
        vendor_code: vendor.vendor_code ?? '',
        contact_person: vendor.contact_person ?? '',
        city: vendor.city ?? '',
        state: vendor.state ?? 'Karnataka',
        postal_code: vendor.postal_code ?? '',
        opening_balance: String(vendor.opening_balance ?? '0')
      });
    } else {
      reset({
        vendor_code: '',
        vendor_name: '',
        contact_person: '',
        contact_number: '',
        address_line1: '',
        city: '',
        state: 'Karnataka',
        postal_code: '',
        opening_balance: '0',
        status: 1
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    setOpen(false);
    setEditingVendor(null);
  };

  const handleDeleteClick = async (vendor) => {
    try {
      const res = await api.get('/system/check_usage', {
        params: { entity_type: 'vendor', entity_id: vendor.id }
      });

      if (res.data.has_usage) {
        setUsageDetails(res.data.details);
        setVendorToDelete(vendor);
        setDeleteWarningOpen(true);
      } else {
        const confirmed = await showConfirm('Delete Vendor', `Are you sure you want to delete "${vendor.vendor_name}"?`);
        if (confirmed) {
          deleteMutation.mutate(vendor.id);
        }
      }
    } catch {
      showError('Failed to check vendor usage');
    }
  };

  const onSubmit = async (data) => {
    const confirmed = await showConfirm(
      editingVendor ? 'Confirm Update' : 'Confirm Save',
      editingVendor ?
      `Are you sure you want to update "${data.vendor_name}"?` :
      `Are you sure you want to create vendor "${data.vendor_name}"?`
    );
    if (!confirmed) return;
    mutation.mutate({ ...data, id: editingVendor?.id, isEditMode: !!editingVendor });
  };

  const columns = useMemo(() => [
  {
    accessorKey: 'created_at',
    header: 'Date',
    cell: (info) => <span className="text-text-main">{formatDate(info.getValue())}</span>
  },
  {
    accessorKey: 'vendor_name',
    header: 'Vendor Name',
    cell: (info) => <span className="text-text-main font-medium">{toDisplayCase(info.getValue())}</span>
  },
  {
    accessorKey: 'contact_number',
    header: 'Contact Number',
    cell: (info) => <span className="text-text-main">{info.getValue()}</span>
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (info) =>
    <InlineStatusSelect
      value={Number(info.getValue() ?? 1)}
      disabled={statusMutation.isPending || !canWrite}
      onChange={async (nextStatus) => {
        const confirmed = await showConfirm(
          'Update Status',
          `Are you sure you want to ${Number(nextStatus) === 1 ? 'activate' : 'deactivate'} "${info.row.original.vendor_name}"?`
        );
        if (confirmed) statusMutation.mutate({ id: info.row.original.id, status: nextStatus });
      }} />


  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: (info) =>
    <div className="flex items-center justify-center gap-2">
          <button onClick={() => {setViewingVendor(info.row.original);setViewDialogOpen(true);}} className="action-btn-view">View</button>
          {canWrite && <button onClick={() => handleOpen(info.row.original)} className="action-btn-edit">Edit</button>}
          {canDelete && <button onClick={() => handleDeleteClick(info.row.original)} className="action-btn-delete">Delete</button>}
        </div>

  }],
  [statusMutation, showConfirm, canWrite, canDelete]);

  const sortedVendors = useMemo(() => {
    return [...vendors].sort((a, b) => {
      const statusDiff = (b.status ?? 0) - (a.status ?? 0);
      if (statusDiff !== 0) return statusDiff;
      return (a.vendor_name ?? '').localeCompare(b.vendor_name ?? '', undefined, { sensitivity: 'base' });
    });
  }, [vendors]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Vendor Management</h2>
        <div className="flex items-center gap-3">
          {canWrite && <Button onClick={() => handleOpen()} className="bg-primary hover:bg-secondary text-white font-bold">Add New Vendor</Button>}
        </div>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 w-full sm:w-72">
              <Label className="text-text-main">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 text-text-main"
                  placeholder="Search vendors..." />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={sortedVendors}
        loading={vendorsLoading}
        manualPagination
        pageCount={vendorsData?.total_pages || 0}
        pageIndex={page - 1}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
        totalCount={vendorsData?.total || 0} />
      

      <DeletionWarningDialog
        open={deleteWarningOpen}
        onOpenChange={setDeleteWarningOpen}
        onConfirm={() => deleteMutation.mutate(vendorToDelete?.id)}
        isPending={deleteMutation.isPending}
        title="Delete Vendor with History?"
        description={`"${vendorToDelete?.vendor_name}" has existing records in the system.`}
        consequences={[
        ...usageDetails,
        "Historical purchase and payment records will be hidden from active lists.",
        "Archiving this vendor will prevent new transactions while preserving old data for reports."]
        } />
      

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl border-border-temple">
          <DialogHeader>
            <DialogTitle>Vendor Profile</DialogTitle>
            <DialogDescription className="sr-only">Vendor details</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 mt-4 mb-6">
            <DetailItem label="Vendor Name" value={toDisplayCase(viewingVendor?.vendor_name)} />
            <DetailItem label="Contact Person" value={toDisplayCase(viewingVendor?.contact_person)} />
            <DetailItem label="Primary Contact" value={viewingVendor?.contact_number} />
            <DetailItem label="Opening Balance" value={formatCurrency(viewingVendor?.opening_balance)} />
            <DetailItem
              label="Address"
              value={[
              toDisplayCase(viewingVendor?.address_line1),
              toDisplayCase(viewingVendor?.city),
              toDisplayCase(viewingVendor?.state),
              viewingVendor?.postal_code].
              filter(Boolean).join(', ')} />
            
          </div>
          <DialogFooter className="!px-6 !py-4 border-t border-border-temple/40 flex justify-end shrink-0 bg-[#F3E8D4]">
            <Button onClick={() => setViewDialogOpen(false)} className="px-6 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-md">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent
          className="max-w-2xl border-border-temple p-0 overflow-hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}>
          
          <DialogHeader className="m-0">
            <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
            <DialogDescription className="sr-only">Vendor form</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col overflow-hidden" autoComplete="off">
            <div className="bg-white space-y-4 px-6 pt-4 pb-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <Label className="text-text-main">Vendor Name (Shop Name) *</Label>
                  <Input {...register('vendor_name')} className="text-text-main" />
                  {errors.vendor_name && <p className="text-xs text-red-500">{errors.vendor_name.message}</p>}
                </div>

                <div>
                  <Label className="text-text-main">Contact Person</Label>
                  <Input {...register('contact_person')} className="text-text-main" />
                </div>

                <div>
                  <Label className="text-text-main">Primary Contact *</Label>
                  <Input {...register('contact_number')} className="text-text-main" />
                  {errors.contact_number && <p className="text-xs text-red-500">{errors.contact_number.message}</p>}
                </div>

                <div>
                  <Label className="text-text-main">Opening Balance *</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    {...register('opening_balance')}
                    className="text-text-main bg-gray-50 cursor-not-allowed"
                    readOnly />
                  
                  {errors.opening_balance && <p className="text-xs text-red-500">{errors.opening_balance.message}</p>}
                </div>

                <div className="md:col-span-2">
                  <Label className="text-text-main">Address Line 1 *</Label>
                  <Input {...register('address_line1')} className="text-text-main" />
                  {errors.address_line1 && <p className="text-xs text-red-500">{errors.address_line1.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 md:col-span-2 gap-4">
                  <div>
                    <Label className="text-text-main">City</Label>
                    <Input {...register('city')} className="text-text-main" />
                  </div>
                  <div>
                    <Label className="text-text-main">State</Label>
                    <select {...register('state')} className="w-full h-10 px-3 py-2 bg-white border border-border-temple/40 rounded-md text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20">
                      <option value="Karnataka">Karnataka</option>
                      <option value="Andhra Pradesh">Andhra Pradesh</option>
                      <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                      <option value="Assam">Assam</option>
                      <option value="Bihar">Bihar</option>
                      <option value="Chhattisgarh">Chhattisgarh</option>
                      <option value="Goa">Goa</option>
                      <option value="Gujarat">Gujarat</option>
                      <option value="Haryana">Haryana</option>
                      <option value="Himachal Pradesh">Himachal Pradesh</option>
                      <option value="Jharkhand">Jharkhand</option>
                      <option value="Kerala">Kerala</option>
                      <option value="Madhya Pradesh">Madhya Pradesh</option>
                      <option value="Maharashtra">Maharashtra</option>
                      <option value="Manipur">Manipur</option>
                      <option value="Meghalaya">Meghalaya</option>
                      <option value="Mizoram">Mizoram</option>
                      <option value="Nagaland">Nagaland</option>
                      <option value="Odisha">Odisha</option>
                      <option value="Punjab">Punjab</option>
                      <option value="Rajasthan">Rajasthan</option>
                      <option value="Sikkim">Sikkim</option>
                      <option value="Tamil Nadu">Tamil Nadu</option>
                      <option value="Telangana">Telangana</option>
                      <option value="Tripura">Tripura</option>
                      <option value="Uttar Pradesh">Uttar Pradesh</option>
                      <option value="Uttarakhand">Uttarakhand</option>
                      <option value="West Bengal">West Bengal</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-text-main">Pin Code</Label>
                    <Input {...register('postal_code')} className="text-text-main" />
                    {errors.postal_code && <p className="text-xs text-red-500">{errors.postal_code.message}</p>}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-3 px-6 py-4 border-t border-border-temple/40 m-0 bg-[#F3E8D4]">
              <Button type="button" variant="ghost" onClick={() => {setOpen(false);setEditingVendor(null);}} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2] font-bold">Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="w-32 h-10 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg border-none">{mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>);

};

export default VendorsPage;
