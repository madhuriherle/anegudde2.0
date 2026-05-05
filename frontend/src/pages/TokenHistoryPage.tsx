import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  Breadcrumbs,
  Link,
  Avatar,
  TextField,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import { 
  ArrowBack,
  Search,
  CalendarToday,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import api from '../api/axios';

const TokenHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  
  // States
  const [pageSize, setPageSize] = useState(50);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch Data
  const { data: history, isLoading } = useQuery({
    queryKey: ['token-history', pageSize, startDate, endDate],
    queryFn: async () => {
      const params: any = { page_size: pageSize };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const res = await api.get('/tokens/history', { params });
      return res.data;
    },
  });

  const columns: any[] = [
    { field: 'id', headerName: 'ID', width: 80, sortable: false },
    { 
      field: 'created_at', 
      headerName: 'Date & Time', 
      flex: 1, 
      minWidth: 200,
      sortable: false,
      renderCell: (params: any) => {
        if (!params.value) return '-';
        const date = new Date(params.value);
        return (
          <Typography variant="body2">
            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        );
      }
    },
    { 
      field: 'token_count', 
      headerName: 'Tokens Issued', 
      flex: 0.8, 
      minWidth: 120,
      sortable: false,
      renderCell: (params: any) => (
        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          {params.value}
        </Typography>
      )
    },
    { 
      field: 'creator', 
      headerName: 'Issued By', 
      flex: 1, 
      minWidth: 150,
      sortable: false,
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: 'secondary.light' }}>
            {params.value?.full_name?.[0]}
          </Avatar>
          <Typography variant="body2">
            {params.value?.full_name || '-'}
          </Typography>
        </Box>
      )
    },
  ];

  return (
    <Box sx={{ px: { xs: 1, md: 3 }, pb: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs sx={{ mb: 1 }}>
          <Link 
            component="button" 
            variant="body2" 
            onClick={() => navigate('/tokens')}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', color: 'text.secondary', textDecoration: 'none' }}
          >
            Token Management
          </Link>
          <Typography color="text.primary" variant="body2">Detailed History</Typography>
        </Breadcrumbs>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton onClick={() => navigate('/tokens')} size="small" sx={{ bgcolor: 'grey.100' }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Token Issuance Ledger
          </Typography>
        </Box>
      </Box>

      {/* Filter Block - Matching Wastages Style */}
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
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1.5fr 1.5fr' },
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
              Start Date
            </Typography>
            <TextField
              type="date"
              fullWidth
              size="small"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarToday fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              End Date
            </Typography>
            <TextField
              type="date"
              fullWidth
              size="small"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarToday fontSize="small" color="action" />
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
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}
      >
        <DataGrid
          rows={history || []}
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
            '& .MuiDataGrid-cell:focus': { outline: 'none' },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'rgba(26, 35, 126, 0.04)',
            },
          }}
        />
      </Paper>
    </Box>
  );
};

export default TokenHistoryPage;
