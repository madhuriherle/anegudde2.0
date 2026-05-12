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

  const footer = reportData?.footer;
  const fmt2 = (n: number) => String(Math.trunc(n)).padStart(2, '0');
  const devotees = Number(footer?.mahaprasada_devotees ?? 0);
  const timesCooked = Number(footer?.times_cooked ?? 0);
  const rawReturns = (footer?.raw_returns ?? []).filter((r: any) => Number(r.qty_returned ?? 0) > 0);
  const showTopCard = devotees > 0 || timesCooked > 0 || rawReturns.length > 0;
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
  ].filter(([, value]) => value > 0);
  const showPersonsCard = personRows.length > 0;
  const wastageItems = (footer?.wastage_items ?? []).filter((w: any) => Number(w.qty ?? 0) > 0 || Number(w.approx_amount ?? 0) > 0);
  const wastageTotal = Number(footer?.wastage_total_amount ?? 0);
  const showWastageCard = wastageItems.length > 0 || wastageTotal > 0;

  return (
    <div className="space-y-6 print:space-y-2 canteen-summary-print">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          header, aside, footer { display: none !important; }
          main { padding: 0 !important; }
          .lg\\:pl-64 { padding-left: 0 !important; }
          .canteen-summary-print { padding-top: 8mm !important; }
          .canteen-summary-print, .canteen-summary-print * { overflow: visible !important; }
          .canteen-summary-print { font-size: 11px; }
          .canteen-summary-print table { table-layout: fixed; width: 100%; }
          .canteen-summary-print th, .canteen-summary-print td { padding: 4px 6px !important; }
          .canteen-summary-print .summary-grid { display: grid !important; grid-template-columns: 1fr 1fr 1fr !important; gap: 8px !important; }
          .canteen-summary-print .summary-card { min-height: 0 !important; }
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
          <p className="text-sm font-bold text-text-main mt-1">CANTEEN SUMMARY REPORT FOR DATE {formatDate(selectedDate)}</p>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-[11px] border-collapse">
            <thead className="bg-gray-50 border-b border-border-temple">
              <tr className="text-text-main font-bold uppercase">
                <th className="px-2 py-2 border-r border-border-temple text-center w-10">SL.NO</th>
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
                orderedRows.map((row: any, idx: number) => (
                  <tr key={row.item_id} className="hover:bg-bg-temple/20 transition-colors">
                    <td className="px-2 py-1.5 border-r border-border-temple text-center">{idx + 1}</td>
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
              )}
            </tbody>
            {grandTotals && (
              <tfoot className="bg-gray-50 font-bold border-t border-border-temple">
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
          <div className="p-4 border-t border-border-temple text-[12px] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 summary-grid">
              {showTopCard && (
              <div className="border border-border-temple rounded p-3 summary-card">
                <div className="inline-grid grid-cols-[max-content_max-content_max-content] gap-x-1 gap-y-1 items-center">
                  {devotees > 0 && (
                    <>
                      <span className="font-extrabold whitespace-nowrap">No. of Mahaprasada Devotees</span>
                      <span className="text-center font-extrabold">:</span>
                      <span className="font-extrabold tabular-nums">{fmt2(devotees)}</span>
                    </>
                  )}
                  {timesCooked > 0 && (
                    <>
                      <span className="font-extrabold whitespace-nowrap">No. of times cooked</span>
                      <span className="text-center font-extrabold">:</span>
                      <span className="font-extrabold tabular-nums">{fmt2(timesCooked)}</span>
                    </>
                  )}
                </div>
                {rawReturns.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border-temple/40 space-y-1">
                  {rawReturns.map((r: any) => (
                    <div key={r.item_name} className="inline-grid grid-cols-[max-content_max-content_max-content] gap-x-1 whitespace-nowrap no-wrap-print items-center">
                      <span className="font-extrabold">{r.item_name} Remained</span>
                      <span className="font-extrabold">:</span>
                      <span className="tabular-nums">{Number(r.qty_returned).toFixed(3)} {r.unit}</span>
                    </div>
                  ))}
                </div>
                )}
              </div>
              )}
              {showPersonsCard && (
              <div className="border border-border-temple rounded p-3 summary-card">
                <div className="inline-grid grid-cols-[max-content_max-content_max-content] gap-x-1 gap-y-1 items-center">
                  {personRows.map(([label, value]) => (
                    <React.Fragment key={label as string}>
                      <span className="font-extrabold whitespace-nowrap">{label as string}</span>
                      <span className="text-center font-extrabold">:</span>
                      <span className="tabular-nums">{fmt2(value as number)}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              )}
              {showWastageCard && (
              <div className="border border-border-temple rounded p-3 summary-card">
                {wastageItems.length ? (
                  <div className="max-h-52 overflow-y-auto print:max-h-none print:overflow-visible">
                    <div className="space-y-1">
                      {wastageItems.map((w: any) => (
                        <div key={w.item_name} className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-x-2 whitespace-nowrap no-wrap-print">
                          <span className="font-extrabold">{w.item_name} Remained</span>
                          <span className="text-right tabular-nums">{Number(w.qty).toFixed(3)}</span>
                          <span className="text-right tabular-nums">{formatCurrency(w.approx_amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="text-right font-bold mt-2">Total: {formatCurrency(wastageTotal || 0)}</div>
              </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="hidden print:block">
        <div className="text-center mb-2">
          <h1 className="text-lg font-bold font-temple">ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ, ಕುಂಭಾಶಿ (ಅನ್ನದಾನ)</h1>
          <div className="text-sm font-bold">CANTEEN SUMMARY REPORT FOR DATE {formatDate(selectedDate)}</div>
        </div>

        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="border">
              <th className="border px-1 py-1 text-center">SL.NO</th>
              <th className="border px-1 py-1 text-left">ITEM NAME</th>
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
            {orderedRows.map((row: any, idx: number) => (
              <tr key={`print-row-${row.item_id}-${idx}`}>
                <td className="border px-1 py-1 text-center">{idx + 1}</td>
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
            ))}
            {grandTotals && (
              <tr>
                <td className="border px-1 py-1 font-bold" colSpan={3}>GRAND TOTAL</td>                <td className="border px-1 py-1 text-right font-bold">{grandTotals.opening.toFixed(3)}</td>
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

        <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
          {showTopCard && (
            <div className="border p-2">
              {devotees > 0 && <div><b>No. of Mahaprasada Devotees</b> : {fmt2(devotees)}</div>}
              {timesCooked > 0 && <div><b>No. of times cooked</b> : {fmt2(timesCooked)}</div>}
              {rawReturns.map((r: any) => (
                <div key={`print-return-${r.item_name}`}><b>{r.item_name} Remained</b> : {Number(r.qty_returned).toFixed(3)} {r.unit}</div>
              ))}
            </div>
          )}
          {showPersonsCard && (
            <div className="border p-2">
              {personRows.map(([label, value]) => (
                <div key={`print-person-${label as string}`}><b>{label as string}</b> : {fmt2(value as number)}</div>
              ))}
            </div>
          )}
          {showWastageCard && (
            <div className="border p-2">
              {wastageItems.map((w: any) => (
                <div key={`print-waste-${w.item_name}`}><b>{w.item_name} Remained</b> {Number(w.qty).toFixed(3)} {formatCurrency(w.approx_amount)}</div>
              ))}
              <div className="text-right"><b>Total: {formatCurrency(wastageTotal || 0)}</b></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CanteenSummaryPage;
