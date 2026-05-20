import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  PackagePlus,
  PackageMinus,
  RotateCcw,
  RotateCw,
  Settings2,
  Utensils,
  Heart } from

'lucide-react';

import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { formatQuantityWithUnit } from '../utils/quantity';

const txnTypes = {
  1: {
    label: 'Purchase',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: PackagePlus
  },
  2: {
    label: 'Usage Entry',
    className: 'bg-red-100 text-red-800 border-red-300',
    icon: Utensils
  },
  3: {
    label: 'Wastage',
    className: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: PackageMinus
  },
  4: {
    label: 'Stock Adjustment',
    className: 'bg-slate-200 text-slate-800 border-slate-400',
    icon: Settings2
  },
  5: {
    label: 'Purchase Return',
    className: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: RotateCcw
  },
  6: {
    label: 'Return to Stock',
    className: 'bg-sky-100 text-sky-800 border-sky-300',
    icon: RotateCw
  },
  7: {
    label: 'Donation',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: Heart
  }
};

const ItemHistoryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: item } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const res = await api.get(`/items/get_item/${id}`);
      return res.data;
    }
  });

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['item-ledger', id],
    queryFn: async () => {
      const ledgerRes = await api.get(`/items/get_stock_ledger/${id}`);
      return ledgerRes.data;
    }
  });

  const columns = useMemo(() => [
  {
    accessorKey: 'txn_date',
    header: 'Date',
    cell: (info) => <span className="text-text-main">{formatDate(info.getValue())}</span>
  },
  {
    accessorKey: 'txn_type',
    header: 'Action',
    cell: (info) => {
      const type = txnTypes[info.getValue()] || {
        label: 'Unknown',
        className: 'bg-gray-50 text-gray-700 border-gray-200',
        icon: Settings2
      };
      const Icon = type.icon;
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm ${type.className}`}>
            <Icon className="h-3.5 w-3.5" />
            {type.label}
          </span>);

    }
  },
  {
    accessorKey: 'qty_in',
    header: () => <div className="text-right">Stocks Added (+)</div>,
    cell: (info) => {
      const val = Number(info.getValue());
      return (
        <div className={`text-right font-medium ${val > 0 ? 'text-green-600' : 'text-text-main/20'}`}>
            {val > 0 ? formatQuantityWithUnit(val, item?.unit) : '-'}
          </div>);

    }
  },
  {
    accessorKey: 'qty_out',
    header: () => <div className="text-right">Stocks Used (-)</div>,
    cell: (info) => {
      const val = Number(info.getValue());
      if (info.row.original.txn_type === 7) {
        return <div className="text-right text-text-main">0</div>;
      }
      return (
        <div className={`text-right font-medium ${val > 0 ? 'text-red-600' : 'text-text-main/20'}`}>
            {val > 0 ? formatQuantityWithUnit(val, item?.unit) : '-'}
          </div>);

    }
  },
  {
    accessorKey: 'balance',
    header: () => <div className="text-right">Current Stock</div>,
    cell: (info) => {
      return (
        <div className="text-right text-primary-main">
            {formatQuantityWithUnit(info.getValue(), item?.unit)}
          </div>);

    }
  },
  {
    accessorKey: 'unit_cost',
    header: () => <div className="text-right">Rate</div>,
    cell: (info) => <div className="text-right text-text-main">{formatCurrency(info.getValue())}</div>
  },
  {
    accessorKey: 'value_in',
    header: () => <div className="text-right">Added Cost</div>,
    cell: (info) => {
      const val = Number(info.getValue());
      if (info.row.original.txn_type === 7) {
        return <div className="text-right text-text-main">{formatCurrency(0)}</div>;
      }
      return <div className="text-right text-text-main">{val > 0 ? formatCurrency(val) : '-'}</div>;
    }
  },
  {
    accessorKey: 'value_out',
    header: () => <div className="text-right">Usage Cost</div>,
    cell: (info) => {
      const val = Number(info.getValue());
      if (info.row.original.txn_type === 7) {
        return <div className="text-right text-text-main">{formatCurrency(0)}</div>;
      }
      return <div className="text-right text-text-main text-orange-600">{val > 0 ? formatCurrency(val) : '-'}</div>;
    }
  },
  {
    accessorKey: 'current_value',
    header: () => <div className="text-right">Current Value</div>,
    cell: (info) => {
      const val = Number(info.getValue());
      return <div className="text-right text-primary-main">{formatCurrency(val)}</div>;
    }
  }],
  [item]);

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
      </div>

      <Card className="border-border-temple overflow-hidden bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={ledger?.items || []}
          loading={isLoading} />
        
      </Card>
    </div>);

};

export default ItemHistoryPage;