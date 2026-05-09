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
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';

const txnTypes: Record<number, { label: string; icon: any; variant: "default" | "secondary" | "outline" | "error" }> = {
  1: { label: 'Purchase', icon: <ShoppingCart className="h-3 w-3 mr-1" />, variant: 'default' },
  2: { label: 'Usage Entry', icon: <Utensils className="h-3 w-3 mr-1" />, variant: 'error' },
  3: { label: 'Wastage', icon: <HelpCircle className="h-3 w-3 mr-1" />, variant: 'secondary' },
  4: { label: 'Adjustment', icon: <Settings2 className="h-3 w-3 mr-1" />, variant: 'outline' },
};

const ItemHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: item } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const res = await api.get(`/items/get_item/${id}`);
      return res.data;
    },
  });

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['item-ledger', id],
    queryFn: async () => {
      const ledgerRes = await api.get(`/items/get_stock_ledger/${id}`);
      return ledgerRes.data;
    },
  });

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'txn_date',
      header: 'Date',
      cell: info => <span className="text-text-main">{formatDate(info.getValue())}</span>,
    },
    {
      accessorKey: 'txn_type',
      header: 'Action',
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
      accessorKey: 'qty_in',
      header: () => <div className="text-right">Stocks Added (+)</div>,
      cell: info => {
        const val = Number(info.getValue());
        return (
          <div className={`text-right ${val > 0 ? 'text-green-600' : 'text-text-main/30'}`}>
            {val > 0 ? `+${val}` : '-'}
            {val > 0 && item?.unit?.unit_code && <span className="ml-1 text-[10px] opacity-60 font-normal text-text-main">{item.unit.unit_code}</span>}
          </div>
        );
      }
    },
    {
      accessorKey: 'qty_out',
      header: () => <div className="text-right">Stocks Used (-)</div>,
      cell: info => {
        const val = Number(info.getValue());
        return (
          <div className={`text-right ${val > 0 ? 'text-red-600' : 'text-text-main/30'}`}>
            {val > 0 ? `-${val}` : '-'}
            {val > 0 && item?.unit?.unit_code && <span className="ml-1 text-[10px] opacity-60 font-normal text-text-main">{item.unit.unit_code}</span>}
          </div>
        );
      }
    },
    {
      accessorKey: 'balance',
      header: () => <div className="text-right">Current Stock</div>,
      cell: info => {
        return (
          <div className="text-right text-primary-main">
            {info.getValue() as string}
            {item?.unit?.unit_code && <span className="ml-1 text-[10px] opacity-60 font-normal">{item.unit.unit_code}</span>}
          </div>
        );
      }
    },
    {
      accessorKey: 'unit_cost',
      header: () => <div className="text-right">Rate</div>,
      cell: info => <div className="text-right text-text-main">{formatCurrency(info.getValue())}</div>
    },
    {
      accessorKey: 'value_in',
      header: () => <div className="text-right">Added Cost</div>,
      cell: info => {
        const val = Number(info.getValue());
        return <div className="text-right text-text-main">{val > 0 ? formatCurrency(val) : '-'}</div>;
      }
    },
    {
      accessorKey: 'value_out',
      header: () => <div className="text-right">Usage Cost</div>,
      cell: info => {
        const val = Number(info.getValue());
        return <div className="text-right text-text-main text-orange-600">{val > 0 ? formatCurrency(val) : '-'}</div>;
      }
    },
    {
      accessorKey: 'current_value',
      header: () => <div className="text-right">Current Value</div>,
      cell: info => {
        const val = Number(info.getValue());
        return <div className="text-right text-primary-main">{formatCurrency(val)}</div>;
      }
    },
  ], [item]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/items')} className="p-0 h-8 w-8 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="page-title leading-tight">
              Usage Record: {item?.item_name || 'Loading...'}
            </h2>
          </div>
        </div>
        <Button 
          onClick={() => navigate(`/items/${id}/price-history`)} 
          variant="outline"
          className="flex items-center gap-2 border-secondary/20 text-secondary hover:bg-secondary hover:text-white transition-colors"
        >
          <History className="h-4 w-4" />
          Price History
        </Button>
      </div>

      <Card className="border-border-temple overflow-hidden bg-white shadow-sm">
        <DataTable 
          columns={columns} 
          data={ledger?.items || []} 
          loading={isLoading}
        />
      </Card>
    </div>
  );
};

export default ItemHistoryPage;

