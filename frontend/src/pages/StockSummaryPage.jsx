import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter } from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { PrinterSelectDropdown } from '../components/PrinterSelectDropdown';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent } from '../components/ui/Card';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';

export const StockSummaryPage = () => {
  const { showError } = useNotification();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['detailed-stock-summary', selectedDate],
    queryFn: async () => {
      const res = await api.get('/reports/get_detailed_stock_summary', {
        params: { from_date: selectedDate, to_date: selectedDate }
      });
      return res.data;
    }
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
    return reportData.rows.reduce((acc, row) => ({
      opening: acc.opening + Number(row.opening_balance),
      purchase: acc.purchase + Number(row.purchase_qty),
      issues: acc.issues + Number(row.issue_qty),
      issue_val: acc.issue_val + Number(row.issue_value),
      returns: acc.returns + Number(row.purchase_return_qty),
      adjust: acc.adjust + Number(row.stock_adjustment_qty),
      closing: acc.closing + Number(row.closing_stock),
      closing_val: acc.closing_val + Number(row.closing_value)
    }), {
      opening: 0,
      purchase: 0,
      issues: 0,
      issue_val: 0,
      returns: 0,
      adjust: 0,
      closing: 0,
      closing_val: 0
    });
  }, [reportData]);

  const orderedRows = useMemo(() => {
    const rows = reportData?.rows ?? [];
    const priority = ['ಅಕ್ಕಿ', 'ಬೆಲ್ಲ', 'ತೊಗರಿ ಬೇಳೆ', 'ಗೋಧಿ ಕಡಿ', 'ಒಣಮೆಣಸು', 'ಹುಣಸೆ ಹಣ್ಣು', 'ತುಪ್ಪ'];
    const rank = (name) => {
      const idx = priority.findIndex((p) => String(name || '').startsWith(p));
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };
    return [...rows].sort((a, b) => {
      const diff = rank(a.item_name) - rank(b.item_name);
      if (diff !== 0) return diff;
      return String(a.item_name || '').localeCompare(String(b.item_name || ''));
    });
  }, [reportData]);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    orderedRows.forEach((row) => set.add(row.category_name || 'Uncategorized'));
    return ['ALL', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [orderedRows]);

  const filteredRows = useMemo(() => {
    if (selectedCategory === 'ALL') return orderedRows;
    return orderedRows.filter((row) => (row.category_name || 'Uncategorized') === selectedCategory);
  }, [orderedRows, selectedCategory]);

  const groupedRows = useMemo(() => {
    const groups = {};
    filteredRows.forEach((row) => {
      const key = row.category_name || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRows]);

  const toEnglishCategory = (category) => {
    const match = String(category || '').match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim() : category;
  };

  return (
    <div className="space-y-6 print:space-y-2 stock-summary-print">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          html, body, #root, main {
            background: #ffffff !important;
            background-color: #ffffff !important;
          }
          header, aside, footer { display: none !important; }
          main { padding: 0 !important; }
          .lg\\:pl-64 { padding-left: 0 !important; }
          .stock-summary-print { padding-top: 8mm !important; background: #ffffff !important; background-color: #ffffff !important; }
          .stock-summary-print, .stock-summary-print * { overflow: visible !important; }
          .stock-summary-print,
          .stock-summary-print div,
          .stock-summary-print section,
          .stock-summary-print table,
          .stock-summary-print thead,
          .stock-summary-print tbody,
          .stock-summary-print tfoot,
          .stock-summary-print tr,
          .stock-summary-print th,
          .stock-summary-print td {
            background: #ffffff !important;
            background-color: #ffffff !important;
          }
          .stock-summary-print table { table-layout: fixed; width: 100%; border-collapse: separate !important; border-spacing: 0 !important; border: 1px solid #d7c9ba !important; }
          .stock-summary-print thead { display: table-header-group !important; }
          .stock-summary-print tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          .stock-summary-print .category-print-section { break-inside: avoid-page !important; page-break-inside: avoid !important; }
          .stock-summary-print .category-print-title { break-after: avoid !important; page-break-after: avoid !important; }
          .stock-summary-print .category-print-table thead { display: table-header-group !important; }
          .stock-summary-print .category-print-table tbody tr:first-child { break-inside: avoid !important; page-break-inside: avoid !important; }
          .stock-summary-print th, .stock-summary-print td { padding: 4px 6px !important; border-right: 1px solid #d7c9ba !important; border-bottom: 1px solid #d7c9ba !important; }
          .stock-summary-print th { border-top: 1px solid #d7c9ba !important; }
          .stock-summary-print tr td:last-child, .stock-summary-print tr th:last-child { border-right: none !important; }
          .stock-summary-print tfoot td { border: 1px solid #cab7a4 !important; }
          .stock-summary-print .stock-summary-report-card,
          .stock-summary-print .report-table-wrap {
            border: none !important;
            box-shadow: none !important;
          }
          .stock-summary-print .stock-summary-print-header {
            border-bottom: none !important;
          }
          .stock-summary-print .shadow-sm,
          .stock-summary-print .shadow,
          .stock-summary-print .shadow-lg,
          .stock-summary-print .shadow-xl,
          .stock-summary-print .shadow-2xl {
            box-shadow: none !important;
          }
          .stock-summary-print .grand-total-row td { border-top: 2px solid #bfa892 !important; border-bottom: 1px solid #bfa892 !important; }
        }
      `}</style>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="page-title">Stock Summary Report</h2>
        </div>
        <PrinterSelectDropdown
          context="REPORT_STOCK"
          onPrint={handlePrint}
          buttonLabel="Print"
        />
      </div>

      <Card className="border-border-temple print:hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div className="space-y-1.5 w-full sm:w-[240px]">
              <Label className="text-text-main font-medium">Date</Label>
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-10 text-text-main" />
            </div>
            
            <div className="flex items-center gap-2 mb-2.5">
              <input 
                type="checkbox" 
                id="groupByCategory" 
                checked={groupByCategory} 
                onChange={(e) => {
                  setGroupByCategory(e.target.checked);
                  if (!e.target.checked) setSelectedCategory('ALL');
                }}
                className="w-4 h-4 rounded border-border-temple/50 text-primary focus:ring-primary"
              />
              <Label htmlFor="groupByCategory" className="text-text-main font-medium cursor-pointer">With Category</Label>
            </div>

            {groupByCategory && (
              <div className="space-y-1.5 w-full sm:w-[280px] animate-in fade-in slide-in-from-left-2">
                <Label className="text-text-main font-medium">Select Category</Label>
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-main/60" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-10 w-full rounded-md border border-border-temple/50 bg-white pl-9 text-sm text-text-main outline-none focus:border-primary transition-all">
                    
                    {categoryOptions.map((category) =>
                    <option key={category} value={category}>
                        {category === 'ALL' ? 'All Categories' : category}
                      </option>
                    )}
                  </select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="stock-summary-report-card bg-white border border-border-temple rounded-lg overflow-hidden shadow-sm print:border-none print:shadow-none">
        <div className="stock-summary-print-header p-6 text-center border-b border-border-temple/40 print:pb-2">
          <h1 className="text-xl font-bold text-text-main uppercase font-temple">ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ, ಕುಂಭಾಶಿ (ಅನ್ನದಾನ)</h1>
          <p className="text-sm font-bold text-text-main mt-1">
            STOCK SUMMARY REPORT FOR DATE :{' '}
            <span className="font-extrabold">
              {formatDate(selectedDate)}
            </span>
          </p>
        </div>

        <div className="p-4 print:p-0">
          {isLoading ?
          <div className="py-10 text-center">
              <div className="flex items-center justify-center gap-2 text-text-main">
                Loading report...
              </div>
            </div> :
          filteredRows.length === 0 ?
          <div className="py-10 text-center text-text-main/60">No data found</div> :

          !groupByCategory ? (
            /* FLAT LIST - Single Table */
            <div className="report-table-wrap overflow-x-auto print:overflow-visible rounded-xl border border-border-temple shadow-sm bg-white">
              <table className="w-full table-fixed text-sm border-collapse">
                <thead className="bg-[#FFF4E6] border-b border-border-temple">
                  <tr className="text-text-main font-bold uppercase">
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Item Name</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words hidden sm:table-cell">Rate</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Opening Stock</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Stock Added</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Stock Used</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words hidden sm:table-cell">Usage Value</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words hidden sm:table-cell">Purchase Ret.</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words hidden sm:table-cell">Stock Adjust</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Closing Stock</th>
                    <th className="px-3 py-2 text-left whitespace-normal break-words hidden sm:table-cell">Closing Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-temple/10">
                  {filteredRows.map((row) => (
                    <tr key={row.item_id} className="hover:bg-bg-temple/10 transition-colors">
                      <td className="px-3 py-2 border-r border-border-temple/10 font-medium text-text-main whitespace-normal break-words">{row.item_name}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main hidden sm:table-cell">{formatCurrency(row.rate)}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.opening_balance).toFixed(3)} {row.unit}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.purchase_qty).toFixed(3)} {row.unit}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.issue_qty).toFixed(3)} {row.unit}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-nowrap hidden sm:table-cell">{formatCurrency(row.issue_value)}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words hidden sm:table-cell">{Number(row.purchase_return_qty).toFixed(3)} {row.unit}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words hidden sm:table-cell">{Number(row.stock_adjustment_qty).toFixed(3)} {row.unit}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 font-bold text-text-main whitespace-normal break-words">{Number(row.closing_stock).toFixed(3)} {row.unit}</td>
                      <td className="px-3 py-2 text-text-main whitespace-nowrap hidden sm:table-cell">{formatCurrency(row.closing_value)}</td>
                    </tr>
                  ))}
                </tbody>
                {grandTotals && (
                <tbody className="bg-[#FAF3E7] border-t-2 border-border-temple/60 text-black">
                  <tr className="grand-total-row font-extrabold text-[16px]">
                    <td colSpan={2} className="px-3 py-5 border-r border-black/10 text-left uppercase tracking-[0.2em] !font-extrabold">GRAND TOTAL</td>
                    <td className="px-3 py-5 border-r border-black/10 text-left whitespace-normal break-words !font-extrabold">{grandTotals.opening.toFixed(3)}</td>
                    <td className="px-3 py-5 border-r border-black/10 text-left whitespace-normal break-words !font-extrabold">{grandTotals.purchase.toFixed(3)}</td>
                    <td className="px-3 py-5 border-r border-black/10 text-left whitespace-normal break-words !font-extrabold">{grandTotals.issues.toFixed(3)}</td>
                    <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap !font-extrabold">{formatCurrency(grandTotals.issue_val)}</td>
                    <td className="px-3 py-5 border-r border-black/10 text-left whitespace-normal break-words !font-extrabold">{grandTotals.returns.toFixed(3)}</td>
                    <td className="px-3 py-5 border-r border-black/10 text-left whitespace-normal break-words !font-extrabold">{grandTotals.adjust.toFixed(3)}</td>
                    <td className="px-3 py-5 border-r border-black/10 text-left whitespace-normal break-words !font-extrabold">{grandTotals.closing.toFixed(3)}</td>
                    <td className="px-3 py-5 text-left whitespace-nowrap !font-extrabold">{formatCurrency(grandTotals.closing_val)}</td>
                  </tr>
                </tbody>
                )}
              </table>
            </div>
          ) : (
            /* GROUPED LIST - Multiple Tables */
            <div className="space-y-10">
              {groupedRows.map(([categoryName, rows]) => (
                <section key={categoryName} className="space-y-3 category-print-section">
                  <h2 className="text-sm font-black uppercase tracking-widest text-primary px-1 category-print-title">
                    {toEnglishCategory(categoryName)}
                  </h2>
                  <div className="report-table-wrap overflow-x-auto print:overflow-visible rounded-xl border border-border-temple shadow-sm bg-white">
                    <table className="w-full table-fixed text-sm border-collapse category-print-table">
                      <thead className="bg-[#FFF4E6] border-b border-border-temple">
                        <tr className="text-text-main font-bold uppercase">
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Item Name</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words hidden sm:table-cell">Rate</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Opening Stock</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Stock Added</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Stock Used</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words hidden sm:table-cell">Usage Value</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words hidden sm:table-cell">Purchase Ret.</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words hidden sm:table-cell">Stock Adjust</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Closing Stock</th>
                          <th className="px-3 py-2 text-left whitespace-normal break-words hidden sm:table-cell">Closing Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-temple/10">
                        {rows.map((row) => (
                          <tr key={row.item_id} className="hover:bg-bg-temple/10 transition-colors">
                            <td className="px-3 py-2 border-r border-border-temple/10 font-medium text-text-main whitespace-normal break-words">{row.item_name}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main hidden sm:table-cell">{formatCurrency(row.rate)}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.opening_balance).toFixed(3)} {row.unit}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.purchase_qty).toFixed(3)} {row.unit}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.issue_qty).toFixed(3)} {row.unit}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-nowrap hidden sm:table-cell">{formatCurrency(row.issue_value)}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words hidden sm:table-cell">{Number(row.purchase_return_qty).toFixed(3)} {row.unit}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words hidden sm:table-cell">{Number(row.stock_adjustment_qty).toFixed(3)} {row.unit}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 font-bold text-text-main whitespace-normal break-words">{Number(row.closing_stock).toFixed(3)} {row.unit}</td>
                            <td className="px-3 py-2 text-text-main whitespace-nowrap hidden sm:table-cell">{formatCurrency(row.closing_value)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tbody className="bg-[#FAF7F2] font-black text-[13px] border-t-2 border-border-temple/20">
                        <tr className="text-primary">
                          <td colSpan={2} className="px-3 py-3 border-r border-border-temple/10 uppercase tracking-tighter">TOTAL</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-normal break-words">{rows.reduce((a, b) => a + Number(b.opening_balance || 0), 0).toFixed(3)}</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-normal break-words">{rows.reduce((a, b) => a + Number(b.purchase_qty || 0), 0).toFixed(3)}</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-normal break-words">{rows.reduce((a, b) => a + Number(b.issue_qty || 0), 0).toFixed(3)}</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-nowrap">{formatCurrency(rows.reduce((a, b) => a + Number(b.issue_value || 0), 0))}</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-normal break-words">{rows.reduce((a, b) => a + Number(b.purchase_return_qty || 0), 0).toFixed(3)}</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-normal break-words">{rows.reduce((a, b) => a + Number(b.stock_adjustment_qty || 0), 0).toFixed(3)}</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-normal break-words">{rows.reduce((a, b) => a + Number(b.closing_stock || 0), 0).toFixed(3)}</td>
                          <td className="px-3 py-3 text-secondary whitespace-nowrap font-black">{formatCurrency(rows.reduce((a, b) => a + Number(b.closing_value || 0), 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}

              {grandTotals && (
                <div className="report-table-wrap overflow-x-auto print:overflow-visible rounded-xl border border-border-temple shadow-sm bg-white mt-8">
                  <table className="w-full table-fixed text-sm border-collapse">
                    <tbody className="bg-[#FAF3E7] border-t-2 border-border-temple/60 text-black">
                      <tr className="grand-total-row font-black text-[15px]">
                        <td colSpan={2} className="px-3 py-5 border-r border-black/10 text-left uppercase tracking-[0.2em] font-black">GRAND TOTAL</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-normal break-words font-black">{grandTotals.opening.toFixed(3)}</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-normal break-words font-black">{grandTotals.purchase.toFixed(3)}</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-normal break-words font-black">{grandTotals.issues.toFixed(3)}</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap font-black">{formatCurrency(grandTotals.issue_val)}</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-normal break-words font-black">{grandTotals.returns.toFixed(3)}</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-normal break-words font-black">{grandTotals.adjust.toFixed(3)}</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-normal break-words font-black">{grandTotals.closing.toFixed(3)}</td>
                        <td className="px-3 py-5 text-left whitespace-nowrap font-black text-secondary">{formatCurrency(grandTotals.closing_val)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
          }
        </div>

      </div>
    </div>);

};

export default StockSummaryPage;

