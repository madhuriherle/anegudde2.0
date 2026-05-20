import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Printer } from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent } from '../components/ui/Card';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';

const CanteenSummaryPage = () => {
  const { showError, showSuccess } = useNotification();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isExporting, setIsExporting] = useState(false);

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['canteen-summary', selectedDate],
    queryFn: async () => {
      const res = await api.get('/reports/get_canteen_summary', { params: { date: selectedDate } });
      return res.data;
    }
  });

  const { data: menuItemsData } = useQuery({
    queryKey: ['menu-items-master'],
    queryFn: async () => {
      const res = await api.get('/menu-items/list_menu_items', { params: { page_size: 1000, status: 1 } });
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

  const handleDownloadPDF = async () => {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
      showError('No data available to export');
      return;
    }

    try {
      setIsExporting(true);
      const response = await api.get('/reports/get_canteen_summary_pdf', {
        params: { date: selectedDate },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `canteen_summary_${selectedDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSuccess('PDF exported successfully');
    } catch (error) {
      console.error('PDF Export failed', error);
      showError('Failed to generate PDF report');
    } finally {
      setIsExporting(false);
    }
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

  const groupedRows = useMemo(() => {
    const groups = {};
    orderedRows.forEach((row) => {
      const key = row.category_name || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [orderedRows]);

  const toEnglishCategory = (category) => {
    const match = String(category || '').match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim() : category;
  };

  const footer = reportData?.footer;
  const fmt2 = (n) => String(Math.trunc(n)).padStart(2, '0');
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
  ['Total Serving Persons', Number(footer?.total_serving_persons ?? 0)]];

  const wastageItems = footer?.wastage_items ?? [];
  const wastageTotal = Number(footer?.wastage_total_amount ?? 0);
  const isZero = (n) => Math.abs(Number(n || 0)) < 0.000001;
  const allItemRows = orderedRows.map((r) => ({
    item_name: String(r.item_name || ''),
    unit: String(r.unit || '')
  }));
  const unitByItemName = new Map(allItemRows.map((item) => [item.item_name, item.unit]));
  const rawReturnMap = new Map(
    rawReturns.map((r) => [String(r.item_name || ''), Number(r.qty_returned || 0)])
  );
  const wastageMap = new Map(
    wastageItems.map((w) => [
    String(w.item_name || ''),
    { qty: Number(w.qty || 0), amount: Number(w.approx_amount || 0) }]
    )
  );
  const rawReturnRowsAllItems = allItemRows.map((i) => ({
    item_name: i.item_name,
    unit: i.unit,
    qty_returned: rawReturnMap.get(i.item_name) ?? 0
  }));
  const rawReturnRowsForDisplay = rawReturnRowsAllItems.filter((r) => Number(r.qty_returned) > 0);
  const activeMenuItems = useMemo(() => {
    const payload = menuItemsData;
    if (!payload) return [];
    const list = Array.isArray(payload) ?
    payload :
    Array.isArray(payload?.rows) ?
    payload.rows :
    Array.isArray(payload?.items) ?
    payload.items :
    Array.isArray(payload?.data) ?
    payload.data :
    [];
    return list.filter((m) => Number(m?.status ?? 1) !== 0);
  }, [menuItemsData]);
  const menuItemNames = useMemo(() => {
    return activeMenuItems.
    map((m) => String(m?.dish_name ?? m?.item_name ?? m?.name ?? '').trim()).
    filter((name) => name.length > 0);
  }, [activeMenuItems]);
  const unitByMenuItemName = useMemo(() => {
    return new Map(
      activeMenuItems.map((m) => [
      String(m?.dish_name ?? m?.item_name ?? m?.name ?? '').trim(),
      String(m?.unit?.unit_code ?? '')]
      )
    );
  }, [activeMenuItems]);

  const wastageRowsAllItems = menuItemNames.map((name) => {
    const w = wastageMap.get(name);
    return {
      item_name: name,
      qty: w?.qty ?? 0,
      amount: w?.amount ?? 0
    };
  });

  const wastageRowsFallback = allItemRows.map((i) => {
    const w = wastageMap.get(i.item_name);
    return {
      item_name: i.item_name,
      qty: w?.qty ?? 0,
      amount: w?.amount ?? 0
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
          .canteen-summary-print .footer-table { page-break-inside: avoid; break-inside: avoid; }
          .canteen-summary-print .footer-section-title { font-size: 9px !important; letter-spacing: 0.02em; }
          .canteen-summary-print .footer-section-cell { padding: 7px 8px !important; vertical-align: top; }
          .canteen-summary-print .footer-summary-grid { display: grid; grid-template-columns: 160px 1fr; gap: 3px 10px; }
          .canteen-summary-print .footer-return-grid,
          .canteen-summary-print .footer-wastage-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px 18px; }
          .canteen-summary-print .footer-manpower-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px 16px; }
          .canteen-summary-print .footer-metric-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 4px; line-height: 1.25; }
          .canteen-summary-print .footer-metric-row span:first-child { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }
          .canteen-summary-print .no-wrap-print { white-space: nowrap !important; }
        }
      `}</style>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <h2 className="page-title">Canteen Summary Report</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="text-text-main"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Download PDF
          </Button>
          <Button variant="outline" onClick={handlePrint} className="text-text-main">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
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

        <div className="space-y-8 py-6 px-6">
          {isLoading ?
          <div className="py-20 text-center">
              <div className="flex items-center justify-center gap-2 text-text-main">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-lg font-bold">Loading report data...</span>
              </div>
            </div> :
          reportData?.rows?.length === 0 ?
          <div className="py-20 text-center text-text-main/60 font-bold uppercase tracking-widest border-2 border-dashed border-border-temple/40 rounded-xl">
              No data found for this date
            </div> :

          groupedRows.map(([categoryName, rows]) =>
          <section key={categoryName} className="space-y-3 print:break-inside-avoid">
                <h2 className="text-sm font-black uppercase tracking-wide text-primary">
                  {toEnglishCategory(categoryName)}
                </h2>

                <div className="overflow-x-auto print:overflow-visible rounded-md border border-border-temple">
                  <table className="w-full table-fixed text-sm border-collapse">
                    <colgroup>
                      <col className="w-[17%]" />
                      <col className="w-[8%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[9%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[8%]" />
                      <col className="w-[9%]" />
                      <col className="w-[7%]" />
                    </colgroup>
                    <thead className="bg-[#FFF4E6] border-b border-border-temple">
                      <tr className="text-text-main font-bold uppercase">
                        <th className="px-2 py-2 border-r border-border-temple text-left">Item Name</th>
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
                      {rows.map((row) =>
                  <tr key={row.item_id} className="hover:bg-bg-temple/20 transition-colors">
                          <td className="px-2 py-1.5 border-r border-border-temple font-medium truncate" title={row.item_name}>{row.item_name}</td>
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
                  )}
                    </tbody>
                    <tfoot className="bg-gray-50/80 font-black border-t-2 border-border-temple text-text-main">
                      <tr className="bg-[#FAF7F2]">
                        <td colSpan={2} className="px-2 py-2 border-r border-border-temple text-left uppercase tracking-tighter">TOTAL</td>
                        <td className="px-2 py-2 border-r border-border-temple text-right">{rows.reduce((a, b) => a + Number(b.opening_balance || 0), 0).toFixed(3)} {rows[0]?.unit}</td>
                        <td className="px-2 py-2 border-r border-border-temple text-right">{rows.reduce((a, b) => a + Number(b.purchase_qty || 0), 0).toFixed(3)} {rows[0]?.unit}</td>
                        <td className="px-2 py-2 border-r border-border-temple text-right">{rows.reduce((a, b) => a + Number(b.issue_qty || 0), 0).toFixed(3)} {rows[0]?.unit}</td>
                        <td className="px-2 py-2 border-r border-border-temple text-right">{formatCurrency(rows.reduce((a, b) => a + Number(b.issue_value || 0), 0))}</td>
                        <td className="px-2 py-2 border-r border-border-temple text-right">{rows.reduce((a, b) => a + Number(b.purchase_return_qty || 0), 0).toFixed(3)} {rows[0]?.unit}</td>
                        <td className="px-2 py-2 border-r border-border-temple text-right">{rows.reduce((a, b) => a + Number(b.stock_adjustment_qty || 0), 0).toFixed(3)} {rows[0]?.unit}</td>
                        <td className="px-2 py-2 border-r border-border-temple text-right font-black">{rows.reduce((a, b) => a + Number(b.closing_stock || 0), 0).toFixed(3)} {rows[0]?.unit}</td>
                        <td className="px-2 py-2 text-right font-black text-amber-900">{formatCurrency(rows.reduce((a, b) => a + Number(b.closing_value || 0), 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
          )
          }

          {grandTotals &&
          <div className="overflow-x-auto print:overflow-visible rounded-md border border-border-temple">
              <table className="w-full table-fixed text-sm border-collapse">
                <colgroup>
                  <col className="w-[17%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[9%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[8%]" />
                  <col className="w-[9%]" />
                  <col className="w-[7%]" />
                </colgroup>
                <tfoot className="bg-amber-50 font-black text-[13px] border-t-2 border-amber-200">
                  <tr className="text-amber-950">
                    <td colSpan={2} className="px-2 py-3 border-r border-amber-200 text-left uppercase tracking-tight">GRAND TOTAL</td>
                    <td className="px-2 py-3 border-r border-amber-200 text-right">{grandTotals.opening.toFixed(3)}</td>
                    <td className="px-2 py-3 border-r border-amber-200 text-right">{grandTotals.purchase.toFixed(3)}</td>
                    <td className="px-2 py-3 border-r border-amber-200 text-right">{grandTotals.issues.toFixed(3)}</td>
                    <td className="px-2 py-3 border-r border-amber-200 text-right">{formatCurrency(grandTotals.issue_val)}</td>
                    <td className="px-2 py-3 border-r border-amber-200 text-right">{grandTotals.returns.toFixed(3)}</td>
                    <td className="px-2 py-3 border-r border-amber-200 text-right">{grandTotals.adjust.toFixed(3)}</td>
                    <td className="px-2 py-3 border-r border-amber-200 text-right font-black">{grandTotals.closing.toFixed(3)}</td>
                    <td className="px-2 py-3 text-right font-black">{formatCurrency(grandTotals.closing_val)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }
        </div>

          {reportData?.footer &&
        <div className="p-4 border-t border-border-temple print:hidden">
              <div className="grid items-start gap-3 md:grid-cols-3">
                <div className="overflow-hidden rounded-md border border-border-temple">
                  <table className="w-full table-fixed text-sm border-collapse">
                    <thead className="bg-gray-50 border-b border-border-temple">
                      <tr className="text-text-main font-bold uppercase">
                        <th colSpan={2} className="px-2 py-2 text-left text-primary">Day Snapshot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-temple/40">
                      {[
                  ['No. of Mahaprasada Devotees', devotees.toLocaleString()],
                  ['Regular Cooking Persons', Number(footer?.regular_cooking_persons ?? 0)],
                  ['Additional Cooking Persons', Number(footer?.additional_cooking_persons ?? 0)],
                  ['Total Cooking Persons', Number(footer?.total_cooking_persons ?? 0)],
                  ['Regular Serving Persons', Number(footer?.regular_serving_persons ?? 0)],
                  ['Additional Serving Persons', Number(footer?.additional_serving_persons ?? 0)],
                  ['Total Serving Persons', Number(footer?.total_serving_persons ?? 0)],
                  ['Regular Cleaning Persons', Number(footer?.regular_cleaning_persons ?? 0)],
                  ['Additional Cleaning Persons', Number(footer?.additional_cleaning_persons ?? 0)],
                  ['Total Cleaning Persons', Number(footer?.total_cleaning_persons ?? 0)],
                  ['No. of Times Cooked', timesCooked]].
                  map(([label, value]) =>
                  <tr key={`snapshot-${label}`}>
                          <td className={`px-2 py-1.5 border-r border-border-temple ${label === 'No. of Mahaprasada Devotees' ? 'font-bold' : 'font-medium'}`}>{label}</td>
                          <td
                      className="px-2 py-1.5 text-center font-bold"
                      style={label === 'No. of Mahaprasada Devotees' ? { fontSize: '14px' } : undefined}>
                      
                            {value}
                          </td>
                        </tr>
                  )}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-hidden rounded-md border border-border-temple">
                  <table className="w-full table-fixed text-sm border-collapse">
                    <thead className="bg-gray-50 border-b border-border-temple">
                      <tr className="text-text-main font-bold uppercase">
                        <th colSpan={3} className="px-2 py-2 text-left text-red-700">Wastage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-temple/40">
                      {wastageRowsForDisplay.map((w) =>
                  <tr key={w.item_name}>
                          <td className="px-2 py-1.5 border-r border-border-temple font-medium truncate" title={w.item_name}>{w.item_name}</td>
                          <td className="px-2 py-1.5 border-r border-border-temple text-right font-semibold">
                            {Number(w.qty).toFixed(3)} {unitByItemName.get(w.item_name) || unitByMenuItemName.get(w.item_name) || ''}
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold">{formatCurrency(w.amount)}</td>
                        </tr>
                  )}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold border-t border-border-temple">
                      <tr>
                        <td colSpan={2} className="px-2 py-2 border-r border-border-temple text-left">Total Wastage</td>
                        <td className="px-2 py-2 text-right" style={{ fontSize: '14px' }}>{formatCurrency(wastageTotal || 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="overflow-hidden rounded-md border border-border-temple">
                  <table className="w-full table-fixed text-sm border-collapse">
                    <thead className="bg-gray-50 border-b border-border-temple">
                      <tr className="text-text-main font-bold uppercase">
                        <th colSpan={2} className="px-2 py-2 text-left text-green-700">Raw Items Returned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-temple/40">
                      {rawReturnRowsForDisplay.length === 0 ?
                  <tr>
                          <td colSpan={2} className="px-2 py-4 text-center text-text-main/60">No raw items returned.</td>
                        </tr> :
                  rawReturnRowsForDisplay.map((r) =>
                  <tr key={`raw-${r.item_name}`}>
                          <td className="px-2 py-1.5 border-r border-border-temple font-medium truncate" title={r.item_name}>{r.item_name}</td>
                          <td className="px-2 py-1.5 text-right font-semibold">{Number(r.qty_returned).toFixed(3)} {r.unit}</td>
                        </tr>
                  )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
        }
        </div>

      <div className="hidden print:block font-sans">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold font-temple">ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ, ಕುಂಭಾಶಿ (ಅನ್ನದಾನ)</h1>
          <div className="text-md font-bold uppercase tracking-widest mt-1">
            CANTEEN SUMMARY REPORT : <span className="font-black underline">{formatDate(selectedDate)}</span>
          </div>
        </div>

        <div className="space-y-8">
            {groupedRows.map(([categoryName, rows]) =>
          <div key={`print-group-${categoryName}`} className="space-y-2" style={{ pageBreakInside: 'avoid' }}>
                    <div className="flex items-center gap-2 border-b-2 border-black pb-1">
                        <h2 className="text-sm font-black uppercase tracking-widest">{categoryName}</h2>
                    </div>
                    <table className="w-full table-fixed text-[9px] border-collapse border border-black">
                        <colgroup>
                            <col className="w-[17%]" />
                            <col className="w-[8%]" />
                            <col className="w-[10%]" />
                            <col className="w-[10%]" />
                            <col className="w-[9%]" />
                            <col className="w-[10%]" />
                            <col className="w-[12%]" />
                            <col className="w-[8%]" />
                            <col className="w-[9%]" />
                            <col className="w-[7%]" />
                        </colgroup>
                        <thead>
                            <tr className="bg-gray-100 font-bold uppercase">
                                <th className="border border-black px-2 py-1 text-left">Item Name</th>
                                <th className="border border-black px-2 py-1 text-right">Rate</th>
                                <th className="border border-black px-2 py-1 text-right">Opening Stock</th>
                                <th className="border border-black px-2 py-1 text-right">Stock Added</th>
                                <th className="border border-black px-2 py-1 text-right">Stock Used</th>
                                <th className="border border-black px-2 py-1 text-right">Usage Value</th>
                                <th className="border border-black px-2 py-1 text-right">Returned</th>
                                <th className="border border-black px-2 py-1 text-right">Adjust</th>
                                <th className="border border-black px-2 py-1 text-right bg-gray-50">Closing Stock</th>
                                <th className="border border-black px-2 py-1 text-right bg-gray-50">Closing Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) =>
                <tr key={`print-row-${row.item_id}`}>
                                    <td className="border border-black px-2 py-1 font-bold">{row.item_name}</td>
                                    <td className="border border-black px-2 py-1 text-right italic">₹{Number(row.rate).toLocaleString()}</td>
                                    <td className="border border-black px-2 py-1 text-right">{Number(row.opening_balance).toFixed(3)}</td>
                                    <td className="border border-black px-2 py-1 text-right">{Number(row.purchase_qty).toFixed(3)}</td>
                                    <td className="border border-black px-2 py-1 text-right">{Number(row.issue_qty).toFixed(3)}</td>
                                    <td className="border border-black px-2 py-1 text-right font-semibold">₹{Number(row.issue_value).toLocaleString()}</td>
                                    <td className="border border-black px-2 py-1 text-right">{Number(row.purchase_return_qty || 0).toFixed(3)}</td>
                                    <td className="border border-black px-2 py-1 text-right">{Number(row.stock_adjustment_qty || 0).toFixed(3)}</td>
                                    <td className="border border-black px-2 py-1 text-right font-black bg-gray-50">{Number(row.closing_stock).toFixed(3)} {row.unit}</td>
                                    <td className="border border-black px-2 py-1 text-right font-black bg-gray-50">₹{Number(row.closing_value).toLocaleString()}</td>
                                </tr>
                )}
                        </tbody>
                        <tfoot className="bg-gray-50 font-black border-t-2 border-black">
                            <tr>
                                <td colSpan={2} className="border border-black px-2 py-1 text-[8px] uppercase">Category Totals</td>
                                <td className="border border-black px-2 py-1 text-right">{rows.reduce((a, b) => a + Number(b.opening_balance), 0).toFixed(3)}</td>
                                <td className="border border-black px-2 py-1 text-right">{rows.reduce((a, b) => a + Number(b.purchase_qty), 0).toFixed(3)}</td>
                                <td className="border border-black px-2 py-1 text-right">{rows.reduce((a, b) => a + Number(b.issue_qty), 0).toFixed(3)}</td>
                                <td className="border border-black px-2 py-1 text-right">₹{rows.reduce((a, b) => a + Number(b.issue_value), 0).toLocaleString()}</td>
                                <td className="border border-black px-2 py-1 text-right">{rows.reduce((a, b) => a + Number(b.purchase_return_qty || 0), 0).toFixed(3)}</td>
                                <td className="border border-black px-2 py-1 text-right">{rows.reduce((a, b) => a + Number(b.stock_adjustment_qty || 0), 0).toFixed(3)}</td>
                                <td className="border border-black px-2 py-1 text-right">{rows.reduce((a, b) => a + Number(b.closing_stock), 0).toFixed(3)}</td>
                                <td className="border border-black px-2 py-1 text-right">₹{rows.reduce((a, b) => a + Number(b.closing_value), 0).toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
          )}
        </div>

        {grandTotals &&
        <div className="mt-8 border-t-4 border-black pt-4" style={{ pageBreakInside: 'avoid' }}>
                <h3 className="text-xs font-black uppercase tracking-widest mb-4">Grand Summary Totals</h3>
                <table className="w-full text-[10px] border-collapse border-2 border-black">
                    <tbody>
                        <tr className="bg-gray-100 font-black">
                            <td className="border border-black px-3 py-2">TOTAL OPENING</td>
                            <td className="border border-black px-3 py-2 text-right">{grandTotals.opening.toFixed(3)}</td>
                            <td className="border border-black px-3 py-2">TOTAL PURCHASE</td>
                            <td className="border border-black px-3 py-2 text-right">{grandTotals.purchase.toFixed(3)}</td>
                        </tr>
                        <tr className="bg-white font-black">
                            <td className="border border-black px-3 py-2 text-orange-900">TOTAL STOCK USED</td>
                            <td className="border border-black px-3 py-2 text-right text-orange-900">{grandTotals.issues.toFixed(3)}</td>
                            <td className="border border-black px-3 py-2 text-orange-900">TOTAL USAGE VALUE</td>
                            <td className="border border-black px-3 py-2 text-right text-orange-900">₹{grandTotals.issue_val.toLocaleString()}</td>
                        </tr>
                        <tr className="bg-gray-50 font-black text-lg">
                            <td className="border border-black px-3 py-2 underline">GRAND BALANCE</td>
                            <td className="border border-black px-3 py-2 text-right underline">{grandTotals.closing.toFixed(3)}</td>
                            <td className="border border-black px-3 py-2 underline">GRAND TOTAL VALUE</td>
                            <td className="border border-black px-3 py-2 text-right underline">₹{grandTotals.closing_val.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        }

        <table className="w-full mt-2 text-[8px] border-collapse border border-black footer-table" style={{ pageBreakInside: 'avoid' }}>
          <thead>
            <tr className="bg-gray-100 uppercase font-bold footer-section-title">
              <th className="border border-black p-1 text-left">Daily Summary & Raw Returns</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2 align-top footer-section-cell">
                <div className="footer-summary-grid mb-2">
                  <b>No. of Mahaprasada Devotees</b> 
                  <span className="font-bold">: {devotees}</span>
                  <b>No. of Times Cooked</b> 
                  <span className="font-bold">: {timesCooked}</span>
                </div>
                
                <div className="pt-1 border-t border-black/20">
                  <div className="font-bold mb-1 uppercase text-[7px] opacity-70">Raw Returns (Remained)</div>
                  <div className="footer-return-grid">
                    {rawReturnRowsForDisplay.map((r) =>
                    <div key={`print-return-${r.item_name}`} className="footer-metric-row">
                        <span title={r.item_name}>{r.item_name}</span>
                        <span className="font-bold">: {Number(r.qty_returned).toFixed(3)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
            <tr className="bg-gray-100 uppercase font-bold footer-section-title">
              <th className="border border-black p-1 text-left">Manpower</th>
            </tr>
            <tr>
              <td className="border border-black p-2 align-top footer-section-cell">
                <div className="footer-manpower-grid">
                  {personRows.map(([label, value]) =>
                  <div key={`print-person-${label}`} className="footer-metric-row">
                      <span>{label}</span>
                      <span className="font-bold">: {fmt2(value)}</span>
                    </div>
                  )}
                </div>
              </td>
            </tr>
            <tr className="bg-gray-100 uppercase font-bold footer-section-title">
              <th className="border border-black p-1 text-left">Wastage</th>
            </tr>
            <tr>
              <td className="border border-black p-2 align-top footer-section-cell">
                <div className="flex flex-col h-full">
                  <div className="footer-wastage-grid flex-1">
                    {wastageRowsForDisplay.map((w) =>
                    <div key={`print-waste-${w.item_name}`} className="footer-metric-row">
                        <span title={w.item_name}>{w.item_name}</span>
                        <span className="font-semibold">: {Number(w.qty).toFixed(3)}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right font-bold mt-2 pt-1 border-t border-black text-[9px]">
                    Total Wastage: {formatCurrency(wastageTotal || 0)}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>);

};

export default CanteenSummaryPage;
