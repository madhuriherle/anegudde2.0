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
  DeleteSweep,
  Visibility
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const wastageItemSchema = z.object({
  item_id: z.coerce.number().min(1, 'Item is required'),
  quantity: z.coerce.number().min(0.001, 'Min quantity is 0.001'),
});

const wastageSchema = z.object({
  wastage_date: z.string().min(1, 'Date is required'),
  reason: z.string().optional().or(z.literal('')).or(z.null()),
  items: z.array(wastageItemSchema).min(1, 'At least one item is required'),
});

type WastageFormValues = z.infer<typeof wastageSchema>;

const WastagesPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [searchField, setSearchField] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingWastage, setEditingWastage] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingWastage, setViewingWastage] = useState<any>(null);

  const { data: wastages, isLoading: wastagesLoading } = useQuery({
    queryKey: ['wastages', search, pageSize, status, searchField],
    queryFn: async () => {
      const params: any = { q: search, page_size: pageSize };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      if (searchField !== 'all') params.search_field = searchField;
      const res = await api.get('/wastages', { params });
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

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<WastageFormValues>({
    resolver: zodResolver(wastageSchema),
    defaultValues: {
      wastage_date: new Date().toISOString().split('T')[0],
      reason: '',
      items: [{ item_id: '' as any, quantity: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const normalizedPayload = {
        ...data,
        reason: data.reason === '' || data.reason === undefined ? null : data.reason,
        items: (data.items || []).map((it: any) => ({
          item_id: Number(it.item_id),
          quantity: Number(it.quantity),
        })),
      };
      if (editingWastage) {
        return api.put(`/wastages/${editingWastage.id}`, { ...normalizedPayload, user_id: user?.id, status: 1 });
      }
      return api.post('/wastages', { ...normalizedPayload, user_id: user?.id, status: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wastages'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess(editingWastage ? 'Wastage record updated successfully' : 'Wastage record saved successfully');
      handleClose();
    },
    onError: (err: any) => {
        const detail = err?.response?.data?.detail;
        const msg = Array.isArray(detail)
          ? detail.map((d: any) => d?.msg).filter(Boolean).join(', ')
          : typeof detail === 'string'
            ? detail
            : 'Failed to save record';
        showError(msg);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/wastages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wastages'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Wastage record deleted successfully');
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Failed to delete record');
    }
  });

  const handleOpen = async (wastage: any = null) => {
    if (wastage) {
      try {
        const res = await api.get(`/wastages/${wastage.id}`);
        const fullData = res.data;
        setEditingWastage(fullData);
        reset({
          wastage_date: fullData.wastage_date,
          reason: fullData.reason || '',
          items: fullData.items.map((item: any) => ({
            item_id: item.item_id,
            quantity: item.quantity
          })),
        });
      } catch (err) {
        showError('Failed to fetch record details');
        return;
      }
    } else {
      setEditingWastage(null);
      reset({
        wastage_date: new Date().toISOString().split('T')[0],
        reason: '',
        items: [{ item_id: '' as any, quantity: 0 }],
      });
    }
    setOpen(true);
  };

  const handleView = async (wastage: any) => {
    try {
      const res = await api.get(`/wastages/${wastage.id}`);
      setViewingWastage(res.data);
      setViewDialogOpen(true);
    } catch (err) {
      showError('Failed to fetch record details');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEditingWastage(null);
  };

  const onSubmit = async (data: WastageFormValues) => {
    for (const row of data.items) {
      const selectedItem = items?.find((i: any) => i.id === row.item_id);
      const available = Number(selectedItem?.current_stock ?? 0);
      const requested = Number(row.quantity ?? 0);
      if (requested > available) {
        const unitCode = selectedItem?.unit?.unit_code ? ` ${selectedItem.unit.unit_code}` : '';
        showError(
          `Wastage qty exceeds available stock (Available: ${available}${unitCode}).`
        );
        return;
      }
    }

    const confirmed = await showConfirm(
      editingWastage ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingWastage ? 'update' : 'save'} this wastage record?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns: any[] = [
    { field: 'entryId', headerName: 'Wastage ID', flex: 0.5, minWidth: 80, headerAlign: 'center', align: 'center' },
    { field: 'wastage_date', headerName: 'Date', flex: 1, minWidth: 120, headerAlign: 'center', align: 'center' },
    { 
      field: 'item_id', 
      headerName: 'Item Name', 
      flex: 2,
      minWidth: 200,
      valueGetter: (params: any) => {
          const item = items?.find((i: any) => i.id === params);
          return item ? item.item_name : params;
      }
    },
    { 
      field: 'quantity', 
      headerName: 'Qty Wasted', 
      flex: 0.8, 
      minWidth: 110, 
      type: 'number',
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'error.main' }}>
            {params.value} {items?.find((i: any) => i.id === params.row.item_id)?.unit?.unit_code}
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
            const confirmed = await showConfirm('Delete Record', `Are you sure you want to delete this wastage record?`);
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

  // Flatten the data: One row per item wasted
  const flattenedRows = useMemo(() => {
    if (!wastages) return [];
    return wastages.flatMap((w: any) => 
      w.items.map((item: any) => ({
        ...item,
        id: `w${w.id}-i${item.id}`, // Unique ID for DataGrid
        entryId: w.id,
        wastage_date: w.wastage_date,
        reason: w.reason,
        entry: w // Keep reference for 'View'
      }))
    );
  }, [wastages]);

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 500, color: 'text.primary' }}>
            Wastage Logs
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button 
          variant="contained" 
          color="primary"
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
          Report Wastage
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
              <MenuItem value="reason">Reason</MenuItem>
              <MenuItem value="item">Item Name</MenuItem>
              <MenuItem value="id">Record ID</MenuItem>
            </TextField>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Quick Search
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search wastage records..."
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
          loading={wastagesLoading}
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
          Wastage Record Summary
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}>#{viewingWastage?.id}</Typography>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, p: 3 }}>
          <Stack spacing={0}>
            <DetailItem label="Wastage Date" value={viewingWastage?.wastage_date} />
            <DetailItem label="Reason / Notes" value={viewingWastage?.reason} />
            <DetailItem label="Recorded By" value={viewingWastage?.user?.full_name} />
          </Stack>

          <Typography variant="subtitle2" color="primary" sx={{ mb: 2, mt: 4, fontWeight: 'bold', textTransform: 'uppercase' }}>Items Wasted</Typography>
          <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'grey.50' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Quantity</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Unit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {viewingWastage?.items?.map((item: any, idx: number) => {
                  const itemData = items?.find((i: any) => i.id === item.item_id);
                  return (
                    <TableRow key={idx}>
                      <TableCell>{itemData?.item_name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>{item.quantity}</TableCell>
                      <TableCell align="right">{itemData?.unit?.unit_code}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 3, mb: 1, color: 'text.secondary', px: 1 }}>
            Audit Information
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <DetailItem 
              label="Created At" 
              value={viewingWastage?.created_at ? new Date(viewingWastage.created_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Created By" 
              value={users?.find((u: any) => u.id === viewingWastage?.created_by)?.full_name || viewingWastage?.user?.full_name || '-'} 
            />
            <DetailItem 
              label="Last Updated" 
              value={viewingWastage?.updated_at ? new Date(viewingWastage.updated_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Updated By" 
              value={users?.find((u: any) => u.id === viewingWastage?.updated_by)?.full_name || '-'} 
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
          {editingWastage ? 'Edit Wastage Record' : 'Log New Wastage'}
        </DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              mb: 4,
              mt: 1,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' },
              alignItems: 'start',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <TextField 
                {...register('wastage_date')} 
                label="Date *" 
                type="date" 
                fullWidth 
                slotProps={{ inputLabel: { shrink: true } }} 
                error={!!errors.wastage_date} 
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <TextField {...register('reason')} label="Reason / Description" fullWidth placeholder="e.g. Spoilage, Damage, Quality issue" />
            </Box>
          </Box>

          <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: 'bold', textTransform: 'uppercase' }}>
            Wastage Items List
          </Typography>
          
          <Paper elevation={0} variant="outlined" sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 3 }}>
            {/* Header Row */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, mb: 1, px: 1 }}>
              <Typography variant="caption" sx={{ flex: 7, fontWeight: 'bold', color: 'text.secondary' }}>Item Name *</Typography>
              <Typography variant="caption" sx={{ flex: 3, fontWeight: 'bold', ml: 1, color: 'text.secondary' }}>Quantity *</Typography>
              <Box sx={{ width: 40 }}></Box>
            </Box>

            {fields.map((field, index) => (
              <Stack key={field.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2, alignItems: 'start' }}>
                <Box sx={{ flex: 7, width: '100%' }}>
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
                          <MenuItem key={i.id} value={i.id}>{i.item_name} ({i.unit?.unit_code})</MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Box>
                <Box sx={{ flex: 3, width: '100%' }}>
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
                <IconButton color="error" onClick={() => remove(index)} disabled={fields.length === 1} size="small" sx={{ mt: { xs: 0, sm: index === 0 ? 0.5 : 0 } }}>
                  <Delete />
                </IconButton>
              </Stack>
            ))}
            
            <Button size="small" color="primary" startIcon={<Add />} onClick={() => append({ item_id: '' as any, quantity: 0 })} sx={{ mt: 1, fontWeight: 'bold' }}>
              Add Another Item
            </Button>
          </Paper>

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
            color="primary"
            startIcon={<Save />} 
            disabled={mutation.isPending}
            sx={{ px: 4, borderRadius: 2, fontWeight: 'bold' }}
          >
            {mutation.isPending ? 'Saving...' : editingWastage ? 'Update Record' : 'Save Record'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WastagesPage;






