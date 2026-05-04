import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  CircularProgress,
  Chip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ShoppingCart from '@mui/icons-material/ShoppingCart';
import Restaurant from '@mui/icons-material/Restaurant';
import Tune from '@mui/icons-material/Tune';
import HelpOutlined from '@mui/icons-material/HelpOutlined';
import api from '../api/axios';

const txnTypes: Record<number, { label: string; icon: any; color: string }> = {
  1: { label: 'Purchase', icon: <ShoppingCart sx={{ fontSize: 16 }} />, color: 'success' },
  2: { label: 'Consumption', icon: <Restaurant sx={{ fontSize: 16 }} />, color: 'error' },
  3: { label: 'Wastage', icon: <HelpOutlined sx={{ fontSize: 16 }} />, color: 'warning' },
  4: { label: 'Adjustment', icon: <Tune sx={{ fontSize: 16 }} />, color: 'secondary' },
};

const ItemHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: item } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const res = await api.get(`/items/${id}`);
      return res.data;
    },
  });

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['item-ledger', id],
    queryFn: async () => {
      const res = await api.get(`/items/${id}/ledger`);
      return res.data;
    },
  });

  const columns: any[] = [
    { field: 'id', headerName: 'Ledger ID', width: 100, sortable: true },
    { field: 'txn_date', headerName: 'Date', width: 130, sortable: true },
    {
      field: 'txn_type',
      headerName: 'Type',
      width: 150,
      sortable: false,
      renderCell: (params) => {
        const type = txnTypes[params.value] || { label: 'Unknown', color: 'default' };
        return (
          <Chip
            icon={type.icon}
            label={type.label}
            size="small"
            color={type.color as any}
            variant="outlined"
            sx={{ fontWeight: 'medium' }}
          />
        );
      }
    },
    {
      field: 'ref_info',
      headerName: 'Reference',
      width: 180,
      sortable: false,
      valueGetter: (params, row) => `${row.ref_table} #${row.ref_id}`
    },
    {
      field: 'qty_in',
      headerName: 'Qty In',
      width: 100,
      type: 'number',
      sortable: false,
      cellClassName: 'numeric-cell-top',
      renderCell: (params) => (
        <Typography variant="body2" sx={{ color: params.value > 0 ? 'success.main' : 'text.disabled', fontWeight: params.value > 0 ? 'bold' : 'normal' }}>
          {params.value > 0 ? `+${params.value}` : '-'}
        </Typography>
      )
    },
    {
      field: 'qty_out',
      headerName: 'Qty Out',
      width: 100,
      type: 'number',
      sortable: false,
      cellClassName: 'numeric-cell-top',
      renderCell: (params) => (
        <Typography variant="body2" sx={{ color: params.value > 0 ? 'error.main' : 'text.disabled', fontWeight: params.value > 0 ? 'bold' : 'normal' }}>
          {params.value > 0 ? `-${params.value}` : '-'}
        </Typography>
      )
    },
    {
      field: 'unit_cost',
      headerName: 'Unit Cost',
      width: 120,
      type: 'number',
      sortable: false,
      cellClassName: 'numeric-cell-top',
      valueFormatter: (params) => `?${Number(params).toLocaleString()}`
    },
    {
      field: 'value_in',
      headerName: 'Value In',
      width: 120,
      type: 'number',
      sortable: false,
      cellClassName: 'numeric-cell-top',
      valueFormatter: (params) => params > 0 ? `?${Number(params).toLocaleString()}` : '-'
    },
    {
      field: 'value_out',
      headerName: 'Value Out',
      width: 120,
      type: 'number',
      sortable: false,
      cellClassName: 'numeric-cell-top',
      valueFormatter: (params) => params > 0 ? `?${Number(params).toLocaleString()}` : '-'
    },
    {
      field: 'balance',
      headerName: 'Running Balance',
      width: 130,
      type: 'number',
      sortable: false,
      cellClassName: 'numeric-cell-top',
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          {params.value}
        </Typography>
      )
    },
  ];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <IconButton onClick={() => navigate('/items')}>
          <ArrowBack />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 500, color: 'text.primary' }}>
            {item?.item_name} - Ledger History
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ height: 600, width: '100%', borderRadius: 2, boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
        <DataGrid
          rows={ledger || []}
          columns={columns.map((col: any) => ({
            ...col,
            sortable: col.field === 'id' || col.field === 'entryId' || String(col.field).toLowerCase().includes('date'),
          }))}
          loading={isLoading}
          pageSizeOptions={[20, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 20 } },
            sorting: { sortModel: [{ field: 'id', sort: 'desc' }] },
          }}
          disableRowSelectionOnClick
          disableColumnMenu
          disableColumnFilter
          disableColumnSelector
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
            '& .numeric-cell-top': {
              alignItems: 'flex-start',
              pt: 1,
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
    </Box>
  );
};

export default ItemHistoryPage;



