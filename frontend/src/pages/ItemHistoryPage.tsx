import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  ShoppingCart, 
  Utensils, 
  Settings2, 
  HelpCircle 
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';

const txnTypes: Record<number, { label: string; icon: any; variant: "default" | "secondary" | "outline" | "ghost" | "error" }> = {
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
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/items')}
          className="rounded-full h-10 w-10 p-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-text-main text-2xl font-semibold font-temple">
            {item?.item_name || 'Loading...'}
          </h2>
          <p className="text-text-main/70">Inventory transaction history and running balance.</p>
        </div>
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
