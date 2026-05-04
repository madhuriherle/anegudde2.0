import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { FilterList, Download, Refresh, InfoOutlined, ShowChart } from '@mui/icons-material';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';

const DailyStockReportPage: React.FC = () => {
  const { showSuccess, showError, showConfirm } = useNotification();
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: snapshotData, isLoading, refetch } = useQuery({
    queryKey: ['daily-closing-stock', targetDate],
    queryFn: async () => {
      const res = await api.get('/reports/daily-closing-stock', {
        params: { target_date: targetDate },
      });
      return res.data;
    },
  });

  const handleExport = () => {
    if (!snapshotData || snapshotData.length === 0) {
      showError('No data available to export');
      return;
    }

    const headers = [
      'Item Name',
      'Opening Stock',
      'Purchased',
      'Consumed',
      'Wastage',
      'Adjustment',
      'Closing Stock',
      'Stock Value',
    ];

    const rows = snapshotData.map((row: any) => [
      row.item_name,
      row.opening_stock,
      row.purchased_qty,
      row.consumed_qty,
      row.wastage_qty,
      row.adjustment_qty,
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
    link.setAttribute('download', `daily_stock_snapshot_${targetDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('CSV exported successfully');
  };

  const handleManualSnapshot = async () => {
    const confirmed = await showConfirm(
      'Generate Snapshot',
      `Generate/re-generate stock snapshot for ${targetDate}?`
    );
    if (!confirmed) return;
    try {
      await api.post(`/reports/generate-daily-summary?target_date=${targetDate}`);
      showSuccess('Snapshot generation triggered successfully.');
            refetch();
    } catch (error) {
      console.error('Failed to trigger snapshot', error);
      showError('Failed to trigger snapshot');
          }
  };

  const totalStockValue = snapshotData?.reduce((sum: number, row: any) => sum + (Number(row.stock_value) || 0), 0) || 0;

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
              Daily Closing Stock Report
            </Typography>
            
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            startIcon={<Download />} 
            onClick={handleExport}
            sx={{ fontWeight: 'bold', borderRadius: 2 }}
          >
            Export CSV
          </Button>
          <Tooltip title="Manually re-generate or backfill snapshot for this date">
            <Button 
              variant="outlined" 
              color="warning" 
              startIcon={<Refresh />} 
              onClick={handleManualSnapshot}
              sx={{ fontWeight: 'bold', borderRadius: 2 }}
            >
              Force Refresh
            </Button>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, bgcolor: 'primary.main', color: 'white', borderRadius: 4, boxShadow: '0 4px 12px rgba(26, 35, 126, 0.2)' }}>
            <Typography variant="subtitle2" sx={{ opacity: 0.9, fontWeight: 'bold', textTransform: 'uppercase', mb: 1 }}>
              Estimated Stock Value
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              ₹{totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, mt: 1, display: 'block' }}>Based on item prices as of {targetDate}</Typography>
          </Paper>
        </Grid>
      </Grid>

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
        <Grid container spacing={2} sx={{ alignItems: 'center' }}>
          <Grid item xs={12} sm={4} md={3}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Report Date
            </Typography>
            <TextField
              type="date"
              fullWidth
              size="small"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid item xs={12} sm={3} md={2} sx={{ pt: { xs: 2, sm: 3.5 } }}>
            <Button 
              variant="contained" 
              fullWidth 
              startIcon={<FilterList />} 
              onClick={() => refetch()}
              sx={{ fontWeight: 'bold', borderRadius: 2 }}
            >
              View
            </Button>
          </Grid>
          <Grid item xs={12} sm={5} md={7} sx={{ display: 'flex', alignItems: 'center', pt: { xs: 2, sm: 3.5 }, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <InfoOutlined color="action" sx={{ mr: 1, fontSize: 18 }} />
            
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Item Name</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Opening Stock</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Purchased</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Consumed</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Wastage</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Adjustment</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Closing Stock</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', py: 2 }}>Est. Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                  <CircularProgress />
                  <Typography variant="body2" sx={{ mt: 2 }}>Loading snapshots...</Typography>
                </TableCell>
              </TableRow>
            ) : snapshotData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <Typography variant="body1" color="text.secondary">No snapshot found for this date.</Typography>
                  <Button variant="text" color="primary" sx={{ mt: 1, fontWeight: 'bold' }} onClick={handleManualSnapshot}>
                    Generate Snapshot Now
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              snapshotData?.map((row: any) => (
                <TableRow key={row.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell sx={{ fontWeight: 'bold', py: 1.5 }}>{row.item_name}</TableCell>
                  <TableCell align="right" sx={{ py: 1.5 }}>{Number(row.opening_stock).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 500, py: 1.5 }}>+{Number(row.purchased_qty).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: 'error.main', fontWeight: 500, py: 1.5 }}>-{Number(row.consumed_qty).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 500, py: 1.5 }}>-{Number(row.wastage_qty).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: row.adjustment_qty >= 0 ? 'success.main' : 'error.main', fontWeight: 500, py: 1.5 }}>
                    {row.adjustment_qty > 0 ? '+' : ''}{Number(row.adjustment_qty).toFixed(2)}
                  </TableCell>
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

export default DailyStockReportPage;





