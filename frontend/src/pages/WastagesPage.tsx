import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../components/ui/Dialog';
import { DetailItem } from '../components/ui/DetailItem';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { formatQuantityWithUnit } from '../utils/quantity';

const WastagesPage: React.FC = () => {
  const { showError } = useNotification();
  
  // Filter States
  const [customDate, setCustomDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingWastage, setViewingWastage] = useState<any>(null);

  // Fetch Data
  const { data: wastagesData, isLoading: wastagesLoading } = useQuery({
    queryKey: ['wastages', customDate, page, pageSize],
    queryFn: async () => {
      const params: any = { 
        page,
        page_size: pageSize,
      };
      if (customDate) params.q = customDate;
      const res = await api.get('/wastages/list_wastages', { params });
      return res.data;
    },
  });

  const wastages = useMemo(() => wastagesData?.items ?? [], [wastagesData]);

  const handleView = async (wastage: any) => {
    try {
      const res = await api.get('/wastages/get_wastage/' + wastage.id);
      setViewingWastage(res.data);
      setViewDialogOpen(true);
    } catch (err) {
      showError('Failed to fetch wastage details');
    }
  };

  // Grouped rows (One per record)
  const displayRows = useMemo(() => {
    return wastages;
  }, [wastages]);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { 
      accessorKey: 'wastage_date', 
      header: 'Date',
      cell: info => formatDate(info.getValue()),
    },
    { 
      id: 'dish_details',
      header: 'Menu Item Wasted', 
      cell: info => {
        const items = info.row.original.items || [];
        return (
          <div className="space-y-1 py-1">
            {items.map((it: any, idx: number) => (
              <div key={idx} className="text-[11px] text-text-main leading-tight h-4 flex items-center">
                {it.menu_item?.dish_name || it.item?.item_name || 'Unknown'}
              </div>
            ))}
          </div>
        );
      }
    },
    { 
      id: 'qty_details',
      header: 'Qty', 
      cell: info => {
        const items = info.row.original.items || [];
        return (
          <div className="space-y-1 py-1">
            {items.map((it: any, idx: number) => (
              <div key={idx} className="text-[11px] text-text-main leading-tight h-4 flex items-center">
                {formatQuantityWithUnit(it.quantity, it.menu_item?.unit || it.item?.unit)}
              </div>
            ))}
          </div>
        );
      }
    },
    {
      id: 'approx_details',
      header: 'Approx Amt',
      cell: info => {
        const items = info.row.original.items || [];
        return (
          <div className="space-y-1 py-1">
            {items.map((it: any, idx: number) => (
              <div key={idx} className="text-[11px] text-text-main leading-tight h-4 flex items-center">
                {formatCurrency(Number(it.approx_amount || 0))}
              </div>
            ))}
          </div>
        );
      }
    },
    {
      id: 'total_amount',
      header: 'Total Approx Amt',
      cell: info => {
        const items = info.row.original.items || [];
        const total = items.reduce((sum: number, it: any) => sum + Number(it.approx_amount || 0), 0);
        return (
          <span className="text-text-main">
            {formatCurrency(total)}
          </span>
        );
      }
    }
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Wastage Records</h2>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-text-main">Date</Label>
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="text-text-main"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={displayRows}
        loading={wastagesLoading}
        manualPagination
        pageCount={wastagesData?.total_pages || 0}
        pageIndex={page - 1}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
        totalCount={wastagesData?.total || 0}
      />

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-xl border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">Wastage Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-0 mt-4">
            <DetailItem label="Wastage Date" value={formatDate(viewingWastage?.wastage_date)} />
            <DetailItem label="Reason" value={viewingWastage?.reason} />
            <DetailItem label="Recorded By" value={viewingWastage?.user?.full_name} />

            <div className="pt-6 pb-2">
              <span className="text-sm font-bold text-text-main">Wasted Dishes List</span>
            </div>
            <div className="mt-1 max-w-[560px] rounded-md border border-border-temple overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-bg-temple text-text-main uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="px-3 py-2 border-b border-border-temple">Dish Name</th>
                    <th className="px-3 py-2 border-b border-border-temple text-right">Quantity</th>
                    <th className="px-3 py-2 border-b border-border-temple text-right">Approx Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-temple/40">
                  {(viewingWastage?.items || []).map((item: any) => (
                    <tr key={item.id} className="hover:bg-bg-temple/30">
                      <td className="px-3 py-2 text-text-main">
                        {item.menu_item?.dish_name || item.item?.item_name}
                      </td>
                      <td className="px-3 py-2 text-right text-text-main">
                        {formatQuantityWithUnit(item.quantity, item.menu_item?.unit || item.item?.unit)}
                      </td>
                      <td className="px-3 py-2 text-right text-text-main">
                        {formatCurrency(Number(item.approx_amount || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter className="mt-6 border-t border-border-temple/40 pt-4">
            <Button onClick={() => setViewDialogOpen(false)} className="bg-primary hover:bg-secondary text-white px-10">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WastagesPage;
