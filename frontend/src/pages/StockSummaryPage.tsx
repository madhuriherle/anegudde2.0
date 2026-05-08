import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Filter,
  Download,
  Loader2,
  Printer,
} from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent } from '../components/ui/Card';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';

const StockSummaryPage: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['detailed-stock-summary', fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/get_detailed_stock_summary', {
        params: { from_date: fromDate, to_date: toDate },
      });
      return res.data;
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
      showError('No data available to export');
      return;
    }

    const headers = [
      'SLNO.', 'NAME', 'PACK', 'RATE', 'O.B.', 'PURCHASE', 'ISSUES', 'VALUE', 'PURCH.RET', 'STOCK ADJUST', 'CLOSING STOCK', 'VALUE'
    ];

    const rows = reportData.rows.map((row: any, idx: number) => [
      idx + 1,
      row.item_name,
      row.unit,
      row.rate,
      row.opening_balance,
      row.purchase_qty,
      row.issue_qty,
      row.issue_value,
      row.purchase_return_qty,
      row.stock_adjustment_qty,
      row.closing_stock,
      row.closing_value,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `detailed_stock_summary_${fromDate}_to_${toDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('CSV exported successfully');
  };

  const grandTotals = useMemo(() => {
    if (!reportData || !reportData.rows) return null;
    return reportData.rows.reduce((acc: any, row: any) => ({
      opening: acc.opening + Number(row.opening_balance),
      purchase: acc.purchase + Number(row.purchase_qty),
      issues: acc.issues + Number(row.issue_qty),
      issue_val: acc.issue_val + Number(row.issue_value),
      returns: acc.returns + Number(row.purchase_return_qty),
      adjust: acc.adjust + Number(row.stock_adjustment_qty),
      closing: acc.closing + Number(row.closing_stock),
      closing_val: acc.closing_val + Number(row.closing_value),
    }), {
      opening: 0,
      purchase: 0,
      issues: 0,
      issue_val: 0,
      returns: 0,
      adjust: 0,
      closing: 0,
      closing_val: 0,
    });
  }, [reportData]);

  return (
    <div className="space-y-6 print:space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="page-title">Stock Summary Report</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="text-text-main">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleExport} className="text-text-main">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="border-border-temple print:hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-text-main font-medium">From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="text-text-main" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main font-medium">To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="text-text-main" />
            </div>
            <Button onClick={() => refetch()} className="text-text-main w-full">
              <Filter className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="bg-white border border-border-temple rounded-lg overflow-hidden shadow-sm print:border-none print:shadow-none">
        <div className="p-6 text-center border-b border-border-temple/40 print:pb-2">
           <h1 className="text-xl font-bold text-text-main uppercase font-temple">ಅನೇಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ, ಕುಂಭಾಸಿ (ಅನ್ನದಾನ)</h1>
           <p className="text-sm font-bold text-text-main mt-1">STOCK SUMMARY REPORT FOR THE PERIOD FROM {formatDate(fromDate)} TO {formatDate(toDate)}</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead className="bg-gray-50 border-b border-border-temple">
              <tr className="text-text-main font-bold uppercase">
                <th className="px-2 py-2 border-r border-border-temple text-center w-10">SLNO.</th>
                <th className="px-2 py-2 border-r border-border-temple text-left">NAME</th>
                <th className="px-2 py-2 border-r border-border-temple text-center">PACK</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">RATE</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">O.B.</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">PURCHASE</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">ISSUES</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">VALUE</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">PURCH.RET</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">STOCK ADJUST</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">CLOSING STOCK</th>
                <th className="px-2 py-2 text-right">VALUE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-temple/40">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-text-main">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading report...
                    </div>
                  </td>
                </tr>
              ) : reportData?.rows?.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-text-main/60">No data found</td>
                </tr>
              ) : (
                reportData?.rows?.map((row: any, idx: number) => (
                  <tr key={row.item_id} className="hover:bg-bg-temple/20 transition-colors">
                    <td className="px-2 py-1.5 border-r border-border-temple text-center">{idx + 1}</td>
                    <td className="px-2 py-1.5 border-r border-border-temple font-medium">{row.item_name}</td>
                    <td className="px-2 py-1.5 border-r border-border-temple text-center">{row.unit}</td>
                    <td className="px-2 py-1.5 border-r border-border-temple text-right">{formatCurrency(row.rate)}</td>
                    <td className="px-2 py-1.5 border-r border-border-temple text-right">{Number(row.opening_balance).toFixed(3)}</td>
                    <td className="px-2 py-1.5 border-r border-border-temple text-right">{Number(row.purchase_qty).toFixed(3)}</td>
                    <td className="px-2 py-1.5 border-r border-border-temple text-right">{Number(row.issue_qty).toFixed(3)}</td>
                    <td className="px-2 py-1.5 border-r border-border-temple text-right">{formatCurrency(row.issue_value)}</td>
                    <td className="px-2 py-1.5 border-r border-border-temple text-right">{Number(row.purchase_return_qty).toFixed(3)}</td>
                    <td className="px-2 py-1.5 border-r border-border-temple text-right">{Number(row.stock_adjustment_qty).toFixed(3)}</td>
                    <td className="px-2 py-1.5 border-r border-border-temple text-right font-bold">{Number(row.closing_stock).toFixed(3)}</td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(row.closing_value)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {grandTotals && (
              <tfoot className="bg-gray-50 font-bold border-t border-border-temple">
                <tr>
                  <td colSpan={4} className="px-2 py-2 border-r border-border-temple text-left">GRAND TOTAL...</td>
                  <td className="px-2 py-2 border-r border-border-temple text-right">{grandTotals.opening.toFixed(3)}</td>
                  <td className="px-2 py-2 border-r border-border-temple text-right">{grandTotals.purchase.toFixed(3)}</td>
                  <td className="px-2 py-2 border-r border-border-temple text-right">{grandTotals.issues.toFixed(3)}</td>
                  <td className="px-2 py-2 border-r border-border-temple text-right">{formatCurrency(grandTotals.issue_val)}</td>
                  <td className="px-2 py-2 border-r border-border-temple text-right">{grandTotals.returns.toFixed(3)}</td>
                  <td className="px-2 py-2 border-r border-border-temple text-right">{grandTotals.adjust.toFixed(3)}</td>
                  <td className="px-2 py-2 border-r border-border-temple text-right">{grandTotals.closing.toFixed(3)}</td>
                  <td className="px-2 py-2 text-right">{formatCurrency(grandTotals.closing_val)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {reportData?.footer && (
          <div className="p-4 bg-gray-50/50 border-t border-border-temple text-[11px] grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
            <div className="space-y-1">
              <div className="flex justify-between border-b border-border-temple/20 pb-1">
                <span className="font-bold">No.of Mahaprasada devotees:</span>
                <span>{reportData.footer.mahaprasada_devotees}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between">
                  <span>Total persons for serving:</span>
                  <span>{reportData.footer.serving_persons}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total persons for cooking:</span>
                  <span>{reportData.footer.cooking_persons}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between">
                  <span>No. of times cooked:</span>
                  <span>{reportData.footer.times_cooked}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total persons for cleaning:</span>
                  <span>{reportData.footer.cleaning_persons}</span>
                </div>
              </div>
              <div className="flex justify-between pt-1">
                <span>Rice remained:</span>
                <span>{Number(reportData.footer.rice_remained).toFixed(3)}</span>
              </div>
            </div>

            <div className="border border-border-temple p-2 rounded bg-white">
               <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between">
                    <span>ANNA REMAINED:</span>
                    <span className="font-bold">{Number(reportData.footer.anna_remained).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SARU REMAINED:</span>
                    <span className="font-bold">{Number(reportData.footer.saru_remained).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SAMBAR REMAINED:</span>
                    <span className="font-bold">{Number(reportData.footer.huli_remained).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PAYASAM REMAINED:</span>
                    <span className="font-bold">{Number(reportData.footer.payasam_remained).toFixed(2)}</span>
                  </div>
               </div>
               <div className="mt-2 pt-2 border-t border-border-temple flex justify-between font-bold text-sm">
                  <span>Total:</span>
                  <span>{(Number(reportData.footer.anna_remained) + Number(reportData.footer.saru_remained) + Number(reportData.footer.huli_remained) + Number(reportData.footer.payasam_remained)).toFixed(2)}</span>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockSummaryPage;

