import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Download, 
  Calendar,
  ChevronRight,
  Info
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';

const MonthlyPerformanceReportPage: React.FC = () => {
  const { data: monthlyData, isLoading } = useQuery({
    queryKey: ['monthly-performance'],
    queryFn: async () => {
      const res = await api.get('/reports/monthly-performance');
      return res.data;
    },
  });

  const totalStockValue = monthlyData?.reduce((sum: number, row: any) => sum + (Number(row.stock_value) || 0), 0) || 0;

  const handleExport = () => {
    if (!monthlyData || monthlyData.length === 0) {
      alert('No data available to export');
      return;
    }

    const headers = [
      'Month',
      'Item Name',
      'Opening Stock',
      'Purchased',
      'Consumed',
      'Wastage',
      'Adjustment',
      'Closing Stock',
      'Stock Value',
    ];

    const rows = monthlyData.map((row: any) => [
      row.month,
      row.item_name,
      row.opening_stock,
      row.total_purchased,
      row.total_consumed,
      row.total_wastage,
      row.total_adjustment,
      row.closing_stock,
      row.stock_value,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `monthly_performance_report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'month',
      header: 'Month',
      cell: info => (
        <span className="text-text-main font-semibold">
          {formatDate(info.getValue())}
        </span>
      ),
    },
    {
      accessorKey: 'item_name',
      header: 'Item Name',
      cell: info => <span className="text-text-main">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'opening_stock',
      header: () => <div className="text-right">Opening</div>,
      cell: info => <div className="text-right text-text-main">{Number(info.getValue()).toFixed(2)}</div>,
    },
    {
      accessorKey: 'total_purchased',
      header: () => <div className="text-right">Purchased</div>,
      cell: info => <div className="text-right text-green-600 font-medium">+{Number(info.getValue()).toFixed(2)}</div>,
    },
    {
      accessorKey: 'total_consumed',
      header: () => <div className="text-right">Consumed</div>,
      cell: info => <div className="text-right text-red-600 font-medium">-{Number(info.getValue()).toFixed(2)}</div>,
    },
    {
      accessorKey: 'total_wastage',
      header: () => <div className="text-right">Wastage</div>,
      cell: info => <div className="text-right text-orange-600 font-medium">-{Number(info.getValue()).toFixed(2)}</div>,
    },
    {
      accessorKey: 'closing_stock',
      header: () => <div className="text-right">Closing</div>,
      cell: info => <div className="text-right text-text-main font-bold">{Number(info.getValue()).toFixed(2)}</div>,
    },
    {
      accessorKey: 'stock_value',
      header: () => <div className="text-right">Est. Value</div>,
      cell: info => (
        <div className="text-right text-text-main font-medium">
          {formatCurrency(info.getValue())}
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Monthly Performance</h2>
        </div>
        <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary-main border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 text-white/80 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Cumulative Stock Value</span>
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <div className="text-3xl font-bold text-white">
              {formatCurrency(totalStockValue)}
            </div>
            <p className="text-xs text-white/60 mt-2 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Total value of all item snapshots in this report
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border-temple bg-white/80 backdrop-blur-sm overflow-hidden">
        <DataTable 
          columns={columns} 
          data={monthlyData || []} 
          loading={isLoading}
        />
        {monthlyData?.length === 0 && !isLoading && (
          <div className="py-20 text-center space-y-4">
            <Info className="h-10 w-10 text-text-main/20 mx-auto" />
            <p className="text-text-main/60">No monthly summaries found.</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MonthlyPerformanceReportPage;


