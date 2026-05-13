import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Printer } from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent } from '../components/ui/Card';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';

const CanteenSummaryPage: React.FC = () => {
  const { showError } = useNotification();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['canteen-summary', selectedDate],
    queryFn: async () => {
      const res = await api.get('/reports/get_canteen_summary', { params: { date: selectedDate } });
      return res.data;
    },
  });

  const { data: menuItemsData } = useQuery({
    queryKey: ['menu-items-master'],
    queryFn: async () => {
      const res = await api.get('/menu-items/list_menu_items', { params: { page_size: 1000 } });
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

  const groupedRows = useMemo(() => {
    const groups: Record<string, any[]> = {};
    orderedRows.forEach((row: any) => {
      const key = row.category_name || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [orderedRows]);

  const toEnglishCategory = (category: string) => {
    const match = String(category || '').match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim() : category;
  };

  const footer = reportData?.footer;
  const fmt2 = (n: number) => String(Math.trunc(n)).padStart(2, '0');
  const devotees = Number(footer?.mahaprasada_devotees ?? 0);
  const timesCooked = Number(footer?.times_cooked ?? 0);
  const rawReturns = footer?.raw_returns ?? [];
  const personRows = [
    ['Regular Cooking Persons', Number(footer?.regular_cooking_persons ?? 0)],
    ['Additional Cooking Persons', Number(footer?.additional_cooking_persons ?? 0)],
    ['Total Cooking Persons', Number(footer?.total_cooking_persons ?? 0)],
    ['Regular Cleaning Persons', Number(footer?.regular_cleaning_persons ?? 0)],
    ['Additional Cleaning Persons', Number(footer?.additional_cleaning_persons ?? 0)],
    ['Total Cleaning Persons', Number(footer?.total_cleaning_persons ?? 0)],
    ['Regular Serving Persons', Number(footer?.regular_serving_persons ?? 0)],
    ['Additional Serving Persons', Number(footer?.additional_serving_persons ?? 0)],
    ['Total Serving Persons', Number(footer?.total_serving_persons ?? 0)],
  ];
  const wastageItems = footer?.wastage_items ?? [];
  const wastageTotal = Number(footer?.wastage_total_amount ?? 0);
  const isZero = (n: number) => Math.abs(Number(n || 0)) < 0.000001;
  const allItemRows = orderedRows.map((r: any) => ({
    item_name: String(r.item_name || ''),
    unit: String(r.unit || ''),
  }));
  const rawReturnMap = new Map(
    rawReturns.map((r: any) => [String(r.item_name || ''), Number(r.qty_returned || 0)]),
  );
  const wastageMap = new Map(
    wastageItems.map((w: any) => [
      String(w.item_name || ''),
      { qty: Number(w.qty || 0), amount: Number(w.approx_amount || 0) },
    ]),
  );
  const rawReturnRowsAllItems = allItemRows.map((i) => ({
    item_name: i.item_name,
    unit: i.unit,
    qty_returned: rawReturnMap.get(i.item_name) ?? 0,
  }));
  const menuItemNames = useMemo(() => {
    const payload = menuItemsData;
    if (!payload) return [] as string[];
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(payload?.items)
              ? payload.items
              : Array.isArray(payload?.data)
                  ? payload.data
                  : [];
    return list
      .map((m: any) => String(m?.dish_name ?? m?.item_name ?? m?.name ?? '').trim())
      .filter((name: string) => name.length > 0);
  }, [menuItemsData]);

  const wastageRowsAllItems = menuItemNames.map((name) => {
    const w = wastageMap.get(name);
    return {
      item_name: name,
      qty: w?.qty ?? 0,
      amount: w?.amount ?? 0,
    };
  });

  const wastageRowsFallback = allItemRows.map((i) => {
    const w = wastageMap.get(i.item_name);
    return {
      item_name: i.item_name,
      qty: w?.qty ?? 0,
      amount: w?.amount ?? 0,
    };
  });
  const wastageRowsForDisplay = wastageRowsAllItems.length > 0 ? wastageRowsAllItems : wastageRowsFallback;

  return (
    <div className="space-y-6 print:space-y-2 canteen-summary-print">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          header, aside, footer { display: none !important; }
          main { padding: 0 !important; }
          .lg\\:pl-64 { padding-left: 0 !important; }
          .canteen-summary-print { padding-top: 8mm !important; }
          .canteen-summary-print, .canteen-summary-print * { overflow: visible !important; }
          .canteen-summary-print { font-size: 11px; }
          .canteen-summary-print table { table-layout: fixed; width: 100%; }
          .canteen-summary-print th, .canteen-summary-print td { padding: 4px 6px !important; }
          .canteen-summary-print .footer-table { border-collapse: collapse; width: 100%; margin-top: 4mm; }
          .canteen-summary-print .footer-table th, .canteen-summary-print .footer-table td { border: 1px solid #e2e8f0 !important; }
          .canteen-summary-print .footer-table th { background-color: #f8fafc !important; }
          .canteen-summary-print .no-wrap-print { white-space: nowrap !important; }
        }
      `}</style>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <h2 className="page-title">Canteen Summary Report</h2>
        <Button variant="outline" onClick={handlePrint} className="text-text-main">
          <Printer className="w-4 h-4 mr-2" />
          Print
        </Button>
      </div>

      <Card className="border-border-temple print:hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-1.5 w-full sm:max-w-[240px]">
            <Label className="text-text-main font-medium">Date</Label>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-text-main" />
          </div>
        </CardContent>
      </Card>

      <div className="bg-white border border-border-temple rounded-lg overflow-hidden shadow-sm print:hidden">
        <div className="p-6 text-center border-b border-border-temple/40 print:pb-2">
          <h1 className="text-xl font-bold text-text-main uppercase font-temple">ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ, ಕುಂಭಾಶಿ (ಅನ್ನದಾನ)</h1>
          <p className="text-sm font-bold text-text-main mt-1">
            CANTEEN SUMMARY REPORT FOR DATE : <span className="font-extrabold">{formatDate(selectedDate)}</span>
          </p>
        </div>

        <div className="space-y-6 py-2 mb-6">
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
                ) : reportData?.rows?.length === 0 ? (
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

          {reportData?.footer && (
            <div className="p-4 border-t border-border-temple print:hidden">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="border border-border-temple rounded-md p-3">
                  <div className="text-[12px] uppercase font-bold border-b border-border-temple/30 pb-1 mb-2">Day Snapshot</div>
                  <div className="space-y-1.5 text-[12px]">
                    <div className="flex justify-between">
                      <span className="font-bold text-[13px]">No. of Mahaprasada Devotees</span>
                      <span className="font-extrabold text-[18px] leading-none">{devotees.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">No. of Times Cooked</span>
                      <span className="font-extrabold">{timesCooked}</span>
                    </div>
                  </div>
                  <div className="border-b border-border-temple/30 pb-1 mt-3 mb-2"></div>
                  <div className="space-y-1 text-[12px]">
                    <div className="grid grid-cols-[220px_auto] items-baseline gap-1"><span className="font-semibold">Regular Cooking Persons</span><span className="font-bold">: {Number(footer?.regular_cooking_persons ?? 0)}</span></div>
                    <div className="grid grid-cols-[220px_auto] items-baseline gap-1"><span className="font-semibold">Additional Cooking Persons</span><span className="font-bold">: {Number(footer?.additional_cooking_persons ?? 0)}</span></div>
                    <div className="grid grid-cols-[220px_auto] items-baseline gap-1"><span className="font-semibold">Total Cooking Persons</span><span className="font-bold">: {Number(footer?.total_cooking_persons ?? 0)}</span></div>
                    <div className="grid grid-cols-[220px_auto] items-baseline gap-1"><span className="font-semibold">Regular Serving Persons</span><span className="font-bold">: {Number(footer?.regular_serving_persons ?? 0)}</span></div>
                    <div className="grid grid-cols-[220px_auto] items-baseline gap-1"><span className="font-semibold">Additional Serving Persons</span><span className="font-bold">: {Number(footer?.additional_serving_persons ?? 0)}</span></div>
                    <div className="grid grid-cols-[220px_auto] items-baseline gap-1"><span className="font-semibold">Total Serving Persons</span><span className="font-bold">: {Number(footer?.total_serving_persons ?? 0)}</span></div>
                    <div className="grid grid-cols-[220px_auto] items-baseline gap-1"><span className="font-semibold">Regular Cleaning Persons</span><span className="font-bold">: {Number(footer?.regular_cleaning_persons ?? 0)}</span></div>
                    <div className="grid grid-cols-[220px_auto] items-baseline gap-1"><span className="font-semibold">Additional Cleaning Persons</span><span className="font-bold">: {Number(footer?.additional_cleaning_persons ?? 0)}</span></div>
                    <div className="grid grid-cols-[220px_auto] items-baseline gap-1"><span className="font-semibold">Total Cleaning Persons</span><span className="font-bold">: {Number(footer?.total_cleaning_persons ?? 0)}</span></div>
                  </div>
                </div>

                <div className="border border-border-temple rounded-md p-3 flex flex-col">
                  <div className="text-[12px] uppercase font-bold border-b border-border-temple/30 pb-1 mb-2">Wastage</div>
                  <div>
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-text-main/75">
                          <th className="text-left py-1">Item</th>
                          <th className="text-right py-1">Qty</th>
                          <th className="text-right py-1">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wastageRowsForDisplay.map((w) => (
                          <tr key={w.item_name}>
                            <td className="py-1 font-semibold">{w.item_name}</td>
                            <td className="py-1 text-right font-semibold">{w.qty.toFixed(3)}</td>
                            <td className="py-1 text-right font-semibold">{formatCurrency(w.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border-temple/30 text-[13px] font-extrabold text-right">
                    Total Wastage: {formatCurrency(wastageTotal || 0)}
                  </div>
                </div>

                <div className="border border-border-temple rounded-md p-3">
                  <div className="text-[12px] uppercase font-bold border-b border-border-temple/30 pb-1 mb-2">Raw Items</div>
                  <table className="w-full text-[10.5px]">
                    <thead>
                      <tr className="text-text-main/70">
                        <th className="text-left py-0.5">Item</th>
                        <th className="text-right py-0.5">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawReturnRowsAllItems.map((r) => (
                        <tr key={`raw-${r.item_name}`}>
                          <td className="py-0.5 font-medium">{r.item_name}</td>
                          <td className="py-0.5 text-right font-semibold">
                            {r.qty_returned.toFixed(3)} {r.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden print:block">
        <div className="text-center mb-2">
          <h1 className="text-lg font-bold font-temple">ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ, ಕುಂಭಾಶಿ (ಅನ್ನದಾನ)</h1>
          <div className="text-sm font-bold">
            CANTEEN SUMMARY REPORT FOR DATE : <span className="font-extrabold">{formatDate(selectedDate)}</span>
          </div>
        </div>

        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="border">
              <th className="border px-1 py-1 text-left">CATEGORY</th>
              <th className="border px-1 py-1 text-left"></th>
              <th className="border px-1 py-1 text-right">RATE</th>
              <th className="border px-1 py-1 text-right">OPENING STOCK</th>
              <th className="border px-1 py-1 text-right">STOCK ADDED</th>
              <th className="border px-1 py-1 text-right">STOCK USED</th>
              <th className="border px-1 py-1 text-right">USAGE VALUE</th>
              <th className="border px-1 py-1 text-right">RETURNED TO VENDOR</th>
              <th className="border px-1 py-1 text-right">STOCK ADJUST</th>
              <th className="border px-1 py-1 text-right">CLOSING STOCK</th>
              <th className="border px-1 py-1 text-right">CLOSING VALUE</th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.flatMap(([categoryName, rows]) =>
              rows.map((row: any, rowIndex: number, idx: number) => (
                <tr key={`print-row-${row.item_id}-${idx}`}>
                  <td className="border px-1 py-1">{rowIndex === 0 ? toEnglishCategory(categoryName) : ''}</td>
                  <td className="border px-1 py-1">{row.item_name}</td>
                  <td className="border px-1 py-1 text-right">{formatCurrency(row.rate)}</td>
                  <td className="border px-1 py-1 text-right">{Number(row.opening_balance).toFixed(3)} {row.unit}</td>
                  <td className="border px-1 py-1 text-right">{Number(row.purchase_qty).toFixed(3)} {row.unit}</td>
                  <td className="border px-1 py-1 text-right">{Number(row.issue_qty).toFixed(3)} {row.unit}</td>
                  <td className="border px-1 py-1 text-right">{formatCurrency(row.issue_value)}</td>
                  <td className="border px-1 py-1 text-right">{Number(row.purchase_return_qty).toFixed(3)} {row.unit}</td>
                  <td className="border px-1 py-1 text-right">{Number(row.stock_adjustment_qty).toFixed(3)} {row.unit}</td>
                  <td className="border px-1 py-1 text-right">{Number(row.closing_stock).toFixed(3)} {row.unit}</td>
                  <td className="border px-1 py-1 text-right">{formatCurrency(row.closing_value)}</td>
                </tr>
              ))
            )}
            {grandTotals && (
              <tr>
                <td className="border px-1 py-1 font-bold" colSpan={3}>GRAND TOTAL</td>
                <td className="border px-1 py-1 text-right font-bold">{grandTotals.opening.toFixed(3)}</td>
                <td className="border px-1 py-1 text-right font-bold">{grandTotals.purchase.toFixed(3)}</td>
                <td className="border px-1 py-1 text-right font-bold">{grandTotals.issues.toFixed(3)}</td>
                <td className="border px-1 py-1 text-right font-bold">{formatCurrency(grandTotals.issue_val)}</td>
                <td className="border px-1 py-1 text-right font-bold">{grandTotals.returns.toFixed(3)}</td>
                <td className="border px-1 py-1 text-right font-bold">{grandTotals.adjust.toFixed(3)}</td>
                <td className="border px-1 py-1 text-right font-bold">{grandTotals.closing.toFixed(3)}</td>
                <td className="border px-1 py-1 text-right font-bold">{formatCurrency(grandTotals.closing_val)}</td>
              </tr>
            )}
          </tbody>
        </table>

        <table className="w-full mt-4 text-[9px] border-collapse border border-black footer-table">
          <thead>
            <tr className="bg-gray-100 uppercase font-bold">
              <th className="border border-black p-1 text-left w-1/3">Daily Summary</th>
              <th className="border border-black p-1 text-left w-1/3">Manpower</th>
              <th className="border border-black p-1 text-left w-1/3">Wastage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2 align-top">
                <div className="space-y-1">
                  <div className="flex justify-between"><b>Devotees Served</b> <span>{fmt2(devotees)}</span></div>
                  <div className="flex justify-between"><b>Batches Cooked</b> <span>{fmt2(timesCooked)}</span></div>
                  {rawReturns.length > 0 && <div className="mt-1 pt-1 border-t border-black/10"><b>Raw Returns:</b></div>}
                  {rawReturns.map((r: any) => (
                    <div key={`print-return-${r.item_name}`} className="flex justify-between">
                      <span>{r.item_name} Remained</span>
                      <span>{Number(r.qty_returned).toFixed(3)} {r.unit}</span>
                    </div>
                  ))}
                </div>
              </td>
              <td className="border border-black p-2 align-top">
                <div className="space-y-0.5">
                  {personRows.map(([label, value]) => (
                    <div key={`print-person-${label as string}`} className="flex justify-between">
                      <span>{label as string}</span>
                      <span>{fmt2(value as number)}</span>
                    </div>
                  ))}
                </div>
              </td>
              <td className="border border-black p-2 align-top">
                <div className="flex flex-col h-full">
                  <div className="space-y-0.5 flex-1">
                    {wastageItems.map((w: any) => (
                      <div key={`print-waste-${w.item_name}`} className="flex justify-between">
                        <span>{w.item_name}</span>
                        <span>{Number(w.qty).toFixed(3)} ({formatCurrency(w.approx_amount)})</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-right font-bold mt-2 pt-1 border-t border-black">
                    Total: {formatCurrency(wastageTotal || 0)}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CanteenSummaryPage;
