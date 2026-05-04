import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  History, 
  Inventory,
  Visibility
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';

const itemSchema = z.object({
  item_name: z.string().min(1, 'Name is required'),
  category_id: z.coerce.number().min(1, 'Category is required'),
  unit_id: z.coerce.number().min(1, 'Unit is required'),
  opening_stock: z.coerce.number().min(0, 'Cannot be negative').optional().default(0),
  current_stock: z.coerce.number().min(0, 'Cannot be negative').optional().default(0),
  default_price: z.coerce.number().min(0, 'Cannot be negative').optional().default(0),
  min_stock_level: z.coerce.number().min(0, 'Cannot be negative').optional().default(0),
  max_stock_level: z.coerce.number().min(0, 'Cannot be negative').optional().default(0),
  status: z.coerce.number().default(1),
});

type ItemFormValues = z.infer<typeof itemSchema>;

const ItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [searchField, setSearchField] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<any>(null);

  // Fetch Data
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', search, pageSize, status, categoryId, searchField],
    queryFn: async () => {
      const params: any = { 
        q: search, 
        page_size: pageSize,
      };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      if (categoryId !== 'all') params.category_id = categoryId;
      if (searchField !== 'all') params.search_field = searchField;
      
      const res = await api.get('/items', { params });
      return res.data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['item-categories-list'],
    queryFn: async () => (await api.get('/item-categories')).data,
  });

  const { data: units } = useQuery({
    queryKey: ['units-list'],
    queryFn: async () => (await api.get('/units')).data,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
  });

  // Mutations
  const mutation = useMutation({
    mutationFn: async (data: ItemFormValues) => {
      const payload = {
        ...data,
        opening_stock: Number(data.opening_stock || 0),
        current_stock: Number(data.current_stock || 0),
        default_price: Number(data.default_price || 0),
        min_stock_level: Number(data.min_stock_level || 0),
        max_stock_level: Number(data.max_stock_level || 0),
        status: Number(data.status ?? 1),
      };
      if (editingItem) return api.put(`/items/${editingItem.id}`, payload);
      return api.post('/items', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess(editingItem ? 'Item updated' : 'Item added');
      handleClose();
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Operation failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Item deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: any) => api.post(`/items/${adjustItem.id}/adjust-stock`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showSuccess('Stock adjusted');
      setAdjustOpen(false);
      setAdjustQty(0);
      setAdjustReason('');
      if (viewingItem?.id === adjustItem.id) {
          api.get(`/items/${viewingItem.id}`).then(res => setViewingItem(res.data));
      }
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Adjustment failed'),
  });

  const handleOpen = (item: any = null) => {
    setEditingItem(item);
    if (item) reset(item);
    else reset({
      item_name: '',
      category_id: '' as any,
      unit_id: '' as any,
      opening_stock: 0,
      current_stock: 0,
      default_price: 0,
      min_stock_level: 0,
      max_stock_level: 0,
      status: 1
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingItem(null);
  };

  const handleAdjustOpen = (item: any) => {
    setAdjustItem(item);
    setAdjustOpen(true);
  };

  const handleView = async (item: any) => {
    try {
      const res = await api.get('/items/' + item.id);
      setViewingItem(res.data);
      setViewDialogOpen(true);
    } catch (err) {
      showError('Failed to fetch item details');
    }
  };

  const onSubmit = async (data: ItemFormValues) => {
    const confirmed = await showConfirm(
      editingItem ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingItem ? 'update' : 'save'} this item?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns: any[] = [
    { field: 'id', headerName: 'Item ID', flex: 0.4, minWidth: 80 },
    { field: 'item_name', headerName: 'Item Name', flex: 1.5, minWidth: 150 },
    { 
      field: 'category_id', 
      headerName: 'Category', 
      flex: 1.2,
      minWidth: 130,
      valueGetter: (params: any) => {
          const cat = categories?.find((c: any) => c.id === params);
          return cat ? cat.category_name : params;
      }
    },
    {
      field: 'current_stock',
      headerName: 'Stock',
      flex: 1,
      minWidth: 120,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Typography variant="body2" sx={{
            fontWeight: 'bold',
            color: params.row.current_stock <= params.row.min_stock_level ? 'error.main' : 'success.main',
          }}>
            {params.value} {units?.find((u: any) => u.id === params.row.unit_id)?.unit_code}
          </Typography>
        </Box>
      )
    },
    { 
      field: 'default_price', 
      headerName: 'Price', 
      flex: 1,
      minWidth: 100,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Typography variant="body2">
            Rs.{Number(params.value || 0).toLocaleString()}
          </Typography>
        </Box>
      )
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      flex: 0.8,
      minWidth: 110,
      renderCell: (params: any) => (
        <Chip 
          label={params.value === 1 ? 'Active' : 'Disabled'} 
          color={params.value === 1 ? 'success' : 'default'} 
          size="small" 
          sx={{ fontWeight: 600 }}
        />
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1.2,
      minWidth: 150,
      sortable: false,
      filterable: false,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <IconButton onClick={() => handleView(params.row)} size="small" color="info" sx={{ mr: 1, bgcolor: 'info.light', color: 'white', '&:hover': { bgcolor: 'info.main' } }}>
            <Visibility fontSize="small" />
          </IconButton>
          <IconButton onClick={() => navigate(`/items/${params.row.id}/history`)} size="small" color="secondary" sx={{ mr: 1, bgcolor: 'secondary.light', color: 'white', '&:hover': { bgcolor: 'secondary.main' } }}>
            <History fontSize="small" />
          </IconButton>
          <IconButton onClick={() => handleOpen(params.row)} size="small" color="primary" sx={{ mr: 1, bgcolor: 'primary.light', color: 'white', '&:hover': { bgcolor: 'primary.main' } }}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton onClick={async () => {
            const confirmed = await showConfirm('Delete Item', `Are you sure you want to delete this item?`);
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
        {value ?? '-'}
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
            Items & Stock
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
          Add New Item
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
        <Grid container spacing={3} sx={{ alignItems: 'flex-end' }}>
          <Grid item xs={12} sm={6} md={1.5}>
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
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
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
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Category
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <MenuItem value="all">All Categories</MenuItem>
              {categories?.map((c: any) => (
                <MenuItem key={c.id} value={c.id}>{c.category_name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
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
              <MenuItem value="name">Item Name</MenuItem>
              <MenuItem value="id">Item ID</MenuItem>
              <MenuItem value="category">Category</MenuItem>
              <MenuItem value="unit">Unit</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={12} md={4}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Search Items
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Type to search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>
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
          rows={items || []}
          columns={columns.map((col: any) => ({
            ...col,
            sortable: col.field === 'id' || col.field === 'entryId' || String(col.field).toLowerCase().includes('date'),
          }))}
          loading={itemsLoading}
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
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Item Details
          <Chip 
            label={viewingItem?.status === 1 ? 'Active' : 'Disabled'} 
            sx={{ bgcolor: viewingItem?.status === 1 ? 'success.main' : 'grey.400', color: 'white', fontWeight: 'bold' }}
            size="small" 
          />
        </DialogTitle>
        <DialogContent sx={{ mt: 2, p: 3 }}>
          <Stack spacing={0}>
            <DetailItem label="Item Name" value={viewingItem?.item_name} />
            <DetailItem label="Category" value={categories?.find((c: any) => c.id === viewingItem?.category_id)?.category_name} />
            <DetailItem label="Measurement Unit" value={`${units?.find((u: any) => u.id === viewingItem?.unit_id)?.unit_name} (${units?.find((u: any) => u.id === viewingItem?.unit_id)?.unit_code})`} />
            <DetailItem label="Standard Price" value={viewingItem?.default_price ? `Rs.${Number(viewingItem.default_price).toLocaleString()}` : 'Rs.0'} />
            <DetailItem label="Opening Stock" value={viewingItem?.opening_stock} />
            <DetailItem label="Min Stock Alert" value={viewingItem?.min_stock_level} />
            <DetailItem label="Max Stock Limit" value={viewingItem?.max_stock_level} />
            <DetailItem 
              label="Current Stock" 
              value={`${viewingItem?.current_stock} ${units?.find((u: any) => u.id === viewingItem?.unit_id)?.unit_code}`} 
              color={viewingItem?.current_stock <= viewingItem?.min_stock_level ? 'error.main' : 'success.main'}
            />
            {viewingItem?.current_stock <= viewingItem?.min_stock_level && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="warning" sx={{ borderRadius: 2 }}>Low stock level detected!</Alert>
              </Box>
            )}
          </Stack>

          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 3, mb: 1, color: 'text.secondary', px: 1 }}>
            Audit Information
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <DetailItem 
              label="Created At" 
              value={viewingItem?.created_at ? new Date(viewingItem.created_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Created By" 
              value={users?.find((u: any) => u.id === viewingItem?.created_by)?.username || viewingItem?.created_by} 
            />
            <DetailItem 
              label="Last Updated" 
              value={viewingItem?.updated_at ? new Date(viewingItem.updated_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Updated By" 
              value={users?.find((u: any) => u.id === viewingItem?.updated_by)?.username || viewingItem?.updated_by} 
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
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle>
          {editingItem ? 'Edit Item' : 'Add New Item'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField {...register('item_name')} label="Item Name *" fullWidth error={!!errors.item_name} helperText={errors.item_name?.message} />
            
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="category_id"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Category *" fullWidth error={!!errors.category_id} helperText={errors.category_id?.message}>
                    {categories?.map((c: any) => (
                      <MenuItem key={c.id} value={c.id}>{c.category_name}</MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <Controller
                name="unit_id"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Unit *" fullWidth error={!!errors.unit_id} helperText={errors.unit_id?.message}>
                    {units?.map((u: any) => (
                      <MenuItem key={u.id} value={u.id}>{u.unit_name} ({u.unit_code})</MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField {...register('opening_stock')} label="Opening Stock" type="number" fullWidth error={!!errors.opening_stock} helperText={errors.opening_stock?.message} />
              <TextField
                {...register('current_stock')}
                label="Current Stock"
                type="number"
                fullWidth
                error={!!errors.current_stock}
                helperText={errors.current_stock?.message}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField {...register('min_stock_level')} label="Min Stock Alert Level" type="number" fullWidth error={!!errors.min_stock_level} helperText={errors.min_stock_level?.message} />
              <TextField {...register('max_stock_level')} label="Max Stock Level" type="number" fullWidth error={!!errors.max_stock_level} helperText={errors.max_stock_level?.message} />
            </Stack>

            <TextField {...register('default_price')} label="Standard Price (Rs.)" type="number" fullWidth error={!!errors.default_price} helperText={errors.default_price?.message} />

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
          </Stack>
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
            {mutation.isPending ? 'Saving...' : editingItem ? 'Update Item' : 'Save Item'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustOpen} onClose={() => setAdjustOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Adjust Stock: {adjustItem?.item_name}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 2, color: 'white' }}>
              <Typography variant="body2">
                Current Stock: <strong>{adjustItem?.current_stock}</strong>
              </Typography>
            </Box>
            <TextField 
              label="Adjustment Quantity" 
              type="number" 
              fullWidth 
              value={adjustQty} 
              onChange={(e) => setAdjustQty(Number(e.target.value))}
              helperText="Use positive for addition, negative for deduction"
            />
            <TextField 
              label="Reason for Adjustment" 
              fullWidth 
              multiline 
              rows={2} 
              value={adjustReason} 
              onChange={(e) => setAdjustReason(e.target.value)} 
              placeholder="e.g. Stock audit correction, damage entry"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setAdjustOpen(false)} color="inherit">Cancel</Button>
          <Button 
            onClick={() => adjustMutation.mutate({ quantity: adjustQty, reason: adjustReason })} 
            variant="contained" 
            color="secondary"
            disabled={adjustMutation.isPending || !adjustQty}
            sx={{ px: 3, borderRadius: 2, fontWeight: 'bold' }}
          >
            {adjustMutation.isPending ? 'Adjusting...' : 'Apply Adjustment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItemsPage;






