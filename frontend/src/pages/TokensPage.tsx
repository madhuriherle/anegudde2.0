import React, { useState, useMemo } from 'react';
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
  MenuItem,
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
  Search, 
  Save, 
  Visibility,
  History,
  ConfirmationNumber
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';

const tokenSchema = z.object({
  token_count: z.coerce.number().min(1, 'Token count must be at least 1'),
});

type TokenFormValues = z.infer<typeof tokenSchema>;

const TokensPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingDate, setViewingDate] = useState<string | null>(null);

  // Fetch Generations (Daily Summaries)
  const { data: generations, isLoading: generationsLoading } = useQuery({
    queryKey: ['token-generations', pageSize],
    queryFn: async () => {
      const res = await api.get('/tokens/', { params: { page_size: pageSize } });
      return res.data;
    },
  });

  // Fetch Details for a specific date
  const { data: details, isLoading: detailsLoading } = useQuery({
    queryKey: ['token-details', viewingDate],
    queryFn: async () => {
      if (!viewingDate) return [];
      const res = await api.get(`/tokens/details/${viewingDate}`);
      return res.data;
    },
    enabled: !!viewingDate,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TokenFormValues>({
    resolver: zodResolver(tokenSchema),
    defaultValues: {
        token_count: 0
    }
  });

  // Mutation for creating tokens
  const createMutation = useMutation({
    mutationFn: async (data: TokenFormValues) => {
      return api.post('/tokens/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-generations'] });
      showSuccess('Tokens recorded successfully');
      handleClose();
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Failed to record tokens');
    }
  });

  const handleOpen = () => {
    reset({ token_count: 0 });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleViewDetails = (date: string) => {
    setViewingDate(date);
    setViewDialogOpen(true);
  };

  const onSubmit = async (data: TokenFormValues) => {
    const confirmed = await showConfirm(
      "Confirm Recording",
      `Are you sure you want to record ${data.token_count} tokens?`
    );

    if (confirmed) {
      createMutation.mutate(data);
    }
  };

  const columns: any[] = [
    { field: 'date', headerName: 'Date', flex: 1, minWidth: 150 },
    { 
      field: 'total_tokens', 
      headerName: 'Total Tokens Issued', 
      flex: 1, 
      minWidth: 150,
      renderCell: (params: any) => (
        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          {params.value}
        </Typography>
      )
    },
    { field: 'created_at', headerName: 'First Token At', flex: 1, minWidth: 180, 
      valueFormatter: (params: any) => new Date(params).toLocaleString() 
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 0.8,
      minWidth: 120,
      sortable: false,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params: any) => (
        <Button 
          startIcon={<Visibility />} 
          size="small" 
          variant="outlined"
          onClick={() => handleViewDetails(params.row.date)}
          sx={{ borderRadius: 2 }}
        >
          Details
        </Button>
      ),
    },
  ];

  return (
    <Box sx={{ px: { xs: 1, md: 3 }, pb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ConfirmationNumber color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Token Management
            </Typography>
            <Button 
              size="small" 
              startIcon={<History />} 
              onClick={() => navigate('/tokens/history')}
              sx={{ textTransform: 'none', mt: -0.5 }}
            >
              View Detailed Ledger
            </Button>
          </Box>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<Add />} 
          onClick={handleOpen}
          sx={{ 
            px: 3, 
            py: 1, 
            borderRadius: 2.5,
            boxShadow: '0 4px 12px rgba(26, 35, 126, 0.2)',
            fontWeight: 'bold'
          }}
        >
          Issue New Tokens
        </Button>
      </Box>

      <Paper 
        elevation={0}
        sx={{ 
          height: 600, 
          width: '100%', 
          borderRadius: 4, 
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}
      >
        <DataGrid
          rows={generations || []}
          columns={columns}
          loading={generationsLoading}
          pageSizeOptions={[pageSize]}
          initialState={{
            pagination: { paginationModel: { pageSize: pageSize } },
          }}
          disableRowSelectionOnClick
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeader': {
              backgroundColor: 'rgba(0, 0, 0, 0.02)',
              fontWeight: 'bold',
            },
            '& .MuiDataGrid-cell:focus': { outline: 'none' },
          }}
        />
      </Paper>

      {/* Issue Tokens Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Issue New Tokens</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the number of tokens being issued right now. This will be added to today's total.
            </Typography>
            <TextField
              {...register('token_count')}
              label="Token Count *"
              type="number"
              fullWidth
              autoFocus
              error={!!errors.token_count}
              helperText={errors.token_count?.message}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <ConfirmationNumber fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={handleClose} color="inherit">Cancel</Button>
          <Button 
            onClick={handleSubmit(onSubmit)} 
            variant="contained" 
            disabled={createMutation.isPending}
            sx={{ px: 4, borderRadius: 2, fontWeight: 'bold' }}
          >
            {createMutation.isPending ? 'Processing...' : 'Issue Tokens'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
          <History color="primary" />
          Token Details for {viewingDate}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'grey.50' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', py: 1.5 }}>Time</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', py: 1.5 }}>Tokens Issued</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', py: 1.5 }}>Issued By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detailsLoading ? (
                  <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
                ) : details?.length === 0 ? (
                  <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4 }}>No data found</TableCell></TableRow>
                ) : (
                  details?.map((detail: any) => (
                    <TableRow key={detail.id} hover>
                      <TableCell sx={{ py: 1.5 }}>{new Date(detail.created_at).toLocaleTimeString()}</TableCell>
                      <TableCell align="right" sx={{ py: 1.5, fontWeight: 'bold', color: 'primary.main' }}>
                        {detail.token_count}
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1.5 }}>
                        {detail.creator?.full_name || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setViewDialogOpen(false)} variant="outlined" sx={{ px: 4, borderRadius: 2 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TokensPage;
