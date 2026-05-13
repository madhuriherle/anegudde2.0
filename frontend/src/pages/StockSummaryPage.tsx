import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Filter,
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

export const StockSummaryPage: React.FC = () => {
  const { showError } = useNotification();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['detailed-stock-summary', selectedDate],
    queryFn: async () => {
      const res = await api.get('/reports/get_detailed_stock_summary', {
        params: { from_date: selectedDate, to_date: selectedDate },
      });
      return res.data;
    },
  });

  const handlePrint = () => {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
      showError('No data available to print');
      return;
    }
    window.print();
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

  const orderedRows = useMemo(() => {
    const rows = reportData?.rows ?? [];
    const priority = ['ಅಕ್ಕಿ', 'ಬೆಲ್ಲ', 'ತೊಗರಿ ಬೇಳೆ', 'ಗೋಧಿ ಕಡಿ', 'ಒಣಮೆಣಸು', 'ಹುಣಸೆ ಹಣ್ಣು', 'ತುಪ್ಪ'];
    const rank = (name: string) => {
      const idx = priority.findIndex((p) => String(name || '').startsWith(p));
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };
    return [...rows].sort((a: any, b: any) => {
      const diff = rank(a.item_name) - rank(b.item_name);
      if (diff !== 0) return diff;
      return String(a.item_name || '').localeCompare(String(b.item_name || ''));
    });
  }, [reportData]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    orderedRows.forEach((row: any) => set.add(row.category_name || 'Uncategorized'));
    return ['ALL', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [orderedRows]);

  const filteredRows = useMemo(() => {
    if (selectedCategory === 'ALL') return orderedRows;
    return orderedRows.filter((row: any) => (row.category_name || 'Uncategorized') === selectedCategory);
  }, [orderedRows, selectedCategory]);

  const groupedRows = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredRows.forEach((row: any) => {
      const key = row.category_name || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRows]);

  const toEnglishCategory = (category: string) => {
    const match = String(category || '').match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim() : category;
  };

  return (
    <div className="space-y-6 print:space-y-2 stock-summary-print">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          header, aside, footer { display: none !important; }
          main { padding: 0 !important; }
          .lg\\:pl-64 { padding-left: 0 !important; }
          .stock-summary-print { padding-top: 8mm !important; }
          .stock-summary-print, .stock-summary-print * { overflow: visible !important; }
          .stock-summary-print table { table-layout: fixed; width: 100%; }
          .stock-summary-print th, .stock-summary-print td { padding: 4px 6px !important; }
        }
      `}</style>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="page-title">Stock Summary Report</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="text-text-main">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <Card className="border-border-temple print:hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="space-y-1.5 w-full sm:w-[280px]">
              <Label className="text-text-main font-medium">Date</Label>
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-11 text-text-main" />
            </div>
            <div className="space-y-1.5 w-full sm:w-[280px]">
              <Label className="text-text-main font-semibold">Category</Label>
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-main/60" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border-temple bg-white pl-9 pr-9 text-sm font-medium text-text-main shadow-sm outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category === 'ALL' ? 'All Categories' : category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-white border border-border-temple rounded-lg overflow-hidden shadow-sm print:border-none print:shadow-none">
        <div className="p-6 text-center border-b border-border-temple/40 print:pb-2">
          <h1 className="text-xl font-bold text-text-main uppercase font-temple">ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ, ಕುಂಭಾಶಿ (ಅನ್ನದಾನ)</h1>
          <p className="text-sm font-bold text-text-main mt-1">
            STOCK SUMMARY REPORT FOR DATE :{' '}
            <span className="font-extrabold">
              {formatDate(selectedDate)}
            </span>
          </p>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-[11px] border-collapse">
            <thead className="bg-gray-50 border-b border-border-temple">
              <tr className="text-text-main font-bold uppercase">
                <th className="px-2 py-2 border-r border-border-temple text-left">Category</th>
                <th className="px-2 py-2 border-r border-border-temple text-left"></th>
                <th className="px-2 py-2 border-r border-border-temple text-right">Rate</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">Opening Stock</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">Stock Added</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">Stock Used</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">Usage Value</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">Returned to Vendor</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">Stock Adjust</th>
                <th className="px-2 py-2 border-r border-border-temple text-right">Closing Stock</th>
                <th className="px-2 py-2 text-right">Closing Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-temple/40">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-text-main">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading report...
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-text-main/60">No data found</td>
                </tr>
              ) : (
                groupedRows.flatMap(([categoryName, rows]) =>
                  rows.map((row: any, rowIndex: number) => (
                    <tr key={row.item_id} className="hover:bg-bg-temple/20 transition-colors">
                      <td className="px-2 py-1.5 border-r border-border-temple font-medium">
                        {rowIndex === 0 ? toEnglishCategory(categoryName) : ''}
                      </td>
                      <td className="px-2 py-1.5 border-r border-border-temple font-medium">{row.item_name}</td>
                      <td className="px-2 py-1.5 border-r border-border-temple text-right">{formatCurrency(row.rate)}</td>
                      <td className="px-2 py-1.5 border-r border-border-temple text-right">{Number(row.opening_balance).toFixed(3)} {row.unit}</td>
                      <td className="px-2 py-1.5 border-r border-border-temple text-right">{Number(row.purchase_qty).toFixed(3)} {row.unit}</td>
                      <td className="px-2 py-1.5 border-r border-border-temple text-right">{Number(row.issue_qty).toFixed(3)} {row.unit}</td>
                      <td className="px-2 py-1.5 border-r border-border-temple text-right">{formatCurrency(row.issue_value)}</td>
                      <td className="px-2 py-1.5 border-r border-border-temple text-right">{Number(row.purchase_return_qty).toFixed(3)} {row.unit}</td>
                      <td className="px-2 py-1.5 border-r border-border-temple text-right">{Number(row.stock_adjustment_qty).toFixed(3)} {row.unit}</td>
                      <td className="px-2 py-1.5 border-r border-border-temple text-right font-bold">{Number(row.closing_stock).toFixed(3)} {row.unit}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(row.closing_value)}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
            {grandTotals && (
              <tfoot className="bg-gray-50 font-bold text-[13px] border-t border-border-temple">
                <tr>
                  <td colSpan={3} className="px-2 py-2 border-r border-border-temple text-left">GRAND TOTAL</td>
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

      </div>
    </div>
  );
};

export default StockSummaryPage;
