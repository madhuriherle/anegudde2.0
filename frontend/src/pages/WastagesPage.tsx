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
  MenuItem,
  Chip,
  Stack,
  InputAdornment,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { 
  Add, 
  Edit, 
  Delete, 
  Search, 
  Save, 
  Visibility
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';

const wastageItemSchema = z.object({
  menu_item_id: z.coerce.number().min(1, 'Dish is required'),
  quantity: z.coerce.number().min(0.001, 'Quantity is required'),
});

const wastageSchema = z.object({
  wastage_date: z.string().min(1, 'Date is required'),
  reason: z.string().min(1, 'Reason is required'),
  items: z.array(wastageItemSchema).min(1, 'At least one item is required'),
});

type WastageFormValues = z.infer<typeof wastageSchema>;

const WastagesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingWastage, setEditingWastage] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingWastage, setViewingWastage] = useState<any>(null);

  // Fetch Data
  const { data: wastages, isLoading: wastagesLoading } = useQuery({
    queryKey: ['wastages', search, pageSize, status],
    queryFn: async () => {
      const params: any = { 
        q: search, 
        page_size: pageSize,
      };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      
      const res = await api.get('/wastages', { params });
      return res.data;
    },
  });

  const { data: menuItems } = useQuery({
    queryKey: ['menu-items-list'],
    queryFn: async () => (await api.get('/menu-items')).data,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<WastageFormValues>({
    resolver: zodResolver(wastageSchema),
    defaultValues: {
        items: [{ menu_item_id: '' as any, quantity: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const watchedItems = watch('items');
// Mutations
const mutation = useMutation({
  mutationFn: async (data: WastageFormValues) => {
    const payload = {
      ...data,
      status: 1,
    };
    if (editingWastage) return api.put(`/wastages/${editingWastage.id}`, payload);
    return api.post('/wastages', payload);
  },
  onSuccess: () => {    queryClient.invalidateQueries({ queryKey: ['wastages'] });
    showSuccess(editingWastage ? 'Wastage updated' : 'Wastage recorded');
    handleClose();
  },
  onError: (err: any) => {
    const detail = err.response?.data?.detail;
    const message = typeof detail === 'string' 
      ? detail 
      : (Array.isArray(detail) ? detail[0]?.msg : 'Operation failed');
    showError(message);
  }
});

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/wastages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wastages'] });
      showSuccess('Wastage deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
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
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
          })),
        });
      } catch (err) {
        showError('Failed to fetch wastage details');
        return;
      }
    } else {
      setEditingWastage(null);
      reset({
        wastage_date: new Date().toISOString().split('T')[0],
        reason: '',
        items: [{ menu_item_id: '' as any, quantity: 0 }],
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingWastage(null);
  };

  const handleView = async (wastage: any) => {
    try {
      const res = await api.get('/wastages/' + wastage.id);
      setViewingWastage(res.data);
      setViewDialogOpen(true);
    } catch (err) {
      showError('Failed to fetch wastage details');
    }
  };

  const onSubmit = async (data: WastageFormValues) => {
    const confirmed = await showConfirm(
      editingWastage ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingWastage ? 'update' : 'record'} this wastage?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  // Flattened items for DataGrid
  const flattenedRows = useMemo(() => {
    if (!wastages) return [];
    const rows: any[] = [];
    wastages.forEach((w: any) => {
      w.items.forEach((item: any) => {
        rows.push({
          id: `${w.id}-${item.id}`,
          entryId: w.id,
          wastage_date: w.wastage_date,
          menu_item_id: item.menu_item_id,
          dish_name: item.menu_item?.dish_name || 'Unknown',
          quantity: item.quantity,
          unit: item.menu_item?.unit?.unit_code || '',
          reason: w.reason,
          status: w.status,
          raw_wastage: w
        });
      });
    });
    return rows;
  }, [wastages]);

  const columns: any[] = [
    { field: 'entryId', headerName: 'Entry ID', flex: 0.4, minWidth: 80 },
    { field: 'wastage_date', headerName: 'Date', flex: 0.8, minWidth: 120 },
    { field: 'dish_name', headerName: 'Dish Name', flex: 1.5, minWidth: 150 },
    { 
      field: 'quantity', 
      headerName: 'Qty Wasted', 
      flex: 0.8, 
      minWidth: 100,
      renderCell: (params: any) => (
        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'error.main' }}>
          {params.value} {params.row.unit}
        </Typography>
      )
    },
    { field: 'reason', headerName: 'Reason', flex: 1.5, minWidth: 150 },
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <IconButton onClick={() => handleView(params.row.raw_wastage)} size="small" color="info" sx={{ mr: 1, bgcolor: 'info.light', color: 'white', '&:hover': { bgcolor: 'info.main' } }}>
            <Visibility fontSize="small" />
          </IconButton>
          <IconButton onClick={() => handleOpen(params.row.raw_wastage)} size="small" color="primary" sx={{ mr: 1, bgcolor: 'primary.light', color: 'white', '&:hover': { bgcolor: 'primary.main' } }}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton onClick={async () => {
            const confirmed = await showConfirm('Delete Record', `Are you sure you want to delete this wastage record?`);
            if (confirmed) {
              deleteMutation.mutate(params.row.entryId);
            }
          }} size="small" color="error" sx={{ bgcolor: 'error.light', color: 'white', '&:hover': { bgcolor: 'error.main' } }}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const DetailItem = ({ label, value, color }: { label: string, value: any, color?: string }) => (
    <Box sx={{ display: 'flex', py: 1, borderBottom: '1px dashed', borderColor: 'divider' }}>
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
            Wastage Records (Prepared Dishes)
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
          Record Wastage
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
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: '2fr 2.5fr 7.5fr' },
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
              Quick Search
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search by reason or dish..."
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
            sortable: col.field === 'entryId' || String(col.field).toLowerCase().includes('date'),
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
        <DialogTitle>Wastage Details</DialogTitle>
        <DialogContent sx={{ mt: 2, p: 3 }}>
          <Stack spacing={0}>
            <DetailItem label="Wastage Date" value={viewingWastage?.wastage_date} />
            <DetailItem label="Reason" value={viewingWastage?.reason} />
            <DetailItem label="Recorded By" value={viewingWastage?.user?.full_name} />
          </Stack>

          <Typography variant="subtitle2" color="primary" sx={{ mt: 4, mb: 1, fontWeight: 'bold', px: 1 }}>
            Wasted Dishes List
          </Typography>
          <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'grey.50' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Dish Name</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Quantity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {viewingWastage?.items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.menu_item?.dish_name}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                      {item.quantity} {item.menu_item?.unit?.unit_code}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setViewDialogOpen(false)} variant="contained" color="primary" sx={{ px: 4, borderRadius: 2, fontWeight: 'bold' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="sm" 
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle>
          {editingWastage ? 'Edit Wastage Record' : 'Record New Wastage'}
        </DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              mb: 4,
              mt: 1,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1.5fr' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box>
              <TextField
                {...register('wastage_date')}
                label="Date *"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!errors.wastage_date}
              />
            </Box>
            <Box>
              <TextField {...register('reason')} label="Reason/Remarks *" fullWidth error={!!errors.reason} />
            </Box>
          </Box>

          <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: 'bold', textTransform: 'uppercase' }}>
            Wasted Items (Prepared Dishes)
          </Typography>
          
          <Paper elevation={0} variant="outlined" sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 3 }}>
            {fields.map((field, index) => (
              <Stack key={field.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2, alignItems: 'start' }}>
                <Box sx={{ flex: 6, width: '100%' }}>
                  <Controller
                    name={`items.${index}.menu_item_id` as const}
                    control={control}
                    render={({ field: itemField }) => (
                      <TextField 
                        {...itemField}
                        select 
                        fullWidth 
                        size="small"
                        error={!!errors?.items?.[index]?.menu_item_id}
                        label={index === 0 ? "Select Dish" : ""}
                        sx={{ bgcolor: 'white' }}
                      >
                        {menuItems?.filter((i: any) => i.status === 1 || watchedItems?.[index]?.menu_item_id === i.id).map((i: any) => (
                          <MenuItem key={i.id} value={i.id}>{i.dish_name}</MenuItem>
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
                    slotProps={{
                        input: {
                            endAdornment: (
                                <Typography variant="caption" color="text.secondary">
                                    {menuItems?.find((mi: any) => mi.id === watchedItems?.[index]?.menu_item_id)?.unit?.unit_code || ''}
                                </Typography>
                            )
                        }
                    }}
                  />
                </Box>
                <IconButton color="error" onClick={() => remove(index)} disabled={fields.length === 1} size="small" sx={{ mt: { xs: 0, sm: index === 0 ? 0.5 : 0 } }}>
                  <Delete />
                </IconButton>
              </Stack>
            ))}
            
            <Button size="small" startIcon={<Add />} onClick={() => append({ menu_item_id: '' as any, quantity: 0 })} sx={{ mt: 1, fontWeight: 'bold' }}>
              Add Another Dish
            </Button>
          </Paper>
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
            {mutation.isPending ? 'Saving...' : editingWastage ? 'Update Record' : 'Save Record'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WastagesPage;
