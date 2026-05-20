import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Info,
  ChevronRight } from
'lucide-react';

import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Label } from '../components/ui/Label';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';

const DailyStockReportPage = () => {
  const { showSuccess, showError, showConfirm } = useNotification();
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const { data: snapshotData, isLoading, refetch } = useQuery({
    queryKey: ['daily-closing-stock', targetDate],
    queryFn: async () => {
      const res = await api.get('/reports/daily-closing-stock', {
        params: { target_date: targetDate }
      });
      return res.data;
    }
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
    'Stock Value'];


    const rows = snapshotData.map((row) => [
    row.item_name,
    row.opening_stock,
    row.purchased_qty,
    row.consumed_qty,
    row.wastage_qty,
    row.adjustment_qty,
    row.closing_stock,
    row.stock_value]
    );

    const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(','))].
    join('\n');

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

  const handleDownloadPDF = async () => {
    if (!snapshotData || snapshotData.length === 0) {
      showError('No data available to export');
      return;
    }
    try {
      setIsExportingPdf(true);
      const response = await api.get('/reports/daily-closing-stock/pdf', {
        params: { target_date: targetDate },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `daily_closing_stock_${targetDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showError('Failed to generate PDF report');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleManualSnapshot = async () => {
    const confirmed = await showConfirm(
      'Generate Snapshot',
      `Generate/re-generate stock snapshot for ${targetDate}?`
    );
    if (!confirmed) return;
    try {
      await api.post(`/reports/generate_daily_summary?target_date=${targetDate}`);
      showSuccess('Snapshot generation triggered successfully.');
      refetch();
    } catch (error) {
      console.error('Failed to trigger snapshot', error);
      showError('Failed to trigger snapshot');
    }
  };

  const totalStockValue = snapshotData?.reduce((sum, row) => sum + (Number(row.stock_value) || 0), 0) || 0;

  const columns = useMemo(() => [
  {
    accessorKey: 'item_name',
    header: 'Item Name',
    cell: (info) => <span className="text-text-main font-medium">{info.getValue()}</span>
  },
  {
    accessorKey: 'opening_stock',
    header: () => <div className="text-right">Opening</div>,
    cell: (info) => <div className="text-right text-text-main">{Number(info.getValue()).toFixed(2)}</div>
  },
  {
    accessorKey: 'purchased_qty',
    header: () => <div className="text-right">Purchased</div>,
    cell: (info) => <div className="text-right text-green-600 font-medium">+{Number(info.getValue()).toFixed(2)}</div>
  },
  {
    accessorKey: 'consumed_qty',
    header: () => <div className="text-right">Consumed</div>,
    cell: (info) => <div className="text-right text-red-600 font-medium">-{Number(info.getValue()).toFixed(2)}</div>
  },
  {
    accessorKey: 'wastage_qty',
    header: () => <div className="text-right">Wastage</div>,
    cell: (info) => <div className="text-right text-orange-600 font-medium">-{Number(info.getValue()).toFixed(2)}</div>
  },
  {
    accessorKey: 'adjustment_qty',
    header: () => <div className="text-right">Adjustment</div>,
    cell: (info) => {
      const val = Number(info.getValue());
      return (
        <div className={`text-right font-medium ${val >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {val > 0 ? '+' : ''}{val.toFixed(2)}
          </div>);

    }
  },
  {
    accessorKey: 'closing_stock',
    header: () => <div className="text-right">Closing</div>,
    cell: (info) => <div className="text-right text-text-main font-bold">{Number(info.getValue()).toFixed(2)}</div>
  },
  {
    accessorKey: 'stock_value',
    header: () => <div className="text-right">Est. Value</div>,
    cell: (info) =>
    <div className="text-right text-text-main font-medium">
          {formatCurrency(info.getValue())}
        </div>

  }],
  []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Daily Closing Stock Report</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF} disabled={isExportingPdf} className="flex items-center gap-2">
            {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Download PDF
          </Button>
          <Button variant="outline" onClick={handleManualSnapshot} className="flex items-center gap-2 border-orange-200 text-orange-700 hover:bg-orange-50">
            <RefreshCw className="h-4 w-4" />
            Force Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary-main border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 text-white/80 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Estimated Stock Value</span>
              <Info className="h-3.5 w-3.5" />
            </div>
            <div className="text-3xl font-bold text-white">
              {formatCurrency(totalStockValue)}
            </div>
            <p className="text-xs text-white/60 mt-2 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Based on item prices as of {formatDate(targetDate)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border-temple bg-white/80 backdrop-blur-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="space-y-1.5 flex-1 max-w-xs">
              <Label className="text-text-main font-medium">Report Date</Label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="text-text-main" />
              
            </div>
            <Button onClick={() => refetch()} className="flex items-center gap-2 px-8">
              <Search className="h-4 w-4" />
              View Report
            </Button>
            <div className="flex-1 flex justify-end">
              <div className="bg-bg-temple p-2 rounded-full border border-border-temple/40">
                <Info className="h-5 w-5 text-text-main/60" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border-temple overflow-hidden bg-white">
        <DataTable
          columns={columns}
          data={snapshotData || []}
          loading={isLoading} />
        
        {snapshotData?.length === 0 && !isLoading &&
        <div className="py-20 text-center space-y-4">
            <p className="text-text-main/60">No snapshot found for this date.</p>
            <Button variant="ghost" className="text-primary-main" onClick={handleManualSnapshot}>
              Generate Snapshot Now
            </Button>
          </div>
        }
      </div>
    </div>);

};

export default DailyStockReportPage;
