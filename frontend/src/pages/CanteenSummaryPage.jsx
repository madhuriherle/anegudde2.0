import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Filter } from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { PrinterSelectDropdown } from '../components/PrinterSelectDropdown';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent } from '../components/ui/Card';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';

const CanteenSummaryPage = () => {
  const { showError, showSuccess } = useNotification();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

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

  const { data: itemsData } = useQuery({
    queryKey: ['items-list-all-summary'],
    queryFn: async () => (await api.get('/items/list_items', { params: { page_size: 1000 } })).data
  });

  const itemCodeMap = useMemo(() => {
    const map = {};
    (itemsData?.items || []).forEach((item) => {
      const serial = item?.serial_numbers?.[0]?.serial_number;
      const name = item.item_name;
      if (serial) map[name] = parseInt(serial, 10);
    });
    return map;
  }, [itemsData]);

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
    return [...rows].sort((a, b) => {
      const codeA = itemCodeMap[a.item_name] ?? 999;
      const codeB = itemCodeMap[b.item_name] ?? 999;
      if (codeA !== codeB) return codeA - codeB;
      return String(a.item_name || '').localeCompare(String(b.item_name || ''));
    });
  }, [reportData, itemCodeMap]);

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

  const footer = reportData?.footer;
  const fmt2 = (n) => String(Math.trunc(n)).padStart(2, '0');
  const devotees = Number(footer?.mahaprasada_devotees ?? 0);
  const timesCooked = Number(footer?.times_cooked ?? 0);
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
  const wastageMap = new Map(
    wastageItems.map((w) => [
    String(w.item_name || ''),
    { qty: Number(w.qty || 0), amount: Number(w.approx_amount || 0) }]
    )
  );
  const stockAdjustmentRowsForDisplay = filteredRows
    .filter((r) => Math.abs(Number(r.stock_adjustment_qty || 0)) > 0.000001)
    .map((r) => ({
      item_name: r.item_name,
      unit: r.unit,
      qty_adjusted: Number(r.stock_adjustment_qty || 0),
    }));
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
          html, body, #root, main {
            background: #ffffff !important;
            background-color: #ffffff !important;
          }
          header, aside, footer { display: none !important; }
          main { padding: 0 !important; }
          .lg\\:pl-64 { padding-left: 0 !important; }
          .canteen-summary-print { padding-top: 8mm !important; background: #ffffff !important; background-color: #ffffff !important; }
          .canteen-summary-print, .canteen-summary-print * { overflow: visible !important; }
          .canteen-summary-print { font-size: 11px; }
          .canteen-summary-print,
          .canteen-summary-print div,
          .canteen-summary-print section,
          .canteen-summary-print table,
          .canteen-summary-print thead,
          .canteen-summary-print tbody,
          .canteen-summary-print tfoot,
          .canteen-summary-print tr,
          .canteen-summary-print th,
          .canteen-summary-print td {
            background: #ffffff !important;
            background-color: #ffffff !important;
          }
          .canteen-summary-print table { table-layout: fixed; width: 100%; border-collapse: separate !important; border-spacing: 0 !important; border: 1px solid #d7c9ba !important; }
          .canteen-summary-print thead { display: table-header-group !important; }
          .canteen-summary-print tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          .canteen-summary-print .category-print-section { break-inside: avoid-page !important; page-break-inside: avoid !important; }
          .canteen-summary-print .category-print-title { break-after: avoid !important; page-break-after: avoid !important; }
          .canteen-summary-print .category-print-table thead { display: table-header-group !important; }
          .canteen-summary-print .category-print-table tbody tr:first-child { break-inside: avoid !important; page-break-inside: avoid !important; }
          .canteen-summary-print th, .canteen-summary-print td { padding: 4px 6px !important; border-right: 1px solid #d7c9ba !important; border-bottom: 1px solid #d7c9ba !important; }
          .canteen-summary-print th { border-top: 1px solid #d7c9ba !important; }
          .canteen-summary-print tr td:last-child, .canteen-summary-print tr th:last-child { border-right: none !important; }
          .canteen-summary-print tfoot td { border: 1px solid #cab7a4 !important; }
          .canteen-summary-print .canteen-summary-report-card,
          .canteen-summary-print .report-table-wrap {
            border: none !important;
            box-shadow: none !important;
          }
          .canteen-summary-print .canteen-summary-print-header {
            border-bottom: none !important;
          }
          .canteen-summary-print .shadow-sm,
          .canteen-summary-print .shadow,
          .canteen-summary-print .shadow-lg,
          .canteen-summary-print .shadow-xl,
          .canteen-summary-print .shadow-2xl {
            box-shadow: none !important;
          }
          .canteen-summary-print .grand-total-row td { border-top: 2px solid #bfa892 !important; border-bottom: 1px solid #bfa892 !important; }
          .canteen-summary-print .footer-table { border-collapse: collapse; width: 100%; margin-top: 4mm; }
          .canteen-summary-print .footer-table th, .canteen-summary-print .footer-table td { border: 1px solid #e2e8f0 !important; }
          .canteen-summary-print .footer-table th { background-color: #ffffff !important; }
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
        <h2 className="page-title">Mahaprasad Summary Report</h2>
        <div className="flex items-center gap-2">
          <PrinterSelectDropdown
            context="REPORT_CANTEEN"
            onPrint={handlePrint}
            buttonLabel="Print"
          />
        </div>
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

      <div className="canteen-summary-report-card bg-white border border-border-temple rounded-lg overflow-hidden shadow-sm">
        <div className="canteen-summary-print-header p-6 text-center border-b border-border-temple/40 print:pb-2">
          <h1 className="text-xl font-bold text-text-main uppercase font-temple">ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ, ಕುಂಭಾಶಿ (ಅನ್ನದಾನ)</h1>
          <p className="text-sm font-bold text-text-main mt-1">
            MAHAPRASAD SUMMARY REPORT FOR DATE : <span className="font-extrabold">{formatDate(selectedDate)}</span>
          </p>
        </div>

        <div className="p-4">
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

          !groupByCategory ? (
            /* FLAT LIST (Default) - Single Table */
            <div className="report-table-wrap overflow-x-auto print:overflow-visible rounded-xl border border-border-temple shadow-sm bg-white">
              <table className="w-full table-fixed text-sm border-collapse">
                <thead className="bg-[#FFF4E6] border-b border-border-temple">
                  <tr className="text-text-main font-normal uppercase">
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Item Name</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Rate</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Opening Stock</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Stock Added</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Stock Used</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Usage Value</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Purchase Ret.</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Stock Adjust</th>
                    <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Closing Stock</th>
                    <th className="px-3 py-2 text-left whitespace-normal break-words">Closing Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-temple/10">
                  {filteredRows.map((row) => (
                    <tr key={row.item_id} className="hover:bg-bg-temple/10 transition-colors">
                      <td className="px-3 py-2 border-r border-border-temple/10 font-medium text-text-main whitespace-normal break-words">{row.item_name}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main">{formatCurrency(row.rate)}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.opening_balance).toFixed(3)} {row.unit}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.purchase_qty).toFixed(3)} {row.unit}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.issue_qty).toFixed(3)} {row.unit}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-nowrap">{formatCurrency(row.issue_value)}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.purchase_return_qty).toFixed(3)} {row.unit}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.stock_adjustment_qty).toFixed(3)} {row.unit}</td>
                      <td className="px-3 py-2 border-r border-border-temple/10 font-bold text-text-main whitespace-normal break-words">{Number(row.closing_stock).toFixed(3)} {row.unit}</td>
                      <td className="px-3 py-2 text-text-main whitespace-nowrap">{formatCurrency(row.closing_value)}</td>
                    </tr>
                  ))}
                </tbody>
                {grandTotals && (
                  <tbody className="bg-[#FAF3E7] text-black font-black text-[15px] border-t-2 border-border-temple/60">
                    <tr className="grand-total-row text-black">
                      <td colSpan={2} className="px-3 py-5 border-r border-black/10 text-left uppercase tracking-[0.2em] font-black">GRAND TOTAL</td>
                      <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap font-black">{grandTotals.opening.toFixed(3)}</td>
                      <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap font-black">{grandTotals.purchase.toFixed(3)}</td>
                      <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap font-black">{grandTotals.issues.toFixed(3)}</td>
                      <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap font-black">{formatCurrency(grandTotals.issue_val)}</td>
                      <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap font-black">{grandTotals.returns.toFixed(3)}</td>
                      <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap font-black">{grandTotals.adjust.toFixed(3)}</td>
                      <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap font-black">{grandTotals.closing.toFixed(3)}</td>
                      <td className="px-3 py-5 text-left whitespace-nowrap font-black text-secondary">{formatCurrency(grandTotals.closing_val)}</td>
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
                        <tr className="text-text-main font-normal uppercase">
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Item Name</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Rate</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Opening Stock</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Stock Added</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Stock Used</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Usage Value</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Purchase Ret.</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Stock Adjust</th>
                          <th className="px-3 py-2 border-r border-border-temple/40 text-left whitespace-normal break-words">Closing Stock</th>
                          <th className="px-3 py-2 text-left whitespace-normal break-words">Closing Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-temple/10">
                        {rows.map((row) => (
                          <tr key={row.item_id} className="hover:bg-bg-temple/10 transition-colors">
                            <td className="px-3 py-2 border-r border-border-temple/10 font-medium text-text-main whitespace-normal break-words">{row.item_name}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main">{formatCurrency(row.rate)}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.opening_balance).toFixed(3)} {row.unit}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.purchase_qty).toFixed(3)} {row.unit}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.issue_qty).toFixed(3)} {row.unit}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-nowrap">{formatCurrency(row.issue_value)}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.purchase_return_qty).toFixed(3)} {row.unit}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 text-text-main whitespace-normal break-words">{Number(row.stock_adjustment_qty).toFixed(3)} {row.unit}</td>
                            <td className="px-3 py-2 border-r border-border-temple/10 font-bold text-text-main whitespace-normal break-words">{Number(row.closing_stock).toFixed(3)} {row.unit}</td>
                            <td className="px-3 py-2 text-text-main whitespace-nowrap">{formatCurrency(row.closing_value)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tbody className="bg-[#FAF7F2] font-black text-[13px] border-t-2 border-border-temple/20">
                        <tr className="text-primary">
                          <td colSpan={2} className="px-3 py-3 border-r border-border-temple/10 uppercase tracking-tighter">TOTAL</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-nowrap">{rows.reduce((a, b) => a + Number(b.opening_balance || 0), 0).toFixed(3)}</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-nowrap">{rows.reduce((a, b) => a + Number(b.purchase_qty || 0), 0).toFixed(3)}</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-nowrap">{rows.reduce((a, b) => a + Number(b.issue_qty || 0), 0).toFixed(3)}</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-nowrap">{formatCurrency(rows.reduce((a, b) => a + Number(b.issue_value || 0), 0))}</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-nowrap">{rows.reduce((a, b) => a + Number(b.purchase_return_qty || 0), 0).toFixed(3)}</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-nowrap">{rows.reduce((a, b) => a + Number(b.stock_adjustment_qty || 0), 0).toFixed(3)}</td>
                          <td className="px-3 py-3 border-r border-border-temple/10 text-black whitespace-nowrap">{rows.reduce((a, b) => a + Number(b.closing_stock || 0), 0).toFixed(3)}</td>
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
                        <td colSpan={2} className="px-3 py-5 border-r border-black/10 text-left uppercase tracking-[0.2em]">GRAND TOTAL</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap">{grandTotals.opening.toFixed(3)}</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap">{grandTotals.purchase.toFixed(3)}</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap">{grandTotals.issues.toFixed(3)}</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap">{formatCurrency(grandTotals.issue_val)}</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap">{grandTotals.returns.toFixed(3)}</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap">{grandTotals.adjust.toFixed(3)}</td>
                        <td className="px-3 py-5 border-r border-black/10 text-left whitespace-nowrap">{grandTotals.closing.toFixed(3)}</td>
                        <td className="px-3 py-5 text-left whitespace-nowrap">{formatCurrency(grandTotals.closing_val)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
          }
        </div>

        {reportData?.footer &&
        <div className="p-4 border-t border-border-temple">
              <div className="grid items-start gap-3 md:grid-cols-3">
                <div className="overflow-x-auto rounded-md border border-border-temple shadow-sm bg-white">
                  <table className="w-full table-auto text-sm border-collapse">
                    <thead className="bg-[#FAF7F2] border-b border-border-temple">
                      <tr className="text-text-main font-normal uppercase">
                        <th colSpan={2} className="px-3 py-2 text-left text-primary">Day Snapshot</th>
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
                  <tr key={`snapshot-${label}`} className="hover:bg-gray-50/50 transition-colors">
                          <td className={`px-3 py-2 border-r border-border-temple ${label === 'No. of Mahaprasada Devotees' ? 'font-bold text-base' : 'font-medium'}`}>{label}</td>
                          <td
                      className={`px-3 py-2 text-left ${label === 'No. of Mahaprasada Devotees' ? 'font-bold text-base' : 'font-normal'}`}>
                      
                            {value}
                          </td>
                        </tr>
                  )}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-x-auto rounded-md border border-border-temple shadow-sm bg-white">
                  <table className="w-full table-auto text-sm border-collapse">
                    <thead className="bg-[#FAF7F2] border-b border-border-temple">
                      <tr className="text-text-main font-normal uppercase">
                        <th colSpan={3} className="px-3 py-2 text-left text-primary">Wastage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-temple/40">
                      {wastageRowsForDisplay.map((w) =>
                  <tr key={w.item_name} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-3 py-2 border-r border-border-temple font-normal whitespace-normal break-words" title={w.item_name}>{w.item_name}</td>
                          <td className="px-3 py-2 border-r border-border-temple text-left font-normal whitespace-nowrap">
                            {Number(w.qty).toFixed(3)} {unitByItemName.get(w.item_name) || unitByMenuItemName.get(w.item_name) || ''}
                          </td>
                          <td className="px-3 py-2 text-left font-normal whitespace-nowrap">{formatCurrency(w.amount)}</td>
                        </tr>
                  )}
                    </tbody>
                    <tbody className="bg-white font-normal border-t border-border-temple">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 border-r border-border-temple text-left">Total Wastage</td>
                        <td className="px-3 py-2 text-left text-base">{formatCurrency(wastageTotal || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="overflow-x-auto rounded-md border border-border-temple shadow-sm bg-white">
                  <table className="w-full table-auto text-sm border-collapse">
                    <thead className="bg-[#FAF7F2] border-b border-border-temple">
                      <tr className="text-text-main font-normal uppercase">
                        <th colSpan={2} className="px-3 py-2 text-left text-primary">Stock Adjustments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-temple/40">
                      {stockAdjustmentRowsForDisplay.length === 0 ?
                  <tr>
                          <td colSpan={2} className="px-3 py-4 text-center text-text-main/60">No stock adjustments.</td>
                        </tr> :
                  stockAdjustmentRowsForDisplay.map((r) =>
                  <tr key={`adj-${r.item_name}`} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-3 py-2 border-r border-border-temple font-normal whitespace-normal break-words" title={r.item_name}>{r.item_name}</td>
                          <td className="px-3 py-2 text-left font-normal whitespace-nowrap">
                            {r.qty_adjusted > 0 ? '+' : ''}{Number(r.qty_adjusted).toFixed(3)} {r.unit}
                          </td>
                        </tr>
                  )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
        }
        </div>

      <div className="hidden print:hidden font-sans">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold font-temple">ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ, ಕುಂಭಾಶಿ (ಅನ್ನದಾನ)</h1>
          <div className="text-md font-bold uppercase tracking-widest mt-1">
            MAHAPRASAD SUMMARY REPORT : <span className="font-black underline">{formatDate(selectedDate)}</span>
          </div>
        </div>

        <div className="space-y-8">
            {groupedRows.map(([categoryName, rows]) =>
          <div key={`print-group-${categoryName}`} className="space-y-2" style={{ pageBreakInside: 'avoid' }}>
                    <div className="flex items-center gap-2 border-b-2 border-black pb-1">
                        <h2 className="text-sm font-black uppercase tracking-widest">{categoryName}</h2>
                    </div>
                    <table className="w-full table-auto text-[9px] border-collapse border border-black">
                        <thead>
                            <tr className="bg-gray-100 font-bold uppercase">
                                <th className="border border-black px-2 py-1 text-left">Item Name</th>
                                <th className="border border-black px-2 py-1 text-left">Rate</th>
                                <th className="border border-black px-2 py-1 text-left">Opening Stock</th>
                                <th className="border border-black px-2 py-1 text-left">Stock Added</th>
                                <th className="border border-black px-2 py-1 text-left">Stock Used</th>
                                <th className="border border-black px-2 py-1 text-left">Usage Value</th>
                                <th className="border border-black px-2 py-1 text-left">Returned</th>
                                <th className="border border-black px-2 py-1 text-left">Adjust</th>
                                <th className="border border-black px-2 py-1 text-left bg-gray-50">Closing Stock</th>
                                <th className="border border-black px-2 py-1 text-left bg-gray-50">Closing Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) =>
                <tr key={`print-row-${row.item_id}`}>
                                    <td className="border border-black px-2 py-1 font-bold">{row.item_name}</td>
                                    <td className="border border-black px-2 py-1 text-left italic">₹{Number(row.rate).toLocaleString()}</td>
                                    <td className="border border-black px-2 py-1 text-left">{Number(row.opening_balance).toFixed(3)}</td>
                                    <td className="border border-black px-2 py-1 text-left">{Number(row.purchase_qty).toFixed(3)}</td>
                                    <td className="border border-black px-2 py-1 text-left">{Number(row.issue_qty).toFixed(3)}</td>
                                    <td className="border border-black px-2 py-1 text-left font-semibold">₹{Number(row.issue_value).toLocaleString()}</td>
                                    <td className="border border-black px-2 py-1 text-left">{Number(row.purchase_return_qty || 0).toFixed(3)}</td>
                                    <td className="border border-black px-2 py-1 text-left">{Number(row.stock_adjustment_qty || 0).toFixed(3)}</td>
                                    <td className="border border-black px-2 py-1 text-left font-black bg-gray-50">{Number(row.closing_stock).toFixed(3)} {row.unit}</td>
                                    <td className="border border-black px-2 py-1 text-left font-black bg-gray-50">₹{Number(row.closing_value).toLocaleString()}</td>
                                </tr>
                )}
                        </tbody>
                        <tbody className="bg-gray-50 font-black border-t-2 border-black">
                            <tr>
                                <td colSpan={2} className="border border-black px-2 py-1 text-[8px] uppercase">Category Totals</td>
                                <td className="border border-black px-2 py-1 text-left">{rows.reduce((a, b) => a + Number(b.opening_balance), 0).toFixed(3)}</td>
                                <td className="border border-black px-2 py-1 text-left">{rows.reduce((a, b) => a + Number(b.purchase_qty), 0).toFixed(3)}</td>
                                <td className="border border-black px-2 py-1 text-left">{rows.reduce((a, b) => a + Number(b.issue_qty), 0).toFixed(3)}</td>
                                <td className="border border-black px-2 py-1 text-left">₹{rows.reduce((a, b) => a + Number(b.issue_value), 0).toLocaleString()}</td>
                                <td className="border border-black px-2 py-1 text-left">{rows.reduce((a, b) => a + Number(b.purchase_return_qty || 0), 0).toFixed(3)}</td>
                                <td className="border border-black px-2 py-1 text-left">{rows.reduce((a, b) => a + Number(b.stock_adjustment_qty || 0), 0).toFixed(3)}</td>
                                <td className="border border-black px-2 py-1 text-left">{rows.reduce((a, b) => a + Number(b.closing_stock), 0).toFixed(3)}</td>
                                <td className="border border-black px-2 py-1 text-left">₹{rows.reduce((a, b) => a + Number(b.closing_value), 0).toLocaleString()}</td>
                            </tr>
                        </tbody>
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
                            <td className="border border-black px-3 py-2 text-left">{grandTotals.opening.toFixed(3)}</td>
                            <td className="border border-black px-3 py-2">TOTAL PURCHASE</td>
                            <td className="border border-black px-3 py-2 text-left">{grandTotals.purchase.toFixed(3)}</td>
                        </tr>
                        <tr className="bg-white font-black">
                            <td className="border border-black px-3 py-2 text-orange-900">TOTAL STOCK USED</td>
                            <td className="border border-black px-3 py-2 text-left text-orange-900">{grandTotals.issues.toFixed(3)}</td>
                            <td className="border border-black px-3 py-2 text-orange-900">TOTAL USAGE VALUE</td>
                            <td className="border border-black px-3 py-2 text-left text-orange-900">₹{grandTotals.issue_val.toLocaleString()}</td>
                        </tr>
                        <tr className="bg-gray-50 font-black text-lg">
                            <td className="border border-black px-3 py-2 underline">GRAND BALANCE</td>
                            <td className="border border-black px-3 py-2 text-left underline">{grandTotals.closing.toFixed(3)}</td>
                            <td className="border border-black px-3 py-2 underline">GRAND TOTAL VALUE</td>
                            <td className="border border-black px-3 py-2 text-left underline">₹{grandTotals.closing_val.toLocaleString()}</td>
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
                    {stockAdjustmentRowsForDisplay.map((r) =>
                    <div key={`print-return-${r.item_name}`} className="footer-metric-row">
                        <span title={r.item_name}>{r.item_name}</span>
                        <span className="font-bold">: {r.qty_adjusted > 0 ? '+' : ''}{Number(r.qty_adjusted).toFixed(3)}</span>
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
                  <div className="text-left font-bold mt-2 pt-1 border-t border-black text-[9px]">
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
