import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  CircularProgress,
} from '@mui/material';
import { FilterList, Download, PictureAsPdf, Assessment } from '@mui/icons-material';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';

const ReportsPage: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupBy, setGroupBy] = useState('day');

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['stock-finance-report', fromDate, toDate, groupBy],
    queryFn: async () => {
      const res = await api.get('/reports/stock-finance-card', {
        params: { from_date: fromDate, to_date: toDate, group_by: groupBy },
      });
      return res.data;
    },
  });

  const handleExport = () => {
    if (!reportData || reportData.length === 0) {
      showError('No data available to export');
      return;
    }

    // Define headers
    const headers = [
      'Period',
      'Opening Stock',
      'Purchased',
      'Consumed',
      'Wastage',
      'Closing Stock',
      'Purchase Value',
      'Payment Value',
      'Net Balance',
    ];

    // Map data to rows
    const rows = reportData.map((row: any) => [
      row.period,
      row.opening_stock,
      row.purchased_qty,
      row.consumed_qty,
      row.wastage_qty,
      row.closing_stock,
      row.purchase_value,
      row.vendor_payment_value,
      row.net_financial_balance,
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.join(',')),
    ].join('\n');

    // Create a blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `stock_report_${fromDate}_to_${toDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('CSV exported successfully');
  };

  const handleExportPDF = async () => {
    try {
      const response = await api.get('/reports/stock-finance-pdf', {
        params: { from_date: fromDate, to_date: toDate },
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `stock_report_${fromDate}_to_${toDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSuccess('PDF exported successfully');
    } catch (error) {
      console.error('PDF Export failed', error);
      showError('Failed to generate PDF report');
    }
  };

  const totals = useMemo(() => {
    if (!reportData || reportData.length === 0) return null;
    return reportData.reduce((acc: any, row: any) => ({
      purchased_qty: acc.purchased_qty + Number(row.purchased_qty),
      consumed_qty: acc.consumed_qty + Number(row.consumed_qty),
      wastage_qty: acc.wastage_qty + Number(row.wastage_qty),
      purchase_value: acc.purchase_value + Number(row.purchase_value),
      vendor_payment_value: acc.vendor_payment_value + Number(row.vendor_payment_value),
      net_financial_balance: acc.net_financial_balance + Number(row.net_financial_balance),
    }), {
      purchased_qty: 0,
      consumed_qty: 0,
      wastage_qty: 0,
      purchase_value: 0,
      vendor_payment_value: 0,
      net_financial_balance: 0,
    });
  }, [reportData]);

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
            Stock & Financial Reports
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<Download />} 
            onClick={handleExport}
            sx={{ fontWeight: 'bold', borderRadius: 2 }}
          >
            Export CSV
          </Button>
          <Button 
            variant="outlined" 
            color="secondary" 
            startIcon={<PictureAsPdf />} 
            onClick={handleExportPDF}
            sx={{ fontWeight: 'bold', borderRadius: 2 }}
          >
            Export PDF
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
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              From Date
            </Typography>
            <TextField
              type="date"
              fullWidth
              size="small"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              To Date
            </Typography>
            <TextField
              type="date"
              fullWidth
              size="small"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Group By
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <MenuItem value="day">Day wise</MenuItem>
              <MenuItem value="month">Month wise</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button 
              variant="contained" 
              fullWidth 
              startIcon={<FilterList />} 
              onClick={() => refetch()}
              sx={{ fontWeight: 'bold', borderRadius: 2 }}
            >
              Generate
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Period</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Opening Stock</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Purchased</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Consumed</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Wastage</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Closing Stock</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Purchase Val</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Payment Val</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Net Balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 10 }}>
                  <CircularProgress />
                  <Typography variant="body2" sx={{ mt: 2 }}>Calculating stock ledger...</Typography>
                </TableCell>
              </TableRow>
            ) : reportData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                  <Typography variant="body1" color="text.secondary">No data found for the selected range.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              reportData?.map((row: any) => (
                <TableRow key={row.period} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell sx={{ fontWeight: 'bold', py: 1.5 }}>{row.period}</TableCell>
                  <TableCell align="right" sx={{ py: 1.5 }}>{Number(row.opening_stock).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 500, py: 1.5 }}>+{Number(row.purchased_qty).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: 'error.main', fontWeight: 500, py: 1.5 }}>-{Number(row.consumed_qty).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 500, py: 1.5 }}>-{Number(row.wastage_qty).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, py: 1.5 }}>{Number(row.closing_stock).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ py: 1.5 }}>₹{Number(row.purchase_value).toLocaleString()}</TableCell>
                  <TableCell align="right" sx={{ py: 1.5 }}>₹{Number(row.vendor_payment_value).toLocaleString()}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: row.net_financial_balance > 0 ? 'error.main' : 'success.main', py: 1.5 }}>
                    ₹{Number(row.net_financial_balance).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {totals && (
            <TableFooter sx={{ bgcolor: 'grey.50', borderTop: '2px solid', borderColor: 'divider' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 900, py: 2 }}>TOTAL</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900, py: 2 }}>
                  {Number(reportData[0]?.opening_stock || 0).toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 900, color: 'success.dark', py: 2 }}>
                  +{Number(totals.purchased_qty).toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 900, color: 'error.dark', py: 2 }}>
                  -{Number(totals.consumed_qty).toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 900, color: 'warning.dark', py: 2 }}>
                  -{Number(totals.wastage_qty).toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 900, py: 2 }}>
                  {Number(reportData[reportData.length - 1]?.closing_stock || 0).toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 900, py: 2 }}>
                  ₹{Number(totals.purchase_value).toLocaleString()}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 900, py: 2 }}>
                  ₹{Number(totals.vendor_payment_value).toLocaleString()}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 900, color: totals.net_financial_balance > 0 ? 'error.dark' : 'success.dark', py: 2 }}>
                  ₹{Number(totals.net_financial_balance).toLocaleString()}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </TableContainer>


      <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'info.light', color: 'info.contrastText', border: '1px solid', borderColor: 'info.main' }}>
         <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
           * Net Balance = Purchase Value - Vendor Payments. Negative value means payments exceed purchases in this period.
         </Typography>
      </Box>
    </Box>
  );
};

export default ReportsPage;




