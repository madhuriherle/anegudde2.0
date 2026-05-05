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
  Alert,
  MenuItem,
  Stack,
  Chip,
  InputAdornment,
} from '@mui/material';
import { 
  Add, 
  Delete, 
  Save, 
  Search, 
  Visibility,
  Payments
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const paymentSchema = z.object({
  vendor_id: z.coerce.number().min(1, 'Vendor is required'),
  payment_date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  payment_mode: z.string().min(1, 'Payment mode is required'),
  reference_no: z.string().optional().or(z.literal('')).or(z.null()),
  remarks: z.string().optional().or(z.literal('')).or(z.null()),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

const VendorPaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialVendorId = searchParams.get('vendor_id');
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(!!initialVendorId);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<any>(null);

  // Fetch Data
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['vendor-payments', search, pageSize, initialVendorId],
    queryFn: async () => {
      const params: any = { page_size: pageSize };
      if (initialVendorId) params.vendor_id = initialVendorId;
      const res = await api.get('/vendor-payments', { params });
      return res.data;
    },
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: async () => (await api.get('/vendors')).data,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'Cash',
      vendor_id: initialVendorId ? Number(initialVendorId) : '' as any,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PaymentFormValues) => {
      return api.post('/vendor-payments', { ...data, user_id: user?.id, status: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-payments'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-outstanding'] });
      showSuccess('Payment recorded successfully');
      handleClose();
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Failed to record payment');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/vendor-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-payments'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-outstanding'] });
      showSuccess('Payment deleted successfully');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const handleOpen = () => {
    reset({
      payment_date: new Date().toISOString().split('T')[0],
      vendor_id: '' as any,
      amount: 0,
      payment_mode: 'Cash',
      reference_no: '',
      remarks: '',
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleView = (payment: any) => {
    setViewingPayment(payment);
    setViewDialogOpen(true);
  };

  const onSubmit = async (data: PaymentFormValues) => {
    const confirmed = await showConfirm(
      "Confirm Payment",
      `Are you sure you want to record a payment of Rs.${data.amount} for ${vendors?.find((v: any) => v.id === data.vendor_id)?.vendor_name}?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns: any[] = [
    { field: 'id', headerName: 'ID', flex: 0.4, minWidth: 70 },
    { field: 'payment_date', headerName: 'Date', flex: 1, minWidth: 120 },
    { 
      field: 'vendor_id', 
      headerName: 'Vendor', 
      flex: 1.5,
      minWidth: 180,
      valueGetter: (params: any) => {
          const vendor = vendors?.find((v: any) => v.id === params);
          return vendor ? vendor.vendor_name : params;
      }
    },
    { 
      field: 'amount', 
      headerName: 'Amount', 
      flex: 1,
      minWidth: 130,
      type: 'number',
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
            Rs.{Number(params.value).toLocaleString()}
          </Typography>
        </Box>
      )
    },
    { field: 'payment_mode', headerName: 'Mode', flex: 0.8, minWidth: 100 },
    { field: 'reference_no', headerName: 'Ref No', flex: 1, minWidth: 120 },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1,
      minWidth: 120,
      sortable: false,
      filterable: false,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params: any) => (
        <Box>
          <IconButton onClick={() => handleView(params.row)} size="small" color="info" sx={{ mr: 1, bgcolor: 'info.light', color: 'white', '&:hover': { bgcolor: 'info.main' } }}>
            <Visibility fontSize="small" />
          </IconButton>
          <IconButton onClick={async () => {
            const confirmed = await showConfirm('Delete Payment', `Are you sure you want to delete this payment record? This will reverse the vendor balance update.`);
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

  const filteredPayments = search 
    ? payments?.filter((p: any) => {
        const vendorName = vendors?.find((v: any) => v.id === p.vendor_id)?.vendor_name?.toLowerCase() || '';
        return vendorName.includes(search.toLowerCase()) || 
               p.reference_no?.toLowerCase().includes(search.toLowerCase()) ||
               p.payment_mode.toLowerCase().includes(search.toLowerCase());
      })
    : payments;

  return (
    <Box
      sx={{
        px: { xs: 1, md: 3 },
        pt: { xs: 0, md: 0.5 },
        pb: { xs: 1, md: 3 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Payments sx={{ color: 'text.secondary' }} />
        <Typography variant="h5" sx={{ fontWeight: 500, color: 'text.primary' }}>
          Vendor Payments
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button 
          variant="contained" 
          startIcon={<Add />} 
          onClick={handleOpen}
          sx={{ 
            px: 3, 
            py: 1.2, 
            borderRadius: 2.5,
            boxShadow: '0 4px 12px rgba(26, 35, 126, 0.3)',
            fontWeight: 'bold'
          }}
        >
          Record Payment
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
            gridTemplateColumns: { xs: '1fr', sm: '2fr 10fr' },
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
              Search Payments
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search by vendor, ref no, or mode..."
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
          rows={filteredPayments || []}
          columns={columns}
          loading={paymentsLoading}
          pageSizeOptions={[pageSize]}
          initialState={{
            pagination: { paginationModel: { pageSize: pageSize } },
          }}
          disableRowSelectionOnClick
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
            '& .MuiDataGrid-cell': {
              borderColor: 'grey.100',
              '&:focus': { outline: 'none' },
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'rgba(26, 35, 126, 0.04)',
            },
          }}
        />
      </Paper>

      {/* View Details Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)} 
        maxWidth="xs" 
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle>Payment Details</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={0}>
            <DetailItem label="Payment Date" value={viewingPayment?.payment_date} />
            <DetailItem label="Vendor" value={vendors?.find((v: any) => v.id === viewingPayment?.vendor_id)?.vendor_name} />
            <DetailItem label="Payment Mode" value={viewingPayment?.payment_mode} />
            <DetailItem label="Reference No" value={viewingPayment?.reference_no} />
            <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 2, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>AMOUNT PAID</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Rs.{Number(viewingPayment?.amount).toLocaleString()}</Typography>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Remarks</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>{viewingPayment?.remarks || 'No additional remarks'}</Typography>
            </Box>
          </Stack>

          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 3, mb: 1, color: 'text.secondary', px: 1 }}>
            Audit Information
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <DetailItem 
              label="Created At" 
              value={viewingPayment?.created_at ? new Date(viewingPayment.created_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Created By" 
              value={users?.find((u: any) => u.id === viewingPayment?.created_by)?.full_name || '-'} 
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setViewDialogOpen(false)} variant="contained" color="primary" fullWidth sx={{ borderRadius: 2, fontWeight: 'bold' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Payment Dialog */}
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="sm" 
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle>Record Vendor Payment</DialogTitle>
        <DialogContent dividers>
          <Box 
            sx={{ 
              mt: 1,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 3
            }}
          >
            <Box>
              <Controller
                name="vendor_id"
                control={control}
                render={({ field }) => (
                  <TextField 
                    {...field}
                    select 
                    label="Select Vendor *" 
                    fullWidth 
                    error={!!errors.vendor_id} 
                    helperText={errors.vendor_id?.message}
                  >
                    {vendors?.filter((v: any) => v.status === 1).map((v: any) => (
                      <MenuItem key={v.id} value={v.id}>
                        {v.vendor_name} (Bal: Rs.{Number(v.current_balance).toLocaleString()})
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Box>
            <Box>
              <TextField
                {...register('payment_date')}
                label="Payment Date *"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!errors.payment_date}
              />
            </Box>
            <Box>
              <TextField 
                {...register('amount')} 
                label="Amount Paid *" 
                type="number" 
                fullWidth 
                error={!!errors.amount} 
                helperText={errors.amount?.message}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
                  }
                }}
              />
            </Box>
            <Box>
              <Controller
                name="payment_mode"
                control={control}
                render={({ field }) => (
                  <TextField 
                    {...field}
                    select 
                    label="Payment Mode *" 
                    fullWidth 
                    error={!!errors.payment_mode}
                  >
                    {['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Other'].map((mode) => (
                      <MenuItem key={mode} value={mode}>{mode}</MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Box>
            <Box sx={{ gridColumn: 'span 2' }}>
              <TextField {...register('reference_no')} label="Reference No (Transaction ID / Cheque No)" fullWidth />
            </Box>
            <Box sx={{ gridColumn: 'span 2' }}>
              <TextField {...register('remarks')} label="Remarks" fullWidth multiline rows={2} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleClose} color="inherit">Cancel</Button>
          <Button 
            onClick={handleSubmit(onSubmit)} 
            variant="contained" 
            startIcon={<Payments />} 
            disabled={mutation.isPending}
            sx={{ px: 4, borderRadius: 2, fontWeight: 'bold' }}
          >
            {mutation.isPending ? 'Processing...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VendorPaymentsPage;
