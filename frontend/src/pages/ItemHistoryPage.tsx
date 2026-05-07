import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ShoppingCart, 
  Utensils, 
  Settings2, 
  HelpCircle,
  History,
  ArrowLeft
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';

const txnTypes: Record<number, { label: string; icon: any; variant: "default" | "secondary" | "outline" | "error" }> = {
  1: { label: 'Purchase', icon: <ShoppingCart className="h-3 w-3 mr-1" />, variant: 'default' },
  2: { label: 'Consumption', icon: <Utensils className="h-3 w-3 mr-1" />, variant: 'error' },
  3: { label: 'Wastage', icon: <HelpCircle className="h-3 w-3 mr-1" />, variant: 'secondary' },
  4: { label: 'Adjustment', icon: <Settings2 className="h-3 w-3 mr-1" />, variant: 'outline' },
};

const ItemHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: item } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const res = await api.get(`/items/${id}`);
      return res.data;
    },
  });

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['item-ledger', id],
    queryFn: async () => {
      const res = await api.get(`/items/${id}/ledger`);
      return res.data;
    },
  });

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'id',
      header: 'Ledger ID',
      cell: info => <span className="text-text-main font-mono">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'txn_date',
      header: 'Date',
      cell: info => <span className="text-text-main">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'txn_type',
      header: 'Type',
      cell: info => {
        const type = txnTypes[info.getValue() as number] || { label: 'Unknown', variant: 'outline', icon: null };
        return (
          <Badge variant={type.variant} className="flex items-center w-fit">
            {type.icon}
            {type.label}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'ref_info',
      header: 'Reference',
      cell: info => {
        const row = info.row.original;
        return <span className="text-text-main text-sm">{row.ref_table} #{row.ref_id}</span>;
      }
    },
    {
      accessorKey: 'qty_in',
      header: () => <div className="text-right">Qty In</div>,
      cell: info => {
        const val = Number(info.getValue());
        return (
          <div className={`text-right font-bold ${val > 0 ? 'text-green-600' : 'text-text-main/30'}`}>
            {val > 0 ? `+${val}` : '-'}
          </div>
        );
      }
    },
    {
      accessorKey: 'qty_out',
      header: () => <div className="text-right">Qty Out</div>,
      cell: info => {
        const val = Number(info.getValue());
        return (
          <div className={`text-right font-bold ${val > 0 ? 'text-red-600' : 'text-text-main/30'}`}>
            {val > 0 ? `-${val}` : '-'}
          </div>
        );
      }
    },
    {
      accessorKey: 'unit_cost',
      header: () => <div className="text-right">Unit Cost</div>,
      cell: info => <div className="text-right text-text-main">₹{Number(info.getValue()).toLocaleString()}</div>
    },
    {
      accessorKey: 'value_in',
      header: () => <div className="text-right">Value In</div>,
      cell: info => {
        const val = Number(info.getValue());
        return <div className="text-right text-text-main">{val > 0 ? `₹${val.toLocaleString()}` : '-'}</div>;
      }
    },
    {
      accessorKey: 'value_out',
      header: () => <div className="text-right">Value Out</div>,
      cell: info => {
        const val = Number(info.getValue());
        return <div className="text-right text-text-main">{val > 0 ? `₹${val.toLocaleString()}` : '-'}</div>;
      }
    },
    {
      accessorKey: 'balance',
      header: () => <div className="text-right">Running Balance</div>,
      cell: info => (
        <div className="text-right font-bold text-primary-main">
          {info.getValue() as string}
        </div>
      )
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/items')} className="p-0 h-8 w-8 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-text-main text-2xl font-semibold font-temple">
            {item?.item_name || 'Loading...'}
          </h2>
        </div>
        <Button 
          onClick={() => navigate(`/items/${id}/price-history`)} 
          variant="outline"
          className="flex items-center gap-2 border-primary-main/20 text-primary-main hover:bg-primary-main/5"
        >
          <History className="h-4 w-4" />
          Price History
        </Button>
      </div>

      <Card className="border-border-temple overflow-hidden bg-white shadow-sm">
        <DataTable 
          columns={columns} 
          data={ledger || []} 
          loading={isLoading}
        />
      </Card>
    </div>
  );
};

export default ItemHistoryPage;
