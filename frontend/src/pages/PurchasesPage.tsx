import React, { useState, useMemo } from 'react';
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
  CircularProgress,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Stack,
  Tooltip,
  Chip,
  InputAdornment,
} from '@mui/material';
import { 
  Add, 
  Delete, 
  Save, 
  Search, 
  Edit,
  Visibility
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const purchaseItemSchema = z.object({
  item_id: z.coerce.number().min(1, 'Item is required'),
  quantity: z.coerce.number().min(0.001, 'Min quantity is 0.001'),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
});

const purchaseSchema = z.object({
  vendor_id: z.coerce.number().min(1, 'Vendor is required'),
  purchase_date: z.string().min(1, 'Date is required'),
  bill_no: z.string().optional(), // Used as Invoice Number
  invoice_amount: z.coerce.number().min(0, 'Invoice amount cannot be negative').optional(),
  sgst: z.coerce.number().min(0, 'SGST cannot be negative').default(0),
  cgst: z.coerce.number().min(0, 'CGST cannot be negative').default(0),
  igst: z.coerce.number().min(0, 'IGST cannot be negative').default(0),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

const PurchasesPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [searchField, setSearchField] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<any>(null);

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['purchases', search, pageSize, status, searchField],
    queryFn: async () => {
      const params: any = { q: search, page_size: pageSize };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      if (searchField !== 'all') params.search_field = searchField;
      const res = await api.get('/purchases', { params });
      return res.data;
    },
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: async () => {
      const res = await api.get('/vendors');
      return res.data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => {
      const res = await api.get('/items');
      return res.data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      purchase_date: new Date().toISOString().split('T')[0],
      items: [{ item_id: '' as any, quantity: 0, price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');
  const totalAmount = watchedItems?.reduce((sum, item) => sum + (item.quantity * item.price || 0), 0) || 0;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingPurchase) {
        return api.put(`/purchases/${editingPurchase.id}`, { ...data, user_id: user?.id, status: 1 });
      }
      return api.post('/purchases', { ...data, user_id: user?.id, status: 1 });
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
    mutationFn: async (id: number) => {
      return api.delete(`/purchases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      showSuccess('Purchase deleted successfully');
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Failed to delete purchase');
    }
  });

  const handleOpen = async (purchase: any = null) => {
    if (purchase) {
      try {
        const res = await api.get(`/purchases/${purchase.id}`);
        const fullData = res.data;
        setEditingPurchase(fullData);
        reset({
          purchase_date: fullData.purchase_date,
          vendor_id: fullData.vendor_id,
          bill_no: fullData.bill_no || '',
          invoice_amount: fullData.invoice_amount || 0,
          sgst: fullData.sgst || 0,
          cgst: fullData.cgst || 0,
          igst: fullData.igst || 0,
          items: fullData.items.map((item: any) => ({
            item_id: item.item_id,
            quantity: item.quantity,
            price: item.price
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
        invoice_amount: 0,
        items: [{ item_id: '' as any, quantity: 0, price: 0 }],
      });
    }
    setOpen(true);
  };

  const handleView = async (purchase: any) => {
    try {
      const res = await api.get(`/purchases/${purchase.id}`);
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
      mutation.mutate(data);
    }
  };

  const columns: any[] = [
    { 
      field: 'entryId', 
      headerName: 'Purchase ID', 
      flex: 0.5, 
      minWidth: 80,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      )
    },
    { 
      field: 'purchase_date', 
      headerName: 'Date', 
      flex: 1, 
      minWidth: 120,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      )
    },
    { 
      field: 'bill_no', 
      headerName: 'Invoice No', 
      flex: 1,
      minWidth: 120,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Typography variant="body2">{params.value || '-'}</Typography>
        </Box>
      )
    },
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
      field: 'item_id', 
      headerName: 'Item', 
      flex: 1.5,
      minWidth: 150,
      valueGetter: (params: any) => {
          const item = items?.find((i: any) => i.id === params);
          return item ? item.item_name : params;
      }
    },
    { 
      field: 'quantity', 
      headerName: 'Qty', 
      flex: 0.8, 
      minWidth: 90, 
      type: 'number',
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      )
    },
    { 
      field: 'price', 
      headerName: 'Price', 
      flex: 0.8,
      minWidth: 100,
      type: 'number',
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Typography variant="body2">Rs.{Number(params.value || 0).toLocaleString()}</Typography>
        </Box>
      )
    },
    { 
      field: 'line_total', 
      headerName: 'Total', 
      flex: 1,
      minWidth: 120,
      type: 'number',
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Rs.{Number(params.value || 0).toLocaleString()}
          </Typography>
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1,
      minWidth: 150,
      sortable: false,
      filterable: false,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params: any) => (
        <Box>
          <IconButton onClick={() => handleView(params.row.entry)} size="small" color="info" sx={{ mr: 1, bgcolor: 'info.light', color: 'white', '&:hover': { bgcolor: 'info.main' } }}>
            <Visibility fontSize="small" />
          </IconButton>
          <IconButton onClick={() => handleOpen(params.row.entry)} size="small" color="primary" sx={{ mr: 1, bgcolor: 'primary.light', color: 'white', '&:hover': { bgcolor: 'primary.main' } }}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton onClick={async () => {
            const confirmed = await showConfirm('Delete Purchase', `Are you sure you want to delete this purchase entry?`);
            if (confirmed) {
              deleteMutation.mutate(params.row.entry.id);
            }
          }} size="small" color="error" sx={{ bgcolor: 'error.light', color: 'white', '&:hover': { bgcolor: 'error.main' } }}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  // Flatten the data: One row per item purchased
  const flattenedRows = useMemo(() => {
    if (!purchases) return [];
    return purchases.flatMap((p: any) => 
      p.items.map((item: any) => ({
        ...item,
        id: `p${p.id}-i${item.id}`, // Unique ID for DataGrid
        entryId: p.id,
        purchase_date: p.purchase_date,
        vendor_id: p.vendor_id,
        bill_no: p.bill_no,
        entry: p // Keep reference for 'View'
      }))
    );
  }, [purchases]);

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

  return (
    <Box
      sx={{
        px: { xs: 1, md: 3 },
        pt: { xs: 0, md: 0.5 },
        pb: { xs: 1, md: 3 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 500, color: 'text.primary' }}>
          Purchase Entries
        </Typography>
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
          New Purchase
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
              Status Filter
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
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
              <MenuItem value="bill_no">Bill No</MenuItem>
              <MenuItem value="vendor">Vendor</MenuItem>
              <MenuItem value="item">Item Name</MenuItem>
            </TextField>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Quick Search
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search purchases..."
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
          rows={flattenedRows}
          columns={columns.map((col: any) => ({
            ...col,
            sortable: col.field === 'id' || col.field === 'entryId' || String(col.field).toLowerCase().includes('date'),
          }))}
          loading={purchasesLoading}
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
          Purchase Summary
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}>#{viewingPurchase?.id}</Typography>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, p: 3 }}>
          <Stack spacing={0}>
            <DetailItem label="Purchase Date" value={viewingPurchase?.purchase_date} />
            <DetailItem label="Vendor" value={vendors?.find((v: any) => v.id === viewingPurchase?.vendor_id)?.vendor_name} />
            <DetailItem label="Invoice Number" value={viewingPurchase?.bill_no} />
            <DetailItem label="Recorded By" value={viewingPurchase?.user?.full_name} />
            <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 2, color: 'white' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9 }}>Items Subtotal</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Rs.{Number(viewingPurchase?.total_amount).toLocaleString()}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9 }}>SGST</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Rs.{Number(viewingPurchase?.sgst || 0).toLocaleString()}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9 }}>CGST</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Rs.{Number(viewingPurchase?.cgst || 0).toLocaleString()}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9 }}>IGST</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Rs.{Number(viewingPurchase?.igst || 0).toLocaleString()}</Typography>
              </Box>
              <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.3)' }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Invoice Grand Total</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Rs.{Number(viewingPurchase?.invoice_amount || (Number(viewingPurchase?.total_amount) + Number(viewingPurchase?.sgst||0) + Number(viewingPurchase?.cgst||0) + Number(viewingPurchase?.igst||0))).toLocaleString()}</Typography>
              </Box>
            </Box>
          </Stack>

          <Typography variant="subtitle2" color="primary" sx={{ mb: 2, mt: 4, fontWeight: 'bold', textTransform: 'uppercase' }}>Items Purchased</Typography>
          <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'grey.50' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Qty</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Price</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {viewingPurchase?.items?.map((item: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{items?.find((i: any) => i.id === item.item_id)?.item_name}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">Rs.{Number(item.price).toLocaleString()}</TableCell>
                    <TableCell align="right">Rs.{Number(item.line_total).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 3, mb: 1, color: 'text.secondary', px: 1 }}>
            Audit Information
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <DetailItem 
              label="Created At" 
              value={viewingPurchase?.created_at ? new Date(viewingPurchase.created_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Created By" 
              value={users?.find((u: any) => u.id === viewingPurchase?.created_by)?.full_name || viewingPurchase?.user?.full_name || '-'} 
            />
            <DetailItem 
              label="Last Updated" 
              value={viewingPurchase?.updated_at ? new Date(viewingPurchase.updated_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Updated By" 
              value={users?.find((u: any) => u.id === viewingPurchase?.updated_by)?.full_name || '-'} 
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setViewDialogOpen(false)} variant="contained" color="primary" sx={{ px: 4, borderRadius: 2, fontWeight: 'bold' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="md" 
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle>
          {editingPurchase ? 'Edit Purchase Entry' : 'Record New Purchase'}
        </DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              mb: 4,
              mt: 1,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box sx={{ gridColumn: 'span 2' }}>
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
                    {vendors?.filter((v: any) => v.status === 1 || v.id === editingPurchase?.vendor_id).map((v: any) => (
                      <MenuItem key={v.id} value={v.id}>{v.vendor_name} ({v.vendor_code})</MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Box>
            <Box>
              <TextField
                {...register('purchase_date')}
                label="Purchase Date *"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!errors.purchase_date}
              />
            </Box>
            <Box>
              <TextField {...register('bill_no')} label="Invoice/Bill Number" fullWidth />
            </Box>
            <Box sx={{ gridColumn: 'span 2' }}>
              <TextField 
                {...register('invoice_amount')} 
                label="Total Invoice Amount (As per Bill)" 
                type="number" 
                fullWidth 
                placeholder="Enter manual invoice total"
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
                  }
                }}
                error={!!errors.invoice_amount}
                helperText={errors.invoice_amount?.message}
              />
            </Box>

            {/* Tax Details Section */}
            <Box sx={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mt: 1 }}>
              <TextField 
                {...register('sgst')} 
                label="SGST Amount" 
                type="number" 
                fullWidth 
                size="small"
                slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }}
              />
              <TextField 
                {...register('cgst')} 
                label="CGST Amount" 
                type="number" 
                fullWidth 
                size="small"
                slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }}
              />
              <TextField 
                {...register('igst')} 
                label="IGST Amount" 
                type="number" 
                fullWidth 
                size="small"
                slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }}
              />
            </Box>
          </Box>

          <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: 'bold', textTransform: 'uppercase' }}>
            Items in Purchase
          </Typography>
          
          <Paper elevation={0} variant="outlined" sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 3 }}>
            {/* Header Row */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, mb: 1, px: 1 }}>
              <Typography variant="caption" sx={{ flex: 5, fontWeight: 'bold', color: 'text.secondary' }}>Item Name *</Typography>
              <Typography variant="caption" sx={{ flex: 2, fontWeight: 'bold', ml: 1, color: 'text.secondary' }}>Qty *</Typography>
              <Typography variant="caption" sx={{ flex: 2, fontWeight: 'bold', ml: 1, color: 'text.secondary' }}>Price *</Typography>
              <Typography variant="caption" sx={{ flex: 2, fontWeight: 'bold', textAlign: 'right', color: 'text.secondary' }}>Total</Typography>
              <Box sx={{ width: 40 }}></Box>
            </Box>

            {fields.map((field, index) => (
              <Stack key={field.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2, alignItems: 'start' }}>
                <Box sx={{ flex: 5, width: '100%' }}>
                  <Controller
                    name={`items.${index}.item_id` as const}
                    control={control}
                    render={({ field: itemField }) => (
                      <TextField 
                        {...itemField}
                        select 
                        fullWidth 
                        size="small"
                        error={!!errors?.items?.[index]?.item_id}
                        label={index === 0 ? "Select Item" : ""}
                        sx={{ bgcolor: 'white' }}
                      >
                        {items?.filter((i: any) => i.status === 1 || watchedItems?.[index]?.item_id === i.id).map((i: any) => (
                          <MenuItem key={i.id} value={i.id}>{i.item_name}</MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                  {errors?.items?.[index]?.item_id && (
                     <Typography variant="caption" color="error" sx={{ ml: 1 }}>{errors.items[index]?.item_id?.message}</Typography>
                  )}
                </Box>
                <Box sx={{ flex: 2, width: '100%' }}>
                  <TextField 
                    {...register(`items.${index}.quantity` as const)} 
                    type="number" 
                    fullWidth 
                    size="small" 
                    error={!!errors?.items?.[index]?.quantity}
                    label={index === 0 ? "Qty" : ""}
                    sx={{ bgcolor: 'white' }}
                  />
                </Box>
                <Box sx={{ flex: 2, width: '100%' }}>
                  <TextField 
                    {...register(`items.${index}.price` as const)} 
                    type="number" 
                    fullWidth 
                    size="small" 
                    error={!!errors?.items?.[index]?.price}
                    label={index === 0 ? "Price" : ""}
                    sx={{ bgcolor: 'white' }}
                  />
                </Box>
                <Box sx={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pt: { xs: 1, sm: index === 0 ? 1 : 0.5 } }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Rs.{(watchedItems?.[index]?.quantity * watchedItems?.[index]?.price || 0).toLocaleString()}
                  </Typography>
                </Box>
                <IconButton color="error" onClick={() => remove(index)} disabled={fields.length === 1} size="small" sx={{ mt: { xs: 0, sm: index === 0 ? 0.5 : 0 } }}>
                  <Delete />
                </IconButton>
              </Stack>
            ))}
            
            <Button size="small" startIcon={<Add />} onClick={() => append({ item_id: '' as any, quantity: 0, price: 0 })} sx={{ mt: 1, fontWeight: 'bold' }}>
              Add Another Item
            </Button>
          </Paper>

          <Box sx={{ mt: 3, p: 2.5, bgcolor: 'grey.50', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>ITEMS SUBTOTAL:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Rs.{totalAmount.toLocaleString()}</Typography>
            </Box>
            
            {(Number(watch('sgst')) > 0 || Number(watch('cgst')) > 0 || Number(watch('igst')) > 0) && (
              <Box sx={{ display: 'flex', gap: 3, mb: 1, mt: 1, p: 1, bgcolor: 'white', borderRadius: 1.5, border: '1px dashed', borderColor: 'divider' }}>
                {Number(watch('sgst')) > 0 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>SGST: <b style={{ color: '#2e7d32' }}>Rs.{Number(watch('sgst')).toLocaleString()}</b></Typography>
                )}
                {Number(watch('cgst')) > 0 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>CGST: <b style={{ color: '#2e7d32' }}>Rs.{Number(watch('cgst')).toLocaleString()}</b></Typography>
                )}
                {Number(watch('igst')) > 0 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>IGST: <b style={{ color: '#2e7d32' }}>Rs.{Number(watch('igst')).toLocaleString()}</b></Typography>
                )}
              </Box>
            )}

            <Divider sx={{ my: 1.5 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main', lineHeight: 1 }}>GRAND TOTAL</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {Number(watch('invoice_amount')) > 0 ? '(Manual Invoice Override)' : '(Items + Taxes)'}
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main' }}>
                Rs.{Number(watch('invoice_amount') || (totalAmount + Number(watch('sgst')||0) + Number(watch('cgst')||0) + Number(watch('igst')||0))).toLocaleString()}
              </Typography>
            </Box>
          </Box>

          {mutation.isError && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
              {(mutation.error as any).response?.data?.detail || 'An error occurred'}
            </Alert>
          )}
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
            {mutation.isPending ? 'Saving...' : editingPurchase ? 'Update Purchase' : 'Save Purchase'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PurchasesPage;






