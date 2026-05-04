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
  Restaurant,
  Visibility
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const consumptionItemSchema = z.object({
  item_id: z.coerce.number().min(1, 'Item is required'),
  quantity_used: z.coerce.number().min(0.001, 'Min quantity is 0.001'),
});

const consumptionSchema = z.object({
  chef_id: z.coerce.number().min(1, 'Chef is required'),
  usage_date: z.string().min(1, 'Date is required'),
  people_served: z.coerce.number().optional().or(z.literal('')).or(z.null()),
  items: z.array(consumptionItemSchema).min(1, 'At least one item is required'),
});

type ConsumptionFormValues = z.infer<typeof consumptionSchema>;

const ConsumptionsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [searchField, setSearchField] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingConsumption, setEditingConsumption] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingConsumption, setViewingConsumption] = useState<any>(null);

  const { data: consumptions, isLoading: consumptionsLoading } = useQuery({
    queryKey: ['consumptions', search, pageSize, status, searchField],
    queryFn: async () => {
      const params: any = { q: search, page_size: pageSize };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      if (searchField !== 'all') params.search_field = searchField;
      const res = await api.get('/consumptions/', { params });
      return res.data;
    },
  });

  const { data: chefs, isLoading: chefsLoading, isError: chefsError } = useQuery({
    queryKey: ['chefs-list'],
    queryFn: async () => {
      const res = await api.get('/chefs', { params: { page_size: 1000 } });
      return res.data;
    },
  });

  const chefOptions = useMemo(() => {
    if (Array.isArray(chefs)) return chefs;
    if (Array.isArray((chefs as any)?.items)) return (chefs as any).items;
    if (Array.isArray((chefs as any)?.data)) return (chefs as any).data;
    if (Array.isArray((chefs as any)?.results)) return (chefs as any).results;
    if (Array.isArray((chefs as any)?.rows)) return (chefs as any).rows;
    return [];
  }, [chefs]);

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

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<ConsumptionFormValues>({
    resolver: zodResolver(consumptionSchema),
    defaultValues: {
      usage_date: new Date().toISOString().split('T')[0],
      items: [{ item_id: '' as any, quantity_used: 0 }],
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
        people_served: data.people_served === '' || data.people_served === undefined ? null : Number(data.people_served),
        chef_id: data.chef_id === '' || data.chef_id === undefined ? null : Number(data.chef_id),
        items: (data.items || []).map((it: any) => ({
          item_id: Number(it.item_id),
          quantity_used: Number(it.quantity_used),
        })),
      };
      if (editingConsumption) {
        return api.put(`/consumptions/${editingConsumption.id}/`, { ...normalizedPayload, user_id: user?.id, status: 1 });
      }
      return api.post('/consumptions/', { ...normalizedPayload, user_id: user?.id, status: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      showSuccess(editingConsumption ? 'Usage record updated successfully' : 'Usage record saved successfully');
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
      return api.delete(`/consumptions/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      showSuccess('Usage record deleted successfully');
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Failed to delete record');
    }
  });

  const handleOpen = async (consumption: any = null) => {
    if (consumption) {
      try {
        const res = await api.get(`/consumptions/${consumption.id}`);
        const fullData = res.data;
        setEditingConsumption(fullData);
        reset({
          usage_date: fullData.usage_date,
          chef_id: fullData.chef_id,
          people_served: fullData.people_served || '',
          items: fullData.items.map((item: any) => ({
            item_id: item.item_id,
            quantity_used: item.quantity_used
          })),
        });
      } catch (err) {
        showError('Failed to fetch record details');
        return;
      }
    } else {
      setEditingConsumption(null);
      reset({
        usage_date: new Date().toISOString().split('T')[0],
        chef_id: '' as any,
        people_served: '',
        items: [{ item_id: '' as any, quantity_used: 0 }],
      });
    }
    setOpen(true);
  };

  const handleView = async (consumption: any) => {
    try {
      const res = await api.get(`/consumptions/${consumption.id}`);
      setViewingConsumption(res.data);
      setViewDialogOpen(true);
    } catch (err) {
      showError('Failed to fetch record details');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEditingConsumption(null);
  };

  const onSubmit = async (data: ConsumptionFormValues) => {
    const confirmed = await showConfirm(
      editingConsumption ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingConsumption ? 'update' : 'save'} this usage record?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns: any[] = [
    { 
      field: 'entryId', 
      headerName: 'Record ID', 
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
      field: 'usage_date', 
      headerName: 'Usage Date', 
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
      field: 'chef_id', 
      headerName: 'Chef', 
      flex: 1.5,
      minWidth: 150,
      valueGetter: (params: any) => {
          const chef = chefOptions?.find((c: any) => c.id === params);
          return chef ? chef.chef_name : params;
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
      field: 'quantity_used', 
      headerName: 'Qty Used', 
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
            const confirmed = await showConfirm('Delete Record', `Are you sure you want to delete this usage record?`);
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

  // Flatten the data: One row per item consumed
  const flattenedRows = useMemo(() => {
    if (!consumptions) return [];
    return consumptions.flatMap((c: any) => 
      c.items.map((item: any) => ({
        ...item,
        id: `c${c.id}-i${item.id}`, // Unique ID for DataGrid
        entryId: c.id,
        usage_date: c.usage_date,
        chef_id: c.chef_id,
        people_served: c.people_served,
        entry: c // Keep reference for 'View'
      }))
    );
  }, [consumptions]);

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
            Consumption Logs
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
          New Entry
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
              <MenuItem value="chef">Chef Name</MenuItem>
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
              placeholder="Search usage records..."
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
          loading={consumptionsLoading}
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
          Consumption Record Summary
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}>#{viewingConsumption?.id}</Typography>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, p: 3 }}>
          <Stack spacing={0}>
            <DetailItem label="Usage Date" value={viewingConsumption?.usage_date} />
            <DetailItem label="Chef in Charge" value={chefOptions?.find((c: any) => c.id === viewingConsumption?.chef_id)?.chef_name} />
            <DetailItem label="People Served" value={viewingConsumption?.people_served} />
            <DetailItem label="Recorded By" value={viewingConsumption?.user?.full_name} />
          </Stack>

          <Typography variant="subtitle2" color="primary" sx={{ mb: 2, mt: 4, fontWeight: 'bold', textTransform: 'uppercase' }}>Items Consumed</Typography>
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
                {viewingConsumption?.items?.map((item: any, idx: number) => {
                  const itemData = items?.find((i: any) => i.id === item.item_id);
                  return (
                    <TableRow key={idx}>
                      <TableCell>{itemData?.item_name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>{item.quantity_used}</TableCell>
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
              value={viewingConsumption?.created_at ? new Date(viewingConsumption.created_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Created By" 
              value={users?.find((u: any) => u.id === viewingConsumption?.created_by)?.full_name || viewingConsumption?.user?.full_name || '-'} 
            />
            <DetailItem 
              label="Last Updated" 
              value={viewingConsumption?.updated_at ? new Date(viewingConsumption.updated_at).toLocaleString() : '-'} 
            />
            <DetailItem 
              label="Updated By" 
              value={users?.find((u: any) => u.id === viewingConsumption?.updated_by)?.full_name || '-'} 
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
          {editingConsumption ? 'Edit Usage Record' : 'Log New Consumption'}
        </DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              mb: 4,
              mt: 1,
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(260px, 2fr) 1fr 1fr' },
              alignItems: 'start',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Controller
                name="chef_id"
                control={control}
                render={({ field }) => (
                  <TextField 
                    {...field}
                    select 
                    label="Select Chef *" 
                    fullWidth 
                    error={!!errors.chef_id} 
                    helperText={errors.chef_id?.message}
                  >
                    {chefsLoading && (
                      <MenuItem disabled value="">
                        Loading chefs...
                      </MenuItem>
                    )}
                    {!chefsLoading && chefsError && (
                      <MenuItem disabled value="">
                        Failed to load chefs
                      </MenuItem>
                    )}
                    {!chefsLoading && !chefsError && chefOptions.map((c: any) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.chef_name || c.name || `Chef #${c.id}`}
                      </MenuItem>
                    ))}
                    {!chefsLoading && !chefsError && chefOptions.length === 0 && (
                      <MenuItem disabled value="">
                        No chefs found
                      </MenuItem>
                    )}
                  </TextField>
                )}
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <TextField
                {...register('usage_date')}
                label="Date *"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!errors.usage_date}
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <TextField {...register('people_served')} label="People Served" type="number" fullWidth />
            </Box>
          </Box>

          <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: 'bold', textTransform: 'uppercase' }}>
            Consumed Items List
          </Typography>
          
          <Paper elevation={0} variant="outlined" sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 3 }}>
            {/* Header Row */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, mb: 1, px: 1 }}>
              <Typography variant="caption" sx={{ flex: 7, fontWeight: 'bold', color: 'text.secondary' }}>Item Name *</Typography>
              <Typography variant="caption" sx={{ flex: 3, fontWeight: 'bold', ml: 1, color: 'text.secondary' }}>Quantity Used *</Typography>
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
                    {...register(`items.${index}.quantity_used` as const)} 
                    type="number" 
                    fullWidth 
                    size="small" 
                    error={!!errors?.items?.[index]?.quantity_used}
                    label={index === 0 ? "Qty" : ""}
                    sx={{ bgcolor: 'white' }}
                  />
                </Box>
                <IconButton color="error" onClick={() => remove(index)} disabled={fields.length === 1} size="small" sx={{ mt: { xs: 0, sm: index === 0 ? 0.5 : 0 } }}>
                  <Delete />
                </IconButton>
              </Stack>
            ))}
            
            <Button size="small" color="primary" startIcon={<Add />} onClick={() => append({ item_id: '' as any, quantity_used: 0 })} sx={{ mt: 1, fontWeight: 'bold' }}>
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
            {mutation.isPending ? 'Saving...' : editingConsumption ? 'Update Record' : 'Save Entry'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConsumptionsPage;







