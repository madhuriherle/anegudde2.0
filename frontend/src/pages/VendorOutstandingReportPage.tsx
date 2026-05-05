import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Chip,
  Grid,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Download, WarningAmber, Search, ReceiptLong } from '@mui/icons-material';
import api from '../api/axios';

const VendorOutstandingReportPage: React.FC = () => {
  const [search, setSearch] = useState('');

  const { data: vendorData, isLoading } = useQuery({
    queryKey: ['vendor-outstanding'],
    queryFn: async () => {
      const res = await api.get('/reports/vendor-outstanding');
      return res.data;
    },
  });

  const filteredData = useMemo(() => {
    if (!search || !vendorData) return vendorData;
    return vendorData.filter((v: any) => 
      v.vendor_name.toLowerCase().includes(search.toLowerCase()) || 
      v.vendor_code.toLowerCase().includes(search.toLowerCase())
    );
  }, [vendorData, search]);

  const handleExport = () => {
    if (!vendorData || vendorData.length === 0) {
      alert('No data available to export');
      return;
    }

    const headers = [
      'Vendor Code',
      'Vendor Name',
      'Contact',
      'Current Balance',
      'Credit Limit',
    ];

    const rows = vendorData.map((v: any) => [
      v.vendor_code,
      v.vendor_name,
      v.contact_number,
      v.current_balance,
      v.credit_limit || 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vendor_outstanding_report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box
      sx={{
        px: { xs: 1, md: 3 },
        pt: { xs: 0, md: 0.5 },
        pb: { xs: 1, md: 3 },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 500, color: 'text.primary' }}>
              Vendor Outstanding & Aging
            </Typography>
            
          </Box>
        </Box>
        <Button 
          variant="outlined" 
          startIcon={<Download />} 
          onClick={handleExport}
          sx={{ fontWeight: 'bold', borderRadius: 2 }}
        >
          Export CSV
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
            gap: 2,
            alignItems: 'end',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Quick Search
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search by vendor name or code..."
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

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Vendor Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Contact</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Outstanding Balance</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Credit Limit</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                  <CircularProgress />
                  <Typography variant="body2" sx={{ mt: 2 }}>Loading vendor balances...</Typography>
                </TableCell>
              </TableRow>
            ) : filteredData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                  <Typography variant="body1" color="text.secondary">No outstanding payments matching filter.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredData?.map((v: any) => {
                const isOverLimit = v.credit_limit && Number(v.current_balance) > Number(v.credit_limit);
                return (
                  <TableRow key={v.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ fontWeight: 'bold', py: 1.5 }}>{v.vendor_name}</TableCell>
                    <TableCell sx={{ py: 1.5 }}>{v.vendor_code}</TableCell>
                    <TableCell sx={{ py: 1.5 }}>{v.contact_number}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: 'error.main', py: 1.5 }}>
                      ₹{Number(v.current_balance).toLocaleString()}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      {v.credit_limit ? `₹${Number(v.credit_limit).toLocaleString()}` : 'No Limit'}
                    </TableCell>
                    <TableCell align="center" sx={{ py: 1.5 }}>
                      {isOverLimit ? (
                        <Chip 
                          icon={<WarningAmber />} 
                          label="OVER LIMIT" 
                          color="error" 
                          size="small" 
                          variant="filled" 
                          sx={{ fontWeight: 'bold' }}
                        />
                      ) : (
                        <Chip label="ACTIVE" color="success" size="small" variant="outlined" sx={{ fontWeight: 'bold' }} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default VendorOutstandingReportPage;




