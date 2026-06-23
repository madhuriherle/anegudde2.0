import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

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
  DialogFooter } from
'../components/ui/Dialog';
import { DetailItem } from '../components/ui/DetailItem';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { QtyDisplay } from '../components/ui/QtyDisplay';

const WastagesPage = () => {
  const { showError } = useNotification();

  // Filter States
  const [customDate, setCustomDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingWastage, setViewingWastage] = useState(null);

  // Fetch Data
  const { data: wastagesData, isLoading: wastagesLoading } = useQuery({
    queryKey: ['wastages', customDate, page, pageSize],
    queryFn: async () => {
      const params = {
        page,
        page_size: pageSize
      };
      if (customDate) params.q = customDate;
      const res = await api.get('/wastages/list_wastages', { params });
      return res.data;
    }
  });

  const wastages = useMemo(() => wastagesData?.items ?? [], [wastagesData]);

  const handleView = async (wastage) => {
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

  const columns = useMemo(() => [
  {
    accessorKey: 'wastage_date',
    header: 'Date',
    cell: (info) => <span className="text-base text-text-main">{formatDate(info.getValue())}</span>
  },
  {
    id: 'dish_details',
    header: 'Menu Item Wasted',
    cell: (info) => {
      const items = info.row.original.items || [];
      return (
        <div className="space-y-1 py-1">
            {items.map((it, idx) =>
          <div key={idx} className="text-base text-text-main leading-relaxed min-h-[1.5rem] flex items-center">
                {it.menu_item?.dish_name || it.item?.item_name || 'Unknown'}
              </div>
          )}
          </div>);

    }
  },
  {
    id: 'qty_amt_details',
    header: 'Qty (Amt)',
    cell: (info) => {
      const items = info.row.original.items || [];
      return (
        <div className="space-y-1 py-1">
            {items.map((it, idx) =>
          <div key={idx} className="text-base text-text-main leading-relaxed min-h-[1.5rem] flex items-center gap-1.5 whitespace-nowrap">
                <span><QtyDisplay qty={it.quantity} unit={it.menu_item?.unit || it.item?.unit} /></span>
                <span>({formatCurrency(Number(it.approx_amount || 0))})</span>
              </div>
          )}
          </div>);

    }
  },
  {
    id: 'total_amount',
    header: 'Total Approx Amt',
    cell: (info) => {
      const items = info.row.original.items || [];
      const total = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.approx_amount || 0)), 0);
      return (
        <span className="text-base text-text-main">
            {formatCurrency(total)}
          </span>);

    }
  }],
  []);

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
                className="text-text-main" />
              
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
        totalCount={wastagesData?.total || 0} />
      

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
              <table className="w-full text-sm text-left">
                <thead className="bg-bg-temple text-text-main uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-3 py-3 border-b border-border-temple">Dish/Item Name</th>
                    <th className="px-3 py-3 border-b border-border-temple">Quantity</th>
                    <th className="px-3 py-3 border-b border-border-temple">Rate</th>
                    <th className="px-3 py-3 border-b border-border-temple">Total Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-temple/40">
                  {(viewingWastage?.items || []).map((item) =>
                  <tr key={item.id} className="hover:bg-bg-temple/30">
                      <td className="px-3 py-3 text-text-main font-medium">
                        {item.menu_item?.dish_name || item.item?.item_name}
                      </td>
                      <td className="px-3 py-3 text-left text-text-main">
                        <QtyDisplay qty={item.quantity} unit={item.menu_item?.unit || item.item?.unit} />
                      </td>
                      <td className="px-3 py-3 text-left text-text-main">
                        {formatCurrency(Number(item.approx_amount || 0))}
                      </td>
                      <td className="px-3 py-3 text-left text-text-main font-bold">
                        {formatCurrency(Number(item.quantity || 0) * Number(item.approx_amount || 0))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter className="!px-6 !py-4 border-t border-border-temple/40 flex justify-end shrink-0 bg-[#F3E8D4]">
            <Button onClick={() => setViewDialogOpen(false)} className="px-6 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-md">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

};

export default WastagesPage;
