import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Printer, Filter } from 'lucide-react';
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
    <div className="space-y-6 print:space-y-2 canteen-summary-print report-print-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <h2 className="page-title">Canteen Summary Report</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="text-text-main">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
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

      <div className="bg-white border border-border-temple rounded-lg overflow-hidden shadow-sm">
        <div className="p-6 text-center border-b border-border-temple/40 print:pb-2">
          <h1 className="text-xl font-bold text-text-main uppercase font-temple">ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ, ಕುಂಭಾಶಿ (ಅನ್ನದಾನ)</h1>
          <p className="text-sm font-bold text-text-main mt-1">
            CANTEEN SUMMARY REPORT FOR DATE : <span className="font-extrabold">{formatDate(selectedDate)}</span>
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
              <table className="w-full table-fixed text-sm border-collapse canteen-main-table">
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
                <section key={categoryName} className="space-y-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-primary px-1">
                    {toEnglishCategory(categoryName)}
                  </h2>
                  <div className="report-table-wrap overflow-x-auto print:overflow-visible rounded-xl border border-border-temple shadow-sm bg-white">
                    <table className="w-full table-fixed text-sm border-collapse canteen-main-table">
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
                <div className="overflow-hidden rounded-md border border-border-temple shadow-sm bg-white">
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

                <div className="overflow-hidden rounded-md border border-border-temple shadow-sm bg-white">
                  <table className="w-full table-auto text-sm border-collapse">
                    <thead className="bg-[#FAF7F2] border-b border-border-temple">
                      <tr className="text-text-main font-normal uppercase">
                        <th colSpan={3} className="px-3 py-2 text-left text-red-700">Wastage</th>
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
                    <tbody className="bg-gray-50 font-normal border-t border-border-temple">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 border-r border-border-temple text-left">Total Wastage</td>
                        <td className="px-3 py-2 text-left text-base">{formatCurrency(wastageTotal || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="overflow-hidden rounded-md border border-border-temple shadow-sm bg-white">
                  <table className="w-full table-auto text-sm border-collapse">
                    <thead className="bg-[#FAF7F2] border-b border-border-temple">
                      <tr className="text-text-main font-bold uppercase">
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
    </div>);

};

export default CanteenSummaryPage;
