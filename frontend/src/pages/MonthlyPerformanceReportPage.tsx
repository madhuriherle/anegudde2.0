import React from 'react';
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
} from '@mui/material';
import { Download, CalendarMonth } from '@mui/icons-material';
import api from '../api/axios';

const MonthlyPerformanceReportPage: React.FC = () => {
  const { data: monthlyData, isLoading } = useQuery({
    queryKey: ['monthly-performance'],
    queryFn: async () => {
      const res = await api.get('/reports/monthly-performance');
      return res.data;
    },
  });

  const totalStockValue = monthlyData?.reduce((sum: number, row: any) => sum + (Number(row.stock_value) || 0), 0) || 0;

  const handleExport = () => {
    if (!monthlyData || monthlyData.length === 0) {
      alert('No data available to export');
      return;
    }

    const headers = [
      'Month',
      'Item Name',
      'Opening Stock',
      'Purchased',
      'Consumed',
      'Wastage',
      'Adjustment',
      'Closing Stock',
      'Stock Value',
    ];

    const rows = monthlyData.map((row: any) => [
      row.month,
      row.item_name,
      row.opening_stock,
      row.total_purchased,
      row.total_consumed,
      row.total_wastage,
      row.total_adjustment,
      row.closing_stock,
      row.stock_value,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `monthly_performance_report.csv`);
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
              Monthly Performance
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

      <Paper sx={{ mb: 4, p: 3, bgcolor: 'primary.main', color: 'white', borderRadius: 4, display: 'inline-block', minWidth: 300, boxShadow: '0 4px 12px rgba(26, 35, 126, 0.2)' }}>
        <Typography variant="subtitle2" sx={{ opacity: 0.9, fontWeight: 'bold', textTransform: 'uppercase', mb: 1 }}>
          Cumulative Stock Value
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          ₹{totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 1 }}>
          Total value of all item snapshots in this report
        </Typography>
      </Paper>

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Month</TableCell>
              <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Item Name</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Opening</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Purchased</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Consumed</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Wastage</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Closing</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Est. Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                  <CircularProgress />
                  <Typography variant="body2" sx={{ mt: 2 }}>Loading monthly data...</Typography>
                </TableCell>
              </TableRow>
            ) : monthlyData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <Typography variant="body1" color="text.secondary">No monthly summaries found.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              monthlyData?.map((row: any) => (
                <TableRow key={row.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell sx={{ fontWeight: 'bold', py: 1.5 }}>{new Date(row.month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</TableCell>
                  <TableCell sx={{ py: 1.5 }}>{row.item_name}</TableCell>
                  <TableCell align="right" sx={{ py: 1.5 }}>{Number(row.opening_stock).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 500, py: 1.5 }}>+{Number(row.total_purchased).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: 'error.main', fontWeight: 500, py: 1.5 }}>-{Number(row.total_consumed).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 500, py: 1.5 }}>-{Number(row.total_wastage).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main', py: 1.5 }}>{Number(row.closing_stock).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ py: 1.5 }}>₹{Number(row.stock_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default MonthlyPerformanceReportPage;




