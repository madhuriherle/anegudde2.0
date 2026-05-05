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
  Visibility
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';

const menuItemSchema = z.object({
  dish_name: z.string().min(1, 'Dish name is required'),
  unit_id: z.coerce.number().min(1, 'Unit is required'),
  status: z.coerce.number().default(1),
});

type MenuItemFormValues = z.infer<typeof menuItemSchema>;

const MenuItemsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingMenuItem, setViewingMenuItem] = useState<any>(null);

  // Fetch Data
  const { data: menuItems, isLoading: menuItemsLoading } = useQuery({
    queryKey: ['menu-items', search, pageSize, status],
    queryFn: async () => {
      const params: any = { 
        q: search, 
        page_size: pageSize,
      };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      
      const res = await api.get('/menu-items', { params });
      return res.data;
    },
  });

  const { data: units } = useQuery({
    queryKey: ['units-list'],
    queryFn: async () => (await api.get('/units')).data,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
  });

  // Mutations
  const mutation = useMutation({
    mutationFn: async (data: MenuItemFormValues) => {
      if (editingMenuItem) return api.put(`/menu-items/${editingMenuItem.id}`, data);
      return api.post('/menu-items', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showSuccess(editingMenuItem ? 'Menu item updated' : 'Menu item added');
      handleClose();
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Operation failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/menu-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showSuccess('Menu item deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const handleOpen = (item: any = null) => {
    setEditingMenuItem(item);
    if (item) reset(item);
    else reset({
      dish_name: '',
      unit_id: '' as any,
      status: 1
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingMenuItem(null);
  };

  const handleView = async (item: any) => {
    setViewingMenuItem(item);
    setViewDialogOpen(true);
  };

  const onSubmit = async (data: MenuItemFormValues) => {
    const confirmed = await showConfirm(
      editingMenuItem ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingMenuItem ? 'update' : 'save'} this menu item?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns: any[] = [
    { field: 'id', headerName: 'ID', flex: 0.4, minWidth: 80 },
    { field: 'dish_name', headerName: 'Dish Name', flex: 2, minWidth: 200 },
    { 
      field: 'unit_id', 
      headerName: 'Unit', 
      flex: 1,
      minWidth: 120,
      valueGetter: (params: any) => {
          const unit = units?.find((u: any) => u.id === params);
          return unit ? `${unit.unit_name} (${unit.unit_code})` : params;
      }
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
      flex: 1,
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
          <IconButton onClick={() => handleOpen(params.row)} size="small" color="primary" sx={{ mr: 1, bgcolor: 'primary.light', color: 'white', '&:hover': { bgcolor: 'primary.main' } }}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton onClick={async () => {
            const confirmed = await showConfirm('Delete Menu Item', `Are you sure you want to delete this menu item?`);
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
            Menu Items (Prepared Dishes)
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
          Add Menu Item
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
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: '1.5fr 2fr 8.5fr' },
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
              placeholder="Search dishes..."
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
          rows={menuItems || []}
          columns={columns}
          loading={menuItemsLoading}
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
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Menu Item Details
          <Chip 
            label={viewingMenuItem?.status === 1 ? 'Active' : 'Disabled'} 
            sx={{ bgcolor: viewingMenuItem?.status === 1 ? 'success.main' : 'grey.400', color: 'white', fontWeight: 'bold' }}
            size="small" 
          />
        </DialogTitle>
        <DialogContent sx={{ mt: 2, p: 3 }}>
          <Stack spacing={0}>
            <DetailItem label="Dish Name" value={viewingMenuItem?.dish_name} />
            <DetailItem label="Measurement Unit" value={`${viewingMenuItem?.unit?.unit_name} (${viewingMenuItem?.unit?.unit_code})`} />
          </Stack>

          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 3, mb: 1, color: 'text.secondary', px: 1 }}>
            Audit Information
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <DetailItem 
              label="Created At" 
              value={viewingMenuItem?.created_at ? new Date(viewingMenuItem.created_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Created By" 
              value={users?.find((u: any) => u.id === viewingMenuItem?.created_by)?.username || viewingMenuItem?.created_by} 
            />
            <DetailItem 
              label="Last Updated" 
              value={viewingMenuItem?.updated_at ? new Date(viewingMenuItem.updated_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Updated By" 
              value={users?.find((u: any) => u.id === viewingMenuItem?.updated_by)?.username || viewingMenuItem?.updated_by} 
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
        maxWidth="xs" 
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle>
          {editingMenuItem ? 'Edit Menu Item' : 'Add New Menu Item'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField {...register('dish_name')} label="Dish Name *" fullWidth error={!!errors.dish_name} helperText={errors.dish_name?.message} />
            
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
            {mutation.isPending ? 'Saving...' : editingMenuItem ? 'Update Item' : 'Save Item'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MenuItemsPage;
