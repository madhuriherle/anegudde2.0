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
  Group,
  Visibility
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';

const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().regex(/^[0-9]{8,15}$/, 'Phone number must be between 8 and 15 digits').optional().or(z.literal('')),
  role_id: z.coerce.number().min(1, 'Role is required'),
  status: z.coerce.number().default(1),
});

type UserFormValues = z.infer<typeof userSchema>;

const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<any>(null);

  // Fetch Data
  const { data: users, isLoading } = useQuery({
    queryKey: ['users', search, pageSize, status],
    queryFn: async () => {
      const params: any = { q: search, page_size: pageSize };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      const res = await api.get('/users', { params });
      return res.data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/users/roles');
      return res.data;
    },
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      if (editingUser) {
        return api.put(`/users/${editingUser.id}`, data);
      }
      return api.post('/users', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess(editingUser ? 'User updated' : 'User created');
      handleClose();
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Operation failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess('User deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const handleOpen = (userData: any = null) => {
    setEditingUser(userData);
    if (userData) {
      reset({ ...userData, password: '' });
    } else {
      reset({ username: '', password: '', full_name: '', email: '', phone: '', role_id: '' as any, status: 1 });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingUser(null);
  };

  const handleView = (userData: any) => {
    setViewingUser(userData);
    setViewDialogOpen(true);
  };

  const onSubmit = async (data: UserFormValues) => {
    const confirmed = await showConfirm(
      editingUser ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingUser ? 'update' : 'save'} this user?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns: any[] = [
    { field: 'id', headerName: 'ID', flex: 0.4, minWidth: 60 },
    { field: 'username', headerName: 'Username', flex: 1, minWidth: 120 },
    { field: 'full_name', headerName: 'Full Name', flex: 1.5, minWidth: 160 },
    { 
      field: 'role_id', 
      headerName: 'Role', 
      flex: 1,
      minWidth: 120,
      valueGetter: (params: any) => {
          const role = roles?.find((r: any) => r.id === params);
          return role ? role.role_name : params;
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
          <IconButton onClick={() => handleOpen(params.row)} size="small" color="primary" sx={{ mr: 1, bgcolor: 'primary.light', color: 'white', '&:hover': { bgcolor: 'primary.main' } }}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton onClick={async () => {
            const confirmed = await showConfirm('Delete User', `Are you sure you want to delete user "${params.row.username}"?`);
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

  const DetailItem = ({ label, value }: { label: string, value: any }) => (
    <Box sx={{ display: 'flex', py: 1.2, borderBottom: '1px dashed', borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ fontWeight: 'bold', width: '40%', color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ width: '60%', fontWeight: 500, color: 'text.primary' }}>
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
            User Management
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
          Add New User
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
              Status Filter
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
              placeholder="Search users..."
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
          height: 600, 
          width: '100%', 
          borderRadius: 4, 
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 10px 30px rgba(0,0,0,0.03)'
        }}
      >
        <DataGrid
          rows={users || []}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[pageSize]}
          initialState={{
            pagination: { paginationModel: { pageSize: pageSize } },
          }}
          disableRowSelectionOnClick
          disableColumnMenu
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
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          User Details
          <Chip 
            label={viewingUser?.status === 1 ? 'Active' : 'Disabled'} 
            sx={{ bgcolor: viewingUser?.status === 1 ? 'success.main' : 'grey.400', color: 'white', fontWeight: 'bold' }}
            size="small" 
          />
        </DialogTitle>
        <DialogContent sx={{ mt: 2, p: 3 }}>
          <Stack spacing={0}>
            <DetailItem label="Username" value={viewingUser?.username} />
            <DetailItem label="Full Name" value={viewingUser?.full_name} />
            <DetailItem label="Email" value={viewingUser?.email} />
            <DetailItem label="Phone" value={viewingUser?.phone} />
            <DetailItem label="Role" value={roles?.find((r: any) => r.id === viewingUser?.role_id)?.role_name} />
          </Stack>

          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 3, mb: 1, color: 'text.secondary', px: 1 }}>
            Audit Information
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <DetailItem 
              label="Created At" 
              value={viewingUser?.created_at ? new Date(viewingUser.created_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Last Updated" 
              value={viewingUser?.updated_at ? new Date(viewingUser.updated_at).toLocaleString() : '-'} 
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
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle>
          {editingUser ? 'Edit User' : 'New User'}
        </DialogTitle>
        <DialogContent dividers>
          <Box 
            sx={{ 
              mt: 1,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 3
            }}
          >
            <Box>
              <TextField {...register('username')} label="Username *" fullWidth error={!!errors.username} helperText={errors.username?.message} disabled={!!editingUser} />
            </Box>
            <Box>
              <TextField {...register('password')} label={editingUser ? "Password (Leave blank to keep same)" : "Password *"} type="password" fullWidth error={!!errors.password} helperText={errors.password?.message} />
            </Box>
            <Box sx={{ gridColumn: 'span 2' }}>
              <TextField {...register('full_name')} label="Full Name *" fullWidth error={!!errors.full_name} helperText={errors.full_name?.message} />
            </Box>
            <Box>
              <TextField {...register('email')} label="Email Address" fullWidth error={!!errors.email} helperText={errors.email?.message} />
            </Box>
            <Box>
              <TextField {...register('phone')} label="Phone Number" fullWidth error={!!errors.phone} helperText={errors.phone?.message} />
            </Box>
            <Box sx={{ gridColumn: 'span 2' }}>
              <Controller
                name="role_id"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Role *" fullWidth error={!!errors.role_id} helperText={errors.role_id?.message}>
                    {roles?.map((r: any) => (
                      <MenuItem key={r.id} value={r.id}>{r.role_name}</MenuItem>
                    ))}
                  </TextField>
                )}
              />
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
            {mutation.isPending ? 'Saving...' : editingUser ? 'Update User' : 'Save User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPage;






