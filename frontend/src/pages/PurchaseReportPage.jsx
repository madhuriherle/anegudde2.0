import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Printer } from 'lucide-react';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatPeriod = (period, groupBy) => {
  if (!period) return '-';
  if (groupBy === 'day') return formatDate(period);
  if (groupBy === 'month') {
    const [year, month] = period.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }
  return period;
};

const PurchaseReportPage = () => {
  const today = toDateInputValue(new Date());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [groupBy, setGroupBy] = useState('day');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['purchase-report', fromDate, toDate, groupBy],
    queryFn: async () => {
      const res = await api.get('/reports/get_purchases_report', {
        params: {
          from_date: fromDate,
          to_date: toDate,
          group_by: groupBy,
        },
      });
      return res.data;
    },
    enabled: Boolean(fromDate && toDate),
  });

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        count: acc.count + Number(row.total_count || 0),
        amount: acc.amount + Number(row.total_amount || 0),
      }),
      { count: 0, amount: 0 }
    );
  }, [rows]);

  const averageAmount = totals.count > 0 ? totals.amount / totals.count : 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 purchase-report-print">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          header, aside, footer, .print\\:hidden { display: none !important; }
          html, body, #root, main { background: #ffffff !important; }
          main { padding: 0 !important; margin: 0 !important; }
          .lg\\:pl-64 { padding-left: 0 !important; }
          .purchase-report-print { padding: 0 !important; margin: 0 !important; background: #ffffff !important; }
          .purchase-report-print table {
            width: 100% !important;
            border-collapse: separate !important;
            border-spacing: 0 !important;
            border: 1px solid #d7c9ba !important;
          }
          .purchase-report-print thead { display: table-header-group !important; }
          .purchase-report-print tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          .purchase-report-print th,
          .purchase-report-print td {
            border-right: 1px solid #d7c9ba !important;
            border-bottom: 1px solid #d7c9ba !important;
            padding: 7px 8px !important;
            background: #ffffff !important;
          }
          .purchase-report-print tr td:last-child,
          .purchase-report-print tr th:last-child { border-right: none !important; }
          .purchase-report-print .report-card { border: none !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h2 className="page-title">Purchase Report</h2>
          <p className="mt-1 text-sm font-medium text-text-light">
            Date-wise purchase summary for the selected period.
          </p>
        </div>
        <Button variant="outline" onClick={handlePrint} className="text-text-main">
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      <Card className="border-border-temple print:hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="font-medium text-text-main">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-10 text-text-main"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-medium text-text-main">To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-10 text-text-main"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-medium text-text-main">Group By</Label>
              <Select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="h-10 text-text-main"
              >
                <option value="day">Day</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 print:hidden md:grid-cols-3">
        <Card className="border-border-temple bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-text-light">Total Amount</p>
            <p className="mt-2 text-2xl font-black text-text-main">{formatCurrency(totals.amount)}</p>
          </CardContent>
        </Card>
        <Card className="border-border-temple bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-text-light">Purchase Count</p>
            <p className="mt-2 text-2xl font-black text-text-main">{totals.count}</p>
          </CardContent>
        </Card>
        <Card className="border-border-temple bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-text-light">Average Amount</p>
            <p className="mt-2 text-2xl font-black text-text-main">{formatCurrency(averageAmount)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="report-card overflow-hidden rounded-lg border border-border-temple bg-white shadow-sm">
        <div className="border-b border-border-temple/40 p-5 text-center">
          <h1 className="font-temple text-xl font-bold uppercase text-text-main">
            Anegudde Sri Vinayaka Temple, Kumbhashi
          </h1>
          <p className="mt-1 text-sm font-bold uppercase text-text-main">
            Purchase Report From {formatDate(fromDate)} To {formatDate(toDate)}
          </p>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-border-temple bg-[#FFF4E6] text-xs font-bold uppercase tracking-wider text-text-main">
              <tr>
                <th className="w-[45%] px-4 py-3">Period</th>
                <th className="w-[25%] px-4 py-3 text-right">No. of Purchases</th>
                <th className="w-[30%] px-4 py-3 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-temple/20">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-sm font-medium text-text-light">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading purchase report...
                    </div>
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((row) => (
                  <tr key={row.period} className="hover:bg-[#fffaf4]">
                    <td className="px-4 py-3 font-medium text-text-main">
                      {formatPeriod(row.period, groupBy)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-main">
                      {Number(row.total_count || 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text-main">
                      {formatCurrency(row.total_amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center font-bold text-text-main">
                    No purchases found
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-border-temple bg-[#FAF3E7] font-black text-text-main">
              <tr>
                <td className="px-4 py-4 uppercase tracking-wider">Grand Total</td>
                <td className="px-4 py-4 text-right">{totals.count}</td>
                <td className="px-4 py-4 text-right">{formatCurrency(totals.amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PurchaseReportPage;
