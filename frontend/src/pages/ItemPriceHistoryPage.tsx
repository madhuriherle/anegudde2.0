import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft
} from 'lucide-react';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';

const ItemPriceHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: item } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const res = await api.get(`/items/get_item/${id}`);
      return res.data;
    },
  });

  const { data: priceHistory, isLoading } = useQuery({
    queryKey: ['item-prices', id],
    queryFn: async () => {
      const priceRes = await api.get(`/items/get_price_history/${id}`);
      return priceRes.data;
    },
    enabled: !!id
  });

  const historyRows = React.useMemo(() => (priceHistory || []) as any[], [priceHistory]);
  const latestRow = React.useMemo(() => historyRows[0] || null, [historyRows]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 h-8 w-8 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-baseline gap-2">
            <h2 className="page-title">Price History</h2>
            <p className="text-sm text-secondary/60 font-medium">:{item?.item_name || 'Loading...'}</p>
          </div>
        </div>
      </div>

      <Card className="mx-auto w-full max-w-[900px] border-border-temple overflow-hidden bg-white shadow-sm">
        <CardContent className="p-0">
          {latestRow && (
            <div className="border-b border-border-temple/40 bg-[#F8F3EC] px-4 py-4">
              <div className="rounded-xl border border-[#E8D9C8] bg-gradient-to-r from-white to-[#FFF8EF] px-4 py-3 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-secondary/70">Latest Price</div>
                    <div className="text-[42px] leading-none font-black text-[#D05E2D] mt-1">{formatCurrency(latestRow.price)}</div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-semibold text-text-main/70">{formatDate(latestRow.purchase_date)}</div>
                    <div className="text-xs font-bold text-text-main">{latestRow.vendor_name || 'Unknown Vendor'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-[13px] text-left">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[42%]" />
                <col className="w-[28%]" />
              </colgroup>
              <thead className="bg-primary text-white text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 border-b border-primary/20">Date</th>
                  <th className="px-3 py-2 border-b border-primary/20">Vendor / Source</th>
                  <th className="px-3 py-2 border-b border-primary/20 text-right">Unit Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="h-24 text-center text-gray-500">Loading...</td>
                  </tr>
                ) : historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="h-24 text-center text-gray-500">No price history found.</td>
                  </tr>
                ) : (
                  historyRows.map((row: any, idx: number) => (
                    <tr key={`${row.purchase_date}-${idx}`} className="transition-colors odd:bg-white even:bg-[#FCFAF7] hover:bg-gray-50/80">
                      <td className="px-3 py-2.5 text-text-main">{formatDate(row.purchase_date)}</td>
                      <td className="px-3 py-2.5 text-text-main">{row.vendor_name || '-'}</td>
                      <td className="px-3 py-2.5 text-right text-text-main">{formatCurrency(row.price)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border-temple/30 px-4 py-3 text-xs text-secondary/80">
            <span>Showing {historyRows.length} results</span>
            <span>Latest update first</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ItemPriceHistoryPage;

