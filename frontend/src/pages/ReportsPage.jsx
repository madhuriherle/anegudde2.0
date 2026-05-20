import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Filter,
  Download,
  FileText,
  Loader2 } from
'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { Card, CardContent } from '../components/ui/Card';
import { formatCurrency } from '../utils/currency';

const ReportsPage = () => {
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
        params: { from_date: fromDate, to_date: toDate, group_by: groupBy }
      });
      return res.data;
    }
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
    'Net Balance'];


    // Map data to rows
    const rows = reportData.map((row) => [
    row.period,
    row.opening_stock,
    row.purchased_qty,
    row.consumed_qty,
    row.wastage_qty,
    row.closing_stock,
    row.purchase_value,
    row.net_financial_balance]
    );

    // Combine headers and rows
    const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(','))].
    join('\n');

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
      const response = await api.get('/reports/get_stock_finance_pdf', {
        params: { from_date: fromDate, to_date: toDate },
        responseType: 'blob'
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
    return reportData.reduce((acc, row) => ({
      purchased_qty: acc.purchased_qty + Number(row.purchased_qty),
      consumed_qty: acc.consumed_qty + Number(row.consumed_qty),
      wastage_qty: acc.wastage_qty + Number(row.wastage_qty),
      purchase_value: acc.purchase_value + Number(row.purchase_value),
      net_financial_balance: acc.net_financial_balance + Number(row.net_financial_balance)
    }), {
      purchased_qty: 0,
      consumed_qty: 0,
      wastage_qty: 0,
      purchase_value: 0,
      net_financial_balance: 0
    });
  }, [reportData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Stock & Financial Reports</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            className="text-text-main">
            
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            className="text-text-main">
            
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-text-main">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-text-main" />
              
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main">To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-text-main" />
              
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main">Group By</Label>
              <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                <option value="day">Day wise</option>
                <option value="month">Month wise</option>
              </Select>
            </div>
            <Button
              onClick={() => refetch()}
              className="text-text-main w-full">
              
              <Filter className="w-4 h-4 mr-2" />
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border border-border-temple overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-primary text-white uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3 border-b border-primary/20">Period</th>
                <th className="px-4 py-3 border-b border-primary/20 text-right">Opening Stock</th>
                <th className="px-4 py-3 border-b border-primary/20 text-right">Purchased</th>
                <th className="px-4 py-3 border-b border-primary/20 text-right">Consumed</th>
                <th className="px-4 py-3 border-b border-primary/20 text-right">Wastage</th>
                <th className="px-4 py-3 border-b border-primary/20 text-right">Closing Stock</th>
                <th className="px-4 py-3 border-b border-primary/20 text-right">Purchase Val</th>
                <th className="px-4 py-3 border-b border-primary/20 text-right">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ?
              <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-text-main">Calculating stock ledger...</p>
                    </div>
                  </td>
                </tr> :
              reportData?.length === 0 ?
              <tr>
                  <td colSpan={8} className="py-20 text-center text-text-main">
                    No data found for the selected range.
                  </td>
                </tr> :

              reportData?.map((row) =>
              <tr key={row.period} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-text-main">{row.period}</td>
                    <td className="px-4 py-3 text-right text-text-main">{Number(row.opening_stock).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">+{Number(row.purchased_qty).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">-{Number(row.consumed_qty).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-orange-600 font-medium">-{Number(row.wastage_qty).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-text-main">{Number(row.closing_stock).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-text-main">{formatCurrency(row.purchase_value)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${row.net_financial_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(row.net_financial_balance)}
                    </td>
                  </tr>
              )
              }
            </tbody>
            {totals &&
            <tfoot className="bg-gray-50 border-t-2 border-border-temple">
                <tr>
                  <td className="px-4 py-3 font-black text-text-main">TOTAL</td>
                  <td className="px-4 py-3 text-right font-black text-text-main">
                    {Number(reportData[0]?.opening_stock || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-green-700">
                    +{Number(totals.purchased_qty).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-red-700">
                    -{Number(totals.consumed_qty).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-orange-700">
                    -{Number(totals.wastage_qty).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-text-main">
                    {Number(reportData[reportData.length - 1]?.closing_stock || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-text-main">
                    {formatCurrency(totals.purchase_value)}
                  </td>
                  <td className={`px-4 py-3 text-right font-black ${totals.net_financial_balance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {formatCurrency(totals.net_financial_balance)}
                  </td>
                </tr>
              </tfoot>
            }
          </table>
        </div>
      </div>

      <div className="p-4 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium">
        * Net Balance is derived from stock and purchase trends for the selected period.
      </div>
    </div>);

};

export default ReportsPage;