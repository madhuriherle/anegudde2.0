import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  CircularProgress,
  MenuItem,
  Chip,
  Switch,
  Stack,
  InputAdornment,
} from '@mui/material';
import { 
  Add, 
  Edit, 
  Delete, 
  Search, 
  Save, 
  Storefront,
  Visibility,
  Payments
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';

// Zod Schema for Validation
const vendorSchema = z.object({
  vendor_code: z.string().optional().or(z.literal('')).or(z.null()),
  vendor_name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional().or(z.literal('')).or(z.null()),
  contact_number: z.string().regex(/^[0-9]{8,15}$/, 'Contact number must be between 8 and 15 digits'),
  alternate_contact_number: z.string().regex(/^[0-9]{8,15}$/, 'Contact number must be between 8 and 15 digits').optional().or(z.literal('')).or(z.null()),
  email: z.string().email('Invalid email format').optional().or(z.literal('')).or(z.null()),
  address_line1: z.string().min(1, 'Address is required'),
  address_line2: z.string().optional().or(z.literal('')).or(z.null()),
  city: z.string().optional().or(z.literal('')).or(z.null()),
  state: z.string().optional().or(z.literal('')).or(z.null()),
  postal_code: z.string().regex(/^[0-9]{6}$/, 'Postal Code must be 6 digits').optional().or(z.literal('')).or(z.null()),
  gst_number: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST format').optional().or(z.literal('')).or(z.null()),
  pan_number: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional().or(z.literal('')).or(z.null()),
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
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [searchField, setSearchField] = useState<string>('all');
  const [search, setSearch] = useState('');
  
  const [open, setOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingVendor, setViewingVendor] = useState<any>(null);

  // Fetch Vendors
  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors', search, pageSize, status, searchField],
    queryFn: async () => {
      const params: any = { 
        q: search, 
        page_size: pageSize,
      };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      if (searchField !== 'all') params.search_field = searchField;
      
      const res = await api.get('/vendors', { params });
      return res.data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
  });

  // Create/Update Mutation
  const mutation = useMutation({
    mutationFn: async (data: VendorFormValues) => {
      const payload = buildVendorPayload(data);
      if (editingVendor) {
        return api.put(`/vendors/${editingVendor.id}`, payload);
      }
      return api.post('/vendors', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      showSuccess(editingVendor ? 'Vendor updated successfully' : 'Vendor added successfully');
      handleClose();
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join(', ')
        : detail || err?.response?.data?.message || 'Operation failed';
      showError(message);
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/vendors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      showSuccess('Vendor deleted successfully');
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Delete failed');
    }
  });

  const handleOpen = (vendor: any = null) => {
    setEditingVendor(vendor);
    if (vendor) {
      reset(vendor);
    } else {
      reset({
        vendor_code: '',
        vendor_name: '',
        contact_number: '',
        address_line1: '',
        opening_balance: 0,
        current_balance: 0,
        credit_limit: 0,
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

  const columns: any[] = [
    { field: 'id', headerName: 'Vendor ID', flex: 0.4, minWidth: 80 },
    { field: 'vendor_name', headerName: 'Vendor Name', flex: 1.4, minWidth: 160 },
    { field: 'contact_number', headerName: 'Contact', flex: 1, minWidth: 130 },
    { field: 'address_line1', headerName: 'Address', flex: 1.8, minWidth: 220 },
    { 
      field: 'opening_balance', 
      headerName: 'Opening Bal', 
      flex: 0.9,
      minWidth: 130,
      type: 'number',
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            Rs.{Number(params.value || 0).toLocaleString()}
          </Typography>
        </Box>
      )
    },
    { 
      field: 'current_balance', 
      headerName: 'Current Bal', 
      flex: 1,
      minWidth: 130,
      type: 'number',
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: params.value > 0 ? 'error.main' : 'success.main' }}>
            Rs.{Number(params.value).toLocaleString()}
          </Typography>
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1.2,
      minWidth: 150,
      sortable: false,
      filterable: false,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <IconButton onClick={() => handleView(params.row)} size="small" color="info" sx={{ mr: 1, bgcolor: 'info.light', color: 'white', '&:hover': { bgcolor: 'info.main' } }}>
            <Visibility fontSize="small" />
          </IconButton>
          <IconButton onClick={() => handleOpen(params.row)} size="small" color="primary" sx={{ mr: 1, bgcolor: 'primary.light', color: 'white', '&:hover': { bgcolor: 'primary.main' } }}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton onClick={async () => {
            const confirmed = await showConfirm('Delete Vendor', `Are you sure you want to delete vendor "${params.row.vendor_name}"? This action cannot be undone.`);
            if (confirmed) {
              deleteMutation.mutate(params.row.id);
            }
          }} size="small" color="error" sx={{ bgcolor: 'error.light', color: 'white', '&:hover': { bgcolor: 'error.main' } }}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const DetailItem = ({ label, value, color }: { label: string, value: any, color?: string }) => (
    <Box sx={{ display: 'flex', py: 1.2, borderBottom: '1px dashed', borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ fontWeight: 'bold', width: '40%', color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ width: '60%', fontWeight: 500, color: color || 'text.primary' }}>
        {value || '-'}
      </Typography>
    </Box>
  );

  const formatWithId = (idValue: any, labelValue: any) => {
    if (!idValue && !labelValue) return '-';
    if (!idValue) return `${labelValue}`;
    if (!labelValue) return `ID: ${idValue}`;
    return `${labelValue} (ID: ${idValue})`;
  };

  return (
    <Box
      sx={{
        px: { xs: 1, md: 3 },
        pt: { xs: 0, md: 0.5 },
        pb: { xs: 1, md: 3 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Storefront sx={{ color: 'text.secondary' }} />
          <Typography variant="h5" sx={{ fontWeight: 500, color: 'text.primary' }}>
            Vendor Management
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button 
          variant="contained" 
          startIcon={<Add />} 
          onClick={() => handleOpen()}
          sx={{ 
            px: 3, 
            py: 1.2, 
            borderRadius: 2.5,
            boxShadow: '0 4px 12px rgba(26, 35, 126, 0.3)',
            fontWeight: 'bold'
          }}
        >
          Add New Vendor
        </Button>
      </Box>

      <Paper 
        elevation={0}
        sx={{ 
          p: 3, 
          mb: 4, 
          borderRadius: 4, 
          border: '1px solid',
          borderColor: 'divider',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            alignItems: 'end',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: '1.5fr 2fr 2.5fr 6fr' },
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Rows
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((size) => (
                <MenuItem key={size} value={size}>{size}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Status
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="disabled">Disabled</MenuItem>
            </TextField>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Search Type
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
            >
              <MenuItem value="all">All Fields</MenuItem>
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="code">Code</MenuItem>
              <MenuItem value="contact">Contact</MenuItem>
              <MenuItem value="gst">GST Number</MenuItem>
              <MenuItem value="city">City</MenuItem>
            </TextField>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Search Vendors
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Type to search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        </Box>
      </Paper>

      <Paper 
        elevation={0}
        sx={{ 
          height: 650, 
          width: '100%', 
          borderRadius: 4, 
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 10px 30px rgba(0,0,0,0.03)'
        }}
      >
        <DataGrid
          rows={vendors || []}
          columns={columns.map((col: any) => ({
            ...col,
            sortable: col.field === 'id' || col.field === 'entryId' || String(col.field).toLowerCase().includes('date'),
          }))}
          loading={isLoading}
          pageSizeOptions={[pageSize]}
          initialState={{
            pagination: { paginationModel: { pageSize: pageSize } },
          }}
          disableRowSelectionOnClick
          disableColumnMenu
          disableColumnResize
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeader': {
              backgroundColor: 'primary.main',
              color: 'white',
              fontSize: '0.9rem',
              fontWeight: 'bold',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 'bold !important',
              color: 'white',
            },
            '& .MuiDataGrid-columnHeader .MuiIconButton-root': {
              color: 'rgba(255, 255, 255, 0.85)',
              backgroundColor: 'transparent !important',
            },
            '& .MuiDataGrid-iconButtonContainer': {
              visibility: 'hidden',
              width: 'auto',
            },
            '& .MuiDataGrid-columnHeader--sorted .MuiDataGrid-iconButtonContainer': {
              visibility: 'visible',
            },
            '& .MuiDataGrid-sortIcon': {
              color: 'rgba(255, 255, 255, 0.85)',
            },
            '& .MuiDataGrid-columnSeparator': {
              color: 'rgba(255, 255, 255, 0.35)',
            },
            '& .MuiDataGrid-columnSeparator svg': {
              display: 'none',
            },
            '& .MuiDataGrid-cell': {
              borderColor: 'grey.100',
              '&:focus': { outline: 'none' },
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'rgba(26, 35, 126, 0.04)',
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: '1px solid',
              borderColor: 'divider',
            },
          }}
        />
      </Paper>

      {/* View Details Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Vendor Details
          <Chip 
            label={viewingVendor?.status === 1 ? 'Active' : 'Disabled'} 
            sx={{ bgcolor: viewingVendor?.status === 1 ? 'success.main' : 'grey.400', color: 'white', fontWeight: 'bold' }}
            size="small" 
          />
        </DialogTitle>
        <DialogContent sx={{ mt: 2, p: 3 }}>
          <Stack spacing={0}>
            <DetailItem label="Vendor ID" value={viewingVendor?.id} />
            <DetailItem label="Vendor Code" value={viewingVendor?.vendor_code} />
            <DetailItem label="Vendor Name" value={viewingVendor?.vendor_name} />
            <DetailItem label="Contact Person" value={viewingVendor?.contact_person} />
            <DetailItem label="Primary Contact" value={viewingVendor?.contact_number} />
            <DetailItem label="Alternate Contact" value={viewingVendor?.alternate_contact_number} />
            <DetailItem label="Email Address" value={viewingVendor?.email} />
            <DetailItem label="GST Number" value={viewingVendor?.gst_number} />
            <DetailItem label="PAN Number" value={viewingVendor?.pan_number} />
            <DetailItem label="Opening Balance" value={viewingVendor?.opening_balance ? `Rs.${Number(viewingVendor.opening_balance).toLocaleString()}` : 'Rs.0'} />
            <DetailItem label="Current Balance" value={`Rs.${Number(viewingVendor?.current_balance).toLocaleString()}`} color="error.main" />
            <DetailItem label="Credit Limit" value={viewingVendor?.credit_limit ? `Rs.${Number(viewingVendor.credit_limit).toLocaleString()}` : 'Rs.0'} />
            <DetailItem label="Address" value={`${viewingVendor?.address_line1 || ''}${viewingVendor?.address_line2 ? ', ' + viewingVendor.address_line2 : ''}`} />
            <DetailItem label="City/State" value={`${viewingVendor?.city || ''}${viewingVendor?.state ? ', ' + viewingVendor.state : ''}`} />
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Notes</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>{viewingVendor?.notes || 'No additional notes'}</Typography>
            </Box>
          </Stack>

          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 3, mb: 1, color: 'text.secondary', px: 1 }}>
            Audit Information
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <DetailItem 
              label="Created At" 
              value={viewingVendor?.created_at ? new Date(viewingVendor.created_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Created By" 
              value={formatWithId(
                viewingVendor?.created_by,
                users?.find((u: any) => u.id === viewingVendor?.created_by)?.username
              )} 
            />
            <DetailItem 
              label="Last Updated" 
              value={viewingVendor?.updated_at ? new Date(viewingVendor.updated_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Updated By" 
              value={formatWithId(
                viewingVendor?.updated_by,
                users?.find((u: any) => u.id === viewingVendor?.updated_by)?.username
              )} 
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setViewDialogOpen(false)} variant="contained" color="primary" sx={{ px: 4, borderRadius: 2, fontWeight: 'bold' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="md" 
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle>
          {editingVendor ? 'Edit Vendor Profile' : 'Add New Vendor'}
        </DialogTitle>
        <DialogContent dividers>
          <Box 
            sx={{ 
              mt: 1,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 3
            }}
          >
            <Box sx={{ gridColumn: 'span 2' }}>
              <TextField {...register('vendor_name')} label="Vendor Name (Shop Name) *" fullWidth error={!!errors.vendor_name} helperText={errors.vendor_name?.message} />
            </Box>
            <Box sx={{ gridColumn: 'span 2' }}>
              <TextField {...register('contact_person')} label="Contact Person (Individual Name)" fullWidth error={!!errors.contact_person} helperText={errors.contact_person?.message} />
            </Box>
            <Box>
              <TextField {...register('contact_number')} label="Primary Contact *" fullWidth error={!!errors.contact_number} helperText={errors.contact_number?.message} />
            </Box>
            <Box>
              <TextField {...register('alternate_contact_number')} label="Alternate Contact" fullWidth error={!!errors.alternate_contact_number} helperText={errors.alternate_contact_number?.message} />
            </Box>
            <Box>
              <TextField {...register('email')} label="Email Address" fullWidth error={!!errors.email} helperText={errors.email?.message} />
            </Box>
            <Box>
              <TextField {...register('gst_number')} label="GST Number" fullWidth error={!!errors.gst_number} helperText={errors.gst_number?.message} />
            </Box>
            <Box>
              <TextField {...register('pan_number')} label="PAN Number" fullWidth error={!!errors.pan_number} helperText={errors.pan_number?.message} />
            </Box>
            <Box>
              <TextField {...register('credit_limit')} label="Credit Limit" type="number" fullWidth error={!!errors.credit_limit} helperText={errors.credit_limit?.message} />
            </Box>

            {/* Financial Section */}
            <Box sx={{ gridColumn: 'span 2', mt: 1 }}>
               <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1 }}>
                 Financial Details
               </Typography>
               <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                  <TextField 
                    {...register('opening_balance')} 
                    label="Opening Balance *" 
                    type="number" 
                    fullWidth 
                    error={!!errors.opening_balance} 
                    helperText={errors.opening_balance?.message}
                    slotProps={{ input: { readOnly: !!editingVendor } }}
                  />
                  <TextField
                    label="Current Balance"
                    type="number"
                    fullWidth
                    value={editingVendor?.current_balance ?? 0}
                    slotProps={{ input: { readOnly: true } }}
                    helperText="Auto-calculated based on transactions"
                  />
               </Box>
            </Box>

            <Box sx={{ gridColumn: 'span 2', mt: 1 }}>
               <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1 }}>
                 Address & Location
               </Typography>
               <Box sx={{ display: 'grid', gap: 3 }}>
                  <TextField {...register('address_line1')} label="Address Line 1 *" fullWidth error={!!errors.address_line1} helperText={errors.address_line1?.message} />
                  <TextField {...register('address_line2')} label="Address Line 2" fullWidth />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
                    <TextField {...register('city')} label="City" fullWidth />
                    <TextField {...register('state')} label="State" fullWidth />
                    <TextField {...register('postal_code')} label="Postal Code" fullWidth error={!!errors.postal_code} helperText={errors.postal_code?.message} />
                  </Box>
               </Box>
            </Box>

            <Box sx={{ gridColumn: 'span 2' }}>
              <TextField {...register('notes')} label="Additional Notes" fullWidth multiline rows={3} />
            </Box>
            <Box sx={{ gridColumn: 'span 2' }}>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    p: 2,
                    bgcolor: 'grey.50',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Active Status</Typography>
                    <Switch 
                      checked={field.value === 1} 
                      onChange={(e) => field.onChange(e.target.checked ? 1 : 0)} 
                      color="success" 
                    />
                  </Box>
                )}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleClose} color="inherit">Cancel</Button>
          <Button 
            onClick={handleSubmit(onSubmit)} 
            variant="contained" 
            startIcon={<Save />} 
            disabled={mutation.isPending}
            sx={{ px: 4, borderRadius: 2, fontWeight: 'bold' }}
          >
            {mutation.isPending ? 'Saving...' : editingVendor ? 'Update Vendor' : 'Save Vendor'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VendorsPage;
