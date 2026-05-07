import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  History, 
  ArrowLeft,
  Calendar,
  User,
  Hash
} from 'lucide-react';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { type ColumnDef } from '@tanstack/react-table';

const ItemPriceHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: item } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const res = await api.get(`/items/${id}`);
      return res.data;
    },
  });

  const { data: priceHistory, isLoading } = useQuery({
    queryKey: ['item-prices', id],
    queryFn: async () => {
      const res = await api.get(`/items/${id}/price_history`);
      return res.data;
    },
    enabled: !!id
  });

  const columns = React.useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'purchase_date',
      header: 'Date',
      cell: info => (
        <div className="flex items-center gap-2 text-text-main">
          <Calendar className="h-3.5 w-3.5 opacity-40" />
          <span>{new Date(info.getValue() as string).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      accessorKey: 'vendor_name',
      header: 'Vendor / Source',
      cell: info => (
        <div className="space-y-0.5">
          <div className="text-text-main font-medium flex items-center gap-2">
            <User className="h-3.5 w-3.5 opacity-40" />
            {info.getValue() as string}
          </div>
          {info.row.original.bill_no !== '-' && (
            <div className="text-[10px] text-text-main/40 font-mono flex items-center gap-1.5 ml-5">
              <Hash className="h-2.5 w-2.5" />
              BILL: {info.row.original.bill_no}
            </div>
          )}
        </div>
      )
    },
    {
      accessorKey: 'price',
      header: () => <div className="text-right">Unit Price</div>,
      cell: info => (
        <div className="text-right">
          <span className="text-primary-main font-bold text-lg">₹{Number(info.getValue()).toLocaleString()}</span>
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 h-8 w-8 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <h2 className="text-text-main text-2xl font-semibold font-temple">Price History</h2>
            <p className="text-sm text-secondary/60 font-medium">{item?.item_name || 'Loading...'}</p>
          </div>
        </div>
      </div>

      <Card className="border-border-temple overflow-hidden bg-white shadow-sm">
        <CardContent className="p-0">
          <DataTable 
            columns={columns} 
            data={priceHistory || []} 
            loading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ItemPriceHistoryPage;
